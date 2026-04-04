/**
 * backend/ocrMapping/mappingConfidence.js
 *
 * Shared confidence utilities for OCR mapping pipeline
 */

export const CONFIDENCE_RULES = {
  HIGH_MIN: 0.85,
  MEDIUM_MIN: 0.65,
  GAP_MIN: 0.15,
};

export function clamp01(num) {
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

/**
 * Used inside subject/topic mappers to turn weighted component scores
 * into a normalized 0..1 confidence.
 */
export function computeConfidence({
  aliasScore = 0,
  keywordScore = 0,
  titleScore = 0,
  prefixBoost = 0,
}) {
  const raw =
    aliasScore * 0.45 +
    keywordScore * 0.35 +
    titleScore * 0.20 +
    prefixBoost;

  return clamp01(raw);
}

/**
 * Used inside topic resolver when comparing top vs second candidate.
 */
export function classifyConfidence(topScore = 0, secondScore = 0) {
  const confidence = clamp01(topScore);
  const gap = clamp01(topScore - secondScore);

  let level = "LOW";
  let action = "manual_review";

  if (
    confidence >= CONFIDENCE_RULES.HIGH_MIN &&
    gap >= CONFIDENCE_RULES.GAP_MIN
  ) {
    level = "HIGH";
    action = "auto_map";
  } else if (confidence >= CONFIDENCE_RULES.MEDIUM_MIN) {
    level = "MEDIUM";
    action = "suggest";
  }

  return {
    confidence,
    gap,
    level,
    action,
    quarantine: action !== "auto_map",
  };
}

/**
 * Used by index.js final pipeline.
 * Inputs expected already normalized to 0..1 scale.
 */
export function evaluateConfidence(score = 0, gap = 0, isTextAcceptable = true) {
  const normalizedScore = clamp01(score);
  const normalizedGap = clamp01(gap);

  let confidenceBadge = "LOW";
  let canAutoMap = false;
  let requiresApproval = true;

  if (!isTextAcceptable) {
    return {
      confidenceScore: normalizedScore,
      gapScore: normalizedGap,
      confidenceBadge: "LOW",
      canAutoMap: false,
      requiresApproval: true,
      reason: "low_text_quality",
    };
  }

  if (
    normalizedScore >= CONFIDENCE_RULES.HIGH_MIN &&
    normalizedGap >= CONFIDENCE_RULES.GAP_MIN
  ) {
    confidenceBadge = "HIGH";
    canAutoMap = true;
    requiresApproval = false;
  } else if (normalizedScore >= CONFIDENCE_RULES.MEDIUM_MIN) {
    confidenceBadge = "MEDIUM";
    canAutoMap = false;
    requiresApproval = true;
  }

  return {
    confidenceScore: normalizedScore,
    gapScore: normalizedGap,
    confidenceBadge,
    canAutoMap,
    requiresApproval,
    reason: canAutoMap ? "auto_map" : "needs_review",
  };
}