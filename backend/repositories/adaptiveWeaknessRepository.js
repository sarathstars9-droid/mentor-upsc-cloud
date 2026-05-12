import { query } from "../db/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// upsertNodeWeakness
//
// Computes attempt-based weakness metrics from pyq_attempts and upserts into
// the node_weakness table. Uses ON CONFLICT (user_id, node_id, stage) UPSERT.
//
// This is the core scoring function for the Adaptive Intelligence Layer.
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertNodeWeakness({ userId, nodeId, stage = "prelims" }) {
  if (!userId || !nodeId) return null;

  // Step 1: Aggregate raw metrics from pyq_attempts
  const metricsResult = await query(
    `SELECT
       COUNT(*)                                              AS attempts_count,
       COUNT(*) FILTER (WHERE is_correct = true)             AS correct_count,
       COUNT(*) FILTER (WHERE is_correct = false)            AS wrong_count,
       ROUND(
         (COUNT(*) FILTER (WHERE is_correct = true)::numeric /
          NULLIF(COUNT(*), 0)) * 100, 2
       )                                                     AS accuracy_percent,
       COALESCE(
         (SELECT subject_id FROM pyq_attempts
          WHERE user_id = $1 AND node_id = $2
          ORDER BY created_at DESC LIMIT 1),
         ''
       )                                                     AS subject,
       MAX(created_at)                                       AS last_attempted_at
     FROM pyq_attempts
     WHERE user_id = $1 AND node_id = $2`,
    [userId, nodeId]
  );

  const m = metricsResult.rows[0];
  if (!m || Number(m.attempts_count) === 0) return null;

  const attemptsCount = Number(m.attempts_count) || 0;
  const correctCount  = Number(m.correct_count) || 0;
  const wrongCount    = Number(m.wrong_count) || 0;
  const accuracyPct   = Number(m.accuracy_percent) || 0;
  const subject       = m.subject || "";
  const lastAttempted = m.last_attempted_at;

  // Step 2: Count repeated wrong answers (same question_id wrong > 1 time)
  const repeatResult = await query(
    `SELECT COUNT(*) AS repeated_wrong_count
     FROM (
       SELECT question_id
       FROM pyq_attempts
       WHERE user_id = $1 AND node_id = $2 AND is_correct = false
       GROUP BY question_id
       HAVING COUNT(*) > 1
     ) sub`,
    [userId, nodeId]
  );
  const repeatedWrongCount = Number(repeatResult.rows[0]?.repeated_wrong_count) || 0;

  // Step 3: Compute weakness_score using the formula
  const daysSinceLast = lastAttempted
    ? Math.floor((Date.now() - new Date(lastAttempted).getTime()) / 86_400_000)
    : 0;

  let score =
    (wrongCount * 3) +
    (repeatedWrongCount * 5) +
    (attemptsCount >= 3 && accuracyPct < 50 ? 10 : 0) +
    (daysSinceLast > 7 ? 2 : 0);

  score = Math.min(100, Math.max(0, score));

  // Step 4: Classify weakness level
  let weaknessLevel = "stable";
  if (score >= 71) weaknessLevel = "critical";
  else if (score >= 46) weaknessLevel = "weak";
  else if (score >= 21) weaknessLevel = "needs_revision";

  // Step 5: UPSERT into node_weakness
  const upsertResult = await query(
    `INSERT INTO node_weakness (
       user_id, node_id, stage, subject,
       attempts_count, correct_count, wrong_count,
       accuracy_percent, repeated_wrong_count,
       weakness_score, weakness_level,
       last_attempted_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (user_id, node_id, stage)
     DO UPDATE SET
       subject              = EXCLUDED.subject,
       attempts_count       = EXCLUDED.attempts_count,
       correct_count        = EXCLUDED.correct_count,
       wrong_count          = EXCLUDED.wrong_count,
       accuracy_percent     = EXCLUDED.accuracy_percent,
       repeated_wrong_count = EXCLUDED.repeated_wrong_count,
       weakness_score       = EXCLUDED.weakness_score,
       weakness_level       = EXCLUDED.weakness_level,
       last_attempted_at    = EXCLUDED.last_attempted_at,
       updated_at           = NOW()
     RETURNING *`,
    [
      userId, nodeId, stage || "prelims", subject,
      attemptsCount, correctCount, wrongCount,
      accuracyPct, repeatedWrongCount,
      score, weaknessLevel,
      lastAttempted,
    ]
  );

  return upsertResult.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopWeakNodes
//
// Returns the top N weakest nodes for recommendations, sorted by:
//   critical first → weak → needs_revision → highest score → most recent
// Optionally filter by stage.
// ─────────────────────────────────────────────────────────────────────────────
export async function getTopWeakNodes({ userId, stage, limit = 5 }) {
  const params = [userId, limit];
  let stageFilter = "";

  if (stage) {
    stageFilter = "AND stage = $3";
    params.push(stage);
  }

  const result = await query(
    `SELECT *
     FROM node_weakness
     WHERE user_id = $1
       AND weakness_level != 'stable'
       ${stageFilter}
     ORDER BY
       CASE weakness_level
         WHEN 'critical'       THEN 1
         WHEN 'weak'           THEN 2
         WHEN 'needs_revision' THEN 3
         ELSE 4
       END,
       weakness_score DESC,
       updated_at DESC
     LIMIT $2`,
    params
  );

  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// getNodeWeakness — single node lookup
// ─────────────────────────────────────────────────────────────────────────────
export async function getNodeWeakness({ userId, nodeId, stage = "prelims" }) {
  const result = await query(
    `SELECT * FROM node_weakness
     WHERE user_id = $1 AND node_id = $2 AND stage = $3`,
    [userId, nodeId, stage]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllNodeWeakness — full list for a user
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllNodeWeakness(userId) {
  const result = await query(
    `SELECT * FROM node_weakness
     WHERE user_id = $1
     ORDER BY weakness_score DESC, updated_at DESC`,
    [userId]
  );
  return result.rows;
}
