import express from "express";
import { getPrelimsTopicCounts } from "../services/prelimsTopicCountService.js";

const router = express.Router();

router.post("/topic-counts", (req, res) => {
    try {
        const { subjectId, topics } = req.body || {};

        if (!subjectId) {
            return res.status(400).json({
                success: false,
                error: "subjectId is required",
            });
        }

        const result = getPrelimsTopicCounts({
            subjectId,
            topics: Array.isArray(topics) ? topics : [],
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("prelims topic counts error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to compute topic counts",
        });
    }
});

export default router;