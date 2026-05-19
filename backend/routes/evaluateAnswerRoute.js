import express from "express";
import { evaluateMainsAnswer } from "../services/ai/evaluateAnswer.js";
import { saveBasicEvaluation } from "../repositories/evaluateAnswerRepository.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { 
      userId,
      attemptId,
      paper,
      subject,
      topic,
      questionText,
      candidateAnswer,
      marks,
      wordLimit,
      sourceType,
      questionSourceType,
      answerSourceType 
    } = req.body;

    if (!questionText) {
      return res.status(400).json({
        success: false,
        error: "questionText is required",
      });
    }

    if (!candidateAnswer) {
      return res.status(400).json({
        success: false,
        error: "candidateAnswer is required",
      });
    }

    const evaluation = await evaluateMainsAnswer({
      question: questionText,
      answer: candidateAnswer,
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
        userId: userId || 'user_1',
        question: questionText,
        answer: candidateAnswer,
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

