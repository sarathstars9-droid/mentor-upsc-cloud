// backend/routes/mainsReviewRoutes.js
// Mains Review Pipeline — 4 endpoints wired to the modular pipeline.
//
// Mounted at: /api/mains  (so paths here are /attempt/save, /review/save, etc.)
//
// Endpoints:
//   POST /api/mains/attempt/save
//   POST /api/mains/review/save
//   POST /api/mains/review/process
//   GET  /api/mains/review/result

import { Router } from "express";
import {
  generateAttemptId,
  generateReviewId,
  buildAttemptRecord,
  buildReviewRecord,
  safeReadJson,
  attemptFilePath,
  reviewFilePath,
  derivedFilePath,
} from "../mainsReview/mainsReviewUtils.js";
import {
  saveAttemptRecord,
  saveReviewRecord,
} from "../mainsReview/saveMainsReviewRecord.js";
import { runReviewPipeline } from "../mainsReview/mainsReviewPipeline.js";

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempt/save
// Body: mainsAnswerAttempt payload (source, question, writingSession, etc.)
// Returns: { ok: true, attemptId }
// ────────────────────────────────────────────────────────────────────────────
router.post("/attempt/save", (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.question || !payload.source) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: question and source",
      });
    }

    const attemptId = generateAttemptId();
    const record = buildAttemptRecord(payload, attemptId);
    const saved = saveAttemptRecord(record);

    if (!saved) {
      return res.status(500).json({
        ok: false,
        error: "Failed to persist attempt record",
      });
    }

    console.log(`[mainsReview] POST attempt/save → ${attemptId}`);
    return res.json({ ok: true, attemptId });
  } catch (err) {
    console.error("[mainsReview] attempt/save error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/review/save
// Body: { attemptId, rawReviewText, userAgreement?, reviewSource?, userId? }
// Returns: { ok: true, reviewId }
// ────────────────────────────────────────────────────────────────────────────
router.post("/review/save", (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.attemptId) {
      return res.status(400).json({ ok: false, error: "Missing required field: attemptId" });
    }
    if (!payload.rawReviewText || !String(payload.rawReviewText).trim()) {
      return res.status(400).json({ ok: false, error: "Missing or empty rawReviewText" });
    }

    // Verify the attempt exists — we never trust a review without a parent
    const existingAttempt = safeReadJson(attemptFilePath(payload.attemptId));
    if (!existingAttempt) {
      return res.status(404).json({
        ok: false,
        error: `Attempt not found: ${payload.attemptId}. Save attempt first.`,
      });
    }

    const reviewId = generateReviewId();
    const record = buildReviewRecord(payload, reviewId);
    const saved = saveReviewRecord(record);

    if (!saved) {
      return res.status(500).json({ ok: false, error: "Failed to persist review record" });
    }

    console.log(`[mainsReview] POST review/save → ${reviewId} (attempt: ${payload.attemptId})`);
    return res.json({ ok: true, reviewId });
  } catch (err) {
    console.error("[mainsReview] review/save error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/review/process
// Body: { attemptId, reviewId }
// Runs the full pipeline: parse → audit → signals → mistakes → tasks → save derived
// Returns: { ok: true, result: <processedReviewResult> }
// ────────────────────────────────────────────────────────────────────────────
router.post("/review/process", async (req, res) => {
  try {
    const { attemptId, reviewId } = req.body || {};

    if (!attemptId || !reviewId) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: attemptId and reviewId",
      });
    }

    const pipelineResult = await runReviewPipeline(attemptId, reviewId);

    if (!pipelineResult.ok) {
      console.warn(`[mainsReview] Pipeline failed: ${pipelineResult.error}`);
      return res.status(422).json({ ok: false, error: pipelineResult.error });
    }

    console.log(`[mainsReview] POST review/process → ok (attempt: ${attemptId}, review: ${reviewId})`);
    return res.json({ ok: true, result: pipelineResult.result });
  } catch (err) {
    console.error("[mainsReview] review/process error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/review/result?attemptId=...&reviewId=...
// Returns full stored result from the derived JSON file.
// Shape: { ok, attempt, review, audit, intelligence }
// ────────────────────────────────────────────────────────────────────────────
router.get("/review/result", (req, res) => {
  try {
    const { attemptId, reviewId } = req.query;

    if (!attemptId || !reviewId) {
      return res.status(400).json({
        ok: false,
        error: "Missing query params: attemptId and reviewId are required",
      });
    }

    const attempt = safeReadJson(attemptFilePath(attemptId));
    if (!attempt) {
      return res.status(404).json({ ok: false, error: `Attempt not found: ${attemptId}` });
    }

    const review = safeReadJson(reviewFilePath(reviewId));
    if (!review) {
      return res.status(404).json({ ok: false, error: `Review not found: ${reviewId}` });
    }

    const derived = safeReadJson(derivedFilePath(attemptId, reviewId));
    if (!derived) {
      return res.status(404).json({
        ok: false,
        error: `Derived result not found for ${attemptId}/${reviewId}. Run /review/process first.`,
      });
    }

    // Return in the contract shape: { ok, attempt, review, audit, intelligence }
    return res.json({
      ok: true,
      attempt,
      review,
      audit: derived.audit || null,
      intelligence: {
        parsed:          derived.parsed || null,
        signals:         derived.signals || null,
        mistakeRecords:  derived.mistakeRecords || [],
        revisionTasks:   derived.revisionTasks || [],
      },
    });
  } catch (err) {
    console.error("[mainsReview] review/result error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
