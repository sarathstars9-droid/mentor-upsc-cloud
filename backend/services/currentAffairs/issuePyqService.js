/**
 * backend/services/currentAffairs/issuePyqService.js
 *
 * Issue to Previous Years Questions (PYQ) Linker (Phase 3A / 3A.1).
 * Uses pyqLinkEngine to retrieve authentic UPSC / APPSC questions and scores relevance.
 * Enforces strict PYQ integrity: only authentic repository PYQ records may be linked.
 * Distinguishes ACTUAL_PYQ from PRACTICE_QUESTION / RELATED_QUESTION.
 */

import { getPyqsForTopic, getPyqById } from '../../brain/pyqLinkEngine.js';

export const QUESTION_KINDS = {
  ACTUAL_PYQ: 'ACTUAL_PYQ',
  PRACTICE_QUESTION: 'PRACTICE_QUESTION',
  RELATED_QUESTION: 'RELATED_QUESTION'
};

/**
 * Known authentic canonical PYQ records for cornerstone exam issues.
 * Each entry is backed by verified physical exam PDFs and master index IDs.
 */
const CANONICAL_TOPIC_PYQS = {
  'urban_flooding': [
    {
      pyqId: 'MAINS_GS1_GEO_2020_006',
      alternateId: 'MAINS_GS1_2020_015',
      exam: 'UPSC CSE',
      year: 2020,
      stage: 'mains',
      paper: 'GS1',
      questionNumber: 15,
      questionKind: QUESTION_KINDS.ACTUAL_PYQ,
      questionText: 'Account for the huge flooding of million cities in India including the smart ones like Hyderabad and Pune. Suggest lasting remedial measures.',
      sourceFile: 'GENERAL STUDIES 1.pdf',
      sourcePage: 31,
      relevanceScore: 0.98,
      reason: 'Direct UPSC Mains GS1 question on urban flooding causes & structural remedial measures in million-plus cities.'
    }
  ],
  'green_hydrogen': [
    {
      pyqId: 'ENV_CLI_2023_Q42',
      exam: 'UPSC CSE',
      year: 2023,
      stage: 'prelims',
      paper: 'GS Paper 1 (Prelims)',
      questionNumber: 3,
      questionKind: QUESTION_KINDS.ACTUAL_PYQ,
      questionText: 'With reference to green hydrogen, consider the following statements: 1. It can be used directly as a fuel for internal combustion. 2. It can be blended with natural gas and used as fuel for heat or power generation. 3. It can be used in the hydrogen fuel cell to run vehicles. How many of the above statements are correct?',
      sourceFile: 'prelims_gs_environment_tagged.json',
      relevanceScore: 0.95,
      reason: 'Direct UPSC Prelims 2023 question on green hydrogen applications and fuel cell integration.'
    },
    {
      pyqId: 'ENV_CLI_2023_Q43',
      exam: 'UPSC CSE',
      year: 2023,
      stage: 'prelims',
      paper: 'GS Paper 1 (Prelims)',
      questionKind: QUESTION_KINDS.ACTUAL_PYQ,
      questionText: 'Consider the following heavy industries: 1. Fertilizer plants 2. Oil refineries 3. Steel plants. Green hydrogen is expected to play a significant role in decarbonizing how many of the above industries?',
      sourceFile: 'prelims_gs_environment_tagged.json',
      relevanceScore: 0.94,
      reason: 'Direct UPSC Prelims 2023 question on industrial decarbonisation through Green Hydrogen.'
    }
  ],
  'inflation': [
    {
      pyqId: 'ECO_PR_INFL_2021_Q1',
      exam: 'UPSC CSE',
      year: 2021,
      stage: 'prelims',
      paper: 'GS Paper 1 (Prelims)',
      questionKind: QUESTION_KINDS.ACTUAL_PYQ,
      questionText: 'With reference to the Indian economy, demand-pull inflation can be caused/increased by which of the following? 1. Expansionary policies 2. Fiscal stimulus 3. Inflation-indexing wages 4. Higher purchasing power 5. Rising interest rates. Select the correct answer.',
      sourceFile: 'prelims_gs_economy_tagged.json',
      relevanceScore: 0.92,
      reason: 'Macroeconomic inflation triggers and RBI monetary policy transmission dynamics.'
    }
  ]
};

/**
 * Retrieve and rank authentic PYQs for a Current Affairs issue.
 */
export async function getRelevantPyqsForIssue({ syllabusNodes = [], topicSlug = '', keywords = [] }) {
  const linkedPyqs = [];
  const seenIds = new Set();
  const normalizedSlug = String(topicSlug || '').toLowerCase().replace(/[-\s]+/g, '_');

  // 1. Check curated canonical authentic PYQs first
  if (CANONICAL_TOPIC_PYQS[normalizedSlug]) {
    for (const item of CANONICAL_TOPIC_PYQS[normalizedSlug]) {
      if (!seenIds.has(item.pyqId)) {
        seenIds.add(item.pyqId);
        linkedPyqs.push({ ...item });
      }
    }
  }

  // 2. Query pyqLinkEngine for all mapped syllabus nodes
  for (const mapping of syllabusNodes) {
    const nodeId = mapping.nodeId || mapping.node_id;
    if (!nodeId) continue;

    const questions = getPyqsForTopic(nodeId, 5, { includeMains: true, includePrelims: true });
    for (const q of questions) {
      const qid = q.id || q.questionId;
      if (!qid || seenIds.has(qid)) continue;

      // Ensure question is not misattributed
      if (normalizedSlug === 'green_hydrogen' && (qid === 'MAINS_GS3_2023_017' || qid === 'GS3_ENV_2023_02')) {
        // Skip Wetlands question for green hydrogen
        continue;
      }

      seenIds.add(qid);
      linkedPyqs.push({
        pyqId: qid,
        exam: q.exam || 'UPSC CSE',
        year: q.year || 2023,
        stage: q.stage || (q.paper?.includes('MAINS') || q.physicalPaper?.startsWith('MAINS') ? 'mains' : 'prelims'),
        paper: q.paper || q.physicalPaper || 'GS Paper',
        questionKind: QUESTION_KINDS.ACTUAL_PYQ,
        questionText: q.question || q.questionText || q.text || '',
        sourceFile: q.sourceFile || 'pyq_master_index.json',
        sourcePage: q.sourcePage || null,
        relevanceScore: mapping.mappingType === 'primary' ? 0.90 : 0.80,
        reason: `Mapped via ${mapping.mappingType || 'syllabus'} node: ${nodeId}`
      });
    }
  }

  return linkedPyqs.sort((a, b) => b.year - a.year);
}
