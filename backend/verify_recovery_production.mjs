// backend/verify_recovery_production.mjs
import { query } from './db/index.js';
import * as behaviorEscalationService from './services/behaviorEscalationService.js';
import * as notificationService from './services/notificationService.js';
import * as psychologyMessageService from './services/psychologyMessageService.js';

const USER_ID = 'moulika';
const todayKey = (() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
})();

const yesterdayKey = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
})();

// Intercept Telegram fetch calls
const originalFetch = globalThis.fetch || global.fetch;
const sentMessages = [];

globalThis.fetch = async (url, options) => {
  const urlStr = typeof url === 'object' && url.href ? url.href : String(url);
  if (urlStr.includes('api.telegram.org')) {
    try {
      const body = JSON.parse(options.body);
      sentMessages.push(body);
    } catch (e) {
      sentMessages.push({ rawUrl: urlStr });
    }
    return {
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true, result: [] })
    };
  }
  return originalFetch(url, options);
};
global.fetch = globalThis.fetch;

async function runVerification() {
  console.log(`\n=== MentorOS Behavior Escalation Production Verification ===`);
  console.log(`Target User: ${USER_ID}`);
  console.log(`Today's Key: ${todayKey}`);

  // 1. Backup Moulika's current state
  const originalUserRes = await query(
    `SELECT mission_health_state, consecutive_zero_study_days, consecutive_missed_plan_days,
            consecutive_ignored_reminder_days, recovery_day, recovery_score, 
            last_recovery_message_at, notification_count_today, last_notification_date 
     FROM public.users WHERE id = $1`,
    [USER_ID]
  );
  if (originalUserRes.rows.length === 0) {
    console.error(`❌ ERROR: User '${USER_ID}' not found in database. Cannot run verification.`);
    process.exit(1);
  }
  const backup = originalUserRes.rows[0];
  console.log(`✅ Backed up Moulika's user row:`, backup);

  try {
    // 2. Setup testing state: CRITICAL state, 14 zero-study days, no recovery message sent
    await query(
      `UPDATE public.users 
       SET mission_health_state = 'CRITICAL',
           consecutive_zero_study_days = 14,
           consecutive_missed_plan_days = 2,
           consecutive_ignored_reminder_days = 0,
           recovery_day = 0,
           recovery_score = 20,
           last_recovery_message_at = NULL,
           notification_count_today = 0,
           last_notification_date = $2
       WHERE id = $1`,
      [USER_ID, todayKey]
    );

    // Setup Telegram notification channel for Moulika if not present
    await query(
      `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
       VALUES ($1, 'TELEGRAM', '748656017', TRUE)
       ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
      [USER_ID]
    );

    // Clear today's study blocks & notification events for Moulika to start clean
    await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [USER_ID, todayKey]);
    await query(`DELETE FROM public.notification_events WHERE user_id = $1 AND (source_id = $2 OR notification_type = 'RECOVERY_NOTIFICATION')`, [USER_ID, todayKey]);

    // Ensure she has preferences for PLAN_NOT_UPLOADED
    await query(
      `INSERT INTO public.notification_preferences (user_id, notification_type, channel_type, is_enabled)
       VALUES ($1, 'PLAN_NOT_UPLOADED', 'TELEGRAM', TRUE)
       ON CONFLICT (user_id, notification_type, channel_type) DO UPDATE SET is_enabled = TRUE`,
      [USER_ID]
    );

    console.log(`\n[Step 1] Simulating 6 AM Plan Upload Reminder...`);
    // Check user state and send reminder
    const userRes = await query(`SELECT mission_health_state, recovery_day FROM public.users WHERE id = $1`, [USER_ID]);
    const state = userRes.rows[0].mission_health_state;
    const recoveryDay = userRes.rows[0].recovery_day;
    const text = psychologyMessageService.getPlanNotUploadedMessage(state, "Moulika", recoveryDay);

    console.log(`   Generated message text:\n------------------\n${text}\n------------------`);
    
    // Send 1st reminder
    await notificationService.sendNotification(USER_ID, 'PLAN_NOT_UPLOADED', 'daily_date', todayKey, text, {});
    // Simulate duplicate scheduler tick / execution
    await notificationService.sendNotification(USER_ID, 'PLAN_NOT_UPLOADED', 'daily_date', todayKey, text, {});

    console.log(`[Step 2] Completing five study blocks sequentially...`);
    for (let i = 1; i <= 5; i++) {
      const blockId = `v_block_${i}`;
      console.log(`   -> Completing block ${i} (25 mins)...`);
      // Insert completed study block
      await query(
        `INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, actual_minutes, status, started_at, ended_at)
         VALUES ($1, $2, $3, 'Geography Optional', 25, 25, 'completed', NOW(), NOW())`,
        [USER_ID, blockId, todayKey]
      );

      // Trigger recovery check (this gets called on block completion)
      await behaviorEscalationService.checkAndTriggerRecovery(USER_ID, todayKey);
    }

    console.log(`\n[Step 3] Verifying Sent Notifications...`);
    console.log(`   Total telegram messages intercepted: ${sentMessages.length}`);
    sentMessages.forEach((msg, idx) => {
      console.log(`   Message ${idx + 1}: [Chat ID: ${msg.chat_id}] "${msg.text.replace(/\n/g, ' | ')}"`);
    });

    const planReminders = sentMessages.filter(m => m.text.includes('PLAN NOT UPLOADED') || m.text.includes('CRITICAL RECOVERY MODE'));
    const recoveryMessages = sentMessages.filter(m => m.text.includes('The streak is broken') || m.text.includes('Protect tomorrow'));

    console.log(`\n=== Verification Results ===`);
    console.log(`   Plan Reminders sent: ${planReminders.length} (Expected: 1)`);
    console.log(`   Recovery Messages sent: ${recoveryMessages.length} (Expected: 1)`);

    if (planReminders.length === 1 && recoveryMessages.length === 1 && sentMessages.length === 2) {
      console.log(`\n🎉 SUCCESS: Exactly ONE recovery message and ONE plan upload reminder were sent. No duplicates!`);
    } else {
      console.error(`\n❌ FAILURE: Duplicate notifications detected or missing notifications.`);
      process.exit(1);
    }

  } catch (err) {
    console.error(`❌ Verification crashed:`, err);
    process.exit(1);
  } finally {
    // 4. Cleanup & Restore
    console.log(`\n[Step 4] Cleaning up verification rows and restoring Moulika's original state...`);
    await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2 AND block_id LIKE 'v_block_%'`, [USER_ID, todayKey]);
    await query(`DELETE FROM public.notification_events WHERE user_id = $1 AND (source_id = $2 OR notification_type = 'RECOVERY_NOTIFICATION')`, [USER_ID, todayKey]);
    
    // Restore user row
    await query(
      `UPDATE public.users 
       SET mission_health_state = $2,
           consecutive_zero_study_days = $3,
           consecutive_missed_plan_days = $4,
           consecutive_ignored_reminder_days = $5,
           recovery_day = $6,
           recovery_score = $7,
           last_recovery_message_at = $8,
           notification_count_today = $9,
           last_notification_date = $10
       WHERE id = $1`,
      [
        USER_ID,
        backup.mission_health_state,
        backup.consecutive_zero_study_days,
        backup.consecutive_missed_plan_days,
        backup.consecutive_ignored_reminder_days,
        backup.recovery_day,
        backup.recovery_score,
        backup.last_recovery_message_at,
        backup.notification_count_today,
        backup.last_notification_date
      ]
    );
    console.log(`✅ Moulika's user row successfully restored to original state.`);
    console.log(`=== Verification Complete ===\n`);
  }
}

runVerification().catch(e => {
  console.error("Runner crashed:", e);
  process.exit(1);
});
