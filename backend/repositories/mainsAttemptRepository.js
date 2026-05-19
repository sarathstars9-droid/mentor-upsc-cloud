// backend/repositories/mainsAttemptRepository.js
// PostgreSQL UPSERT and fetch for mains_answer_attempts.

import { query } from "../db/index.js";

/**
 * Upsert a mains attempt record.
 * If attempt_id already exists, update it. Otherwise insert.
 * Returns the saved row (includes id and attempt_id).
 */
export async function upsertMainsAttempt(data) {
  const sql = `
    INSERT INTO mains_answer_attempts (
      attempt_id,
      user_id,
      question_key,
      question_text,
      paper,
      subject,
      topic,
      marks,
      word_limit,
      final_answer_text,
      extracted_text,
      answer_source,
      uploaded_pages_meta,
      basic_review_json,
      air1_raw_review,
      air1_parsed_json,
      current_score,
      target_score,
      status,
      updated_at,
      finalized_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),$20)
    ON CONFLICT (attempt_id) DO UPDATE SET
      question_key        = EXCLUDED.question_key,
      question_text       = EXCLUDED.question_text,
      paper               = EXCLUDED.paper,
      subject             = EXCLUDED.subject,
      topic               = EXCLUDED.topic,
      marks               = EXCLUDED.marks,
      word_limit          = EXCLUDED.word_limit,
      final_answer_text   = EXCLUDED.final_answer_text,
      extracted_text      = EXCLUDED.extracted_text,
      answer_source       = EXCLUDED.answer_source,
      uploaded_pages_meta = EXCLUDED.uploaded_pages_meta,
      basic_review_json   = EXCLUDED.basic_review_json,
      air1_raw_review     = EXCLUDED.air1_raw_review,
      air1_parsed_json    = EXCLUDED.air1_parsed_json,
      current_score       = EXCLUDED.current_score,
      target_score        = EXCLUDED.target_score,
      status              = EXCLUDED.status,
      updated_at          = NOW(),
      finalized_at        = EXCLUDED.finalized_at
    RETURNING id, attempt_id, status, updated_at
  `;

  const finalizedAt = data.status === "finalized" ? new Date().toISOString() : null;

  const values = [
    data.attemptId,
    data.userId || "user_1",
    data.questionKey || data.question_key || null,
    data.questionText || null,
    data.paper || null,
    data.subject || null,
    data.topic || null,
    data.marks ? parseInt(data.marks) : null,
    data.wordLimit ? parseInt(data.wordLimit) : null,
    data.finalAnswerText || null,
    data.extractedText || null,
    data.answerSource || "typed",
    JSON.stringify(data.uploadedPagesMeta || []),
    data.basicReviewJson ? JSON.stringify(data.basicReviewJson) : null,
    data.air1RawReview || null,
    data.air1ParsedJson ? JSON.stringify(data.air1ParsedJson) : null,
    data.currentScore || null,
    data.targetScore || null,
    data.status || "draft",
    finalizedAt,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Fetch a single attempt by attempt_id.
 * Returns null if not found.
 */
export async function getMainsAttemptById(attemptId) {
  const sql = `
    SELECT *
    FROM mains_answer_attempts
    WHERE attempt_id = $1
    LIMIT 1
  `;
  const result = await query(sql, [attemptId]);
  return result.rows[0] || null;
}

/**
 * Fetch the latest attempt for a user.
 * Returns null if no attempts found.
 */
export async function getLatestMainsAttempt(userId) {
  const sql = `
    SELECT *
    FROM mains_answer_attempts
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const result = await query(sql, [userId || "user_1"]);
  return result.rows[0] || null;
}

/**
 * Fetch the latest attempt for a user and exact question key.
 * Returns null if no attempts found.
 */
export async function getLatestMainsAttemptForQuestion(userId, questionKey) {
  const sql = `
    SELECT *
    FROM mains_answer_attempts
    WHERE user_id = $1
      AND question_key = $2
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const result = await query(sql, [userId || "user_1", questionKey]);
  return result.rows[0] || null;
}

/**
 * Fetch all attempts for a user, sorted by updated_at descending.
 */
export async function getMainsAttempts(userId) {
  const sql = `
    SELECT *
    FROM mains_answer_attempts
    WHERE user_id = $1
    ORDER BY updated_at DESC
  `;
  const result = await query(sql, [userId || "user_1"]);
  return result.rows;
}
