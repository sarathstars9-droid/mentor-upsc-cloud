import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as notificationService from './notificationService.js';

let schedulerInterval = null;

// Initialize the scheduler background timer
export function initNotificationScheduler(userId = 'moulika') {
  if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== "true") {
    console.log("[NotificationScheduler] Scheduler is disabled via ENABLE_NOTIFICATION_SCHEDULER. Skipping startup.");
    return;
  }
  if (schedulerInterval) return;
  
  console.log(`[NotificationScheduler] Initializing notification scheduler for user: ${userId}`);
  
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

  // ── 2. Daily Revision Due Alert (08:30 AM) ───────────────────────────────────
  if (hour === 8 && minute === 30) {
    try {
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
      }
    } catch (err) {
      console.error("[NotificationScheduler] revision due alert failed:", err.message);
    }
  }

  // ── 3. Daily End-of-Day Report (10:00 PM) ──────────────────────────────────
  if (hour === 22 && minute === 0) {
    try {
      const data = await progressService.getDailyProgressReport(userId);
      const text = reportGeneratorService.generateDailyReport(data);
      await notificationService.sendNotification(
        userId, 
        'END_OF_DAY_REPORT', 
        'daily_date', 
        todayKey, 
        text, 
        {}
      );
    } catch (err) {
      console.error("[NotificationScheduler] end of day report failed:", err.message);
    }
  }

  // ── 4. Weekly Mentor Report (Sunday 09:00 PM) ──────────────────────────────────
  if (dayOfWeek === 0 && hour === 21 && minute === 0) {
    try {
      const data = await progressService.getWeeklyProgressReport(userId);
      const text = reportGeneratorService.generateWeeklyReport(data);
      await notificationService.sendNotification(
        userId, 
        'WEEKLY_MENTOR_REPORT', 
        'weekly_date', 
        todayKey, 
        text, 
        {}
      );
    } catch (err) {
      console.error("[NotificationScheduler] weekly mentor report failed:", err.message);
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
      console.log(`[NotificationScheduler] Block ${b.block_id} has passed end time (${b.planned_end}) without start. Marking missed.`);
      
      // 1. Update block status in PostgreSQL database
      await query(
        `UPDATE public.study_blocks 
         SET status = 'missed', 
             ended_at = NOW(), 
             completion_reason = 'missed', 
             updated_at = NOW() 
         WHERE id = $1`,
        [b.id]
      );
      
      // 2. Log study_event in plan_block_events
      await query(
        `INSERT INTO public.plan_block_events (user_id, block_id, event_type, metadata)
         VALUES ($1, $2, 'BLOCK_MISSED', $3)`,
        [userId, b.id, JSON.stringify({ block_id: b.block_id, subject: b.subject, planned_end: b.planned_end })]
      );

      // 3. Send MISSED_BLOCK_ALERT via notificationService
      const alertText = `⚠️ *Missed Block Alert*
Moulika, your *${b.subject}* block (planned for ${b.planned_start} - ${b.planned_end}) was missed. Keep focus and adjust your schedule!`;
      
      await notificationService.sendNotification(
        userId,
        'MISSED_BLOCK_ALERT',
        'block',
        String(b.id),
        alertText,
        { block_id: b.id, subject: b.subject }
      );
    }
  }
}
