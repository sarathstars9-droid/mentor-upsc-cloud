/**
 * backend/services/visualGeneration/visualGenerationService.js
 *
 * Core AI Generation & Visual Knowledge Synthesis Pipeline (Phase 2C).
 * 
 * CORE PRINCIPLE:
 * RETRIEVE -> VERIFY -> REUSE -> GENERATE ONLY IF MISSING -> VALIDATE -> SAVE -> REUSE
 */

import { query } from '../../db/index.js';
import { resolveTopicByQuery, getTopicVisualPack } from '../visualKnowledge/visualKnowledgeService.js';
import { getEvidenceByTopic, linkEvidenceToVisual } from '../evidence/evidenceService.js';
import { recommendVisualTypesForTopic } from './visualRecommendationService.js';
import { validateVisualSpecification } from './visualValidationService.js';
import { buildVisualGenerationPrompt } from './visualPromptBuilder.js';
import { generateAIContentWithMetadata } from '../aiAdapterService.js';
import { recordVisualGenerationUsage } from '../mentorUsageService.js';

export const VISUAL_AI_CONFIG = {
  structured: {
    provider: 'deepseek',
    model: process.env.DEEPSEEK_VISUAL_MODEL || 'deepseek-flash'
  },
  grounded: {
    provider: 'gemini',
    model: process.env.GEMINI_VISUAL_MODEL || 'gemini-3.8-flash'
  },
  light: {
    provider: 'gemini',
    model: process.env.GEMINI_LIGHT_MODEL || 'gemini-3.5-flash-lite'
  }
};

/**
 * Generate only missing visual knowledge assets for a topic.
 * Existing suitable visuals are always reused without re-generation.
 */
