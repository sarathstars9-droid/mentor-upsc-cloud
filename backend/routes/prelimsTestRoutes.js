// backend/routes/prelimsTestRoutes.js
// Prelims Test Engine — REST API
// Mounted at: /api/prelims-tests

import express from "express";
import {
  fetchQuestions,
  startAttempt,
  saveResponse,
  submitAttempt,
  getAttemptDetail,
  getAttemptHistory,
} from "../services/prelimsTestService.js";

const router = express.Router();

// ── GET /api/prelims-tests/questions ─────────────────────────────────────────
// Fetch questions for a test session (does NOT save to DB)
router.get("/questions", (req, res) => {
  try {
    const {
      userId,
      mode    = "mixed",
      paper   = "GS",
      nodeId,
      year,
      limit   = 100,
      shuffle = "true",
    } = req.query;

    if (!["topic", "year", "mixed"].includes(mode)) {
      return res.status(400).json({ error: "mode must be: topic | year | mixed" });
    }
    if (!["GS", "CSAT"].includes(paper)) {
      return res.status(400).json({ error: "paper must be: GS | CSAT" });
    }
    if (mode === "topic" && !nodeId) {
      return res.status(400).json({ error: "nodeId is required for topic mode" });
    }
    if (mode === "year" && !year) {
      return res.status(400).json({ error: "year is required for year mode" });
    }

    const result = fetchQuestions({
      mode,
      paper,
      nodeId,
      year:           year ? Number(year) : undefined,
      limit:          Number(limit) || 100,
      shuffleResults: shuffle !== "false",
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[prelims-tests] /questions failed:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch questions" });
  }
});

// ── POST /api/prelims-tests/attempts ─────────────────────────────────────────
// Create a new test attempt and blank response rows
router.post("/attempts", async (req, res) => {
  try {
    const { userId, mode, paper, title, nodeId, year, questionIds } = req.body || {};

    if (!userId)       return res.status(400).json({ error: "userId required" });
    if (!mode)         return res.status(400).json({ error: "mode required" });
    if (!paper)        return res.status(400).json({ error: "paper required" });
    if (!Array.isArray(questionIds) || !questionIds.length) {
      return res.status(400).json({ error: "questionIds array required" });
    }

    const result = await startAttempt({ userId, mode, paper, title, nodeId, year, questionIds });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[prelims-tests] POST /attempts failed:", err);
    return res.status(500).json({ error: err.message || "Failed to create attempt" });
  }
});

// ── PATCH /api/prelims-tests/attempts/:attemptId/response ─────────────────────
// Save a single question response (in-progress, no submit)
router.patch("/attempts/:attemptId/response", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { userId, questionId, selectedAnswer, timeSpentSeconds, markedForReview } = req.body || {};

    if (!userId || !questionId) {
      return res.status(400).json({ error: "userId and questionId required" });
    }

    const response = await saveResponse(attemptId, userId, {
      questionId,
      selectedAnswer,
      timeSpentSeconds,
      markedForReview,
    });

    return res.json({ ok: true, response });
  } catch (err) {
    console.error("[prelims-tests] PATCH /response failed:", err);
    const status = err.message?.includes("not found") ? 404
      : err.message?.includes("submitted") ? 409 : 500;
    return res.status(status).json({ error: err.message || "Failed to save response" });
  }
});

// ── POST /api/prelims-tests/attempts/:attemptId/submit ────────────────────────
// Submit the test: evaluate all answers, compute score, log mistakes
router.post("/attempts/:attemptId/submit", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { userId, responses } = req.body || {};

    if (!userId) return res.status(400).json({ error: "userId required" });
    if (!Array.isArray(responses) || !responses.length) {
      return res.status(400).json({ error: "responses array required" });
    }

    const result = await submitAttempt(attemptId, userId, responses);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[prelims-tests] POST /submit failed:", err);
    const status = err.message?.includes("not found") ? 404
      : err.message?.includes("already submitted") ? 409 : 500;
    return res.status(status).json({ error: err.message || "Failed to submit attempt" });
  }
});

// ── GET /api/prelims-tests/attempts/:attemptId ────────────────────────────────
// Full attempt + responses + hydrated questions
router.get("/attempts/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const result = await getAttemptDetail(attemptId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[prelims-tests] GET /attempts/:id failed:", err);
    const status = err.message?.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: err.message || "Failed to get attempt" });
  }
});

// ── GET /api/prelims-tests/history ────────────────────────────────────────────
// Recent attempts for a user
router.get("/history", async (req, res) => {
  try {
    const { userId, limit = 20 } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const attempts = await getAttemptHistory(userId, Number(limit) || 20);
    return res.json({ ok: true, attempts });
  } catch (err) {
    console.error("[prelims-tests] GET /history failed:", err);
    return res.status(500).json({ error: err.message || "Failed to get history" });
  }
});

export default router;
