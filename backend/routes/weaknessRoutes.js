import express from "express";
import {
  computeWeaknessForUser,
  getTopWeakNodesForUser,
  getWeaknessMapForUser,
} from "../services/weaknessScoringService.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/weakness/top?userId=...&limit=10
//
// Returns top N weakest nodes for a user, sorted by weakness_score DESC.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/top", async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const nodes = await getTopWeakNodesForUser(userId, parsedLimit);

    res.json({ success: true, nodes });
  } catch (err) {
    console.error("[WEAKNESS TOP ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/weakness/map?userId=...
//
// Returns the full weakness map (all nodes) for a user.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/map", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const map = await getWeaknessMapForUser(userId);
    res.json({ success: true, map });
  } catch (err) {
    console.error("[WEAKNESS MAP ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/weakness/recompute
//
// Body: { userId }
//
// Triggers a full recompute of weakness scores for the given user.
// Returns the scored node list.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/recompute", async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const nodes = await computeWeaknessForUser(userId);

    res.json({
      success: true,
      recomputed: nodes.length,
      nodes,
    });
  } catch (err) {
    console.error("[WEAKNESS RECOMPUTE ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
