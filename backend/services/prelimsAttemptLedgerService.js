import {
  getQuestionAttemptStats,
  insertAttemptRows,
  listQuestionAttempts,
} from "../repositories/prelimsAttemptLedgerRepository.js";
import { withTransaction } from "../db/index.js";
import { findMistakeById } from "../repositories/mistakeRepository.js";

const ANSWER_STATUS_VALUES = new Set(["correct", "wrong", "unattempted"]);

function normalizeAnswer(value) {
  if (value === undefined || value === null) return null;
  const answer = String(value).trim();
  return answer ? answer.toUpperCase() : null;
}

function normalizeAnswerStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (ANSWER_STATUS_VALUES.has(status)) return status;
  if (status === "incorrect") return "wrong";
  if (status === "skipped") return "unattempted";
  return null;
}

function deriveAnswerStatus({ answerStatus, selectedAnswer, correctAnswer, isCorrect, isSkipped }) {
  const explicit = normalizeAnswerStatus(answerStatus);
  if (explicit) return explicit;
  if (isSkipped === true) return "unattempted";
  if (isCorrect === true) return "correct";
  if (isCorrect === false) return selectedAnswer ? "wrong" : "unattempted";
  if (!selectedAnswer) return "unattempted";
  if (correctAnswer && selectedAnswer === correctAnswer) return "correct";
  return "wrong";
}

function hasVerifiedEvidence(row) {
  return row?.evidence_quality !== "legacy_uncertain";
}

function stableAttemptId(sourceType, sourceRef) {
  const source = String(sourceType || "prelims").trim() || "prelims";
  const ref = String(sourceRef || "").trim();
  return ref ? `${source}:${ref}` : `${source}:${Date.now()}`;
}

export function normalizePrelimsAttemptRow(input = {}) {
  const questionId = input.question_id || input.questionId || input.id;
  if (!questionId) return null;

  const selectedAnswer = normalizeAnswer(
    input.selected_answer ?? input.selectedAnswer ?? input.latestUserAnswer ?? input.userAnswer
  );
  const correctAnswer = normalizeAnswer(
    input.correct_answer ?? input.correctAnswer ?? input.answer
  );
  const sourceType = String(input.source_type || input.sourceType || "prelims_practice").trim();
  const sourceRef = input.source_ref ?? input.sourceRef ?? input.testId ?? null;
  const attemptId = String(
    input.attempt_id || input.attemptId || stableAttemptId(sourceType, sourceRef)
  );
  const answerStatus = deriveAnswerStatus({
    answerStatus: input.answer_status ?? input.answerStatus ?? input.latestResult ?? input.result ?? input.status,
    selectedAnswer,
    correctAnswer,
    isCorrect: input.is_correct ?? input.isCorrect,
    isSkipped: input.is_skipped ?? input.isSkipped,
  });

  return {
    user_id: input.user_id || input.userId || "user_1",
    attempt_id: attemptId,
    question_id: String(questionId),
    selected_answer: selectedAnswer,
    correct_answer: correctAnswer,
    answer_status: answerStatus,
    source_type: sourceType,
    source_ref: sourceRef ? String(sourceRef) : null,
    stage: "prelims",
    paper: input.paper || input.paperType || input.practicePaper || null,
    subject: input.subject || input.subject_id || input.subjectId || input.subjectBucket || null,
    topic: input.topic || input.subtopic || input.topicNodeId || null,
    node_id: input.node_id || input.nodeId || input.syllabusNodeId || null,
    question_text: input.question_text || input.questionText || input.question || null,
    error_type: input.error_type || input.errorType || input.mistakeType || null,
    evidence_quality: input.evidence_quality || input.evidenceQuality || "verified",
    is_legacy_backfill: Boolean(input.is_legacy_backfill ?? input.isLegacyBackfill ?? false),
    history_complete: input.history_complete ?? input.historyComplete ?? true,
    is_retest: Boolean(input.is_retest ?? input.isRetest ?? String(sourceType).includes("retest")),
    attempted_at: input.attempted_at || input.attemptedAt || input.submitted_at || input.submittedAt || new Date().toISOString(),
  };
}

export async function recordPrelimsQuestionAttempts(entries = []) {
  const rows = entries
    .map(normalizePrelimsAttemptRow)
    .filter((row) => row && row.user_id && row.question_id && row.answer_status);

  if (rows.length === 0) return [];
  return insertAttemptRows(rows);
}

