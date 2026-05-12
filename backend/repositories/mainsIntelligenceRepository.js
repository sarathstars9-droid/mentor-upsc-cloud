import { query } from "../db/index.js";

/**
 * Save evaluation to mains_answer_evaluations table
 * Maps parsed JSON fields to DB columns
 * 
 * NOTE: Future Phase - word_count / time_taken linkage
 * The mains_answer_attempts table has word_count and time_taken fields.
 * Later phases will correlate these with evaluation scores:
 *   - AIR-1: "User writes too long but gets low score"
 *   - Time pressure analysis
 *   - Writing efficiency metrics
 * Currently we just save the evaluation; word_count/time_taken queries will
 * join to mains_answer_attempts when needed.
 */
export async function saveEvaluation(evaluationData) {
  const {
    userId,
    answerAttemptId,
    rawEvaluation,
    totalScore,
    maxScore,
    componentScores,
    strengths,
    weaknesses,
    missingDimensions,
    improvementActions,
    oneLineDiagnosis,
    rewriteTask,
  } = evaluationData;

  const sql = `
    INSERT INTO mains_answer_evaluations (
      user_id,
      answer_attempt_id,
      raw_evaluation,
      total_score,
      max_score,
      intro_score,
      structure_score,
      content_score,
      examples_score,
      analysis_score,
      conclusion_score,
      directive_score,
      presentation_score,
      strengths,
      weaknesses,
      missing_dimensions,
      improvement_actions,
      one_line_diagnosis,
      rewrite_task,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19,
      NOW(), NOW()
    )
    RETURNING *
  `;

  const values = [
    userId,
    answerAttemptId,
    rawEvaluation,
    totalScore || 0,
    maxScore || 10,
    componentScores?.intro || 0,
    componentScores?.structure || 0,
    componentScores?.content || 0,
    componentScores?.examples || 0,
    componentScores?.analysis || 0,
    componentScores?.conclusion || 0,
    componentScores?.directiveHandling || 0,
    componentScores?.presentation || 0,
    JSON.stringify(strengths || []),
    JSON.stringify(weaknesses || []),
    JSON.stringify(missingDimensions || []),
    JSON.stringify(improvementActions || []),
    oneLineDiagnosis || "",
    rewriteTask || "",
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Check if answer attempt exists (FK constraint validation)
 */
export async function answerAttemptExists(answerAttemptId) {
  const sql = `SELECT id FROM mains_answer_attempts WHERE id = $1 LIMIT 1`;
  const result = await query(sql, [answerAttemptId]);
  return result.rows.length > 0;
}

/**
 * Get evaluation by ID
 */
export async function getEvaluationById(evaluationId) {
  const sql = `
    SELECT *
    FROM mains_answer_evaluations
    WHERE id = $1
    LIMIT 1
  `;
  const result = await query(sql, [evaluationId]);
  return result.rows[0] || null;
}

/**
 * Get evaluations by user
 */
export async function getEvaluationsByUser(userId, limit = 50) {
  const sql = `
    SELECT *
    FROM mains_answer_evaluations
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows;
}

/**
 * Check if evaluation already exists for this answer_attempt_id (deduplication)
 * Returns existing evaluation if found, null otherwise
 */
export async function checkExistingEvaluation(answerAttemptId) {
  const sql = `
    SELECT id, created_at, updated_at
    FROM mains_answer_evaluations
    WHERE answer_attempt_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await query(sql, [answerAttemptId]);
  return result.rows[0] || null;
}

/**
 * Get answer attempt by ID (for extracting paper/subject/topic)
 */
export async function getAnswerAttemptById(answerAttemptId) {
  const sql = `
    SELECT id, user_id, paper, subject, topic, word_count, time_taken
    FROM mains_answer_attempts
    WHERE id = $1
    LIMIT 1
  `;
  const result = await query(sql, [answerAttemptId]);
  return result.rows[0] || null;
}

/**
 * Upsert weakness signal (UPSERT on unique constraint)
 * UNIQUE(user_id, paper, subject, topic, weakness_type, weakness_label)
 * 
 * On conflict:
 *   - evidence_count += 1
 *   - severity = LEAST(severity + 0.5, 10)
 *   - last_seen_at = NOW()
 * 
 * On insert:
 *   - severity = 1
 *   - evidence_count = 1
 *   - created_at = NOW()
 */
export async function upsertWeaknessSignal(signal) {
  const {
    userId,
    paper,
    subject,
    topic,
    weaknessType,
    weaknessLabel,
    severity = 1,
  } = signal;

  const sql = `
    INSERT INTO mains_weakness_signals (
      user_id,
      paper,
      subject,
      topic,
      weakness_type,
      weakness_label,
      severity,
      evidence_count,
      last_seen_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW(), NOW())
    ON CONFLICT (user_id, paper, subject, topic, weakness_type, weakness_label)
    DO UPDATE SET
      evidence_count = mains_weakness_signals.evidence_count + 1,
      severity = LEAST(mains_weakness_signals.severity + 0.5, 10),
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;

  const values = [
    userId,
    paper || "UNKNOWN",
    subject || "UNKNOWN",
    topic || "UNKNOWN",
    weaknessType,
    weaknessLabel,
    severity,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}
export async function updateEvaluation(evaluationId, evaluationData) {
  const {
    userId,
    answerAttemptId,
    rawEvaluation,
    totalScore,
    maxScore,
    componentScores,
    strengths,
    weaknesses,
    missingDimensions,
    improvementActions,
    oneLineDiagnosis,
    rewriteTask,
  } = evaluationData;

  const sql = `
    UPDATE mains_answer_evaluations
    SET
      user_id = $1,
      answer_attempt_id = $2,
      raw_evaluation = $3,
      total_score = $4,
      max_score = $5,
      intro_score = $6,
      structure_score = $7,
      content_score = $8,
      examples_score = $9,
      analysis_score = $10,
      conclusion_score = $11,
      directive_score = $12,
      presentation_score = $13,
      strengths = $14,
      weaknesses = $15,
      missing_dimensions = $16,
      improvement_actions = $17,
      one_line_diagnosis = $18,
      rewrite_task = $19,
      updated_at = NOW()
    WHERE id = $20
    RETURNING *
  `;

  const values = [
    userId,
    answerAttemptId,
    rawEvaluation,
    totalScore || 0,
    maxScore || 10,
    componentScores?.intro || 0,
    componentScores?.structure || 0,
    componentScores?.content || 0,
    componentScores?.examples || 0,
    componentScores?.analysis || 0,
    componentScores?.conclusion || 0,
    componentScores?.directiveHandling || 0,
    componentScores?.presentation || 0,
    JSON.stringify(strengths || []),
    JSON.stringify(weaknesses || []),
    JSON.stringify(missingDimensions || []),
    JSON.stringify(improvementActions || []),
    oneLineDiagnosis || "",
    rewriteTask || "",
    evaluationId,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Get all active (non-done) weakness signals for a user,
 * ordered by severity descending so the worst weaknesses come first.
 * Used by the Next Action Engine to generate tasks.
 */
export async function getActiveWeaknessSignals(userId) {
  const sql = `
    SELECT
      id,
      user_id,
      paper,
      subject,
      topic,
      weakness_type,
      weakness_label,
      severity,
      evidence_count,
      last_seen_at
    FROM mains_weakness_signals
    WHERE user_id = $1
    ORDER BY severity DESC, evidence_count DESC, last_seen_at DESC
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * Upsert a next action.
 * UNIQUE(user_id, action_type, source_weakness_label):
 *   On conflict: update title, description, priority, severity, updated_at.
 *   Preserves is_done state so completed actions aren't reset.
 */
export async function upsertNextAction(action) {
  const {
    userId,
    actionType,
    title,
    description,
    priority,
    sourceWeaknessLabel,
    sourceWeaknessType,
    sourceSeverity,
    paper,
    subject,
    topic,
    answerAttemptId,
  } = action;

  const sql = `
    INSERT INTO mains_next_actions (
      user_id,
      action_type,
      title,
      description,
      priority,
      source_weakness_label,
      source_weakness_type,
      source_severity,
      paper,
      subject,
      topic,
      answer_attempt_id,
      is_done,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, NOW(), NOW())
    ON CONFLICT (user_id, action_type, source_weakness_label)
    DO UPDATE SET
      title                 = EXCLUDED.title,
      description           = EXCLUDED.description,
      priority              = EXCLUDED.priority,
      source_severity       = EXCLUDED.source_severity,
      paper                 = EXCLUDED.paper,
      subject               = EXCLUDED.subject,
      topic                 = EXCLUDED.topic,
      answer_attempt_id     = COALESCE(EXCLUDED.answer_attempt_id, mains_next_actions.answer_attempt_id),
      updated_at            = NOW()
    RETURNING *
  `;

  const values = [
    userId,
    actionType,
    title,
    description,
    priority,
    sourceWeaknessLabel,
    sourceWeaknessType,
    sourceSeverity,
    paper          || null,
    subject        || null,
    topic          || null,
    answerAttemptId || null,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Get top N next actions for a user — one per action_type (diversity).
 * Uses ROW_NUMBER() OVER (PARTITION BY action_type) so no two actions
 * in the top list share the same action_type.
 * Orders by: high → medium → low, then severity descending.
 * Excludes done actions.
 */
export async function getTopNextActions(userId, limit = 3) {
  const sql = `
    SELECT
      id,
      action_type,
      title,
      description,
      priority,
      source_weakness_label,
      source_weakness_type,
      source_severity,
      paper,
      subject,
      topic,
      answer_attempt_id,
      is_done,
      created_at,
      updated_at
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY action_type
          ORDER BY
            CASE priority
              WHEN 'high'   THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low'    THEN 3
              ELSE 4
            END ASC,
            source_severity DESC
        ) AS rn
      FROM mains_next_actions
      WHERE user_id = $1
        AND is_done = FALSE
    ) ranked
    WHERE rn = 1
    ORDER BY
      CASE priority
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 3
        ELSE 4
      END ASC,
      source_severity DESC,
      updated_at DESC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows;
}

/**
 * Get all existing next actions for a user (including updated_at).
 * Used by the cooldown check in the Next Action Engine to avoid
 * re-upserting actions that were generated within the last 24 hours.
 */
export async function getExistingNextActions(userId) {
  const sql = `
    SELECT
      action_type,
      source_weakness_label,
      updated_at
    FROM mains_next_actions
    WHERE user_id = $1
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * Get a single next action by ID (includes user_id for authorization).
 */
export async function getNextActionById(id) {
  const sql = `
    SELECT
      id,
      user_id,
      action_type,
      title,
      description,
      priority,
      status,
      source_weakness_label,
      source_weakness_type,
      source_severity,
      paper,
      subject,
      topic,
      answer_attempt_id,
      is_done,
      completed_at,
      created_at,
      updated_at
    FROM mains_next_actions
    WHERE id = $1
    LIMIT 1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Update next action status (completed | skipped | pending).
 * - completed → is_done=TRUE, completed_at=NOW()
 * - skipped   → is_done=TRUE, completed_at=NULL
 * - pending   → is_done=FALSE, completed_at=NULL  (undo)
 */
export async function updateNextActionStatus(id, status) {
  const isDone       = status === "completed" || status === "skipped";
  const completedAt  = status === "completed" ? "NOW()" : "NULL";

  const sql = `
    UPDATE mains_next_actions
    SET
      status       = $2,
      is_done      = $3,
      completed_at = ${completedAt},
      updated_at   = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await query(sql, [id, status, isDone]);
  return result.rows[0] || null;
}

/**
 * Reduce severity of a weakness signal on action completion.
 * Rules:
 *   severity    = GREATEST(severity - 0.5, 0)   (floor at 0)
 *   revision_count = revision_count + 1
 *   last_seen_at   = NOW()
 *
 * Matches on the same unique key used during upsert:
 *   (user_id, paper, subject, topic, weakness_type, weakness_label)
 */
export async function reduceWeaknessSeverity({
  userId, paper, subject, topic, weaknessType, weaknessLabel,
}) {
  const sql = `
    UPDATE mains_weakness_signals
    SET
      severity       = GREATEST(severity - 0.5, 0),
      revision_count = revision_count + 1,
      last_seen_at   = NOW(),
      updated_at     = NOW()
    WHERE user_id       = $1
      AND paper         = $2
      AND subject       = $3
      AND topic         = $4
      AND weakness_type = $5
      AND weakness_label = $6
    RETURNING *
  `;
  const result = await query(sql, [
    userId,
    paper   || "UNKNOWN",
    subject || "UNKNOWN",
    topic   || "UNKNOWN",
    weaknessType,
    weaknessLabel,
  ]);
  return result.rows[0] || null;
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 5: Performance Intelligence Engine — Query Layer
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get evaluation history for a user, newest first.
 * Joins with mains_answer_attempts for paper/subject/topic context.
 * Used to compute scores, trends, and progression graph.
 */
export async function getEvaluationHistory(userId, limit = 20) {
  const sql = `
    SELECT
      mae.id,
      mae.answer_attempt_id,
      mae.total_score,
      mae.max_score,
      mae.intro_score,
      mae.structure_score,
      mae.content_score,
      mae.examples_score,
      mae.analysis_score,
      mae.conclusion_score,
      mae.directive_score,
      mae.presentation_score,
      mae.one_line_diagnosis,
      mae.created_at,
      maa.paper,
      maa.subject,
      maa.topic,
      maa.word_count,
      maa.time_taken
    FROM mains_answer_evaluations mae
    JOIN mains_answer_attempts maa
      ON mae.answer_attempt_id = maa.id
    WHERE mae.user_id = $1
    ORDER BY mae.created_at DESC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows;
}

/**
 * Get average score per paper for a user.
 * Normalises score to a /10 scale regardless of max_score.
 * Returns rows ordered strongest → weakest.
 */
export async function getPaperScoreStats(userId) {
  const sql = `
    SELECT
      maa.paper,
      ROUND(
        AVG(mae.total_score::numeric / NULLIF(mae.max_score, 0) * 10), 2
      )                          AS avg_score_10,
      COUNT(*)                   AS attempt_count,
      MAX(mae.total_score::numeric / NULLIF(mae.max_score, 0) * 10) AS best_score_10,
      MIN(mae.total_score::numeric / NULLIF(mae.max_score, 0) * 10) AS worst_score_10
    FROM mains_answer_evaluations mae
    JOIN mains_answer_attempts maa ON mae.answer_attempt_id = maa.id
    WHERE mae.user_id = $1
      AND maa.paper IS NOT NULL
    GROUP BY maa.paper
    ORDER BY avg_score_10 DESC
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * Get top N weakness signals, ordered by severity DESC then evidence_count DESC.
 * Used for: mostFrequentWeakness, top3PersistentWeaknesses.
 */
export async function getWeaknessSummary(userId, limit = 10) {
  const sql = `
    SELECT
      weakness_label,
      weakness_type,
      severity,
      evidence_count,
      revision_count,
      paper,
      subject,
      last_seen_at
    FROM mains_weakness_signals
    WHERE user_id = $1
    ORDER BY severity DESC, evidence_count DESC, last_seen_at DESC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows;
}

/**
 * Get action completion stats for a user.
 * Returns total, completed, skipped, pending counts.
 */
export async function getActionCompletionStats(userId) {
  const sql = `
    SELECT
      COUNT(*)                                        AS total_actions,
      COUNT(*) FILTER (WHERE status = 'completed')   AS completed_actions,
      COUNT(*) FILTER (WHERE status = 'skipped')     AS skipped_actions,
      COUNT(*) FILTER (WHERE status = 'pending')     AS pending_actions
    FROM mains_next_actions
    WHERE user_id = $1
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || {
    total_actions: 0, completed_actions: 0, skipped_actions: 0, pending_actions: 0,
  };
}

/**
 * Get revision effectiveness stats.
 * Measures how many weakness signals have been worked on (revision_count > 0)
 * and the average severity before and after remediation.
 */
export async function getRevisionEffectivenessStats(userId) {
  const sql = `
    SELECT
      COUNT(*)                                               AS total_signals,
      COUNT(*) FILTER (WHERE revision_count > 0)            AS remediated_signals,
      ROUND(AVG(severity), 2)                               AS avg_severity_current,
      ROUND(AVG(CASE WHEN revision_count > 0
                     THEN severity END), 2)                 AS avg_severity_remediated,
      COALESCE(SUM(revision_count), 0)                      AS total_revisions_done
    FROM mains_weakness_signals
    WHERE user_id = $1
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || {
    total_signals: 0, remediated_signals: 0,
    avg_severity_current: null, avg_severity_remediated: null, total_revisions_done: 0,
  };
}
