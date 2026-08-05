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

import { pool, criticalQuery } from '../db/index.js';
import { computeBlockState, toFrontendBlock } from './computeBlockState.js';
import { invalidateSuggestionsCache } from './plannerService.js';
import { checkAndTriggerRecovery } from './behaviorEscalationService.js';

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

function assertTransition(fromStatus, toStatus, targetRowDayKey) {
  if (fromStatus === 'skipped_rescue' && toStatus === 'active') {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (targetRowDayKey !== todayKey) {
      throw Object.assign(
        new Error(`Invalid lifecycle transition: cannot start past skipped_rescue block`),
        { code: 'INVALID_TRANSITION', fromStatus, toStatus }
      );
    }
    return;
  }
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
     ON CONFLICT (user_id, block_id, day_key) DO UPDATE SET
       title = EXCLUDED.title,
       subject = EXCLUDED.subject,
       topic = EXCLUDED.topic,
       planned_start = EXCLUDED.planned_start,
       planned_end = EXCLUDED.planned_end,
       planned_minutes = EXCLUDED.planned_minutes,
       updated_at = NOW()`,
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
//   3. Fetch target block row by (user_id, block_id, day_key) — never upsert
//   4. Validate transition via explicit status dispatch table
//   5. Mark target active (lifecycle fields only — no metadata columns touched)
//   6. Commit → DB unique index enforces single-active as final guard
//   7. Post-commit: log event and dispatch notification from committed row
//
// B1A: A normal Start must not modify title, subject, topic, planned_start,
//      planned_end, planned_minutes, subject_id, topic_id, node_id, block_id,
//      day_key, or user_id. Missing block → 404 (no creation fallback).

export async function startBlock(userId = DEFAULT_USER, blockId, dayKey, metadata = {}, deps = {}) {
  console.log(`[LifecycleRoute] startBlock called blockId=${blockId}`);
  const client = deps.poolClient || await pool.connect();
  try {
    await client.query('BEGIN');

    const transitionAt = new Date().toISOString();

    // Step 1: Lock all currently active rows for this user
    const { rows: activeRows } = await client.query(
      `SELECT * FROM study_blocks
       WHERE user_id = $1 AND status = 'active'
       FOR UPDATE`,
      [userId]
    );

    // Step 2: Auto-complete each existing active block (unchanged behaviour)
    for (const row of activeRows) {
      if (row.block_id === blockId) continue; // handled in step 5

      // Fold in any open pause duration before completing
      const foldPauseSec = row.paused_at
        ? Math.max(0, Math.floor((new Date(transitionAt).getTime() - new Date(row.paused_at).getTime()) / 1000))
        : 0;

      await client.query(
        `UPDATE study_blocks
         SET status                = 'completed',
             ended_at              = $2::timestamp with time zone,
             total_pause_seconds   = total_pause_seconds + $3,
             paused_at             = NULL,
             completion_reason     = 'auto_stopped_on_new_start',
             calendar_sync_status  = 'pending',
             updated_at            = $2::timestamp with time zone
         WHERE id = $1`,
        [row.id, transitionAt, foldPauseSec]
      );
      
      try {
        const startedAt = row.started_at ? new Date(row.started_at).getTime() : new Date(transitionAt).getTime();
        const endedAt = new Date(transitionAt).getTime();
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
           VALUES ($1, $2, $3, $4::timestamp with time zone, $5, 'completed', 'auto_stopped_on_new_start')`,
          [row.id, userId, row.started_at || new Date(transitionAt), transitionAt, actualMinutes]
        );

        const { logStudyEvent } = await import('./eventService.js');
        await logStudyEvent({
          userId,
          eventType: 'BLOCK_COMPLETED',
          subject: row.subject,
          topic: row.topic,
          syllabusNodeId: row.node_id,
          blockId: row.id,
          occurrenceTimestamp: transitionAt,
          metadata: {
            actual_minutes: actualMinutes,
            completion_status: 'completed',
            completion_reason: 'auto_stopped_on_new_start'
          },
          client
        });
      } catch (e) {
        console.error('[blockLifecycle] Auto-completed block log/event failed:', e.message);
      }

      try {
        const { sendNotification } = await import('./notificationService.js');
        await sendNotification(
          userId,
          'BLOCK_COMPLETED',
          'study_block',
          row.id,
          `✅ *Block Completed*\nSubject: ${row.subject || 'Block'}\nPlanned: ${row.planned_minutes || 0}m\nActual: ${actualMinutes}m\nThis counts toward your ${row.subject || 'target'}.`,
          { actualEnd: transitionAt }
        );
        console.log(`[TelegramLifecycle] BLOCK_COMPLETED sent blockId=${row.id}`);
      } catch (e) {
        console.error('[TelegramLifecycle] BLOCK_COMPLETED failed:', e.message);
      }

      console.log(
        `[blockLifecycle] Auto-completed block ${row.block_id} (${row.id})` +
        ` to allow new block ${blockId} for user ${userId}`
      );
    }

    // Step 3: Fetch the persisted target block row.
    // B1A: No upsert. Missing block → 404. Metadata is never overwritten here.
    const { rows: fetchedRows } = await client.query(
      `SELECT * FROM study_blocks
       WHERE user_id = $1 AND block_id = $2 AND day_key = $3
       FOR UPDATE`,
      [userId, blockId, dayKey]
    );

    if (!fetchedRows.length) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error(`Block not found: blockId=${blockId} dayKey=${dayKey}`),
        { code: 'NOT_FOUND', status: 404 }
      );
    }

    const targetRow = fetchedRows[0];

    // Step 4: Explicit status dispatch table.
    // Every non-startable status is handled explicitly; unknown status fails closed.
    switch (targetRow.status) {
      case 'planned':
      case 'upcoming':
      case 'skipped_rescue':
        // Startable — fall through to step 5.
        // skipped_rescue day-boundary guard is handled by assertTransition below.
        if (targetRow.status === 'skipped_rescue') {
          assertTransition(targetRow.status, 'active', dayKey);
        }
        break;

      case 'active':
        // Idempotent: same block re-sent. Return current state.
        // No duplicate event created; no duplicate notification sent.
        await client.query('COMMIT');
        return computeBlockState(targetRow);

      case 'paused':
        // Paused blocks must go through resumeBlock, not startBlock.
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error(`Block is paused. Use Resume to continue.`),
          { code: 'USE_RESUME', status: 409 }
        );

      case 'completed':
      case 'partial':
      case 'stopped':
      case 'missed':
      case 'skipped':
      case 'expired':
      case 'auto_closed':
        // Terminal states — reject.
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error(`Block already in terminal state: ${targetRow.status}`),
          { code: 'INVALID_TRANSITION', status: 409 }
        );

      default:
        // Unknown status — fail closed.
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error(`Unknown block status '${targetRow.status}' — refusing to start`),
          { code: 'INVALID_TRANSITION', status: 409 }
        );
    }

    // Step 5: Lifecycle-only UPDATE.
    // Only lifecycle columns are modified. No metadata column is included.
    const { rows: updated } = await client.query(
      `UPDATE study_blocks
       SET status               = 'active',
           started_at           = COALESCE(started_at, $3::timestamp with time zone),
           paused_at            = NULL,
           last_resumed_at      = NULL,
           calendar_sync_status = 'pending',
           updated_at           = $3::timestamp with time zone
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [targetRow.id, userId, transitionAt]
    );

    if (updated.length !== 1) {
      // Ownership check: if nothing returned, the user_id did not match.
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error(`Start update matched no rows — ownership check failed`),
        { code: 'NOT_FOUND', status: 404 }
      );
    }

    await client.query('COMMIT');
    // Invalidate suggestions cache only after successful commit.
    try { 
      if (deps.invalidateSuggestionsCache) deps.invalidateSuggestionsCache(userId);
      else invalidateSuggestionsCache(userId); 
    } catch {}

    // committed row is the authoritative source for all post-commit work.
    const committedRow = updated[0];

    // Step 7a: Event ledger — uses committedRow, never request metadata.
    // This is post-commit; failure must not roll back the committed start.
    try {
      const logger = deps.logStudyEvent || (await import('./eventService.js')).logStudyEvent;
      await logger({
        userId,
        eventType: 'BLOCK_STARTED',
        subject:        committedRow.subject,
        topic:          committedRow.topic,
        syllabusNodeId: committedRow.node_id,
        blockId:        committedRow.id,
        occurrenceTimestamp: committedRow.started_at,
        metadata: {
          planned_minutes: committedRow.planned_minutes,
          planned_start:   committedRow.planned_start,
          planned_end:     committedRow.planned_end,
        }
      });
    } catch (e) {
      console.error('[blockLifecycle] startBlock event log failed:', e.message);
    }

    // Step 7b: Notification — uses committedRow exclusively.
    // Post-commit: failure must not roll back or reverse the started state.
    try {
      const isTestRequest =
        (committedRow.block_id && committedRow.block_id.startsWith('volume_survival_test_block_')) ||
        metadata?.isTestData === true ||
        metadata?.is_test_data === true ||
        committedRow.is_test_data === true;
      const sender = deps.sendNotification || (await import('./notificationService.js')).sendNotification;
      await sender(
        userId,
        'BLOCK_STARTED',
        'study_block',
        committedRow.id,
        `🚀 *Block Started*\n\nSubject: ${committedRow.subject || 'Block'}\nTarget: ${committedRow.planned_minutes || 0}m\n\nFocus: create output, not just reading.`,
        { isTestData: isTestRequest, actualStart: committedRow.started_at }
      );
      console.log(`[TelegramLifecycle] BLOCK_STARTED queued blockId=${committedRow.id}`);
    } catch (e) {
      console.error('[TelegramLifecycle] BLOCK_STARTED failed:', e.message);
    }

    return computeBlockState(committedRow);

  } catch (err) {
    // Only ROLLBACK if we haven't already committed or explicitly rolled back.
    // Errors thrown after COMMIT will not have an open transaction.
    if (err.code !== 'NOT_FOUND' && err.code !== 'USE_RESUME' && err.code !== 'INVALID_TRANSITION') {
      try { await client.query('ROLLBACK'); } catch {}
    }
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
  console.log(`[LifecycleRoute] pauseBlock called blockId=${blockId}`);
  const { rows } = await criticalQuery(
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
    const { rows: current } = await criticalQuery(
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

  try {
    const { sendNotification } = await import('./notificationService.js');
    await sendNotification(
      userId,
      'BLOCK_PAUSED',
      'study_block',
      rows[0].id,
      `⏸️ *Block Paused*\nSubject: ${rows[0].subject || 'Block'}`
    );
    console.log(`[TelegramLifecycle] BLOCK_PAUSED queued blockId=${rows[0].id}`);
  } catch (e) {
    console.error('[TelegramLifecycle] BLOCK_PAUSED failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}
  return computeBlockState(rows[0]);
}

// ── RESUME ───────────────────────────────────────────────────────────────────
// Folds (NOW() - paused_at) into total_pause_seconds in a single atomic UPDATE.
// No frontend arithmetic needed — value is authoritative.

export async function resumeBlock(userId = DEFAULT_USER, blockId, dayKey) {
  console.log(`[LifecycleRoute] resumeBlock called blockId=${blockId}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Step 1: Auto-complete any existing active block(s)
    const { rows: activeRows } = await client.query(
      `SELECT * FROM study_blocks WHERE user_id = $1 AND status = 'active' FOR UPDATE`,
      [userId]
    );

    for (const row of activeRows) {
      if (row.block_id === blockId) continue;
      
      const foldPauseSec = row.paused_at ? Math.max(0, Math.floor((Date.now() - new Date(row.paused_at).getTime()) / 1000)) : 0;
      await client.query(
        `UPDATE study_blocks SET status = 'completed', ended_at = NOW(), total_pause_seconds = total_pause_seconds + $2, paused_at = NULL, completion_reason = 'auto_stopped_on_new_resume', updated_at = NOW() WHERE id = $1`,
        [row.id, foldPauseSec]
      );
    }

    // Step 2: Resume target block
    const { rows } = await client.query(
      `UPDATE study_blocks
       SET status               = 'active',
           total_pause_seconds  = total_pause_seconds
                                  + GREATEST(0,
                                      EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER),
           last_resumed_at      = NOW(),
           paused_at            = NULL,
           friction_state       = NULL,
           friction_alert_sent  = FALSE,
           friction_alert_sent_at = NULL,
           telegram_action_pending = FALSE,
           updated_at           = NOW()
       WHERE user_id = $1 AND block_id = $2 AND day_key = $3 AND status = 'paused'
       RETURNING *`,
      [userId, blockId, dayKey]
    );

    if (!rows.length) {
      const { rows: current } = await client.query(
        `SELECT * FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
        [userId, blockId, dayKey]
      );
      if (current.length) {
        await client.query('COMMIT');
        return computeBlockState(current[0]);
      }
      throw Object.assign(
        new Error(`resumeBlock: block ${blockId} not found or not paused`),
        { code: 'NOT_PAUSED' }
      );
    }
    
    await client.query('COMMIT');

    // Secondary async work
    (async () => {
      try {
        const { logStudyEvent } = await import('./eventService.js');
        await logStudyEvent({ userId, eventType: 'BLOCK_RESUMED', subject: rows[0].subject, topic: rows[0].topic, syllabusNodeId: rows[0].node_id, blockId: rows[0].id });
      } catch (e) { console.error('[blockLifecycle] resumeBlock event log failed:', e.message); }

      try {
        const { sendNotification } = await import('./notificationService.js');
        await sendNotification(userId, 'BLOCK_RESUMED', 'study_block', rows[0].id, `▶️ *Block Resumed*\nSubject: ${rows[0].subject || 'Block'}`);
      } catch (e) { console.error('[TelegramLifecycle] BLOCK_RESUMED failed:', e.message); }

      try { invalidateSuggestionsCache(userId); } catch {}
    })();

    return computeBlockState(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
    weaknessNote = null,
    proofUrl = null,
    proofType = null,
    proofStatus = null,
    proofNotes = null,
    completionSource = 'manual',
    completedBy = null,
    isTestData = false
  } = {}
) {
  console.log(`[LifecycleRoute] completeBlock called blockId=${blockId}`);
  const validReasons = new Set(['completed', 'partial', 'missed', 'skipped']);
  const finalStatus = validReasons.has(reason) ? reason : 'completed';

  // 1. Inspect existing block state to check proof requirement before completing
  const { rows: existingRows } = await criticalQuery(
    `SELECT * FROM study_blocks WHERE user_id = $1 AND block_id = $2 AND day_key = $3`,
    [userId, blockId, dayKey]
  );
  
  const existingBlock = existingRows[0] || null;
  const isTest = isTestData || completionSource === 'test' || String(blockId).includes('test') || Boolean(existingBlock?.is_test_data);

  if (finalStatus === 'completed' && !isTest) {
    const wasStartedOrUserAction = existingBlock?.status === 'active' || existingBlock?.status === 'paused' || ['manual', 'ui', 'telegram'].includes(completionSource);
    if (!wasStartedOrUserAction) {
      throw Object.assign(
        new Error(`Study block cannot be marked completed without explicit user action or being started`),
        { code: 'UNAUTHORIZED_COMPLETION' }
      );
    }

    const targetProofUrl = proofUrl || existingBlock?.proof_url;
    const targetProofType = proofType || existingBlock?.proof_type || (proofStatus === 'waived' ? 'none' : 'image');
    const targetProofStatus = proofStatus || (proofType === 'none' ? 'waived' : existingBlock?.proof_verification_status);
    const proofRequiredFlag = existingBlock?.proof_required ?? true;

    const hasValidProof = Boolean(targetProofUrl) || ['verified', 'waived'].includes(targetProofStatus) || proofRequiredFlag === false;
    if (!hasValidProof) {
      throw Object.assign(
        new Error(`Proof is required before completing this study block.`),
        { code: 'PROOF_REQUIRED' }
      );
    }
  }

  const transitionAt = new Date().toISOString();
  const { rows } = await criticalQuery(
    `UPDATE study_blocks
     SET status              = $4,
         started_at          = COALESCE(started_at, $12::timestamp with time zone),
         ended_at            = COALESCE(ended_at, $12::timestamp with time zone),
         completed_at        = CASE WHEN $4 = 'completed' THEN COALESCE(completed_at, $12::timestamp with time zone) ELSE completed_at END,
         total_pause_seconds = total_pause_seconds
                               + CASE WHEN paused_at IS NOT NULL
                                      THEN GREATEST(0,
                                             EXTRACT(EPOCH FROM ($12::timestamp with time zone - paused_at))::INTEGER)
                                      ELSE 0
                                 END,
         paused_at           = NULL,
         friction_state      = NULL,
         friction_alert_sent = FALSE,
         friction_alert_sent_at = NULL,
         telegram_action_pending = FALSE,
         completion_reason   = $4,
         proof_url           = COALESCE($5, proof_url),
         proof_type          = COALESCE($6, proof_type),
         proof_uploaded_at   = CASE WHEN $5 IS NOT NULL OR $7 = 'waived' THEN COALESCE(proof_uploaded_at, $12::timestamp with time zone) ELSE proof_uploaded_at END,
         proof_verification_status = COALESCE($7, proof_verification_status, 'verified'),
         proof_notes         = COALESCE($8, proof_notes),
         completion_source   = $9,
         completed_by        = COALESCE($10, user_id),
         is_test_data        = $11,
         proof_uploaded      = CASE WHEN $5 IS NOT NULL OR proof_url IS NOT NULL THEN TRUE ELSE proof_uploaded END,
         calendar_sync_status = 'pending',
         linkage_pending     = TRUE,
         updated_at          = $12::timestamp with time zone
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3
       AND status IN ('planned', 'active', 'paused')
     RETURNING *`,
    [userId, blockId, dayKey, finalStatus, proofUrl, proofType, proofStatus, proofNotes, completionSource, completedBy, isTest, transitionAt]
  );

  if (!rows.length) {
    const { rows: current } = await criticalQuery(
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
  if (finalStatus === 'completed' && !isTest && calculatedMins <= 0) {
    calculatedMins = rows[0].planned_minutes || 30;
  }

  const { rows: finalRows } = await criticalQuery(
    `UPDATE study_blocks SET actual_minutes = $1 WHERE id = $2 RETURNING *`,
    [calculatedMins, rows[0].id]
  );
  const finalBlock = finalRows[0] || rows[0];
  console.log(`[PlanWrite] study_blocks updated status=${finalStatus} actual_minutes=${calculatedMins}`);

  const numericConfidence = toNumericConfidence(confidence);
  const confidenceLabel = toConfidenceLabel(confidence);

  const insertParams = [
      finalBlock.id, userId, finalBlock.started_at || new Date(), finalBlock.ended_at || new Date(),
      calculatedMins, finalStatus, outputType, outputCount || 0, accuracy, score, numericConfidence, weaknessNote
  ];
  console.log(`[completeBlock] Executing block_logs INSERT with params:`, JSON.stringify(insertParams));

  await criticalQuery(
    `INSERT INTO public.block_logs (
       block_id, user_id, started_at, ended_at, actual_minutes, completion_status,
       output_type, output_count, accuracy, score, confidence, weakness_note
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    insertParams
  );
  console.log(`[PlanWrite] block_logs inserted`);

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
      subject: finalBlock.subject,
      topic: finalBlock.topic,
      syllabusNodeId: finalBlock.node_id,
      blockId: finalBlock.id,
      occurrenceTimestamp: finalBlock.ended_at,
      metadata: studyEventMetadata
    });
    console.log(`[PlanWrite] study_events inserted`);
  } catch (e) {
    console.error('[blockLifecycle] completeBlock event log failed:', e.message);
  }

  if (!isTest) {
    try {
      const { sendNotification } = await import('./notificationService.js');
      await sendNotification(
        userId,
        finalStatus === 'skipped' || finalStatus === 'missed' ? 'BLOCK_SKIPPED' : 'BLOCK_COMPLETED',
        'study_block',
        finalBlock.id,
        finalStatus === 'skipped' || finalStatus === 'missed' ?
        `⏭️ *Block Skipped*\nSubject: ${finalBlock.subject || 'Block'}\nPlanned: ${finalBlock.planned_minutes || 0}m\nDon't worry, adjust your plan.` :
        `✅ *Block Completed*\nSubject: ${finalBlock.subject || 'Block'}\nPlanned: ${finalBlock.planned_minutes || 0}m\nActual: ${calculatedMins}m\nThis counts toward your ${finalBlock.subject || 'target'}.`,
        { actualEnd: finalBlock.ended_at }
      );
      console.log(`[TelegramLifecycle] ${finalStatus === 'skipped' || finalStatus === 'missed' ? 'BLOCK_SKIPPED' : 'BLOCK_COMPLETED'} sent blockId=${finalBlock.id}`);
    } catch (e) {
      console.error('[TelegramLifecycle] BLOCK_COMPLETED/SKIPPED failed:', e.message);
    }
  } else {
    console.log(`[TelegramLifecycle] Skipped sending telegram message for test blockId=${finalBlock.id}`);
  }

  try { invalidateSuggestionsCache(userId); } catch {}

  // Phase 8: Knowledge Linkage — durable async processing.
  // linkage_pending = TRUE was set atomically above; this processes the linkage.
  // If this call fails or server crashes, the flag remains TRUE for retry via
  // POST /api/knowledge/process-pending.
  try {
    const { handleBlockCompletionLinkage } = await import('./knowledgeLinkageService.js');
    handleBlockCompletionLinkage(userId, finalBlock.id).catch(err =>
      console.error('[knowledge-linkage] async hook failed:', err.message)
    );
  } catch { /* linkage service not yet deployed — safe to ignore */ }

  await checkAndTriggerRecovery(userId, dayKey);

  return computeBlockState(finalBlock);
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
    actualMinutes = null,
    feedback = null,
    reason = null,
    productivityStatus = null
  } = {}
) {
  console.log(`[LifecycleRoute] stopBlock called blockId=${blockId}`);
  const transitionAt = new Date().toISOString();
  const { rows } = await criticalQuery(
    `UPDATE study_blocks
     SET status              = 'stopped',
         ended_at            = COALESCE(ended_at, $7::timestamp with time zone),
         total_pause_seconds = total_pause_seconds
                               + CASE WHEN paused_at IS NOT NULL
                                      THEN GREATEST(0,
                                             EXTRACT(EPOCH FROM ($7::timestamp with time zone - paused_at))::INTEGER)
                                      ELSE 0
                                 END,
         paused_at           = NULL,
         friction_state      = NULL,
         friction_alert_sent = FALSE,
         friction_alert_sent_at = NULL,
         telegram_action_pending = FALSE,
         completion_reason   = 'stopped',
         stop_feedback       = $4,
         stop_reason         = $5,
         productivity_status = $6,
         calendar_sync_status = 'pending',
         updated_at          = $7::timestamp with time zone
     WHERE user_id = $1 AND block_id = $2 AND day_key = $3
       AND status IN ('active','paused')
     RETURNING *`,
    [userId, blockId, dayKey, feedback, reason, productivityStatus, transitionAt]
  );

  if (!rows.length) {
    const { rows: current } = await criticalQuery(
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

  const { rows: finalRows } = await criticalQuery(
    `UPDATE study_blocks SET actual_minutes = $1 WHERE id = $2 RETURNING *`,
    [calculatedMins, rows[0].id]
  );
  const finalBlock = finalRows[0] || rows[0];

  await criticalQuery(
    `INSERT INTO public.block_logs (
       block_id, user_id, started_at, ended_at, actual_minutes, completion_status,
       output_type, output_count, weakness_note
     )
     VALUES ($1, $2, $3, $4, $5, 'partial', $6, $7, $8)`,
    [
      finalBlock.id, userId, finalBlock.started_at || new Date(), finalBlock.ended_at || new Date(),
      calculatedMins, outputType, outputCount || 0, weaknessNote
    ]
  );

  try {
    const { logStudyEvent } = await import('./eventService.js');
    await logStudyEvent({
      userId,
      eventType: 'BLOCK_COMPLETED',
      subject: finalBlock.subject,
      topic: finalBlock.topic,
      syllabusNodeId: finalBlock.node_id,
      blockId: finalBlock.id,
      occurrenceTimestamp: finalBlock.ended_at,
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

  try {
    const { sendNotification } = await import('./notificationService.js');
    await sendNotification(
      userId,
      'BLOCK_STOPPED',
      'study_block',
      finalBlock.id,
      `🛑 *Block Stopped*\nSubject: ${finalBlock.subject || 'Block'}\nPlanned: ${finalBlock.planned_minutes || 0}m\nActual: ${calculatedMins}m\nGreat effort!`,
      { actualEnd: finalBlock.ended_at }
    );
    console.log(`[TelegramLifecycle] BLOCK_STOPPED queued blockId=${finalBlock.id}`);
  } catch (e) {
    console.error('[TelegramLifecycle] BLOCK_STOPPED failed:', e.message);
  }

  try { invalidateSuggestionsCache(userId); } catch {}

  await checkAndTriggerRecovery(userId, dayKey);

  return computeBlockState(finalBlock);
}

// ── FETCH ─────────────────────────────────────────────────────────────────────

export async function getBlocksForDay(userId = DEFAULT_USER, dayKey) {
  const normalizedUid = String(userId || '').toLowerCase().trim();
  console.log(`[Schedule] Today's blocks loaded for user: ${normalizedUid}, day: ${dayKey}`);

  const { rows } = await criticalQuery(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND day_key = $2
     ORDER BY planned_start ASC, created_at ASC, id ASC`,
    [normalizedUid, dayKey]
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
  const { rows } = await criticalQuery(
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
  if (!Array.isArray(gasBlocks) || !gasBlocks.length) return { mergedCount: 0, doneCount: 0, plannedCount: 0 };

  // --- LAYER 1: Deduplicate incoming GAS blocks ---
  const uniqueGasMap = new Map();
  for (const b of gasBlocks) {
    const pStart = b.Start || b.PlannedStart || '';
    const normSubj = (b.Subject || b.PlannedSubject || '').trim().toLowerCase();
    const logicalId = `${pStart}_${normSubj}`;
    
    const rawStatus = String(b.Status || b.status || b.CompletionStatus || b.completionStatus || b['✅ Done'] || b.Done || '').trim().toUpperCase();
    const isDone = rawStatus.includes('DONE') || rawStatus.includes('COMPLETED') || rawStatus.includes('COMPLETE') || rawStatus === '✅ DONE' || rawStatus === '✅DONE';
    const isMissed = rawStatus === 'MISSED' || rawStatus === 'SKIPPED';
    const incomingStatus = isDone ? 'completed' : isMissed ? 'missed' : 'planned';
    
    // Parse planned minutes safely
    let pMinsRaw = b.Minutes || b.PlannedMinutes || b.planned_minutes || b.plannedMinutes;
    const plannedMins = isNaN(Number(pMinsRaw)) ? 0 : Number(pMinsRaw);
    
    // Parse actual minutes from various possible keys
    let aMinsRaw = b.ActualMinutes || b.actual_minutes || b.actualMinutes || b.done_minutes || b.doneMinutes || b.completed_minutes || b.completedMinutes || b.Actual || b['Done Minutes'] || b['Minutes Done'] || b['Duration Done'] || b['Studied Minutes'];
    
    let parsedActual = 0;
    if (typeof aMinsRaw === 'string') {
       // Extract number from strings like "135m", "2h 15m", "301 min"
       aMinsRaw = aMinsRaw.toLowerCase();
       if (aMinsRaw.includes('h')) {
           const match = aMinsRaw.match(/(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/);
           if (match) {
               parsedActual = (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
           }
       } else {
           const match = aMinsRaw.match(/(\d+)/);
           if (match) parsedActual = parseInt(match[1]);
       }
    } else if (!isNaN(Number(aMinsRaw))) {
       parsedActual = Number(aMinsRaw);
    }
    
    const incomingActualMins = incomingStatus === 'completed' ? (parsedActual || plannedMins) : 0;
    
    b._parsedStatus = incomingStatus;
    b._parsedMins = incomingActualMins;
    b._plannedMins = plannedMins;
    
    if (!uniqueGasMap.has(logicalId)) {
      uniqueGasMap.set(logicalId, b);
      continue;
    }
    
    const existing = uniqueGasMap.get(logicalId);
    const existingIsDone = existing._parsedStatus === 'completed';
    const currentIsDone = incomingStatus === 'completed';
    
    if (currentIsDone && incomingActualMins > 0 && (!existingIsDone || existing._parsedMins === 0)) {
      uniqueGasMap.set(logicalId, b);
    } else if (existingIsDone && existing._parsedMins > 0 && (!currentIsDone || incomingActualMins === 0)) {
      continue;
    } else if (incomingActualMins > existing._parsedMins) {
      uniqueGasMap.set(logicalId, b);
    } else if (existing._parsedMins > incomingActualMins) {
      continue;
    } else if (currentIsDone && !existingIsDone) {
      uniqueGasMap.set(logicalId, b);
    }
  }
  
  const deduplicatedGasBlocks = Array.from(uniqueGasMap.values())
    .sort((a, b) => (a.BlockId || '').localeCompare(b.BlockId || ''));
  let doneCount = 0;
  let plannedCount = 0;

  // Upsert all schedule metadata in one round-trip (ensures rows exist)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const b of deduplicatedGasBlocks) {
      const pStart = b.Start || b.PlannedStart || '';
      const normSubj = (b.Subject || b.PlannedSubject || '').trim().toLowerCase();
      
      let dbRow = null;
      
      // 1. Try finding by logical identity
      const { rows: logicalRows } = await client.query(
        `SELECT id, status, actual_minutes FROM study_blocks WHERE user_id=$1 AND day_key=$2 AND planned_start=$3 AND lower(subject)=$4`,
        [userId, dayKey, pStart, normSubj]
      );
      
      if (logicalRows.length > 0) {
        dbRow = logicalRows[0];
      } else if (b.BlockId) {
        // 2. Fallback to block_id
        const { rows: fallbackRows } = await client.query(
          `SELECT id, status, actual_minutes FROM study_blocks WHERE user_id=$1 AND block_id=$2 AND day_key=$3`,
          [userId, b.BlockId, dayKey]
        );
        if (fallbackRows.length > 0) dbRow = fallbackRows[0];
      }
      
      const incomingStatus = b._parsedStatus;
      const incomingActualMins = b._parsedMins;
      const plannedMins = b._plannedMins;
      
      if (dbRow) {
         // Already exists logic tracking for counts
         if (dbRow.status === 'planned' && incomingStatus !== 'planned') {
            if (incomingStatus === 'completed') {
                await client.query(
                   `INSERT INTO public.block_logs (block_id, user_id, started_at, ended_at, actual_minutes, completion_status)
                    VALUES ($1, $2, NOW(), NOW(), $3, 'completed')`,
                   [dbRow.id, userId, incomingActualMins]
                );
                try {
                  const { logStudyEvent } = await import('./eventService.js');
                  await logStudyEvent({
                    userId,
                    eventType: 'BLOCK_COMPLETED',
                    subject: b.Subject || b.PlannedSubject || '',
                    topic: b.Topic || b.PlannedTopic || '',
                    syllabusNodeId: null,
                    blockId: dbRow.id,
                    metadata: { actual_minutes: incomingActualMins, completion_status: 'completed' }, client
                  });
                } catch(e) {}
            }
         }
      }
      
      const res = await client.query(
        `INSERT INTO study_blocks
           (user_id, block_id, day_key, title, subject, topic,
            planned_start, planned_end, planned_minutes, status, actual_minutes, completed_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $10='completed' THEN NOW() ELSE NULL END, CASE WHEN $10='completed' THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, block_id, day_key) DO UPDATE SET
           title           = EXCLUDED.title,
           subject         = EXCLUDED.subject,
           topic           = EXCLUDED.topic,
           planned_start   = EXCLUDED.planned_start,
           planned_end     = EXCLUDED.planned_end,
           planned_minutes = EXCLUDED.planned_minutes,
           status          = CASE WHEN study_blocks.status = 'planned' AND EXCLUDED.status != 'planned' THEN EXCLUDED.status ELSE study_blocks.status END,
           actual_minutes  = CASE WHEN study_blocks.status = 'planned' AND EXCLUDED.status != 'planned' THEN EXCLUDED.actual_minutes ELSE study_blocks.actual_minutes END,
           completed_at    = CASE WHEN study_blocks.status = 'planned' AND EXCLUDED.status = 'completed' THEN NOW() ELSE study_blocks.completed_at END,
           ended_at        = CASE WHEN study_blocks.status = 'planned' AND EXCLUDED.status != 'planned' THEN NOW() ELSE study_blocks.ended_at END,
           updated_at      = NOW()
         RETURNING id, subject, topic, node_id, status`,
        [
          userId, b.BlockId, dayKey,
          b.Subject || b.PlannedSubject || '',
          b.Subject || b.PlannedSubject || '',
          b.Topic   || b.PlannedTopic  || '',
          b.Start   || b.PlannedStart  || '',
          b.End     || b.PlannedEnd    || '',
          plannedMins,
          incomingStatus,
          incomingActualMins
        ]
      );
      
      if (!dbRow && incomingStatus === 'completed') {
          await client.query(
             `INSERT INTO public.block_logs (block_id, user_id, started_at, ended_at, actual_minutes, completion_status)
              VALUES ($1, $2, NOW(), NOW(), $3, 'completed')`,
             [res.rows[0].id, userId, incomingActualMins]
          );
          try {
            const { logStudyEvent } = await import('./eventService.js');
            await logStudyEvent({
              userId,
              eventType: 'BLOCK_COMPLETED',
              subject: res.rows[0].subject,
              topic: res.rows[0].topic,
              syllabusNodeId: res.rows[0].node_id,
              blockId: res.rows[0].id,
              metadata: { actual_minutes: incomingActualMins, completion_status: 'completed' }, client
            });
          } catch(e) {}
      }
      if (incomingStatus === 'completed') doneCount++;
      else plannedCount++;
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
  const blockIds = gasBlocks.map((b) => b.BlockId).filter(Boolean);
  if (!blockIds.length) return gasBlocks;

  const normalizedUid = String(userId || '').toLowerCase().trim();
  const { rows: dbRows } = await pool.query(
    `SELECT * FROM study_blocks
     WHERE user_id = $1 AND day_key = $2 AND block_id = ANY($3)`,
    [normalizedUid, dayKey, blockIds]
  );

  // Index by block_id for O(1) merge
  const dbMap = {};
  for (const row of dbRows) {
    dbMap[row.block_id] = row;
  }

  // Merge: GAS provides schedule fields; PostgreSQL overrides lifecycle fields
  const finalBlocks = gasBlocks.map((gasBlock) => {
    const dbRow = dbMap[gasBlock.BlockId];
    if (dbRow) {
      return toFrontendBlock(dbRow, gasBlock);
    }
    return gasBlock;
  });
  
  finalBlocks._stats = {
    mergedCount: deduplicatedGasBlocks.length,
    doneCount,
    plannedCount
  };
  
  await checkAndTriggerRecovery(userId, dayKey);

  return finalBlocks;
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
  console.log(`[Plan Upload] Today's plan upload starting for user: ${userId}, date: ${date}, block count: ${items.length}`);
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

    // Trigger Telegram notification for PLAN_ACCEPTED_SUMMARY (Morning Pre-Block Recall)
    try {
      const { generateMorningRecallMessage } = await import('./mentorReviewService.js');
      const { sendNotification } = await import('./notificationService.js');

      const messageText = await generateMorningRecallMessage(userId, date);

      await sendNotification(
        userId,
        'PLAN_ACCEPTED_SUMMARY',
        'study_events',
        `plan_summary_${date}`,
        messageText,
        { date }
      );
    } catch (notifyErr) {
      console.error('[savePlanBlocks] Failed to send morning recall notification:', notifyErr.message);
    }

    console.log(`[Plan Upload] Today's plan successfully uploaded and saved for user: ${userId}, date: ${date}`);
    


    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[savePlanBlocksAndLogEvents] Transaction failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export function getISTDateTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  const dayKey = ist.toISOString().slice(0, 10);
  const timeStr = ist.toISOString().slice(11, 16);
  return { dayKey, timeStr, date: ist };
}

export async function resolveActiveBlock(userId) {
  const normalizedUid = String(userId || '').toLowerCase().trim();
  
  // 1. Check for any block with status active or paused (Pure SELECT query)
  const { rows: activeRows } = await pool.query(
    `SELECT id, block_id, subject, topic, started_at, planned_minutes, status, planned_start, planned_end, day_key, syllabus_node_id as node_id
     FROM public.study_blocks
     WHERE user_id = $1 AND status IN ('active', 'paused')
     ORDER BY started_at DESC
     LIMIT 1`,
    [normalizedUid]
  );
  
  if (activeRows.length > 0) {
    console.log(`[Current Block] Found active/paused block in DB: ${activeRows[0].subject} (${activeRows[0].block_id}) for user: ${normalizedUid}`);
    return activeRows[0];
  }
  
  console.log(`[Current Block] No active study block found for user: ${normalizedUid}`);
  return null;
}

export async function activateTimeMatchingBlock(userId) {
  if (process.env.ENABLE_AUTO_START_BLOCKS !== 'true') {
    return null;
  }
  const normalizedUid = String(userId || '').toLowerCase().trim();
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Acquire a transaction-level advisory lock on the user ID to serialize updates for this user
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [normalizedUid]);
    
    // 1. Check if there's already an active/paused block
    const { rows: activeRows } = await client.query(
      `SELECT id FROM public.study_blocks
       WHERE user_id = $1 AND status IN ('active', 'paused')
       LIMIT 1`,
      [normalizedUid]
    );
    
    if (activeRows.length > 0) {
      await client.query('COMMIT');
      return null; // A block is already active/paused, do not auto-start another
    }
    
    // 2. If no explicitly active/paused block, check for time-matching planned/upcoming block
    const { dayKey, timeStr } = getISTDateTime();
    const { rows: plannedRows } = await client.query(
      `SELECT id, block_id, subject, topic, started_at, planned_minutes, status, planned_start, planned_end, day_key, syllabus_node_id as node_id
       FROM public.study_blocks
       WHERE user_id = $1 
         AND day_key = $2 
         AND status IN ('planned', 'upcoming')
         AND planned_start <= $3 
         AND planned_end >= $3
       ORDER BY planned_start ASC
       LIMIT 1`,
      [normalizedUid, dayKey, timeStr]
    );
    
    if (plannedRows.length > 0) {
      const targetBlock = plannedRows[0];
      console.log(`[Current Block] Auto-activation triggered. Found planned block for user ${normalizedUid} covering time ${timeStr}: ${targetBlock.subject} (${targetBlock.block_id})`);
      
      const { rows: updatedRows } = await client.query(
        `UPDATE public.study_blocks
         SET status = 'active',
             started_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, block_id, subject, topic, started_at, planned_minutes, status, planned_start, planned_end, day_key, syllabus_node_id as node_id`,
        [targetBlock.id]
      );
      
      await client.query('COMMIT');
      
      if (updatedRows.length > 0) {
        const activeBlock = updatedRows[0];
        // Log BLOCK_STARTED event for analytics/logs
        try {
          const { logStudyEvent } = await import('./eventService.js');
          await logStudyEvent({
            userId: normalizedUid,
            eventType: 'BLOCK_STARTED',
            subject: activeBlock.subject,
            topic: activeBlock.topic,
            syllabusNodeId: activeBlock.node_id,
            blockId: activeBlock.id,
            metadata: { auto_started: true }
          });
        } catch (e) {
          console.error('[blockLifecycle] Auto-start event log failed:', e.message);
        }
        
        // Send Telegram notification
        try {
          const isTestRequest = (activeBlock.block_id && activeBlock.block_id.startsWith('volume_survival_test_block_')) || activeBlock.is_test_data === true;
          const { sendNotification } = await import('./notificationService.js');
          await sendNotification(
            normalizedUid,
            'BLOCK_STARTED',
            'study_block',
            activeBlock.id,
            `🚀 *Block Started*\n\nSubject: ${activeBlock.subject || 'Block'}\nTarget: ${activeBlock.planned_minutes || 0}m\n\nFocus: create output, not just reading.`,
            { isTestData: isTestRequest }
          );
        } catch (e) {
          console.error('[TelegramLifecycle] Auto-start Telegram failed:', e.message);
        }
        
        return activeBlock;
      }
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[activateTimeMatchingBlock] Transaction failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
  return null;
}

// ── ATTACH PROOF ──────────────────────────────────────────────────────────────
export async function attachBlockProof(userId = DEFAULT_USER, blockId, dayKey, { proofUrl, proofType = 'image', proofNotes = '', verificationStatus = 'verified' } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM study_blocks WHERE user_id = $1 AND block_id = $2 AND day_key = $3 FOR UPDATE`,
      [userId, blockId, dayKey]
    );
    if (!rows.length) {
      throw new Error(`Block ${blockId} not found`);
    }
    const block = rows[0];
    const status = verificationStatus || (proofType === 'none' ? 'waived' : 'verified');

    const { rows: updated } = await client.query(
      `UPDATE study_blocks
       SET proof_url = $1, proof_type = $2, proof_uploaded_at = NOW(), proof_verification_status = $3, proof_notes = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [proofUrl || null, proofType, status, proofNotes || null, block.id]
    );

    await client.query(
      `INSERT INTO public.study_block_proofs (user_id, block_id, proof_url, proof_type, proof_notes, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, block.id, proofUrl || null, proofType, proofNotes || null, status]
    );

    await client.query('COMMIT');
    return computeBlockState(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
