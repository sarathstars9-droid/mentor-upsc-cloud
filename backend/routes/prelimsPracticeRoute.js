// backend/routes/prelimsPracticeRoute.js
// Prelims practice routes:
//   POST /api/prelims/practice/build             — existing builder (no progress tracking)
//   POST /api/prelims/practice/build-progressive — mode-aware builder (continue/restart/retry)
//   POST /api/prelims/practice/submit            — submit + evaluate + update progress
//   GET  /api/prelims/practice/progress/:topicNodeId?userId=... — get topic progress
//   POST /api/prelims/practice/timing            — [EXTENSION] save attempt timing separately
//   GET  /api/prelims/practice/timing/:attemptId — [EXTENSION] fetch attempt timing

import express from "express";
import buildPrelimsPracticeTest from "../api/buildPrelimsPracticeTest.js";
import { buildProgressAwareTest } from "../prelims/practiceBuilder.js";
import practiceSubmitHandler from "../prelims/practiceSubmit.js";
import progressRouteHandler from "../prelims/progressRoute.js";
import { saveTimingHandler, getTimingHandler } from "../prelims/timingRoute.js";

const router = express.Router();

// ── Original builder (preserved intact) ─────────────────────────────────────
router.post("/build", buildPrelimsPracticeTest);

// ── Progress-aware builder ───────────────────────────────────────────────────
// POST /api/prelims/practice/build-progressive
// Body: { userId, topicNodeId, count, mode: "continue"|"restart"|"retry_mistakes", stage? }
router.post("/build-progressive", async (req, res) => {
    try {
        const body = req.body || {};
        const userId = String(body.userId || "").trim();
        const topicNodeId = String(body.topicNodeId || "").trim();
        const count = Math.max(1, Number(body.count || 10));
        const practiceMode = body.mode || "continue";
        const stage = String(body.stage || "prelims").trim();

        if (!userId) {
            return res.status(400).json({ ok: false, error: "userId is required" });
        }
        if (!topicNodeId) {
            return res.status(400).json({ ok: false, error: "topicNodeId is required" });
        }

        const { questions, progress, totalAvailable, mode } = await buildProgressAwareTest({
            userId,
            topicNodeId,
            count,
            practiceMode,
            stage,
        });

        // Determine flags for the frontend
        const servedCount = progress.servedQuestionIds.length;
        const remainingCount = Math.max(0, totalAvailable - servedCount);
        const isFullyCompleted = servedCount >= totalAvailable && totalAvailable > 0;

        if (!questions.length) {
            // If fully completed, guide user with clear message
            let errorMsg = "No questions available for this selection.";
            if (mode === "continue" && isFullyCompleted) {
                errorMsg = "You have completed all questions in this topic. Try Retry Wrong/Skipped or Restart.";
            } else if (mode === "retry_mistakes") {
                errorMsg = "No wrong or skipped questions to retry. Well done!";
            }

            return res.status(404).json({
                ok: false,
                error: errorMsg,
                isFullyCompleted,
                progress: {
                    totalQuestions: totalAvailable,
                    servedCount,
                    remainingCount,
                    wrongCount: progress.wrongQuestionIds.length,
                    unattemptedCount: progress.unattemptedQuestionIds.length,
                },
            });
        }

        return res.json({
            ok: true,
            success: true,
            mode,
            topicNodeId,
            total: questions.length,
            questions,
            progress: {
                totalQuestions: totalAvailable,
                servedCount,
                remainingCount,
                wrongCount: progress.wrongQuestionIds.length,
                unattemptedCount: progress.unattemptedQuestionIds.length,
                canContinue: remainingCount > 0,
                canRetryMistakes: (progress.wrongQuestionIds.length + progress.unattemptedQuestionIds.length) > 0,
                isFullyCompleted,
            },
        });
    } catch (error) {
        console.error("[build-progressive] Error:", error);
        return res.status(500).json({
            ok: false,
            error: error.message || "Failed to build progressive test",
        });
    }
});

// ── Submit attempt ───────────────────────────────────────────────────────────
// POST /api/prelims/practice/submit
router.post("/submit", practiceSubmitHandler);

// ── Topic progress ───────────────────────────────────────────────────────────
// GET /api/prelims/practice/progress/:topicNodeId?userId=...
router.get("/progress/:topicNodeId", progressRouteHandler);

// ── Timing extension (separate from locked core) ─────────────────────────────
// POST /api/prelims/practice/timing
router.post("/timing", saveTimingHandler);
// GET  /api/prelims/practice/timing/:attemptId
router.get("/timing/:attemptId", getTimingHandler);

export default router;