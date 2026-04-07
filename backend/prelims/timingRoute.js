// backend/prelims/timingRoute.js
// EXTENSION LAYER — timing endpoints, separate from locked core practice routes.
//
// POST /api/prelims/practice/timing
//   Body: { attemptId, userId, topicNodeId, totalTimeSpent, averageTimePerQuestion, questionTimeMap }
//   Returns: { ok: true, timing: TimingRecord }
//
// GET  /api/prelims/practice/timing/:attemptId
//   Returns: { ok: true, timing: TimingRecord | null }

import { saveTiming, getTiming } from "./timingStore.js";

export async function saveTimingHandler(req, res) {
    try {
        const body = req.body || {};
        const attemptId = String(body.attemptId || "").trim();
        if (!attemptId) return res.status(400).json({ ok: false, error: "attemptId is required" });

        const timing = saveTiming({
            attemptId,
            userId:                 String(body.userId      || "").trim(),
            topicNodeId:            String(body.topicNodeId || "").trim(),
            totalTimeSpent:         Number(body.totalTimeSpent)         || 0,
            averageTimePerQuestion: Number(body.averageTimePerQuestion) || 0,
            questionTimeMap:        body.questionTimeMap || {},
        });

        return res.json({ ok: true, timing });
    } catch (error) {
        console.error("[timingRoute] save error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

export async function getTimingHandler(req, res) {
    try {
        const attemptId = String(req.params?.attemptId || "").trim();
        if (!attemptId) return res.status(400).json({ ok: false, error: "attemptId is required" });
        const timing = getTiming(attemptId);
        return res.json({ ok: true, timing: timing || null });
    } catch (error) {
        console.error("[timingRoute] get error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
