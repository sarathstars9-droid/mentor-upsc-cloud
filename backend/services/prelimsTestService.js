// backend/services/prelimsTestService.js
// Prelims Test Engine -- question fetching, scoring, submission
// Does NOT touch: intelligentPyqTopicMapper.js, pyqNodeAliasMap.js, loader arch, syllabus graph

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createAttempt,
  getAttemptById,
  updateAttemptSummary,
  listAttemptsByUser,
  createBlankResponses,
  upsertResponse,
  bulkUpdateResponses,
  getResponsesByAttempt,
} from "../repositories/prelimsTestRepository.js";
import { upsertMistake } from "../repositories/mistakeRepository.js";
import { upsertNodeWeakness } from "../repositories/adaptiveWeaknessRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MASTER_INDEX_PATH = path.join(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");
const BY_NODE_PATH      = path.join(__dirname, "..", "data", "pyq_index", "pyq_by_node.json");

// ============================================================
// In-memory caches
// ============================================================
let _masterCache = null;
let _byNodeCache  = null;

function loadMasterIndex() {
  if (_masterCache) return _masterCache;
  const raw = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, "utf8"));
  _masterCache = raw;
  return _masterCache;
}

function loadByNode() {
  if (_byNodeCache) return _byNodeCache;
  _byNodeCache = JSON.parse(fs.readFileSync(BY_NODE_PATH, "utf8"));
  return _byNodeCache;
}

// ============================================================
// GS / CSAT detection
// Per spec: do NOT rely only on `paper` field -- older JSONs may be inconsistent.
// ============================================================

function isCsatQuestion(q) {
  const paper   = String(q.paper   || "").toUpperCase();
  const stage   = String(q.stage   || "").toLowerCase();
  const subject = String(q.subject || "").toLowerCase();
  const nodeId  = String(q.syllabusNodeId || q.nodeId || "").toUpperCase();
  return (
    paper === "CSAT"   ||
    stage === "csat"   ||
    subject.includes("csat") ||
    nodeId.startsWith("CSAT")
  );
}

function isGsQuestion(q) {
  return !isCsatQuestion(q);
}

// ============================================================
// Question normalizer
// ============================================================
function normalizeQuestion(raw) {
  if (!raw) return null;
  const opts = raw.options || {};
  return {
    id:             raw.id,
    year:           raw.year || null,
    questionNumber: raw.questionNumber || null,
    question:       raw.question || raw.questionText || "",
    options: {
      A: opts.A || "",
      B: opts.B || "",
      C: opts.C || "",
      D: opts.D || "",
    },
    // Expose the normalised answer (A/B/C/D or null) so callers don't need to re-parse
    answer:         normalizeAnswer(raw.answer),
    subject:        raw.subject || "",
    nodeId:         raw.nodeId || "",
    syllabusNodeId: raw.syllabusNodeId || raw.nodeId || "",
    topic:          raw.topic || raw.sourceTopicBucket || "",
    microthemes:    raw.microthemes || [],
    sourceFile:     raw.sourceFile || "",
    paper:          isCsatQuestion(raw) ? "CSAT" : "GS",
    stage:          raw.stage || "prelims",
  };
}

// ============================================================
// Shuffle helper
// ============================================================
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ============================================================
// Answer helpers
// ============================================================

/**
 * Normalise a raw answer field to one of A|B|C|D, or null.
 * Handles strings, objects, null, undefined, and garbage values.
 *
 * Examples:
 *   "A"           -> "A"
 *   "(B)"         -> "B"
 *   "b."          -> "B"
 *   { correct_option: "C" } -> "C"
 *   null          -> null
 *   "x"           -> null
 */
export function normalizeAnswer(ans) {
  if (ans === undefined || ans === null) return null;

  if (typeof ans === "string") {
    const clean = ans.trim().toUpperCase().replace(/[().]/g, "");
    return ["A", "B", "C", "D"].includes(clean) ? clean : null;
  }

  // Some older source files stored answer as an object
  if (typeof ans === "object") {
    const keys = [
      "correct_option", "correctOption",
      "correct_answer", "correctAnswer",
      "answer", "option", "key", "value",
    ];
    for (const k of keys) {
      if (ans[k]) {
        const clean = String(ans[k]).trim().toUpperCase().replace(/[().]/g, "");
        if (["A", "B", "C", "D"].includes(clean)) return clean;
      }
    }
  }

  return null;
}

/** True only when the question has a parseable A/B/C/D answer. */
function hasValidAnswer(q) {
  return normalizeAnswer(q.answer) !== null;
}

// ============================================================
// Scoring
// ============================================================
export function calculatePrelimsScore(paper, correct, wrong) {
  if (paper === "CSAT") {
    return correct * 2.5 - wrong * 0.83;
  }
  return correct * 2 - wrong * 0.66;
}

