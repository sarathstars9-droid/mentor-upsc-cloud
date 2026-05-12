// backend/repositories/prelimsTestRepository.js
import { query, withTransaction } from "../db/index.js";

// ── Attempts ─────────────────────────────────────────────────────────────────

export async function createAttempt(data) {
  const sql = `
    INSERT INTO prelims_test_attempts
      (user_id, mode, stage, paper, title, node_id, year, total_questions, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'in_progress')
    RETURNING *
  `;
  const values = [
    data.user_id,
    data.mode,
    data.stage || "prelims",
    data.paper,
    data.title || null,
    data.node_id || null,
    data.year || null,
    data.total_questions || 0,
  ];
  const result = await query(sql, values);
  return result.rows[0];
}

export async function getAttemptById(attemptId) {
  const result = await query(
    `SELECT * FROM prelims_test_attempts WHERE id = $1 LIMIT 1`,
    [attemptId]
  );
  return result.rows[0] || null;
}

export async function updateAttemptSummary(attemptId, data) {
  const sql = `
    UPDATE prelims_test_attempts SET
      attempted_count = $2,
      correct_count   = $3,
      wrong_count     = $4,
      skipped_count   = $5,
      score           = $6,
      accuracy        = $7,
      status          = $8,
      submitted_at    = $9,
      updated_at      = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const values = [
    attemptId,
    data.attempted_count,
    data.correct_count,
    data.wrong_count,
    data.skipped_count,
    data.score,
    data.accuracy,
    data.status,
    data.submitted_at || null,
  ];
  const result = await query(sql, values);
  return result.rows[0] || null;
}

export async function listAttemptsByUser(userId, limit = 20) {
  const result = await query(
    `SELECT * FROM prelims_test_attempts
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export async function createBlankResponses(attemptId, userId, questionIds) {
  if (!questionIds.length) return;
  // Batch insert blank response rows
  const valueClauses = questionIds.map(
    (_, i) => `($1, $2, $${i + 3})`
  );
  const values = [attemptId, userId, ...questionIds];
  await query(
    `INSERT INTO prelims_test_responses (attempt_id, user_id, question_id)
     VALUES ${valueClauses.join(", ")}
     ON CONFLICT (attempt_id, question_id) DO NOTHING`,
    values
  );
}

export async function upsertResponse(attemptId, userId, data) {
  const sql = `
    INSERT INTO prelims_test_responses
      (attempt_id, user_id, question_id, selected_answer, time_spent_seconds, marked_for_review)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      selected_answer    = EXCLUDED.selected_answer,
      time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, prelims_test_responses.time_spent_seconds),
      marked_for_review  = COALESCE(EXCLUDED.marked_for_review, prelims_test_responses.marked_for_review),
      updated_at         = NOW()
    RETURNING *
  `;
  const values = [
    attemptId,
    userId,
    data.question_id,
    data.selected_answer || null,
    data.time_spent_seconds || 0,
    data.marked_for_review ?? false,
  ];
  const result = await query(sql, values);
  return result.rows[0];
}

export async function bulkUpdateResponses(attemptId, userId, responses) {
  // responses = [{ question_id, selected_answer, correct_answer, is_correct, is_skipped, time_spent_seconds }]
  return withTransaction(async (client) => {
    for (const r of responses) {
      await client.query(
        `INSERT INTO prelims_test_responses
           (attempt_id, user_id, question_id, selected_answer, correct_answer,
            is_correct, is_skipped, time_spent_seconds, marked_for_review)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET
           selected_answer    = EXCLUDED.selected_answer,
           correct_answer     = EXCLUDED.correct_answer,
           is_correct         = EXCLUDED.is_correct,
           is_skipped         = EXCLUDED.is_skipped,
           time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, prelims_test_responses.time_spent_seconds),
           marked_for_review  = COALESCE(EXCLUDED.marked_for_review, prelims_test_responses.marked_for_review),
           updated_at         = NOW()`,
        [
          attemptId,
          userId,
          r.question_id,
          r.selected_answer || null,
          r.correct_answer || null,
          r.is_correct ?? null,
          r.is_skipped ?? false,
          r.time_spent_seconds || 0,
          r.marked_for_review ?? false,
        ]
      );
    }
  });
}

export async function getResponsesByAttempt(attemptId) {
  const result = await query(
    `SELECT * FROM prelims_test_responses WHERE attempt_id = $1 ORDER BY created_at`,
    [attemptId]
  );
  return result.rows;
}
