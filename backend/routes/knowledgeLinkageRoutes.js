// backend/routes/knowledgeLinkageRoutes.js
// REST API for the Knowledge Linkage Engine (Phase 8).
//
//   POST /api/knowledge/block-complete       — trigger linkage (admin/retry)
//   GET  /api/knowledge/block/:blockId       — get PYQ recommendation for a block
//   POST /api/knowledge/pyq-followthrough    — record PYQ attempt results
//   GET  /api/knowledge/node/:nodeId         — full knowledge context for a node
//   GET  /api/knowledge/report-summary       — linkage stats for reports
//   POST /api/knowledge/process-pending      — process pending linkages (admin)

import express from 'express';
import {
  handleBlockCompletionLinkage,
  recommendPyqsForBlock,
  recordPyqFollowthrough,
  getKnowledgeContextForNode,
  processPendingLinkages,
} from '../services/knowledgeLinkageService.js';
import { getLinkageSummary } from '../repositories/knowledgeLinkageRepository.js';

const router  = express.Router();
const DEFAULT = process.env.DEFAULT_USER_ID || 'moulika';

function uid(req) {
  return req.body?.userId || req.query?.userId || DEFAULT;
}

// ── POST /api/knowledge/block-complete ───────────────────────────────────────
// Manually trigger linkage processing for a block (admin / retry / testing).

router.post('/block-complete', async (req, res) => {
  const { blockId } = req.body || {};
  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }

  try {
    const result = await handleBlockCompletionLinkage(uid(req), blockId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[POST /api/knowledge/block-complete]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/knowledge/block/:blockId ────────────────────────────────────────
// Get the PYQ recommendation for a specific block.

router.get('/block/:blockId', async (req, res) => {
  const { blockId } = req.params;
  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }

  try {
    const recommendation = await recommendPyqsForBlock(uid(req), blockId);
    return res.json({ ok: true, recommendation });
  } catch (err) {
    console.error('[GET /api/knowledge/block/:blockId]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/knowledge/pyq-followthrough ────────────────────────────────────
// Record PYQ attempt results for a linked study block.
// Body: { userId, blockId, results: [{ questionId, correct, selectedAnswer, ... }] }

router.post('/pyq-followthrough', async (req, res) => {
  const { blockId, results } = req.body || {};
  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ ok: false, message: 'results array is required' });
  }

  try {
    const result = await recordPyqFollowthrough(uid(req), blockId, results);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[POST /api/knowledge/pyq-followthrough]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/knowledge/node/:nodeId ──────────────────────────────────────────
// Full knowledge context for a syllabus node.

router.get('/node/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  if (!nodeId) {
    return res.status(400).json({ ok: false, message: 'nodeId is required' });
  }

  try {
    const context = await getKnowledgeContextForNode(uid(req), nodeId);
    return res.json({ ok: true, context });
  } catch (err) {
    console.error('[GET /api/knowledge/node/:nodeId]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/knowledge/report-summary ────────────────────────────────────────
// Linkage stats for a date range (used by reports).

router.get('/report-summary', async (req, res) => {
  const startDate = req.query.startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const endDate   = req.query.endDate   || new Date().toISOString().slice(0, 10);

  try {
    const summary = await getLinkageSummary(uid(req), startDate, endDate);
    if (!summary) {
      return res.json({ ok: true, summary: null, reason: 'MIGRATION_PENDING' });
    }

    const studied   = Number(summary.total_links || 0) - Number(summary.generic_count || 0);
    const practiced = Number(summary.practiced_count || 0);
    const skipped   = Number(summary.skipped_count || 0) + Number(summary.recommended_count || 0);

    return res.json({
      ok: true,
      summary: {
        topicsStudied:              studied,
        topicsWithPyqRecommendation: studied - Number(summary.no_pyqs_count || 0) - Number(summary.generic_count || 0),
        practicedTopicsCount:       practiced,
        skippedPracticeCount:       skipped,
        revisionGeneratedCount:     Number(summary.total_wrong || 0),
        followThroughRate:          studied > 0 ? Math.round((practiced / studied) * 100) : 0,
        totalAttempted:             Number(summary.total_attempted || 0),
        totalCorrect:               Number(summary.total_correct || 0),
        totalWrong:                 Number(summary.total_wrong || 0),
        avgPyqAccuracy:             Number(summary.total_attempted || 0) > 0
          ? Math.round((Number(summary.total_correct || 0) / Number(summary.total_attempted || 0)) * 100)
          : 0,
      },
    });
  } catch (err) {
    console.error('[GET /api/knowledge/report-summary]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/knowledge/process-pending ──────────────────────────────────────
// Admin: process any pending linkage blocks that were missed.

router.post('/process-pending', async (req, res) => {
  try {
    const result = await processPendingLinkages(uid(req));
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[POST /api/knowledge/process-pending]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
