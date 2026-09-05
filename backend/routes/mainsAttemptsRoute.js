// backend/routes/mainsAttemptsRoute.js
// Persistent mains attempt save + fetch endpoints (PostgreSQL-backed).
//
// POST /api/mains/attempts/save
//   Body: { attemptId, userId, questionText, paper, subject, topic, marks, wordLimit,
//           finalAnswerText, extractedText, answerSource, uploadedPagesMeta,
//           basicReviewJson, air1RawReview, air1ParsedJson,
//           currentScore, targetScore, status }
//   Behavior: UPSERT by attemptId. Returns { ok, attemptId }.
//
// GET  /api/mains/attempts/:attemptId
//   Returns the full saved attempt row.
//
// GET  /api/mains/attempts/latest?userId=user_1
//   Returns the latest attempt for a user.

import { Router } from "express";
import { randomUUID } from "crypto";
import { aggregateCosts } from "../services/geminiCostTracker.js";
import {
  upsertMainsAttempt,
  getMainsAttemptById,
  getLatestMainsAttempt,
  getLatestMainsAttemptForQuestion,
  getMainsAttempts,
} from "../repositories/mainsAttemptRepository.js";
import { generateLearningLoop } from "../services/learningLoopService.js";
import { findVerifiedEvidenceForContext, deriveEvidenceGap } from "../services/mainsEvidenceOrchestrator.js";

const router = Router();

function extractQuestionText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(extractQuestionText).filter(Boolean).join(" ").trim();
  if (typeof value === "object") {
    return extractQuestionText(
      value.question ||
      value.questionText ||
      value.question_text ||
      value.text ||
      value.title ||
      ""
    );
  }
  return String(value).trim();
}

