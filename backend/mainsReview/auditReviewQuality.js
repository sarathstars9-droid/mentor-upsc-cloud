// backend/mainsReview/auditReviewQuality.js
// Scores and classifies the quality of a pasted review.
// Schema output: mainsReviewAudit
//
// Scoring dimensions (each 0–1, averaged to qualityScore):
//   1. completeness  — how many of 9 sections are present
//   2. specificity   — does the review contain specific language (numbers, section refs, examples)
//   3. actionability — does the review contain actionable advice (rewrite, add, improve, etc.)
//   4. consistency   — does marks awarded align with verdict label (rough heuristic)

import { QUALITY_LABELS, QUALITY_TRUST } from "./mainsReviewUtils.js";

/**
 * Audit a parsed review object.
 * @param {object} parsed - output of parsePastedReview()
 * @param {object} attemptMeta - { marks } from the original attempt
 * @returns mainsReviewAudit schema object
 */
export function auditReviewQuality(parsed, attemptMeta = {}) {
  const sections = parsed?.sections || {};
  const extracted = parsed?.extracted || {};

  // ── Score 1: Completeness ─────────────────────────────────────────────────
  const totalSections = parsed.totalSections || 9;
  const foundSections = parsed.sectionCount || 0;
  const completeness = foundSections / totalSections;

  // ── Score 2: Specificity ──────────────────────────────────────────────────
  // HEURISTIC: specific reviews mention numbers, colons, quotes, or specific terms
  const allText = Object.values(sections).filter(Boolean).join(" ");
  const specificitySignals = [
    /\d+\/\d+/.test(allText),                      // marks like 8/15
    /intro|conclusion|body|subhead/i.test(allText), // structural references
    /example|case|instance|data/i.test(allText),    // example references
    /paragraph|sentence|line/i.test(allText),       // micro-level feedback
    allText.length > 600,                           // enough content to be specific
  ];
  const specificity = specificitySignals.filter(Boolean).length / specificitySignals.length;

  // ── Score 3: Actionability ────────────────────────────────────────────────
  // HEURISTIC: actionable reviews use imperative verbs or contain section F/G
  const actionSignals = [
    Boolean(sections.air1UpgradeAdvice),
    Boolean(sections.rewriteBlueprint),
    /\b(add|include|rewrite|expand|remove|reduce|focus|avoid|use|improve)\b/i.test(allText),
    Boolean(sections.examinerConcerns),
    extracted.rawMistakeLabels?.length > 0,
  ];
  const actionability = actionSignals.filter(Boolean).length / actionSignals.length;

  // ── Score 4: Consistency ──────────────────────────────────────────────────
  // HEURISTIC: if marks awarded are available, check if verdict aligns directionally
  const marksTotal    = extracted.marksTotal || Number(attemptMeta.marks) || 15;
  const marksAwarded  = extracted.marksAwarded;
  const verdictLabel  = extracted.verdictLabel || "";
  let consistency = 0.7; // neutral default when we can't evaluate

  if (marksAwarded != null && marksTotal > 0) {
    const pct = marksAwarded / marksTotal;
    const isHighVerdict = /ranker|strong/i.test(verdictLabel);
    const isLowVerdict  = /dangerous|below/i.test(verdictLabel);

    if (pct >= 0.75 && isHighVerdict) consistency = 1.0;
    else if (pct <= 0.50 && isLowVerdict) consistency = 1.0;
    else if (pct >= 0.75 && isLowVerdict) consistency = 0.2;
    else if (pct <= 0.50 && isHighVerdict) consistency = 0.2;
    else consistency = 0.65;
  }

  // ── Composite score ───────────────────────────────────────────────────────
  // Weighted: completeness 30%, specificity 25%, actionability 30%, consistency 15%
  const qualityScore =
    completeness  * 0.30 +
    specificity   * 0.25 +
    actionability * 0.30 +
    consistency   * 0.15;

  // ── Assign quality label ──────────────────────────────────────────────────
  let qualityLabel;
  if (qualityScore >= 0.82) qualityLabel = "elite_review";
  else if (qualityScore >= 0.62) qualityLabel = "strong_review";
  else if (qualityScore >= 0.40) qualityLabel = "usable_review";
  else qualityLabel = "weak_review";

  const trustWeight = QUALITY_TRUST[qualityLabel];

  // ── Audit flags ───────────────────────────────────────────────────────────
  const auditFlags = [];
  if (completeness < 0.5) auditFlags.push("incomplete_sections");
  if (specificity  < 0.4) auditFlags.push("low_specificity");
  if (actionability < 0.4) auditFlags.push("low_actionability");
  if (consistency  < 0.4) auditFlags.push("inconsistent_marks_verdict");
  if (parsed.isPartial)   auditFlags.push("partial_parse");
  if (allText.length < 300) auditFlags.push("too_short_review");

  return {
    schema:      "mainsReviewAudit",
    auditedAt:   new Date().toISOString(),
    scores: {
      completeness:  round2(completeness),
      specificity:   round2(specificity),
      actionability: round2(actionability),
      consistency:   round2(consistency),
    },
    qualityScore: round2(qualityScore),
    qualityLabel,
    trustWeight,
    auditFlags,
    marksAwarded,
    marksTotal,
    verdictLabel,
    sectionCount:  foundSections,
    totalSections,
    isPartial:     parsed.isPartial,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
