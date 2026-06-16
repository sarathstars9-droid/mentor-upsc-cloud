// backend/verify_recovery_wizard_production.mjs
import { query } from './db/index.js';
import * as behaviorEscalationService from './services/behaviorEscalationService.js';
import * as notificationService from './services/notificationService.js';
import * as psychologyMessageService from './services/psychologyMessageService.js';
import { handleCommand } from './services/botCommandService.js';

const USER_ID = 'moulika';
const todayKey = (() => {
  const d = new Date();
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
  console.log(`\n=== MentorOS 21+ Day Recovery & Wizard Production Verification ===`);
  console.log(`Target User: ${USER_ID}`);
  console.log(`Today's Key: ${todayKey}`);

  // 1. Backup Moulika's current state
  const originalUserRes = await query(
    `SELECT name, mission_health_state, consecutive_zero_study_days, consecutive_missed_plan_days,
            consecutive_ignored_reminder_days, recovery_day, recovery_score, 
            last_recovery_message_at, notification_count_today, last_notification_date,
            recovery_wizard_step, recovery_wizard_duration, recovery_wizard_subject
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
    // 2. Setup testing state: MISSION_FAILURE, 21 zero-study days
    await query(
      `UPDATE public.users 
       SET mission_health_state = 'MISSION_FAILURE',
           consecutive_zero_study_days = 21,
           consecutive_missed_plan_days = 21,
           consecutive_ignored_reminder_days = 0,
           recovery_day = 0,
           recovery_score = 5,
           last_recovery_message_at = NULL,
           notification_count_today = 0,
           last_notification_date = $2,
           recovery_wizard_step = 0,
           recovery_wizard_duration = NULL,
           recovery_wizard_subject = NULL
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

    // Clear today's study blocks & notification events for verification to start clean
    await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [USER_ID, todayKey]);
    await query(
      `DELETE FROM public.notification_events 
       WHERE user_id = $1 
         AND (source_id = $2 
              OR notification_type IN ('RECOVERY_NOTIFICATION', 'RECOVERY_INVITATION', 'RECOVERY_FOLLOWUP', 'RECOVERY_WEEKLY_CHECKIN'))`,
      [USER_ID, todayKey]
    );

    console.log(`\n[Step 1] Simulating 5 AM Recovery Invitation Trigger...`);
    await behaviorEscalationService.checkAndSendRecoveryInvitation(USER_ID);

    // Verify state transitioned to MISSION_RECOVERY
    const stateRes = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [USER_ID]);
    console.log(`   Health state is now: ${stateRes.rows[0].mission_health_state} (Expected: MISSION_RECOVERY)`);
    if (stateRes.rows[0].mission_health_state !== 'MISSION_RECOVERY') {
      throw new Error(`State did not transition to MISSION_RECOVERY`);
    }

    console.log(`\n[Step 2] Sending non-option command: "hi"...`);
    sentMessages.length = 0; // Clear history
    await handleCommand(USER_ID, '748656017', 'hi');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('🚨 MentorOS Recovery')) {
      throw new Error(`Invitation options not re-sent on random text`);
    }

    console.log(`\n[Step 3] Sending Option 2 (Overwhelmed)...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', '2');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('Then don\'t think about the entire UPSC syllabus.')) {
      throw new Error(`Incorrect coaching reply for Option 2`);
    }

    console.log(`\n[Step 4] Starting Recovery Wizard (Option 1)...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', '1');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('How long can you study today?')) {
      throw new Error(`Wizard duration prompt not received`);
    }

    console.log(`\n[Step 5] Inputting invalid duration...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', 'xyz');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('Please enter a valid duration')) {
      throw new Error(`Validation message not received`);
    }

    console.log(`\n[Step 6] Inputting valid duration option 2 (25m)...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', '2');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('Which subject will you study?')) {
      throw new Error(`Wizard subject prompt not received`);
    }

    console.log(`\n[Step 7] Inputting subject: Geography...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', 'Geography');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('I have created a 25-minute block for Geography today.')) {
      throw new Error(`Wizard block confirmation message not received`);
    }

    // Verify wizard step is 0 and block is created
    const postWizardUser = await query(`SELECT recovery_wizard_step, recovery_wizard_subject FROM public.users WHERE id = $1`, [USER_ID]);
    console.log(`   recovery_wizard_step is: ${postWizardUser.rows[0].recovery_wizard_step} (Expected: 0)`);
    console.log(`   recovery_wizard_subject is: ${postWizardUser.rows[0].recovery_wizard_subject} (Expected: Geography)`);
    if (postWizardUser.rows[0].recovery_wizard_step !== 0) {
      throw new Error(`Wizard step was not set to 0`);
    }

    const createdBlocks = await query(`SELECT block_id, subject, planned_minutes, status FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [USER_ID, todayKey]);
    console.log(`   Created blocks count: ${createdBlocks.rows.length} (Expected: 1)`);
    console.log(`   Block subject: ${createdBlocks.rows[0]?.subject} (Expected: Geography)`);
    console.log(`   Block planned_minutes: ${createdBlocks.rows[0]?.planned_minutes} (Expected: 25)`);
    if (createdBlocks.rows.length !== 1 || createdBlocks.rows[0].subject !== 'Geography') {
      throw new Error(`Study block was not correctly inserted`);
    }

    console.log(`\n[Step 8] Triggering Wizard Reset ("restart" command)...`);
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', 'restart');
    console.log(`   Message received:\n   "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);
    if (!sentMessages[0]?.text.includes('How long can you study today?')) {
      throw new Error(`Restart command did not trigger wizard reset`);
    }

    // Complete wizard again
    await handleCommand(USER_ID, '748656017', '2'); // 25 mins
    sentMessages.length = 0;
    await handleCommand(USER_ID, '748656017', 'Polity'); // Polity subject

    // Verify planned block for Polity exists now
    const polityBlocks = await query(`SELECT block_id, subject FROM public.study_blocks WHERE user_id = $1 AND day_key = $2 AND subject = 'Polity'`, [USER_ID, todayKey]);
    console.log(`   Polity block exists count: ${polityBlocks.rows.length} (Expected: 1)`);
    if (polityBlocks.rows.length !== 1) {
      throw new Error(`Polity block was not inserted on wizard re-completion`);
    }

    console.log(`\n[Step 9] Simulating block completion for Polity...`);
    // Update Polity block to completed
    await query(
      `UPDATE public.study_blocks 
       SET status = 'completed', actual_minutes = 25, ended_at = NOW() 
       WHERE user_id = $1 AND day_key = $2 AND subject = 'Polity'`,
      [USER_ID, todayKey]
    );

    // Run trigger recovery
    sentMessages.length = 0;
    await behaviorEscalationService.checkAndTriggerRecovery(USER_ID, todayKey);

    // Verify state transitioned to RECOVERY Day 1
    const endUser = await query(`SELECT mission_health_state, recovery_day, recovery_score FROM public.users WHERE id = $1`, [USER_ID]);
    console.log(`   Final state: ${endUser.rows[0].mission_health_state} (Expected: RECOVERY)`);
    console.log(`   Final recovery_day: ${endUser.rows[0].recovery_day} (Expected: 1)`);
    console.log(`   Final recovery_score: ${endUser.rows[0].recovery_score} (Expected: 40 - 60)`);
    console.log(`   Praise message sent: "${sentMessages[0]?.text.replace(/\n/g, ' | ')}"`);

    if (
      endUser.rows[0].mission_health_state !== 'RECOVERY' ||
      endUser.rows[0].recovery_day !== 1 ||
      endUser.rows[0].recovery_score < 40 ||
      endUser.rows[0].recovery_score > 60 ||
      !sentMessages[0]?.text.includes('✅ Recovery Day 1')
    ) {
      throw new Error(`Final user state or praise message is incorrect`);
    }

    console.log(`\n🎉 PRODUCTION VERIFICATION SUCCESSFUL! E2E RECOVERY WIZARD FLOW WORKS PERFECTLY.`);

  } catch (err) {
    console.error(`\n❌ PRODUCTION VERIFICATION FAILED:`, err.message);
    process.exit(1);
  } finally {
    // Restore Moulika's user row
    console.log(`\n[Step 10] Cleaning up and restoring user row...`);
    await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [USER_ID, todayKey]);
    await query(
      `DELETE FROM public.notification_events 
       WHERE user_id = $1 
         AND (source_id = $2 
              OR notification_type IN ('RECOVERY_NOTIFICATION', 'RECOVERY_INVITATION', 'RECOVERY_FOLLOWUP', 'RECOVERY_WEEKLY_CHECKIN'))`,
      [USER_ID, todayKey]
    );

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
           last_notification_date = $10,
           recovery_wizard_step = $11,
           recovery_wizard_duration = $12,
           recovery_wizard_subject = $13
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
        backup.last_notification_date,
        backup.recovery_wizard_step,
        backup.recovery_wizard_duration,
        backup.recovery_wizard_subject
      ]
    );

    console.log(`✅ Database successfully restored.`);
    console.log(`=== Verification Complete ===\n`);
  }
}

runVerification().catch(e => {
  console.error("Runner crashed:", e);
  process.exit(1);
});
