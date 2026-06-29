// backend/routes/planBlockRoutes.js
// Clean REST API for block lifecycle.
// Also used internally by the /api/sheets interceptor — frontend can call either path.
//
//   GET  /api/plan/blocks?dayKey=YYYY-MM-DD
//   POST /api/plan/blocks/start
//   POST /api/plan/blocks/pause
//   POST /api/plan/blocks/resume
//   POST /api/plan/blocks/complete
//   POST /api/plan/blocks/repair               (admin)
//   POST /api/plan/blocks/:blockId/retry-calendar

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  startBlock,
  pauseBlock,
  resumeBlock,
  completeBlock,
  attachBlockProof,
  getBlocksForDay,
  getBlockState,
  repairLegacyActiveBlocks,
} from '../services/blockLifecycleService.js';
import { syncBlockToCalendar, retryFailedCalendarSyncs, probeCalendarBridge } from '../services/calendarBridgeService.js';

const router = express.Router();
const DEFAULT_USER = process.env.DEFAULT_USER_ID || 'moulika';

const uploadsDir = path.join(process.cwd(), 'uploads', 'proofs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const upload = multer({ storage });

function userId(req) {
  return req.body?.userId || req.query?.userId || DEFAULT_USER;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── GET /api/plan/blocks ──────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const uid    = userId(req);
    const dayKey = req.query.dayKey || todayKey();
    const blocks = await getBlocksForDay(uid, dayKey);
    return res.json({ ok: true, blocks, userId: uid, dayKey });
  } catch (err) {
    console.error('[GET /api/plan/blocks]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/plan/blocks/start ───────────────────────────────────────────────

router.post('/start', async (req, res) => {
  const {
    blockId, dayKey,
    title = '', subject = '', topic = '',
    plannedStart = '', plannedEnd = '', plannedMinutes = 0,
  } = req.body || {};

  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }

  try {
    const uid = userId(req);
    const day = dayKey || todayKey();

    const block = await startBlock(uid, blockId, day, {
      title, subject, topic, plannedStart, plannedEnd, plannedMinutes,
    });

    // Calendar sync is fire-and-forget — DB is already committed
    syncBlockToCalendar(block, 'start').catch((err) =>
      console.error('[calendar start]', err.message)
    );

    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/start]', err.message);
    const status = err.code === 'RACE_CONDITION' ? 409
                 : err.code === 'INVALID_TRANSITION' ? 422
                 : 500;
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/pause ───────────────────────────────────────────────

router.post('/pause', async (req, res) => {
  const { blockId, dayKey } = req.body || {};
  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid   = userId(req);
    const day   = dayKey || todayKey();
    const block = await pauseBlock(uid, blockId, day);

    syncBlockToCalendar(block, 'pause').catch(() => {});

    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/pause]', err.message);
    return res.status(err.code === 'NOT_ACTIVE' ? 409 : 500)
      .json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/resume ──────────────────────────────────────────────

router.post('/resume', async (req, res) => {
  const { blockId, dayKey } = req.body || {};
  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid   = userId(req);
    const day   = dayKey || todayKey();
    const block = await resumeBlock(uid, blockId, day);

    syncBlockToCalendar(block, 'resume').catch(() => {});

    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/resume]', err.message);
    return res.status(err.code === 'NOT_PAUSED' ? 409 : 500)
      .json({ ok: false, message: err.message, code: err.code });
  }
});

router.post('/complete', async (req, res) => {
  const {
    blockId, dayKey, reason,
    actualMinutes, outputType, outputCount, accuracy, score, confidence, weaknessNote,
    proofUrl, proofType, proofStatus, proofNotes
  } = req.body || {};
  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid   = userId(req);
    const day   = dayKey || todayKey();
    const block = await completeBlock(uid, blockId, day, {
      reason, actualMinutes, outputType, outputCount, accuracy, score, confidence, weaknessNote,
      proofUrl, proofType, proofStatus, proofNotes
    });

    syncBlockToCalendar(block, 'complete').catch(() => {});

    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/complete]', err.message);
    const status = err.code === 'PROOF_REQUIRED' ? 422
                 : err.code === 'NOT_STOPPABLE' ? 409
                 : 500;
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/upload-proof ─────────────────────────────────────────

router.post('/upload-proof', upload.single('file'), async (req, res) => {
  try {
    const blockId = req.body.blockId;
    const dayKey = req.body.dayKey || todayKey();
    const uid = userId(req);
    const proofType = req.body.proofType || (req.file ? 'image' : 'none');
    const proofNotes = req.body.proofNotes || req.body.notes || '';
    const verificationStatus = req.body.verificationStatus || (proofType === 'none' ? 'waived' : 'verified');

    if (!blockId) {
      return res.status(400).json({ ok: false, message: 'blockId is required' });
    }

    let proofUrl = req.body.proofUrl || null;
    if (req.file) {
      proofUrl = `/uploads/proofs/${req.file.filename}`;
    }

    const block = await attachBlockProof(uid, blockId, dayKey, {
      proofUrl,
      proofType,
      proofNotes,
      verificationStatus
    });

    return res.json({ ok: true, block, proofUrl });
  } catch (err) {
    console.error('[POST /api/plan/blocks/upload-proof]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/plan/blocks/repair ──────────────────────────────────────────────

router.post('/repair', async (req, res) => {
  try {
    const result = await repairLegacyActiveBlocks(req.body?.userId || null);
    return res.json(result);
  } catch (err) {
    console.error('[POST /api/plan/blocks/repair]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/plan/blocks/:blockId/retry-calendar ─────────────────────────────

router.post('/:blockId/retry-calendar', async (req, res) => {
  const { blockId } = req.params;
  const { dayKey }  = req.body || {};

  try {
    const uid   = userId(req);
    const day   = dayKey || todayKey();
    const block = await getBlockState(uid, blockId, day);
    if (!block) return res.status(404).json({ ok: false, message: 'Block not found' });

    const result = await syncBlockToCalendar(block, 'retry');
    return res.json({ ok: result.ok, calendarResult: result });
  } catch (err) {
    console.error('[retry-calendar]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/plan/blocks/retry-all-calendar ─────────────────────────────────

router.post('/retry-all-calendar', async (_req, res) => {
  try {
    const results = await retryFailedCalendarSyncs();
    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/plan/blocks/verify-calendar-bridge ────────────────────────────────
// Probes the live GAS endpoint using getBlocksForDate (read-only, no side effects).
// Returns a plain-language diagnosis of GAS reachability and supported actions.
// Example:
//   curl https://<host>/api/plan/blocks/verify-calendar-bridge

router.get('/verify-calendar-bridge', async (_req, res) => {
  try {
    const result = await probeCalendarBridge();
    const status = result.ok ? 200 : 502;
    return res.status(status).json(result);
  } catch (err) {
    console.error('[verify-calendar-bridge]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
