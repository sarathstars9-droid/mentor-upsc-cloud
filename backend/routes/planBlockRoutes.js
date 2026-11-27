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
  confirmRecoveredBlock,
  attachBlockProof,
  getBlocksForDay,
  getBlockState,
  repairLegacyActiveBlocks,
  recoverStaleBlock,
  createStudyBlock,
  updateStudyBlock,
  deleteStudyBlock,
  clearDayTimetable,
  resetDayExecution,
  carryForwardStudyBlock,
  quickStartStudyBlock,
  getLogBookEntries,
} from '../services/blockLifecycleService.js';
import { syncBlockToCalendar, retryFailedCalendarSyncs, probeCalendarBridge } from '../services/calendarBridgeService.js';
import { enqueueAction } from '../services/outboxService.js';
import { toFrontendBlock } from '../services/computeBlockState.js';

import { requireAuth, getAuthUserId } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);
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
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function isValidDayKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(key);
  if (isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === key;
}

// ── GET /api/plan/blocks ──────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const dayKey = req.query.dayKey;
  if (!dayKey) {
    return res.status(400).json({ ok: false, source: 'validation_error', date: null, error: 'dayKey is required.' });
  }
  if (!isValidDayKey(dayKey)) {
    return res.status(400).json({ ok: false, source: 'validation_error', date: dayKey, error: 'dayKey must use YYYY-MM-DD format and be a valid calendar date.' });
  }

  try {
    const uid = userId(req);
    const blocks = await getBlocksForDay(uid, dayKey);

    // Performance & Execution calculations
    let plannedMinutes = 0;
    let completedMinutes = 0;
    let studyingMinutes = 0;
    let completedCount = 0;
    let studyingCount = 0;

    for (const b of blocks) {
      const pMins = Number(b.PlannedMinutes || b.planned_minutes || 0);
      const aMins = Number(b.ActualMinutes || b.actual_minutes || 0);
      const st = String(b.Status || b.status || '').toLowerCase();

      if (['completed', 'done'].includes(st)) {
        completedMinutes += aMins;
        completedCount++;
        plannedMinutes += pMins;
      } else if (['active', 'studying', 'running'].includes(st)) {
        studyingMinutes += Math.floor(Number(b.ActualSeconds || 0) / 60);
        studyingCount++;
        plannedMinutes += pMins;
      } else if (['planned', 'upcoming', 'paused'].includes(st)) {
        plannedMinutes += pMins;
      }
    }

    const remainingMinutes = Math.max(0, plannedMinutes - completedMinutes - studyingMinutes);
    const executionPercent = plannedMinutes > 0
      ? Math.min(100, Math.round(((completedMinutes + studyingMinutes) / plannedMinutes) * 1000) / 10)
      : 0;

    const metrics = {
      plannedMinutes,
      completedMinutes,
      studyingMinutes,
      remainingMinutes,
      executionPercent,
      completedCount,
      studyingCount,
      totalCount: blocks.length
    };

    return res.json({ ok: true, source: 'postgres', userId: uid, date: dayKey, blocks, metrics });
  } catch (err) {
    console.error('[GET /api/plan/blocks]', err);
    return res.status(500).json({ ok: false, source: 'postgres_error', date: dayKey, error: 'Unable to load the current plan.' });
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
                 : err.code === 'ACTIVE_BLOCK_EXISTS' ? 409
                 : err.code === 'STALE_ACTIVE_SESSION' ? 409
                 : err.code === 'INVALID_TRANSITION' ? 422
                 : (err.status || 500);

    const payload = { ok: false, message: err.message, code: err.code };
    if (err.code === 'ACTIVE_BLOCK_EXISTS' && err.activeBlock) {
      payload.activeBlock = err.activeBlock;
    }
    if (err.code === 'STALE_ACTIVE_SESSION' && err.staleBlock) {
      payload.staleBlock = err.staleBlock;
    }
    return res.status(status).json(payload);
  }
});

// ── POST /api/plan/blocks/:blockId/recover-stale-session ──────────

