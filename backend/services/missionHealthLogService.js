// backend/services/missionHealthLogService.js
import { query } from '../db/index.js';

/**
 * Log daily user mission health state metrics.
 */
export async function logDailyHealthState(
  userId,
  date,
  state,
  completedMinutes,
  expectedMinutes,
  backlogMinutes,
  consistencyPercentage,
  zeroStudyStreak,
  missedPlanStreak,
  recoveryScore
) {
  try {
    await query(
      `INSERT INTO public.daily_mission_health_logs (
        user_id,
        date,
        state,
        completed_minutes,
        expected_minutes,
        backlog_minutes,
        consistency_percentage,
        zero_study_streak,
        missed_plan_streak,
        recovery_score,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (user_id, date) 
      DO UPDATE SET
        state = EXCLUDED.state,
        completed_minutes = EXCLUDED.completed_minutes,
        expected_minutes = EXCLUDED.expected_minutes,
        backlog_minutes = EXCLUDED.backlog_minutes,
        consistency_percentage = EXCLUDED.consistency_percentage,
        zero_study_streak = EXCLUDED.zero_study_streak,
        missed_plan_streak = EXCLUDED.missed_plan_streak,
        recovery_score = EXCLUDED.recovery_score,
        created_at = NOW()`,
      [
        userId,
        date,
        state,
        completedMinutes || 0,
        expectedMinutes || 0,
        backlogMinutes || 0,
        consistencyPercentage || 0.00,
        zeroStudyStreak || 0,
        missedPlanStreak || 0,
        recoveryScore || 100
      ]
    );
    console.log(`[MissionHealthLogService] Logged daily health state for ${userId} on ${date}: state=${state}`);
  } catch (err) {
    console.error(`[MissionHealthLogService ERROR] Failed to log daily health state for ${userId} on ${date}:`, err);
  }
}

/**
 * Get recent health logs for a user.
 */
export async function getLatestLogs(userId, limit = 10) {
  const { rows } = await query(
    `SELECT * FROM public.daily_mission_health_logs 
     WHERE user_id = $1 
     ORDER BY date DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
