import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as notificationService from './notificationService.js';
import * as consistencyService from './consistencyService.js';
import * as behaviorEscalationService from './behaviorEscalationService.js';
import * as psychologyMessageService from './psychologyMessageService.js';
import { getSafeDailyPlanState, shouldSendMissingPlanReminder, buildMissingPlanReminder } from './dailyPlanStateService.js';
import { APPLICATION_TIMEZONE, getKolkataDateKey } from './progressNormalizer.js';
import { healthMonitor } from './healthMonitor.js';

let schedulerInterval = null;

let isSchedulerRunning = false;
let consecutiveSchedulerErrors = 0;
let lastSchedulerErrorTime = 0;

// Initialize the scheduler background timer
export function initNotificationScheduler(userId = 'moulika') {
  const schedulerEnabled = process.env.ENABLE_NOTIFICATION_SCHEDULER;
  console.log(`[NotificationScheduler Diagnostics]`);
  console.log(`- ENABLE_NOTIFICATION_SCHEDULER: ${schedulerEnabled}`);

  if (schedulerEnabled !== "true") {
    console.log("[NotificationScheduler] Notification scheduler disabled.");
    return;
  }
  if (schedulerInterval) return;
  
  console.log("[NotificationScheduler] Notification scheduler started.");
  
  // Tick every 30 seconds to ensure timely active block auto-activation
  schedulerInterval = setInterval(async () => {
    if (isSchedulerRunning) {
      console.log("[NotificationScheduler] Overlapping tick detected. Skipping.");
      return;
    }

    if (consecutiveSchedulerErrors > 0) {
      const backoffMs = Math.min(consecutiveSchedulerErrors * 30000, 120000);
      if (Date.now() - lastSchedulerErrorTime < backoffMs) {
        console.log(`[NotificationScheduler] Backoff active for ${backoffMs/1000}s due to previous error.`);
        return;
      }
    }

    const { isDbCircuitOpen } = await import('../db/index.js');
    if (isDbCircuitOpen()) {
      console.log("[NotificationScheduler] DB circuit is OPEN. Skipping tick.");
      return;
    }

    isSchedulerRunning = true;
    try {
      await tickScheduler(userId);
      consecutiveSchedulerErrors = 0;
    } catch (err) {
      console.error("[NotificationScheduler Tick Error]", err);
      healthMonitor.recordSchedulerFailure();
      consecutiveSchedulerErrors++;
      lastSchedulerErrorTime = Date.now();
    } finally {
      isSchedulerRunning = false;
    }
  }, 30 * 1000);

  // Run a startup check immediately
  setTimeout(async () => {
    if (isSchedulerRunning) return;
    isSchedulerRunning = true;
    try {
      const { isDbCircuitOpen } = await import('../db/index.js');
      if (isDbCircuitOpen()) {
        console.log("[NotificationScheduler] Startup: DB circuit is OPEN. Skipping.");
        isSchedulerRunning = false;
        return;
      }
      await tickScheduler(userId);
      consecutiveSchedulerErrors = 0;
    } catch (err) {
      console.error("[NotificationScheduler Startup Tick Error]", err);
      healthMonitor.recordSchedulerFailure();
      consecutiveSchedulerErrors++;
      lastSchedulerErrorTime = Date.now();
    } finally {
      isSchedulerRunning = false;
    }
  }, 2000);
}

export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[NotificationScheduler] Scheduler stopped.");
  }
}

