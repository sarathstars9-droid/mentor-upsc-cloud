// backend/services/mainsRagContextService.js
// RAG Retrieval and Context Assembly Service (V1.5A).
// Implements category budgets, hierarchical fallbacks, trust filters, and gap metadata.

import { retrieveKnowledgeForNode } from '../repositories/mainsKnowledgeRepository.js';
import { getMainsQuestionsByNodeId } from '../brain/mainsPyqRetrievalV2.js';

const DEFAULT_BUDGETS = {
  SUBJECT_LANGUAGE: 5,
  DIMENSION: 8,
  EVIDENCE: 5,
  VALUE_ADDITION: 3,
  GEOGRAPHY_OPTIONAL: 6
};

/**
 * Trust filter validation function based on type-specific policies.
 */
function isTrustedItem(item) {
  if (!item.is_active || item.lifecycle_status !== 'ACTIVE') {
    return false;
  }

  // Verification status must be VERIFIED or HUMAN_APPROVED
  const isHumanApproved = item.verification_status === 'HUMAN_APPROVED';
  
  let isAutoOfficialVerified = false;
  if (item.verification_status === 'VERIFIED') {
    const sv = item.structured_content?.source_verification;
    if (sv && sv.trust_origin === 'AUTO_OFFICIAL_VERIFIED' && sv.authority_level === 'PRIMARY_OFFICIAL') {
      isAutoOfficialVerified = true;
    }
  }

  if (!isHumanApproved && !isAutoOfficialVerified) {
    return false;
  }

  // Time-sensitive expiry check for evidence/statistics/current affairs
  if (item.knowledge_type === 'EVIDENCE' && item.expires_at) {
    const expiresAt = new Date(item.expires_at).getTime();
    if (expiresAt <= Date.now()) {
      return false;
    }
  }

  return true;
}

export async function getMainsRagContext({
  userId,
  questionIntelligence = {},
  queryText = ""
}) {
  const {
    syllabus_node_id: syllabusNodeId = "",
    paper = "",
    subject = "",
    topic = "",
    micro_topic: microTopic = ""
  } = questionIntelligence;

  // Retrieve raw candidate knowledge matching any hierarchy levels
  const rawItems = await retrieveKnowledgeForNode({
    syllabusNodeId,
    paper,
    subject,
    topic,
    microTopic,
    knowledgeTypes: Object.keys(DEFAULT_BUDGETS)
  });

  // Track trace stats
  let filteredUntrustedCount = 0;
  let filteredExpiredCount = 0;
  const matchLevelCounts = {
    exact_node: 0,
    micro_topic: 0,
    topic: 0,
    subject: 0
  };

  // 1. Group, normalize, filter and tag items with their highest hierarchy matching level
  const groupedByLevel = {
    exact_node: [],
    micro_topic: [],
    topic: [],
    subject: []
  };

  for (const item of rawItems) {
    // Expiry check specifically counted
    if (item.knowledge_type === 'EVIDENCE' && item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) {
      filteredExpiredCount++;
    }

    if (!isTrustedItem(item)) {
      filteredUntrustedCount++;
      continue;
    }

    // Determine matching level
    let level = 'subject';
    if (syllabusNodeId && item.syllabus_node_id === syllabusNodeId) {
      level = 'exact_node';
    } else if (microTopic && item.micro_topic === microTopic) {
      level = 'micro_topic';
    } else if (topic && item.topic === topic) {
      level = 'topic';
    }

    matchLevelCounts[level]++;
    groupedByLevel[level].push(item);
  }

  // 2. Perform budget-based hierarchical retrieval
  const selectedItems = {
    SUBJECT_LANGUAGE: [],
    DIMENSION: [],
    EVIDENCE: [],
    VALUE_ADDITION: [],
    GEOGRAPHY_OPTIONAL: []
  };
  const seenIds = new Set();

  const levelsOrder = ['exact_node', 'micro_topic', 'topic', 'subject'];

  for (const type of Object.keys(DEFAULT_BUDGETS)) {
    const budget = DEFAULT_BUDGETS[type];
    
    for (const level of levelsOrder) {
      const candidates = groupedByLevel[level].filter(item => item.knowledge_type === type);
      
      for (const item of candidates) {
        if (selectedItems[type].length >= budget) {
          break; // Budget full for this category
        }
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          selectedItems[type].push(item);
        }
      }
    }
  }

  // 3. Retrieve related PYQs using existing engine
  let relatedPyqs = [];
  let pyqMeta = {};
  if (syllabusNodeId) {
    const pyqResult = getMainsQuestionsByNodeId(syllabusNodeId, { budget: 6, stage: 'mains', queryText });
    relatedPyqs = pyqResult.questions || [];
    pyqMeta = pyqResult.retrieval_meta || {};
  }

  // 4. Calculate missing/gap categories
  // For normal GS papers, expect: SUBJECT_LANGUAGE, DIMENSION, EVIDENCE, VALUE_ADDITION.
  // For Geography Optional, also expect: GEOGRAPHY_OPTIONAL.
  const expectedCategories = ['SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION'];
  const isGeoOptional = String(paper).toUpperCase() === 'GEOGRAPHY_OPTIONAL' || String(subject).toUpperCase() === 'GEOGRAPHY_OPTIONAL' || String(syllabusNodeId).toUpperCase().includes('GEO');
  if (isGeoOptional) {
    expectedCategories.push('GEOGRAPHY_OPTIONAL');
  }

  const missingCategories = [];
  for (const cat of expectedCategories) {
    if (selectedItems[cat].length === 0) {
      missingCategories.push(cat);
    }
  }

  const retrievedPyqIds = relatedPyqs.map(q => q.id || q.questionId || q.question_id).filter(Boolean);

  // 5. Build structured context response
  return {
    syllabus_node: syllabusNodeId ? { id: syllabusNodeId, paper, subject, topic, micro_topic: microTopic } : null,
    related_pyqs: relatedPyqs,
    subject_language: selectedItems.SUBJECT_LANGUAGE,
    dimensions: selectedItems.DIMENSION,
    evidence: selectedItems.EVIDENCE,
    value_additions: selectedItems.VALUE_ADDITION,
    geography_optional: selectedItems.GEOGRAPHY_OPTIONAL,
    previous_relevant_mistakes: [], // mistakes deferred as agreed
    missing_categories: missingCategories,
    retrieval_meta: {
      status: 'OK',
      retrieval_version: "mains-rag-v1",
      knowledge_item_ids: Array.from(seenIds),
      retrieved_pyq_ids: retrievedPyqIds,
      exact_node_matches: matchLevelCounts.exact_node,
      micro_topic_matches: matchLevelCounts.micro_topic,
      topic_matches: matchLevelCounts.topic,
      subject_matches: matchLevelCounts.subject,
      filtered_untrusted: filteredUntrustedCount,
      filtered_expired: filteredExpiredCount,
      category_counts: {
        SUBJECT_LANGUAGE: selectedItems.SUBJECT_LANGUAGE.length,
        DIMENSION: selectedItems.DIMENSION.length,
        EVIDENCE: selectedItems.EVIDENCE.length,
        VALUE_ADDITION: selectedItems.VALUE_ADDITION.length,
        GEOGRAPHY_OPTIONAL: selectedItems.GEOGRAPHY_OPTIONAL.length
      },
      pyq_meta: pyqMeta
    }
  };
}
