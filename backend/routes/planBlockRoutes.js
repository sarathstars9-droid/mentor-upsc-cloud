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
import { enqueueAction } from '../services/outboxService.js';

import { requireAuth, getAuthUserId } from '../middleware/authMiddleware.js';

const router = express.Router();
const DEFAULT_USER = process.env.DEFAULT_USER_ID || 'moulika';

function getProofsBaseDir() {
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'proofs');
  }
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  if (isProd) {
    throw Object.assign(
      new Error('STORAGE_CONFIG_FATAL: Persistent storage (RAILWAY_VOLUME_MOUNT_PATH) is not configured in production. Ephemeral local storage fallback is disabled for data safety.'),
      { status: 500, code: 'STORAGE_NOT_CONFIGURED' }
    );
  }
  return path.join(process.cwd(), 'uploads', 'proofs');
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const uid = userId(req);
      if (!uid) return cb(new Error('UNAUTHORIZED: Valid authenticated user required'));
      const targetDir = path.join(getProofsBaseDir(), uid);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext) ? ext : '.bin';
    cb(null, `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_MIME_TYPE: Only image/jpeg, image/png, image/webp, and application/pdf are allowed.'));
    }
  }
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'STORAGE_NOT_CONFIGURED' || err.message?.includes('STORAGE_CONFIG_FATAL')) {
        return res.status(500).json({ ok: false, message: err.message });
      }
      if (err.message?.includes('INVALID_MIME_TYPE') || err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, message: err.message || 'File size exceeds 10MB limit' });
      }
      return res.status(400).json({ ok: false, message: err.message });
    }
    next();
  });
}

function userId(req) {
  return getAuthUserId(req);
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

// ── GET /api/plan/blocks/proof-file ──────────────────────────────────────────
// Authenticated secure proof download/view endpoint with ownership & traversal check

router.get('/proof-file', async (req, res) => {
  try {
    const uid = userId(req);
    const { blockId, dayKey, file } = req.query;

    if (!blockId && !file) {
      return res.status(400).json({ ok: false, message: 'blockId or file is required' });
    }

    let targetRelativePath = '';

    if (blockId) {
      const day = dayKey || todayKey();
      const block = await getBlockState(uid, blockId, day);
      if (!block) {
        return res.status(403).json({ ok: false, message: 'Forbidden: Study block not found or unauthorized' });
      }
      if (!block.proofUrl) {
        return res.status(404).json({ ok: false, message: 'Proof file not found on block' });
      }
      targetRelativePath = block.proofUrl.replace('/api/plan/blocks/proof-file?file=', '').replace('/uploads/proofs/', '');
      targetRelativePath = decodeURIComponent(targetRelativePath);
    } else {
      targetRelativePath = decodeURIComponent(file);
    }

    // Sanitize path traversal
    const baseDir = path.resolve(getProofsBaseDir());
    const fullPath = path.resolve(baseDir, targetRelativePath);

    if (!fullPath.startsWith(baseDir)) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Path traversal detected' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ ok: false, message: 'Proof file does not exist on disk' });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('[GET /api/plan/blocks/proof-file]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/plan/blocks/start ───────────────────────────────────────────────

router.post('/start', async (req, res) => {
  const {
    blockId, dayKey,
    title = '', subject = '', topic = '',
    plannedStart = '', plannedEnd = '', plannedMinutes = 0,
    isTestData = false
  } = req.body || {};

  if (!blockId) {
    return res.status(400).json({ ok: false, message: 'blockId is required' });
  }

  try {
    const uid = userId(req);
    const isTestRequest = (blockId && blockId.startsWith('volume_survival_test_block_')) || isTestData === true;
    const isTestUser = uid && uid.startsWith('test_');
    if (isTestRequest && !isTestUser) {
      return res.status(400).json({ ok: false, message: 'Forbidden: Test block IDs and test flags are only permitted for test users.' });
    }
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
    const isDbError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('connection') || err.code === 'CIRCUIT_OPEN';
    if (isDbError) {
      const payload = {
        userId: userId(req), blockId, dayKey: req.body.dayKey || todayKey(), metadata: { title, subject, topic, plannedStart, plannedEnd, plannedMinutes, isTestData }
      };
      await enqueueAction('startBlock', payload);
      return res.status(202).json({ ok: true, queued: true, message: 'Action queued due to database degradation.' });
    }

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
    const isDbError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('connection') || err.code === 'CIRCUIT_OPEN';
    if (isDbError) {
      const payload = { userId: userId(req), blockId, dayKey: req.body.dayKey || todayKey() };
      await enqueueAction('pauseBlock', payload);
      return res.status(202).json({ ok: true, queued: true, message: 'Action queued due to database degradation.' });
    }

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
    const isDbError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('connection') || err.code === 'CIRCUIT_OPEN';
    if (isDbError) {
      const payload = { userId: userId(req), blockId, dayKey: req.body.dayKey || todayKey() };
      await enqueueAction('resumeBlock', payload);
      return res.status(202).json({ ok: true, queued: true, message: 'Action queued due to database degradation.' });
    }

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
    const isDbError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('connection') || err.code === 'CIRCUIT_OPEN';
    if (isDbError) {
      const payload = { 
        userId: userId(req), blockId, dayKey: req.body.dayKey || todayKey(), 
        metadata: { reason, actualMinutes, outputType, outputCount, accuracy, score, confidence, weaknessNote, proofUrl, proofType, proofStatus, proofNotes }
      };
      await enqueueAction('completeBlock', payload);
      return res.status(202).json({ ok: true, queued: true, message: 'Action queued due to database degradation.' });
    }

    const status = err.code === 'PROOF_REQUIRED' ? 422
                 : err.code === 'NOT_STOPPABLE' ? 409
                 : 500;
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/upload-proof ─────────────────────────────────────────

router.post('/upload-proof', handleUpload, async (req, res) => {
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

    // Ownership check before attaching proof
    const existingBlock = await getBlockState(uid, blockId, dayKey);
    if (!existingBlock) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ ok: false, message: 'Forbidden: Study block not found or ownership check failed' });
    }

    let proofUrl = req.body.proofUrl || null;
    if (req.file) {
      const relPath = path.relative(getProofsBaseDir(), req.file.path).replace(/\\/g, '/');
      proofUrl = `/api/plan/blocks/proof-file?file=${encodeURIComponent(relPath)}`;
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