// ============================================================
// 1. Fetch Questions
// ============================================================
export function fetchQuestions({ mode, paper, nodeId, year, limit = 100, shuffleResults = true }) {
  const master = loadMasterIndex();
  const byNode = loadByNode();
  const allQuestions = Object.values(master);

  let pool = [];

  if (mode === "topic") {
    if (!nodeId) throw new Error("nodeId required for topic mode");

    const nodeEntry = byNode[nodeId];
    let ids = [];
    if (Array.isArray(nodeEntry)) {
      ids = nodeEntry;
    } else if (nodeEntry && typeof nodeEntry === "object") {
      ids = Object.values(nodeEntry).flat();
    }

    if (ids.length > 0) {
      pool = ids.map(id => master[id]).filter(Boolean);
    }

    // Fallback: filter by syllabusNodeId directly
    if (pool.length === 0) {
      pool = allQuestions.filter(q =>
        (q.syllabusNodeId || q.nodeId || "") === nodeId
      );
    }

    // Further filter by paper
    pool = pool.filter(q => paper === "CSAT" ? isCsatQuestion(q) : isGsQuestion(q));

  } else if (mode === "year") {
    if (!year) throw new Error("year required for year mode");
    const numYear = Number(year);
    pool = allQuestions.filter(q => {
      const yearMatch  = Number(q.year) === numYear;
      const paperMatch = paper === "CSAT" ? isCsatQuestion(q) : isGsQuestion(q);
      return yearMatch && paperMatch;
    });

  } else {
    // mixed: all questions of the paper
    pool = allQuestions.filter(q => paper === "CSAT" ? isCsatQuestion(q) : isGsQuestion(q));
  }

  // De-dupe by id
  const seen = new Set();
  pool = pool.filter(q => {
    if (!q || !q.id || seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });

  // Filter to questions with a valid, parseable A/B/C/D answer
  const beforeAnswerFilter = pool.length;
  pool = pool.filter(hasValidAnswer);
  const excludedDueToMissingAnswer = beforeAnswerFilter - pool.length;

  // Shuffle before limit
  if (shuffleResults) pool = shuffle(pool);
  pool = pool.slice(0, Number(limit) || 100);

  return {
    questions: pool.map(normalizeQuestion).filter(Boolean),
    total: pool.length,
    excludedDueToMissingAnswer,
    mode,
    paper,
    nodeId: nodeId || null,
    year: year || null,
  };
}

// ============================================================
// 2. Create Attempt
// ============================================================
export async function startAttempt({ userId, mode, paper, title, nodeId, year, questionIds }) {
  const attempt = await createAttempt({
    user_id:         userId,
    mode,
    paper,
    title:           title || buildDefaultTitle(mode, paper, nodeId, year),
    node_id:         nodeId || null,
    year:            year  || null,
    total_questions: questionIds.length,
  });

  await createBlankResponses(attempt.id, userId, questionIds);

  return { attemptId: attempt.id, status: attempt.status };
}

function buildDefaultTitle(mode, paper, nodeId, year) {
  if (mode === "topic")  return `${paper} Topic Test -- ${nodeId || ""}`;
  if (mode === "year")   return `${paper} ${year} Year Test`;
  return `${paper} Mixed Practice`;
}

// ============================================================
// 3. Save Response (in-progress)
// ============================================================
export async function saveResponse(attemptId, userId, data) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt is already submitted");

  return upsertResponse(attemptId, userId, {
    question_id:        data.questionId,
    selected_answer:    data.selectedAnswer || null,
    time_spent_seconds: data.timeSpentSeconds || 0,
    marked_for_review:  data.markedForReview ?? false,
  });
}

