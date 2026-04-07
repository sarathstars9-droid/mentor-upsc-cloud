// backend/prelims/progressRoute.js
// GET /api/prelims/practice/progress/:topicNodeId?userId=...&stage=...
// Returns cross-device progress stats for a given topic/subject scope.

import { getProgress, computeAverageScore } from "./topicProgressStore.js";
import { loadAllQuestionsForNodeId, computePoolCounts } from "./practiceBuilder.js";

/**
 * GET /api/prelims/practice/progress/:topicNodeId?userId=&stage=
 *
 * Response includes:
 *  - Pool counts (total, unseen, wrongOnly, mistakes, attempted)
 *  - Progress stats (attemptsCount, bestScore, latestScore, averageScore, coveragePercent)
 *  - Booleans: canContinue, canRetryMistakes, canRetryWrong, canRetryAttempted, canRestart
 */
export default async function progressRouteHandler(req, res) {
    try {
        const topicNodeId = String(req.params?.topicNodeId || "").trim();
        const userId      = String(req.query?.userId       || "").trim();
        const stage       = String(req.query?.stage        || "prelims").trim();

        if (!topicNodeId) return res.status(400).json({ ok: false, error: "topicNodeId is required" });
        if (!userId)      return res.status(400).json({ ok: false, error: "userId query param is required" });

        const progress = getProgress(userId, stage, topicNodeId);

        // Count total questions for this scope
        const allQuestions   = loadAllQuestionsForNodeId(topicNodeId);
        const totalQuestions = allQuestions.length;

        const poolCounts = computePoolCounts(allQuestions, progress);

        const servedCount       = progress.servedQuestionIds?.length     || 0;
        const wrongCount        = progress.wrongQuestionIds?.length       || 0;
        const unattemptedCount  = progress.unattemptedQuestionIds?.length || 0;
        const remainingCount    = Math.max(0, totalQuestions - servedCount);
        const isFullyCompleted  = servedCount >= totalQuestions && totalQuestions > 0;
        const averageScore      = computeAverageScore(progress);

        return res.json({
            ok:           true,
            topicNodeId,
            userId,
            stage,

            // Pool sizes
            totalQuestions,
            servedCount,
            remainingCount,
            wrongCount,
            unattemptedCount,
            poolCounts,      // { total, unseen, wrongOnly, mistakes, attempted, entire }

            // Mode availability flags
            canContinue:       remainingCount > 0,
            canRetryMistakes:  (wrongCount + unattemptedCount) > 0,
            canRetryWrong:     wrongCount > 0,
            canRetryAttempted: servedCount > 0,
            canRestart:        true,   // always allowed
            isFullyCompleted,

            // Scoring stats (new)
            attemptsCount:  progress.attemptsCount  || 0,
            bestScore:      progress.bestScore      ?? null,
            latestScore:    progress.latestScore    ?? null,
            averageScore:   averageScore            ?? null,
            coveragePercent: progress.coveragePercent || 0,

            lastAttemptId: progress.lastAttemptId || null,
            updatedAt:     progress.updatedAt      || null,
        });
    } catch (error) {
        console.error("[progressRoute] Error:", error);
        return res.status(500).json({
            ok:    false,
            error: error.message || "Failed to fetch topic progress",
        });
    }
}
