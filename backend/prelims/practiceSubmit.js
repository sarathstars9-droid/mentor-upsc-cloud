// backend/prelims/practiceSubmit.js
// POST /api/prelims/practice/submit
// Evaluates answers, computes UPSC score, creates AttemptHistory, updates TopicProgress.

import { createAttempt, updateProgress } from "./topicProgressStore.js";
import { computeUpscScore } from "./scoringEngine.js";
import { loadAllQuestionsForNodeId } from "./practiceBuilder.js";

// ─── Answer normalization ─────────────────────────────────────────────────────

function normalizeAnswer(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(raw)) return raw;
    // Support 1/2/3/4 numeric answers
    if (["1", "2", "3", "4"].includes(raw)) return ["A", "B", "C", "D"][Number(raw) - 1];
    return "";
}

// ─── Answer evaluation ────────────────────────────────────────────────────────

function evaluateAnswers(questions, answersMap) {
    const wrongIds       = [];
    const unattemptedIds = [];
    const correctIds     = [];

    for (const q of questions) {
        const qid = q?.id || q?.questionId;
        if (!qid) continue;

        const userAnswer    = normalizeAnswer(answersMap?.[qid] || "");
        const correctAnswer = normalizeAnswer(q?.answer || "");

        if (!userAnswer) {
            unattemptedIds.push(qid);
        } else if (userAnswer === correctAnswer) {
            correctIds.push(qid);
        } else {
            wrongIds.push(qid);
        }
    }

    return { wrongIds, unattemptedIds, correctIds };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /api/prelims/practice/submit
 *
 * Request body:
 * {
 *   userId:      string,
 *   topicNodeId: string,
 *   stage?:      string,           default "prelims"
 *   mode?:       string,           default "continue"
 *   paperType?:  "GS" | "CSAT",   default "GS"  — used for UPSC scoring
 *   questionIds: string[],
 *   questions:   object[],         full question objects (need .answer)
 *   answers:     { [qid]: string }
 * }
 *
 * Response:
 * {
 *   ok:            true,
 *   attemptId:     string,
 *   summary: {
 *     total, correct, wrong, unattempted,
 *     positiveMarks, negativeMarks, finalScore, accuracy
 *   },
 *   wrongQuestionIds:      string[],
 *   unattemptedQuestionIds: string[],
 *   correctQuestionIds:    string[],
 *   updatedProgress:       TopicProgress
 * }
 */
export default async function practiceSubmitHandler(req, res) {
    try {
        const body = req.body || {};

        const userId      = String(body.userId      || "").trim();
        const topicNodeId = String(body.topicNodeId || "").trim();
        const stage       = String(body.stage       || "prelims").trim();
        const mode        = String(body.mode        || "continue").trim();
        const paperType   = ["GS", "CSAT"].includes(body.paperType) ? body.paperType : "GS";
        const answersMap  = body.answers || {};

        if (!userId)      return res.status(400).json({ ok: false, error: "userId is required" });
        if (!topicNodeId) return res.status(400).json({ ok: false, error: "topicNodeId is required" });

        const questions  = Array.isArray(body.questions) ? body.questions : [];
        const questionIds = Array.isArray(body.questionIds)
            ? body.questionIds
            : questions.map((q) => q?.id || q?.questionId).filter(Boolean);

        if (!questionIds.length) {
            return res.status(400).json({ ok: false, error: "questionIds or questions array is required" });
        }

        // ── Step 1: Evaluate answers ───────────────────────────────────────────
        const { wrongIds, unattemptedIds, correctIds } = evaluateAnswers(questions, answersMap);

        // ── Step 2: UPSC scoring ───────────────────────────────────────────────
        const total    = questionIds.length;
        const correct  = correctIds.length;
        const wrong    = wrongIds.length;
        const unattempted = unattemptedIds.length;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        const { positiveMarks, negativeMarks, finalScore } = computeUpscScore(correct, wrong, paperType);

        // ── Step 3: Count total pool for coverage calculation ──────────────────
        // Load total count asynchronously without blocking critical path
        let totalQuestionsInPool = 0;
        try {
            const allQs = loadAllQuestionsForNodeId(topicNodeId);
            totalQuestionsInPool = allQs.length;
        } catch {
            // Non-fatal: coverage just won't update
        }

        // ── Step 4: Create AttemptHistory record ───────────────────────────────
        const attempt = createAttempt({
            userId,
            stage,
            topicNodeId,
            mode,
            questionIds,
            answers:              answersMap,
            wrongQuestionIds:     wrongIds,
            unattemptedQuestionIds: unattemptedIds,
            correctCount:    correct,
            wrongCount:      wrong,
            unattemptedCount: unattempted,
            positiveMarks,
            negativeMarks,
            finalScore,
            paperType,
        });

        // ── Step 5: Update TopicProgress ──────────────────────────────────────
        const updatedProgress = updateProgress({
            userId,
            stage,
            topicNodeId,
            newQuestionIds:     questionIds,
            newCorrectIds:      correctIds,
            newWrongIds:        wrongIds,
            newUnattemptedIds:  unattemptedIds,
            attemptId:          attempt.attemptId,
            finalScore,
            positiveMarks,
            negativeMarks,
            totalQuestionsInPool,
        });

        // ── Step 6: Return result ──────────────────────────────────────────────
        return res.json({
            ok:         true,
            attemptId:  attempt.attemptId,
            summary: {
                total,
                correct,
                wrong,
                unattempted,
                accuracy,
                positiveMarks,
                negativeMarks,
                finalScore,
                paperType,
            },
            wrongQuestionIds:       wrongIds,
            unattemptedQuestionIds: unattemptedIds,
            correctQuestionIds:     correctIds,
            updatedProgress,
        });

    } catch (error) {
        console.error("[practiceSubmit] Error:", error);
        return res.status(500).json({
            ok:    false,
            error: error.message || "Failed to submit attempt",
        });
    }
}
