// backend/services/knowledgeLinkageService.js
// Knowledge Linkage Engine — Phase 8 core service.
//
// Connects: Study → PYQs → Mistakes → Revision → Planner
//
// Design:
//   - handleBlockCompletionLinkage: called after block completes, processes linkage
//   - Uses durable async: study_blocks.linkage_pending flag ensures no silent loss
//   - Idempotent: UNIQUE (user_id, block_id) prevents duplicate linkage rows
//   - Strict gating: only creates linkage for valid mapped study blocks with PYQs
//   - Deduplication: revision items use (user_id, question_id, stage) unique index

import {
  upsertBlockPyqLink,
  getBlockPyqLink,
  updateBlockPyqLink,
  getLinksForNode,
  clearLinkagePending,
} from '../repositories/knowledgeLinkageRepository.js';
import { pool } from '../db/index.js';
import { logMistake } from './mistakeService.js';

// ── Lazy imports for modules that may not be critical at boot ────────────────

let _pyqLinkEngine = null;
async function getPyqLinkEngine() {
  if (!_pyqLinkEngine) {
    _pyqLinkEngine = await import('../brain/pyqLinkEngine.js');
  }
  return _pyqLinkEngine;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GENERIC_NODE_PATTERNS = [
  /^MISC/i,
  /^NON[_-]STUDY$/i,
  /^GEN$/i,
  /^GENERAL$/i,
];

const NON_STUDY_SOURCE_TYPES = new Set([
  'non_study', 'break', 'rest', 'yoga', 'exercise',
]);

const MAX_RECOMMENDED_QUESTIONS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isGenericNode(nodeId) {
  if (!nodeId) return true;
  const normalized = String(nodeId).trim().toUpperCase();
  if (!normalized) return true;
  return GENERIC_NODE_PATTERNS.some(p => p.test(normalized));
}

function isNonStudySource(sourceType) {
  if (!sourceType) return false;
  return NON_STUDY_SOURCE_TYPES.has(String(sourceType).toLowerCase().trim());
}

function normalizeNodeId(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── 1. HANDLE BLOCK COMPLETION LINKAGE ──────────────────────────────────────
//
// Called after a block is successfully completed.
// Processes the pending linkage: checks eligibility, looks up PYQs, creates link.
//
// Returns:
//   { linkageCreated, linkageSkipped, reason?, recommendation? }
//
// Safety:
//   - Wrapped so errors never propagate to caller
//   - Idempotent via UNIQUE constraint
//   - Clears linkage_pending flag after processing

export async function handleBlockCompletionLinkage(userId, blockRowId) {
  try {
    // 1. Load the block row
    const { rows: blockRows } = await pool.query(
      `SELECT * FROM study_blocks WHERE id = $1 AND user_id = $2`,
      [blockRowId, userId]
    );
    const block = blockRows[0];
    if (!block) {
      return { linkageSkipped: true, reason: 'BLOCK_NOT_FOUND' };
    }

    // 2. Gate: block must be completed
    if (!['completed', 'partial'].includes(block.status)) {
      await clearLinkagePending(blockRowId);
      return { linkageSkipped: true, reason: 'BLOCK_NOT_COMPLETED' };
    }

    // 3. Gate: must have valid node_id
    const rawNodeId = block.node_id;
    if (!rawNodeId || !String(rawNodeId).trim()) {
      await clearLinkagePending(blockRowId);
      const link = await upsertBlockPyqLink({
        user_id: userId,
        block_id: blockRowId,
        node_id: null,
        stage: block.stage || null,
        status: 'skipped_generic',
        skip_reason: 'NO_NODE_MAPPING',
      });
      return { linkageSkipped: true, reason: 'NO_NODE_MAPPING', link };
    }

    // 4. Gate: must not be generic block
    const nodeId = normalizeNodeId(rawNodeId);
    if (isGenericNode(nodeId)) {
      await clearLinkagePending(blockRowId);
      const link = await upsertBlockPyqLink({
        user_id: userId,
        block_id: blockRowId,
        node_id: nodeId,
        stage: block.stage || null,
        status: 'skipped_generic',
        skip_reason: 'GENERIC_BLOCK',
      });
      return { linkageSkipped: true, reason: 'GENERIC_BLOCK', link };
    }

    // 5. Gate: must not be non-study source
    if (isNonStudySource(block.source_type)) {
      await clearLinkagePending(blockRowId);
      const link = await upsertBlockPyqLink({
        user_id: userId,
        block_id: blockRowId,
        node_id: nodeId,
        stage: block.stage || null,
        status: 'skipped_generic',
        skip_reason: 'NON_STUDY_BLOCK',
      });
      return { linkageSkipped: true, reason: 'NON_STUDY_BLOCK', link };
    }

    // 6. Look up PYQs for this node
    let pyqCount = 0;
    try {
      const engine = await getPyqLinkEngine();
      pyqCount = engine.getPyqCountForTopic(nodeId);
    } catch (err) {
      console.error('[knowledge-linkage] PYQ lookup failed:', err.message);
      // Don't block linkage — create row with 0 count
    }

    // 7. Gate: PYQs must exist
    if (pyqCount === 0) {
      await clearLinkagePending(blockRowId);
      const link = await upsertBlockPyqLink({
        user_id: userId,
        block_id: blockRowId,
        node_id: nodeId,
        stage: block.stage || null,
        status: 'no_pyqs',
        skip_reason: 'NO_PYQS',
        recommended_question_count: 0,
      });
      return { linkageSkipped: true, reason: 'NO_PYQS', link };
    }

    // 8. All gates passed — create recommendation
    const recommendedCount = Math.min(pyqCount, MAX_RECOMMENDED_QUESTIONS);

    const link = await upsertBlockPyqLink({
      user_id: userId,
      block_id: blockRowId,
      node_id: nodeId,
      stage: block.stage || null,
      status: 'recommended',
      recommended_question_count: recommendedCount,
    });

    await clearLinkagePending(blockRowId);

    console.log(
      `[knowledge-linkage] Created recommendation: user=${userId} block=${blockRowId} ` +
      `node=${nodeId} pyqs=${recommendedCount}`
    );

    return {
      linkageCreated: true,
      recommendation: {
        hasRecommendation: true,
        nodeId,
        questionCount: recommendedCount,
        totalAvailable: pyqCount,
        message: `${recommendedCount} PYQs available for this topic`,
        linkId: link?.id,
      },
    };
  } catch (err) {
    console.error('[knowledge-linkage] handleBlockCompletionLinkage failed:', err.message);
    // Non-fatal — linkage_pending remains TRUE for retry
    return { linkageSkipped: true, reason: 'PROCESSING_ERROR', error: err.message };
  }
}

// ── 2. GET PYQ RECOMMENDATION FOR A BLOCK ───────────────────────────────────

export async function recommendPyqsForBlock(userId, blockId) {
  const link = await getBlockPyqLink(userId, blockId);
  if (!link) {
    return { hasRecommendation: false, reason: 'NO_LINKAGE' };
  }

  if (link.status === 'recommended' && link.recommended_question_count > 0) {
    return {
      hasRecommendation: true,
      nodeId: link.node_id,
      questionCount: link.recommended_question_count,
      message: `${link.recommended_question_count} PYQs available for this topic`,
      linkId: link.id,
      status: link.status,
    };
  }

  return {
    hasRecommendation: false,
    reason: link.skip_reason || link.status,
    status: link.status,
    linkId: link.id,
  };
}

// ── 3. RECORD PYQ FOLLOW-THROUGH ────────────────────────────────────────────
//
// Called when user actually attempts PYQs after a study block.
//
// results = [{ questionId, correct: bool, selectedAnswer?, correctAnswer?,
//              questionText?, subject?, nodeId?, stage? }]

export async function recordPyqFollowthrough(userId, blockId, results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { updated: false, reason: 'NO_RESULTS' };
  }

  // Find the linkage row
  const link = await getBlockPyqLink(userId, blockId);
  if (!link) {
    return { updated: false, reason: 'NO_LINKAGE_ROW' };
  }

  // Count results
  let correctCount = 0;
  let wrongCount = 0;
  const mistakePromises = [];

  for (const r of results) {
    if (r.correct) {
      correctCount++;
    } else {
      wrongCount++;

      // Log mistake for wrong answers
      mistakePromises.push(
        logMistake({
          user_id:         userId,
          source_type:     'knowledge_linkage_pyq',
          source_ref:      `block:${blockId}`,
          question_id:     r.questionId || null,
          stage:           r.stage || link.stage || null,
          subject:         r.subject || null,
          node_id:         r.nodeId || link.node_id || null,
          question_text:   r.questionText || null,
          selected_answer: r.selectedAnswer || null,
          correct_answer:  r.correctAnswer || null,
          answer_status:   'wrong',
          error_type:      r.errorType || null,
          notes:           '',
          must_revise:     true,
          block_id:        link.block_id,
        }).catch(err => {
          console.error('[knowledge-linkage] logMistake failed:', err.message);
          return null;
        })
      );
    }
  }

  // Process mistakes (which auto-create revision items via existing flow)
  await Promise.allSettled(mistakePromises);

  // Update linkage row
  const newAttempted = (link.attempted_question_count || 0) + results.length;
  const newCorrect   = (link.correct_count || 0) + correctCount;
  const newWrong     = (link.wrong_count || 0) + wrongCount;
  const allDone      = newAttempted >= link.recommended_question_count;

  const updated = await updateBlockPyqLink(link.id, {
    attempted_question_count: newAttempted,
    correct_count:            newCorrect,
    wrong_count:              newWrong,
    status:                   allDone ? 'completed' : 'started',
  });

  return {
    updated: true,
    link: updated,
    attempted: results.length,
    correct: correctCount,
    wrong: wrongCount,
    mistakesLogged: wrongCount,
  };
}

// ── 4. GET KNOWLEDGE CONTEXT FOR A NODE ─────────────────────────────────────

export async function getKnowledgeContextForNode(userId, nodeId) {
  if (!userId || !nodeId) {
    return { nodeId, studyBlocks: [], pyqLinks: [], mistakes: [], revisionItems: [] };
  }

  const normalizedNode = normalizeNodeId(nodeId);

  // Fetch all data in parallel
  const [pyqLinks, studyBlocksResult, mistakesResult, revisionResult] = await Promise.all([
    getLinksForNode(userId, normalizedNode),

    pool.query(
      `SELECT id, block_id, day_key, subject, topic, node_id, stage, status,
              started_at, ended_at, planned_minutes
       FROM study_blocks
       WHERE user_id = $1 AND node_id = $2
       ORDER BY day_key DESC
       LIMIT 20`,
      [userId, normalizedNode]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT id, question_id, subject, answer_status, error_type, created_at
       FROM mistakes
       WHERE user_id = $1 AND node_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, normalizedNode]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT id, question_id, subject, status, priority, next_review_at, review_count
       FROM revision_items
       WHERE user_id = $1 AND node_id = $2
       ORDER BY next_review_at ASC
       LIMIT 50`,
      [userId, normalizedNode]
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    nodeId: normalizedNode,
    studyBlocks: studyBlocksResult.rows || [],
    pyqLinks,
    mistakes: mistakesResult.rows || [],
    revisionItems: revisionResult.rows || [],
    summary: {
      totalStudySessions: (studyBlocksResult.rows || []).length,
      totalPyqLinks: pyqLinks.length,
      recommendedNotAttempted: pyqLinks.filter(l => l.status === 'recommended').length,
      totalMistakes: (mistakesResult.rows || []).length,
      pendingRevisions: (revisionResult.rows || []).filter(r => r.status === 'pending').length,
    },
  };
}

// ── 5. PROCESS PENDING LINKAGES (DURABLE ASYNC) ─────────────────────────────
// Called periodically or on demand to process any blocks with linkage_pending = TRUE.
// This ensures no linkage is lost even if the server crashes after block completion.

export async function processPendingLinkages(userId) {
  let processed = 0;
  let errors = 0;

  try {
    const { rows: pendingBlocks } = await pool.query(
      `SELECT id, user_id
       FROM study_blocks
       WHERE linkage_pending = TRUE
         AND status IN ('completed','partial')
         AND ($1::TEXT IS NULL OR user_id = $1)
       ORDER BY ended_at DESC
       LIMIT 50`,
      [userId || null]
    );

    for (const block of pendingBlocks) {
      try {
        await handleBlockCompletionLinkage(block.user_id, block.id);
        processed++;
      } catch (err) {
        console.error(`[knowledge-linkage] pending processing failed for block ${block.id}:`, err.message);
        errors++;
      }
    }
  } catch (err) {
    // linkage_pending column may not exist yet
    if (err.code === '42703' || err.message?.includes('does not exist')) {
      return { processed: 0, errors: 0, reason: 'MIGRATION_PENDING' };
    }
    throw err;
  }

  return { processed, errors };
}
