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

    // Log AIR1_REVIEW_SAVED study event
    try {
      const { logStudyEvent } = await import("../services/eventService.js");
      await logStudyEvent({
        userId: userId || "moulika",
        eventType: "AIR1_REVIEW_SAVED",
        subject: null,
        paper: paper || null,
        topic: question || null,
        syllabusNodeId: req.body.syllabusNodeId || req.body.syllabus_node_id || null,
        metadata: {
          air1_review_id: saved?.id || saved?.id,
          score: intelligence?.estimatedMarks?.scored || null
        }
      });
    } catch (e) {
      console.error("[air1ReviewRoutes] failed logging AIR1_REVIEW_SAVED event:", e.message);
    }

    return res.json({
      success: true,
      intelligence,
      savedId: saved?.id || null,
    });
  } catch (error) {
    console.error("[air1ReviewRoutes] extract failed:", error);
    return res.status(500).json({
      success: false,
      message: "AI extraction temporarily unavailable. Please retry.",
      error: "AI extraction temporarily unavailable. Please retry."
    });
  }
});

export default router;
