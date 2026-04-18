import express from "express";
import {
    getRevisionQueue,
    markRevisionReviewed,
    snoozeRevision,
    patchRevisionItem,
} from "../services/revisionService.js";
import { upsertRevisionItem } from "../repositories/revisionRepository.js";
import { query } from "../db/index.js";

const router = express.Router();

// LIST
router.get("/", async (req, res) => {
    try {
        const { userId, stage, status, dueOnly } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "userId is required",
            });
        }

        const items = await getRevisionQueue(userId, {
            stage: stage || null,
            status: status || null,
            dueOnly: dueOnly === "true",
        });

        res.json(items);
    } catch (err) {
        console.error("[REVISION LIST ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE — called when user clicks "Revise Later" on a PYQ card
router.post("/", async (req, res) => {
    try {
        const {
            userId, questionId, questionText, stage,
            subject, nodeId, year, paper, priority,
        } = req.body || {};

        if (!userId || !questionId) {
            return res.status(400).json({ success: false, error: "userId and questionId are required" });
        }

        const title = questionText
            ? (questionText.length > 120 ? questionText.slice(0, 120) + "…" : questionText)
            : questionId;

        const item = await upsertRevisionItem({
            user_id: userId,
            source_type: "pyq_manual",
            source_ref: `pyq_${year || "na"}_${paper || stage || "prelims"}`,
            question_id: questionId,
            stage: stage || paper || "prelims",
            subject: subject || nodeId || null,
            node_id: nodeId || null,
            title,
            content: questionText || null,
            question_text: questionText || null,
            priority: priority || "medium",
            status: "pending",
        });

        res.json({ success: true, item });
    } catch (err) {
        console.error("[REVISION CREATE ERROR]", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE by questionId — called when user un-toggles "Revise Later"
router.delete("/by-question/:questionId", async (req, res) => {
    try {
        const { questionId } = req.params;
        const { userId } = req.query;

        if (!userId || !questionId) {
            return res.status(400).json({ success: false, error: "userId and questionId are required" });
        }

        const result = await query(
            `DELETE FROM revision_items WHERE user_id = $1 AND question_id = $2 RETURNING id`,
            [userId, questionId]
        );

        res.json({ success: true, deleted: result.rows.length > 0 });
    } catch (err) {
        console.error("[REVISION DELETE ERROR]", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH generic
router.patch("/:id", async (req, res) => {
    try {
        const updated = await patchRevisionItem(req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Revision item not found",
            });
        }

        res.json({ success: true, item: updated });
    } catch (err) {
        console.error("[REVISION PATCH ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// MARK REVIEWED
router.post("/:id/review", async (req, res) => {
    try {
        const updated = await markRevisionReviewed(req.params.id);

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Revision item not found",
            });
        }

        res.json({ success: true, item: updated });
    } catch (err) {
        console.error("[REVISION REVIEW ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SNOOZE
router.post("/:id/snooze", async (req, res) => {
    try {
        const { days } = req.body || {};
        const updated = await snoozeRevision(req.params.id, days || 1);

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Revision item not found",
            });
        }

        res.json({ success: true, item: updated });
    } catch (err) {
        console.error("[REVISION SNOOZE ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
