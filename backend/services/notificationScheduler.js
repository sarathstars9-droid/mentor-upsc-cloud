import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as notificationService from './notificationService.js';
import * as consistencyService from './consistencyService.js';

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

  // ── 1. Missed Study Blocks Detector ──────────────────────────────────────────
  try {
    await detectAndProcessMissedBlocks(userId, now);
  } catch (err) {
    console.error("[NotificationScheduler] missed blocks check failed:", err.message);
  }

  // ── 1.a Active/Paused Blocks Alert ──────────────────────────────────────────
  try {
    await detectAndProcessDelayedBlocks(userId, now);
  } catch (err) {
    console.error("[NotificationScheduler] delayed blocks check failed:", err.message);
  }

  // ── 1.b Good Morning Mission (05:00 AM) ────────────────────────────────────
  if (hour === 5 && minute === 0) {
    try {
      if (!(await hasEvent(userId, 'GOOD_MORNING_MISSION', todayKey))) {
        const yesterdayKey = getYesterdayKey(now);
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
          const text = `⚠️ *Plan Not Uploaded*
Moulika, it's 6 AM and your daily plan is missing. Please upload your study blocks for today!`;
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
        const data = await progressService.getWeeklyProgressReport(userId);
        const text = reportGeneratorService.generateWeeklyReport(data, "Moulika", { fullBreakdown: false });
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
        const data = await progressService.getMonthlyProgressReport(userId, monthKey);
        const text = reportGeneratorService.generateMonthlyReport(data, "Moulika");
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
    } catch (err) {
      console.error("[NotificationScheduler] monthly report failed:", err.message);
    }
  }
}

// Scans today's blocks, marks uncompleted ones past planned_end as missed, and alerts
async function detectAndProcessMissedBlocks(userId, now) {
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  // Fetch planned blocks for today
  const { rows: blocks } = await query(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2 AND status = 'planned' AND started_at IS NULL`,
    [userId, todayKey]
  );

  for (const b of blocks) {
    if (!b.planned_end) continue;
    
    // Construct planned end time in Kolkata timezone
    const plannedEndDate = new Date(`${b.day_key}T${b.planned_end}:00+05:30`);
    
    // If current time is past planned_end and it's still marked planned
    if (now.getTime() > plannedEndDate.getTime()) {
      const stableBlockId = b.block_id;
      console.log(`[NotificationScheduler] Block ${stableBlockId} has passed end time (${b.planned_end}) without start. Marking missed.`);
      
      // 3. Resolve to the real study_blocks.id
      const dbCheckRes = await query(
        `SELECT id FROM public.study_blocks 
         WHERE user_id = $1 
         AND (block_id = $2 OR (day_key = $3 AND subject = $4 AND planned_start = $5))
         LIMIT 1`,
        [userId, stableBlockId, b.day_key, b.subject, b.planned_start]
      );

      // 4. If no DB study_blocks row exists yet, skip
      if (dbCheckRes.rows.length === 0) {
        console.log(`[NotificationScheduler] Skipped missed event because study block row not found for stable id: ${stableBlockId}`);
        continue;
      }

      const realDbId = dbCheckRes.rows[0].id;

      // 6. Ensure missed status update also uses the correct DB block row
      await query(
        `UPDATE public.study_blocks 
         SET status = 'missed', 
             ended_at = NOW(), 
             completion_reason = 'missed', 
             updated_at = NOW() 
         WHERE id = $1`,
        [realDbId]
      );
      
      // 5. Add idempotency check for plan_block_events
      const eventCheckRes = await query(
        `SELECT id FROM public.plan_block_events 
         WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED' LIMIT 1`,
        [userId, realDbId]
      );

      if (eventCheckRes.rows.length === 0) {
        await query(
          `INSERT INTO public.plan_block_events (user_id, block_id, event_type, metadata)
           VALUES ($1, $2, 'BLOCK_MISSED', $3)`,
          [userId, realDbId, JSON.stringify({ block_id: stableBlockId, subject: b.subject, planned_end: b.planned_end })]
        );
      } else {
        console.log(`[NotificationScheduler] Missed event already exists for block ${realDbId}, skipping insert.`);
      }

      // 3. Send MISSED_BLOCK_ALERT via notificationService
      const alertText = `⚠️ *Missed Block Alert*
Moulika, your *${b.subject}* block (planned for ${b.planned_start} - ${b.planned_end}) was missed. Keep focus and adjust your schedule!`;
      
      await notificationService.sendNotification(
        userId,
        'MISSED_BLOCK_ALERT',
        'block',
        String(realDbId),
        alertText,
        { block_id: realDbId, subject: b.subject }
      );
    }
  }
}

