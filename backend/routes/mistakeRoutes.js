import express from "express";
import { logMistake, getMistakes, patchMistake } from "../services/mistakeService.js";

const router = express.Router();

// CREATE / UPSERT
router.post("/", async (req, res) => {
    try {
        const result = await logMistake(req.body);
        res.json({ success: true, item: result });
    } catch (err) {
        console.error("[MISTAKE CREATE ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// LIST
// Important: returns raw array because frontend pages currently expect an array.
router.get("/", async (req, res) => {
    try {
        const { userId, stage } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "userId is required",
            });
        }

        const items = await getMistakes(userId, stage || null);
        res.json(items);
    } catch (err) {
        console.error("[MISTAKE LIST ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH
router.patch("/:id", async (req, res) => {
    try {
        const updated = await patchMistake(req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Mistake not found",
            });
        }

        res.json({ success: true, item: updated });
    } catch (err) {
        console.error("[MISTAKE PATCH ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// BULK SYNC
router.post("/bulk-sync", async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: "items must be an array",
            });
        }

        const results = [];

        for (const m of items) {
            const normalizedStatus =
                m.latestResult === "wrong" ||
                    m.latestResult === "correct" ||
                    m.latestResult === "unattempted"
                    ? m.latestResult
                    : "wrong";

            const result = await logMistake({
                user_id: "user_1",
                source_type: m.sourceType || "prelims_pyq",
                source_ref: m.testId || null,
                question_id: m.questionId || null,
                stage: m.stage || "prelims",
                subject: m.subject || null,
                node_id: m.nodeId || null,
                question_text: m.questionText || "",
                selected_answer: m.latestUserAnswer || null,
                correct_answer: m.correctAnswer || null,
                answer_status: normalizedStatus,
                error_type: m.mistakeType || m.errorType || null,
                notes: m.notes || "",
                must_revise:
                    typeof m.mustRevise === "boolean" ? m.mustRevise : true,
            });

            results.push(result);
        }

        res.json({ success: true, count: results.length, items: results });
    } catch (err) {
        console.error("[BULK SYNC ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
