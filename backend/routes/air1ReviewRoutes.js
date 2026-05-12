import express from "express";
import { extractAir1Intelligence } from "../services/ai/extractAir1Intelligence.js";
import { saveAir1ReviewIntelligence } from "../repositories/air1ReviewIntelligenceRepository.js";

const router = express.Router();

router.post("/extract", async (req, res) => {
  try {
    const { userId, question, studentAnswer, air1Review, paper } = req.body || {};

    if (!question || !studentAnswer || !air1Review) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: question, studentAnswer, air1Review are mandatory.",
      });
    }

    const intelligence = await extractAir1Intelligence({
      question,
      studentAnswer,
      air1Review,
    });

    const saved = await saveAir1ReviewIntelligence({
      userId: userId || "moulika",
      question,
      studentAnswer,
      air1Review,
      paper: paper || null,
      extractedJson: intelligence,
    });

    return res.json({
      success: true,
      intelligence,
      savedId: saved?.id || null,
    });
  } catch (error) {
    console.error("[air1ReviewRoutes] extract failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to extract AIR-1 intelligence.",
    });
  }
});

export default router;