export async function generateVisualPackForTopic(topicIdOrQuery, options = {}) {
  const {
    examContext = 'both',
    region = null,
    mode = 'recommended',
    requestedTypes = [],
    userId = 'moulika',
    provider = null
  } = options;

  const startTime = Date.now();

  // 1. Resolve Topic
  let topic = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(topicIdOrQuery));

  if (isUuid) {
    const { rows } = await query(`SELECT * FROM knowledge_topics WHERE id = $1`, [topicIdOrQuery]);
    if (rows.length > 0) topic = rows[0];
  } else {
    topic = await resolveTopicByQuery(String(topicIdOrQuery));
  }

  if (!topic) {
    return {
      success: false,
      reason: 'TOPIC_NOT_FOUND',
      message: `Topic "${topicIdOrQuery}" could not be resolved to a canonical syllabus topic.`
    };
  }

  // 2. Retrieve Existing Visuals
  const currentPack = await getTopicVisualPack(topic.id, { examContext, region, userId });
  const existingVisuals = currentPack?.visuals || [];

  // 3. Determine Target Visual Types
  const targetTypes = Array.isArray(requestedTypes) && requestedTypes.length > 0
    ? requestedTypes
    : recommendVisualTypesForTopic(topic);

  // 4. Partition into Reused vs Missing
  const reused = [];
  const missingTypes = [];

  for (const type of targetTypes) {
    const existingMatch = existingVisuals.find(v => {
      const vGrammar = v.visual_spec?.visualGrammar || v.visual_spec?.grammar || v.visual_type;
      const vRenderer = (v.visual_spec?.renderer || '').toLowerCase();
      if (v.visual_type === type || vGrammar === type || vRenderer === type.toLowerCase()) return true;
      if (type === 'exam_sketch') {
        if (v.visual_type === 'exam_sketch' || vGrammar === 'exam_sketch') return true;
        if (v.is_canonical && (v.visual_type === 'hub_spoke' || vGrammar === 'hub_spoke' || v.visual_type === 'flowchart')) return true;
      }
      if (type === 'hub_spoke') {
        if (v.visual_type === 'hub_spoke' || vGrammar === 'hub_spoke') return true;
        if (v.is_canonical && (v.visual_type === 'exam_sketch' || vGrammar === 'exam_sketch')) return true;
      }
      return false;
    });
    if (existingMatch) {
      if (!reused.some(r => r.id === existingMatch.id)) {
        reused.push(existingMatch);
      }
    } else {
      missingTypes.push(type);
    }
  }

  // If all requested types exist, return immediately (Zero unnecessary generation)
  if (missingTypes.length === 0) {
    return {
      success: true,
      topic,
      reused,
      generated: [],
      skipped: [],
      warnings: [],
      message: 'All recommended visual types already exist in shared knowledge repository.'
    };
  }

  // 5. Retrieve verified evidence for topic
  const evidenceList = await getEvidenceByTopic(topic.id, {
    examContext,
    region,
    includeHistorical: true
  });

  const generated = [];
  const skipped = [];
  const warnings = [];

  // Determine if mock generation is explicitly allowed (test-only)
  const isExplicitMock = provider === 'mock' || process.env.NODE_ENV === 'test';

  // 6. Generate missing visual types
  for (const visualType of missingTypes) {
    const visualStartTime = Date.now();
    try {
      // Duplicate prevention check in DB
      const { rows: duplicateCheck } = await query(
        `SELECT * FROM visual_assets WHERE topic_id = $1 AND visual_type = $2 AND is_canonical = TRUE LIMIT 1`,
        [topic.id, visualType]
      );
      if (duplicateCheck.length > 0) {
        reused.push(duplicateCheck[0]);
        continue;
      }

      // Build Prompt
      const { systemPrompt, userMessage } = buildVisualGenerationPrompt({
        topic,
        visualType,
        examContext,
        region,
        verifiedEvidence: evidenceList
      });

      let rawResult = null;
      let usedProvider = null;
      let usedModel = null;
      let usageData = null;
      let validation = null;

      if (isExplicitMock) {
        rawResult = generateDeterministicMockVisual(topic, visualType, evidenceList);
        usedProvider = 'mock';
        usedModel = 'mock-generator';
        validation = validateVisualSpecification(visualType, rawResult, evidenceList);
      } else {
        // Primary and Secondary provider selection based on visual type
        const isStructured = ['exam_sketch', 'mindmap', 'flowchart', 'cause_effect', 'comparison', 'institutional_diagram'].includes(visualType);
        
        const primary = isStructured ? VISUAL_AI_CONFIG.structured : VISUAL_AI_CONFIG.grounded;
        const secondary = isStructured ? VISUAL_AI_CONFIG.grounded : VISUAL_AI_CONFIG.structured;

        const candidateProviders = [primary, secondary];
        let generationSuccess = false;

        for (const candidate of candidateProviders) {
          const apiKey = candidate.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.GEMINI_API_KEY;
          if (!apiKey) continue;

          try {
            console.log(`[VisualGeneration] Attempting ${visualType} with ${candidate.provider} (${candidate.model})...`);
            const aiCall = await generateAIContentWithMetadata({
              provider: candidate.provider,
              apiKey,
              model: candidate.model,
              systemPrompt,
              userMessage
            });

            const candidateValidation = validateVisualSpecification(visualType, aiCall.result, evidenceList);
            if (candidateValidation.isValid) {
              rawResult = aiCall.result;
              validation = candidateValidation;
              usedProvider = candidate.provider;
              usedModel = candidate.model;
              usageData = aiCall.usage;
              generationSuccess = true;
              break;
            } else {
              console.warn(`[VisualGeneration] Schema validation failed with ${candidate.provider}: ${candidateValidation.error}`);
            }
          } catch (providerErr) {
            console.warn(`[VisualGeneration] Provider ${candidate.provider} failed: ${providerErr.message}`);
          }
        }
      }

      if (!validation || !validation.isValid || !validation.spec) {
        warnings.push(`Generated ${visualType} failed validation: ${validation?.error || 'Unknown validation error'}`);
        skipped.push({ visualType, reason: validation?.error || 'VALIDATION_FAILED' });
        continue;
      }

      // Record AI usage and token metrics
      const latencyMs = Date.now() - visualStartTime;
      if (usedProvider !== 'mock') {
        await recordVisualGenerationUsage({
          userId,
          topicId: topic.id,
          visualType,
          provider: usedProvider,
          model: usedModel,
          usage: usageData || {},
          latencyMs,
          schemaValid: true,
          metadata: { examContext, region }
        });
      }

      const validatedSpec = validation.spec;
      const visualTitle = validatedSpec.title || `${topic.title} ${visualType.replace('_', ' ')}`;

      // Save as visual asset
      const isCanonicalAsset = Boolean(visualType === 'exam_sketch' && !existingVisuals.some(v => v.is_canonical));
      const insertSql = `
        INSERT INTO visual_assets (
          topic_id, title, visual_type, visual_spec, exam_context, region,
          origin, target_draw_seconds, exam_drawable, max_nodes, is_canonical, is_published,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'ai_generated', $7, $8, $9, $10, TRUE, NOW(), NOW())
        RETURNING *;
      `;

      const { rows: savedRows } = await query(insertSql, [
        topic.id,
        visualTitle,
        validation.visualType || visualType,
        JSON.stringify(validatedSpec),
        examContext,
        region,
        visualType === 'exam_sketch' ? (validatedSpec.targetDrawSeconds || 30) : (validatedSpec.targetDrawSeconds || null),
        Boolean(visualType === 'exam_sketch' || validatedSpec.examDrawable === true),
        Array.isArray(validatedSpec.nodes) ? validatedSpec.nodes.length : 5,
        isCanonicalAsset
      ]);

      const savedVisual = savedRows[0];

      // Link any verified evidence items referenced
      for (const ev of evidenceList) {
        if (ev.is_official && ev.verification_status === 'verified_current') {
          await linkEvidenceToVisual(savedVisual.id, ev.id, 'primary_metric').catch(() => {});
        }
      }

      generated.push({
        ...savedVisual,
        visual_spec: validatedSpec
      });
    } catch (genErr) {
      console.error(`[VisualGeneration] Error generating ${visualType} for ${topic.title}:`, genErr);
      warnings.push(`Failed to generate ${visualType}: ${genErr.message}`);
      skipped.push({ visualType, reason: genErr.message });
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    topic,
    reused,
    generated,
    skipped,
    warnings,
    metrics: {
      durationMs,
      reusedCount: reused.length,
      generatedCount: generated.length,
      skippedCount: skipped.length
    }
  };
}