async function tickScheduler(userId) {
  const now = new Date();
  let hasError = false;
  
  // 1. Get Kolkata timezone details
  const kolkataStr = now.toLocaleString("en-US", { timeZone: APPLICATION_TIMEZONE });
  const d = new Date(kolkataStr);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  const timezone = APPLICATION_TIMEZONE;
  
  const hour = d.getHours();
  const minute = d.getMinutes();
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...

  // Check if escalations should be paused (derived from latest I_AM_STUDYING discipline event within the last 45 minutes)
  let isEscalationPaused = false;
  try {
    const confirmRes = await query(
      `SELECT created_at FROM public.discipline_events 
       WHERE user_id = $1 AND event_type = 'I_AM_STUDYING' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (confirmRes.rows.length > 0) {
      const lastConfirm = new Date(confirmRes.rows[0].created_at).getTime();
      if ((Date.now() - lastConfirm) < 45 * 60 * 1000) {
        isEscalationPaused = true;
      }
    }
  } catch (err) {
    console.error("[NotificationScheduler] failed to query latest I_AM_STUDYING event:", err.message);
  }

  // ── 1. Process Today's Blocks (Reminders, Pauses, Missed) ──────────────
  try {
    await processTodayBlocks(userId, now, isEscalationPaused);
  } catch (err) {
    console.error("[NotificationScheduler] processTodayBlocks failed:", err.message);
    hasError = true;
  }

  // ── 1.b Discipline Checks (DAY_NOT_STARTED, SLIPPING) ──────────────────────
  try {
    await detectAndProcessDayDiscipline(userId, now, isEscalationPaused);
  } catch (err) {
    console.error("[NotificationScheduler] discipline checks failed:", err.message);
    hasError = true;
  }

  // ── 1.b Good Morning Mission (05:00 AM) ────────────────────────────────────
  if (hour === 5 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'GOOD_MORNING_MISSION', todayKey))) {
        const yesterdayKey = getYesterdayKey(now);
        // Run daily risk analyzer before consistency record and report generation
        await behaviorEscalationService.analyzeDailyRisk(userId, todayKey);
        await consistencyService.recordDailyConsistency(userId, yesterdayKey);
        
        const userRes = await query(`SELECT mission_health_state, last_recovery_message_at, name FROM public.users WHERE id = $1`, [userId]);
        const user = userRes.rows[0];
        const state = user?.mission_health_state || 'HEALTHY';
        const lastRecoveryMessageAt = user?.last_recovery_message_at;
        const userName = user?.name || "Moulika";

        if (state === 'MISSION_FAILURE') {
          await behaviorEscalationService.checkAndSendRecoveryInvitation(userId);
          await recordEvent(userId, 'GOOD_MORNING_MISSION', todayKey);
        } else if (state === 'MISSION_RECOVERY') {
          if (lastRecoveryMessageAt) {
            const diffDays = Math.floor((now.getTime() - new Date(lastRecoveryMessageAt).getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 7 && diffDays < 14) {
              const alreadySentFollowup = await hasEvent(userId, 'RECOVERY_FOLLOWUP', todayKey);
              if (!alreadySentFollowup) {
                const text = psychologyMessageService.getRecoveryFollowupMessage(userName);
                await notificationService.sendNotification(userId, 'RECOVERY_FOLLOWUP', 'daily_date', todayKey, text, {});
                await recordEvent(userId, 'RECOVERY_FOLLOWUP', todayKey);
              }
            } else if (diffDays >= 14) {
              const lastCheckinRes = await query(
                `SELECT sent_at FROM public.notification_events 
                 WHERE user_id = $1 AND notification_type = 'RECOVERY_WEEKLY_CHECKIN' 
                 ORDER BY sent_at DESC LIMIT 1`,
                [userId]
              );
              let shouldSendCheckin = true;
              if (lastCheckinRes.rows.length > 0) {
                const lastCheckinTime = new Date(lastCheckinRes.rows[0].sent_at).getTime();
                const daysSinceLastCheckin = (now.getTime() - lastCheckinTime) / (1000 * 60 * 60 * 24);
                if (daysSinceLastCheckin < 6.5) {
                  shouldSendCheckin = false;
                }
              }

              if (shouldSendCheckin) {
                const text = psychologyMessageService.getRecoveryWeeklyCheckinMessage(userName);
                await notificationService.sendNotification(userId, 'RECOVERY_WEEKLY_CHECKIN', 'daily_date', todayKey, text, {});
                await recordEvent(userId, 'RECOVERY_WEEKLY_CHECKIN', todayKey);
              }
            }
          }
          await recordEvent(userId, 'GOOD_MORNING_MISSION', todayKey);
        } else if (state !== 'RECOVERY_WIZARD') {
          const data = await progressService.getCanonicalGoodMorningReportData(userId);
          const text = reportGeneratorService.generateCanonicalGoodMorningReport(data, userName);
          await notificationService.sendNotification(userId, 'GOOD_MORNING_MISSION', 'daily_date', todayKey, text, {});
          await recordEvent(userId, 'GOOD_MORNING_MISSION', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] good morning report failed:", err.message);
    }
  }

  // ── 1.c Plan Not Uploaded Alert (06:00 AM) ─────────────────────────────────
  if (hour === 6 && minute === 0 && !isEscalationPaused) {
    try {
      const userRes = await query(`SELECT name, mission_health_state, recovery_day FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "User";
      if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
        if (!(await hasEvent(userId, 'PLAN_NOT_UPLOADED', todayKey))) {
          const planState = await getSafeDailyPlanState({ userId, dayKey: todayKey });

          if (shouldSendMissingPlanReminder(planState)) {
            const msg = buildMissingPlanReminder({ planState, userName, notificationType: 'PLAN_NOT_UPLOADED' });
            
            const result = await notificationService.sendNotification(userId, 'PLAN_NOT_UPLOADED', 'daily_date', todayKey, msg, {});
            if (result && result.ok) {
              await recordEvent(userId, 'PLAN_NOT_UPLOADED', todayKey);
            }
          }
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] plan not uploaded check failed:", err.message);
    }
  }

  // ── 1.d Strict No-Plan Alert (09:00–09:30 AM) ──────────────────────────────
  const is9amWindow = (hour === 9 && minute >= 0 && minute <= 30);
  if (is9amWindow && !isEscalationPaused) {
    try {
      const userRes = await query(`SELECT name, mission_health_state, consecutive_zero_study_days FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "User";
      const zeroStreak = user?.consecutive_zero_study_days || 0;
      
      const planState = await getSafeDailyPlanState({ userId, dayKey: todayKey });

      if (planState.state === 'USER_PLAN_PRESENT') {
        logEscalationDebug('NO_PLAN_STRICT_9AM', userId, userName, state, zeroStreak, planState.evidence.totalBlocks, true, false, false, 'SKIP', 'User already has a real plan uploaded');
      } else {
        const lockAcquired = await acquireAtomicLock(userId, 'NO_PLAN_STRICT_9AM', todayKey);
        if (lockAcquired) {
          const text = buildMissingPlanReminder({ planState, userName, notificationType: 'NO_PLAN_STRICT_9AM' });
          const result = await notificationService.sendNotification(userId, 'NO_PLAN_STRICT_9AM', 'daily_date', todayKey, text, {});
          if (result && result.ok) {
            await updateAtomicLockStatus(userId, 'NO_PLAN_STRICT_9AM', todayKey, 'sent');
            await recordEvent(userId, 'NO_PLAN_STRICT_9AM', todayKey);
            logEscalationDebug('NO_PLAN_STRICT_9AM', userId, userName, state, zeroStreak, planState.evidence.totalBlocks, false, false, true, 'SEND', 'Lock acquired, notification sent successfully');
          } else {
            await updateAtomicLockStatus(userId, 'NO_PLAN_STRICT_9AM', todayKey, 'failed');
            logEscalationDebug('NO_PLAN_STRICT_9AM', userId, userName, state, zeroStreak, planState.evidence.totalBlocks, false, false, true, 'SKIP', `sendNotification failed: ${result?.reason || result?.error || 'unknown'}`);
          }
        } else {
          logEscalationDebug('NO_PLAN_STRICT_9AM', userId, userName, state, zeroStreak, planState.evidence.totalBlocks, false, false, false, 'SKIP', 'Atomic lock not acquired (already sent today or pending)', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] 9 AM no plan check failed:", err.message);
    }
  }

  // ── 1.e Recovery Plan Reminder (12:00–12:30 PM & Catch-up 12:30–14:59) ──────
  const is12pmWindow = (hour === 12 && minute >= 0 && minute <= 30);
  const is12pmCatchup = ((hour === 12 && minute > 30) || (hour >= 13 && hour < 15));
  if ((is12pmWindow || is12pmCatchup) && !isEscalationPaused) {
    try {
      const userRes = await query(`SELECT name, mission_health_state, consecutive_zero_study_days FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "Moulika";
      const zeroStreak = user?.consecutive_zero_study_days || 0;
      
      const planState = await checkUserPlanState(userId, todayKey);
      
      if (planState.hasCompletedBlock) {
        logEscalationDebug('RECOVERY_PLAN_12PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already completed study block');
      } else if (planState.hasRealPlan) {
        logEscalationDebug('RECOVERY_PLAN_12PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already has a real plan uploaded');
      } else {
        const lockAcquired = await acquireAtomicLock(userId, 'RECOVERY_PLAN_12PM', todayKey);
        if (lockAcquired) {
          const text = psychologyMessageService.getRecoveryPlan12PMMessage(userName);
          const result = await notificationService.sendNotification(userId, 'RECOVERY_PLAN_12PM', 'daily_date', todayKey, text, {});
          if (result && result.ok) {
            await updateAtomicLockStatus(userId, 'RECOVERY_PLAN_12PM', todayKey, 'sent');
            await recordEvent(userId, 'RECOVERY_PLAN_12PM', todayKey);
            logEscalationDebug('RECOVERY_PLAN_12PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SEND', `Lock acquired, notification sent successfully (mode=${is12pmCatchup ? 'CATCH_UP' : 'WINDOW'})`);
          } else {
            await updateAtomicLockStatus(userId, 'RECOVERY_PLAN_12PM', todayKey, 'failed');
            logEscalationDebug('RECOVERY_PLAN_12PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SKIP', `sendNotification failed: ${result?.reason || result?.error || 'unknown'}`);
          }
        } else {
          logEscalationDebug('RECOVERY_PLAN_12PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'Atomic lock not acquired (already sent today or pending)', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] 12 PM recovery plan check failed:", err.message);
    }
  }

  // ── 1.f High Risk Intervention (15:00–15:30 PM) ───────────────────────────
  const is3pmWindow = (hour === 15 && minute >= 0 && minute <= 30);
  if (is3pmWindow && !isEscalationPaused) {
    try {
      const userRes = await query(`SELECT name, mission_health_state, consecutive_zero_study_days FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "Moulika";
      const zeroStreak = user?.consecutive_zero_study_days || 0;
      
      const planState = await checkUserPlanState(userId, todayKey);
      
      if (planState.hasCompletedBlock) {
        logEscalationDebug('HIGH_RISK_INTERVENTION_3PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already completed study block');
      } else if (planState.hasRealPlan) {
        logEscalationDebug('HIGH_RISK_INTERVENTION_3PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already has a real plan uploaded');
      } else {
        const lockAcquired = await acquireAtomicLock(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey);
        if (lockAcquired) {
          const text = psychologyMessageService.getHighRiskIntervention3PMMessage(userName);
          const result = await notificationService.sendNotification(userId, 'HIGH_RISK_INTERVENTION_3PM', 'daily_date', todayKey, text, {});
          if (result && result.ok) {
            await updateAtomicLockStatus(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey, 'sent');
            await recordEvent(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey);
            logEscalationDebug('HIGH_RISK_INTERVENTION_3PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SEND', 'Lock acquired, notification sent successfully');
          } else {
            await updateAtomicLockStatus(userId, 'HIGH_RISK_INTERVENTION_3PM', todayKey, 'failed');
            logEscalationDebug('HIGH_RISK_INTERVENTION_3PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SKIP', `sendNotification failed: ${result?.reason || result?.error || 'unknown'}`);
          }
        } else {
          logEscalationDebug('HIGH_RISK_INTERVENTION_3PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'Atomic lock not acquired (already sent today or pending)', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] 3 PM high risk check failed:", err.message);
    }
  }

  // ── 1.g Emergency Non-Zero Reminder (18:00–18:30 PM) ──────────────────────
  const is6pmWindow = (hour === 18 && minute >= 0 && minute <= 30);
  if (is6pmWindow && !isEscalationPaused) {
    try {
      const userRes = await query(`SELECT name, mission_health_state, consecutive_zero_study_days FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "Moulika";
      const zeroStreak = user?.consecutive_zero_study_days || 0;
      
      const planState = await checkUserPlanState(userId, todayKey);
      
      if (planState.hasCompletedBlock) {
        logEscalationDebug('EMERGENCY_NON_ZERO_6PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already completed study block');
      } else if (planState.hasRealPlan) {
        logEscalationDebug('EMERGENCY_NON_ZERO_6PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'User already has a real plan uploaded');
      } else {
        const lockAcquired = await acquireAtomicLock(userId, 'EMERGENCY_NON_ZERO_6PM', todayKey);
        if (lockAcquired) {
          const text = psychologyMessageService.getEmergencyNonZero6PMMessage(userName);
          const result = await notificationService.sendNotification(userId, 'EMERGENCY_NON_ZERO_6PM', 'daily_date', todayKey, text, {});
          if (result && result.ok) {
            await updateAtomicLockStatus(userId, 'EMERGENCY_NON_ZERO_6PM', todayKey, 'sent');
            await recordEvent(userId, 'EMERGENCY_NON_ZERO_6PM', todayKey);
            logEscalationDebug('EMERGENCY_NON_ZERO_6PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SEND', 'Lock acquired, notification sent successfully');
          } else {
            await updateAtomicLockStatus(userId, 'EMERGENCY_NON_ZERO_6PM', todayKey, 'failed');
            logEscalationDebug('EMERGENCY_NON_ZERO_6PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, true, 'SKIP', `sendNotification failed: ${result?.reason || result?.error || 'unknown'}`);
          }
        } else {
          logEscalationDebug('EMERGENCY_NON_ZERO_6PM', userId, userName, state, zeroStreak, planState.totalBlocks, planState.hasRealPlan, planState.hasCompletedBlock, false, 'SKIP', 'Atomic lock not acquired (already sent today or pending)', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] 6 PM emergency check failed:", err.message);
    }
  }

  // ── 2. Daily Revision Due Alert (08:30 AM) ───────────────────────────────────
  if (hour === 8 && minute === 30) {
    try {
      const userRes = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [userId]);
      const state = userRes.rows[0]?.mission_health_state || 'HEALTHY';
      if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
        if (!(await hasEvent(userId, 'REVISION_DUE_ALERT', todayKey))) {
          const data = await progressService.getRevisionDueReport(userId);
          if (data.count > 0) {
            const text = `📅 *Revision Due Alert*
Moulika, you have *${data.count}* revision items due today. Don't let your queue pile up! Send \`revision due\` to see the list.`;
            await notificationService.sendNotification(
              userId, 
              'REVISION_DUE_ALERT', 
              'revision_date', 
              todayKey, 
              text, 
              { count: data.count }
            );
            await recordEvent(userId, 'REVISION_DUE_ALERT', todayKey);
          }
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] revision due alert failed:", err.message);
    }
  }

  // ── 3. Daily Night Mentor Review (Dynamic) ──────────────────────────────────
  try {
    const userRes = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [userId]);
    const state = userRes.rows[0]?.mission_health_state || 'HEALTHY';
    if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
      if (!(await hasEvent(userId, 'NIGHT_MENTOR_REVIEW', todayKey))) {
        const { getDailyExecutionSummary } = await import('./dailyExecutionSummaryService.js');
        const summary = await getDailyExecutionSummary(userId, todayKey);
        
        let shouldSendReview = false;

        if (summary.totalBlocks > 0) {
          const hasPending = summary.blockRows.some(b => b.isPending);
          if (!hasPending) {
            let maxPlannedEndMs = 0;
            for (const b of summary.blockRows) {
              if (b.planned_end) {
                const [endH, endM] = b.planned_end.split(':').map(Number);
                const plannedEndDate = new Date(d);
                plannedEndDate.setHours(endH, endM, 0, 0);
                maxPlannedEndMs = Math.max(maxPlannedEndMs, plannedEndDate.getTime());
              }
            }

            const finalBlock = summary.blockRows.reduce((prev, current) => {
              const getEndMs = (b) => {
                if (!b.planned_end) return 0;
                const [h, m] = b.planned_end.split(':').map(Number);
                return h * 60 + m;
              };
              return getEndMs(prev) > getEndMs(current) ? prev : current;
            }, summary.blockRows[0]);

            const finalBlockEndedAtMs = finalBlock && finalBlock.ended_at ? new Date(finalBlock.ended_at).getTime() : 0;
            const isFinalBlockCompleted = finalBlock && finalBlock.isCompleted;

            if (d.getTime() >= maxPlannedEndMs + 15 * 60000) {
              shouldSendReview = true;
            } else if (isFinalBlockCompleted && finalBlockEndedAtMs > 0 && d.getTime() >= finalBlockEndedAtMs + 60000) {
              shouldSendReview = true;
            }
          }
        } else {
          // No blocks planned today. Fallback to 22:15.
          if (hour >= 22 && minute >= 15) {
            shouldSendReview = true;
          }
        }

        if (shouldSendReview) {
          const { sendNightMentorReview } = await import('./mentorReviewService.js');
          await sendNightMentorReview(userId, todayKey);
          await recordEvent(userId, 'NIGHT_MENTOR_REVIEW', todayKey);
        }
      }
    }
  } catch (err) {
    console.error("[NotificationScheduler] daily night mentor review failed:", err.message);
  }

  // ── 4. Weekly Mentor Report (Monday 07:00 AM to 10:59 AM retry window) ───────────
  if (dayOfWeek === 1 && hour >= 7 && hour <= 10) {
    try {
      const userRes = await query(`SELECT name, mission_health_state FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "Moulika";
      if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
        const yesterdayDate = new Date(d);
        yesterdayDate.setDate(d.getDate() - 1);
        const endDayKey = getKolkataDateKey(yesterdayDate); // Sunday

        const prevMondayDate = new Date(d);
        prevMondayDate.setDate(d.getDate() - 7);
        const startDayKey = getKolkataDateKey(prevMondayDate); // Monday
        const periodKey = `${startDayKey}_${endDayKey}`;

        if (!(await hasEvent(userId, 'WEEKLY_MENTOR_REPORT', periodKey))) {
          const data = await progressService.getWeeklyExecutionSummary(userId, startDayKey, endDayKey);
          const text = reportGeneratorService.generateCanonicalWeeklyReport(data, userName);
          const result = await notificationService.sendNotification(
            userId,
            'WEEKLY_MENTOR_REPORT',
            'weekly_date',
            periodKey,
            text,
            {}
          );
          if (result && result.ok) {
            await recordEvent(userId, 'WEEKLY_MENTOR_REPORT', periodKey);
          }
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] weekly mentor report failed:", err.message);
    }
  }

  // ── 5. Monthly Mentor Report (First day of month 07:30 AM to 10:59 AM) ───────────
  if (d.getDate() === 1 && hour >= 7 && hour <= 10) {
    try {
      const userRes = await query(`SELECT name, mission_health_state FROM public.users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];
      const state = user?.mission_health_state || 'HEALTHY';
      const userName = user?.name || "Moulika";
      if (!['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
        let prevMonthYear = yyyy;
        let prevMonthNum = d.getMonth(); // 0-indexed: e.g. August (7) => July (7)
        if (prevMonthNum === 0) {
          prevMonthNum = 12;
          prevMonthYear = yyyy - 1;
        }
        const prevMonthKey = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}`;

        if (!(await hasEvent(userId, 'MONTHLY_MENTOR_REPORT', prevMonthKey))) {
          const data = await progressService.getCanonicalMonthlyReportDataset(userId, prevMonthKey);
          const text = reportGeneratorService.generateCanonicalMonthlyTextReport(data, userName);
          const result = await notificationService.sendNotification(
            userId,
            'MONTHLY_MENTOR_REPORT',
            'monthly_date',
            prevMonthKey,
            text,
            {}
          );
          if (result && result.ok) {
            await recordEvent(userId, 'MONTHLY_MENTOR_REPORT', prevMonthKey);
          }
        }
        
        if (!(await hasEvent(userId, 'MONTHLY_MENTOR_REPORT_PDF', prevMonthKey))) {
          const { sendMonthlyPdfReport } = await import('./monthlyPdfReportService.js');
          // Retrieve telegram chat id
          const { rows: channels } = await query(
            `SELECT destination_id FROM public.notification_channels 
             WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE LIMIT 1`,
            [userId]
          );
          if (channels.length > 0) {
            const chatId = channels[0].destination_id;
            // sendMonthlyPdfReport returns { delivered: bool, reason: string }
            // Only record as sent if delivered=true (PDF, text fallback, or insufficient-data notice)
            // RECONCILIATION_FAILED leaves delivered=false so next tick retries
            const pdfResult = await sendMonthlyPdfReport(userId, prevMonthKey, chatId);
            if (pdfResult && pdfResult.delivered) {
              await recordEvent(userId, 'MONTHLY_MENTOR_REPORT_PDF', prevMonthKey);
            } else if (pdfResult && pdfResult.reason === 'RECONCILIATION_FAILED') {
              if (!(await hasEvent(userId, 'MONTHLY_RECONCILIATION_NOTICE', prevMonthKey))) {
                await telegramService.sendTelegramMessage(chatId, "MentorOS found a data mismatch, so your monthly report has been held back rather than showing incorrect figures.");
                await recordEvent(userId, 'MONTHLY_RECONCILIATION_NOTICE', prevMonthKey);
              }
              console.warn(`[NotificationScheduler] Monthly PDF not recorded: RECONCILIATION_FAILED`);
            } else {
              console.warn(`[NotificationScheduler] Monthly PDF not recorded: ${pdfResult?.reason || 'unknown'}`);
            }
          } else {
            console.log("[NotificationScheduler] Monthly PDF skipped, no telegram channel for user:", userId);
          }
        }


      }
    } catch (err) {
      console.error("[NotificationScheduler] monthly report failed:", err.message);
      hasError = true;
    }
  }

  // ── 6. End of Day Distraction Report (10:00 PM) ──────────────────────────────
  if (hour === 22 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'DAILY_DISTRACTION_REPORT_EOD', todayKey))) {
        const usageRes = await query(
          `SELECT app_name, duration_seconds 
           FROM public.guardian_daily_phone_usage 
           WHERE user_id = $1 AND date = $2
           ORDER BY duration_seconds DESC`,
          [userId, todayKey]
        );

        if (usageRes.rows.length > 0) {
          const totalSec = usageRes.rows.reduce((sum, r) => sum + r.duration_seconds, 0);
          const totalMins = Math.floor(totalSec / 60);

          let msg = `📊 *Daily Phone Usage Summary* (Moulika)
Total distraction usage: *${totalMins} minutes*

Breakdown:`;
          for (const row of usageRes.rows) {
            const mins = Math.floor(row.duration_seconds / 60);
            if (mins > 0) {
              msg += `\n• *${row.app_name}*: ${mins}m`;
            }
          }

          await notificationService.sendNotification(
            userId,
            'DAILY_NIGHT_REPORT',
            'daily_distraction_report',
            todayKey,
            msg,
            {}
          );
          await recordEvent(userId, 'DAILY_DISTRACTION_REPORT_EOD', todayKey);
          console.log(`[NotificationScheduler] Daily distraction report sent for ${userId}`);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] Daily distraction report failed:", err.message);
    }
  }

  if (hasError) {
    healthMonitor.recordSchedulerFailure();
  } else {
    healthMonitor.recordSchedulerSuccess();
  }
}

// Unified block scanner for reminders, pause checks, and missed blocks
export async function processTodayBlocks(userId, now, isEscalationPaused = false) {


  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const { rows: todayBlocks } = await query(
    `SELECT id, title, subject, status, planned_start, planned_end, planned_minutes,
            COALESCE(actual_minutes, 0) AS actual_minutes,
            day_key, started_at, ended_at, paused_at, pauses_count, total_pause_seconds, block_id
     FROM public.study_blocks
     WHERE user_id = $1
       AND day_key = $2
     ORDER BY planned_start ASC`,
    [userId, todayKey]
  );

  if (todayBlocks.length === 0) return;

  const userRes = await query(`SELECT mission_health_state, recovery_day FROM public.users WHERE id = $1`, [userId]);
  const state = userRes.rows[0]?.mission_health_state || 'HEALTHY';
  if (['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
    return;
  }
  const recoveryDay = userRes.rows[0]?.recovery_day || 0;

  const actualMinutesToday = todayBlocks.reduce((sum, b) => sum + (b.actual_minutes || 0), 0);
  const startedOrDoneBlocks = todayBlocks.filter(b => ['active', 'completed', 'partial', 'done'].includes(b.status.toLowerCase())).length;

  const earliest = todayBlocks[0];

  // 1. Plan not started check
  if (earliest && earliest.planned_start) {
    const [startH, startM] = earliest.planned_start.split(':').map(Number);
    const plannedStartDate = new Date(d);
    plannedStartDate.setHours(startH, startM, 0, 0);

    if (d.getTime() > plannedStartDate.getTime() + 15 * 60 * 1000) {
      if (actualMinutesToday === 0 && startedOrDoneBlocks === 0) {
        const alreadySent15 = await hasEvent(userId, 'PLAN_NOT_STARTED', todayKey);
        if (!alreadySent15 && !isEscalationPaused) {
          const alertText = psychologyMessageService.getPlanNotStartedMessage(state, "Moulika", earliest.planned_start, recoveryDay);
          await notificationService.sendNotification(userId, 'PLAN_NOT_STARTED', 'daily_date', todayKey, alertText, {});
          await recordEvent(userId, 'PLAN_NOT_STARTED', todayKey);
        }
        
        // PLAN_UPLOADED_NOT_STARTED (30+ mins) via WhatsApp
        if (d.getTime() > plannedStartDate.getTime() + 30 * 60 * 1000) {
          const alreadySent30 = await hasEvent(userId, 'PLAN_UPLOADED_NOT_STARTED', todayKey);
          if (!alreadySent30 && !isEscalationPaused) {
            const { sendWhatsAppButtons } = await import('./whatsappService.js');
            const sent = await sendWhatsAppButtons('91YOURNUMBER', 
              "MentorOS Alert\n\nPlan is uploaded, but execution has not started yet.\n\nA plan without starting becomes mental load.\n\nChoose one:", 
              [
                { id: 'START_BLOCK_1', title: 'Start Block 1' },
                { id: 'OPEN_PLAN', title: 'Open Plan' },
                { id: 'START_RESCUE_MODE', title: 'Rescue Mode' }
              ]
            );
            if (sent) {
              await recordEvent(userId, 'PLAN_UPLOADED_NOT_STARTED', todayKey);
            }
          }
        }
      }
    }
  }

  // 2. Process each block
  for (const b of todayBlocks) {
    if (!b.planned_start) continue;

    const [startH, startM] = b.planned_start.split(':').map(Number);
    const blockStartDate = new Date(d);
    blockStartDate.setHours(startH, startM, 0, 0);

    const blockEndDate = b.planned_end ? new Date(d) : new Date(blockStartDate.getTime() + (b.planned_minutes || 60) * 60000);
    if (b.planned_end) {
       const [endH, endM] = b.planned_end.split(':').map(Number);
       blockEndDate.setHours(endH, endM, 0, 0);
    }

    const actualMins = b.actual_minutes || 0;
    const isCompleted = ['completed', 'done', 'partial'].includes(b.status) || actualMins > 0;
    
    // a. completed/done/partial OR actual_minutes > 0 → skip reminder
    if (isCompleted) {
       continue;
    }

    // b. active/paused → skip start reminder, eligible only for pause-too-long
    if (['active', 'paused'].includes(b.status)) {
       let currentPauseMinutes = 0;
       if (b.status === 'paused' && b.paused_at) {
         currentPauseMinutes = (now.getTime() - new Date(b.paused_at).getTime()) / 60000;
       }
       
       const totalPausedMinutes = Math.floor((b.total_pause_seconds || 0) / 60) + Math.floor(currentPauseMinutes);
       const pauseCount = b.pauses_count || 0;

       if (pauseCount >= 3 || totalPausedMinutes >= 30) {
          // Atomically update block to register alert sent only if status is paused and friction alert hasn't been sent yet
          const { rows: updateRes } = await query(
            `UPDATE public.study_blocks 
             SET friction_state = 'unresolved',
                 friction_alert_sent = TRUE,
                 friction_alert_sent_at = NOW(),
                 telegram_action_pending = TRUE
             WHERE id = $1
               AND status = 'paused'
               AND COALESCE(friction_alert_sent, FALSE) = FALSE
             RETURNING *`,
            [b.id]
          );
          const latestBlock = updateRes[0];

          if (latestBlock) {
           // Generate a sourceId based on total pauses/duration so it doesn't spam infinitely but alerts when severity changes
           const severityStage = Math.floor(totalPausedMinutes / 30) + pauseCount;
           const sourceId = String(b.id) + '_' + severityStage;
           
           const alreadySent = await hasEvent(userId, 'BLOCK_TOO_MUCH_PAUSED', sourceId);
           if (!alreadySent) {
             const alertText = `⚠️ *Block Friction Detected*\nThis block (*${b.subject || 'Study'}*) has been paused too many times (${pauseCount} pauses, ${totalPausedMinutes}m total).\n\nChoose an action below to regain control:`;
              
              let sentSuccess = false;
              try {
                const { sendTelegramMessage } = await import('./telegramService.js');
                const chatId = process.env.TELEGRAM_CHAT_ID;
                if (chatId) {
                  sentSuccess = await sendTelegramMessage(chatId, alertText, {
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "Continue 25m without pause", callback_data: `CONTINUE_BLOCK_25:${b.id}` }],
                        [{ text: "Reduce to smaller block", callback_data: `REDUCE_BLOCK:${b.id}` }],
                        [{ text: "Move to Rescue Mode", callback_data: `START_RESCUE_MODE:${b.id}` }]
                      ]
                    }
                  });
                }
              } catch (sendErr) {
                console.error(`[NotificationScheduler] Failed to send Telegram friction alert for block ${b.id}:`, sendErr.message);
              }

              if (!sentSuccess) {
                // Reset database lock so it can be retried on next scheduler tick
                await query(
                  `UPDATE public.study_blocks 
                   SET friction_state = NULL,
                       friction_alert_sent = FALSE,
                       friction_alert_sent_at = NULL,
                       telegram_action_pending = FALSE
                   WHERE id = $1`,
                  [b.id]
                );
              }
             
             if (sentSuccess) {
               await recordEvent(userId, 'BLOCK_TOO_MUCH_PAUSED', String(b.id));
             }
           }
         }
       }
       continue;
    }

    if (!['planned', 'upcoming', 'ready'].includes(b.status)) {
       continue;
    }

    const timeDiffMins = (d.getTime() - blockStartDate.getTime()) / 60000;
    const endsInMins = (blockEndDate.getTime() - d.getTime()) / 60000;

    // c. planned/ready/upcoming and now between planned_start and planned_start + 10 min → BLOCK_START_REMINDER
    if (timeDiffMins >= 0 && timeDiffMins <= 10) {
       const alreadySentStart = await hasEvent(userId, 'BLOCK_START_REMINDER', String(b.id));
       if (!alreadySentStart && !isEscalationPaused) {
          const titleOrTopic = b.title || b.topic || b.subject;
          const alertText = psychologyMessageService.getBlockStartReminderMessage(
            state, "Moulika", titleOrTopic || b.subject, b.planned_start, b.planned_end, b.planned_minutes, recoveryDay
          );
          await notificationService.sendNotification(userId, 'BLOCK_START_REMINDER', 'block', String(b.id), alertText, { block_id: b.id });
          await recordEvent(userId, 'BLOCK_START_REMINDER', String(b.id));
       }
    } 
    // d. planned/ready/upcoming and now >= planned_start + 15 min and now < planned_end → CURRENT_BLOCK_NOT_STARTED
    else if (timeDiffMins >= 15 && endsInMins > 0) {
       if (b.id === earliest.id && actualMinutesToday === 0 && startedOrDoneBlocks === 0) {
           // Skip if it's the very first block and we already qualify for PLAN_NOT_STARTED
           continue;
       }
       const alreadySentCurrent = await hasEvent(userId, 'CURRENT_BLOCK_NOT_STARTED', String(b.id));
       if (!alreadySentCurrent && !isEscalationPaused) {
          const titleOrTopic = b.title || b.topic || b.subject;
          const alertText = psychologyMessageService.getCurrentBlockNotStartedMessage(
            state, "Moulika", titleOrTopic || b.subject, b.planned_start, recoveryDay
          );
          await notificationService.sendNotification(userId, 'CURRENT_BLOCK_NOT_STARTED', 'block', String(b.id), alertText, { block_id: b.id });
          await recordEvent(userId, 'CURRENT_BLOCK_NOT_STARTED', String(b.id));
       }
    } 
    // e. planned/ready/upcoming and now > planned_end → mark missed silently
    else if (timeDiffMins >= 15 && endsInMins <= 0) {
       const eventCheckRes = await query(
         `SELECT id FROM public.plan_block_events WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED' LIMIT 1`,
         [userId, b.id]
       );

       if (eventCheckRes.rows.length === 0) {
         await query(
           `UPDATE public.study_blocks 
            SET status = 'missed', 
                ended_at = NOW(), 
                completion_reason = 'missed', 
                updated_at = NOW() 
            WHERE id = $1`,
           [b.id]
         );

         // Confirm block exists in plan_blocks before inserting to prevent FK violation
         const pBlockCheck = await query(`SELECT id FROM public.plan_blocks WHERE id = $1`, [b.id]).catch(() => ({ rows: [] }));
         if (pBlockCheck.rows && pBlockCheck.rows.length > 0) {
           await query(
             `INSERT INTO public.plan_block_events (user_id, block_id, event_type, metadata)
              VALUES ($1, $2, 'BLOCK_MISSED', $3)`,
             [userId, b.id, JSON.stringify({ block_id: b.block_id, subject: b.subject, planned_end: b.planned_end })]
           );
         } else {
           // Also log to study_blocks if it was meant for study_blocks but not plan_blocks
           // Since plan_block_events has FK to plan_blocks, we just skip it for study_blocks-only items
           console.log(`[NotificationScheduler] Skipping BLOCK_MISSED event, block_id ${b.id} not in plan_blocks`);
         }
       }
    }
  }
}

async function detectAndProcessDayDiscipline(userId, now, isEscalationPaused = false) {
  if (isEscalationPaused) {
    return;
  }
  const userRes = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [userId]);
  const state = userRes.rows[0]?.mission_health_state || 'HEALTHY';
  if (['MISSION_FAILURE', 'MISSION_RECOVERY', 'RECOVERY_WIZARD'].includes(state)) {
    return;
  }
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const { rows } = await query(`SELECT id, status, planned_minutes, actual_minutes FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [userId, todayKey]);
  const hasPlan = rows.length > 0;

  // DAY_NOT_STARTED WhatsApp Alerts (8:30, 10:30, 12:30, 15:00)
  if (!hasPlan) {
    const timePoints = [
      { h: 8, m: 30, level: 'soft' },
      { h: 10, m: 30, level: 'medium' },
      { h: 12, m: 30, level: 'high' },
      { h: 15, m: 0, level: 'critical' },
      { h: 20, m: 30, level: 'closure' } // 8:30 PM
    ];

    for (const tp of timePoints) {
      if (hour === tp.h && minute === tp.m) {
        const eventCode = `DAY_NOT_STARTED_${tp.level.toUpperCase()}`;
        if (!(await hasEvent(userId, eventCode, todayKey))) {
          const { sendWhatsAppButtons } = await import('./whatsappService.js');
          const sent = await sendWhatsAppButtons('91YOURNUMBER', 
            `MentorOS Alert\n\nToday’s plan is not uploaded yet (${tp.h}:${tp.m === 0 ? '00' : tp.m}).\n\nAre you studying without uploading the plan?\n\nChoose one:`, 
            [
              { id: 'I_AM_STUDYING', title: 'I am studying' },
              { id: 'UPLOAD_PLAN', title: 'Upload plan now' },
              { id: 'START_RESCUE_MODE', title: 'Start Rescue Mode' }
            ]
          );
          if (sent) {
            await recordEvent(userId, eventCode, todayKey);
          }
        }
      }
    }
  }

  // DAY_SLIPPING_BADLY
  if (hasPlan && hour >= 15) {
    let totalPlanned = 0;
    let totalCompleted = 0;
    for (const b of rows) {
      totalPlanned += (b.planned_minutes || 0);
      if (b.status === 'completed' || b.status === 'partial') {
        totalCompleted += (b.actual_minutes || b.planned_minutes || 0);
      } else if (b.status === 'active' || b.status === 'paused') {
         // rough estimate
         totalCompleted += (b.actual_minutes || 0);
      }
    }
    
    const plannedHours = totalPlanned / 60;
    const completedHours = totalCompleted / 60;
    const executionRate = totalPlanned > 0 ? (totalCompleted / totalPlanned) : 0;

    if (
      (executionRate < 0.30) ||
      (plannedHours >= 6 && completedHours <= 1.5)
    ) {
      if (!(await hasEvent(userId, 'DAY_SLIPPING_BADLY', todayKey))) {
        const { sendWhatsAppButtons } = await import('./whatsappService.js');
        const sent = await sendWhatsAppButtons('91YOURNUMBER', 
          `MentorOS Rescue Alert\n\nToday is slipping, but it is not lost.\n\nDo not try to complete the full plan now.\nStart Rescue Mode: only 3 serious blocks for the remaining day.\n\nChoose one:`, 
          [
            { id: 'START_RESCUE_MODE', title: 'Start Rescue Mode' },
            { id: 'CONTINUE_CURRENT_PLAN', title: 'Continue Plan' },
            { id: 'NEED_RESET', title: 'Need Reset' }
          ]
        );
        if (sent) {
          await recordEvent(userId, 'DAY_SLIPPING_BADLY', todayKey);
        }
      }
    }
  }
}

// Helper: Check if an event was logged recently in plan_block_events
async function hasEventRecent(userId, eventType, sourceId, minutes) {
  const { rows } = await query(
    `SELECT id FROM public.plan_block_events 
     WHERE user_id = $1 AND event_type = $2 AND (metadata->>'source_id') = $3
     AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
    [userId, eventType, sourceId]
  );
  return rows.length > 0;
}

// Helper: Query notification_events or plan_block_events to see if a notification was already sent
async function hasEvent(userId, notificationType, sourceId) {
  const { rows: r1 } = await query(
    `SELECT id FROM public.notification_events 
     WHERE user_id = $1 AND notification_type = $2 AND source_id = $3 AND status = 'sent'`,
    [userId, notificationType, sourceId]
  );
  if (r1.length > 0) return true;

  const { rows: r2 } = await query(
    `SELECT id FROM public.plan_block_events 
     WHERE user_id = $1 AND event_type = $2 AND (metadata->>'source_id') = $3`,
    [userId, notificationType, sourceId]
  );
  return r2.length > 0;
}

// Helper: Atomic lock utilizing notification_events unique constraint
async function acquireAtomicLock(userId, notificationType, sourceId) {
  try {
    const { rows } = await query(
      `INSERT INTO public.notification_events 
         (user_id, notification_type, source_type, source_id, channel_type, status, sent_at)
       VALUES ($1, $2, 'daily_date', $3, 'SYSTEM_LOCK', 'pending', NOW())
       ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
       DO UPDATE SET status = 'pending', sent_at = NOW()
       WHERE public.notification_events.status = 'failed' 
          OR (public.notification_events.status = 'pending' AND public.notification_events.sent_at < NOW() - INTERVAL '15 minutes')
       RETURNING id`,
      [userId, notificationType, sourceId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[NotificationScheduler acquireAtomicLock Error]", err.message);
    return false;
  }
}

async function updateAtomicLockStatus(userId, notificationType, sourceId, status) {
  try {
    await query(
      `UPDATE public.notification_events 
       SET status = $1 
       WHERE user_id = $2 AND notification_type = $3 AND source_id = $4 AND channel_type = 'SYSTEM_LOCK'`,
      [status, userId, notificationType, sourceId]
    );
  } catch (err) {
    console.error("[NotificationScheduler updateAtomicLockStatus Error]", err.message);
  }
}

// Helper: Record event in plan_block_events for audit
async function recordEvent(userId, eventType, sourceId) {
  try {
    await query(
      `INSERT INTO public.plan_block_events (user_id, event_type, metadata)
       VALUES ($1, $2, $3)`,
      [userId, eventType, JSON.stringify({ source_id: sourceId, recorded_at: new Date() })]
    );
  } catch (err) {
    console.error("[NotificationScheduler recordEvent Error]", err.message);
  }
}

// Helper: Get yesterday's date key in Kolkata timezone
function getYesterdayKey(now) {
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function checkUserPlanState(userId, todayKey) {
  const { rows } = await query(
    `SELECT id, status, planned_minutes, actual_minutes, source_type, title, subject, topic 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, todayKey]
  );

  const hasCompletedBlock = rows.some(b => 
    ['completed', 'done', 'partial'].includes((b.status || '').toLowerCase()) || ((b.actual_minutes || 0) > 0)
  );

  const realPlanBlocks = rows.filter(b => {
    const plannedMins = b.planned_minutes || 0;
    const src = (b.source_type || '').toLowerCase();
    const titleStr = (b.title || b.subject || b.topic || '').toLowerCase();
    
    const isUserSource = src.length > 0 && !['placeholder', 'system'].includes(src);
    const hasMeaningfulTitle = titleStr.length > 0 && !titleStr.includes('placeholder');
    
    return plannedMins > 0 || isUserSource || hasMeaningfulTitle;
  });

  const hasRealPlan = realPlanBlocks.length > 0;
  return { rows, totalBlocks: rows.length, realBlocksCount: realPlanBlocks.length, hasRealPlan, hasCompletedBlock };
}
export const lastSkipLogTimes = new Map();

export function logEscalationDebug(type, userId, userName, state, zeroStreak, totalBlocks, hasRealPlan, hasCompletedBlock, lockAcquired, action, reason, sourceId = 'unknown', deps = { now: Date.now }) {
  if (action === 'SKIP') {
    const key = `${type}_${userId}_${sourceId}`;
    const now = deps.now();
    const lastLogged = lastSkipLogTimes.get(key);
    
    if (lastLogged && (now - lastLogged) < 15 * 60 * 1000) {
      return;
    }

    // Set new timestamp (moves to back of Map for insertion order tracking)
    lastSkipLogTimes.delete(key);
    lastSkipLogTimes.set(key, now);
    
    // 15-minute TTL cleanup
    for (const [k, v] of lastSkipLogTimes.entries()) {
      if (now - v >= 15 * 60 * 1000) {
        lastSkipLogTimes.delete(k);
      } else {
        // Map iterates in insertion order, so if this one isn't stale, the rest aren't either (mostly)
        // Wait, because we delete and re-insert, the first elements are genuinely the oldest.
        break; 
      }
    }
    
    // Hard maximum size of 1000 entries: evict oldest
    if (lastSkipLogTimes.size > 1000) {
      const keys = lastSkipLogTimes.keys();
      while (lastSkipLogTimes.size > 1000) {
        lastSkipLogTimes.delete(keys.next().value);
      }
    }
  }
  const timeStr = new Date(deps && deps.now ? deps.now() : Date.now()).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  console.log(`[ESCALATION_DEBUG] type=${type} userId=${userId} userName=${userName} state=${state} zeroStreak=${zeroStreak} blocks=${totalBlocks} hasRealPlan=${hasRealPlan} hasCompletedBlock=${hasCompletedBlock} lock=${lockAcquired} action=${action} reason="${reason}" time="${timeStr}"`);
}


