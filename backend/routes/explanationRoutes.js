import express from "express";
import {
  saveExplanation,
  fetchExplanation,
  fetchExplanationsBulk,
  removeExplanation,
  fetchUserExplanations,
} from "../services/explanationService.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Error serializer (consistent with existing error handling patterns)
// ─────────────────────────────────────────────────────────────────────────────
function serializeError(err) {
  if (!err) return "Unknown error (null)";
  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.code) parts.push(`[pg_code: ${err.code}]`);
  if (err.detail) parts.push(`[detail: ${err.detail}]`);
  if (err.hint) parts.push(`[hint: ${err.hint}]`);
  return parts.length > 0 ? parts.join(" ") : `[error] ${String(err)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pyq/explanations
// Save or update an explanation
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { userId, questionId, explanationText, source } = req.body || {};

    if (!userId || !questionId || !explanationText) {
      return res.status(400).json({
        success: false,
        error: "userId, questionId, and explanationText are required in request body",
      });
    }

    const result = await saveExplanation({
      userId,
      questionId,
      explanationText,
      source: source || "chatgpt",
    });

    res.json(result);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[EXPLANATION SAVE ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pyq/explanations/bulk
// Fetch multiple explanations by questionIds (for topic page bulk hydration)
// Query: ?userId=...&questionIds=id1,id2,id3
// MUST be defined before /:questionId so Express doesn't swallow "bulk" as a param
// ─────────────────────────────────────────────────────────────────────────────
router.get("/bulk", async (req, res) => {
  try {
    const { userId, questionIds } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
    }

    const ids = questionIds
      ? String(questionIds)
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];

    const result = await fetchExplanationsBulk(userId, ids);
    res.json(result);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[EXPLANATION BULK FETCH ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pyq/explanations
// List all explanations for a user (paginated)
// Query: ?userId=...&limit=100&offset=0
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId, limit, offset } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
    }

    const result = await fetchUserExplanations(
      userId,
      parseInt(limit, 10) || 100,
      parseInt(offset, 10) || 0
    );

    res.json(result);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[EXPLANATION LIST ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pyq/explanations/:questionId
// Fetch explanation for a specific question (query param: userId)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: "questionId parameter is required",
      });
    }

    const result = await fetchExplanation(userId, questionId);
    res.json(result);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[EXPLANATION FETCH ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/pyq/explanations/:questionId
// Delete explanation for a specific question (query param: userId)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: "questionId parameter is required",
      });
    }

    const result = await removeExplanation(userId, questionId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: "Explanation not found or already deleted",
      });
    }

    res.json(result);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[EXPLANATION DELETE ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
