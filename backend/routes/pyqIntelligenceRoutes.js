import express from "express";
import {
    recordPyqAttempts,
    getWeakNodes,
} from "../services/pyqIntelligenceService.js";

const router = express.Router();

router.post("/attempts/bulk", async (req, res) => {
    try {
        const { userId = "user_1", testId, attempts = [] } = req.body || {};

        const saved = await recordPyqAttempts({ userId, testId, attempts });

        res.json({
            success: true,
            saved: saved.length,
        });
    } catch (error) {
        console.error("pyq intelligence bulk error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to record attempts",
        });
    }
});

router.get("/weak-nodes", async (req, res) => {
    try {
        const userId = req.query.userId || "user_1";
        const nodes = await getWeakNodes(userId);

        res.json({
            success: true,
            count: nodes.length,
            nodes,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch weak nodes",
        });
    }
});

export default router;