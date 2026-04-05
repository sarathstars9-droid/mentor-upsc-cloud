// backend/prelims/practiceSubmit.js
// POST /api/prelims/practice/submit
// Evaluates answers, creates AttemptHistory, updates TopicProgress.

import { createAttempt, updateProgress } from "./topicProgressStore.js";

/**
 * Normalize an answer option to uppercase A/B/C/D or "".
 */
function normalizeAnswer(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(raw)) return raw;
    if (["1", "2", "3", "4"].includes(raw)) {
        return ["A", "B", "C", "D"][Number(raw) - 1];
    }
    return "";
}

/**
 * Evaluate a set of answers against question correct answers.
 *
 * @param {object[]} questions - Array of question objects with .id and .answer
 * @param {object} answersMap  - Map of questionId → userAnswer
 * @returns {{ wrongIds: string[], unattemptedIds: string[], correctIds: string[] }}
 */
function evaluateAnswers(questions, answersMap) {
    const wrongIds = [];
    const unattemptedIds = [];
    const correctIds = [];

    for (const q of questions) {
        const qid = q?.id || q?.questionId;
        if (!qid) continue;

        const userAnswer = normalizeAnswer(answersMap?.[qid] || "");
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

/**
 * POST /api/prelims/practice/submit handler
 *
 * Request body:
 * {
 *   userId: string,
 *   topicNodeId: string,
 *   stage?: string,               // default "prelims"
 *   mode?: string,                // "continue" | "restart" | "retry_mistakes"
 *   questionIds: string[],        // ordered list of question IDs served
 *   questions: object[],          // full question objects (need .answer for evaluation)
 *   answers: { [qid]: string }    // user's answers
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   attemptId: string,
 *   summary: { total, correct, wrong, unattempted },
 *   wrongQuestionIds: string[],
 *   unattemptedQuestionIds: string[],
 *   updatedProgress: TopicProgress
 * }
 */
export default async function practiceSubmitHandler(req, res) {
    try {
        const body = req.body || {};

        const userId = String(body.userId || "").trim();
        const topicNodeId = String(body.topicNodeId || "").trim();
        const stage = String(body.stage || "prelims").trim();
        const mode = String(body.mode || "continue").trim();
        const answersMap = body.answers || {};

        if (!userId) {
            return res.status(400).json({ ok: false, error: "userId is required" });
        }
        if (!topicNodeId) {
            return res.status(400).json({ ok: false, error: "topicNodeId is required" });
        }

        // Use questions array if provided (needed to evaluate answers)
        const questions = Array.isArray(body.questions) ? body.questions : [];
        // Also support questionIds only (legacy compat)
        const questionIds = Array.isArray(body.questionIds)
            ? body.questionIds
            : questions.map((q) => q?.id || q?.questionId).filter(Boolean);

        if (!questionIds.length) {
            return res.status(400).json({ ok: false, error: "questionIds or questions array is required" });
        }

        // ── Step 1: Evaluate answers ─────────────────────────────────────────
        const { wrongIds, unattemptedIds, correctIds } = evaluateAnswers(questions, answersMap);

        // ── Step 2: Create AttemptHistory record ─────────────────────────────
        const attempt = createAttempt({
            userId,
            stage,
            topicNodeId,
            mode,
            questionIds,
            answers: answersMap,
            wrongQuestionIds: wrongIds,
            unattemptedQuestionIds: unattemptedIds,
        });

        // ── Step 3: Update TopicProgress ──────────────────────────────────────
        const updatedProgress = updateProgress({
            userId,
            stage,
            topicNodeId,
            newQuestionIds: questionIds,
            newWrongIds: wrongIds,
            newUnattemptedIds: unattemptedIds,
            attemptId: attempt.attemptId,
        });

        // ── Step 4: Return result ─────────────────────────────────────────────
        return res.json({
            ok: true,
            attemptId: attempt.attemptId,
            summary: {
                total: questionIds.length,
                correct: correctIds.length,
                wrong: wrongIds.length,
                unattempted: unattemptedIds.length,
            },
            wrongQuestionIds: wrongIds,
            unattemptedQuestionIds: unattemptedIds,
            updatedProgress,
        });
    } catch (error) {
        console.error("[practiceSubmit] Error:", error);
        return res.status(500).json({
            ok: false,
            error: error.message || "Failed to submit attempt",
        });
    }
}
