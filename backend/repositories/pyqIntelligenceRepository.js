import { query } from "../db/index.js";

export async function insertPyqAttempt(attempt) {
    const q = `
    INSERT INTO pyq_attempts (
      user_id, test_id, question_id, node_id, subject_id, stage, year,
      selected_answer, correct_answer, is_correct, time_taken_sec, source_type
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
  `;

    const values = [
        attempt.userId,
        attempt.testId || null,
        attempt.questionId,
        attempt.nodeId,
        attempt.subjectId || null,
        attempt.stage || "Prelims",
        attempt.year || null,
        attempt.selectedAnswer || null,
        attempt.correctAnswer || null,
        attempt.isCorrect,
        attempt.timeTakenSec || 0,
        attempt.sourceType || "pyq_practice",
    ];

    const { rows } = await query(q, values);
    return rows[0];
}

export async function upsertNodePerformance({ userId, nodeId, subjectId }) {
    const q = `
    INSERT INTO pyq_node_performance (
      user_id, node_id, subject_id, attempts, correct, wrong,
      accuracy, avg_time_sec, strength_score, status, last_attempted_at, updated_at
    )
    SELECT
      $1,
      $2,
      $3,
      COUNT(*),
      COUNT(*) FILTER (WHERE is_correct = true),
      COUNT(*) FILTER (WHERE is_correct = false),
      ROUND((COUNT(*) FILTER (WHERE is_correct = true)::numeric / NULLIF(COUNT(*),0)) * 100, 2),
      ROUND(AVG(COALESCE(time_taken_sec,0))::numeric, 2),
      ROUND(
        (
          (COUNT(*) FILTER (WHERE is_correct = true)::numeric / NULLIF(COUNT(*),0)) * 70
          +
          LEAST(COUNT(*), 10) * 3
        ),
        2
      ),
      CASE
        WHEN COUNT(*) = 0 THEN 'unseen'
        WHEN (COUNT(*) FILTER (WHERE is_correct = true)::numeric / NULLIF(COUNT(*),0)) <= 0.6 THEN 'weak'
        WHEN (COUNT(*) FILTER (WHERE is_correct = true)::numeric / NULLIF(COUNT(*),0)) <= 0.8 THEN 'medium'
        ELSE 'strong'
      END,
      MAX(created_at),
      NOW()
    FROM pyq_attempts
    WHERE user_id = $1 AND node_id = $2
    ON CONFLICT (user_id, node_id)
    DO UPDATE SET
      subject_id = EXCLUDED.subject_id,
      attempts = EXCLUDED.attempts,
      correct = EXCLUDED.correct,
      wrong = EXCLUDED.wrong,
      accuracy = EXCLUDED.accuracy,
      avg_time_sec = EXCLUDED.avg_time_sec,
      strength_score = EXCLUDED.strength_score,
      status = EXCLUDED.status,
      last_attempted_at = EXCLUDED.last_attempted_at,
      updated_at = NOW()
    RETURNING *
  `;

    const { rows } = await query(q, [userId, nodeId, subjectId || null]);
    return rows[0];
}

export async function getNodePerformance(userId) {
    const { rows } = await query(
        `SELECT * FROM pyq_node_performance WHERE user_id = $1 ORDER BY strength_score ASC`,
        [userId]
    );
    return rows;
}