// ============================================================
// 4. Submit Attempt
// ============================================================
export async function submitAttempt(attemptId, userId, rawResponses) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status === "submitted") throw new Error("Attempt already submitted");

  const master = loadMasterIndex();

  // Evaluate each response against the master index answer
  const evaluated = rawResponses.map(r => {
    const q = master[r.questionId];

    // Use normalizeAnswer -- handles string, object, null cleanly
    const correctAnswer  = normalizeAnswer(q?.answer);
    const selectedAnswer = normalizeAnswer(r.selectedAnswer);

    // If the source question has no parseable answer, mark it as
    // skippedDueToMissingAnswer so it is excluded from scoring + Mistake Book.
    const missingSourceAnswer = !correctAnswer;
    const isSkipped  = missingSourceAnswer || !selectedAnswer;
    const isCorrect  = !isSkipped && selectedAnswer === correctAnswer;

    return {
      question_id:               r.questionId,
      selected_answer:           selectedAnswer || null,
      correct_answer:            correctAnswer  || null,
      is_correct:                isSkipped ? null : isCorrect,
      is_skipped:                isSkipped,
      skippedDueToMissingAnswer: missingSourceAnswer,
      time_spent_seconds:        r.timeSpentSeconds || 0,
      marked_for_review:         r.markedForReview ?? false,
      // Hydrated question for result payload
      question: q ? normalizeQuestion(q) : null,
    };
  });

  // Bulk-update all responses in DB
  await bulkUpdateResponses(attemptId, userId, evaluated);

  // Compute summary -- exclude questions with missing source answers from scoring
  const scorable  = evaluated.filter(r => !r.skippedDueToMissingAnswer);
  const attempted = scorable.filter(r => !r.is_skipped).length;
  const correct   = scorable.filter(r => r.is_correct === true).length;
  const wrong     = scorable.filter(r => r.is_correct === false).length;
  const skipped   = evaluated.filter(r => r.is_skipped).length;   // includes missing-answer
  const score     = calculatePrelimsScore(attempt.paper, correct, wrong);
  const accuracy  = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

  await updateAttemptSummary(attemptId, {
    attempted_count: attempted,
    correct_count:   correct,
    wrong_count:     wrong,
    skipped_count:   skipped,
    score:           Math.round(score * 100) / 100,
    accuracy,
    status:          "submitted",
    submitted_at:    new Date().toISOString(),
  });

  // Mistake Book integration
  // Only log genuinely wrong answers that ALSO have a valid correct answer.
  // Never log questions where the source data has no parseable answer.
  const wrongResponses = evaluated.filter(
    r => r.is_correct === false && r.question && !r.skippedDueToMissingAnswer
  );
  const mistakeResults = await Promise.allSettled(
    wrongResponses.map(r =>
      upsertMistake({
        user_id:         userId,
        source_type:     "pyq_test",
        source_ref:      attemptId,
        question_id:     r.question_id,
        stage:           "prelims",
        subject:         r.question?.subject || "",
        node_id:         r.question?.syllabusNodeId || r.question?.nodeId || "",
        question_text:   r.question?.question || "",
        selected_answer: r.selected_answer || "",
        correct_answer:  r.correct_answer  || "",
        answer_status:   "wrong",
        error_type:      "pyq_mistake",
        notes:           `Auto-logged from Prelims Test (attempt: ${attemptId})`,
        must_revise:     false,
        block_id:        null,
      })
    )
  );

  const mistakesLogged = mistakeResults.filter(r => r.status === "fulfilled").length;
  const mistakesFailed = mistakeResults.filter(r => r.status === "rejected").length;
  if (mistakesFailed > 0) {
    console.warn(`[PrelimTest] ${mistakesFailed} mistake(s) failed to log for attempt ${attemptId}`);
  }

  // ── Adaptive Intelligence: update node_weakness for each affected node ──
  // Non-blocking: failures are logged but never block the submission
  const affectedNodeIds = new Set(
    evaluated
      .filter(r => r.question?.syllabusNodeId || r.question?.nodeId)
      .map(r => r.question?.syllabusNodeId || r.question?.nodeId)
  );
  for (const nodeId of affectedNodeIds) {
    try {
      await upsertNodeWeakness({ userId, nodeId, stage: "prelims" });
    } catch (err) {
      console.warn(`[ADAPTIVE] node_weakness update failed for ${nodeId}:`, err.message);
    }
  }

  const missingAnswerCount = evaluated.filter(r => r.skippedDueToMissingAnswer).length;

  return {
    attemptId,
    totalQuestions: evaluated.length,
    attempted,
    correct,
    wrong,
    skipped,
    missingAnswerCount,
    score: Math.round(score * 100) / 100,
    accuracy,
    mistakesLogged,
    resultByQuestion: evaluated.map(r => ({
      questionId:                r.question_id,
      selectedAnswer:            r.selected_answer,
      correctAnswer:             r.correct_answer,
      isCorrect:                 r.is_correct,
      isSkipped:                 r.is_skipped,
      skippedDueToMissingAnswer: r.skippedDueToMissingAnswer,
      markedForReview:           r.marked_for_review,
      timeSpentSeconds:          r.time_spent_seconds,
      question:                  r.question,
    })),
  };
}

// ============================================================
// 5. Get Attempt Detail
// ============================================================
export async function getAttemptDetail(attemptId) {
  const attempt   = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  const responses = await getResponsesByAttempt(attemptId);
  const master    = loadMasterIndex();

  const hydratedResponses = responses.map(r => ({
    ...r,
    question: r.question_id ? normalizeQuestion(master[r.question_id]) : null,
  }));

  return { attempt, responses: hydratedResponses };
}

// ============================================================
// 6. Get History
// ============================================================
export async function getAttemptHistory(userId, limit = 20) {
  return listAttemptsByUser(userId, limit);
}

// ============================================================
// Audit helpers (used by audit script)
// ============================================================
export function getMasterIndex() {
  return loadMasterIndex();
}

export function getByNodeIndex() {
  return loadByNode();
}
