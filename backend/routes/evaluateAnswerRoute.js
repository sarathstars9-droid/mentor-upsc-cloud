import express from "express";
import { evaluateMainsAnswer } from "../services/ai/evaluateAnswer.js";
import { saveBasicEvaluation } from "../repositories/evaluateAnswerRepository.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { question, answer, paper, marks, wordLimit } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: question and answer are mandatory.",
      });
    }

    const evaluation = await evaluateMainsAnswer({
      question,
      answer,
      paper: paper || "General Studies",
      marks: marks || 10,
      wordLimit: wordLimit || 150,
    });

    try {
      console.log("[evaluateAnswerRoute] Attempting to save to DB. Score:", evaluation.score, "Tags:", evaluation.weakness_tags);
      console.log("[evaluateAnswerRoute] evaluation.score:", evaluation?.score);
      const parsedScore = Number(evaluation?.score);
      const finalScore = isNaN(parsedScore) ? null : parsedScore;

      const savedRow = await saveBasicEvaluation({
        userId: req.body.userId || 'moulika',
        question,
        answer,
        paper: paper || "General Studies",
        marks: marks || 10,
        wordLimit: wordLimit || 150,
        evaluationJson: evaluation,
        score: finalScore,
        weaknessTags: evaluation.weakness_tags || [],
      });
      console.log("[evaluateAnswerRoute] Successfully saved to DB. Row ID:", savedRow?.id);
    } catch (dbError) {
      console.error("[evaluateAnswerRoute] DB save failed:", dbError);
    }

    return res.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("[evaluateAnswerRoute] Error evaluating answer:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to evaluate answer. Please check logs for details.",
    });
  }
});

export default router;
