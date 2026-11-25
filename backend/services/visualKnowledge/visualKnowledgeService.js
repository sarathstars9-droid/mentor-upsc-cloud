/**
 * backend/services/visualKnowledge/visualKnowledgeService.js
 *
 * Shared Visual Knowledge Layer for MentorOS (Phase 2B).
 * Powers Visual Studio, Current Affairs visual packs, and Mains Evaluation visual reuse.
 * 
 * CORE PRINCIPLE:
 * RETRIEVE -> VERIFY -> REUSE -> RENDER (One shared visual knowledge repository).
 * 
 * NOTE: All development seeding is decoupled into backend/scripts/seed_visual_knowledge_dev.js.
 * This service runtime only queries, resolves, and manages explicitly requested visual state.
 */

import { query } from '../../db/index.js';
import { getEvidenceByTopic, getEvidenceForVisual, linkEvidenceToVisual } from '../evidence/evidenceService.js';
import { validateVisualEvidenceIntegrity } from '../evidence/evidenceVerificationService.js';

/**
 * Resolve a candidate query string to a canonical knowledge topic.
 */
export async function resolveTopicByQuery(queryText) {
  if (!queryText || typeof queryText !== 'string') return null;

  const raw = queryText.trim().toLowerCase();
  const slugUnderscore = raw.replace(/[-\s]+/g, '_').replace(/[^\w_]/g, '');
  const slugDash = raw.replace(/[_\s]+/g, '-').replace(/[^\w-]/g, '');

  let topic = null;

  // 1. Exact title or slug match
  const { rows: exactMatches } = await query(
    `SELECT * FROM knowledge_topics WHERE LOWER(title) = $1 OR slug = $1 OR slug = $2 OR slug = $3 LIMIT 1`,
    [raw, slugUnderscore, slugDash]
  );
  if (exactMatches.length > 0) topic = exactMatches[0];

  // 2. Aliases JSONB match
  if (!topic) {
    const { rows: aliasMatches } = await query(
      `SELECT * FROM knowledge_topics WHERE aliases ? $1 OR aliases ? $2 OR aliases ? $3 LIMIT 1`,
      [raw, slugUnderscore, slugDash]
    );
    if (aliasMatches.length > 0) topic = aliasMatches[0];
  }

  // 3. Sentence contains topic title or topic slug
  if (!topic) {
    const { rows: sentenceMatches } = await query(
      `SELECT * FROM knowledge_topics 
       WHERE $1 ILIKE '%' || title || '%' 
          OR $1 ILIKE '%' || REPLACE(slug, '_', ' ') || '%'
          OR title ILIKE '%' || $2 || '%'
       ORDER BY LENGTH(title) DESC LIMIT 1`,
      [raw, raw.slice(0, 50)]
    );
    if (sentenceMatches.length > 0) topic = sentenceMatches[0];
  }

  // 4. Partial / Keyword match
  if (!topic) {
    const { rows: partialMatches } = await query(
      `SELECT * FROM knowledge_topics WHERE title ILIKE $1 OR slug ILIKE $2 ORDER BY LENGTH(title) ASC LIMIT 1`,
      [`%${raw}%`, `%${slugUnderscore}%`]
    );
    if (partialMatches.length > 0) topic = partialMatches[0];
  }

  if (topic) {
    return {
      ...topic,
      canonical_name: topic.title,
      canonicalName: topic.title
    };
  }

  return null;
}

export const resolveTopic = resolveTopicByQuery;

/**
 * Match or reuse a visual asset for a Mains question.
 */
export async function findVisualForMainsQuestion({ questionText, topicSlug = null, examContext = 'upsc' } = {}) {
  let topic = null;
  if (topicSlug) {
    topic = await resolveTopicByQuery(topicSlug);
  }
  if (!topic && questionText) {
    topic = await resolveTopicByQuery(questionText);
  }

  if (!topic) return null;

  const visualPack = await getTopicVisualPack(topic.id, { examContext });
  if (!visualPack || !visualPack.visuals || visualPack.visuals.length === 0) {
    return null;
  }

  // Prefer exam_sketch or canonical visual
  const bestVisual = visualPack.visuals.find(v => v.visual_type === 'exam_sketch') || visualPack.visuals[0];
  return {
    ...bestVisual,
    topic
  };
}

/**
 * Search all knowledge topics matching query and filters.
 */
