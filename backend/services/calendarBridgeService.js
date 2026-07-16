// backend/services/calendarBridgeService.js
// Sends block lifecycle events to Google Calendar via the existing Apps Script bridge.
//
// Architecture:
//   Backend (this file) → POST to SCRIPT_URL → Apps Script handles calendar sync
//   Apps Script supported actions:
//     startBlock, pauseBlock, resumeBlock, completeBlock  — lifecycle updates
//     syncCalendarFromBlocks                              — bulk calendar sync / retry
//     getBlocksForDate                                    — connectivity probe (read-only)
//
// Calendar failures NEVER roll back the DB lifecycle change.
// The caller must fire this as fire-and-forget (don't await or catch in the route).
//
// No Apps Script changes required — this service uses the existing deployed protocol.

import { pool } from '../db/index.js';

const SCRIPT_URL = () => String(process.env.SCRIPT_URL || '').trim();
const TIMEOUT_MS = 12_000;

// ── Lifecycle action map ──────────────────────────────────────────────────────
// Maps internal lifecycle action names → GAS action names supported by the
// deployed Apps Script doPost() handler.

const GAS_LIFECYCLE_ACTION = {
  start:    'startBlock',
  pause:    'pauseBlock',
  resume:   'resumeBlock',
  complete: 'completeBlock',
  // retry uses syncCalendarFromBlocks (bulk re-sync), handled separately below
};

// ── Low-level GAS POST helper ────────────────────────────────────────────────

async function callGas(scriptUrl, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = new URLSearchParams();
  body.set('data', JSON.stringify(payload));

  const r = await fetch(scriptUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal:  controller.signal,
  });
  clearTimeout(timer);

  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, raw: text }; }
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncBlockToCalendar(block, lifecycleAction, extraData = {}) {
  const scriptUrl = SCRIPT_URL();

  if (!scriptUrl) {
    console.warn('[calendarBridge] SCRIPT_URL not set — calendar sync skipped');
    return { ok: false, reason: 'no_script_url' };
  }

  if (!block?.block_id && !block?.BlockId) {
    console.warn('[calendarBridge] block missing block_id, skipping');
    return { ok: false, reason: 'no_block_id' };
  }

  const blockId = block.block_id || block.BlockId;
  const userId  = block.user_id  || process.env.DEFAULT_USER_ID || 'moulika';
  const dayKey  = block.day_key  || '';

  // ── Route: lifecycle actions → startBlock / pauseBlock / resumeBlock / completeBlock
  const gasAction = GAS_LIFECYCLE_ACTION[lifecycleAction];

  if (gasAction) {
    const getIsoString = (val) => {
      if (!val) return '';
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? '' : d.toISOString();
      } catch {
        return '';
      }
    };

    const actualStartVal = getIsoString(
      extraData.actualStart || block.actualStart || block.started_at || block.startedAt || block.startTimestamp || block.ActualStart
    );
    const actualEndVal = getIsoString(
      extraData.actualEnd || block.actualEnd || block.ended_at || block.endedAt || block.endTimestamp || block.ActualEnd
    );

    // Fail locally before callGas or fetch is invoked
    if (gasAction === 'startBlock' && !actualStartVal) {
      throw new Error(`startBlock: missing actualStart for block ${blockId}`);
    }
    if (gasAction === 'completeBlock' && !actualEndVal) {
      throw new Error(`completeBlock: missing actualEnd for block ${blockId}`);
    }

    // Payload format mirrors what proxyToGas sends for lifecycle actions.
    // Apps Script expects: { action, payload: { blockId, dayKey, ... }, userId }
    const payload = {
      action: gasAction,
      userId,
      blockId,
      payload: {
        blockId,
        dayKey,
        subject:        block.subject       || block.PlannedSubject || '',
        topic:          block.topic         || block.PlannedTopic   || '',
        plannedStart:   block.planned_start || block.PlannedStart   || '',
        plannedEnd:     block.planned_end   || block.PlannedEnd     || '',
        plannedMinutes: Number(block.planned_minutes || block.PlannedMinutes || 0),
        actualMinutes:  Number(block.actual_minutes  || block.ActualMinutes  || 0),
        status:         block.status || lifecycleAction,
      },
    };

    if (gasAction === 'startBlock') {
      payload.actualStart = actualStartVal;
      payload.payload.actualStart = actualStartVal;
    } else if (gasAction === 'completeBlock') {
      payload.actualEnd = actualEndVal;
      payload.payload.actualEnd = actualEndVal;
    }

    try {
      const data = await callGas(scriptUrl, payload);

      if (data?.ok !== false) {
        // GAS lifecycle actions don't return calendarEventId — they update Sheets/Calendar
        // internally. Mark as synced and optionally store any event ID returned.
        const updateFields = data?.calendarEventId
          ? `calendar_event_id = '${data.calendarEventId}', calendar_html_link = ${data.calendarHtmlLink ? `'${data.calendarHtmlLink}'` : 'NULL'}, calendar_sync_status = 'synced'`
          : `calendar_sync_status = 'synced'`;

        await pool.query(
          `UPDATE study_blocks
           SET ${updateFields}, updated_at = NOW()
           WHERE block_id = $1 AND user_id = $2 AND day_key = $3`,
          [blockId, userId, dayKey]
        );

        console.log(`[calendarBridge] ✓ ${gasAction} sent for ${blockId} (lifecycle: ${lifecycleAction})`);
        return { ok: true, gasAction, calendarEventId: data?.calendarEventId || null };
      }

      await markSyncFailed(blockId, userId, dayKey, 'script_error');
      const gasError = data?.error || data?.message || '(no error field)';
      console.warn(`[calendarBridge] GAS returned not-ok for ${gasAction} — gasError: "${gasError}" — response: ${JSON.stringify(data).slice(0, 300)}`);
      return { ok: false, reason: 'script_error', gasAction, gasError, data };

    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
      console.error(`[calendarBridge] ${reason} on ${gasAction}:`, err.message);
      await markSyncFailed(blockId, userId, dayKey, reason);
      return { ok: false, reason, gasAction, error: err.message };
    }
  }

  // ── Route: retry / unknown → syncCalendarFromBlocks ─────────────────────────
  // Used by retryFailedCalendarSyncs() and any unrecognised lifecycleAction.
  return syncBlocksToCalendar([block], userId, dayKey);
}

