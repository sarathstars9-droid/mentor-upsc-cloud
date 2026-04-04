import express from "express";
import { getPrelimsDashboard } from "../api/prelimsDashboard.js";

const router = express.Router();

router.get("/dashboard", (req, res) => {
    try {
        const { testId, userId } = req.query;

        if (!testId || !userId) {
            return res.status(400).json({
                success: false,
                error: "Missing testId or userId",
            });
        }

        const result = getPrelimsDashboard(testId, userId);
        if (!result || result.success === false) {
            console.warn("[DASHBOARD EMPTY]", { testId, userId });

            return res.json({
                success: true,
                summary: {
                    total: 0,
                    attempted: 0,
                    correct: 0,
                    accuracy: 0,
                },
                weakNodes: [],
                weakSubjects: [],
                trapAlerts: [],
                recommendations: [],
            });
        }
        return res.json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;