// backend/routes/mainsAttemptsRoute.js
// Persistent mains attempt save + fetch endpoints (PostgreSQL-backed).
//
// POST /api/mains/attempts/save
//   Body: { attemptId, userId, questionText, paper, subject, topic, marks, wordLimit,
//           finalAnswerText, extractedText, answerSource, uploadedPagesMeta,
//           basicReviewJson, air1RawReview, air1ParsedJson,
//           currentScore, targetScore, status }
//   Behavior: UPSERT by attemptId. Returns { ok, attemptId }.
//
// GET  /api/mains/attempts/:attemptId
//   Returns the full saved attempt row.
//
// GET  /api/mains/attempts/latest?userId=user_1
//   Returns the latest attempt for a user.

import { Router } from "express";
import { randomUUID } from "crypto";
import {
  upsertMainsAttempt,
  getMainsAttemptById,
  getLatestMainsAttempt,
  getLatestMainsAttemptForQuestion,
  getMainsAttempts,
} from "../repositories/mainsAttemptRepository.js";
import { generateLearningLoop } from "../services/learningLoopService.js";

const router = Router();

function extractQuestionText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(extractQuestionText).filter(Boolean).join(" ").trim();
  if (typeof value === "object") {
    return extractQuestionText(
      value.question ||
      value.questionText ||
      value.question_text ||
      value.text ||
      value.title ||
      ""
    );
  }
  return String(value).trim();
}

