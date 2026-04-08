import express from "express";
import { logMistake, getMistakes, patchMistake } from "../services/mistakeService.js";

const router = express.Router();

// ── Error serializer ──────────────────────────────────────────────────────────
// pg errors often have empty .message but set .code / .detail / .hint.
// Serialise everything so production logs and API responses are useful.
function serializeError(err) {
  if (!err) return "Unknown error (null)";
  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.code)    parts.push(`[pg_code: ${err.code}]`);
  if (err.detail)  parts.push(`[detail: ${err.detail}]`);
  if (err.hint)    parts.push(`[hint: ${err.hint}]`);
  if (err.where)   parts.push(`[where: ${err.where}]`);
  if (err.schema)  parts.push(`[schema: ${err.schema}]`);
  if (err.table)   parts.push(`[table: ${err.table}]`);
  if (err.column)  parts.push(`[column: ${err.column}]`);
  return parts.length > 0 ? parts.join(" ") : `[non-Error thrown] ${String(err)}`;
}

// ── CREATE / UPSERT ───────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const result = await logMistake(req.body);
    res.json({ success: true, item: result });
  } catch (err) {
    const msg = serializeError(err);
    console.error("[MISTAKE CREATE ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ── LIST ──────────────────────────────────────────────────────────────────────
// Returns raw array — frontend pages expect an array.
router.get("/", async (req, res) => {
  try {
    const { userId, stage } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query param is required",
      });
    }

    console.log("[MISTAKE LIST] userId=%s stage=%s", userId, stage || "(any)");

    const items = await getMistakes(userId, stage || null);

    console.log("[MISTAKE LIST] returning %d items for userId=%s", items.length, userId);
    res.json(items);
  } catch (err) {
    const msg = serializeError(err);
    console.error("[MISTAKE LIST ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ── PATCH ─────────────────────────────────────────────────────────────────────
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
    const msg = serializeError(err);
    console.error("[MISTAKE PATCH ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

// ── BULK SYNC ─────────────────────────────────────────────────────────────────
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
    const msg = serializeError(err);
    console.error("[BULK SYNC ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
