import { query } from '../db/index.js';

/**
 * Single source-of-truth for daily execution progress calculation.
 * No other service should calculate completed blocks or studied minutes manually.
 */
export async function getDailyExecutionSummary(userId, dayKey) {
  const { rows } = await query(
    `SELECT
       id,
       title,
       subject,
       topic,
       status,
       day_key,
       planned_start,
       planned_end,
       planned_minutes,
       COALESCE(actual_minutes, 0) AS actual_minutes,
       started_at,
       ended_at,
       total_pause_seconds
     FROM public.study_blocks
     WHERE user_id = $1
       AND day_key = $2
     ORDER BY planned_start ASC`,
    [userId, dayKey]
  );

  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);

  let totalBlocks = rows.length;
  let completedBlocksCount = 0;
  let missedBlocksCount = 0;
  let plannedMinutesTotal = 0;
  let studiedMinutesTotal = 0;

  const subjectsCompleted = new Set();
  const subjectMinutes = {};
  const blockRows = [];

  for (const b of rows) {
    const st = String(b.status || '').toLowerCase();
    const plannedMins = b.planned_minutes || 0;
    const actualMins = b.actual_minutes || 0;
    const titleOrTopic = b.title || b.topic || b.subject;

    plannedMinutesTotal += plannedMins;

    // 1. Completion truth
    const isCompletedStatus = ['done', 'completed', 'partial'].includes(st);
    const isCompleted = isCompletedStatus || actualMins > 0;

    // 2. Effective minutes truth
    let effectiveMinutes = 0;
    if (actualMins > 0) {
      effectiveMinutes = actualMins;
    } else if (isCompletedStatus && b.started_at && b.ended_at) {
      const startT = new Date(b.started_at).getTime();
      const endT = new Date(b.ended_at).getTime();
      const rawSecs = Math.max(0, Math.floor((endT - startT) / 1000) - (b.total_pause_seconds || 0));
      effectiveMinutes = Math.round(rawSecs / 60);
    } else if (isCompletedStatus) {
      effectiveMinutes = plannedMins;
    }

    if (isCompleted) {
      completedBlocksCount++;
      studiedMinutesTotal += effectiveMinutes;
      if (b.subject) {
        subjectsCompleted.add(b.subject);
        subjectMinutes[b.subject] = (subjectMinutes[b.subject] || 0) + effectiveMinutes;
      }
    }

    // 3. Missed block truth
    let isMissed = false;
    let skipReason = '';
    
    if (['missed', 'skipped'].includes(st)) {
      isMissed = true;
      skipReason = 'Status explicitly marked missed/skipped';
    } else if (['planned', 'ready', 'upcoming'].includes(st) && b.planned_end && effectiveMinutes === 0) {
      // Parse planned_end
      const [endH, endM] = b.planned_end.split(':').map(Number);
      const plannedEndDate = new Date(d);
      plannedEndDate.setHours(endH, endM, 0, 0);

      // We only consider it missed if the whole day passed or if current time > planned_end
      // Be careful: if dayKey is strictly in the past, it's definitely missed.
      const isPastDay = new Date(`${dayKey}T00:00:00+05:30`).getTime() < new Date(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T00:00:00+05:30`).getTime();
      
      if (isPastDay || d.getTime() > plannedEndDate.getTime()) {
        isMissed = true;
        skipReason = 'Past planned end time';
      }
    }

    if (isMissed) {
      missedBlocksCount++;
    }

    blockRows.push({
      id: b.id,
      title: titleOrTopic,
      subject: b.subject,
      status: st,
      planned_start: b.planned_start,
      planned_end: b.planned_end,
      plannedMinutes: plannedMins,
      actualMinutes: actualMins,
      effectiveMinutes,
      isCompleted,
      isMissed,
      skipReason
    });
  }

  const executionRate = plannedMinutesTotal > 0 ? (studiedMinutesTotal / plannedMinutesTotal) * 100 : 0;

  return {
    userId,
    dayKey,
    totalBlocks,
    completedBlocks: completedBlocksCount,
    missedBlocks: missedBlocksCount,
    plannedMinutes: plannedMinutesTotal,
    studiedMinutes: studiedMinutesTotal,
    executionRate: Number(executionRate.toFixed(1)),
    subjectsCompleted: Array.from(subjectsCompleted),
    subjectMinutes,
    blockRows
  };
}
