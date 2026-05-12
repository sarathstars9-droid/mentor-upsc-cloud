// backend/routes/pyqLinkageRoutes.js
// Phase 8 Knowledge Linkage — clean REST surface for frontend consumption.
//
// Routes:
//   POST  /api/pyq-linkage/trigger      — trigger linkage after block completion
//   GET   /api/pyq-linkage              — fetch linkage row (userId + blockId query params)
//   PATCH /api/pyq-linkage/:id          — update linkage (e.g. mark "started")

import express from 'express';
import {
  handleBlockCompletionLinkage,
} from '../services/knowledgeLinkageService.js';
import {
  getBlockPyqLink,
  updateBlockPyqLink,
} from '../repositories/knowledgeLinkageRepository.js';

const router = express.Router();

const DEFAULT_USER = process.env.DEFAULT_USER_ID || 'user_1';

function resolveUserId(req) {
  return req.body?.userId || req.query?.userId || DEFAULT_USER;
}

// ── POST /api/pyq-linkage/trigger ────────────────────────────────────────────
// Trigger linkage processing after a block is completed.
// Body: { userId, blockId }  (nodeId/stage are loaded from the DB block row)

router.post('/trigger', async (req, res) => {
  const { blockId } = req.body || {};
  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }

  try {
    const result = await handleBlockCompletionLinkage(resolveUserId(req), blockId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[POST /api/pyq-linkage/trigger]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/pyq-linkage?userId=&blockId= ────────────────────────────────────
// Fetch the linkage row for a specific block.

router.get('/', async (req, res) => {
  const { blockId } = req.query;
  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId query param is required' });
  }

  try {
    const link = await getBlockPyqLink(resolveUserId(req), blockId);
    if (!link) {
      return res.json({ ok: true, link: null });
    }
    return res.json({ ok: true, link });
  } catch (err) {
    console.error('[GET /api/pyq-linkage]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── PATCH /api/pyq-linkage/:id ───────────────────────────────────────────────
// Update a linkage row — used to mark "started", "skipped", or record attempt counts.
// Body: { status?, attempted_question_count?, correct_count?, wrong_count? }

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = [
    'status',
    'attempted_question_count',
    'correct_count',
    'wrong_count',
    'skip_reason',
  ];

  const changes = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) changes[key] = req.body[key];
  }

  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ ok: false, message: 'No valid fields to update' });
  }

  try {
    const updated = await updateBlockPyqLink(id, changes);
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Linkage row not found' });
    }
    return res.json({ ok: true, link: updated });
  } catch (err) {
    console.error('[PATCH /api/pyq-linkage/:id]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