// ── Bulk calendar sync (syncCalendarFromBlocks) ───────────────────────────────
// Sends one or more blocks to the Apps Script syncCalendarFromBlocks action,
// which handles the full Google Calendar create/update logic on the GAS side.

export async function syncBlocksToCalendar(blocks, userId, dayKey) {
  const scriptUrl = SCRIPT_URL();
  if (!scriptUrl) {
    console.warn('[calendarBridge] SCRIPT_URL not set — bulk sync skipped');
    return { ok: false, reason: 'no_script_url' };
  }

  const payload = {
    action: 'syncCalendarFromBlocks',
    userId: userId || process.env.DEFAULT_USER_ID || 'moulika',
    date:   dayKey,
    blocks: blocks.map(b => ({
      blockId:        b.block_id      || b.BlockId        || '',
      dayKey:         b.day_key       || b.DayKey         || dayKey,
      subject:        b.subject       || b.PlannedSubject || '',
      topic:          b.topic         || b.PlannedTopic   || '',
      plannedStart:   b.planned_start || b.PlannedStart   || '',
      plannedEnd:     b.planned_end   || b.PlannedEnd     || '',
      plannedMinutes: Number(b.planned_minutes || b.PlannedMinutes || 0),
      actualMinutes:  Number(b.actual_minutes  || b.ActualMinutes  || 0),
      status:         b.status        || '',
      calendarEventId: b.calendar_event_id || null,
    })),
  };

  try {
    const data = await callGas(scriptUrl, payload);

    if (data?.ok !== false) {
      console.log(`[calendarBridge] ✓ syncCalendarFromBlocks sent for ${blocks.length} block(s) on ${dayKey}`);
      return { ok: true, gasAction: 'syncCalendarFromBlocks', count: blocks.length, data };
    }

    const gasError = data?.error || data?.message || '(no error field)';
    console.warn(`[calendarBridge] syncCalendarFromBlocks not-ok — gasError: "${gasError}"`);
    return { ok: false, reason: 'script_error', gasError, data };

  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error(`[calendarBridge] ${reason} on syncCalendarFromBlocks:`, err.message);
    return { ok: false, reason, error: err.message };
  }
}

// ── Diagnostic probe ──────────────────────────────────────────────────────────
// Tests the live GAS endpoint using getBlocksForDate (a known read-only action).
// Use GET /api/plan/blocks/verify-calendar-bridge to run this check.
// Returns a plain-language diagnosis without any side effects.

export async function probeCalendarBridge() {
  const scriptUrl = SCRIPT_URL();
  if (!scriptUrl) return { ok: false, reason: 'no_script_url', diagnosis: 'SCRIPT_URL env var is not set' };

  const today = new Date().toISOString().slice(0, 10);
  const probe = {
    action: 'getBlocksForDate',
    userId: process.env.DEFAULT_USER_ID || 'moulika',
    date:   today,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const body = new URLSearchParams();
    body.set('data', JSON.stringify(probe));

    const r = await fetch(scriptUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal:  controller.signal,
    });
    clearTimeout(timer);

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, raw: text }; }

    // getBlocksForDate returns { blocks: [...] } on success, or an error object
    const isUnknownAction = (data?.error || '').toLowerCase().includes('unknown action');
    const reachable = !isUnknownAction;

    return {
      ok:          reachable,
      reachable,
      gasAction:   'getBlocksForDate',
      gasResponse: data,
      supportedActions: ['saveScheduleBlocks', 'syncCalendarFromBlocks', 'startBlock',
                         'pauseBlock', 'resumeBlock', 'completeBlock', 'getBlocksForDate'],
      diagnosis:   reachable
        ? `GAS is reachable and responding. Protocol: lifecycle actions map to startBlock/pauseBlock/resumeBlock/completeBlock; calendar sync uses syncCalendarFromBlocks.`
        : `GAS returned: ${data?.error || 'unknown error'}`,
    };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, reason, error: err.message, diagnosis: `Could not reach GAS: ${err.message}` };
  }
}

// ── Retry failed syncs ────────────────────────────────────────────────────────

export async function retryFailedCalendarSyncs() {
  const { rows } = await pool.query(
    `SELECT * FROM study_blocks
     WHERE calendar_sync_status = 'failed'
     ORDER BY updated_at ASC
     LIMIT 20`
  );

  const results = [];
  for (const row of rows) {
    // Group retries by day to use syncCalendarFromBlocks (bulk)
    const action = row.ended_at ? 'complete' : row.status;
    const result = await syncBlockToCalendar(row, action);
    results.push({ block_id: row.block_id, ...result });
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function markSyncFailed(blockId, userId, dayKey, reason) {
  try {
    await pool.query(
      `UPDATE study_blocks
       SET calendar_sync_status = 'failed',
           updated_at = NOW()
       WHERE block_id = $1 AND user_id = $2 AND day_key = $3`,
      [blockId, userId, dayKey]
    );
  } catch (err) {
    console.error('[calendarBridge] markSyncFailed DB error:', err.message);
  }
}
