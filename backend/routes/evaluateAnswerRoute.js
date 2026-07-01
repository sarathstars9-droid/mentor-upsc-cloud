import express from "express";
import { evaluateMainsAnswer } from "../services/ai/evaluateAnswer.js";
import { saveBasicEvaluation } from "../repositories/evaluateAnswerRepository.js";

const router = express.Router();

const WORKSPACE_PAPER_MAP = {
  essay: "GS Paper I Essay",
  ethics: "GS Paper IV",
  geography_optional: "Optional Geography"
};

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
      answerSourceType,
      syllabusNodeId,
      syllabus_node_id
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

    const finalPaper = paper || WORKSPACE_PAPER_MAP[req.body.workspace] || req.body.workspace || "General Studies";
    const finalSubject = subject || "";
    const finalTopic = topic || req.body.answerType || "";

    const evaluation = await evaluateMainsAnswer({
      question: questionText,
      answer: candidateAnswer,
      paper: finalPaper,
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
        paper: finalPaper,
        marks: marks || 10,
        wordLimit: wordLimit || 150,
        evaluationJson: evaluation,
        score: finalScore,
        weaknessTags: evaluation.weakness_tags || [],
      });
      console.log("[evaluateAnswerRoute] Successfully saved to DB. Row ID:", savedRow?.id);

      // Log BASIC_REVIEW_DONE study event
      try {
        const { logStudyEvent } = await import("../services/eventService.js");
        await logStudyEvent({
          userId: userId || "user_1",
          eventType: "BASIC_REVIEW_DONE",
          subject: finalSubject || null,
          paper: finalPaper,
          topic: questionText || null,
          syllabusNodeId: syllabusNodeId || syllabus_node_id || null,
          metadata: {
            evaluation_id: savedRow?.id,
            score: finalScore,
            attempt_id: attemptId || null
          }
        });
      } catch (eventErr) {
        console.error("[evaluateAnswerRoute] logStudyEvent failed:", eventErr.message);
      }
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
      message: "AI extraction temporarily unavailable. Please retry.",
      error: "AI extraction temporarily unavailable. Please retry."
    });
  }
});

export default router;

