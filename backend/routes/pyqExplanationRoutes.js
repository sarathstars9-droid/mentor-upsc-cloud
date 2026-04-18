import express from "express";
import { query } from "../db/index.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pyq/explanations
// Upsert explanation for a user + question.
// Body: { userId, questionId, explanationText, source? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/explanations", async (req, res) => {
  try {
    const { userId, questionId, explanationText, source } = req.body || {};

    if (!userId || !questionId || !explanationText) {
      return res.status(400).json({
        success: false,
        error: "userId, questionId, and explanationText are required",
      });
    }

    const sql = `
      INSERT INTO pyq_explanations (user_id, question_id, explanation_text, source)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, question_id)
      DO UPDATE SET
        explanation_text = EXCLUDED.explanation_text,
        source           = EXCLUDED.source,
        updated_at       = NOW()
      RETURNING *;
    `;

    const result = await query(sql, [
      userId,
      questionId,
      explanationText,
      source || "chatgpt",
    ]);

    res.json({ success: true, explanation: result.rows[0] });
  } catch (err) {
    console.error("[PYQ EXPLANATION SAVE ERROR]", err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pyq/explanations/bulk
// Bulk-fetch saved explanations for a list of question IDs.
// Query: ?userId=user_1&questionIds=id1,id2,id3
// Response: { success: true, explanations: { [questionId]: { explanation_text, source, updated_at } } }
// ─────────────────────────────────────────────────────────────────────────────
router.get("/explanations/bulk", async (req, res) => {
  try {
    const { userId, questionIds } = req.query;

    if (!userId || !questionIds) {
      return res.json({ success: true, explanations: {} });
    }

    const ids = String(questionIds)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res.json({ success: true, explanations: {} });
    }

    const sql = `
      SELECT question_id, explanation_text, source, updated_at
      FROM pyq_explanations
      WHERE user_id = $1 AND question_id = ANY($2)
    `;

    const result = await query(sql, [userId, ids]);

    const explanations = {};
    result.rows.forEach((row) => {
      explanations[row.question_id] = {
        explanation_text: row.explanation_text,
        source: row.source,
        updated_at: row.updated_at,
      };
    });

    res.json({ success: true, explanations });
  } catch (err) {
    console.error("[PYQ EXPLANATION BULK ERROR]", err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pyq/explanations/:questionId
// Fetch a single saved explanation.
// Query: ?userId=user_1
// ─────────────────────────────────────────────────────────────────────────────
router.get("/explanations/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.query;

    if (!userId || !questionId) {
      return res.status(400).json({
        success: false,
        error: "userId (query) and questionId (param) are required",
      });
    }

    const sql = `
      SELECT * FROM pyq_explanations
      WHERE user_id = $1 AND question_id = $2
      LIMIT 1
    `;

    const result = await query(sql, [userId, questionId]);
    const explanation = result.rows[0] || null;

    res.json({ success: true, explanation, found: !!explanation });
  } catch (err) {
    console.error("[PYQ EXPLANATION FETCH ERROR]", err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/pyq/explanations/:questionId
// Query: ?userId=user_1
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/explanations/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.query;

    if (!userId || !questionId) {
      return res.status(400).json({
        success: false,
        error: "userId (query) and questionId (param) are required",
      });
    }

    const sql = `
      DELETE FROM pyq_explanations
      WHERE user_id = $1 AND question_id = $2
      RETURNING id
    `;

    const result = await query(sql, [userId, questionId]);
    const deleted = result.rows.length > 0;

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.json({ success: true, deleted });
  } catch (err) {
    console.error("[PYQ EXPLANATION DELETE ERROR]", err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
