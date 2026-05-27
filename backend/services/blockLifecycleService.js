// backend/services/blockLifecycleService.js
// Transaction-safe block lifecycle with PostgreSQL as the single source of truth.
//
// Design:
//   - startBlock   : acquires FOR UPDATE lock, auto-completes any existing active block,
//                    then marks target active.  DB unique index on (user_id) WHERE active
//                    provides a second safety net against concurrent starts.
//   - pauseBlock   : atomic UPDATE … WHERE status = 'active'
//   - resumeBlock  : folds current pause duration into total_pause_seconds atomically in SQL
//   - completeBlock: folds any open pause, sets ended_at
//   - repairLegacy : one-time cleanup for data created before this service existed

import { pool } from '../db/index.js';
import { computeBlockState, toFrontendBlock } from './computeBlockState.js';
import { invalidateSuggestionsCache } from './plannerService.js';

const DEFAULT_USER = process.env.DEFAULT_USER_ID || 'moulika';

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date();
}

// Allowed status transitions. Any attempt to move outside these throws.
const ALLOWED_FROM = {
  active:    new Set(['paused', 'completed', 'partial', 'missed', 'skipped']),
  paused:    new Set(['active', 'completed', 'partial', 'missed', 'skipped']),
  planned:   new Set(['active']),
  upcoming:  new Set(['active']),
  completed: new Set(),
  partial:   new Set(),
  missed:    new Set(),
  skipped:   new Set(),
};

function assertTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_FROM[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw Object.assign(
      new Error(`Invalid lifecycle transition: ${fromStatus} → ${toStatus}`),
      { code: 'INVALID_TRANSITION', fromStatus, toStatus }
    );
  }
}

// ── Upsert block record (ensures a row exists before any lifecycle call) ──────

