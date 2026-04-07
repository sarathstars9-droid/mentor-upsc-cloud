import express from "express";
import {
    getRevisionQueue,
    markRevisionReviewed,
    snoozeRevision,
    patchRevisionItem,
} from "../services/revisionService.js";

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
