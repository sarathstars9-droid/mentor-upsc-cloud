import express from "express";
import { getWeaknessSummaryData } from "../repositories/mainsPatternRepository.js";
import { generateRecommendations } from "../services/mains/generateWeaknessRecommendations.js";

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

router.get("/recommendations", async (req, res) => {
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
    }))
    .sort((a, b) => {
      if (a.confidenceLevel === "confirmed" && b.confidenceLevel !== "confirmed") return -1;
      if (b.confidenceLevel === "confirmed" && a.confidenceLevel !== "confirmed") return 1;
      if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
      if (b.sources.air1Review !== a.sources.air1Review) return b.sources.air1Review - a.sources.air1Review;
      return b.count - a.count;
    });

    const recommendations = generateRecommendations(weaknessSummary);

    return res.json({
      success: true,
      userId,
      recommendations
    });
  } catch (error) {
    console.error("[mainsRecommendationRoutes] Error generating recommendations:", error);
    return res.status(500).json({ success: false, error: "Failed to generate recommendations" });
  }
});

export default router;
