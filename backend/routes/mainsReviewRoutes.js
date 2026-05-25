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
import { buildAir1Prompt } from "../mainsReview/buildAir1Prompt.js";
import { saveAir1ReviewIntelligence } from "../repositories/air1ReviewRepository.js";
import multer from "multer";
import { extractHandwrittenAnswer } from "../services/ai/extractHandwrittenAnswer.js";
import { extractQuestionAnswerFromImages } from "../services/ai/extractQuestionAnswer.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempt/save
// Body: mainsAnswerAttempt payload (source, question, writingSession, etc.)
// Returns: { ok: true, attemptId }
// ────────────────────────────────────────────────────────────────────────────
router.post("/attempt/save", async (req, res) => {
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

    let air1ReviewSaved = false;

    if (record.air1Review?.rawText) {
      try {
        const parsedJson = record.air1Review.parsedJson;
        await saveAir1ReviewIntelligence({
          userId: record.userId,
          question: record.question?.text || "",
          studentAnswer: record.extraction?.extractedText || record.extraction?.text || "",
          air1ReviewText: record.air1Review.rawText,
          paper: record.source?.paper || record.question?.paper || null,
          extractedJson: parsedJson || null,
          overallLevel: parsedJson?.level || parsedJson?.overallLevel || null,
          estimatedScore: parsedJson?.score || parsedJson?.estimatedScore || null,
          coreWeaknesses: parsedJson?.mistakeTypes || parsedJson?.coreWeaknesses || parsedJson?.missingDimensions || [],
          focusAreas: parsedJson?.revisionTasks || parsedJson?.focusAreas || []
        });
        air1ReviewSaved = true;
        console.log(`[mainsReview] Saved AIR-1 review to DB for attempt ${attemptId}`);
      } catch (dbErr) {
        console.error(`[mainsReview] Failed to save AIR-1 review to DB for attempt ${attemptId}:`, dbErr);
        // We don't block the overall save if DB insert fails
      }
    }

    console.log(`[mainsReview] POST attempt/save → ${attemptId}`);
    return res.json({ ok: true, attemptId, air1ReviewSaved });
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

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/air1-prompt
// Body: payload containing question and answer details
// Returns: { ok: true, prompt: <string> }
// ────────────────────────────────────────────────────────────────────────────
router.post("/air1-prompt", async (req, res) => {
  try {
    const prompt = buildAir1Prompt(req.body || {});
    return res.json({ ok: true, prompt });
  } catch (error) {
    console.error("AIR-1 prompt build failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to build AIR-1 prompt",
      details: error.message
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/extract-answer
// Multipart form with up to 5 image files under 'pages' field.
// Returns: { ok: true, text: "extracted answer text" }
// ────────────────────────────────────────────────────────────────────────────
router.post("/extract-answer", upload.array("pages", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, error: "No pages uploaded" });
    }

    const type = req.query.type || req.body.type || "answer";
    let customPrompt = null;
    if (type === "question") {
      customPrompt = `You are extracting a UPSC Mains question from an uploaded image or PDF document.
Rules:
1. Extract only the question text cleanly and accurately. Do not add metadata, tags, comments, or answers.
2. Maintain paragraph breaks, numbering, and subparts exactly as printed.
3. If a word is unreadable, write [unclear].
4. Return only the extracted question text.`;
    }

    const images = req.files.map(file => ({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype
      }
    }));

    const text = await extractHandwrittenAnswer(images, customPrompt);

    return res.json({ ok: true, text });
  } catch (err) {
    console.error("[mainsReview] extract-answer error:", err);
    return res.status(500).json({
      success: false,
      message: "AI extraction temporarily unavailable. Please retry.",
      error: "AI extraction temporarily unavailable. Please retry."
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/extract-question-answer
// Multipart form with up to 5 image/PDF files under 'pages' field.
// Returns: strict JSON { success, questionText, answerText, detectedMetadata, confidence, warnings }
// ────────────────────────────────────────────────────────────────────────────
router.post("/extract-question-answer", upload.array("pages", 5), async (req, res) => {
  console.log("[extract-question-answer] files:", req.files?.length);
  console.log("[extract-question-answer] body:", req.body);
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No pages uploaded" });
    }

    const images = req.files.map(file => ({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype
      }
    }));

    const result = await extractQuestionAnswerFromImages(images);
    return res.json(result);
  } catch (err) {
    console.error("[extract-question-answer] failed:", err);
    return res.status(500).json({
      success: false,
      message: "AI extraction temporarily unavailable. Please retry.",
      error: "AI extraction temporarily unavailable. Please retry."
    });
  }
});

router.get("/debug-air1", (req, res) => {
  res.json({ ok: true, route: "mainsReviewRoutes active" });
});

export default router;
