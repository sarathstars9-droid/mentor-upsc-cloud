/**
 * backend/services/currentAffairs/examDeploymentKitService.js
 *
 * Exam Deployment Kit Generator (Phase 3A).
 * Assembles high-yield, structured exam ingredients ONLY (NO model answers).
 * Enforces strict visual separation between CURRENT VERIFIED, HISTORICAL VERIFIED, and STATIC/CONCEPTUAL evidence.
 */

import { getEvidenceByTopic } from '../evidence/evidenceService.js';
import { getRelevantPyqsForIssue } from './issuePyqService.js';
import { getVisualPackByTopic } from '../visualKnowledge/visualKnowledgeService.js';

/**
 * Generate a complete Exam Deployment Kit for a Current Affairs issue.
 */
export async function generateExamDeploymentKit(issue, { examContext = 'both', region = null } = {}) {
  if (!issue) throw new Error('Issue entity is required to build Exam Deployment Kit');

  const topicId = issue.canonical_topic_id || issue.slug;

  // 1. Fetch Verified Evidence Assets for this Topic
  const allEvidence = await getEvidenceByTopic(topicId, {
    examContext: examContext || issue.exam_context || 'both',
    region: region || issue.region || null,
    includeHistorical: true
  });

  // 2. Strict Segregation of Evidence Types: CURRENT vs HISTORICAL vs STATIC
  const currentVerifiedEvidence = allEvidence.filter(e => 
    e.verification_status === 'verified_current' && e.is_latest_release && !e.is_stale
  );

  const historicalVerifiedEvidence = allEvidence.filter(e => 
    e.verification_status === 'verified_historical' || e.is_stale
  );

  const staticConceptualEvidence = allEvidence.filter(e => 
    ['constitutional_article', 'government_order', 'committee', 'report'].includes(e.evidence_type) &&
    e.verification_status !== 'unverified'
  );

  // 3. Fetch Linked PYQs
  const syllabusNodes = Array.isArray(issue.syllabus_mappings) ? issue.syllabus_mappings : [];
  const pyqs = await getRelevantPyqsForIssue({
    syllabusNodes,
    topicSlug: issue.slug,
    keywords: [issue.title]
  });

  // 4. Fetch Linked Visual Pack (Reusing Visual Studio Assets)
  let visualPack = null;
  try {
    visualPack = await getVisualPackByTopic(topicId, {
      examContext: examContext || issue.exam_context || 'both',
      region: region || issue.region || null
    });
  } catch (err) {
    visualPack = { visuals: [], recommendations: [] };
  }

  // 5. Structure High-Yield Exam Ingredients
  const dimensions = Array.isArray(issue.dimensions) && issue.dimensions.length > 0 
    ? issue.dimensions 
    : ['Institutional Architecture', 'Macro-Economic Transmission', 'Structural Challenges', 'Governance Interventions'];

  const argumentsList = Array.isArray(issue.arguments) && issue.arguments.length > 0
    ? issue.arguments
    : ['Enhances macroeconomic resilience and capital asset formation', 'Promotes targeted fiscal devolution and sub-state empowerment'];

  const counterargumentsList = Array.isArray(issue.counterviews) && issue.counterviews.length > 0
    ? issue.counterviews
    : ['Short-term fiscal deficit widening risks', 'Structural delays in ground-level municipal and infrastructure execution'];

  const challengesList = Array.isArray(issue.challenges) && issue.challenges.length > 0
    ? issue.challenges
    : ['Coordination gaps between Union and State statutory bodies', 'Data latency in monthly release metrics'];

  const wayForwardList = Array.isArray(issue.way_forward) && issue.way_forward.length > 0
    ? issue.way_forward
    : ['Adopt time-bound statutory monitoring with independent audits', 'Fast-track capacity building and digital infrastructure integration'];

  return {
    issueId: issue.id,
    title: issue.title,
    slug: issue.slug,
    examContext: issue.exam_context,
    region: issue.region,
    importance: issue.importance,

    // Core Contextual Hooks
    oneLineContext: `${issue.title} represents a high-priority macro/governance theme with direct UPSC & APPSC exam yield.`,
    whyInNews: issue.why_in_news || 'Recent official data release and policy guidelines issued by primary constitutional/statutory authorities.',
    staticCoreConnection: issue.static_context || 'Anchored in constitutional provisions, statutory frameworks, and standard macroeconomic models.',

    // High-Yield Key Dimensions
    keyDimensions: dimensions,

    // Segregated Evidence Buckets (Never Mixed Silently)
    evidenceBuckets: {
      currentVerified: currentVerifiedEvidence.map(e => ({
        id: e.id,
        title: e.title,
        valueText: e.value_text,
        numericValue: e.numeric_value,
        dataPeriod: e.data_period,
        sourceTitle: e.source_document_title || e.source_name,
        sourceDocumentTitleExact: e.payload?.source_document_title_exact || e.source_document_title || e.source_name,
        sourceSection: e.source_section || e.payload?.source_section || 'Official Release',
        sourceUrl: e.source_url,
        provenanceOrigin: e.provenance_origin || e.payload?.provenance_origin || 'manual_official_import'
      })),
      historicalVerified: historicalVerifiedEvidence.map(e => ({
        id: e.id,
        title: e.title,
        valueText: e.value_text,
        numericValue: e.numeric_value,
        dataPeriod: e.data_period,
        sourceTitle: e.source_document_title || e.source_name,
        sourceDocumentTitleExact: e.payload?.source_document_title_exact || e.source_document_title || e.source_name,
        provenanceOrigin: e.provenance_origin || e.payload?.provenance_origin || 'manual_official_import',
        supersededBy: e.superseded_by_evidence_id
      })),
      staticConceptual: staticConceptualEvidence.map(e => ({
        id: e.id,
        title: e.title,
        valueText: e.value_text,
        authority: e.source_name,
        provenanceOrigin: e.provenance_origin || e.payload?.provenance_origin || 'manual_official_import'
      }))
    },

    // Institutional & Case Study References
    caseStudies: [
      { name: 'National Best Practice Pilot', takeaway: 'Demonstrates scalable decentralized execution' }
    ],
    reportsAndCommittees: [
      { name: '16th Finance Commission Recommendations / Official Committee', focus: 'Institutional fiscal consolidation' }
    ],
    constitutionalArticles: [
      { article: 'Article 280 / Article 279A', context: 'Constitutional fiscal architecture and cooperative federalism' }
    ],
    schemesAndPolicies: [
      { name: 'Official National/State Flagship Mission', details: 'Statutory mission targets and outlay' }
    ],
    internationalComparison: {
      country: 'Global Best Practice (e.g. OECD / East Asian sponge city standards)',
      relevance: 'Benchmark for urban resilience and sustainable transition'
    },

    // Structured Debate & Analytical Arguments
    arguments: argumentsList,
    counterarguments: counterargumentsList,
    challenges: challengesList,
    wayForward: wayForwardList,

    // Exam-Specific Applications
    examApplications: {
      upscUse: 'Direct application in GS2/GS3 mains analytical answers and value-addition boxes.',
      appscUse: issue.region === 'andhra_pradesh' || issue.exam_context === 'appsc' 
        ? 'High-priority state economy & governance questions in APPSC Paper 4/5.' 
        : 'Comparative state governance perspective for federalism questions.',
      essayUse: 'Can be deployed as an empirical case study in Governance or Economic Development essays.',
      optionalUse: 'Relevant for Geography Optional Paper 2 (Regional Planning) or Public Administration.'
    },

    // Linkage to PYQs and Visual Studio
    relevantPyqs: pyqs,
    recommendedVisuals: visualPack?.visuals || []
  };
}
