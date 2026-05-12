import express from "express";
import { getNextAction } from "../services/adaptiveRecommendationService.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/adaptive/next-actions?userId=user_1&stage=prelims
//
// Returns top 5 adaptive recommendations based on node_weakness data.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/next-actions", async (req, res) => {
  try {
    const { userId, stage, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const parsedLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));
    const recommendations = await getNextAction({
      userId,
      stage: stage || undefined,
      limit: parsedLimit,
    });

    res.json({
      ok: true,
      recommendations,
    });
  } catch (err) {
    console.error("[ADAPTIVE NEXT-ACTIONS ERROR]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
