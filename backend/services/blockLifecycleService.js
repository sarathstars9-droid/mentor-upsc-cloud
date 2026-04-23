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

  try { invalidateSuggestionsCache(userId); } catch {}
  return computeBlockState(rows[0]);
}

// ── COMPLETE / STOP ───────────────────────────────────────────────────────────
// Works from both active and paused states.
// If paused: folds the open pause duration into total_pause_seconds before closing.

export async function completeBlock(
  userId = DEFAULT_USER, blockId, dayKey,
  { reason = 'completed' } = {}
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