export async function searchTopics(queryText = '', { examContext = 'both', region = null } = {}) {
  let sql = `SELECT * FROM knowledge_topics WHERE 1=1`;
  const params = [];

  if (queryText && queryText.trim()) {
    params.push(`%${queryText.trim().toLowerCase()}%`);
    sql += ` AND (LOWER(title) ILIKE $${params.length} OR slug ILIKE $${params.length} OR aliases ? $${params.length + 1} OR subject ILIKE $${params.length})`;
    params.push(queryText.trim().toLowerCase());
  }

  if (examContext && examContext !== 'both') {
    params.push(examContext.toLowerCase());
    sql += ` AND (exam_context = $${params.length} OR exam_context = 'both')`;
  }

  if (region) {
    params.push(region.toLowerCase());
    sql += ` AND (region = $${params.length} OR region IS NULL)`;
  }

  sql += ` ORDER BY title ASC LIMIT 20;`;
  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Deterministic Visual Freshness Evaluator.
 * Evaluates whether a visual is CURRENT, CONCEPTUAL, HISTORICAL, or STALE_EVIDENCE.
 */
export function deriveVisualFreshness(visual, linkedEvidence = []) {
  const spec = visual.visual_spec || {};

  // 1. Check if visual is explicitly tagged or titled as historical
  const titleLower = (visual.title || '').toLowerCase();
  const specTitleLower = (spec.title || '').toLowerCase();
  const hasHistoricalLabel = titleLower.includes('historical') ||
                             titleLower.includes('previous budget') ||
                             titleLower.includes('fy 2024') ||
                             titleLower.includes('fy 2025') ||
                             specTitleLower.includes('historical') ||
                             Boolean(spec.isHistorical);

  if (hasHistoricalLabel) {
    return {
      status: 'HISTORICAL',
      isCurrent: false,
      isHistorical: true,
      reason: 'Asset explicitly represents historical or superseded cycle.'
    };
  }

  // 2. Evaluate linked evidence freshness
  if (Array.isArray(linkedEvidence) && linkedEvidence.length > 0) {
    const hasStale = linkedEvidence.some(e => e.verification_status === 'stale' || e.refreshRequired === true || e.is_stale === true);
    if (hasStale) {
      return {
        status: 'STALE_EVIDENCE',
        isCurrent: false,
        isHistorical: false,
        reason: 'Linked evidence requires refresh for active cycle.'
      };
    }

    const hasHistoricalEvidence = linkedEvidence.some(e => e.verification_status === 'verified_historical');
    if (hasHistoricalEvidence) {
      return {
        status: 'HISTORICAL',
        isCurrent: false,
        isHistorical: true,
        reason: 'Linked evidence belongs to a prior/historical data period.'
      };
    }

    const allVerifiedCurrent = linkedEvidence.every(e => 
      e.verification_status === 'verified_current'
    );
    if (allVerifiedCurrent) {
      return {
        status: 'CURRENT',
        isCurrent: true,
        isHistorical: false,
        reason: 'Backed by confirmed current official evidence.'
      };
    }

    const hasUnverified = linkedEvidence.some(e => e.verification_status === 'unverified');
    if (hasUnverified) {
      return {
        status: 'UNVERIFIED',
        isCurrent: false,
        isHistorical: false,
        reason: 'Linked evidence is unverified.'
      };
    }
  }

  // 3. Check for unlinked volatile numbers/statistics
  const hasQuantitativeData = Array.isArray(spec.data) && spec.data.some(d => typeof d.value === 'number');
  const hasVolatileStatsInNodes = Array.isArray(spec.nodes) && spec.nodes.some(n => typeof n === 'string' && /(?:₹|rs\.?|%|\blakh\b|\bcrore\b)/i.test(n));

  if (hasQuantitativeData || hasVolatileStatsInNodes) {
    return {
      status: 'STALE_EVIDENCE',
      isCurrent: false,
      isHistorical: false,
      reason: 'Contains quantitative figures without verified current evidence linkage.'
    };
  }

  // 4. Pure conceptual diagram
  return {
    status: 'CONCEPTUAL',
    isCurrent: true,
    isHistorical: false,
    reason: 'Static conceptual knowledge framework.'
  };
}

/**
 * Retrieve comprehensive visual pack for a topic with linked verified evidence.
 */
export async function getVisualPackByTopic(topicIdOrSlug, options = {}) {
  let topicId = topicIdOrSlug;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicIdOrSlug);
  if (!isUuid) {
    const resolved = await resolveTopicByQuery(topicIdOrSlug);
    if (resolved) {
      topicId = resolved.id;
    }
  }
  return getTopicVisualPack(topicId, options);
}

