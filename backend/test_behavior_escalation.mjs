// backend/test_behavior_escalation.mjs
import { query } from './db/index.js';
import * as behaviorEscalationService from './services/behaviorEscalationService.js';
import { getDailyTargetMinutes } from './services/adaptiveGoalService.js';
import * as notificationService from './services/notificationService.js';
import * as blockLifecycleService from './services/blockLifecycleService.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';

const TEST_USER = 'test_user_escalation';

// Mock Telegram API requests to return success instantly and count messages
const originalFetch = globalThis.fetch || global.fetch;
let telegramMessageCount = 0;
globalThis.resetTelegramMessageCount = () => { telegramMessageCount = 0; };
globalThis.getTelegramMessageCount = () => telegramMessageCount;

const mockFetch = async (url, options) => {
  const urlStr = typeof url === 'object' && url.href ? url.href : String(url);
  if (urlStr.includes('api.telegram.org')) {
    telegramMessageCount++;
    return {
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true, result: [] })
    };
  }
  return originalFetch(url, options);
};

globalThis.fetch = mockFetch;
global.fetch = mockFetch;

async function setupTestData() {
  console.log('   Setting up test data...');
  // 1. Insert test user
  await query(
    `INSERT INTO public.users (id, name, mission_health_state, consecutive_zero_study_days, 
                              consecutive_missed_plan_days, consecutive_ignored_reminder_days, 
                              recovery_day, recovery_score, notification_count_today, last_notification_date, last_recovery_message_at)
     VALUES ($1, 'Test User', 'HEALTHY', 0, 0, 0, 0, 100, 0, '2026-06-16', NULL)
     ON CONFLICT (id) DO UPDATE SET 
       mission_health_state = 'HEALTHY',
       consecutive_zero_study_days = 0,
       consecutive_missed_plan_days = 0,
       consecutive_ignored_reminder_days = 0,
       recovery_day = 0,
       recovery_score = 100,
       notification_count_today = 0,
       last_notification_date = '2026-06-16',
       last_recovery_message_at = NULL`,
    [TEST_USER]
  );

  // 2. Insert subject target to allow progress calculations
  await query(
    `INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
     VALUES ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15')
     ON CONFLICT (user_id, subject) DO UPDATE SET
       target_hours = 800,
       mission_start_date = '2026-05-25',
       mission_end_date = '2027-04-15'`,
    [TEST_USER]
  );

  // 3. Clear study blocks & logs for test user
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.daily_mission_health_logs WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);

  // 4. Ensure notification channel exists
  await query(
    `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
     VALUES ($1, 'TELEGRAM', '123456789', TRUE)
     ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
    [TEST_USER]
  );
}

async function runTests() {
  console.log('🚀 Running Behavior Escalation Engine Tests...');

  // --- Setup ---
  await setupTestData();

  // ===========================================================================
  // TEST 1: Adaptive Goal Engine Targets
  // ===========================================================================
  console.log('\n[Test 1] Verifying Adaptive Goal Engine targets...');
  const defaultTarget = 600; // 10 hours
  assertEqual(getDailyTargetMinutes('HEALTHY', 0, defaultTarget), 600, 'HEALTHY target should be normal');
  assertEqual(getDailyTargetMinutes('SLIGHT_RISK', 0, defaultTarget), 600, 'SLIGHT_RISK target should be normal');
  assertEqual(getDailyTargetMinutes('AT_RISK', 0, defaultTarget), 75, 'AT_RISK target should be 75m');
  assertEqual(getDailyTargetMinutes('HIGH_RISK', 0, defaultTarget), 45, 'HIGH_RISK target should be 45m');
  assertEqual(getDailyTargetMinutes('CRITICAL', 0, defaultTarget), 25, 'CRITICAL target should be 25m');
  assertEqual(getDailyTargetMinutes('MISSION_FAILURE', 0, defaultTarget), 15, 'MISSION_FAILURE target should be 15m');
  
  // RECOVERY progression targets
  assertEqual(getDailyTargetMinutes('RECOVERY', 1, defaultTarget), 25, 'RECOVERY Day 1 target should be 25m');
  assertEqual(getDailyTargetMinutes('RECOVERY', 2, defaultTarget), 45, 'RECOVERY Day 2 target should be 45m');
  assertEqual(getDailyTargetMinutes('RECOVERY', 3, defaultTarget), 60, 'RECOVERY Day 3 target should be 60m');
  assertEqual(getDailyTargetMinutes('RECOVERY', 4, defaultTarget), 90, 'RECOVERY Day 4 target should be 90m');
  assertEqual(getDailyTargetMinutes('RECOVERY', 5, defaultTarget), 600, 'RECOVERY Day 5 target should return to default');

  // ===========================================================================
  // TEST 2: Daily Risk Analyzer State Transitions
  // ===========================================================================
  console.log('\n[Test 2] Verifying Daily Risk Analyzer Transitions...');

  // Case A: 0 missed days (yesterday user studied)
  // Create completed block yesterday
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b1', '2026-06-15', 'Geography Optional', 120, 120, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`,
    [TEST_USER]
  );
  let state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'HEALTHY', 'State after active yesterday should be HEALTHY');

  // Case B: 1 missed day (yesterday zero study)
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'SLIGHT_RISK', 'State after 1 zero-study day should be SLIGHT_RISK');

  // Case C: 3 consecutive missed days
  await query(
    `UPDATE public.users 
     SET consecutive_zero_study_days = 2, consecutive_missed_plan_days = 2 
     WHERE id = $1`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'AT_RISK', 'State after 3 zero-study days should be AT_RISK');

  // Case D: 7 consecutive missed days
  await query(
    `UPDATE public.users SET consecutive_zero_study_days = 6 WHERE id = $1`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'HIGH_RISK', 'State after 7 zero-study days should be HIGH_RISK');

  // Case E: 14 consecutive missed days
  await query(
    `UPDATE public.users SET consecutive_zero_study_days = 13 WHERE id = $1`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'CRITICAL', 'State after 14 zero-study days should be CRITICAL');

  // Case F: 21 consecutive missed days
  await query(
    `UPDATE public.users SET consecutive_zero_study_days = 20 WHERE id = $1`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'MISSION_FAILURE', 'State after 21 zero-study days should be MISSION_FAILURE');

  // ===========================================================================
  // TEST 3: Recovery Workflow and Progression
  // ===========================================================================
  console.log('\n[Test 3] Verifying Recovery Workflow & Progression...');

  // Set user to CRITICAL
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'CRITICAL', 
         consecutive_zero_study_days = 14, 
         last_recovery_message_at = NULL 
     WHERE id = $1`,
    [TEST_USER]
  );

  // Complete a block today (2026-06-16)
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b2', '2026-06-16', 'Geography Optional', 25, 25, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );

  // Trigger recovery check (this happens in blockLifecycleService on block completion)
  await behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, '2026-06-16');

  // Fetch state
  const recoveryUserRes = await query(`SELECT mission_health_state, recovery_day, recovery_score FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(recoveryUserRes.rows[0].mission_health_state, 'RECOVERY', 'Completing a study block under CRITICAL must transition user to RECOVERY');
  assertEqual(recoveryUserRes.rows[0].recovery_day, 1, 'First recovery day should be index 1');
  assertInRange(recoveryUserRes.rows[0].recovery_score, 40, 60, 'Initial recovery score on Day 1 (should be in [40, 60] range)');

  // Recovery Progression: Day 1 to Day 2
  // We simulate that yesterday (2026-06-16) they studied 25 mins while target was 25 mins.
  // Run daily analyzer for 2026-06-17.
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-17');
  assertEqual(state, 'RECOVERY', 'State should remain RECOVERY');
  const d2Res = await query(`SELECT recovery_day FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(d2Res.rows[0].recovery_day, 2, 'Successful Day 1 recovery must advance recovery_day to 2');

  // Recovery Progression: Day 2 to Day 3
  // Today is 2026-06-17. Target for Day 2 is 45 minutes. Insert block with 45 minutes actual.
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b3', '2026-06-17', 'Geography Optional', 45, 45, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-18');
  const d3Res = await query(`SELECT recovery_day FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(d3Res.rows[0].recovery_day, 3, 'Successful Day 2 recovery must advance recovery_day to 3');

  // Recovery Progression: Day 3 to Day 4 (Target: 60 mins)
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b4', '2026-06-18', 'Geography Optional', 60, 60, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-19');
  const d4Res = await query(`SELECT recovery_day FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(d4Res.rows[0].recovery_day, 4, 'Successful Day 3 recovery must advance recovery_day to 4');

  // Recovery Progression: Day 4 to Day 5 (Target: 90 mins)
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b5', '2026-06-19', 'Geography Optional', 90, 90, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );
  // Runs at 5 AM on 2026-06-20 (analyzes 2026-06-19)
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-20');
  assertEqual(state, 'HEALTHY', 'Completing 4 days of recovery should transition user state back to HEALTHY');
  const finalUserRes = await query(`SELECT recovery_day FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(finalUserRes.rows[0].recovery_day, 0, 'Recovery day should reset to 0 upon recovery completion');

  // ===========================================================================
  // TEST 4: Notification Fatigue Protection
  // ===========================================================================
  console.log('\n[Test 4] Verifying Notification Fatigue Protection...');

  // Reset to HEALTHY (Limit is 2 reminders)
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'HEALTHY', notification_count_today = 0, last_notification_date = '2026-06-16' 
     WHERE id = $1`,
    [TEST_USER]
  );

  // Mock sendNotification dispatches
  let r1 = await notificationService.sendNotification(TEST_USER, 'PLAN_NOT_UPLOADED', 'test', 's1', 'Hello 1');
  let r2 = await notificationService.sendNotification(TEST_USER, 'PLAN_NOT_STARTED', 'test', 's2', 'Hello 2');
  let r3 = await notificationService.sendNotification(TEST_USER, 'CURRENT_BLOCK_NOT_STARTED', 'test', 's3', 'Hello 3');

  assertEqual(r1.ok, true, 'First reminder should succeed');
  assertEqual(r2.ok, true, 'Second reminder should succeed');
  assertEqual(r3.ok, false, 'Third reminder should be blocked due to fatigue protection limit (2 for HEALTHY)');
  assertEqual(r3.reason, 'Fatigue protection limit reached', 'Blocked reason should be Fatigue protection limit reached');

  // Verify CRITICAL state fatigue limit (Limit is 4 reminders)
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'CRITICAL', notification_count_today = 0, last_notification_date = '2026-06-16' 
     WHERE id = $1`,
    [TEST_USER]
  );
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);

  let c1 = await notificationService.sendNotification(TEST_USER, 'PLAN_NOT_UPLOADED', 'test', 'c1', 'Critical 1');
  let c2 = await notificationService.sendNotification(TEST_USER, 'PLAN_NOT_STARTED', 'test', 'c2', 'Critical 2');
  let c3 = await notificationService.sendNotification(TEST_USER, 'CURRENT_BLOCK_NOT_STARTED', 'test', 'c3', 'Critical 3');
  let c4 = await notificationService.sendNotification(TEST_USER, 'BLOCK_PAUSED_TOO_LONG', 'test', 'c4', 'Critical 4');
  let c5 = await notificationService.sendNotification(TEST_USER, 'BLOCK_START_REMINDER', 'test', 'c5', 'Critical 5');

  assertEqual(c1.ok, true, 'First critical reminder should succeed');
  assertEqual(c2.ok, true, 'Second critical reminder should succeed');
  assertEqual(c3.ok, true, 'Third critical reminder should succeed');
  assertEqual(c4.ok, true, 'Fourth critical reminder should succeed');
  assertEqual(c5.ok, false, 'Fifth critical reminder should be blocked (Limit is 4 for CRITICAL)');

  // ===========================================================================
  // TEST 5: Recovery Score Mappings (All States)
  // ===========================================================================
  console.log('\n[Test 5] Verifying Recovery Score Mappings (All States & Ranges)...');
  
  const calc = behaviorEscalationService.calculateRecoveryScore;
  
  // Test HEALTHY range: 85 - 100
  assertInRange(calc('HEALTHY', 0, 1.0, 100.0), 85, 100, 'HEALTHY (100% consistency)');
  assertInRange(calc('HEALTHY', 0, 1.0, 0.0), 85, 100, 'HEALTHY (0% consistency)');
  
  // Test SLIGHT_RISK range: 70 - 84
  assertInRange(calc('SLIGHT_RISK', 0, 1.0, 100.0), 70, 84, 'SLIGHT_RISK (100% consistency)');
  assertInRange(calc('SLIGHT_RISK', 0, 1.0, 50.0), 70, 84, 'SLIGHT_RISK (50% consistency)');

  // Test AT_RISK range: 50 - 69
  assertInRange(calc('AT_RISK', 0, 1.0, 100.0), 50, 69, 'AT_RISK (100% consistency)');
  
  // Test HIGH_RISK range: 30 - 49
  assertInRange(calc('HIGH_RISK', 0, 1.0, 100.0), 30, 49, 'HIGH_RISK (100% consistency)');

  // Test CRITICAL range: 10 - 29
  assertInRange(calc('CRITICAL', 0, 1.0, 100.0), 10, 29, 'CRITICAL (100% consistency)');

  // Test MISSION_FAILURE range: 0 - 9
  assertInRange(calc('MISSION_FAILURE', 0, 1.0, 100.0), 0, 9, 'MISSION_FAILURE (100% consistency)');

  // Test RECOVERY Day 1 range: 40 - 60
  assertInRange(calc('RECOVERY', 1, 1.0, 100.0), 40, 60, 'RECOVERY Day 1 (100% performance)');
  assertInRange(calc('RECOVERY', 1, 0.0, 100.0), 40, 60, 'RECOVERY Day 1 (0% performance)');

  // Test RECOVERY Day 2 range: 50 - 65
  assertInRange(calc('RECOVERY', 2, 1.0, 100.0), 50, 65, 'RECOVERY Day 2 (100% performance)');

  // Test RECOVERY Day 3 range: 60 - 75
  assertInRange(calc('RECOVERY', 3, 1.0, 100.0), 60, 75, 'RECOVERY Day 3 (100% performance)');

  // Test RECOVERY Day 4 range: 70 - 85
  assertInRange(calc('RECOVERY', 4, 1.0, 100.0), 70, 85, 'RECOVERY Day 4 (100% performance)');

  // Test RECOVERY Day 5+ range: 80 - 95
  assertInRange(calc('RECOVERY', 5, 1.0, 100.0), 80, 95, 'RECOVERY Day 5+ (100% performance)');

  // ===========================================================================
  // TEST 6: Recovery Notification Idempotency & Deduplication
  // ===========================================================================
  console.log('\n[Test 6] Verifying Recovery Notification Idempotency & Deduplication...');
  
  // Reset user to CRITICAL
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'CRITICAL', 
         consecutive_zero_study_days = 14,
         recovery_day = 0,
         recovery_score = 20,
         last_recovery_message_at = NULL
     WHERE id = $1`,
    [TEST_USER]
  );
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);

  // Reset telegram message counter
  globalThis.resetTelegramMessageCount();

  // Insert 3 completed study blocks for today
  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES 
       ($1, 'b_idem_1', '2026-06-16', 'Geography Optional', 25, 25, 'completed', NOW(), NOW()),
       ($1, 'b_idem_2', '2026-06-16', 'Geography Optional', 25, 25, 'completed', NOW(), NOW()),
       ($1, 'b_idem_3', '2026-06-16', 'Geography Optional', 25, 25, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );

  // Simulate 3 concurrent/duplicate calls (like websocket events / offline sync replay / concurrent finish requests)
  await Promise.all([
    behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, '2026-06-16'),
    behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, '2026-06-16'),
    behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, '2026-06-16')
  ]);

  // Assert exactly 1 telegram message was sent
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Exactly ONE recovery notification sent under concurrent block completions');

  // Verify that the user state transitioned to RECOVERY
  const checkUser = await query(`SELECT mission_health_state, last_recovery_message_at FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(checkUser.rows[0].mission_health_state, 'RECOVERY', 'User state must be RECOVERY');
  if (!checkUser.rows[0].last_recovery_message_at) {
    console.error(`❌ FAILURE: last_recovery_message_at was not populated`);
    process.exit(1);
  } else {
    console.log(`   ✅ PASS: last_recovery_message_at is populated`);
  }

  // Verify notification_events count is exactly 1
  const checkEvent = await query(
    `SELECT count(*) as count FROM public.notification_events 
     WHERE user_id = $1 AND notification_type = 'RECOVERY_NOTIFICATION'`,
    [TEST_USER]
  );
  assertEqual(Number(checkEvent.rows[0].count), 1, 'Exactly ONE row in notification_events for RECOVERY_NOTIFICATION');

  // Simulate sequential calls on new blocks when user is already in RECOVERY
  // Reset message count
  globalThis.resetTelegramMessageCount();

  await query(
    `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
     VALUES ($1, 'b_idem_4', '2026-06-16', 'Geography Optional', 25, 25, 'completed', NOW(), NOW())`,
    [TEST_USER]
  );

  // Call checkAndTriggerRecovery again
  await behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, '2026-06-16');

  // Assert that NO further telegram message was sent
  assertEqual(globalThis.getTelegramMessageCount(), 0, 'No additional recovery notification sent for subsequent completed blocks while in RECOVERY');

  // Verify state remains RECOVERY
  const checkUserAfter = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(checkUserAfter.rows[0].mission_health_state, 'RECOVERY', 'User state remains RECOVERY');

  // ===========================================================================
  // TEST 7: 21+ Day Recovery System / Restart Mode & Wizard E2E
  // ===========================================================================
  console.log('\n[Test 7] Verifying 21+ Day Recovery System / Restart Mode & Wizard E2E...');
  
  const { handleCommand } = await import('./services/botCommandService.js');

  // A. Set user to MISSION_FAILURE due to 21 missed plan days
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'MISSION_FAILURE', 
         consecutive_zero_study_days = 0,
         consecutive_missed_plan_days = 20,
         recovery_day = 0,
         recovery_score = 10,
         recovery_wizard_step = 0,
         last_recovery_message_at = NULL
     WHERE id = $1`,
    [TEST_USER]
  );
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);
  globalThis.resetTelegramMessageCount();

  // Trigger daily analyzer - should return MISSION_RECOVERY because they studied 0 yesterday
  state = await behaviorEscalationService.analyzeDailyRisk(TEST_USER, '2026-06-16');
  assertEqual(state, 'MISSION_RECOVERY', 'analyzeDailyRisk transitions user to MISSION_RECOVERY when they are in MISSION_FAILURE and did not study yesterday');

  // Reset user to MISSION_FAILURE first to test the checker
  await query(
    `UPDATE public.users 
     SET mission_health_state = 'MISSION_FAILURE', 
         consecutive_zero_study_days = 21,
         consecutive_missed_plan_days = 21,
         recovery_day = 0,
         recovery_score = 10,
         recovery_wizard_step = 0,
         last_recovery_message_at = NULL
     WHERE id = $1`,
    [TEST_USER]
  );
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [TEST_USER]);
  globalThis.resetTelegramMessageCount();

  await behaviorEscalationService.checkAndSendRecoveryInvitation(TEST_USER);
  
  // Assert state is now MISSION_RECOVERY
  const stateCheck1 = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(stateCheck1.rows[0].mission_health_state, 'MISSION_RECOVERY', 'checkAndSendRecoveryInvitation transitions user to MISSION_RECOVERY');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Exactly one Recovery Invitation sent');

  // Call it again - should not send duplicate invitation
  await behaviorEscalationService.checkAndSendRecoveryInvitation(TEST_USER);
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Deduplication works for checkAndSendRecoveryInvitation');

  // B. Option responses coaching checks (Options 2-5)
  // Let's send non-option text, should repeat the invitation
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', 'random text');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Non-option text repeats the invitation');

  // Send Option 2
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', '2');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Option 2 response sent');

  // Send Option 5
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', '5');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Option 5 response sent');

  // C. Start Recovery Wizard (Option 1)
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', '1');
  
  // Check user state & step
  const wizardUser1 = await query(`SELECT mission_health_state, recovery_wizard_step FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(wizardUser1.rows[0].mission_health_state, 'RECOVERY_WIZARD', 'Option 1 transitions user to RECOVERY_WIZARD');
  assertEqual(wizardUser1.rows[0].recovery_wizard_step, 1, 'Wizard starts at step 1');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Duration choice prompt sent');

  // Submit invalid duration
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', 'invalid');
  const wizardUserInvalid = await query(`SELECT recovery_wizard_step FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(wizardUserInvalid.rows[0].recovery_wizard_step, 1, 'Wizard remains on step 1 for invalid duration');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Validation error prompt sent');

  // Submit valid duration (e.g. choose option 2 -> 25m)
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', '2');
  const wizardUser2 = await query(`SELECT recovery_wizard_step, recovery_wizard_duration FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(wizardUser2.rows[0].recovery_wizard_step, 2, 'Valid duration advances wizard to step 2');
  assertEqual(wizardUser2.rows[0].recovery_wizard_duration, 25, 'Duration set to 25m');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Subject choice prompt sent');

  // Submit valid subject (e.g. choose option 1 -> Geography)
  globalThis.resetTelegramMessageCount();
  const todayKey = new Date().toISOString().slice(0, 10);
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [TEST_USER, todayKey]);

  await handleCommand(TEST_USER, '123456789', '1');
  const wizardUser3 = await query(`SELECT mission_health_state, recovery_wizard_step, recovery_wizard_subject FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(wizardUser3.rows[0].mission_health_state, 'RECOVERY_WIZARD', 'Wizard finishes but remains in RECOVERY_WIZARD state');
  assertEqual(wizardUser3.rows[0].recovery_wizard_step, 0, 'Step is reset to 0');
  assertEqual(wizardUser3.rows[0].recovery_wizard_subject, 'Geography', 'Subject set to Geography');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Confirmation message sent');

  // Verify a planned block was inserted for today
  const blocksToday = await query(
    `SELECT block_id, subject, planned_minutes, status 
     FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`,
    [TEST_USER, todayKey]
  );
  assertEqual(blocksToday.rows.length, 1, 'One planned block created for today');
  assertEqual(blocksToday.rows[0].subject, 'Geography', 'Block subject is Geography');
  assertEqual(blocksToday.rows[0].planned_minutes, 25, 'Block duration is 25m');
  assertEqual(blocksToday.rows[0].status, 'planned', 'Block status is planned');

  // Test wizard reset (restart option from step 0)
  globalThis.resetTelegramMessageCount();
  await handleCommand(TEST_USER, '123456789', 'restart');
  const wizardResetUser = await query(`SELECT recovery_wizard_step FROM public.users WHERE id = $1`, [TEST_USER]);
  assertEqual(wizardResetUser.rows[0].recovery_wizard_step, 1, 'Wizard resets to step 1 upon restart command');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Duration prompt sent on reset');

  // Re-submit duration and subject to return to step 0
  await handleCommand(TEST_USER, '123456789', '2');
  await handleCommand(TEST_USER, '123456789', 'Polity');

  // D. Transition to RECOVERY Day 1 upon block completion
  // Mark the generated block as completed
  await query(
    `UPDATE public.study_blocks 
     SET status = 'completed', actual_minutes = 25, ended_at = NOW() 
     WHERE user_id = $1 AND day_key = $2`,
    [TEST_USER, todayKey]
  );

  globalThis.resetTelegramMessageCount();
  await behaviorEscalationService.checkAndTriggerRecovery(TEST_USER, todayKey);

  // Assert state transitions to RECOVERY Day 1
  const postRecoveryUser = await query(
    `SELECT mission_health_state, recovery_day, recovery_score FROM public.users WHERE id = $1`,
    [TEST_USER]
  );
  assertEqual(postRecoveryUser.rows[0].mission_health_state, 'RECOVERY', 'Completing wizard block transitions user to RECOVERY');
  assertEqual(postRecoveryUser.rows[0].recovery_day, 1, 'Recovery day is 1');
  assertInRange(postRecoveryUser.rows[0].recovery_score, 40, 60, 'Recovery Day 1 score is in [40, 60] range');
  assertEqual(globalThis.getTelegramMessageCount(), 1, 'Day 1 completion praise message sent');

  // Clean up
  await query(`DELETE FROM public.users WHERE id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.subject_targets WHERE user_id = $1`, [TEST_USER]);
  console.log('\n🎉 All tests passed successfully!');
  process.exit(0);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAILURE: ${message}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    process.exit(1);
  } else {
    console.log(`   ✅ PASS: ${message}`);
  }
}

function assertInRange(val, min, max, message) {
  if (val < min || val > max) {
    console.error(`❌ FAILURE: ${message}`);
    console.error(`   Expected value in range [${min}, ${max}], but got: ${val}`);
    process.exit(1);
  } else {
    console.log(`   ✅ PASS: ${message} (${val} is in range [${min}, ${max}])`);
  }
}

runTests().catch(err => {
  console.error('💥 Test execution failed:', err);
  process.exit(1);
});
