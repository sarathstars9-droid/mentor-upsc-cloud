import express from "express";
import { geminiModel } from "../services/ai/geminiClient.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await geminiModel.generateContent(
            "Say hello from MentorOS"
        );

        const response = result.response.text();

        res.json({
            success: true,
            response
        });

    } catch (error) {
        console.error("[test-gemini] failed:", error);
        res.status(500).json({
            success: false,
            message: "AI extraction temporarily unavailable. Please retry.",
            error: "AI extraction temporarily unavailable. Please retry."
        });
    }
});

export default router;