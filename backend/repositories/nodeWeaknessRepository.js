import { query } from "../db/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// upsertNodeWeaknessScore
//
// Inserts or updates a single node's weakness metrics for a user.
// ON CONFLICT matches the (user_id, node_id, stage) unique constraint.
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertNodeWeaknessScore(data) {
  const sql = `
    INSERT INTO node_weakness_scores (
      user_id,
      node_id,
      stage,
      subject,
      mistake_count,
      repeat_mistake_count,
      pending_revision_count,
      overdue_revision_count,
      reviewed_count,
      snooze_count,
      weakness_score,
      risk_level,
      last_activity_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
    )
    ON CONFLICT (user_id, node_id, stage)
    DO UPDATE SET
      subject                = EXCLUDED.subject,
      mistake_count          = EXCLUDED.mistake_count,
      repeat_mistake_count   = EXCLUDED.repeat_mistake_count,
      pending_revision_count = EXCLUDED.pending_revision_count,
      overdue_revision_count = EXCLUDED.overdue_revision_count,
      reviewed_count         = EXCLUDED.reviewed_count,
      snooze_count           = EXCLUDED.snooze_count,
      weakness_score         = EXCLUDED.weakness_score,
      risk_level             = EXCLUDED.risk_level,
      last_activity_at       = EXCLUDED.last_activity_at,
      updated_at             = NOW()
    RETURNING *;
  `;

  const values = [
    data.user_id,
    data.node_id,
    data.stage || null,
    data.subject || null,
    data.mistake_count ?? 0,
    data.repeat_mistake_count ?? 0,
    data.pending_revision_count ?? 0,
    data.overdue_revision_count ?? 0,
    data.reviewed_count ?? 0,
    data.snooze_count ?? 0,
    data.weakness_score ?? 0,
    data.risk_level || "low",
    data.last_activity_at || null,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopWeakNodes
//
// Returns the top N weakest nodes for a user, sorted by weakness_score DESC.
// ─────────────────────────────────────────────────────────────────────────────
export async function getTopWeakNodes(userId, limit = 10) {
  const result = await query(
    `SELECT *
     FROM node_weakness_scores
     WHERE user_id = $1
     ORDER BY weakness_score DESC, updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// getWeaknessMap
//
// Returns all weakness scores for a user keyed by node_id.
// Useful for bulk lookups without multiple queries.
// ─────────────────────────────────────────────────────────────────────────────
export async function getWeaknessMap(userId) {
  const result = await query(
    `SELECT *
     FROM node_weakness_scores
     WHERE user_id = $1
     ORDER BY weakness_score DESC`,
    [userId]
  );

  // Build a map: node_id → row (or node_id+stage → row if stage matters)
  const map = {};
  for (const row of result.rows) {
    const key = row.stage ? `${row.node_id}::${row.stage}` : row.node_id;
    map[key] = row;
  }
  return map;
}
