// backend/mainsReview/mainsReviewUtils.js
// Shared constants, ID generators, and schema builders for the mains review pipeline

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Data paths ───────────────────────────────────────────────────────────────
export const REVIEWS_ROOT = path.join(__dirname, "../data/mains_reviews");
export const ATTEMPTS_DIR  = path.join(REVIEWS_ROOT, "attempts");
export const REVIEWS_DIR   = path.join(REVIEWS_ROOT, "reviews");
export const DERIVED_DIR   = path.join(REVIEWS_ROOT, "derived");

// ─── Quality labels ───────────────────────────────────────────────────────────
export const QUALITY_LABELS = ["weak_review", "usable_review", "strong_review", "elite_review"];

// ─── Weighted trust per quality label ────────────────────────────────────────
export const QUALITY_TRUST = {
  weak_review:   0.25,
  usable_review: 0.60,
  strong_review: 0.85,
  elite_review:  1.00,
};

// ─── Canonical mistake taxonomy ──────────────────────────────────────────────
export const MISTAKE_TAXONOMY = [
  "missed_core_demand",
  "poor_directive_handling",
  "weak_intro",
  "weak_body_flow",
  "weak_conclusion",
  "low_dimensionality",
  "shallow_content",
  "factual_weakness",
  "no_examples",
  "poor_balance",
  "weak_analysis",
  "poor_structure",
  "poor_prioritization",
  "time_pressure_compression",
  "weak_presentation",
  "no_subheadings",
  "too_short",
  "too_lengthy",
  "vague_language",
  "repetitive_expression",
  "poor_question_understanding",
];

// ─── Canonical revision task taxonomy ────────────────────────────────────────
export const REVISION_TASK_TAXONOMY = [
  "rewrite_same_question",
  "rewrite_intro_only",
  "rewrite_conclusion_only",
  "directive_practice",
  "dimension_expansion",
  "example_enrichment",
  "fact_booster_revision",
  "structure_drill",
  "subheading_drill",
  "time_bound_rewrite",
  "micro_theme_revision",
];

// ─── ID generators ────────────────────────────────────────────────────────────
export function generateAttemptId() {
  return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateReviewId() {
  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateDerivedId(attemptId, reviewId) {
  return `derived_${attemptId}_${reviewId}`;
}

// ─── Safe JSON read ───────────────────────────────────────────────────────────
export function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Safe JSON write ─────────────────────────────────────────────────────────
export function safeWriteJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`[mainsReviewUtils] Failed to write ${filePath}:`, err.message);
    return false;
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────────────
export function attemptFilePath(attemptId) {
  return path.join(ATTEMPTS_DIR, `${attemptId}.json`);
}

export function reviewFilePath(reviewId) {
  return path.join(REVIEWS_DIR, `${reviewId}.json`);
}

export function derivedFilePath(attemptId, reviewId) {
  return path.join(DERIVED_DIR, `${attemptId}_${reviewId}.json`);
}

// ─── Schema: mainsAnswerAttempt ───────────────────────────────────────────────
export function buildAttemptRecord(payload, attemptId) {
  return {
    schema:    "mainsAnswerAttempt",
    attemptId,
    createdAt: new Date().toISOString(),
    userId:    payload.userId || "unknown",
    source:    payload.source || {},
    question:  payload.question || {},
    writingSession: payload.writingSession || {},
    answerUpload:   payload.answerUpload || {},
    extraction:     payload.extraction || {},
    selfReview:     payload.selfReview || {},
    status: "saved",
  };
}

// ─── Schema: mainsExternalReview ─────────────────────────────────────────────
export function buildReviewRecord(payload, reviewId) {
  return {
    schema:        "mainsExternalReview",
    reviewId,
    attemptId:     payload.attemptId,
    createdAt:     new Date().toISOString(),
    userId:        payload.userId || "unknown",
    reviewSource:  payload.reviewSource || { type: "chatgpt_pasted" },
    rawReviewText: payload.rawReviewText || "",
    userAgreement: payload.userAgreement || { value: "not_set", note: "" },
    status: "saved",
  };
}
