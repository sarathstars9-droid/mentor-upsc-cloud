// backend/services/behaviorEscalationService.js
import { query, withTransaction } from '../db/index.js';
import { getDailyTargetMinutes } from './adaptiveGoalService.js';
import { logDailyHealthState } from './missionHealthLogService.js';
import * as telegramService from './telegramService.js';
import * as psychologyMessageService from './psychologyMessageService.js';

/**
 * Helper: Get yesterday's date key relative to todayKey.
 */
function getYesterdayKey(todayKey) {
  const d = new Date(`${todayKey}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Runs before 5 AM report. Re-calculates streaking, state transitions, backlog,
 * updates users table, and records log in daily_mission_health_logs.
 */
export async function analyzeDailyRisk(userId, todayKey) {
  console.log(`[BehaviorEscalation] Running analyzeDailyRisk for ${userId} on ${todayKey}...`);
  const yesterdayKey = getYesterdayKey(todayKey);

  // 1. Fetch current user behavioral metrics
  const userRes = await query(
    `SELECT mission_health_state, consecutive_zero_study_days, consecutive_missed_plan_days,
            consecutive_ignored_reminder_days, recovery_day, recovery_score 
     FROM public.users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0) {
    console.warn(`[BehaviorEscalation] User ${userId} not found in users table. Skipping risk analysis.`);
    return;
  }
  const user = userRes.rows[0];

  const oldState = user.mission_health_state || 'HEALTHY';
  let zeroStreak = user.consecutive_zero_study_days || 0;
  let missedPlanStreak = user.consecutive_missed_plan_days || 0;
  let ignoredReminderStreak = user.consecutive_ignored_reminder_days || 0;
  let recDay = user.recovery_day || 0;
  let recScore = user.recovery_score || 100;

  // 2. Fetch yesterday's actual minutes and block count
  const yesterdayBlocksRes = await query(
    `SELECT SUM(actual_minutes) as completed_mins, COUNT(*) as block_count 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2 AND status IN ('completed', 'partial')`,
    [userId, yesterdayKey]
  );
  const completedMinsYesterday = Number(yesterdayBlocksRes.rows[0]?.completed_mins || 0);

  const yesterdayTotalBlocksRes = await query(
    `SELECT COUNT(*) as total_blocks 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, yesterdayKey]
  );
  const hasPlanYesterday = Number(yesterdayTotalBlocksRes.rows[0]?.total_blocks || 0) > 0;

  // Check if reminders were sent yesterday
  const remindersYesterdayRes = await query(
    `SELECT COUNT(*) as count FROM public.notification_events 
     WHERE user_id = $1 AND source_id = $2 AND notification_type IN (
       'PLAN_NOT_UPLOADED', 'PLAN_NOT_STARTED', 'CURRENT_BLOCK_NOT_STARTED', 'BLOCK_PAUSED_TOO_LONG'
     ) AND status = 'sent'`,
    [userId, yesterdayKey]
  );
  const receivedRemindersYesterday = Number(remindersYesterdayRes.rows[0]?.count || 0) > 0;

  // 3. Update streaks based on yesterday's performance
  if (completedMinsYesterday > 0) {
    // Yesterday was active!
    zeroStreak = 0;
    missedPlanStreak = 0;
    ignoredReminderStreak = 0;

    if (oldState === 'RECOVERY') {
      // User is in RECOVERY state. Check if they met yesterday's recovery target
      // Standard target is ~10 hours = 600 mins.
      const yesterdayRecoveryTarget = getDailyTargetMinutes('RECOVERY', recDay, 600);
      if (completedMinsYesterday >= yesterdayRecoveryTarget) {
        recDay += 1;
        console.log(`[BehaviorEscalation] User ${userId} met recovery target (${yesterdayRecoveryTarget}m). Advancing recovery to Day ${recDay}`);
      } else {
        // Active but didn't meet full target
        console.log(`[BehaviorEscalation] User ${userId} studied but missed recovery target (${yesterdayRecoveryTarget}m). Remaining on Recovery Day ${recDay}`);
      }
    } else if (['HIGH_RISK', 'CRITICAL', 'MISSION_FAILURE'].includes(oldState)) {
      // User returns! Transition to RECOVERY state
      recDay = 1;
      console.log(`[BehaviorEscalation] User ${userId} returned from ${oldState}. Setting state to RECOVERY Day 1.`);
    }
  } else {
    // Yesterday was zero study
    zeroStreak += 1;
    if (hasPlanYesterday) {
      missedPlanStreak += 1;
    }
    if (receivedRemindersYesterday) {
      ignoredReminderStreak += 1;
    }

    if (oldState === 'RECOVERY') {
      // Yesterday was zero study, they broke recovery streak!
      recDay = 0;
      console.log(`[BehaviorEscalation] User ${userId} had a zero study day during RECOVERY. Recovery failed.`);
    }
  }

  // 4. Determine new state based on streaks
  let newState = oldState;
  if (oldState === 'RECOVERY' && completedMinsYesterday > 0) {
    if (recDay >= 5) {
      newState = 'HEALTHY';
      recDay = 0;
      console.log(`[BehaviorEscalation] User ${userId} completed RECOVERY successfully! Returning to HEALTHY.`);
    } else {
      newState = 'RECOVERY';
    }
  } else if (oldState === 'RECOVERY' && completedMinsYesterday === 0) {
    // Failed recovery, fall back to risk state
    newState = determineStateFromStreaks(zeroStreak, missedPlanStreak);
  } else if (['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(oldState)) {
    if (completedMinsYesterday > 0) {
      newState = 'RECOVERY';
      recDay = 1;
    } else {
      newState = 'MISSION_RECOVERY';
    }
  } else {
    // Standard state transition
    newState = determineStateFromStreaks(zeroStreak, missedPlanStreak);
  }

  if (newState !== oldState) {
    console.log(`[BehaviorEscalation STATE TRANSITION] User ${userId}: ${oldState} ➔ ${newState} (ZeroStreak: ${zeroStreak}, MissedPlanStreak: ${missedPlanStreak})`);
  }

  // 5. Calculate mission progress statistics
  const targetRes = await query(
    `SELECT MIN(mission_start_date) as start_date, MAX(mission_end_date) as end_date, SUM(target_hours) as total_target
     FROM public.subject_targets 
     WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  
  const startDateStr = targetRes.rows[0]?.start_date ? new Date(targetRes.rows[0].start_date).toISOString().slice(0, 10) : '2026-05-25';
  const endDateStr = targetRes.rows[0]?.end_date ? new Date(targetRes.rows[0].end_date).toISOString().slice(0, 10) : '2027-04-15';
  const totalTargetHours = Number(targetRes.rows[0]?.total_target || 3500);

  const missionStart = new Date(`${startDateStr}T00:00:00`);
  const yesterdayDate = new Date(`${yesterdayKey}T00:00:00`);
  const totalDays = Math.max(1, Math.round((new Date(`${endDateStr}T00:00:00`).getTime() - missionStart.getTime()) / (1000 * 60 * 60 * 24)));
  
  let elapsedDays = 0;
  if (yesterdayDate >= missionStart) {
    elapsedDays = Math.round((yesterdayDate.getTime() - missionStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const dailyExpectedMinutes = (totalTargetHours * 60) / totalDays;
  const expectedMinutesTillToday = Math.round(dailyExpectedMinutes * elapsedDays);

  const allCompletedRes = await query(
    `SELECT SUM(actual_minutes) as completed_mins 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key <= $2 AND status IN ('completed', 'partial')`,
    [userId, yesterdayKey]
  );
  const totalCompletedMinutes = Number(allCompletedRes.rows[0]?.completed_mins || 0);
  const backlogMinutes = Math.max(0, expectedMinutesTillToday - totalCompletedMinutes);

  const activeDaysRes = await query(
    `SELECT COUNT(DISTINCT day_key) as active_days 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3 AND status IN ('completed', 'partial') AND actual_minutes > 0`,
    [userId, startDateStr, yesterdayKey]
  );
  const activeDaysCount = Number(activeDaysRes.rows[0]?.active_days || 0);
  const baseConsistency = elapsedDays > 0 ? (activeDaysCount / elapsedDays) * 100 : 100.00;
  const penaltyFactor = Math.max(0, 1 - (zeroStreak / 21));
  const consistencyPercentage = Number((baseConsistency * penaltyFactor).toFixed(2));

  // Calculate dynamic recovery score
  let performanceRatio = 1.0;
  if (newState === 'RECOVERY') {
    let targetDay = user.recovery_day;
    if (['HIGH_RISK', 'CRITICAL', 'MISSION_FAILURE'].includes(oldState)) {
      targetDay = 1;
    }
    const yesterdayRecoveryTarget = getDailyTargetMinutes('RECOVERY', targetDay > 0 ? targetDay : 1, 600);
    performanceRatio = yesterdayRecoveryTarget > 0 ? (completedMinsYesterday / yesterdayRecoveryTarget) : 1.0;
  }
  recScore = calculateRecoveryScore(newState, recDay, performanceRatio, consistencyPercentage);

  // 6. Update user record in users table
  const updateQuery = `
    UPDATE public.users 
    SET mission_health_state = $2,
        consecutive_zero_study_days = $3,
        consecutive_missed_plan_days = $4,
        consecutive_ignored_reminder_days = $5,
        recovery_day = $6,
        recovery_score = $7,
        last_meaningful_study_date = CASE WHEN $8 > 0 THEN $9::date ELSE last_meaningful_study_date END,
        notification_count_today = 0, -- Reset notification count today
        last_escalation_at = NOW()
    WHERE id = $1
  `;
  await query(updateQuery, [
    userId,
    newState,
    zeroStreak,
    missedPlanStreak,
    ignoredReminderStreak,
    recDay,
    recScore,
    completedMinsYesterday,
    yesterdayKey
  ]);

  // 7. Log health state to daily_mission_health_logs
  await logDailyHealthState(
    userId,
    yesterdayKey,
    newState,
    completedMinsYesterday,
    Math.round(dailyExpectedMinutes),
    Math.round(backlogMinutes),
    consistencyPercentage,
    zeroStreak,
    missedPlanStreak,
    recScore
  );

  return newState;
}

/**
 * Determine the user health state based on streaks.
 */
function determineStateFromStreaks(zeroStreak, missedPlanStreak) {
  if (zeroStreak >= 21 || missedPlanStreak >= 21) return 'MISSION_FAILURE';
  if (zeroStreak >= 14) return 'CRITICAL';
  if (zeroStreak >= 7) return 'HIGH_RISK';
  if (zeroStreak >= 3 || missedPlanStreak >= 3) return 'AT_RISK';
  if (zeroStreak >= 1 || missedPlanStreak >= 1) return 'SLIGHT_RISK';
  return 'HEALTHY';
}

/**
 * Real-time trigger: checks if a user in severe risk state completes a study block.
 * If so, transition user to RECOVERY state and notify immediately.
 */
export async function checkAndTriggerRecovery(userId, dayKey) {
  try {
    const result = await withTransaction(async (client) => {
      // 1. Fetch user's current state with FOR UPDATE lock
      const userRes = await client.query(
        `SELECT mission_health_state, recovery_day, last_recovery_message_at 
         FROM public.users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userRes.rows.length === 0) return { triggered: false };
      const user = userRes.rows[0];
      const currentState = user.mission_health_state || 'HEALTHY';
      const lastRecoveryMessageAt = user.last_recovery_message_at;

      // Recovery is only triggered when returning from severe risk states
      if (!['HIGH_RISK', 'CRITICAL', 'MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(currentState)) {
        return { triggered: false };
      }



      // Check if we have a duplicate row in public.notification_events for today
      const dupRes = await client.query(
        `SELECT id FROM public.notification_events 
         WHERE user_id = $1 AND notification_type = 'RECOVERY_NOTIFICATION' AND source_type = 'recovery_date' AND source_id = $2`,
        [userId, dayKey]
      );
      if (dupRes.rows.length > 0) {
        console.log(`[BehaviorEscalation RECOVERY] Recovery event already exists in notification_events today for user ${userId}. Skipping duplicate.`);
        return { triggered: false };
      }

      // 2. Query today's completed study blocks and completed minutes
      const completedRes = await client.query(
        `SELECT COUNT(*) as count, SUM(actual_minutes) as completed_mins 
         FROM public.study_blocks 
         WHERE user_id = $1 AND day_key = $2 AND status IN ('completed', 'partial') AND actual_minutes > 0`,
        [userId, dayKey]
      );
      const completedCount = Number(completedRes.rows[0]?.count || 0);
      const completedMins = Number(completedRes.rows[0]?.completed_mins || 0);

      if (completedCount > 0) {
        console.log(`[BehaviorEscalation RECOVERY TRIGGER] User ${userId} completed a block in state ${currentState}. Initiating RECOVERY.`);
        
        const targetMins = getDailyTargetMinutes('RECOVERY', 1, 600);
        const performanceRatio = targetMins > 0 ? (completedMins / targetMins) : 1.0;
        const initialRecoveryScore = calculateRecoveryScore('RECOVERY', 1, performanceRatio);

        // Update state to RECOVERY Day 1
        await client.query(
          `UPDATE public.users 
           SET mission_health_state = 'RECOVERY',
               recovery_day = 1,
               recovery_score = $3,
               consecutive_zero_study_days = 0,
               consecutive_missed_plan_days = 0,
               consecutive_ignored_reminder_days = 0,
               last_meaningful_study_date = $2::date,
               last_recovery_message_at = NOW(),
               last_escalation_at = NOW(),
               recovery_wizard_step = 0
           WHERE id = $1`,
          [userId, dayKey, initialRecoveryScore]
        );

        // Insert notification event for deduplication inside transaction
        await client.query(
          `INSERT INTO public.notification_events 
             (user_id, notification_type, source_type, source_id, channel_type, status, sent_at)
           VALUES ($1, 'RECOVERY_NOTIFICATION', 'recovery_date', $2, 'TELEGRAM', 'sent', NOW())
           ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) DO NOTHING`,
          [userId, dayKey]
        );

        return { triggered: true, previousState: currentState };
      }
      return { triggered: false };
    });

    if (result && result.triggered) {
      // Send positive reinforcement Telegram message immediately
      let text = `Good. The streak is broken. Don’t chase perfection today. Protect tomorrow.`;
      if (result.previousState === 'RECOVERY_WIZARD') {
        text = `✅ Recovery Day 1\n\nYou broke the inactivity streak. Today's victory is not the number of hours. Today's victory is showing up. Tomorrow we'll build again.`;
      }

      // Get Chat ID
      const destRes = await query(
        `SELECT destination_id FROM public.notification_channels 
         WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE LIMIT 1`,
        [userId]
      );
      if (destRes.rows.length > 0) {
        const chatId = destRes.rows[0].destination_id;
        await telegramService.sendTelegramMessage(chatId, text);
        console.log(`[BehaviorEscalation RECOVERY TRIGGER] Sent positive reinforcement to ${userId} (Chat: ${chatId})`);
      }
    }
  } catch (err) {
    console.error(`[BehaviorEscalation checkAndTriggerRecovery ERROR]`, err);
  }
}

/**
 * Checks if the user is in MISSION_FAILURE state and, if so, transactionally 
 * sends the recovery invitation and moves them to MISSION_RECOVERY state.
 */
export async function checkAndSendRecoveryInvitation(userId) {
  try {
    const result = await withTransaction(async (client) => {
      const userRes = await client.query(
        `SELECT mission_health_state, name FROM public.users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userRes.rows.length === 0) return { sent: false };
      const user = userRes.rows[0];
      const currentState = user.mission_health_state || 'HEALTHY';

      if (currentState !== 'MISSION_FAILURE') {
        return { sent: false };
      }

      // Record invitation in notification_events as deduplication
      const todayKey = new Date().toISOString().slice(0, 10);
      const dupRes = await client.query(
        `SELECT id FROM public.notification_events 
         WHERE user_id = $1 AND notification_type = 'RECOVERY_INVITATION' AND source_type = 'daily_date' AND source_id = $2`,
        [userId, todayKey]
      );
      if (dupRes.rows.length > 0) {
        return { sent: false };
      }

      // Update state to MISSION_RECOVERY and set last_recovery_message_at
      await client.query(
        `UPDATE public.users 
         SET mission_health_state = 'MISSION_RECOVERY',
             last_recovery_message_at = NOW(),
             last_escalation_at = NOW(),
             recovery_wizard_step = 0
         WHERE id = $1`,
        [userId]
      );

      // Insert event log
      await client.query(
        `INSERT INTO public.notification_events 
           (user_id, notification_type, source_type, source_id, channel_type, status, sent_at)
         VALUES ($1, 'RECOVERY_INVITATION', 'daily_date', $2, 'TELEGRAM', 'sent', NOW())
         ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) DO NOTHING`,
        [userId, todayKey]
      );

      return { sent: true, userName: user.name || "Moulika" };
    });

    if (result && result.sent) {
      const text = psychologyMessageService.getRecoveryInvitationMessage(result.userName);
      
      const destRes = await query(
        `SELECT destination_id FROM public.notification_channels 
         WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE LIMIT 1`,
        [userId]
      );
      if (destRes.rows.length > 0) {
        const chatId = destRes.rows[0].destination_id;
        await telegramService.sendTelegramMessage(chatId, text);
        console.log(`[BehaviorEscalation] Sent Recovery Invitation to ${userId} (Chat: ${chatId})`);
      }
    }
  } catch (err) {
    console.error(`[BehaviorEscalation checkAndSendRecoveryInvitation ERROR]`, err);
  }
}

/**
 * Calculate the user's recovery score range based on behavioral state, recovery day, and consistency performance.
 */
export function calculateRecoveryScore(state, recoveryDay = 0, performanceRatio = 1.0, consistencyPercentage = 100.0) {
  const normState = (state || 'HEALTHY').toUpperCase();
  const cRatio = Math.max(0, Math.min(100, consistencyPercentage)) / 100.0;
  const pRatio = Math.max(0, Math.min(1.0, performanceRatio));

  switch (normState) {
    case 'HEALTHY':
      return 85 + Math.round(cRatio * 15);
    case 'SLIGHT_RISK':
      return 70 + Math.round(cRatio * 14);
    case 'AT_RISK':
      return 50 + Math.round(cRatio * 19);
    case 'HIGH_RISK':
      return 30 + Math.round(cRatio * 19);
    case 'CRITICAL':
      return 10 + Math.round(cRatio * 19);
    case 'MISSION_FAILURE':
      return Math.round(cRatio * 9);
    case 'RECOVERY':
      if (recoveryDay === 1) {
        return 40 + Math.round(pRatio * 20);
      } else if (recoveryDay === 2) {
        return 50 + Math.round(pRatio * 15);
      } else if (recoveryDay === 3) {
        return 60 + Math.round(pRatio * 15);
      } else if (recoveryDay === 4) {
        return 70 + Math.round(pRatio * 15);
      } else {
        return 80 + Math.round(pRatio * 15);
      }
    default:
      return 100;
  }
}
