import express from "express";
import { logMistake, getMistakeById, getMistakes, patchMistake } from "../services/mistakeService.js";
import { getPrelimsMistakeBookIntelligence } from "../services/prelimsMistakeBookIntelligenceService.js";
import {
  getAttemptHistoryForMistake,
  recordMistakeRetest,
  recordPrelimsQuestionAttempts,
} from "../services/prelimsAttemptLedgerService.js";

const router = express.Router();

const REVIEW_STATUS_VALUES = new Set(["new", "reviewed", "retest_due"]);

const CANONICAL_PRELIMS_ERROR_TYPES = new Set([
  "concept_gap",
  "factual_recall",
  "statement_trap",
  "overthinking",
  "elimination_error",
  "question_misread",
  "guessing_error",
  "time_pressure",
  "knowledge_gap",
  "unclassified",
]);

const LEGACY_PRELIMS_ERROR_TYPES = new Map([
  ["conceptual_error", "concept_gap"],
  ["overconfidence_trap", "overthinking"],
  ["guess_error", "guessing_error"],
  ["unattempted", "knowledge_gap"],
]);

const PATCH_FIELDS = new Set([
  "answer_status",
  "error_type",
  "must_revise",
  "revision_flag",
  "status",
  "review_status",
  "reviewed_at",
]);

function normalizeBulkAnswerStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "correct") return "correct";
  if (status === "wrong" || status === "incorrect") return "wrong";
  if (status === "unattempted" || status === "skipped") return "unattempted";
  return "wrong";
}

function normalizePatchReviewStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return REVIEW_STATUS_VALUES.has(status) ? status : null;
}

function normalizePatchErrorType(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (LEGACY_PRELIMS_ERROR_TYPES.has(normalized)) {
    return LEGACY_PRELIMS_ERROR_TYPES.get(normalized);
  }
  if (CANONICAL_PRELIMS_ERROR_TYPES.has(normalized)) {
    return normalized;
  }
  return undefined;
}

function sanitizePatchPayload(body = {}) {
  const unknownFields = Object.keys(body).filter((key) => !PATCH_FIELDS.has(key));
  if (unknownFields.length > 0) {
    return {
      error: `Unsupported mistake PATCH field(s): ${unknownFields.join(", ")}`,
    };
  }

  const changes = {};

  if ("answer_status" in body) changes.answer_status = body.answer_status;
  if ("status" in body) changes.status = body.status;

  if ("must_revise" in body) {
    if (typeof body.must_revise !== "boolean") {
      return { error: "must_revise must be boolean" };
    }
    changes.must_revise = body.must_revise;
  }

  if ("revision_flag" in body) {
    if (typeof body.revision_flag !== "boolean") {
      return { error: "revision_flag must be boolean" };
    }
    changes.revision_flag = body.revision_flag;
  }

  if ("review_status" in body) {
    const reviewStatus = normalizePatchReviewStatus(body.review_status);
    if (!reviewStatus) {
      return { error: "review_status must be one of: new, reviewed, retest_due" };
    }
    changes.review_status = reviewStatus;
  }

  if ("reviewed_at" in body) {
    if (body.reviewed_at == null || body.reviewed_at === "") {
      changes.reviewed_at = null;
    } else {
      const reviewedAt = new Date(body.reviewed_at);
      if (Number.isNaN(reviewedAt.getTime())) {
        return { error: "reviewed_at must be a valid timestamp" };
      }
      changes.reviewed_at = reviewedAt.toISOString();
    }
  }

  if ("error_type" in body) {
    const errorType = normalizePatchErrorType(body.error_type);
    if (errorType === undefined) {
      return { error: "error_type is not a supported mistake taxonomy value" };
    }
    changes.error_type = errorType;
  }

  return { changes };
}

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

// ── PRELIMS ATTEMPT LEDGER ───────────────────────────────────────────────────
router.post("/attempts/bulk", async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: "items must be an array",
      });
    }

    const saved = await recordPrelimsQuestionAttempts(items);

    return res.json({
      success: true,
      count: saved.length,
      items: saved,
    });
  } catch (err) {
    const msg = serializeError(err);
    console.error("[PRELIMS ATTEMPT LEDGER ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/intelligence", async (req, res) => {
  try {
    const result = await getPrelimsMistakeBookIntelligence({
      userId: req.query.userId,
      stage: req.query.stage,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err?.status || 500;
    const msg = serializeError(err);
    console.error("[PRELIMS MISTAKE INTELLIGENCE ERROR]", { msg, stack: err?.stack });
    res.status(status).json({ success: false, error: err?.message || msg });
  }
});

router.get("/:id/attempt-history", async (req, res) => {
  try {
    const result = await getAttemptHistoryForMistake(req.params.id, req.query.userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Mistake not found",
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err?.status || 500;
    const msg = serializeError(err);
    console.error("[MISTAKE ATTEMPT HISTORY ERROR]", { msg, stack: err?.stack });
    res.status(status).json({ success: false, error: err?.message || msg });
  }
});

router.post("/:id/retest", async (req, res) => {
  try {
    const result = await recordMistakeRetest(req.params.id, req.body || {});

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err?.status || 500;
    const msg = serializeError(err);
    console.error("[MISTAKE RETEST ERROR]", { msg, stack: err?.stack });
    res.status(status).json({ success: false, error: err?.message || msg });
  }
});

// ── PATCH ─────────────────────────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const { changes, error } = sanitizePatchPayload(req.body);

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    if ("review_status" in changes || "reviewed_at" in changes) {
      const existing = await getMistakeById(req.params.id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: "Mistake not found",
        });
      }

      if (String(existing.stage || "").toLowerCase() !== "prelims") {
        return res.status(400).json({
          success: false,
          error: "review_status is only supported for prelims mistakes",
        });
      }
    }

    const updated = await patchMistake(req.params.id, changes);

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
    const errors = [];

    for (let index = 0; index < items.length; index += 1) {
      const m = items[index] || {};
      const questionId = m.questionId || m.question_id;

      if (!questionId) {
        const error = {
          index,
          error: "questionId is required",
          sourceType: m.sourceType || m.source_type || null,
          sourceRef: m.testId || m.source_ref || null,
        };
        errors.push(error);
        console.warn("[BULK SYNC SKIP]", error);
        continue;
      }

      const mustRevise =
        typeof m.mustRevise === "boolean"
          ? m.mustRevise
          : typeof m.must_revise === "boolean"
            ? m.must_revise
            : true;

      const result = await logMistake({
        user_id: m.userId || m.user_id || "user_1",
        source_type: m.sourceType || m.source_type || "prelims_pyq",
        source_ref: m.testId || m.source_ref || null,
        question_id: questionId,
        stage: m.stage || "prelims",
        subject: m.subject || null,
        node_id: m.nodeId || m.node_id || null,
        question_text: m.questionText || m.question_text || "",
        selected_answer: m.latestUserAnswer ?? m.selected_answer ?? null,
        correct_answer: m.correctAnswer ?? m.correct_answer ?? null,
        answer_status: normalizeBulkAnswerStatus(m.latestResult || m.answer_status),
        error_type: m.mistakeType || m.errorType || m.error_type || null,
        notes: m.notes || "",
        must_revise: mustRevise,
      });

      results.push(result);
    }

    res.json({
      success: true,
      count: results.length,
      skipped: errors.length,
      items: results,
      errors,
    });
  } catch (err) {
    const msg = serializeError(err);
    console.error("[BULK SYNC ERROR]", { msg, stack: err?.stack });
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
