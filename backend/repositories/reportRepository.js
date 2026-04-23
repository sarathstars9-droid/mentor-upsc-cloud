// backend/repositories/reportRepository.js
// All SQL for the reporting system.  PostgreSQL is the only source of truth.
// All time values returned in seconds unless the field name says _minutes.
//
// Shared derived-time expression (mirrors computeBlockState.js logic in SQL):
//
//   actual_seconds =
//     CASE
//       WHEN started_at IS NULL THEN 0
//       WHEN status IN ('completed','partial','missed','skipped') AND ended_at IS NOT NULL
//            THEN GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::INT
//                           - total_pause_seconds)
//       WHEN status = 'paused' AND paused_at IS NOT NULL
//            THEN GREATEST(0, EXTRACT(EPOCH FROM (paused_at - started_at))::INT
//                           - total_pause_seconds)
//       WHEN status = 'active'
//            THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INT
//                           - total_pause_seconds)
//       ELSE 0
//     END

import { pool } from '../db/index.js';

// ── Reusable SQL fragment ─────────────────────────────────────────────────────

const ACTUAL_SECONDS_EXPR = `
  CASE
    WHEN started_at IS NULL THEN 0
    WHEN status IN ('completed','partial','missed','skipped') AND ended_at IS NOT NULL
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
                - total_pause_seconds)
    WHEN status = 'paused' AND paused_at IS NOT NULL
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (paused_at - started_at))::INTEGER
                - total_pause_seconds)
    WHEN status = 'active'
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
                - total_pause_seconds)
    ELSE 0
  END
`.trim();

const STUDIED_BLOCK_SELECT = `
  id,
  block_id,
  day_key,
  subject,
  topic,
  node_id,
  stage,
  source_type,
  planned_minutes,
  status,
  started_at,
  paused_at,
  ended_at,
  total_pause_seconds,
  pauses_count,
  (${ACTUAL_SECONDS_EXPR})                    AS actual_seconds,
  ROUND((${ACTUAL_SECONDS_EXPR}) / 60.0, 1)   AS actual_minutes_decimal
`.trim();

// ── Daily aggregate ───────────────────────────────────────────────────────────

export async function getDayAggregate(userId, dayKey) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                                   AS total_blocks,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)            AS started_blocks,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))  AS completed_blocks,
       SUM(planned_minutes)                                       AS total_planned_minutes,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS total_actual_seconds,
       SUM(total_pause_seconds)                                   AS total_pause_seconds,
       COUNT(DISTINCT subject) FILTER (WHERE started_at IS NOT NULL) AS subjects_studied
     FROM study_blocks
     WHERE user_id = $1 AND day_key = $2`,
    [userId, dayKey]
  );
  return rows[0];
}

// ── Studied block list for a date range ──────────────────────────────────────

export async function getStudiedBlocks(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT ${STUDIED_BLOCK_SELECT}
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL
     ORDER BY day_key ASC, started_at ASC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Subject-wise split for a date range ──────────────────────────────────────

export async function getSubjectWiseSplit(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(subject, 'Unknown')                               AS subject,
       COUNT(*)                                                   AS block_count,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))  AS completed_count,
       SUM(planned_minutes)                                       AS planned_minutes,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL
     GROUP BY subject
     ORDER BY actual_seconds DESC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Topic-wise split ──────────────────────────────────────────────────────────

export async function getTopicWiseSplit(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(subject, 'Unknown')                               AS subject,
       COALESCE(topic,   'Unknown')                               AS topic,
       node_id,
       stage,
       COUNT(*)                                                   AS block_count,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))  AS completed_count,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL
     GROUP BY subject, topic, node_id, stage
     ORDER BY actual_seconds DESC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Stage-wise split ──────────────────────────────────────────────────────────

export async function getStageWiseSplit(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(stage, 'unspecified')                             AS stage,
       COUNT(*)                                                   AS block_count,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL
     GROUP BY stage
     ORDER BY actual_seconds DESC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Source-type split ─────────────────────────────────────────────────────────

export async function getSourceTypeSplit(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(source_type, 'unspecified')                       AS source_type,
       COUNT(*)                                                   AS block_count,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL
     GROUP BY source_type
     ORDER BY actual_seconds DESC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Day-wise breakdown (for weekly / monthly charts) ─────────────────────────

export async function getDayWiseBreakdown(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       day_key,
       COUNT(*)                                                   AS total_blocks,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)            AS started_blocks,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))  AS completed_blocks,
       SUM(planned_minutes)                                       AS planned_minutes,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds,
       SUM(total_pause_seconds)                                   AS pause_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
     GROUP BY day_key
     ORDER BY day_key ASC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Weekly breakdown (for monthly reports: group by ISO week) ─────────────────

export async function getWeeklyBreakdown(userId, monthStart, monthEnd) {
  const { rows } = await pool.query(
    `SELECT
       TO_CHAR(day_key::DATE, 'IYYY-IW')                         AS iso_week,
       MIN(day_key)                                               AS week_start,
       MAX(day_key)                                               AS week_end,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)            AS started_blocks,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))  AS completed_blocks,
       SUM(${ACTUAL_SECONDS_EXPR})                                AS actual_seconds
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
     GROUP BY TO_CHAR(day_key::DATE, 'IYYY-IW')
     ORDER BY iso_week ASC`,
    [userId, monthStart, monthEnd]
  );
  return rows;
}

// ── Streak: consecutive calendar days with any study activity up to endDate ───
//
// Algorithm:
//   1. Collect distinct study days (day_key where started_at IS NOT NULL)
//   2. Assign a "group" by subtracting the row's rank from the date.
//      Consecutive dates produce the same group value.
//   3. The current streak = size of the group that includes the most-recent day.

export async function getStreak(userId, endDayKey) {
  const { rows } = await pool.query(
    `WITH study_days AS (
       SELECT DISTINCT day_key::DATE AS d
       FROM study_blocks
       WHERE user_id = $1
         AND started_at IS NOT NULL
         AND day_key <= $2
     ),
     ranked AS (
       SELECT d,
              d - (ROW_NUMBER() OVER (ORDER BY d DESC) * INTERVAL '1 day') AS grp
       FROM study_days
     ),
     groups AS (
       SELECT grp, COUNT(*) AS streak_len, MAX(d) AS latest_day
       FROM ranked
       GROUP BY grp
     )
     SELECT COALESCE(
       (SELECT streak_len
        FROM groups
        WHERE latest_day >= (CURRENT_DATE - INTERVAL '1 day')
        ORDER BY latest_day DESC
        LIMIT 1),
       0
     ) AS streak`,
    [userId, endDayKey]
  );
  return Number(rows[0]?.streak || 0);
}

// ── Range aggregate (daily + weekly/monthly summaries) ───────────────────────

export async function getRangeAggregate(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                                    AS total_blocks,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)             AS started_blocks,
       COUNT(*) FILTER (WHERE status IN ('completed','partial'))   AS completed_blocks,
       SUM(planned_minutes)                                        AS total_planned_minutes,
       SUM(${ACTUAL_SECONDS_EXPR})                                 AS total_actual_seconds,
       SUM(total_pause_seconds)                                    AS total_pause_seconds,
       COUNT(DISTINCT subject) FILTER (WHERE started_at IS NOT NULL) AS subjects_studied
     FROM study_blocks
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3`,
    [userId, startDayKey, endDayKey]
  );
  return rows[0];
}

