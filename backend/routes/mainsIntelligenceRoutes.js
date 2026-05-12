import express from "express";
import { evaluateAnswerAttempt } from "../services/mainsIntelligenceService.js";
import { generateNextActions } from "../services/mainsNextActionsService.js";
import { completeAction } from "../services/mainsActionCompletionService.js";
import { generatePerformanceSnapshot } from "../services/mainsPerformanceService.js";

const router = express.Router();

/**
 * POST /api/mains/evaluate
 *
 * Body: { userId, answerAttemptId, rawEvaluation }
 * Returns: { success, evaluation, weaknessSignalsUpdated }
 */
router.post("/evaluate", async (req, res) => {
  try {
    const { userId, answerAttemptId, rawEvaluation } = req.body || {};

    const result = await evaluateAnswerAttempt({
      userId,
      answerAttemptId,
      rawEvaluation,
    });

    return res.json({
      success: true,
      evaluation: result.savedRow,
      weaknessSignalsUpdated: result.weaknessSignalsUpdated || 0,
    });
  } catch (error) {
    console.error("[MAINS INTELLIGENCE] evaluate error:", error);

    if (
      error.code === "23503" ||
      (error.detail && error.detail.includes("mains_answer_attempts"))
    ) {
      return res.status(400).json({
        success: false,
        error: "Answer attempt not found. Create/save the answer attempt before evaluation.",
        code: "ANSWER_ATTEMPT_NOT_FOUND",
      });
    }

    if (error.code && error.code.startsWith("2")) {
      return res.status(400).json({
        success: false,
        error: "Database validation failed: " + (error.detail || error.message),
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || "Failed to evaluate answer attempt",
    });
  }
});

/**
 * GET /api/mains/next-actions?userId=user_1
 *
 * Reads weakness signals for the user, generates/updates action tasks,
 * and returns the top 3 highest-priority undone actions.
 *
 * Returns:
 * {
 *   success: true,
 *   actionsUpserted: <number>,
 *   topActions: [ { action_type, title, description, priority, source_weakness_label, ... } ]
 * }
 */
router.get("/next-actions", async (req, res) => {
  try {
    const userId          = String(req.query.userId          || "").trim();
    const answerAttemptId = String(req.query.answerAttemptId || "").trim() || null;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required query param: userId",
      });
    }

    const result = await generateNextActions(userId, answerAttemptId);

    return res.json({
      success: true,
      actionsUpserted: result.actionsUpserted,
      topActions: result.topActions,
    });
  } catch (error) {
    console.error("[MAINS INTELLIGENCE] next-actions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate next actions",
    });
  }
});
/**
 * PATCH /api/mains/next-actions/:id
 *
 * Body: { userId, status }
 *   status: "completed" | "skipped" | "pending"
 *
 * On "completed":
 *   - Reduces severity in mains_weakness_signals by 0.5
 *   - Increments revision_count on the signal
 *   - Creates a revision_item in revision_items
 *
 * Returns: { success, action, weaknessSignal, revisionItem }
 */
router.patch("/next-actions/:id", async (req, res) => {
  try {
    const { id }              = req.params;
    const { userId, status }  = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId in body" });
    }
    if (!status) {
      return res.status(400).json({ success: false, error: "Missing status in body" });
    }

    const result = await completeAction(userId, id, status);

    return res.json({
      success:       true,
      action:        result.action,
      weaknessSignal: result.weaknessSignal,
      revisionItem:  result.revisionItem,
    });
  } catch (error) {
    console.error("[MAINS INTELLIGENCE] PATCH next-actions error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    if (error.message.includes("Invalid status")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update action status",
    });
  }
});

/**
 * GET /api/mains/intelligence?userId=user_1
 *
 * Returns a full performance intelligence snapshot:
 * {
 *   success, averageScore, strongestPaper, weakestPaper,
 *   mostFrequentWeakness, improvementTrend, actionCompletionRate,
 *   revisionEffectiveness, top3PersistentWeaknesses,
 *   scoreProgressionData, componentAverages, meta
 * }
 */
router.get("/intelligence", async (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required query param: userId",
      });
    }

    const snapshot = await generatePerformanceSnapshot(userId);

    return res.json({ success: true, ...snapshot });
  } catch (error) {
    console.error("[MAINS INTELLIGENCE] GET /intelligence error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate performance snapshot",
    });
  }
});

export default router;
