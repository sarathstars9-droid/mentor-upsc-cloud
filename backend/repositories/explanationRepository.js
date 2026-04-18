import { query } from "../db/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Upsert (save or update) explanation for a user + question
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertExplanation(data) {
  const { userId, questionId, explanationText, source } = data;

  if (!userId || !questionId || !explanationText) {
    throw new Error("userId, questionId, and explanationText are required");
  }

  const sql = `
    INSERT INTO pyq_explanations (
      user_id,
      question_id,
      explanation_text,
      source
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, question_id)
    DO UPDATE SET
      explanation_text = EXCLUDED.explanation_text,
      source = EXCLUDED.source,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [userId, questionId, explanationText, source || "chatgpt"];
  const result = await query(sql, values);
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get explanation for a specific user + question
// ─────────────────────────────────────────────────────────────────────────────
export async function getExplanation(userId, questionId) {
  if (!userId || !questionId) return null;

  const sql = `
    SELECT * FROM pyq_explanations
    WHERE user_id = $1 AND question_id = $2
    LIMIT 1;
  `;

  const result = await query(sql, [userId, questionId]);
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get multiple explanations for a user by question IDs (bulk fetch)
// ─────────────────────────────────────────────────────────────────────────────
export async function getExplanationsByQuestionIds(userId, questionIds = []) {
  if (!userId || questionIds.length === 0) return [];

  const sql = `
    SELECT * FROM pyq_explanations
    WHERE user_id = $1 AND question_id = ANY($2)
    ORDER BY created_at DESC;
  `;

  const result = await query(sql, [userId, questionIds]);
  return result.rows || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete explanation
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteExplanation(userId, questionId) {
  if (!userId || !questionId) return false;

  const sql = `
    DELETE FROM pyq_explanations
    WHERE user_id = $1 AND question_id = $2
    RETURNING id;
  `;

  const result = await query(sql, [userId, questionId]);
  return result.rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// List all explanations for a user (paginated)
// ─────────────────────────────────────────────────────────────────────────────
export async function listExplanationsByUser(userId, limit = 100, offset = 0) {
  if (!userId) return [];

  const sql = `
    SELECT * FROM pyq_explanations
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT $2 OFFSET $3;
  `;

  const result = await query(sql, [userId, limit, offset]);
  return result.rows || [];
}