function latestStreak(rows, status, predicate = () => true) {
  let count = 0;
  for (const row of rows) {
    if (row.answer_status !== status || !predicate(row)) break;
    count += 1;
  }
  return count;
}

function masteryFromRows(rows) {
  const verifiedRows = rows.filter(hasVerifiedEvidence);
  if (!verifiedRows.length) return "unverified";
  const latest = verifiedRows[0];
  const consecutiveCorrectRetests = latestStreak(
    verifiedRows,
    "correct",
    (row) => row.is_retest === true
  );

  if (consecutiveCorrectRetests >= 2) return "mastered";
  if (consecutiveCorrectRetests === 1) return "verify_again";
  if (latest.answer_status === "wrong" || latest.answer_status === "unattempted") return "unverified";
  return "unverified";
}

export function buildAttemptEvidence(rows = [], stats = {}) {
  const latestRows = rows.slice().sort((a, b) =>
    new Date(b.attempted_at || b.created_at) - new Date(a.attempted_at || a.created_at)
  );
  const verifiedRows = latestRows.filter(hasVerifiedEvidence);
  const failureAttempts = verifiedRows.filter((row) =>
    row.answer_status === "wrong" || row.answer_status === "unattempted"
  );
  const repeatedWrongAttempts = verifiedRows.filter((row) => row.answer_status === "wrong");
  const repeatedUnattemptedAttempts = verifiedRows.filter((row) => row.answer_status === "unattempted");
  const uncertainRows = latestRows.filter((row) => row.evidence_quality === "legacy_uncertain");
  const consecutiveCorrectRetests = latestStreak(
    verifiedRows,
    "correct",
    (row) => row.is_retest === true
  );

  return {
    totalAttempts: latestRows.length,
    recordedAttempts: latestRows.length,
    verifiedAttempts: verifiedRows.length,
    uncertainAttempts: uncertainRows.length,
    correctCount: verifiedRows.filter((row) => row.answer_status === "correct").length,
    wrongCount: repeatedWrongAttempts.length,
    unattemptedCount: repeatedUnattemptedAttempts.length,
    failureCount: failureAttempts.length,
    retestCount: verifiedRows.filter((row) => row.is_retest).length,
    firstAttemptedAt: stats?.first_attempted_at || latestRows[latestRows.length - 1]?.attempted_at || null,
    latestAttemptedAt: stats?.latest_attempted_at || latestRows[0]?.attempted_at || null,
    latestStatus: verifiedRows[0]?.answer_status || null,
    consecutiveCorrectRetests,
    latestCorrectStreak: latestStreak(verifiedRows, "correct"),
    latestWrongStreak: latestStreak(verifiedRows, "wrong"),
    repeatedWrongCount: repeatedWrongAttempts.length,
    repeatedUnattemptedCount: repeatedUnattemptedAttempts.length,
    repeatedErrorCount: failureAttempts.length,
    isRepeatedError: failureAttempts.length >= 2,
    masteryStatus: masteryFromRows(latestRows),
    historyComplete: latestRows.length > 0 && latestRows.every((row) => row.history_complete === true),
    repeatedErrorEvidence: repeatedWrongAttempts.slice(0, 5).map((row) => ({
      id: row.id,
      attemptId: row.attempt_id,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer,
      attemptedAt: row.attempted_at,
      isRetest: row.is_retest,
      evidenceQuality: row.evidence_quality,
    })),
  };
}

export async function getAttemptHistoryForMistake(mistakeId, userId) {
  const mistake = await findMistakeById(mistakeId);
  if (!mistake) return null;

  if (!userId || String(mistake.user_id) !== String(userId)) {
    const error = new Error("Mistake not found for user");
    error.status = 404;
    throw error;
  }

  if (String(mistake.stage || "").toLowerCase() !== "prelims") {
    const error = new Error("Attempt history is only supported for prelims mistakes");
    error.status = 400;
    throw error;
  }

  const questionId = mistake.question_id;
  if (!questionId) {
    return { mistake, attempts: [], evidence: buildAttemptEvidence([]) };
  }

  const [attempts, stats] = await Promise.all([
    listQuestionAttempts({ userId: mistake.user_id, questionId, limit: 25 }),
    getQuestionAttemptStats({ userId: mistake.user_id, questionId }),
  ]);

  return {
    mistake,
    attempts,
    evidence: buildAttemptEvidence(attempts, stats),
  };
}