// ── Count distinct study days in a range ─────────────────────────────────────

export async function countStudyDays(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT day_key) AS study_days
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND started_at IS NOT NULL`,
    [userId, startDayKey, endDayKey]
  );
  return Number(rows[0]?.study_days || 0);
}

// ── Missed / unstarted blocks in a past date range ───────────────────────────
// A block is "missed" if it was planned for a day that has already passed but
// was never started, or was explicitly marked missed/skipped.

export async function getMissedBlocks(userId, startDayKey, endDayKey) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(subject, 'Unknown') AS subject,
       COALESCE(topic,   '')        AS topic,
       day_key,
       status,
       planned_minutes
     FROM study_blocks
     WHERE user_id = $1
       AND day_key >= $2
       AND day_key <= $3
       AND day_key < CURRENT_DATE::TEXT
       AND (started_at IS NULL OR status IN ('missed','skipped'))
     ORDER BY day_key ASC, subject ASC`,
    [userId, startDayKey, endDayKey]
  );
  return rows;
}

// ── Audit: log a lifecycle event ──────────────────────────────────────────────

export async function logBlockEvent(userId, blockUuid, eventType, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO plan_block_events (user_id, block_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, blockUuid, eventType, metadata]
    );
  } catch (err) {
    // Non-fatal: logging failure must never break lifecycle operations
    console.error('[logBlockEvent]', err.message);
  }
}

// ── Phase 8: Knowledge Linkage Metrics for Reports ───────────────────────────

export async function getKnowledgeLinkageSummary(userId, startKey, endKey) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                                        AS total_links,
         COUNT(*) FILTER (WHERE bpl.status NOT IN ('skipped_generic','no_pyqs'))
                                                                         AS studied_topics_count,
         COUNT(*) FILTER (WHERE bpl.status IN ('started','completed'))   AS practiced_topics_count,
         COUNT(*) FILTER (WHERE bpl.status = 'recommended'
                            AND bpl.recommended_question_count > 0)      AS skipped_practice_count,
         COALESCE(SUM(bpl.attempted_question_count), 0)                  AS total_attempted,
         COALESCE(SUM(bpl.correct_count), 0)                             AS total_correct,
         COALESCE(SUM(bpl.wrong_count), 0)                               AS total_wrong
       FROM block_pyq_links bpl
       JOIN study_blocks pb ON pb.id = bpl.block_id
       WHERE bpl.user_id = $1
         AND pb.day_key >= $2
         AND pb.day_key <= $3`,
      [userId, startKey, endKey]
    );
    return rows[0] || null;
  } catch (err) {
    // block_pyq_links may not exist yet
    if (err.message?.includes('does not exist') || err.code === '42P01') {
      return null;
    }
    console.error('[getKnowledgeLinkageSummary]', err.message);
    return null;
  }
}
