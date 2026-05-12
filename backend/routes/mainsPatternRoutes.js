import express from "express";
import { getWeaknessSummaryData } from "../repositories/mainsPatternRepository.js";

const router = express.Router();

function getSeverity(count) {
  if (count >= 8) return "critical";
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function getConfidenceLevel(weightedScore) {
  if (weightedScore >= 6) return "confirmed";
  if (weightedScore >= 3) return "probable";
  return "emerging";
}

router.get("/weakness-summary", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const data = await getWeaknessSummaryData(userId);

    const weaknessSummary = data.weaknesses.map(w => ({
      weakness: w.weakness,
      count: parseInt(w.count, 10),
      sources: {
        basicEvaluation: parseInt(w.basic_evaluation_count || 0, 10),
        air1Review: parseInt(w.air1_review_count || 0, 10)
      },
      weightedScore: parseInt(w.weighted_score || 0, 10),
      confidenceLevel: getConfidenceLevel(parseInt(w.weighted_score || 0, 10)),
      severity: getSeverity(parseInt(w.weighted_score || 0, 10)),
      lastSeen: w.last_seen
    }));

    const topWeakness = weaknessSummary.length > 0 ? weaknessSummary[0].weakness : null;

    return res.json({
      success: true,
      userId,
      totalEvaluations: data.totalEvaluations,
      weaknessSummary,
      averageScore: data.averageScore,
      topWeakness
    });
  } catch (error) {
    console.error("[mainsPatternRoutes] Error fetching weakness summary:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch weakness summary" });
  }
});

export default router;
