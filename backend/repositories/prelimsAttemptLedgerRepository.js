import { query, withTransaction } from "../db/index.js";

const INSERT_COLUMNS = [
  "user_id",
  "attempt_id",
  "question_id",
  "selected_answer",
  "correct_answer",
  "answer_status",
  "source_type",
  "source_ref",
  "stage",
  "paper",
  "subject",
  "topic",
  "node_id",
  "question_text",
  "error_type",
  "evidence_quality",
  "is_legacy_backfill",
  "history_complete",
  "is_retest",
  "attempted_at",
];

export async function insertAttemptRows(rows = []) {
  const validRows = rows.filter((row) => row.user_id && row.attempt_id && row.question_id);
  if (validRows.length === 0) return [];

  return withTransaction(async (client) => {
    const saved = [];

    for (const row of validRows) {
      const result = await client.query(
        `
          INSERT INTO prelims_question_attempts (
            ${INSERT_COLUMNS.join(", ")}
          )
          VALUES (
            ${INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(", ")}
          )
          ON CONFLICT (user_id, attempt_id, question_id, source_type)
          DO UPDATE SET
            selected_answer = EXCLUDED.selected_answer,
            correct_answer  = EXCLUDED.correct_answer,
            answer_status   = EXCLUDED.answer_status,
            source_ref      = EXCLUDED.source_ref,
            stage           = EXCLUDED.stage,
            paper           = EXCLUDED.paper,
            subject         = EXCLUDED.subject,
            topic           = EXCLUDED.topic,
            node_id         = EXCLUDED.node_id,
            question_text   = EXCLUDED.question_text,
            error_type      = EXCLUDED.error_type,
            evidence_quality = EXCLUDED.evidence_quality,
            is_legacy_backfill = EXCLUDED.is_legacy_backfill,
            history_complete = EXCLUDED.history_complete,
            is_retest       = EXCLUDED.is_retest,
            attempted_at    = EXCLUDED.attempted_at,
            updated_at      = NOW()
          RETURNING *
        `,
        INSERT_COLUMNS.map((column) => row[column])
      );

      saved.push(result.rows[0]);
    }

    return saved;
  });
}

export async function listQuestionAttempts({ userId, questionId, limit = 25 }) {
  if (!userId || !questionId) return [];

  const result = await query(
    `
      SELECT *
      FROM prelims_question_attempts
      WHERE user_id = $1
        AND question_id = $2
      ORDER BY attempted_at DESC, created_at DESC
      LIMIT $3
    `,
    [userId, questionId, limit]
  );

  return result.rows;
}

export async function listAttemptsForQuestions({ userId, questionIds = [] }) {
  const uniqueQuestionIds = Array.from(new Set(questionIds.filter(Boolean).map(String)));
  if (!userId || uniqueQuestionIds.length === 0) return [];

  const result = await query(
    `
      SELECT *
      FROM prelims_question_attempts
      WHERE user_id = $1
        AND question_id = ANY($2::text[])
      ORDER BY question_id ASC, attempted_at DESC, created_at DESC
    `,
    [userId, uniqueQuestionIds]
  );

  return result.rows;
}

export async function getQuestionAttemptStats({ userId, questionId }) {
  if (!userId || !questionId) return null;

  const result = await query(
    `
      SELECT
        COUNT(*) AS total_attempts,
        COUNT(*) FILTER (WHERE answer_status = 'correct') AS correct_count,
        COUNT(*) FILTER (WHERE answer_status = 'wrong') AS wrong_count,
        COUNT(*) FILTER (WHERE answer_status = 'unattempted') AS unattempted_count,
        COUNT(*) FILTER (WHERE is_retest = true) AS retest_count,
        MIN(attempted_at) AS first_attempted_at,
        MAX(attempted_at) AS latest_attempted_at
      FROM prelims_question_attempts
      WHERE user_id = $1
        AND question_id = $2
    `,
    [userId, questionId]
  );

  return result.rows[0] || null;
}