export async function getTopicVisualPack(topicId, { examContext = 'both', region = null, userId = null } = {}) {
  const { rows: topicRows } = await query(`SELECT * FROM knowledge_topics WHERE id = $1`, [topicId]);
  if (topicRows.length === 0) return null;

  const topic = {
    ...topicRows[0],
    canonical_name: topicRows[0].title,
    canonicalName: topicRows[0].title
  };

  // Fetch visual assets linked to topic
  const visualSql = `
    SELECT v.*,
           COALESCE(l.relevance_score, 1.0) as relevance_score
    FROM visual_assets v
    LEFT JOIN visual_topic_links l ON v.id = l.visual_asset_id
    WHERE (v.topic_id = $1 OR l.topic_id = $1)
      AND ($2::text IS NULL OR $2 = 'both' OR v.exam_context = $2 OR v.exam_context = 'both')
      AND ($3::text IS NULL OR $3 = 'all' OR $3 = 'india' OR v.region = $3 OR v.region IS NULL)
    ORDER BY (v.visual_type = 'exam_sketch') DESC, v.is_canonical DESC, v.created_at DESC;
  `;

  const { rows: visuals } = await query(visualSql, [topicId, examContext, region]);

  // Attach evidence, freshness, and user personalization state to each visual
  const currentVisuals = [];
  const historicalVisuals = [];

  for (const vis of visuals) {
    const linkedEvidence = await getEvidenceForVisual(vis.id);
    const integrity = validateVisualEvidenceIntegrity(vis.visual_spec, linkedEvidence);
    const freshness = deriveVisualFreshness(vis, linkedEvidence);

    let userState = null;
    if (userId) {
      userState = await getUserVisualState(userId, vis.id);
    }

    const enriched = {
      ...vis,
      linked_evidence: linkedEvidence,
      evidence_integrity: integrity,
      user_state: userState,
      freshness_status: freshness.status,
      freshnessStatus: freshness.status,
      is_current: freshness.isCurrent,
      is_historical: freshness.isHistorical,
      freshness_reason: freshness.reason
    };

    if (freshness.isHistorical) {
      historicalVisuals.push(enriched);
    } else {
      currentVisuals.push(enriched);
    }
  }

  // Fetch all topic evidence (current and historical)
  const evidenceList = await getEvidenceByTopic(topicId, {
    examContext,
    region,
    includeHistorical: true
  });

  // Determine current active cycle from latest verified evidence
  const latestVerified = evidenceList.find(e => e.verification_status === 'verified_current' && e.officialLatestConfirmed);
  const currentCycle = latestVerified?.data_period || 'Current Cycle';

  const recs = getRecommendedVisualTypesForSubject(topic.subject);

  return {
    topic,
    current_cycle: currentCycle,
    currentCycle,
    visuals_count: currentVisuals.length,
    visuals: currentVisuals,
    historical_visuals_count: historicalVisuals.length,
    historical_visuals: historicalVisuals,
    historicalVisuals,
    all_visuals: [...currentVisuals, ...historicalVisuals],
    evidence_count: evidenceList.length,
    evidence: evidenceList,
    recommended_visual_types: recs,
    recommendedVisualTypes: recs
  };
}

/**
 * Recommended visual types by subject domain (Phase 2B deterministic mapping).
 */
export function getRecommendedVisualTypesForSubject(subject = '') {
  const s = String(subject || '').toLowerCase();

  if (s.includes('economy') || s.includes('gs3')) {
    return ['cause_effect', 'chart', 'comparison', 'exam_sketch', 'statistics'];
  }
  if (s.includes('polity') || s.includes('governance') || s.includes('gs2')) {
    return ['institutional_diagram', 'comparison', 'flowchart', 'timeline', 'exam_sketch'];
  }
  if (s.includes('geography') || s.includes('environment')) {
    return ['concept_diagram', 'process_flow', 'map', 'cause_effect', 'exam_sketch'];
  }
  if (s.includes('history') || s.includes('art') || s.includes('gs1')) {
    return ['timeline', 'comparison', 'hierarchy', 'map', 'exam_sketch'];
  }
  return ['mindmap', 'flowchart', 'cause_effect', 'exam_sketch', 'statistics'];
}

/**
 * Retrieve a single visual asset by ID with its evidence and personalization.
 */
export async function getVisualAssetById(visualAssetId, userId = null) {
  if (!visualAssetId) return null;

  const { rows } = await query(`SELECT * FROM visual_assets WHERE id = $1`, [visualAssetId]);
  if (rows.length === 0) return null;

  const visual = rows[0];
  const linkedEvidence = await getEvidenceForVisual(visual.id);
  const integrity = validateVisualEvidenceIntegrity(visual.visual_spec, linkedEvidence);

  let userState = null;
  if (userId) {
    userState = await getUserVisualState(userId, visual.id);
  }

  return {
    ...visual,
    linked_evidence: linkedEvidence,
    evidence_integrity: integrity,
    user_state: userState
  };
}

/**
 * Find matching visual asset for Mains Evaluation question (Two-way reuse).
 */
