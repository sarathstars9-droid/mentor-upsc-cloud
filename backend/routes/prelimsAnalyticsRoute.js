import express from "express";

import { getQuestionMeta } from "../core/questionMetaEngine.js";
import { analyzeAttempt } from "../core/attemptAnalysisEngine.js";
import { detectWeakness } from "../core/weaknessEngine.js";
import { saveAnalyticsResult } from "../core/saveAnalyticsResult.js";

const router = express.Router();

function normalizeQuestion(question = {}, index = 0) {
    const id =
        question.id ||
        question.questionId ||
        `Q_${index + 1}`;

    return {
        ...question,
        id: String(id),
        questionId: String(id),
        subject: question.subject || "Unknown",
        nodeId:
            question.nodeId ||
            question.syllabusNodeId ||
            "UNKNOWN_NODE",
        section: question.section || "",
        microtheme: question.microtheme || "",
        questionType: question.questionType || "MCQ",
        question: question.questionText || question.question || "",
        syllabusNodeId:
            question.syllabusNodeId ||
            question.nodeId ||
            "UNKNOWN_NODE",
    };
}

router.post("/analyze-attempt", (req, res) => {
    try {
        const body = req.body || {};
        const questions = Array.isArray(body.questions)
            ? body.questions
            : [];

        if (!questions.length) {
            return res.status(400).json({
                success: false,
                error: "questions required",
            });
        }

        const attempt = {
            testId: body.testId || "test_1",
            userId: body.userId || "user_1",
            answers: questions.map((q, i) => ({
                questionId: normalizeQuestion(q, i).id,
                userAnswer: q.userAnswer || "",
                correctAnswer: q.answer || "",
                status: q.status || "unattempted",
                confidence: q.confidence || "sure",
            })),
        };

        const meta = questions.map((q, i) =>
            getQuestionMeta(normalizeQuestion(q, i))
        );

        const analysis = analyzeAttempt(attempt, meta);
        const weakness = detectWeakness(analysis);

        const final = {
            summary: analysis.summary || {},
            behaviour: analysis.behaviour || {},
            nodeStats: analysis.nodeStats || {},
            subjectStats: analysis.subjectStats || {},
            typeStats: analysis.typeStats || {},
            trapStats: analysis.trapStats || {},
            difficultyStats: analysis.difficultyStats || {},
            weakNodes: weakness.weakNodes || [],
            weakSubjects: weakness.weakSubjects || [],
            weakTypes: weakness.weakTypes || [],
            trapAlerts: weakness.trapAlerts || [],
            recommendations: weakness.recommendations || [],
        };

        saveAnalyticsResult(
            attempt.testId,
            attempt.userId,
            final
        );

        res.json(final);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

export default router;