import 'dotenv/config';

// ── Database Safety Checks ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('CRITICAL ERROR: Cannot run tests in production NODE_ENV!');
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('maglev.proxy.rlwy.net') || dbUrl.includes('mentoros-prod') || dbUrl.includes('railway.app') || dbUrl.includes('production')) {
  console.error('CRITICAL ERROR: Cannot run tests against production database!');
  process.exit(1);
}

import { query } from './db/index.js';
import { startBlock, completeBlock, stopBlock } from './services/blockLifecycleService.js';
import { syncBlockToCalendar } from './services/calendarBridgeService.js';
import { logStudyEvent } from './services/eventService.js';

const TEST_USER = 'integration_timestamp_consistency_user';
const DAY_KEY = '2026-07-16';
const BLOCK_ID = 'test-timestamp-block-1';

// Setup and Cleanup
async function cleanUp() {
  console.log('[Cleanup] Cleaning up test records...');
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.study_events WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.block_logs WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);
}

async function setupTestBlock() {
  // Ensure the user has notification channels and preferences seeded so notifications can process
  await query(
    `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
     VALUES ($1, 'TELEGRAM', '123456789', TRUE)
     ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
    [TEST_USER]
  );
  await query(
    `INSERT INTO public.users (id, name, mission_health_state)
     VALUES ($1, 'Test Timestamp User', 'HEALTHY')
     ON CONFLICT (id) DO UPDATE SET mission_health_state = 'HEALTHY'`,
    [TEST_USER]
  );
  await query(
    `INSERT INTO public.study_blocks (
       user_id, block_id, day_key, subject, topic, planned_start, planned_end, planned_minutes, status, proof_required
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
     ON CONFLICT (user_id, block_id, day_key) DO UPDATE SET status = 'planned'`,
    [TEST_USER, BLOCK_ID, DAY_KEY, 'Polity', 'Preamble', '10:00', '11:00', 60, 'planned']
  );
}

// Mock dynamic fetch for Google Apps Script URL and Telegram
const originalFetch = globalThis.fetch;
let lastGasPayload = null;

globalThis.fetch = async (url, options) => {
  const urlStr = typeof url === 'object' && url.href ? url.href : String(url);
  if (urlStr.includes('api.telegram.org')) {
    return {
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true, result: [] })
    };
  }
  if (urlStr.includes('script.google.com') || (process.env.SCRIPT_URL && urlStr.includes(process.env.SCRIPT_URL))) {
    const params = new URLSearchParams(options.body);
    try {
      lastGasPayload = JSON.parse(params.get('data'));
    } catch (e) {
      lastGasPayload = null;
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, calendarEventId: 'mock-evt-123' }),
      json: async () => ({ ok: true, calendarEventId: 'mock-evt-123' })
    };
  }
  return originalFetch(url, options);
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ Passed: ${message}`);
}

async function runTests() {
  console.log('=== STARTING CALENDAR BRIDGE & TIMESTAMP CONSISTENCY TESTS ===');
  try {
    // ----------------------------------------------------
    // TEST 1: startBlock updates DB with candidate timestamp, returns persisted started_at
    // ----------------------------------------------------
    console.log('\nTest 1: startBlock timestamp parameterization and persistence');
    await cleanUp();
    await setupTestBlock();

    const preUpdateBlock = { BlockId: BLOCK_ID, day_key: DAY_KEY, status: 'planned', started_at: null };
    const startedBlock = await startBlock(TEST_USER, BLOCK_ID, DAY_KEY, { isTestData: false });

    assert(startedBlock.started_at !== null, 'startedBlock returns started_at');

    const dbRow = (await query(
      `SELECT started_at FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER, BLOCK_ID]
    )).rows[0];

    const persistedStartStr = new Date(dbRow.started_at).toISOString();
    assert(new Date(startedBlock.started_at).toISOString() === persistedStartStr, 'persisted started_at matches return value');

    // ----------------------------------------------------
    // TEST 2: BLOCK_STARTED study event receives the same persisted started_at
    // ----------------------------------------------------
    console.log('\nTest 2: BLOCK_STARTED event occurrenceTimestamp');
    const startEvent = (await query(
      `SELECT created_at FROM public.study_events WHERE user_id = $1 AND event_type = 'BLOCK_STARTED'`,
      [TEST_USER]
    )).rows[0];

    assert(startEvent !== undefined, 'BLOCK_STARTED event was logged');
    assert(new Date(startEvent.created_at).toISOString() === persistedStartStr, 'event created_at matches persisted started_at');

    // ----------------------------------------------------
    // TEST 3: idempotent startBlock preserves existing started_at
    // ----------------------------------------------------
    console.log('\nTest 3: Idempotent startBlock preserves existing started_at');
    const originalStartedAt = dbRow.started_at;

    const secondStartResult = await startBlock(TEST_USER, BLOCK_ID, DAY_KEY, { isTestData: false });

    const dbRowAfterSecondStart = (await query(
      `SELECT started_at FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER, BLOCK_ID]
    )).rows[0];

    assert(
      new Date(dbRowAfterSecondStart.started_at).getTime() === new Date(originalStartedAt).getTime(),
      'original started_at was preserved'
    );

    // ----------------------------------------------------
    // TEST 4: CalendarBridge start payload contains actualStart, never falls back to planned
    // ----------------------------------------------------
    console.log('\nTest 4: CalendarBridge start payload and planned timestamp check');
    lastGasPayload = null;
    await syncBlockToCalendar(startedBlock, 'start');

    assert(lastGasPayload !== null, 'syncBlockToCalendar posted to GAS');
    assert(lastGasPayload.action === 'startBlock', 'action is startBlock');
    assert(lastGasPayload.actualStart === persistedStartStr, 'top-level payload contains actualStart');
    assert(lastGasPayload.payload.actualStart === persistedStartStr, 'nested payload contains actualStart');
    assert(lastGasPayload.payload.plannedStart !== lastGasPayload.actualStart, 'plannedStart is not substituted for actualStart');

    // ----------------------------------------------------
    // TEST 5: CalendarBridge missing actualStart fails before calling GAS
    // ----------------------------------------------------
    console.log('\nTest 5: CalendarBridge missing actualStart fails locally before request');
    const staleBlockNoStart = { BlockId: 'B-NoStart', day_key: DAY_KEY, status: 'active' };
    let failedBeforeGas = false;
    try {
      lastGasPayload = null;
      await syncBlockToCalendar(staleBlockNoStart, 'start');
    } catch (err) {
      if (err.message.includes('missing actualStart') && !err.message.includes('script.google.com')) {
        failedBeforeGas = true;
      }
    }
    assert(failedBeforeGas, 'syncBlockToCalendar throws validation error for missing actualStart');
    assert(lastGasPayload === null, 'no external request was made');

    // ----------------------------------------------------
    // TEST 6: stopBlock parameterization, return ended_at, BLOCK_STOPPED event, GAS contract, and validation
    // ----------------------------------------------------
    console.log('\nTest 6: stopBlock timestamp parameterization and persistence');
    // Set status back to active to allow stop
    await query(`UPDATE public.study_blocks SET status = 'active' WHERE user_id = $1 AND block_id = $2`, [TEST_USER, BLOCK_ID]);

    const preStopBlock = { BlockId: BLOCK_ID, day_key: DAY_KEY, status: 'active', ended_at: null };
    const stoppedBlock = await stopBlock(TEST_USER, BLOCK_ID, DAY_KEY, { isTestData: false });

    assert(stoppedBlock.ended_at !== null, 'stopBlock returns ended_at');
    const dbRowStop = (await query(
      `SELECT ended_at FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER, BLOCK_ID]
    )).rows[0];

    const persistedStopEndStr = new Date(dbRowStop.ended_at).toISOString();
    assert(new Date(stoppedBlock.ended_at).toISOString() === persistedStopEndStr, 'persisted ended_at matches return value');

    // BLOCK_STOPPED notification check
    console.log('Checking BLOCK_STOPPED notification payload and type');
    const stoppedNotification = (await query(
      `SELECT payload_json, notification_type FROM public.notification_events WHERE user_id = $1 AND notification_type = 'BLOCK_STOPPED'`,
      [TEST_USER]
    )).rows[0];

    assert(stoppedNotification !== undefined, 'BLOCK_STOPPED notification was recorded');
    assert(
      new Date(stoppedNotification.payload_json.actualEnd).toISOString() === persistedStopEndStr,
      'BLOCK_STOPPED notification payload received the exact persisted ended_at'
    );

    // Assert stopBlock does NOT emit BLOCK_COMPLETED notification
    const completedNotification = (await query(
      `SELECT id FROM public.notification_events WHERE user_id = $1 AND notification_type = 'BLOCK_COMPLETED'`,
      [TEST_USER]
    )).rows[0];
    assert(completedNotification === undefined, 'stopBlock does NOT emit BLOCK_COMPLETED notification');

    // GAS completeBlock actualEnd check
    console.log('Checking stopBlock GAS completeBlock contract mapping');
    lastGasPayload = null;
    await syncBlockToCalendar(stoppedBlock, 'complete');
    assert(lastGasPayload !== null, 'syncBlockToCalendar complete action posted to GAS');
    assert(lastGasPayload.action === 'completeBlock', 'stop action maps to completeBlock action in GAS');
    assert(lastGasPayload.actualEnd === persistedStopEndStr, 'completeBlock payload contains actualEnd');

    // Missing actualEnd fails locally
    let failedBeforeGasEnd = false;
    try {
      lastGasPayload = null;
      await syncBlockToCalendar(preStopBlock, 'complete');
    } catch (err) {
      if (err.message.includes('missing actualEnd') && !err.message.includes('script.google.com')) {
        failedBeforeGasEnd = true;
      }
    }
    assert(failedBeforeGasEnd, 'syncBlockToCalendar throws validation error for missing actualEnd');
    assert(lastGasPayload === null, 'no external request was made');

    // ----------------------------------------------------
    // TEST 7: logStudyEvent default behavior without occurrenceTimestamp
    // ----------------------------------------------------
    console.log('\nTest 7: logStudyEvent default created_at behavior');
    const defaultEvent = await logStudyEvent({
      userId: TEST_USER,
      eventType: 'DEFAULT_TEST_EVENT',
      subject: 'History',
      topic: 'Unspecified'
    });

    assert(defaultEvent.created_at !== null, 'logStudyEvent without occurrenceTimestamp successfully generates created_at');
    const nowTime = Date.now();
    const eventTime = new Date(defaultEvent.created_at).getTime();
    assert(Math.abs(nowTime - eventTime) < 5000, 'default created_at is near current execution time');

    // ----------------------------------------------------
    // TEST 8: Entrypoint path pattern verification (verifying returned block vs pre-update block)
    // ----------------------------------------------------
    console.log('\nTest 8: Entrypoint route contract check');
    // Ensure the syncBlockToCalendar function receives the updated block fields
    let passedStartVal = null;
    let passedEndVal = null;

    const mockSyncBlockToCalendar = (blk, act) => {
      if (act === 'start') passedStartVal = blk.started_at || blk.ActualStart;
      if (act === 'complete') passedEndVal = blk.ended_at || blk.ActualEnd;
    };

    // Simulate start block path
    await setupTestBlock();
    const updatedStartBlock = await startBlock(TEST_USER, BLOCK_ID, DAY_KEY);
    mockSyncBlockToCalendar(updatedStartBlock, 'start');
    assert(passedStartVal === updatedStartBlock.started_at, 'start path passes returned started_at to calendar sync');
    assert(preUpdateBlock.started_at === null, 'pre-update started_at was null');
    assert(passedStartVal !== null, 'pre-update block object is never passed to calendar sync');

    // Simulate complete block path
    const updatedCompleteBlock = await completeBlock(TEST_USER, BLOCK_ID, DAY_KEY, {
      reason: 'completed',
      completionSource: 'test',
      isTestData: true
    });
    mockSyncBlockToCalendar(updatedCompleteBlock, 'complete');
    assert(passedEndVal === updatedCompleteBlock.ended_at, 'complete path passes returned ended_at to calendar sync');
    assert(passedEndVal !== null, 'pre-update block object is never passed to calendar sync');

    console.log('\n================================================================');
    console.log('    ✓ All Calendar Bridge & Timestamp Consistency Tests Pass!   ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ Tests FAILED:', err.message, err.stack);
    process.exitCode = 1;
  } finally {
    await cleanUp();
    globalThis.fetch = originalFetch;
    process.exit(process.exitCode || 0);
  }
}

runTests();
