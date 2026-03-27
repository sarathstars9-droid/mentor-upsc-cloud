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

        if (!result.success) {
            return res.status(404).json(result);
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