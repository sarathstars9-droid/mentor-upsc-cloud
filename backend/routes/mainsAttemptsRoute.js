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
} from "../repositories/mainsAttemptRepository.js";
import { generateLearningLoop } from "../services/learningLoopService.js";

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempts/save
// ────────────────────────────────────────────────────────────────────────────
router.post("/save", async (req, res) => {
  const body = req.body || {};
  const { userId, status } = body;

  // Generate a new attemptId if one was not provided by the client
  const attemptId = body.attemptId || `mains_${randomUUID()}`;

  console.log("[mains-attempt] save request", { userId, attemptId, status });

  try {
    const saved = await upsertMainsAttempt({
      attemptId,
      userId:             body.userId        || "user_1",
      questionText:       body.questionText  || body.question || "",
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

    console.log("[mains-attempt] saved", { attemptId: saved.attempt_id });
    
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
    questionText:       row.question_text,
    paper:              row.paper,
    subject:            row.subject,
    topic:              row.topic,
    marks:              row.marks,
    wordLimit:          row.word_limit,
    finalAnswerText:    row.final_answer_text,
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
