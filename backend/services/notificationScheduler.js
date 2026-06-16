import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as notificationService from './notificationService.js';
import * as consistencyService from './consistencyService.js';
import * as behaviorEscalationService from './behaviorEscalationService.js';
import * as psychologyMessageService from './psychologyMessageService.js';

let schedulerInterval = null;

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
  
  // Tick every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      await tickScheduler(userId);
    } catch (err) {
      console.error("[NotificationScheduler Tick Error]", err);
    }
  }, 60 * 1000);

  // Run a startup check immediately
  setTimeout(() => {
    tickScheduler(userId).catch(err => console.error("[NotificationScheduler Startup Tick Error]", err));
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
  
  // 1. Get Kolkata timezone details
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  
  const hour = d.getHours();
  const minute = d.getMinutes();
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...

  // ── 1. Process Today's Blocks (Reminders, Pauses, Missed) ──────────────
  try {
    await processTodayBlocks(userId, now);
  } catch (err) {
    console.error("[NotificationScheduler] processTodayBlocks failed:", err.message);
  }

  // ── 1.b Discipline Checks (DAY_NOT_STARTED, SLIPPING) ──────────────────────
  try {
    await detectAndProcessDayDiscipline(userId, now);
  } catch (err) {
    console.error("[NotificationScheduler] discipline checks failed:", err.message);
  }

  // ── 1.b Good Morning Mission (05:00 AM) ────────────────────────────────────
  if (hour === 5 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'GOOD_MORNING_MISSION', todayKey))) {
        const yesterdayKey = getYesterdayKey(now);
        // Run daily risk analyzer before consistency record and report generation
        await behaviorEscalationService.analyzeDailyRisk(userId, todayKey);
        await consistencyService.recordDailyConsistency(userId, yesterdayKey);
        const data = await progressService.getGoodMorningReportData(userId);
        const text = reportGeneratorService.generateGoodMorningReport(data, "Moulika");
        await notificationService.sendNotification(userId, 'GOOD_MORNING_MISSION', 'daily_date', todayKey, text, {});
        await recordEvent(userId, 'GOOD_MORNING_MISSION', todayKey);
      }
    } catch (err) {
      console.error("[NotificationScheduler] good morning report failed:", err.message);
    }
  }

  // ── 1.c Plan Not Uploaded Alert (06:00 AM) ─────────────────────────────────
  if (hour === 6 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'PLAN_NOT_UPLOADED', todayKey))) {
        const { rows } = await query(`SELECT id FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [userId, todayKey]);
        if (rows.length === 0) {
          const userRes = await query(`SELECT mission_health_state FROM public.users WHERE id = $1`, [userId]);
          const state = userRes.rows[0]?.mission_health_state || 'HEALTHY';
          const text = psychologyMessageService.getPlanNotUploadedMessage(state, "Moulika");
          
          await notificationService.sendNotification(userId, 'PLAN_NOT_UPLOADED', 'daily_date', todayKey, text, {});
          await recordEvent(userId, 'PLAN_NOT_UPLOADED', todayKey);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] plan not uploaded check failed:", err.message);
    }
  }

  // ── 2. Daily Revision Due Alert (08:30 AM) ───────────────────────────────────
  if (hour === 8 && minute === 30) {
    try {
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
    } catch (err) {
      console.error("[NotificationScheduler] revision due alert failed:", err.message);
    }
  }

  // ── 3. Daily Night Report (10:00 PM) ──────────────────────────────────
  if (hour === 22 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'DAILY_NIGHT_REPORT', todayKey))) {
        const data = await progressService.getDailyNightReportData(userId, todayKey);
        const text = reportGeneratorService.generateDailyNightReport(data, "Moulika");
        await notificationService.sendNotification(
          userId, 
          'DAILY_NIGHT_REPORT', 
          'daily_date', 
          todayKey, 
          text, 
          {}
        );
        await recordEvent(userId, 'DAILY_NIGHT_REPORT', todayKey);
      }
    } catch (err) {
      console.error("[NotificationScheduler] daily night report failed:", err.message);
    }
  }

  // ── 4. Weekly Mentor Report (Sunday 09:00 PM) ──────────────────────────────────
  if (dayOfWeek === 0 && hour === 21 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'WEEKLY_MENTOR_REPORT', todayKey))) {
        const data = await progressService.getWeeklyExecutionSummary(userId);
        const text = reportGeneratorService.generateWeeklyMentorReport(data, "Moulika");
        await notificationService.sendNotification(
          userId, 
          'WEEKLY_MENTOR_REPORT', 
          'weekly_date', 
          todayKey, 
          text, 
          {}
        );
        await recordEvent(userId, 'WEEKLY_MENTOR_REPORT', todayKey);
      }
    } catch (err) {
      console.error("[NotificationScheduler] weekly mentor report failed:", err.message);
    }
  }

  // ── 5. Monthly Mentor Report (Last day of month at 09:30 PM) ────────────────
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getDate() === 1;

  if (isLastDayOfMonth && hour === 21 && minute === 30) {
    try {
      const monthKey = `${yyyy}-${mm}`;
      if (!(await hasEvent(userId, 'MONTHLY_MENTOR_REPORT', monthKey))) {
        const data = await progressService.getMonthlyMentorSummary(userId);
        const text = reportGeneratorService.generateMonthlyMentorTextReport(data, "Moulika");
        await notificationService.sendNotification(
          userId, 
          'MONTHLY_MENTOR_REPORT', 
          'monthly_date', 
          monthKey, 
          text, 
          {}
        );
        await recordEvent(userId, 'MONTHLY_MENTOR_REPORT', monthKey);
      }
      
      if (!(await hasEvent(userId, 'MONTHLY_MENTOR_REPORT_PDF', monthKey))) {
        const { sendMonthlyPdfReport } = await import('./monthlyPdfReportService.js');
        // Retrieve telegram chat id
        const { rows: channels } = await query(
          `SELECT destination_id FROM public.notification_channels 
           WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE LIMIT 1`,
          [userId]
        );
        if (channels.length > 0) {
          const chatId = channels[0].destination_id;
          await sendMonthlyPdfReport(userId, monthKey, chatId);
          await recordEvent(userId, 'MONTHLY_MENTOR_REPORT_PDF', monthKey);
        } else {
          console.log("[NotificationScheduler] Monthly PDF skipped, no telegram channel for user:", userId);
        }
      }
    } catch (err) {
      console.error("[NotificationScheduler] monthly report failed:", err.message);
    }
  }
}

// Unified block scanner for reminders, pause checks, and missed blocks
async function processTodayBlocks(userId, now) {
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
        if (!alreadySent15) {
          const alertText = `⚠️ *Plan Not Started*\nMoulika, your study plan for today was scheduled to start at ${earliest.planned_start}. It has been more than 15 minutes and you haven't started yet. Let's start the engine!`;
          await notificationService.sendNotification(userId, 'PLAN_NOT_STARTED', 'daily_date', todayKey, alertText, {});
          await recordEvent(userId, 'PLAN_NOT_STARTED', todayKey);
        }
        
        // PLAN_UPLOADED_NOT_STARTED (30+ mins) via WhatsApp
        if (d.getTime() > plannedStartDate.getTime() + 30 * 60 * 1000) {
          const alreadySent30 = await hasEvent(userId, 'PLAN_UPLOADED_NOT_STARTED', todayKey);
          if (!alreadySent30) {
            const { sendWhatsAppButtons } = await import('./whatsappService.js');
            await sendWhatsAppButtons('91YOURNUMBER', 
              "MentorOS Alert\n\nPlan is uploaded, but execution has not started yet.\n\nA plan without starting becomes mental load.\n\nChoose one:", 
              [
                { id: 'START_BLOCK_1', title: 'Start Block 1' },
                { id: 'OPEN_PLAN', title: 'Open Plan' },
                { id: 'START_RESCUE_MODE', title: 'Rescue Mode' }
              ]
            );
            await recordEvent(userId, 'PLAN_UPLOADED_NOT_STARTED', todayKey);
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
         // Generate a sourceId based on total pauses/duration so it doesn't spam infinitely but alerts when severity changes
         const severityStage = Math.floor(totalPausedMinutes / 30) + pauseCount;
         const sourceId = String(b.id) + '_' + severityStage;
         
         const alreadySent = await hasEvent(userId, 'BLOCK_TOO_MUCH_PAUSED', sourceId);
         if (!alreadySent) {
           const alertText = `⚠️ *Block Friction Detected*\nThis block (*${b.subject || 'Study'}*) has been paused too many times (${pauseCount} pauses, ${totalPausedMinutes}m total).\n\nChoose an action below to regain control:`;
           
           const { sendTelegramMessage } = await import('./telegramService.js');
           const chatId = process.env.TELEGRAM_CHAT_ID;
           if (chatId) {
             await sendTelegramMessage(chatId, alertText, {
               reply_markup: {
                 inline_keyboard: [
                   [{ text: "Continue 25m without pause", callback_data: "CONTINUE_BLOCK_25" }],
                   [{ text: "Reduce to smaller block", callback_data: "REDUCE_BLOCK" }],
                   [{ text: "Move to Rescue Mode", callback_data: "START_RESCUE_MODE" }]
                 ]
               }
             });
           }
           await recordEvent(userId, 'BLOCK_TOO_MUCH_PAUSED', String(b.id));
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
       if (!alreadySentStart) {
          const titleOrTopic = b.title || b.topic || b.subject;
          const alertText = `▶️ *Start Now: ${titleOrTopic} — ${b.subject}*\nScheduled: ${b.planned_start}–${b.planned_end || '?'}\nDuration: ${b.planned_minutes || 0} min\n\nMoulika, start this block now.\nDon’t think about the whole day. Win this block.`;
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
       if (!alreadySentCurrent) {
          const titleOrTopic = b.title || b.topic || b.subject;
          const alertText = `⚠️ *${titleOrTopic} not started*\n\nThis ${b.subject} block was scheduled at ${b.planned_start}.\nStart a 25-minute rescue version now.`;
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

         await query(
           `INSERT INTO public.plan_block_events (user_id, block_id, event_type, metadata)
            VALUES ($1, $2, 'BLOCK_MISSED', $3)`,
           [userId, b.id, JSON.stringify({ block_id: b.block_id, subject: b.subject, planned_end: b.planned_end })]
         );
       }
    }
  }
}

async function detectAndProcessDayDiscipline(userId, now) {
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
          await sendWhatsAppButtons('91YOURNUMBER', 
            `MentorOS Alert\n\nToday’s plan is not uploaded yet (${tp.h}:${tp.m === 0 ? '00' : tp.m}).\n\nAre you studying without uploading the plan?\n\nChoose one:`, 
            [
              { id: 'I_AM_STUDYING', title: 'I am studying' },
              { id: 'UPLOAD_PLAN', title: 'Upload plan now' },
              { id: 'START_RESCUE_MODE', title: 'Start Rescue Mode' }
            ]
          );
          await recordEvent(userId, eventCode, todayKey);
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
        await sendWhatsAppButtons('91YOURNUMBER', 
          `MentorOS Rescue Alert\n\nToday is slipping, but it is not lost.\n\nDo not try to complete the full plan now.\nStart Rescue Mode: only 3 serious blocks for the remaining day.\n\nChoose one:`, 
          [
            { id: 'START_RESCUE_MODE', title: 'Start Rescue Mode' },
            { id: 'CONTINUE_CURRENT_PLAN', title: 'Continue Plan' },
            { id: 'NEED_RESET', title: 'Need Reset' }
          ]
        );
        await recordEvent(userId, 'DAY_SLIPPING_BADLY', todayKey);
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

