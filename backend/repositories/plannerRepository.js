// backend/repositories/plannerRepository.js
// DB layer for the Adaptive Planner Engine.
// Handles suggestion logging and decay queries.

import { pool } from '../db/index.js';

// ── Decay: how many times was each subject+topic suggested recently? ──────────

export async function getRecentSuggestionCounts(userId, daysCutoff = 14) {
  try {
    const { rows } = await pool.query(
      `SELECT
         subject,
         COALESCE(topic, '') AS topic,
         COUNT(*)::INTEGER   AS suggestion_count
       FROM planner_suggestions_log
       WHERE user_id = $1
         AND suggested_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY subject, topic`,
      [userId, daysCutoff]
    );
    return rows;
  } catch (err) {
    // Table may not exist on first boot — treat as empty
    if (err.message.includes('does not exist')) return [];
    throw err;
  }
}

// ── Log a batch of surfaced suggestions (fire-and-forget) ─────────────────────

export async function logSuggestions(userId, blocks) {
  if (!blocks || blocks.length === 0) return;
  const subjects = blocks.map((b) => b.subject);
  const topics   = blocks.map((b) => b.topic || null);
  try {
    await pool.query(
      `INSERT INTO planner_suggestions_log (user_id, subject, topic)
       SELECT $1, UNNEST($2::TEXT[]), UNNEST($3::TEXT[])`,
      [userId, subjects, topics]
    );
  } catch (err) {
    if (err.message.includes('does not exist')) return; // first boot, ignore
    throw err;
  }
}

// ── Prune logs older than N days (call periodically / on boot) ────────────────

export async function pruneOldSuggestions(daysCutoff = 30) {
  try {
    await pool.query(
      `DELETE FROM planner_suggestions_log
       WHERE suggested_at < NOW() - ($1 * INTERVAL '1 day')`,
      [daysCutoff]
    );
  } catch {
    // non-fatal
  }
}