/**
 * Deterministic fallback generator for test environments without live LLM keys.
 */
function generateDeterministicMockVisual(topic, visualType, evidenceList) {
  const title = topic.title || topic.canonical_name;

  if (visualType === 'exam_sketch') {
    return {
      renderer: 'EXAM_SKETCH',
      title: `${title} 30-Second Exam Sketch`,
      targetDrawSeconds: 30,
      examDrawable: true,
      nodes: [
        `${title} Trigger`,
        'Structural Root Cause',
        'Direct Socio-Economic Impact',
        'Institutional Mechanism',
        'Policy Solution & Way Forward'
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 }
      ],
      description: '30-second linear cause-solution flow for Mains answer scripts.'
    };
  }

  if (visualType === 'mindmap' || visualType === 'hub_spoke') {
    return {
      renderer: 'HUB_SPOKE',
      title: `${title} Exam Mindmap`,
      center: title,
      spokes: [
        { label: 'Core Principles', sublabel: 'Constitutional / Legal Mandate' },
        { label: 'Key Challenges', sublabel: 'Structural Bottlenecks' },
        { label: 'Way Forward', sublabel: 'Policy Reforms' }
      ]
    };
  }

  if (visualType === 'cause_effect') {
    return {
      renderer: 'CAUSE_EFFECT',
      title: `${title} Cause-Effect Diagnostic`,
      issue: title,
      causes: ['Primary Driver A', 'Secondary Catalyst B'],
      effects: ['Socio-Economic Impact', 'Administrative Strain'],
      responses: ['Targeted Strategic Reform & Policy Guardrails']
    };
  }

  if (visualType === 'flowchart' || visualType === 'process_flow') {
    return {
      renderer: 'FLOWCHART',
      title: `${title} Operational Flowchart`,
      steps: [
        { label: 'Phase 1: Initiation & Diagnostic', subtext: 'Baseline Assessment' },
        { label: 'Phase 2: Execution & Resource Outlay', subtext: 'Coordination' },
        { label: 'Phase 3: Outcome Review & Audit', subtext: 'Accountability' }
      ]
    };
  }

  if (visualType === 'process_diagram') {
    return {
      renderer: 'PROCESS_DIAGRAM',
      title: `${title} Process Mechanism Architecture`,
      inputs: [{ label: 'Primary Feedstock', subtext: 'Baseline Input' }, { label: 'Energy Source' }],
      stages: [{ name: 'Transformation Core', mechanism: 'Catalytic Splitting', byproducts: [{ label: 'Byproduct Gas' }] }],
      outputs: [{ label: 'Industrial Output', subtext: 'Primary Market' }],
      feedback: [{ label: 'Circular Recovery Loop', from: 'Output', to: 'Input' }]
    };
  }

  if (visualType === 'timeline') {
    return {
      renderer: 'TIMELINE',
      title: `${title} Evolution Timeline`,
      events: [
        { date: 'Initial Era', label: 'Establishment of baseline legal & administrative provisions' },
        { date: 'Reform Phase', label: 'Judicial interpretation and commission recommendations' },
        { date: 'Contemporary Period', label: 'Modern policy integration and digital governance' }
      ]
    };
  }

  return {
    renderer: 'FLOWCHART',
    title: `${title} ${visualType.replace('_', ' ')} Diagram`,
    steps: [
      { label: `${title} Baseline State`, subtext: 'Diagnostic' },
      { label: 'Policy Intervention Stage', subtext: 'Implementation' },
      { label: 'Target Outcome', subtext: 'Impact' }
    ]
  };
}