export async function ensureBlockRecord(client, {
  userId, blockId, dayKey,
  title = '', subject = '', topic = '',
  plannedStart = '', plannedEnd = '', plannedMinutes = 0,
}) {
  await client.query(
    `INSERT INTO study_blocks
       (user_id, block_id, day_key, title, subject, topic,
        planned_start, planned_end, planned_minutes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'planned')
     ON CONFLICT (user_id, block_id, day_key) DO NOTHING`,
    [userId, blockId, dayKey, title, subject, topic, plannedStart, plannedEnd, plannedMinutes]
  );

  const { rows } = await client.query(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3`,
    [userId, blockId, dayKey]
  );
  return rows[0] || null;
}

// ── START ────────────────────────────────────────────────────────────────────
// Transaction flow:
//   1. Lock all active rows for user (FOR UPDATE prevents concurrent starts)
//   2. Auto-complete any existing active block(s)
//   3. Ensure target block row exists
//   4. Validate transition
//   5. Mark target active
//   6. Commit → DB unique index enforces single-active as final guard

export async function startBlock(userId = DEFAULT_USER, blockId, dayKey, metadata = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock all currently active rows for this user
    const { rows: activeRows } = await client.query(
      `SELECT * FROM study_blocks
       WHERE user_id = $1 AND status = 'active'
       FOR UPDATE`,
      [userId]
    );

    // Step 2: Auto-complete each existing active block
    for (const row of activeRows) {
      if (row.block_id === blockId) continue; // handled in step 5

      // Fold in any open pause duration before completing
      const foldPauseSec = row.paused_at
        ? Math.max(0, Math.floor((Date.now() - new Date(row.paused_at).getTime()) / 1000))
        : 0;

      await client.query(
        `UPDATE study_blocks
         SET status                = 'completed',
             ended_at              = NOW(),
             total_pause_seconds   = total_pause_seconds + $2,
             paused_at             = NULL,
             completion_reason     = 'auto_stopped_on_new_start',
             calendar_sync_status  = 'pending',
             updated_at            = NOW()
         WHERE id = $1`,
        [row.id, foldPauseSec]
      );
      
      try {
        const startedAt = row.started_at ? new Date(row.started_at).getTime() : Date.now();
        const endedAt = Date.now();
        const pauseSec = (row.total_pause_seconds || 0) + foldPauseSec;
        const actualMinutes = Math.max(0, Math.round((endedAt - startedAt - (pauseSec * 1000)) / 60000));

        await client.query(
          `UPDATE study_blocks SET actual_minutes = $1 WHERE id = $2`,
          [actualMinutes, row.id]
        );

        await client.query(
          `INSERT INTO public.block_logs (
             block_id, user_id, started_at, ended_at, actual_minutes, completion_status, confidence
           )
           VALUES ($1, $2, $3, NOW(), $4, 'completed', 'auto_stopped_on_new_start')`,
          [row.id, userId, row.started_at || new Date(), actualMinutes]
        );

        const { logStudyEvent } = await import('./eventService.js');
        await logStudyEvent({
          userId,
          eventType: 'BLOCK_COMPLETED',
          subject: row.subject,
          topic: row.topic,
          syllabusNodeId: row.node_id,
          blockId: row.id,
          metadata: {
            actual_minutes: actualMinutes,
            completion_status: 'completed',
            completion_reason: 'auto_stopped_on_new_start'
          }
        });
      } catch (e) {
        console.error('[blockLifecycle] Auto-completed block log/event failed:', e.message);
      }

      console.log(
        `[blockLifecycle] Auto-completed block ${row.block_id} (${row.id})` +
        ` to allow new block ${blockId} for user ${userId}`
      );
    }

    // Step 3: Ensure target row exists
    const targetRow = await ensureBlockRecord(client, {
      userId, blockId, dayKey, ...metadata,
    });

    if (!targetRow) throw new Error(`ensureBlockRecord returned null for ${blockId}`);

    // Step 4: Validate transition
    if (!['planned', 'upcoming', 'active'].includes(targetRow.status)) {
      assertTransition(targetRow.status, 'active');
    }
    if (targetRow.status === 'active') {
      // Already active (same block re-started) — just return current state
      await client.query('COMMIT');
      return computeBlockState(targetRow);
    }

    // Step 5: Mark target active
    const { rows: updated } = await client.query(
      `UPDATE study_blocks
       SET status               = 'active',
           started_at           = COALESCE(started_at, NOW()),
           paused_at            = NULL,
           last_resumed_at      = NULL,
           calendar_sync_status = 'pending',
           updated_at           = NOW()
       WHERE id = $1
       RETURNING *`,
      [targetRow.id]
    );

    await client.query('COMMIT');
    // Invalidate only after commit is confirmed — never on rollback path
    try { invalidateSuggestionsCache(userId); } catch {}

    // Event Ledger Hook
    try {
      const { logStudyEvent } = await import('./eventService.js');
      await logStudyEvent({
        userId,
        eventType: 'BLOCK_STARTED',
        subject: targetRow.subject,
        topic: targetRow.topic,
        syllabusNodeId: targetRow.node_id,
        blockId: targetRow.id,
        metadata
      });
    } catch (e) {
      console.error('[blockLifecycle] startBlock event log failed:', e.message);
    }

    return computeBlockState(updated[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    // Unique index violation = race condition: another tab already started a block
    if (err.code === '23505' && err.constraint === 'uniq_active_block_per_user') {
      throw Object.assign(
        new Error('Race condition: another session activated a block simultaneously. Please refresh.'),
        { code: 'RACE_CONDITION' }
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

// ── PAUSE ────────────────────────────────────────────────────────────────────

export async function pauseBlock(userId = DEFAULT_USER, blockId, dayKey) {
  const { rows } = await pool.query(
    `UPDATE study_blocks
     SET status      = 'paused',
         paused_at   = NOW(),
         pauses_count = pauses_count + 1,
         updated_at  = NOW()
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3 AND status = 'active'
     RETURNING *`,
    [userId, blockId, dayKey]
  );

  if (!rows.length) {
    // Block may already be paused (duplicate click) — return current state
    const { rows: current } = await pool.query(
      `SELECT * FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
      [userId, blockId, dayKey]
    );
    if (current.length) return computeBlockState(current[0]);
    throw Object.assign(
      new Error(`pauseBlock: block ${blockId} not found or not active`),
      { code: 'NOT_ACTIVE' }
    );
  }

  // Event Ledger Hook
  try {
    const { logStudyEvent } = await import('./eventService.js');
    await logStudyEvent({
      userId,
      eventType: 'BLOCK_PAUSED',
      subject: rows[0].subject,
      topic: rows[0].topic,
      syllabusNodeId: rows[0].node_id,
      blockId: rows[0].id
    });
  } catch (e) {
    console.error('[blockLifecycle] pauseBlock event log failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}
  return computeBlockState(rows[0]);
}

// ── RESUME ───────────────────────────────────────────────────────────────────
// Folds (NOW() - paused_at) into total_pause_seconds in a single atomic UPDATE.
// No frontend arithmetic needed — value is authoritative.

export async function resumeBlock(userId = DEFAULT_USER, blockId, dayKey) {
  const { rows } = await pool.query(
    `UPDATE study_blocks
     SET status               = 'active',
         total_pause_seconds  = total_pause_seconds
                                + GREATEST(0,
                                    EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER),
         last_resumed_at      = NOW(),
         paused_at            = NULL,
         updated_at           = NOW()
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3 AND status = 'paused'
     RETURNING *`,
    [userId, blockId, dayKey]
  );

  if (!rows.length) {
    const { rows: current } = await pool.query(
      `SELECT * FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
      [userId, blockId, dayKey]
    );
    if (current.length) return computeBlockState(current[0]);
    throw Object.assign(
      new Error(`resumeBlock: block ${blockId} not found or not paused`),
      { code: 'NOT_PAUSED' }
    );
  }

  // Event Ledger Hook
  try {
    const { logStudyEvent } = await import('./eventService.js');
    await logStudyEvent({
      userId,
      eventType: 'BLOCK_RESUMED',
      subject: rows[0].subject,
      topic: rows[0].topic,
      syllabusNodeId: rows[0].node_id,
      blockId: rows[0].id
    });
  } catch (e) {
    console.error('[blockLifecycle] resumeBlock event log failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}
  return computeBlockState(rows[0]);
}

// ── COMPLETE / STOP ───────────────────────────────────────────────────────────
// Works from both active and paused states.
// If paused: folds the open pause duration into total_pause_seconds before closing.

export async function completeBlock(
  userId = DEFAULT_USER, blockId, dayKey,
  {
    reason = 'completed',
    actualMinutes = null,
    outputType = null,
    outputCount = 0,
    accuracy = null,
    score = null,
    confidence = null,
    weaknessNote = null
  } = {}
) {
  const validReasons = new Set(['completed', 'partial', 'missed', 'skipped']);
  const finalStatus = validReasons.has(reason) ? reason : 'completed';

  const { rows } = await pool.query(
    `UPDATE study_blocks
     SET status              = $4,
         ended_at            = NOW(),
         total_pause_seconds = total_pause_seconds
                               + CASE WHEN paused_at IS NOT NULL
                                      THEN GREATEST(0,
                                             EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER)
                                      ELSE 0
                                 END,
         paused_at           = NULL,
         completion_reason   = $4,
         calendar_sync_status = 'pending',
         linkage_pending     = TRUE,
         updated_at          = NOW()
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3
       AND status IN ('active','paused')
     RETURNING *`,
    [userId, blockId, dayKey, finalStatus]
  );

  if (!rows.length) {
    const { rows: current } = await pool.query(
      `SELECT * FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
      [userId, blockId, dayKey]
    );
    if (current.length) return computeBlockState(current[0]);
    throw Object.assign(
      new Error(`completeBlock: block ${blockId} not found or not in stoppable state`),
      { code: 'NOT_STOPPABLE' }
    );
  }

  let calculatedMins = actualMinutes;
  if (calculatedMins == null) {
    const startedAt = rows[0].started_at ? new Date(rows[0].started_at).getTime() : Date.now();
    const endedAt = rows[0].ended_at ? new Date(rows[0].ended_at).getTime() : Date.now();
    const pauseSec = rows[0].total_pause_seconds || 0;
    calculatedMins = Math.max(0, Math.round((endedAt - startedAt - (pauseSec * 1000)) / 60000));
  }

  await pool.query(
    `UPDATE study_blocks SET actual_minutes = $1 WHERE id = $2`,
    [calculatedMins, rows[0].id]
  );

  const numericConfidence = toNumericConfidence(confidence);
  const confidenceLabel = toConfidenceLabel(confidence);

  const insertParams = [
      rows[0].id, userId, rows[0].started_at || new Date(), rows[0].ended_at || new Date(),
      calculatedMins, finalStatus, outputType, outputCount || 0, accuracy, score, numericConfidence, weaknessNote
  ];
  console.log(`[completeBlock] Executing block_logs INSERT with params:`, JSON.stringify(insertParams));

  await pool.query(
    `INSERT INTO public.block_logs (
       block_id, user_id, started_at, ended_at, actual_minutes, completion_status,
       output_type, output_count, accuracy, score, confidence, weakness_note
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    insertParams
  );

  try {
    const { logStudyEvent } = await import('./eventService.js');
    const studyEventMetadata = {
        actual_minutes: calculatedMins,
        completion_status: finalStatus,
        output_type: outputType,
        output_count: outputCount,
        weakness_note: weaknessNote,
        accuracy,
        score,
        confidence_label: confidenceLabel,
        confidence: numericConfidence
      };
    console.log(`[completeBlock] Executing study_events INSERT via logStudyEvent with metadata:`, JSON.stringify(studyEventMetadata));

    await logStudyEvent({
      userId,
      eventType: 'BLOCK_COMPLETED',
      subject: rows[0].subject,
      topic: rows[0].topic,
      syllabusNodeId: rows[0].node_id,
      blockId: rows[0].id,
      metadata: studyEventMetadata
    });
  } catch (e) {
    console.error('[blockLifecycle] completeBlock event log failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}

  // Phase 8: Knowledge Linkage — durable async processing.
  // linkage_pending = TRUE was set atomically above; this processes the linkage.
  // If this call fails or server crashes, the flag remains TRUE for retry via
  // POST /api/knowledge/process-pending.
  try {
    const { handleBlockCompletionLinkage } = await import('./knowledgeLinkageService.js');
    handleBlockCompletionLinkage(userId, rows[0].id).catch(err =>
      console.error('[knowledge-linkage] async hook failed:', err.message)
    );
  } catch { /* linkage service not yet deployed — safe to ignore */ }

  return computeBlockState(rows[0]);
}

// ── STOP ───────────────────────────────────────────────────────────────
// Stops the block without triggering knowledge linkage or full completion.
// Used when user stops an active session manually without reviewing.

export async function stopBlock(
  userId = DEFAULT_USER, blockId, dayKey,
  {
    outputType = null,
    outputCount = 0,
    weaknessNote = null,
    actualMinutes = null
  } = {}
) {
  const { rows } = await pool.query(
    `UPDATE study_blocks
     SET status              = 'partial',
         ended_at            = NOW(),
         total_pause_seconds = total_pause_seconds
                               + CASE WHEN paused_at IS NOT NULL
                                      THEN GREATEST(0,
                                             EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER)
                                      ELSE 0
                                 END,
         paused_at           = NULL,
         completion_reason   = 'stopped',
         calendar_sync_status = 'pending',
         updated_at          = NOW()
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3
       AND status IN ('active','paused')
     RETURNING *`,
    [userId, blockId, dayKey]
  );

  if (!rows.length) {
    const { rows: current } = await pool.query(
      `SELECT * FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
      [userId, blockId, dayKey]
    );
    if (current.length) return computeBlockState(current[0]);
    throw Object.assign(
      new Error(`stopBlock: block ${blockId} not found or not in stoppable state`),
      { code: 'NOT_STOPPABLE' }
    );
  }

  let calculatedMins = actualMinutes;
  if (calculatedMins == null) {
    const startedAt = rows[0].started_at ? new Date(rows[0].started_at).getTime() : Date.now();
    const endedAt = rows[0].ended_at ? new Date(rows[0].ended_at).getTime() : Date.now();
    const pauseSec = rows[0].total_pause_seconds || 0;
    calculatedMins = Math.max(0, Math.round((endedAt - startedAt - (pauseSec * 1000)) / 60000));
  }

  await pool.query(
    `UPDATE study_blocks SET actual_minutes = $1 WHERE id = $2`,
    [calculatedMins, rows[0].id]
  );

  await pool.query(
    `INSERT INTO public.block_logs (
       block_id, user_id, started_at, ended_at, actual_minutes, completion_status,
       output_type, output_count, weakness_note
     )
     VALUES ($1, $2, $3, $4, $5, 'partial', $6, $7, $8)`,
    [
      rows[0].id, userId, rows[0].started_at || new Date(), rows[0].ended_at || new Date(),
      calculatedMins, outputType, outputCount || 0, weaknessNote
    ]
  );

  try {
    const { logStudyEvent } = await import('./eventService.js');
    await logStudyEvent({
      userId,
      eventType: 'BLOCK_COMPLETED',
      subject: rows[0].subject,
      topic: rows[0].topic,
      syllabusNodeId: rows[0].node_id,
      blockId: rows[0].id,
      metadata: {
        actual_minutes: calculatedMins,
        completion_status: 'partial',
        output_type: outputType,
        output_count: outputCount,
        weakness_note: weaknessNote
      }
    });
  } catch (e) {
    console.error('[blockLifecycle] stopBlock event log failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}

  return computeBlockState(rows[0]);
}

// ── FETCH ─────────────────────────────────────────────────────────────────────

export async function getBlocksForDay(userId = DEFAULT_USER, dayKey) {
  const { rows } = await pool.query(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND day_key = $2
     ORDER BY planned_start ASC, created_at ASC`,
    [userId, dayKey]
  );

  // Phase 8: On-read retry for pending linkage.
  // If any completed blocks still have linkage_pending = TRUE, trigger
  // non-blocking retry. The UNIQUE constraint prevents duplicate linkage rows.
  try {
    const pendingBlocks = rows.filter(
      r => r.linkage_pending === true && ['completed', 'partial'].includes(r.status)
    );
    if (pendingBlocks.length > 0) {
      import('./knowledgeLinkageService.js')
        .then(mod => {
          for (const block of pendingBlocks) {
            mod.handleBlockCompletionLinkage(block.user_id, block.id)
              .catch(err => console.error('[linkage-retry] failed for', block.id, err.message));
          }
        })
        .catch(() => {}); // Module not yet deployed — safe to ignore
    }
  } catch { /* linkage retry is non-critical */ }

  return rows.map(computeBlockState);
}

export async function getBlockState(userId = DEFAULT_USER, blockId, dayKey) {
  const { rows } = await pool.query(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3`,
    [userId, blockId, dayKey]
  );
  return rows.length ? computeBlockState(rows[0]) : null;
}

// ── MERGE helper: overlay PostgreSQL lifecycle onto a GAS block array ─────────
// Called by the /api/sheets interceptor so the frontend always gets accurate state
// without changing which endpoint it calls.

export async function mergeLifecycleIntoGasBlocks(gasBlocks, userId, dayKey) {
  if (!Array.isArray(gasBlocks) || !gasBlocks.length) return gasBlocks;

  // Upsert all schedule metadata in one round-trip (ensures rows exist)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const b of gasBlocks) {
      if (!b.BlockId) continue;
      await client.query(
        `INSERT INTO study_blocks
           (user_id, block_id, day_key, title, subject, topic,
            planned_start, planned_end, planned_minutes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'planned')
         ON CONFLICT (user_id, block_id, day_key)
         DO UPDATE SET
           title           = EXCLUDED.title,
           subject         = EXCLUDED.subject,
           topic           = EXCLUDED.topic,
           planned_start   = EXCLUDED.planned_start,
           planned_end     = EXCLUDED.planned_end,
           planned_minutes = EXCLUDED.planned_minutes,
           updated_at      = NOW()
         WHERE study_blocks.status = 'planned'`,
        [
          userId, b.BlockId, dayKey,
          b.Subject || b.PlannedSubject || '',
          b.Subject || b.PlannedSubject || '',
          b.Topic   || b.PlannedTopic  || '',
          b.Start   || b.PlannedStart  || '',
          b.End     || b.PlannedEnd    || '',
          Number(b.Minutes || b.PlannedMinutes || 0),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[mergeLifecycle] upsert error:', err.message);
    // Non-fatal: return unmerged GAS blocks rather than failing the request
    return gasBlocks;
  } finally {
    client.release();
  }

  // Fetch fresh lifecycle state for all block IDs
  const blockIds = gasBlocks.map((b) => b.BlockId).filter(Boolean);
  if (!blockIds.length) return gasBlocks;

  const { rows: dbRows } = await pool.query(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND day_key = $2 AND block_id = ANY($3)`,
    [userId, dayKey, blockIds]
  );

  // Index by block_id for O(1) merge
  const dbMap = {};
  for (const row of dbRows) {
    dbMap[row.block_id] = computeBlockState(row);
  }

  // Merge: GAS provides schedule fields; PostgreSQL overrides lifecycle fields
  return gasBlocks.map((gasBlock) => {
    const db = dbMap[gasBlock.BlockId];
    if (!db) return gasBlock;          // no DB row yet — keep GAS data
    return toFrontendBlock(db, gasBlock);
  });
}

// ── LEGACY REPAIR ─────────────────────────────────────────────────────────────
// Safe to run multiple times. Finds users with more than one active block,
// keeps the most-recently-started one, auto-completes the rest.

export async function repairLegacyActiveBlocks(targetUserId = null) {
  const client = await pool.connect();
  const repairLog = [];

  try {
    await client.query('BEGIN');

    const { rows: dupUsers } = await client.query(
      `SELECT user_id,
              array_agg(id ORDER BY COALESCE(started_at, created_at) DESC) AS ids
       FROM study_blocks
       WHERE status = 'active'
         AND ($1::TEXT IS NULL OR user_id = $1)
       GROUP BY user_id
       HAVING COUNT(*) > 1`,
      [targetUserId]
    );

    for (const { user_id, ids } of dupUsers) {
      const [keepId, ...closeIds] = ids;

      await client.query(
        `UPDATE study_blocks
         SET status              = 'completed',
             ended_at            = COALESCE(ended_at, NOW()),
             total_pause_seconds = total_pause_seconds
                                   + CASE WHEN paused_at IS NOT NULL
                                          THEN GREATEST(0,
                                                 EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER)
                                          ELSE 0 END,
             paused_at           = NULL,
             completion_reason   = 'auto_repair_legacy',
             updated_at          = NOW()
         WHERE id = ANY($1)`,
        [closeIds]
      );

      repairLog.push({ user_id, kept: keepId, closed: closeIds });
      console.log(
        `[repair] user=${user_id} kept=${keepId} closed=${closeIds.join(',')}`
      );
    }

    await client.query('COMMIT');
    return { ok: true, repaired: repairLog };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[repair] ERROR', err.message);
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

// Helper functions for confidence normalization
function toNumericConfidence(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (v === 'high' || v === 'strong') return 1.0;
    if (v === 'medium' || v === 'partial') return 0.5;
    if (v === 'low' || v === 'weak') return 0.2;
    const parsed = parseFloat(v);
    if (!isNaN(parsed)) return parsed;
  }
  return 1.0; // Default
}

function toConfidenceLabel(val) {
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (['high', 'medium', 'low'].includes(v)) return v;
  }
  if (typeof val === 'number') {
    if (val >= 0.8) return 'high';
    if (val >= 0.4) return 'medium';
    return 'low';
  }
  return 'high'; // Default
}

export async function savePlanBlocksAndLogEvents(userId, date, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Log overall PLAN_ACCEPTED event (only if not logged for this date already)
    const existingOverallRes = await client.query(
      `SELECT id FROM public.study_events 
       WHERE user_id = $1 
         AND event_type = 'PLAN_ACCEPTED' 
         AND block_id IS NULL 
         AND (metadata_json->>'date') = $2 LIMIT 1`,
      [userId, date]
    );

    const { logStudyEvent } = await import('./eventService.js');
    if (existingOverallRes.rows.length === 0) {
      await logStudyEvent({
        userId,
        eventType: 'PLAN_ACCEPTED',
        metadata: { date, block_count: items.length },
        client
      });
    }

    for (const b of items) {
      if (!b.blockId) continue;
      
      const plannedMinutes = Number(b.planned_minutes || b.plannedMinutes || b.minutes || 0);
      const subject = b.subject || b.paper || '';
      const topic = b.topic || '';
      const rawNodeId = b.syllabus_node_id || b.syllabusNodeId || b.nodeId || '';
      let nodeId = rawNodeId && rawNodeId !== 'MISC-GEN' && !rawNodeId.startsWith('MISC') ? rawNodeId : null;
      
      const mode = (b.mode || '').trim();
      const outputExpected = (b.output_expected || b.outputExpected || '').trim();
      const rawText = (b.raw_text || b.rawText || '').trim();
      const subtopic = (b.subtopic || b.subTopic || '').trim();
      const paper = (b.paper || b.gsPaper || '').trim();

      // 1. Fallback mapping step if nodeId is missing/null and topic exists
      const rawMappingConfidence = b.mapping_confidence || b.mappingConfidence || b.confidenceBadge || b.confidence || 'high';
      let confidenceLabel = toConfidenceLabel(rawMappingConfidence);
      let numericConfidence = toNumericConfidence(rawMappingConfidence);

      if (!nodeId && topic && subject) {
        try {
          const { mapPlanItemToMicroTheme } = await import('../brain/findMicroTheme.js');
          const fallbackMap = mapPlanItemToMicroTheme(topic, subject);
          if (fallbackMap && fallbackMap.matched && fallbackMap.syllabusNodeId) {
            nodeId = fallbackMap.syllabusNodeId;
            confidenceLabel = toConfidenceLabel(fallbackMap.confidenceBand || 'medium');
            numericConfidence = toNumericConfidence(fallbackMap.confidenceBand || 'medium');
            console.log(`[savePlanBlocks fallback] Mapped "${topic}" (${subject}) -> ${nodeId} (${confidenceLabel})`);
          } else {
            confidenceLabel = 'low';
            numericConfidence = 0.2;
            console.log(`[savePlanBlocks fallback] Failed to map "${topic}" (${subject})`);
          }
        } catch (err) {
          console.error(`[savePlanBlocks fallback] Error running fallback mapper:`, err.message);
          confidenceLabel = 'low';
          numericConfidence = 0.2;
        }
      } else if (!nodeId) {
        confidenceLabel = 'low';
        numericConfidence = 0.2;
      }

      // Infer mode if missing
      let finalMode = mode;
      if (!finalMode) {
        const cleanText = `${subject} ${topic} ${rawText}`.toLowerCase();
        if (cleanText.includes("revision") || cleanText.includes("revise") || cleanText.includes("recall") || cleanText.includes("sheet")) {
          finalMode = "revision";
        } else if (
          cleanText.includes("practice") ||
          cleanText.includes("solve") ||
          cleanText.includes("drill") ||
          cleanText.includes("mcq") ||
          cleanText.includes("test") ||
          cleanText.includes("mock") ||
          cleanText.includes("pyq") ||
          cleanText.includes("writing") ||
          cleanText.includes("answer")
        ) {
          finalMode = "practice";
        } else {
          finalMode = "study";
        }
      }

      let finalRawText = rawText;
      if (!finalRawText) {
        finalRawText = `${topic || subject}`.trim();
      }

      // Deduplication rule: Check if a block with the same user, date, and raw_text (or details) already exists
      let existingBlockId = b.blockId;
      if ((finalRawText && finalRawText.trim()) || (subject && topic)) {
        const dupRes = await client.query(
          `SELECT block_id FROM public.study_blocks 
           WHERE user_id = $1 AND day_key = $2 
             AND (
               ($3 <> '' AND raw_text = $3)
               OR (subject = $4 AND topic = $5 AND COALESCE(mode, '') = $6 AND planned_minutes = $7)
             )
           LIMIT 1`,
          [userId, date, finalRawText.trim(), subject, topic, finalMode, plannedMinutes]
        );
        if (dupRes.rows.length > 0) {
          existingBlockId = dupRes.rows[0].block_id;
        }
      }

      // 2. Insert/update the study block record
      const insertParams = [
          userId, existingBlockId, date, topic || subject, subject, topic,
          b.startTime || b.plannedStart || '', b.endTime || b.end || '', plannedMinutes,
          paper, subtopic, nodeId, finalMode, outputExpected, finalRawText, numericConfidence
      ];
      console.log(`[savePlanBlocks] Executing study_blocks UPSERT with params:`, JSON.stringify(insertParams));

      await client.query(
        `INSERT INTO public.study_blocks (
           user_id, block_id, day_key, title, subject, topic,
           planned_start, planned_end, planned_minutes, status,
           date, paper, subtopic, syllabus_node_id, mode, output_expected, raw_text,
           source_type, mapping_confidence, created_at, updated_at
         )
         VALUES ($1, $2, $3::TEXT, $4, $5, $6, $7, $8, $9, 'planned', $3::DATE, $10, $11, $12, $13, $14, $15, 'uploaded_plan', $16, NOW(), NOW())
         ON CONFLICT (user_id, block_id, day_key)
         DO UPDATE SET
           title           = EXCLUDED.title,
           subject         = EXCLUDED.subject,
           topic           = EXCLUDED.topic,
           planned_start   = EXCLUDED.planned_start,
           planned_end     = EXCLUDED.planned_end,
           planned_minutes = EXCLUDED.planned_minutes,
           date            = EXCLUDED.date,
           paper           = EXCLUDED.paper,
           subtopic        = EXCLUDED.subtopic,
           syllabus_node_id= EXCLUDED.syllabus_node_id,
           mode            = EXCLUDED.mode,
           output_expected = EXCLUDED.output_expected,
           raw_text        = EXCLUDED.raw_text,
           source_type     = EXCLUDED.source_type,
           mapping_confidence = EXCLUDED.mapping_confidence,
           updated_at      = NOW()
         WHERE study_blocks.status = 'planned'`,
        insertParams
      );

      // Fetch block database id and row
      const dbBlockRes = await client.query(
        `SELECT * FROM public.study_blocks WHERE user_id = $1 AND block_id = $2 AND day_key = $3 LIMIT 1`,
        [userId, existingBlockId, date]
      );
      const insertedBlockRow = dbBlockRes.rows[0];
      const dbBlockId = insertedBlockRow?.id || null;

      if (insertedBlockRow) {
        console.log("[STAGE 5] Final inserted study_blocks row:", {
          id: insertedBlockRow.id,
          block_id: insertedBlockRow.block_id,
          day_key: insertedBlockRow.day_key,
          subject: insertedBlockRow.subject,
          topic: insertedBlockRow.topic,
          syllabus_node_id: insertedBlockRow.syllabus_node_id,
          mode: insertedBlockRow.mode,
          raw_text: insertedBlockRow.raw_text,
          output_expected: insertedBlockRow.output_expected,
          paper: insertedBlockRow.paper,
          subtopic: insertedBlockRow.subtopic,
          planned_minutes: insertedBlockRow.planned_minutes,
          mapping_confidence: insertedBlockRow.mapping_confidence
        });
      }

      // 3. Log PLAN_ACCEPTED event for each block (only if not logged for this block already)
      const existingPlanEventRes = await client.query(
        `SELECT id FROM public.study_events 
         WHERE user_id = $1 AND event_type = 'PLAN_ACCEPTED' AND block_id = $2 LIMIT 1`,
         [userId, dbBlockId]
      );

      if (existingPlanEventRes.rows.length === 0) {
        const studyEventMetadata = { 
            blockId: existingBlockId, 
            date,
            planned_minutes: plannedMinutes,
            source_type: 'uploaded_plan',
            raw_text: finalRawText,
            mode: finalMode,
            output_expected: outputExpected,
            confidence_label: confidenceLabel,
            mapping_confidence: numericConfidence
          };
          console.log(`[savePlanBlocks] Executing study_events INSERT via logStudyEvent with metadata:`, JSON.stringify(studyEventMetadata));

        await logStudyEvent({
          userId,
          eventType: 'PLAN_ACCEPTED',
          subject,
          topic,
          syllabusNodeId: nodeId,
          blockId: dbBlockId,
          metadata: studyEventMetadata,
          client
        });
      }

      // 4. Log PYQ_SEEN event if node has linked PYQs (only if not logged for this block already)
      if (nodeId && numericConfidence >= 0.5) {
        try {
          const { getPyqSummaryForNode } = await import('../brain/pyqLinkEngine.js');
          const pyqSummary = getPyqSummaryForNode(nodeId, 500);
          if (pyqSummary && pyqSummary.total > 0) {
            const existingPyqEventRes = await client.query(
              `SELECT id FROM public.study_events 
               WHERE user_id = $1 AND event_type = 'PYQ_SEEN' AND block_id = $2 LIMIT 1`,
              [userId, dbBlockId]
            );

            if (existingPyqEventRes.rows.length === 0) {
              await logStudyEvent({
                userId,
                eventType: 'PYQ_SEEN',
                subject,
                topic,
                syllabusNodeId: nodeId,
                blockId: dbBlockId,
                metadata: {
                  prelims_pyq_count: pyqSummary.prelimsCount + pyqSummary.csatCount,
                  mains_pyq_count: pyqSummary.mainsCount + pyqSummary.ethicsCount + pyqSummary.essayCount,
                  optional_pyq_count: pyqSummary.optionalCount,
                  pyq_ids: pyqSummary.questions.map(q => q.id),
                  purpose: 'revision_exposure'
                },
                client
              });
            }
          }
        } catch (err) {
          console.error(`[savePlanBlocks] Failed to log PYQ_SEEN for node ${nodeId}:`, err.message);
        }
      }

      if (nodeId && numericConfidence >= 0.5) {
        try {
          const { recalculateSyllabusNodeProgress } = await import('./trackingFoundationService.js');
          await recalculateSyllabusNodeProgress(userId, nodeId, client);
        } catch (err) {
          console.error(`[savePlanBlocks] Failed to recalculate progress for node ${nodeId}:`, err.message);
        }
      }
    }

    await client.query('COMMIT');

    // Trigger Telegram notification for PLAN_ACCEPTED_SUMMARY
    try {
      const { getYesterdayStudySummary, auditTodayPlan } = await import('./progressService.js');
      const { generatePlanAcceptedSummaryReport } = await import('./reportGeneratorService.js');
      const { sendNotification } = await import('./notificationService.js');
      const userRes = await pool.query(`SELECT name FROM public.users WHERE id = $1`, [userId]);
      const userName = userRes.rows[0]?.name || "Moulika";

      const yesterdaySummary = await getYesterdayStudySummary(userId);
      const todayAudit = await auditTodayPlan(userId, date);
      const messageText = generatePlanAcceptedSummaryReport(yesterdaySummary, todayAudit, userName);

      await sendNotification(
        userId,
        'PLAN_ACCEPTED_SUMMARY',
        'study_events',
        `plan_summary_${date}`,
        messageText,
        { date }
      );
    } catch (notifyErr) {
      console.error('[savePlanBlocks] Failed to send PLAN_ACCEPTED_SUMMARY notification:', notifyErr.message);
    }

    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[savePlanBlocksAndLogEvents] Transaction failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
