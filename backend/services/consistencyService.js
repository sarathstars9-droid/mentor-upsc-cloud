import { query } from '../db/index.js';
import * as progressService from './progressService.js';

export async function computeDailyConsistency(userId, dayKey) {
  // 1. Get daily progress
  const dateStr = dayKey || new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }).split(',')[0].split('/').reverse().join('-'); // basic conversion, better to pass explicit dayKey
  
  // Since progressService doesn't accept dayKey for daily progress, let's query study blocks directly for the given dayKey
  const { rows: blocks } = await query(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2
     ORDER BY planned_start ASC`,
    [userId, dayKey]
  );

  let totalActualSeconds = 0;
  let totalPlannedMinutes = 0;
  let outputCreated = 0;
  let touchedRevisionOrPYQ = false;
  let completedBlocks = 0;

  for (const b of blocks) {
    totalPlannedMinutes += b.planned_minutes || 0;
    
    let actualSec = 0;
    if (b.started_at) {
      if (['completed', 'partial', 'missed', 'skipped'].includes(b.status) && b.ended_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'paused' && b.paused_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.paused_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'active') {
        actualSec = Math.max(0, Math.floor((Date.now() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      }
    }
    totalActualSeconds += actualSec;

    if (['completed', 'partial'].includes(b.status)) {
      completedBlocks++;
      
      // Determine output created
      // Output is defined as blocks with specific tags, or just generally completed blocks?
      // "at least 1 output" - if any completed block has 'notes' or 'answer' or 'test' tags etc, or just completed blocks?
      // We will assume any completed block with 'Mains', 'PYQ', 'Test', 'Output' or if subject implies output (e.g., Answer Writing)
      const subLower = (b.subject || '').toLowerCase();
      const topicLower = (b.topic || '').toLowerCase();
      if (
        subLower.includes('answer') || topicLower.includes('answer') ||
        subLower.includes('test') || topicLower.includes('test') ||
        subLower.includes('notes') || topicLower.includes('notes') ||
        subLower.includes('output') || topicLower.includes('output')
      ) {
        outputCreated++;
      } else {
        // Just completing a block might not be an explicit output, but we can count any completed block > 30 mins as an output effort if no specific tags exist, 
        // OR let's just assume completing any block fulfills "1 output" for simplicity if user didn't specify strict tags. 
        // Actually, user said: "- at least 1 output" - let's map it to completedBlocks >= 1 for now, or check for specific keywords.
        if (completedBlocks > 0) outputCreated++; // Fallback: any completed block = output
      }

      // Check for Revision or PYQ
      if (
        subLower.includes('revision') || topicLower.includes('revision') ||
        subLower.includes('pyq') || topicLower.includes('pyq')
      ) {
        touchedRevisionOrPYQ = true;
      }
    }
  }

  const actualHours = totalActualSeconds / 3600.0;
  
  // Find daily target hours for the user
  const { rows: targetRows } = await query(
    `SELECT SUM(target_hours) as total_target FROM public.subject_targets WHERE user_id = $1`,
    [userId]
  );
  
  // Example: 3500 hours over 325 days = ~10.7 hours/day target. Or just compute from targetRows.
  // Actually, we can get daily target from total_planned_minutes or standard 10 hours.
  // We will assume daily target = 10 hours for now, or fetch from target. 
  // Let's assume daily target is total_planned_minutes / 60 if > 0, else 10.
  let dailyTargetHours = totalPlannedMinutes > 0 ? (totalPlannedMinutes / 60.0) : 10;
  
  // But wait, the user says "70% daily hour target". 
  const isHoursMet = actualHours >= (0.7 * dailyTargetHours);
  const isOutputMet = outputCreated >= 1;
  const isRevisionMet = touchedRevisionOrPYQ;

  let status = 'weak';
  let score = 0;

  if (isHoursMet && isOutputMet && isRevisionMet) {
    status = 'strong';
    score = 100;
  } else if (actualHours > 0 || completedBlocks > 0) {
    status = 'partial';
    score = 50;
  }

  return {
    day_key: dayKey,
    status,
    score,
    actual_hours: actualHours,
    target_hours: dailyTargetHours,
    is_hours_met: isHoursMet,
    is_output_met: isOutputMet,
    is_revision_met: isRevisionMet
  };
}

export async function recordDailyConsistency(userId, dayKey) {
  const result = await computeDailyConsistency(userId, dayKey);
  
  await query(
    `INSERT INTO public.daily_consistency (user_id, day_key, status, score, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT daily_consistency_user_day_unique 
     DO UPDATE SET status = EXCLUDED.status, score = EXCLUDED.score, metadata = EXCLUDED.metadata, updated_at = NOW()`,
    [
      userId, 
      dayKey, 
      result.status, 
      result.score, 
      JSON.stringify({
        actual_hours: result.actual_hours,
        target_hours: result.target_hours,
        is_hours_met: result.is_hours_met,
        is_output_met: result.is_output_met,
        is_revision_met: result.is_revision_met
      })
    ]
  );
  
  return result;
}

export async function getHeatmap(userId, days = 14) {
  const list = [];
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const todayDate = new Date(kolkataStr);
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    list.push(`${yyyy}-${mm}-${dd}`);
  }

  const { rows } = await query(
    `SELECT day_key, status FROM public.daily_consistency 
     WHERE user_id = $1 AND day_key = ANY($2)`,
    [userId, list]
  );

  const statusMap = {};
  for (const r of rows) {
    statusMap[r.day_key] = r.status;
  }

  return list.map(dayKey => ({
    day_key: dayKey,
    status: statusMap[dayKey] || 'weak'
  }));
}