router.post('/:blockId/recover-stale-session', async (req, res) => {
  const { blockId } = req.params;
  const { actualMinutes, resolution, dayKey } = req.body || {};

  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });
  if (typeof actualMinutes !== 'number' || !Number.isInteger(actualMinutes) || actualMinutes < 0) {
    return res.status(400).json({ ok: false, message: 'actualMinutes must be a non-negative integer' });
  }
  if (!['user_confirmed', 'abandoned'].includes(resolution)) {
    return res.status(400).json({ ok: false, message: 'Invalid resolution' });
  }

  try {
    const uid = userId(req);
    const derivedDay = (typeof blockId === 'string' && /^\d{4}-\d{2}-\d{2}/.test(blockId)) ? blockId.slice(0, 10) : null;
    const day = dayKey || derivedDay || null;

    const block = await recoverStaleBlock(uid, blockId, day, actualMinutes, resolution);
    syncBlockToCalendar(block, 'complete').catch(() => {});
    return res.json({ ok: true, block });
  } catch (err) {
    console.error(`[POST /api/plan/blocks/${blockId}/recover-stale-session]`, err.message);
    const isDbError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('connection') || err.code === 'CIRCUIT_OPEN';
    if (isDbError) {
      return res.status(202).json({ ok: true, queued: false, message: 'Database temporarily unavailable. Please try again.' });
    }

    const status = err.code === 'NOT_STALE' ? 409
                 : err.code === 'INVALID_MINUTES' ? 400
                 : err.code === 'AMBIGUOUS_STALE_SESSION' ? 400
                 : err.code === 'NOT_FOUND' ? 404
                 : err.code === 'NOT_ACTIVE' ? 409
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

router.post(['/complete', '/finish'], async (req, res) => {
  const {
    blockId, dayKey, reason,
    actualMinutes, actualEndTime, endedAt,
    studyReview, study_review, completionPercent, completion_percent, quality,
    outputType, outputCount, accuracy, score, confidence, weaknessNote,
    proofUrl, proofType, proofStatus, proofNotes
  } = req.body || {};
  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid   = userId(req);
    const day   = dayKey || todayKey();
    const block = await completeBlock(uid, blockId, day, {
      reason, actualMinutes, actualEndTime: actualEndTime || endedAt,
      studyReview: studyReview || study_review,
      completionPercent: completionPercent !== undefined ? completionPercent : completion_percent,
      quality,
      outputType, outputCount, accuracy, score, confidence, weaknessNote,
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
        metadata: { reason, actualMinutes, actualEndTime: actualEndTime || endedAt, studyReview: studyReview || study_review, completionPercent, quality, outputType, outputCount, accuracy, score, confidence, weaknessNote, proofUrl, proofType, proofStatus, proofNotes }
      };
      await enqueueAction('completeBlock', payload);
      return res.status(202).json({ ok: true, queued: true, message: 'Action queued due to database degradation.' });
    }

    const status = err.code === 'PROOF_REQUIRED' ? 422
                 : err.code === 'NOT_STOPPABLE' ? 409
                 : err.code === 'INVALID_END_TIME' ? 400
                 : err.code === 'INVALID_COMPLETION' ? 400
                 : 500;
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/confirm-recovery ──────────────────────────────────
router.post(['/confirm-recovery', '/:blockId/confirm-recovery'], async (req, res) => {
  const finalBid = req.params?.blockId || req.body?.blockId || req.body?.BlockId;
  if (!finalBid) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid = userId(req);
    const { dayKey, actualMinutes, actualEndTime, endedAt, studyReview, study_review, quality, completionPercent, completion_percent } = req.body || {};
    const block = await confirmRecoveredBlock(uid, finalBid, dayKey || null, {
      actualMinutes,
      actualEndTime: actualEndTime || endedAt,
      studyReview: studyReview || study_review,
      quality,
      completionPercent: completionPercent !== undefined ? completionPercent : completion_percent
    });

    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/confirm-recovery]', err.message);
    const status = err.code === 'NOT_FOUND' ? 404
                 : err.code === 'INVALID_CONFIRMATION_TARGET' ? 400
                 : 500;
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/carry-forward ───────────────────────────────────────

router.post('/carry-forward', async (req, res) => {
  const { blockId, targetDayKey, targetDate, plannedMinutes, planComment } = req.body || {};
  if (!blockId) return res.status(400).json({ ok: false, message: 'blockId is required' });

  try {
    const uid = userId(req);
    const targetKey = targetDayKey || targetDate;
    const block = await carryForwardStudyBlock(uid, blockId, targetKey, { plannedMinutes, planComment });
    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/carry-forward]', err.message);
    const status = err.status || (err.code === 'NOT_FOUND' ? 404 : 500);
    return res.status(status).json({ ok: false, message: err.message, code: err.code });
  }
});

// ── POST /api/plan/blocks/quick-start ─────────────────────────────────────────

router.post('/quick-start', async (req, res) => {
  const { dayKey, blockData = {}, subject, topic, subtopic, customTopic, plannedMinutes, planComment } = req.body || {};
  const data = {
    ...blockData,
    subject: subject || blockData.subject,
    topic: topic || blockData.topic,
    subtopic: subtopic || blockData.subtopic,
    customTopic: customTopic || blockData.customTopic,
    plannedMinutes: plannedMinutes || blockData.plannedMinutes,
    planComment: planComment || blockData.planComment
  };

  try {
    const uid = userId(req);
    const day = dayKey || todayKey();
    const block = await quickStartStudyBlock(uid, day, data);
    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks/quick-start]', err.message);
    const status = err.code === 'ACTIVE_BLOCK_EXISTS' ? 409
                 : err.code === 'RACE_CONDITION' ? 409
                 : err.code === 'STALE_ACTIVE_SESSION' ? 409
                 : (err.status || (err.code === 'INVALID_DURATION' ? 400 : 500));

    const payload = { ok: false, message: err.message, code: err.code };
    if (err.code === 'ACTIVE_BLOCK_EXISTS' && err.activeBlock) {
      payload.activeBlock = err.activeBlock;
    }
    return res.status(status).json(payload);
  }
});

// ── POST /api/plan/blocks/confirm-ocr ─────────────────────────────────────────

router.post('/confirm-ocr', async (req, res) => {
  const { dayKey, items } = req.body || {};
  if (!dayKey || !Array.isArray(items)) {
    return res.status(400).json({ ok: false, message: 'dayKey and items array are required' });
  }

  try {
    const uid = userId(req);
    const { savePlanBlocksAndLogEvents } = await import('../services/blockLifecycleService.js');
    const enriched = items.map((it, idx) => ({
      ...it,
      blockId: it.blockId || it.BlockId || `ocr_${Date.now()}_${idx + 1}`,
      source: 'ocr',
      source_type: 'ocr'
    }));
    const result = await savePlanBlocksAndLogEvents(uid, dayKey, enriched);
    const blocks = await getBlocksForDay(uid, dayKey);
    return res.json({ ok: true, result, blocks });
  } catch (err) {
    console.error('[POST /api/plan/blocks/confirm-ocr]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/plan/blocks/recents ──────────────────────────────────────────────
router.get('/recents', async (req, res) => {
  try {
    const uid = userId(req);
    const { getUserRecentSubjectsAndTopics } = await import('../services/blockLifecycleService.js');
    const recents = await getUserRecentSubjectsAndTopics(uid);
    const requestedSubject = req.query.subject;
    const scopedTopics = requestedSubject ? (recents.recentTopicsBySubject?.[requestedSubject] || []) : [];
    return res.json({ ok: true, ...recents, recentTopics: scopedTopics });
  } catch (err) {
    console.error('[GET /api/plan/blocks/recents]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── DAILY PLAN IMAGE ROUTES (PER-DAY PERSISTENCE) ────────────────────────────
router.get('/daily-image', async (req, res) => {
  try {
    const uid = userId(req);
    const dayKey = req.query.dayKey || todayKey();
    const { pool } = await import('../db/index.js');
    const { rows } = await pool.query(
      `SELECT day_key, image_data, mime_type, raw_ocr_text, created_at
       FROM public.daily_plan_images
       WHERE user_id = $1 AND day_key = $2`,
      [uid, dayKey]
    );

    if (!rows.length) {
      return res.json({ ok: true, exists: false, image: null });
    }

    return res.json({
      ok: true,
      exists: true,
      image: {
        dayKey: rows[0].day_key,
        imageData: rows[0].image_data,
        mimeType: rows[0].mime_type,
        rawOcrText: rows[0].raw_ocr_text,
        createdAt: rows[0].created_at
      }
    });
  } catch (err) {
    console.error('[GET /api/plan/blocks/daily-image]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

router.post('/daily-image', async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey, imageData, mimeType, rawOcrText } = req.body || {};
    if (!dayKey || !imageData) {
      return res.status(400).json({ ok: false, message: 'dayKey and imageData are required' });
    }

    const { pool } = await import('../db/index.js');
    await pool.query(
      `INSERT INTO public.daily_plan_images (user_id, day_key, image_data, mime_type, raw_ocr_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, day_key)
       DO UPDATE SET
         image_data = EXCLUDED.image_data,
         mime_type = EXCLUDED.mime_type,
         raw_ocr_text = EXCLUDED.raw_ocr_text,
         updated_at = NOW()`,
      [uid, dayKey, imageData, mimeType || 'image/png', rawOcrText || null]
    );

    return res.json({ ok: true, message: 'Daily plan image persisted' });
  } catch (err) {
    console.error('[POST /api/plan/blocks/daily-image]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ── GET /api/plan/blocks/logbook ──────────────────────────────────────────────

router.get('/logbook', async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey, limit, offset } = req.query;
    const entries = await getLogBookEntries(uid, { dayKey, limit: Number(limit) || 50, offset: Number(offset) || 0 });
    return res.json({ ok: true, entries });
  } catch (err) {
    console.error('[GET /api/plan/blocks/logbook]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
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

// ── CRUD & MANAGEMENT ENDPOINTS ───────────────────────────────────────────────

router.post(['/', '/create'], async (req, res) => {
  try {
    const uid = userId(req);
    const dayKey = req.body?.dayKey;
    const blockData = req.body?.blockData || {
      subject: req.body?.subject,
      topic: req.body?.topic,
      subtopic: req.body?.subtopic,
      customTopic: req.body?.customTopic,
      plannedMinutes: req.body?.plannedMinutes,
      planComment: req.body?.planComment,
      source: req.body?.source || 'manual',
      status: req.body?.status || 'planned'
    };
    if (!dayKey || (!blockData?.subject && !blockData?.PlannedSubject)) {
      return res.status(400).json({ ok: false, message: 'dayKey and subject are required' });
    }
    const block = await createStudyBlock(uid, dayKey, blockData);
    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST /api/plan/blocks]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

const handleBlockUpdate = async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey, blockId, patch = {} } = req.body || {};
    const finalBid = blockId || req.body?.BlockId;
    if (!finalBid) {
      return res.status(400).json({ ok: false, message: 'blockId is required' });
    }
    const finalPatch = Object.keys(patch).length > 0 ? patch : { ...req.body };
    delete finalPatch.blockId;
    delete finalPatch.BlockId;
    delete finalPatch.dayKey;
    const block = await updateStudyBlock(uid, dayKey || null, finalBid, finalPatch);
    return res.json({ ok: true, block });
  } catch (err) {
    console.error('[POST/PATCH /api/plan/blocks/update]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

router.post('/update', handleBlockUpdate);
router.patch(['/', '/update'], handleBlockUpdate);

router.post('/delete', async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey, blockId } = req.body;
    if (!dayKey || !blockId) {
      return res.status(400).json({ ok: false, message: 'dayKey and blockId are required' });
    }
    const result = await deleteStudyBlock(uid, dayKey, blockId);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[POST /api/plan/blocks/delete]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

router.post('/clear-today', async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey } = req.body;
    if (!dayKey) {
      return res.status(400).json({ ok: false, message: 'dayKey is required' });
    }
    const result = await clearDayTimetable(uid, dayKey);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[POST /api/plan/blocks/clear-today]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

router.post('/reset-execution', async (req, res) => {
  try {
    const uid = userId(req);
    const { dayKey } = req.body;
    if (!dayKey) {
      return res.status(400).json({ ok: false, message: 'dayKey is required' });
    }
    const result = await resetDayExecution(uid, dayKey);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[POST /api/plan/blocks/reset-execution]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
