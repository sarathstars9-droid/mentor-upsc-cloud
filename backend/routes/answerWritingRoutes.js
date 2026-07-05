import { Router } from "express";
import multer from "multer";
import { extractQuestionAnswerFromImages } from "../services/ai/extractQuestionAnswer.js";
import { extractHandwrittenAnswer } from "../services/ai/extractHandwrittenAnswer.js";
import { evaluateMainsAnswer } from "../services/ai/evaluateAnswer.js";
import { saveBasicEvaluation } from "../repositories/evaluateAnswerRepository.js";
import { buildAir1Prompt } from "../mainsReview/buildAir1Prompt.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 10 // max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf"
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.originalname}. Only images and PDF files are allowed.`));
    }
  }
});

const uploadMultiple = upload.any();

function uploadMiddleware(req, res, next) {
  uploadMultiple(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File size limit exceeded. Maximum allowed size is 10MB per file."
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
}

const router = Router();

const getImagesFromFiles = (files) => {
  if (!files || files.length === 0) return [];
  return files.map(file => ({
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: file.mimetype
    }
  }));
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/answer-writing/basic-evaluation
// ────────────────────────────────────────────────────────────────────────────
router.post("/basic-evaluation", uploadMiddleware, async (req, res) => {
  try {
    let ocrQuestion = "";
    let ocrAnswer = "";
    const files = req.files || [];

    if (files.length > 0) {
      console.log(`[answer-writing] Processing ${files.length} files for OCR...`);
      const images = getImagesFromFiles(files);
      try {
        const ocrResult = await extractQuestionAnswerFromImages(images);
        ocrQuestion = ocrResult?.questionText || "";
        ocrAnswer = ocrResult?.answerText || "";
        console.log("[answer-writing] OCR extraction successful.");
      } catch (err) {
        console.error("[answer-writing] extractQuestionAnswerFromImages failed, falling back to extractHandwrittenAnswer:", err);
        try {
          ocrAnswer = await extractHandwrittenAnswer(images);
        } catch (fallbackErr) {
          console.error("[answer-writing] extractHandwrittenAnswer fallback failed:", fallbackErr);
        }
      }
    }

    const questionText = req.body.questionText || ocrQuestion;
    const candidateAnswer = req.body.candidateAnswer || ocrAnswer;
    const paper = req.body.paper || "General Studies";
    const marks = req.body.marks || 10;
    const wordLimit = req.body.wordLimit || 150;
    const userId = req.body.userId || "user_1";
    const subject = req.body.subject || null;
    const syllabusNodeId = req.body.syllabusNodeId || null;
    const attemptId = req.body.attemptId || null;

    if (!questionText) {
      return res.status(400).json({
        success: false,
        error: "Question text is required (type it or upload sheets containing it)",
      });
    }

    if (!candidateAnswer) {
      return res.status(400).json({
        success: false,
        error: "Candidate answer is required (type it or upload answer sheets)",
      });
    }

    console.log(`[answer-writing] Running evaluateMainsAnswer. Paper: ${paper}, Marks: ${marks}, Word Limit: ${wordLimit}`);
    const evaluation = await evaluateMainsAnswer({
      question: questionText,
      answer: candidateAnswer,
      paper,
      marks,
      wordLimit,
    });

    let savedRow = null;
    let finalScore = null;
    try {
      // Parse score from evaluation, e.g., "5.5/10" -> 5.5
      let parsedScore = NaN;
      if (evaluation?.score) {
        const parts = evaluation.score.split("/");
        if (parts.length > 0) {
          parsedScore = Number(parts[0]);
        }
      }
      finalScore = isNaN(parsedScore) ? null : parsedScore;

      savedRow = await saveBasicEvaluation({
        userId,
        question: questionText,
        answer: candidateAnswer,
        paper,
        marks,
        wordLimit,
        evaluationJson: evaluation,
        score: finalScore,
        weaknessTags: evaluation.weaknessTags || evaluation.weakness_tags || [],
      });
      console.log(`[answer-writing] Basic evaluation saved to DB. ID: ${savedRow?.id}`);

      // Generate mistakes automatically for the Mistake Book
      try {
        const { generateMistakesFromBasicEvaluation } = await import("../services/mainsMistakeService.js");
        await generateMistakesFromBasicEvaluation({
          userId,
          attemptId,
          paper,
          subject,
          topic: req.body.topic || req.body.answerType || "",
          questionText,
          candidateAnswer,
          evaluationJson: evaluation,
          score: finalScore,
          nodeId: syllabusNodeId
        });
        console.log("[answer-writing] Generated mistakes from basic review.");
      } catch (mistakeErr) {
        console.error("[answer-writing] generateMistakesFromBasicEvaluation failed:", mistakeErr);
      }

      // Log study event
      try {
        const { logStudyEvent } = await import("../services/eventService.js");
        await logStudyEvent({
          userId,
          eventType: "BASIC_REVIEW_DONE",
          subject,
          paper,
          topic: questionText,
          syllabusNodeId,
          metadata: {
            evaluation_id: savedRow?.id,
            score: finalScore,
            attempt_id: attemptId
          }
        });
        console.log("[answer-writing] Study event logged successfully.");
      } catch (eventErr) {
        console.error("[answer-writing] logStudyEvent failed:", eventErr.message);
      }
    } catch (dbError) {
      console.error("[answer-writing] DB saving/event logging failed:", dbError);
    }

    return res.json({
      success: true,
      evaluation,
      questionText,
      candidateAnswer,
      savedId: savedRow?.id,
    });
  } catch (error) {
    console.error("[answer-writing] Error in basic-evaluation route:", error);
    return res.status(500).json({
      success: false,
      message: "Evaluation temporarily unavailable. Please try again.",
      error: error.message,
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/answer-writing/air1-chatgpt-prompt
// ────────────────────────────────────────────────────────────────────────────
router.post("/air1-chatgpt-prompt", uploadMiddleware, async (req, res) => {
  try {
    let ocrQuestion = "";
    let ocrAnswer = "";
    const files = req.files || [];

    if (files.length > 0) {
      console.log(`[answer-writing] Processing ${files.length} files for OCR for AIR-1 prompt...`);
      const images = getImagesFromFiles(files);
      try {
        const ocrResult = await extractQuestionAnswerFromImages(images);
        ocrQuestion = ocrResult?.questionText || "";
        ocrAnswer = ocrResult?.answerText || "";
      } catch (err) {
        console.error("[answer-writing] extractQuestionAnswerFromImages failed, falling back to extractHandwrittenAnswer:", err);
        try {
          ocrAnswer = await extractHandwrittenAnswer(images);
        } catch (fallbackErr) {
          console.error("[answer-writing] extractHandwrittenAnswer fallback failed:", fallbackErr);
        }
      }
    }

    const questionText = req.body.questionText || ocrQuestion;
    const candidateAnswer = req.body.candidateAnswer || ocrAnswer;
    const paper = req.body.paper || "General Studies";
    const subject = req.body.subject || "";
    const topic = req.body.topic || "";
    const syllabusNodeId = req.body.syllabusNodeId || "";
    const marks = req.body.marks || "10";
    const wordLimit = req.body.wordLimit || "150";

    if (!questionText) {
      return res.status(400).json({
        success: false,
        error: "Question text is required to construct the AIR-1 prompt.",
      });
    }

    if (!candidateAnswer) {
      return res.status(400).json({
        success: false,
        error: "Candidate answer is required to construct the AIR-1 prompt.",
      });
    }

    let basicReview = req.body.basicReview || "";
    if (typeof basicReview === "object") {
      basicReview = JSON.stringify(basicReview, null, 2);
    }

    const promptPayload = {
      paper,
      subject,
      topic,
      syllabusNode: syllabusNodeId,
      question: questionText,
      marks,
      wordLimit,
      candidateAnswer,
      extraction: files.length > 0 ? ocrAnswer : undefined,
      basicReview,
      attemptHistory: req.body.attemptHistory || "",
      mentorOsPyqMatches: req.body.mentorOsPyqMatches || "",
      currentAffairsNotes: req.body.currentAffairsNotes || "",
    };

    console.log("[answer-writing] Generating AIR-1 standard review prompt...");
    const prompt = buildAir1Prompt(promptPayload);

    return res.json({
      success: true,
      prompt,
      questionText,
      candidateAnswer,
    });
  } catch (error) {
    console.error("[answer-writing] Error in air1-chatgpt-prompt route:", error);
    return res.status(500).json({
      success: false,
      message: "Prompt generation temporarily unavailable. Please try again.",
      error: error.message,
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/answer-writing/save-report
// ────────────────────────────────────────────────────────────────────────────
router.post("/save-report", async (req, res) => {
  try {
    const { userId, questionText, candidateAnswer, paper, marks, wordLimit, evaluationJson, score, weaknessTags } = req.body || {};

    if (!questionText) {
      return res.status(400).json({
        success: false,
        error: "Question text is required to save the report."
      });
    }

    if (!candidateAnswer) {
      return res.status(400).json({
        success: false,
        error: "Candidate answer is required to save the report."
      });
    }

    console.log(`[answer-writing] Saving external report. Paper: ${paper}, Marks: ${marks}, Score: ${score}`);
    const savedRow = await saveBasicEvaluation({
      userId: userId || "user_1",
      question: questionText,
      answer: candidateAnswer,
      paper: paper || "General Studies",
      marks: marks || 10,
      wordLimit: wordLimit || 150,
      evaluationJson,
      score,
      weaknessTags: weaknessTags || [],
    });

    return res.json({
      success: true,
      savedId: savedRow?.id,
    });
  } catch (error) {
    console.error("[answer-writing] Error in save-report route:", error);
    return res.status(500).json({
      success: false,
      message: "Could not save review report. Please try again.",
      error: error.message,
    });
  }
});

export default router;