// Scans active/paused study blocks for plan-not-started and paused-too-long alerts
async function detectAndProcessDelayedBlocks(userId, now) {
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  // 1. Plan not started check:
  // If today's study_blocks exist but no block is active/completed within 15 minutes after first planned_start
  const { rows: todayBlocks } = await query(
    `SELECT id, planned_start, status FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2
     ORDER BY planned_start ASC`,
    [userId, todayKey]
  );

  if (todayBlocks.length > 0) {
    const earliest = todayBlocks[0];
    if (earliest.planned_start) {
      const [startH, startM] = earliest.planned_start.split(':').map(Number);
      const plannedStartDate = new Date(d);
      plannedStartDate.setHours(startH, startM, 0, 0);

      // 15 minutes window
      if (d.getTime() > plannedStartDate.getTime() + 15 * 60 * 1000) {
        const startedOrDone = todayBlocks.some(b => ['active', 'completed', 'partial', 'paused'].includes(b.status));
        if (!startedOrDone) {
          const alreadySent = await hasEvent(userId, 'PLAN_NOT_STARTED', todayKey);
          if (!alreadySent) {
            const alertText = `⚠️ *Plan Not Started*
Moulika, your study plan for today was scheduled to start at ${earliest.planned_start}. It has been more than 15 minutes and you haven't started yet. Let's start the engine!`;
            await notificationService.sendNotification(userId, 'PLAN_NOT_STARTED', 'daily_date', todayKey, alertText, {});
            await recordEvent(userId, 'PLAN_NOT_STARTED', todayKey);
          }
        }
      }
    }
  }

  // 2. Paused-too-long check:
  // If block status = paused and paused duration > 20 minutes
  const { rows: pausedBlocks } = await query(
    `SELECT id, subject, topic, paused_at FROM public.study_blocks 
     WHERE user_id = $1 AND status = 'paused'`,
    [userId]
  );

  for (const pb of pausedBlocks) {
    if (pb.paused_at) {
      const pausedTime = new Date(pb.paused_at).getTime();
      if (now.getTime() - pausedTime > 20 * 60 * 1000) {
        const alreadySent = await hasEvent(userId, 'BLOCK_PAUSED_TOO_LONG', String(pb.id));
        if (!alreadySent) {
          const alertText = `⏸️ *Block Paused Too Long*
Moulika, your study block *${pb.subject || 'Study'}* (topic: ${pb.topic || 'unspecified'}) has been paused for more than 20 minutes. Let's resume and lock this in!`;
          await notificationService.sendNotification(userId, 'BLOCK_PAUSED_TOO_LONG', 'block', String(pb.id), alertText, {});
          await recordEvent(userId, 'BLOCK_PAUSED_TOO_LONG', String(pb.id));
        }
      }
    }
  }
}

// Helper: Query notification_events to see if a notification was already sent
async function hasEvent(userId, notificationType, sourceId) {
  const { rows } = await query(
    `SELECT id FROM public.notification_events 
     WHERE user_id = $1 AND notification_type = $2 AND source_id = $3 AND status = 'sent'`,
    [userId, notificationType, sourceId]
  );
  return rows.length > 0;
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

