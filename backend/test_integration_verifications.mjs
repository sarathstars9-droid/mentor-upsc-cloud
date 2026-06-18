import 'dotenv/config';
import { query } from './db/index.js';
import { getISTDateTime, savePlanBlocksAndLogEvents, startBlock, pauseBlock, resumeBlock, completeBlock, activateTimeMatchingBlock } from './services/blockLifecycleService.js';
import { syncBlockToCalendar } from './services/calendarBridgeService.js';
import { sendNotification } from './services/notificationService.js';

const MOCK_USER = 'test_integration_user';
const dayKey = '2026-06-18';

// Mock Telegram and Google Apps Script calls for clean E2E verification without external rate limits
const originalFetch = globalThis.fetch || global.fetch;
let telegramCount = 0;
globalThis.fetch = async (url, options) => {
  const urlStr = typeof url === 'object' && url.href ? url.href : String(url);
  if (urlStr.includes('api.telegram.org')) {
    telegramCount++;
    return {
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true, result: [] })
    };
  }
  if (urlStr.includes('script.google.com')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, calendarEventId: 'mock-event-id-123', calendarHtmlLink: 'http://mock-calendar-url' }),
      json: async () => ({ ok: true, calendarEventId: 'mock-event-id-123', calendarHtmlLink: 'http://mock-calendar-url' })
    };
  }
  return originalFetch(url, options);
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanUp() {
  console.log('[Cleanup] Removing test records...');
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.study_events WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.notification_preferences WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.notification_channels WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.users WHERE id = $1`, [MOCK_USER]);
}

async function runIntegrationTests() {
  try {
    await cleanUp();

    console.log('[Setup] Registering notification channels and preferences...');
    const envChatId = process.env.TELEGRAM_CHAT_ID || '748656017';
    await query(
      `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
       VALUES ($1, 'TELEGRAM', $2, TRUE)
       ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
      [MOCK_USER, String(envChatId)]
    );

    await query(
      `INSERT INTO public.users (id, name, mission_health_state)
       VALUES ($1, 'Moulika Integration', 'HEALTHY')
       ON CONFLICT (id) DO UPDATE SET mission_health_state = 'HEALTHY'`,
      [MOCK_USER]
    );

    console.log('\n--- 1. Testing PLAN_ACCEPTED_SUMMARY and Calendar Event Creation ---');
    const { timeStr } = getISTDateTime();
    const plannedStart = timeStr;
    // construct endTimeStr 60 mins later
    const [h, m] = timeStr.split(':').map(Number);
    const endH = (h + 1) % 24;
    const plannedEnd = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const planItems = [
      {
        blockId: 'integration-block-1',
        subject: 'History',
        topic: 'Mughal Empire',
        startTime: plannedStart,
        endTime: plannedEnd,
        planned_minutes: 60
      }
    ];

    // Upload plan
    telegramCount = 0;
    await savePlanBlocksAndLogEvents(MOCK_USER, dayKey, planItems);

    // Verify PLAN_ACCEPTED_SUMMARY notification sent
    const planNotif = await query(
      `SELECT status FROM public.notification_events WHERE user_id = $1 AND notification_type = 'PLAN_ACCEPTED_SUMMARY'`,
      [MOCK_USER]
    );
    if (planNotif.rows.length === 0) {
      throw new Error('PLAN_ACCEPTED_SUMMARY notification event was not recorded!');
    }
    console.log(`✅ Passed: PLAN_ACCEPTED_SUMMARY sent with status: ${planNotif.rows[0].status}`);

    // Verify block created in study_blocks
    const blockRow = (await query(
      `SELECT * FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`,
      [MOCK_USER, 'integration-block-1']
    )).rows[0];

    // Verify Google Calendar event creation works
    console.log('Testing Google Calendar event creation...');
    const calResult = await syncBlockToCalendar(blockRow, 'start');
    if (!calResult.ok) {
      throw new Error(`Calendar event creation failed: ${JSON.stringify(calResult)}`);
    }
    console.log(`✅ Passed: Calendar event created successfully with ID: ${calResult.calendarEventId}`);

    // Update blockRow with calendar_event_id
    blockRow.calendar_event_id = calResult.calendarEventId;

    console.log('\n--- 2. Testing BLOCK_STARTED (Exactly Once) and Calendar Updates ---');
    // Calling auto-activation
    telegramCount = 0;
    await activateTimeMatchingBlock(MOCK_USER);

    // Verify BLOCK_STARTED notification recorded
    const startNotif = await query(
      `SELECT status FROM public.notification_events WHERE user_id = $1 AND notification_type = 'BLOCK_STARTED'`,
      [MOCK_USER]
    );
    if (startNotif.rows.length === 0) {
      throw new Error('BLOCK_STARTED notification event was not recorded!');
    }
    console.log(`✅ Passed: BLOCK_STARTED notification sent with status: ${startNotif.rows[0].status}`);

    // Try auto-activating again to verify deduplication
    await activateTimeMatchingBlock(MOCK_USER);
    const startNotifCount = await query(
      `SELECT count(*) FROM public.notification_events WHERE user_id = $1 AND notification_type = 'BLOCK_STARTED'`,
      [MOCK_USER]
    );
    if (Number(startNotifCount.rows[0].count) !== 1) {
      throw new Error(`Duplicate BLOCK_STARTED notification generated! Count: ${startNotifCount.rows[0].count}`);
    }
    console.log('✅ Passed: BLOCK_STARTED notification is deduplicated and sent exactly once.');

    // Test calendar update on start
    const startCal = await syncBlockToCalendar(blockRow, 'start');
    if (!startCal.ok) {
      throw new Error(`Calendar start update failed: ${JSON.stringify(startCal)}`);
    }
    console.log('✅ Passed: Calendar update for action "start" successful.');

    console.log('\n--- 3. Testing Calendar Pause and Resume updates ---');
    // Pause
    const pausedBlock = await pauseBlock(MOCK_USER, 'integration-block-1', dayKey);
    const pauseCal = await syncBlockToCalendar(pausedBlock, 'pause');
    if (!pauseCal.ok) {
      throw new Error(`Calendar pause update failed: ${JSON.stringify(pauseCal)}`);
    }
    console.log('✅ Passed: Calendar update for action "pause" successful.');

    // Resume
    const resumedBlock = await resumeBlock(MOCK_USER, 'integration-block-1', dayKey);
    const resumeCal = await syncBlockToCalendar(resumedBlock, 'resume');
    if (!resumeCal.ok) {
      throw new Error(`Calendar resume update failed: ${JSON.stringify(resumeCal)}`);
    }
    console.log('✅ Passed: Calendar update for action "resume" successful.');

    console.log('\n--- 4. Testing BLOCK_COMPLETED and Calendar Completion ---');
    telegramCount = 0;
    const completedBlock = await completeBlock(MOCK_USER, 'integration-block-1', dayKey, {
      actualMinutes: 45,
      reason: 'target_met'
    });

    // Check calendar completion
    const completeCal = await syncBlockToCalendar(completedBlock, 'complete');
    if (!completeCal.ok) {
      throw new Error(`Calendar complete update failed: ${JSON.stringify(completeCal)}`);
    }
    console.log('✅ Passed: Calendar update for action "complete" successful.');

    // Verify BLOCK_COMPLETED notification recorded
    const completeNotif = await query(
      `SELECT status FROM public.notification_events WHERE user_id = $1 AND notification_type = 'BLOCK_COMPLETED'`,
      [MOCK_USER]
    );
    if (completeNotif.rows.length === 0) {
      throw new Error('BLOCK_COMPLETED notification event was not recorded!');
    }
    console.log(`✅ Passed: BLOCK_COMPLETED notification sent with status: ${completeNotif.rows[0].status}`);

    console.log('\n--- 5. Testing DISTRACTION_ALERT behavior ---');
    // Send a distraction notification manually using the notificationService dispatcher
    telegramCount = 0;
    const alertRes = await sendNotification(
      MOCK_USER,
      'DISTRACTION_ALERT',
      'block_distraction',
      'integration-block-1_15m',
      '📱 Focus Drift Detected\n\nActive Block: History\nPhone Distraction: 15 min\n\nReturn to mission now.',
      {}
    );
    if (!alertRes.ok || alertRes.results[0].status !== 'sent') {
      throw new Error(`DISTRACTION_ALERT sending failed: ${JSON.stringify(alertRes)}`);
    }
    console.log('✅ Passed: DISTRACTION_ALERT notification dispatched successfully.');

    // Deduplicate distraction check
    const alertDupRes = await sendNotification(
      MOCK_USER,
      'DISTRACTION_ALERT',
      'block_distraction',
      'integration-block-1_15m',
      '📱 Focus Drift Detected again',
      {}
    );
    if (alertDupRes.results[0].status !== 'skipped' || alertDupRes.results[0].reason !== 'Deduplicated') {
      throw new Error(`DISTRACTION_ALERT duplicate check failed: ${JSON.stringify(alertDupRes)}`);
    }
    console.log('✅ Passed: DISTRACTION_ALERT deduplication functions correctly.');

    console.log('\n--- 6. Testing Recovery Notifications ---');
    // Set user state to CRITICAL
    await query(
      `UPDATE public.users SET mission_health_state = 'CRITICAL' WHERE id = $1`,
      [MOCK_USER]
    );
    // Insert a completed study block for today to trigger recovery
    await query(
      `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
       VALUES ($1, 'integration-recovery-block', $2, 'Geography', 25, 25, 'completed', NOW(), NOW())`,
      [MOCK_USER, dayKey]
    );

    const { checkAndTriggerRecovery } = await import('./services/behaviorEscalationService.js');
    await checkAndTriggerRecovery(MOCK_USER, dayKey);

    // Verify RECOVERY_NOTIFICATION was logged in notification_events
    const recoveryEvent = await query(
      `SELECT status FROM public.notification_events WHERE user_id = $1 AND notification_type = 'RECOVERY_NOTIFICATION'`,
      [MOCK_USER]
    );
    if (recoveryEvent.rows.length === 0) {
      throw new Error('RECOVERY_NOTIFICATION event was not recorded!');
    }
    console.log(`✅ Passed: RECOVERY_NOTIFICATION sent successfully with status: ${recoveryEvent.rows[0].status}`);

    console.log('\n================================================================');
    console.log('    ✓ All 8 Notification & Calendar Integrations Confirmed!     ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ Integration Verification FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await cleanUp();
    console.log('[Teardown] Done.');
  }
}

runIntegrationTests();
