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

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;