function normalizeQuestionText(value) {
  return extractQuestionText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hashQuestionKey(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildQuestionKey({ paper, year, questionText }) {
  const normalizedQuestion = normalizeQuestionText(questionText);
  const normalizedPaper = String(paper || "GS1").trim().toLowerCase();
  const normalizedYear = String(year || "").trim().toLowerCase();
  const slug = normalizedQuestion.slice(0, 80).replace(/\s+/g, "-") || "unknown-question";
  return [normalizedPaper, normalizedYear || "unknown-year", hashQuestionKey(normalizedQuestion), slug].join(":");
}

// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempts/save
// ────────────────────────────────────────────────────────────────────────────

/**
 * Phase 4 guard: validate question identity before any DB write.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateQuestionIdentity(questionKey, questionText) {
  if (!questionKey || typeof questionKey !== "string" || !questionKey.trim()) {
    return { valid: false, reason: "question_key is missing" };
  }
  if (questionKey.includes("[object")) {
    return { valid: false, reason: `question_key contains '[object': ${questionKey.slice(0, 80)}` };
  }
  if (!questionText || typeof questionText !== "string" || !questionText.trim()) {
    return { valid: false, reason: "question_text is missing" };
  }
  if (questionText.includes("[object Object]")) {
    return { valid: false, reason: "question_text contains '[object Object]'" };
  }
  return { valid: true };
}

const WORKSPACE_PAPER_MAP = {
  essay: "GS Paper I Essay",
  ethics: "GS Paper IV",
  geography_optional: "Optional Geography"
};

router.post("/save", async (req, res) => {
  const body = req.body || {};
  const { userId, status } = body;

  // Generate a new attemptId if one was not provided by the client
  const attemptId = body.attemptId || `mains_${randomUUID()}`;

  console.log("[mains-attempt] save request", { userId, attemptId, status });

  try {
    const questionText = extractQuestionText(body.questionText || body.question_text || body.question || "");
    const questionKey = body.questionKey || body.question_key || buildQuestionKey({
      paper: body.paper || WORKSPACE_PAPER_MAP[body.workspace] || body.workspace || "",
      year: body.year || body.sourceYear || "",
      questionText,
    });

    // ── Phase 4 guard: block corrupt saves before touching the DB ──────────
    const identityCheck = validateQuestionIdentity(questionKey, questionText);
    if (!identityCheck.valid) {
      console.warn("[mains-attempt] SAVE BLOCKED — invalid question identity", {
        reason: identityCheck.reason, userId, attemptId,
        questionKey: String(questionKey).slice(0, 120),
        questionText: String(questionText).slice(0, 120),
      });
      return res.status(400).json({
        ok: false,
        error: "Invalid question identity. Save blocked.",
        detail: identityCheck.reason,
      });
    }

    let basicReviewJson = body.basicReview || body.basicReviewJson || null;
    let air1ParsedJson = body.air1ParsedJson || body.air1ParsedReview || null;

    // Aggregate telemetry from air1ParsedJson (Question Intelligence) into basicReviewJson
    if (basicReviewJson && air1ParsedJson?.ai_usage) {
      if (!basicReviewJson.evaluation_meta) basicReviewJson.evaluation_meta = {};
      if (!basicReviewJson.evaluation_meta.ai_usage) basicReviewJson.evaluation_meta.ai_usage = { calls: [] };
      if (!basicReviewJson.evaluation_meta.ai_usage.calls) basicReviewJson.evaluation_meta.ai_usage.calls = [];
      
      const qIntellUsage = air1ParsedJson.ai_usage;
      const existingCalls = basicReviewJson.evaluation_meta.ai_usage.calls;
      
      // Avoid duplicating if saved multiple times
      if (!existingCalls.find(c => c.operation === "MAINS_QUESTION_INTELLIGENCE" && c.timestamp === qIntellUsage.timestamp)) {
        existingCalls.push(qIntellUsage);
        basicReviewJson.evaluation_meta.ai_usage.normal_evaluation = aggregateCosts(existingCalls);
      }
    }

    const saved = await upsertMainsAttempt({
      attemptId,
      userId:             body.userId        || "user_1",
      questionKey,
      question_key:       questionKey,
      questionText,
      paper:              body.paper         || WORKSPACE_PAPER_MAP[body.workspace] || body.workspace || "",
      subject:            body.subject       || "",
      topic:              body.topic         || body.answerType || "",
      marks:              body.marks,
      wordLimit:          body.wordLimit,
      finalAnswerText:    body.finalAnswerText || body.answerText || "",
      extractedText:      body.extractedText  || "",
      answerSource:       body.answerSource   || "typed",
      uploadedPagesMeta:  body.uploadedPagesMeta || [],
      basicReviewJson,
      air1RawReview:      body.air1RawReview  || "",
      air1ParsedJson,
      currentScore:       body.currentScore   || "",
      targetScore:        body.targetScore    || "",
      status:             status              || "draft",
    });

    console.log("[mains-attempt] saved", { attemptId: saved.attempt_id, questionKey });

    const targetNode = body.syllabusNodeId || body.syllabus_node_id || null;

    // Log study events
    if (status === "finalized") {
      try {
        const { logStudyEvent } = await import("../services/eventService.js");
        await logStudyEvent({
          userId: saved.user_id || body.userId || "user_1",
          eventType: "MAINS_ANSWER_SUBMITTED",
          subject: body.subject || null,
          paper: body.paper || null,
          topic: questionText || null,
          syllabusNodeId: targetNode,
          metadata: {
            attempt_id: saved.attempt_id
          }
        });
      } catch (e) {
        console.error("[mainsAttemptsRoute] failed logging MAINS_ANSWER_SUBMITTED:", e.message);
      }
    }

    if (body.air1RawReview) {
      try {
        const { logStudyEvent } = await import("../services/eventService.js");
        await logStudyEvent({
          userId: saved.user_id || body.userId || "user_1",
          eventType: "AIR1_REVIEW_SAVED",
          subject: body.subject || null,
          paper: body.paper || null,
          topic: questionText || null,
          syllabusNodeId: targetNode,
          metadata: {
            attempt_id: saved.attempt_id,
            score: body.air1ParsedJson?.score || body.air1ParsedJson?.estimatedScore || null
          }
        });
      } catch (e) {
        console.error("[mainsAttemptsRoute] failed logging AIR1_REVIEW_SAVED:", e.message);
      }
    }

    if (body.basicReview || body.basicReviewJson) {
      const basicScore = body.basicReview?.score || body.basicReviewJson?.score || null;
      try {
        const { logStudyEvent } = await import("../services/eventService.js");
        await logStudyEvent({
          userId: saved.user_id || body.userId || "user_1",
          eventType: "BASIC_REVIEW_DONE",
          subject: body.subject || null,
          paper: body.paper || null,
          topic: questionText || null,
          syllabusNodeId: targetNode,
          metadata: {
            attempt_id: saved.attempt_id,
            score: basicScore
          }
        });
      } catch (e) {
        console.error("[mainsAttemptsRoute] failed logging BASIC_REVIEW_DONE:", e.message);
      }
    }
    
    let loopStatus = "skipped";
    if (status === "finalized") {
      try {
        await generateLearningLoop(saved);
        loopStatus = "generated";
      } catch (err) {
        console.error("[mains-attempt] learning loop generation failed:", err.message);
        loopStatus = "failed";
      }
    }

    return res.json({ ok: true, attemptId: saved.attempt_id, loopStatus });
  } catch (err) {
    console.error("[mains-attempt] save error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to save attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts/latest?userId=...
// MUST be declared BEFORE /:attemptId to avoid being caught by the param route
// ────────────────────────────────────────────────────────────────────────────
router.get("/latest", async (req, res) => {
  const userId = req.query.userId || "user_1";
  try {
    const row = await getLatestMainsAttempt(userId);
    if (!row) return res.json({ ok: true, attempt: null });
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] latest fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch latest attempt: " + err.message });
  }
});

// GET /api/mains/attempts/latest-for-question?userId=...&questionKey=...
// Returns the latest saved attempt for the exact displayed question key.
router.get("/latest-for-question", async (req, res) => {
  const userId = req.query.userId || "user_1";
  const questionKey = req.query.questionKey || req.query.question_key || "";

  if (!questionKey) {
    return res.status(400).json({ ok: false, error: "questionKey is required" });
  }

  try {
    const row = await getLatestMainsAttemptForQuestion(userId, questionKey);
    if (!row) return res.json({ ok: true, attempt: null });
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] latest-for-question fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch latest question attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts (or GET /api/mains-answers)
// Returns all attempts for a user.
// ────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userId = req.query.userId || "user_1";
  try {
    const rows = await getMainsAttempts(userId);
    const attempts = rows.map(formatAttemptRow);
    return res.json(attempts);
  } catch (err) {
    console.error("[mains-attempt] fetch all error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch attempts: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/mains/attempts/:attemptId
// ────────────────────────────────────────────────────────────────────────────
router.get("/:attemptId", async (req, res) => {
  const { attemptId } = req.params;
  console.log("[mains-attempt] restoring", attemptId);

  try {
    const row = await getMainsAttemptById(attemptId);
    if (!row) {
      return res.status(404).json({ ok: false, error: `Attempt not found: ${attemptId}` });
    }
    return res.json({ ok: true, attempt: formatAttemptRow(row) });
  } catch (err) {
    console.error("[mains-attempt] fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to fetch attempt: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Helper: normalize DB row → frontend shape
// ────────────────────────────────────────────────────────────────────────────
function formatAttemptRow(row) {
  return {
    attemptId:          row.attempt_id,
    userId:             row.user_id,
    questionKey:        row.question_key,
    question_key:       row.question_key,
    questionText:       row.question_text,
    question:           row.question_text, // frontend alias
    paper:              row.paper,
    subject:            row.subject,
    topic:              row.topic,
    marks:              row.marks,
    wordLimit:          row.word_limit,
    finalAnswerText:    row.final_answer_text,
    answerText:         row.final_answer_text, // frontend alias
    extractedText:      row.extracted_text,
    answerSource:       row.answer_source,
    uploadedPagesMeta:  row.uploaded_pages_meta || [],
    basicReview:        row.basic_review_json || null,
    air1RawReview:      row.air1_raw_review || "",
    air1ParsedJson:     row.air1_parsed_json || null,
    currentScore:       row.current_score,
    targetScore:        row.target_score,
    status:             row.status,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
    finalizedAt:        row.finalized_at,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/mains/attempts/:attemptId/find-verified-evidence
// Moulika User-Flow Endpoint for discovering live evidence.
// ────────────────────────────────────────────────────────────────────────────
router.post("/:attemptId/find-verified-evidence", async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user?.id || "user_1"; // Assume standard auth pattern
  const { evidence_type } = req.body || {};

  try {
    const row = await getMainsAttemptById(attemptId);
    if (!row) {
      return res.status(404).json({ ok: false, error: "Attempt not found" });
    }

    // 1. Cross-User Security Block
    if (row.user_id !== userId) {
      return res.status(403).json({ ok: false, error: "Unauthorized access to this attempt" });
    }

    // 2. Only Evaluated Attempts
    const evaluationJson = row.air1_parsed_json || row.basic_review_json;
    if (!evaluationJson || row.status !== "finalized") {
      return res.status(400).json({ ok: false, error: "EVALUATION_NOT_READY" });
    }

    // 3. Derive Evidence Gap
    const gap = deriveEvidenceGap(evaluationJson);
    if (!gap.has_gap) {
      return res.status(400).json({ ok: false, error: "No evidence gap identified for this answer." });
    }

    // Strict validation of requested evidence type against what's identified
    if (evidence_type && !gap.missing_types.includes(evidence_type)) {
      return res.status(400).json({ ok: false, error: "Requested evidence type does not match evaluation gap." });
    }

    // 4. Server-Derived Context
    const evaluationContext = {
      question_intelligence: {
        paper: row.paper,
        subject: row.subject,
        topic: row.topic,
        syllabus_node_id: evaluationJson.question_intelligence?.syllabus_node_id || ""
      },
      question_text: row.question_text,
      evidence_analysis: evaluationJson.evidence_analysis || {},
      best_value_addition: evaluationJson.best_value_addition || null
    };

    // 5. Call Shared Orchestrator
    const result = await findVerifiedEvidenceForContext({
      userId,
      attemptId,
      evaluationContext,
      evidenceType: evidence_type
    });

    // 6. Append Evidence AI Usage safely (without overwriting normal usage)
    if (evaluationJson.evaluation_meta && evaluationJson.evaluation_meta.ai_usage) {
      if (!evaluationJson.evaluation_meta.ai_usage.evidence) {
        evaluationJson.evaluation_meta.ai_usage.evidence = { search_calls: 0, verifier_calls: 0, estimated_cost_usd: 0 };
      }
      
      const evUsage = evaluationJson.evaluation_meta.ai_usage.evidence;
      // We increment the placeholder calls to show it was run
      evUsage.search_calls += 1;
      // Note: Full per-call token metadata from discovery/verification 
      // can be injected here if the orchestrator returns it in result.ai_usage
      if (result.ai_usage) {
         evUsage.estimated_cost_usd += (result.ai_usage.estimated_cost_usd || 0);
      }
      
      // Save back to DB
      await upsertMainsAttempt({
        attemptId: row.attempt_id,
        userId: row.user_id,
        questionKey: row.question_key,
        questionText: row.question_text,
        paper: row.paper,
        subject: row.subject,
        topic: row.topic,
        marks: row.marks,
        wordLimit: row.word_limit,
        finalAnswerText: row.final_answer_text,
        extractedText: row.extracted_text,
        answerSource: row.answer_source,
        uploadedPagesMeta: row.uploaded_pages_meta,
        basicReviewJson: row.air1_parsed_json ? row.basic_review_json : evaluationJson,
        air1RawReview: row.air1_raw_review,
        air1ParsedJson: row.air1_parsed_json ? evaluationJson : row.air1_parsed_json,
        currentScore: row.current_score,
        targetScore: row.target_score,
        status: row.status,
        finalizedAt: row.finalized_at
      });
    }

    return res.json({ ok: true, ...result });

  } catch (err) {
    console.error("[mains-attempt] find-verified-evidence error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error during discovery" });
  }
});

export default router;