export async function recordMistakeRetest(mistakeId, payload = {}) {
  const mistake = await findMistakeById(mistakeId);
  if (!mistake) {
    const error = new Error("Mistake not found");
    error.status = 404;
    throw error;
  }

  const userId = payload.userId || payload.user_id;
  if (!userId || String(userId) !== String(mistake.user_id)) {
    const error = new Error("Mistake not found for user");
    error.status = 404;
    throw error;
  }

  if (String(mistake.stage || "").toLowerCase() !== "prelims") {
    const error = new Error("Retest is only supported for prelims mistakes");
    error.status = 400;
    throw error;
  }

  if (!mistake.question_id) {
    const error = new Error("Retest requires a question_id");
    error.status = 400;
    throw error;
  }

  const selectedAnswer = normalizeAnswer(payload.selectedAnswer ?? payload.selected_answer);
  const correctAnswer = normalizeAnswer(mistake.correct_answer);
  if (!correctAnswer) {
    const error = new Error("Retest requires a stored correct_answer");
    error.status = 400;
    throw error;
  }
  const answerStatus = deriveAnswerStatus({
    answerStatus: payload.answerStatus ?? payload.answer_status,
    selectedAnswer,
    correctAnswer,
    isSkipped: payload.isSkipped ?? payload.is_skipped,
  });

  const attemptId = payload.attemptId || `mistake_retest:${mistake.id}:${Date.now()}`;
  const attemptedAt = payload.attemptedAt || new Date().toISOString();
  const reviewStatus = answerStatus === "correct" ? "reviewed" : "retest_due";
  const reviewedAt = answerStatus === "correct" ? new Date().toISOString() : mistake.reviewed_at;

  const txResult = await withTransaction(async (client) => {
    const attemptResult = await client.query(
      `
        INSERT INTO prelims_question_attempts (
          user_id, attempt_id, question_id, selected_answer, correct_answer,
          answer_status, source_type, source_ref, stage, paper, subject, topic,
          node_id, question_text, error_type, evidence_quality,
          is_legacy_backfill, history_complete, is_retest, attempted_at
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,'prelims',$9,$10,$11,
          $12,$13,$14,'verified',
          false,true,true,$15
        )
        ON CONFLICT (user_id, attempt_id, question_id, source_type)
        DO UPDATE SET
          selected_answer = EXCLUDED.selected_answer,
          correct_answer = EXCLUDED.correct_answer,
          answer_status = EXCLUDED.answer_status,
          evidence_quality = 'verified',
          is_retest = true,
          attempted_at = EXCLUDED.attempted_at,
          updated_at = NOW()
        RETURNING *
      `,
      [
        mistake.user_id,
        attemptId,
        mistake.question_id,
        selectedAnswer,
        correctAnswer,
        answerStatus,
        "mistake_retest",
        mistake.id,
        mistake.paper || null,
        mistake.subject || null,
        mistake.topic || null,
        mistake.node_id || null,
        mistake.question_text || null,
        mistake.error_type || null,
        attemptedAt,
      ]
    );

    const mistakeResult = await client.query(
      `
        UPDATE mistakes
        SET selected_answer = $2,
            correct_answer = $3,
            answer_status = $4,
            review_status = $5,
            reviewed_at = $6,
            must_revise = $7,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $8
          AND stage = 'prelims'
        RETURNING *
      `,
      [
        mistake.id,
        selectedAnswer,
        correctAnswer,
        answerStatus,
        reviewStatus,
        reviewedAt,
        answerStatus !== "correct",
        mistake.user_id,
      ]
    );

    return {
      attempt: attemptResult.rows[0],
      mistake: mistakeResult.rows[0] || null,
    };
  });

  const [attempts, stats] = await Promise.all([
    listQuestionAttempts({ userId: mistake.user_id, questionId: mistake.question_id, limit: 25 }),
    getQuestionAttemptStats({ userId: mistake.user_id, questionId: mistake.question_id }),
  ]);

  return {
    attempt: txResult.attempt || null,
    mistake: txResult.mistake,
    attempts,
    evidence: buildAttemptEvidence(attempts, stats),
  };
}