function normalizeQuestionText(value) {
  return extractQuestionText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hashQuestionKey(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildQuestionKey({ paper, year, questionText }) {
  const normalizedQuestion = normalizeQuestionText(questionText);
  const normalizedPaper = String(paper || "GS1").trim().toLowerCase();
  const normalizedYear = String(year || "").trim().toLowerCase();
  const slug = normalizedQuestion.slice(0, 80).replace(/\s+/g, "-") || "unknown-question";
  return [normalizedPaper, normalizedYear || "unknown-year", hashQuestionKey(normalizedQuestion), slug].join(":");
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempts/save
// ────────────────────────────────────────────────────────────────────────────

/**
 * Phase 4 guard: validate question identity before any DB write.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateQuestionIdentity(questionKey, questionText) {
  if (!questionKey || typeof questionKey !== "string" || !questionKey.trim()) {
    return { valid: false, reason: "question_key is missing" };
  }
  if (questionKey.includes("[object")) {
    return { valid: false, reason: `question_key contains '[object': ${questionKey.slice(0, 80)}` };
  }
  if (!questionText || typeof questionText !== "string" || !questionText.trim()) {
    return { valid: false, reason: "question_text is missing" };
  }
  if (questionText.includes("[object Object]")) {
    return { valid: false, reason: "question_text contains '[object Object]'" };
  }
  return { valid: true };
}

router.post("/save", async (req, res) => {
  const body = req.body || {};
  const { userId, status } = body;

  // Generate a new attemptId if one was not provided by the client
  const attemptId = body.attemptId || `mains_${randomUUID()}`;

  console.log("[mains-attempt] save request", { userId, attemptId, status });

  try {
    const questionText = extractQuestionText(body.questionText || body.question_text || body.question || "");
    const questionKey = body.questionKey || body.question_key || buildQuestionKey({
      paper: body.paper || "",
      year: body.year || body.sourceYear || "",
      questionText,
    });

    // ── Phase 4 guard: block corrupt saves before touching the DB ──────────
    const identityCheck = validateQuestionIdentity(questionKey, questionText);
    if (!identityCheck.valid) {
      console.warn("[mains-attempt] SAVE BLOCKED — invalid question identity", {
        reason: identityCheck.reason, userId, attemptId,
        questionKey: String(questionKey).slice(0, 120),
        questionText: String(questionText).slice(0, 120),
      });
      return res.status(400).json({
        ok: false,
        error: "Invalid question identity. Save blocked.",
        detail: identityCheck.reason,
      });
    }

    const saved = await upsertMainsAttempt({
      attemptId,
      userId:             body.userId        || "user_1",
      questionKey,
      question_key:       questionKey,
      questionText,
      paper:              body.paper         || "",
      subject:            body.subject       || "",
      topic:              body.topic         || "",
      marks:              body.marks,
      wordLimit:          body.wordLimit,
      finalAnswerText:    body.finalAnswerText || body.answerText || "",
      extractedText:      body.extractedText  || "",
      answerSource:       body.answerSource   || "typed",
      uploadedPagesMeta:  body.uploadedPagesMeta || [],
      basicReviewJson:    body.basicReview    || body.basicReviewJson || null,
      air1RawReview:      body.air1RawReview  || "",
      air1ParsedJson:     body.air1ParsedJson || body.air1ParsedReview || null,
      currentScore:       body.currentScore   || "",
      targetScore:        body.targetScore    || "",
      status:             status              || "draft",
    });

    console.log("[mains-attempt] saved", { attemptId: saved.attempt_id, questionKey });
    
    let loopStatus = "skipped";
    if (status === "finalized") {
      try {
        await generateLearningLoop(saved);
        loopStatus = "generated";
      } catch (err) {
        console.error("[mains-attempt] learning loop generation failed:", err.message);
        loopStatus = "failed";
      }
    }

    return res.json({ ok: true, attemptId: saved.attempt_id, loopStatus });
  } catch (err) {
    console.error("[mains-attempt] save error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to save attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts/latest?userId=...
// MUST be declared BEFORE /:attemptId to avoid being caught by the param route
// ────────────────────────────────────────────────────────────────────────────
router.get("/latest", async (req, res) => {
  const userId = req.query.userId || "user_1";
  try {
    const row = await getLatestMainsAttempt(userId);
    if (!row) return res.json({ ok: true, attempt: null });
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] latest fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch latest attempt: " + err.message });
  }
});

// GET /api/mains/attempts/latest-for-question?userId=...&questionKey=...
// Returns the latest saved attempt for the exact displayed question key.
router.get("/latest-for-question", async (req, res) => {
  const userId = req.query.userId || "user_1";
  const questionKey = req.query.questionKey || req.query.question_key || "";

  if (!questionKey) {
    return res.status(400).json({ ok: false, error: "questionKey is required" });
  }

  try {
    const row = await getLatestMainsAttemptForQuestion(userId, questionKey);
    if (!row) return res.json({ ok: true, attempt: null });
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] latest-for-question fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch latest question attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts (or GET /api/mains-answers)
// Returns all attempts for a user.
// ────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userId = req.query.userId || "user_1";
  try {
    const rows = await getMainsAttempts(userId);
    const attempts = rows.map(formatAttemptRow);
    return res.json(attempts);
  } catch (err) {
    console.error("[mains-attempt] fetch all error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch attempts: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts/:attemptId
// ────────────────────────────────────────────────────────────────────────────
router.get("/:attemptId", async (req, res) => {
  const { attemptId } = req.params;
  console.log("[mains-attempt] restoring", attemptId);

  try {
    const row = await getMainsAttemptById(attemptId);
    if (!row) {
      return res.status(404).json({ ok: false, error: `Attempt not found: ${attemptId}` });
    }
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Helper: normalize DB row → frontend shape
// ────────────────────────────────────────────────────────────────────────────
function formatAttemptRow(row) {
  return {
    attemptId:          row.attempt_id,
    userId:             row.user_id,
    questionKey:        row.question_key,
    question_key:       row.question_key,
    questionText:       row.question_text,
    question:           row.question_text, // frontend alias
    paper:              row.paper,
    subject:            row.subject,
    topic:              row.topic,
    marks:              row.marks,
    wordLimit:          row.word_limit,
    finalAnswerText:    row.final_answer_text,
    answerText:         row.final_answer_text, // frontend alias
    extractedText:      row.extracted_text,
    answerSource:       row.answer_source,
    uploadedPagesMeta:  row.uploaded_pages_meta || [],
    basicReview:        row.basic_review_json || null,
    air1RawReview:      row.air1_raw_review || "",
    air1ParsedJson:     row.air1_parsed_json || null,
    currentScore:       row.current_score,
    targetScore:        row.target_score,
    status:             row.status,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
    finalizedAt:        row.finalized_at,
  };
}

export default router;
