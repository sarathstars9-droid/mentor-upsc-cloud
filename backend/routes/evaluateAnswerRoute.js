import express from "express";
import { evaluateMainsAnswer } from "../services/ai/evaluateAnswer.js";
import { saveBasicEvaluation } from "../repositories/evaluateAnswerRepository.js";
import { aggregateCosts } from "../services/geminiCostTracker.js";

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
      visualArtifacts,
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
      userId: userId || "user_1",
      question: questionText,
      answer: candidateAnswer,
      visualArtifacts: visualArtifacts,
      paper: finalPaper,
      subject: finalSubject,
      topic: finalTopic,
      marks: marks || 10,
      wordLimit: wordLimit || 150,
    });

    // Elevate and aggregate telemetry usage
    const evalUsage = evaluation.mains_eval_v1?.evaluation_meta?.ai_usage;
    const aiUsages = evalUsage ? [evalUsage] : [];
    if (!evaluation.evaluation_meta) evaluation.evaluation_meta = {};
    evaluation.evaluation_meta.ai_usage = {
      calls: aiUsages,
      normal_evaluation: aggregateCosts(aiUsages)
    };

    try {
      console.log("[evaluateAnswerRoute] Attempting to save to DB. Score:", evaluation.score);

      // Extract numeric score from the V1 payload for clean DB insertion
      const finalScore = evaluation.mains_eval_v1?.score?.awarded ?? null;

      // Extract RAG retrieval metadata (V1.5A) — null-safe
      const ragMeta = evaluation.rag_retrieval_meta || null;

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
        ragRetrievalVersion: ragMeta?.retrieval_version || null,
        ragKnowledgeItemIds: ragMeta?.knowledge_item_ids || [],
        ragRetrievedPyqIds: ragMeta?.retrieved_pyq_ids || [],
        ragMissingCategories: evaluation.mains_eval_v1?.evaluation_meta?.rag_missing_categories || [],
        ragCategoryCounts: ragMeta?.category_counts || {}
      });
      console.log("[evaluateAnswerRoute] Successfully saved to DB. Row ID:", savedRow?.id);

      // Generate mistakes automatically for the Mistake Book
      try {
        const { generateMistakesFromBasicEvaluation } = await import("../services/mainsMistakeService.js");
        await generateMistakesFromBasicEvaluation({
          userId: userId || 'user_1',
          attemptId: attemptId || null,
          paper: finalPaper,
          subject: finalSubject,
          topic: finalTopic,
          questionText,
          candidateAnswer,
          evaluationJson: evaluation,
          score: finalScore,
          nodeId: syllabusNodeId || syllabus_node_id || null
        });
        console.log("[evaluateAnswerRoute] Generated mistakes from basic review.");
      } catch (mistakeErr) {
        console.error("[evaluateAnswerRoute] generateMistakesFromBasicEvaluation failed:", mistakeErr);
      }

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

