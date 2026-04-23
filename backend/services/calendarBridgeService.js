// backend/services/calendarBridgeService.js
// Sends block lifecycle events to Google Calendar via the existing Apps Script bridge.
//
// Architecture:
//   Backend (this file) → POST to SCRIPT_URL → Apps Script handles calendar.upsert
//   Apps Script returns { ok, calendarEventId, calendarHtmlLink }
//   We store the event ID in study_blocks.calendar_event_id
//
// Calendar failures NEVER roll back the DB lifecycle change.
// The caller must fire this as fire-and-forget (don't await or catch in the route).
//
// Apps Script setup: add the handler from docs/gas_calendar_handler.js to your
// Google Apps Script project.

import { pool } from '../db/index.js';

const SCRIPT_URL   = () => String(process.env.SCRIPT_URL || '').trim();
const TIMEOUT_MS   = 12_000;

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncBlockToCalendar(block, lifecycleAction) {
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

  // Build the event window: use actual timestamps if available, fall back to planned
  const startIso = block.started_at
    ? new Date(block.started_at).toISOString()
    : buildTimeIso(dayKey, block.planned_start || block.PlannedStart);

  const endIso = block.ended_at
    ? new Date(block.ended_at).toISOString()
    : buildTimeIso(dayKey, block.planned_end || block.PlannedEnd);

  const payload = {
    action:                  'upsert_calendar_event',
    userId,
    blockId,
    dayKey,
    title:                   buildEventTitle(block, lifecycleAction),
    description:             buildEventDescription(block, lifecycleAction),
    status:                  block.status,
    lifecycleAction,
    startTime:               startIso,
    endTime:                 endIso,
    calendarEventId:         block.calendar_event_id || null,
    notificationMinutesBefore: 0,   // mobile popup at event start
  };

  try {
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
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, raw: text }; }

    if (data?.ok && data?.calendarEventId) {
      await pool.query(
        `UPDATE study_blocks
         SET calendar_event_id    = $1,
             calendar_html_link   = $2,
             calendar_sync_status = 'synced',
             updated_at           = NOW()
         WHERE block_id = $3 AND user_id = $4 AND day_key = $5`,
        [data.calendarEventId, data.calendarHtmlLink || null, blockId, userId, dayKey]
      );
      console.log(`[calendarBridge] ✓ synced ${blockId} → ${data.calendarEventId}`);
      return { ok: true, calendarEventId: data.calendarEventId };
    }

    await markSyncFailed(blockId, userId, dayKey, 'script_error');
    console.warn('[calendarBridge] script returned not-ok:', JSON.stringify(data).slice(0, 300));
    return { ok: false, reason: 'script_error', data };

  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error(`[calendarBridge] ${reason}:`, err.message);
    await markSyncFailed(blockId, userId, dayKey, reason);
    return { ok: false, reason, error: err.message };
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

function buildTimeIso(dayKey, hhMm) {
  if (!dayKey || !hhMm) return new Date().toISOString();
  const [h, m] = String(hhMm).split(':').map(Number);
  const d = new Date(`${dayKey}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

function buildEventTitle(block, action) {
  const subject = block.subject || block.PlannedSubject || 'Study';
  const topic   = block.topic   || block.PlannedTopic   || '';
  const emoji   = { start: '▶', pause: '⏸', resume: '▶', complete: '✅' }[action] || '📚';
  return `${emoji} ${subject}${topic ? ': ' + topic : ''}`;
}

function buildEventDescription(block, action) {
  const mins = block.actualMinutes || block.ActualMinutes || 0;
  const pauses = block.pauses_count || block.PauseCount || 0;
  return [
    `Block: ${block.block_id || block.BlockId || '?'}`,
    `Status: ${block.status || action}`,
    mins  ? `Actual time: ${mins} min` : null,
    pauses ? `Pauses: ${pauses}` : null,
    `Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  ].filter(Boolean).join('\n');
}