export async function findMatchingVisualForQuestion({ questionText, paper, subject, topic, syllabusNodeId = null }) {
  if (!questionText) return null;

  // 1. Try topic resolution from question text
  let resolvedTopic = await resolveTopicByQuery(questionText);
  if (!resolvedTopic && topic) {
    resolvedTopic = await resolveTopicByQuery(topic);
  }

  if (resolvedTopic) {
    // Check if canonical visual exists for this topic
    const { rows: visuals } = await query(
      `SELECT * FROM visual_assets 
       WHERE topic_id = $1 AND is_canonical = TRUE 
       ORDER BY (visual_type = 'hub_spoke' OR visual_type = 'exam_sketch') DESC, created_at DESC 
       LIMIT 1`,
      [resolvedTopic.id]
    );

    if (visuals.length > 0) {
      const visual = visuals[0];
      const linkedEvidence = await getEvidenceForVisual(visual.id);
      return {
        matched: true,
        reuse_type: 'CANONICAL_TOPIC_REUSE',
        topic: resolvedTopic,
        visual: {
          ...visual,
          linked_evidence: linkedEvidence
        }
      };
    }
  }

  return { matched: false, visual: null };
}

/**
 * Register a visual created during Mains Evaluation into shared knowledge layer.
 */
export async function registerMainsEvaluationVisual({ visualSpec, questionText, topicId = null, title = null }) {
  if (!visualSpec || typeof visualSpec !== 'object') return null;

  const finalTitle = title || `Mains Diagram: ${questionText?.slice(0, 50) || 'Visual Structure'}`;
  const visualType = visualSpec.renderer === 'EXAM_SKETCH' ? 'exam_sketch' : (visualSpec.renderer?.toLowerCase() || 'concept_diagram');

  const sql = `
    INSERT INTO visual_assets (
      topic_id, title, visual_type, visual_spec, origin,
      source_question_text, target_draw_seconds, exam_drawable,
      is_canonical, is_published, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4::jsonb, 'mains_evaluation', $5, 30, TRUE, FALSE, TRUE, NOW(), NOW())
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    topicId,
    finalTitle,
    visualType,
    JSON.stringify(visualSpec),
    questionText
  ]);

  return rows[0];
}

/**
 * Get user-specific personalization state for a visual asset.
 */
export async function getUserVisualState(arg1, arg2) {
  if (!arg1 || !arg2) return null;
  try {
    const res1 = await query(
      `SELECT * FROM user_visual_state WHERE visual_asset_id = $1::uuid AND user_id = $2 LIMIT 1`,
      [arg1, String(arg2)]
    );
    if (res1.rows.length > 0) return res1.rows[0];
  } catch (e) {
    // try reverse
  }

  try {
    const res2 = await query(
      `SELECT * FROM user_visual_state WHERE visual_asset_id = $2::uuid AND user_id = $1 LIMIT 1`,
      [String(arg1), arg2]
    );
    return res2.rows[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Update user-specific personalization state (save, pin, revision status, personal notes).
 */
export async function setUserVisualState(arg1, arg2, stateUpdate = {}) {
  if (!arg1 || !arg2) throw new Error('userId and visualAssetId are required.');

  const userId = arg1;
  const visualAssetId = arg2;

  const {
    is_saved = false,
    is_pinned = false,
    revision_status = 'none',
    recall_score = null,
    personal_notes = null,
    highlighted_nodes = []
  } = stateUpdate;

  const sql = `
    INSERT INTO user_visual_state (
      user_id, visual_asset_id, is_saved, is_pinned, revision_status,
      recall_score, personal_notes, highlighted_nodes, updated_at
    )
    VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    ON CONFLICT (user_id, visual_asset_id) DO UPDATE SET
      is_saved = EXCLUDED.is_saved,
      is_pinned = EXCLUDED.is_pinned,
      revision_status = EXCLUDED.revision_status,
      recall_score = COALESCE(EXCLUDED.recall_score, user_visual_state.recall_score),
      personal_notes = COALESCE(EXCLUDED.personal_notes, user_visual_state.personal_notes),
      highlighted_nodes = EXCLUDED.highlighted_nodes,
      updated_at = NOW()
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    userId,
    visualAssetId,
    Boolean(is_saved),
    Boolean(is_pinned),
    revision_status,
    recall_score !== null ? Number(recall_score) : null,
    personal_notes,
    JSON.stringify(highlighted_nodes)
  ]);

  return rows[0];
}

export async function updateUserVisualState(arg1, arg2, stateUpdate = {}) {
  // If first arg is visualId and second is userId
  return setUserVisualState(arg2, arg1, stateUpdate);
}
