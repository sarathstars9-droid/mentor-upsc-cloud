// backend/mainsReview/classifyMainsMistakes.js
// Maps raw extracted mistake labels to canonical taxonomy.
// Schema output: array of mainsMistakeRecord objects
//
// Uses canonical MISTAKE_TAXONOMY from mainsReviewUtils.
// Trust weight from audit is applied to severity scoring.

import { MISTAKE_TAXONOMY } from "./mainsReviewUtils.js";

/**
 * Severity score per mistake type — how badly it affects marks (0.0–1.0).
 * Used to prioritise which mistakes to surface first.
 */
const MISTAKE_SEVERITY = {
  missed_core_demand:        1.0,
  poor_directive_handling:   0.95,
  poor_question_understanding: 0.90,
  shallow_content:           0.85,
  low_dimensionality:        0.80,
  weak_analysis:             0.75,
  factual_weakness:          0.70,
  no_examples:               0.65,
  weak_intro:                0.60,
  weak_conclusion:           0.60,
  poor_structure:            0.55,
  weak_body_flow:            0.55,
  poor_balance:              0.50,
  no_subheadings:            0.45,
  poor_prioritization:       0.45,
  weak_presentation:         0.40,
  time_pressure_compression: 0.35,
  vague_language:            0.35,
  too_short:                 0.30,
  too_lengthy:               0.25,
  repetitive_expression:     0.20,
};

/**
 * Classifies raw mistake labels into canonical mainsMistakeRecord objects.
 * Validates labels against canonical taxonomy — unknown labels are dropped.
 *
 * @param {string[]} rawLabels   - from extracted.rawMistakeLabels
 * @param {object}   audit       - auditReviewQuality output
 * @param {object}   attempt     - attempt record (for context)
 * @returns {object[]} array of mainsMistakeRecord
 */
export function classifyMainsMistakes(rawLabels, audit, attempt) {
  const trustWeight  = audit.trustWeight || 0.60;
  const qualityLabel = audit.qualityLabel || "usable_review";

  // Filter to only canonical labels
  const canonical = (rawLabels || []).filter((l) => MISTAKE_TAXONOMY.includes(l));

  // Deduplicate
  const unique = [...new Set(canonical)];

  // Build records
  return unique.map((mistakeId) => {
    const baseSeverity = MISTAKE_SEVERITY[mistakeId] ?? 0.5;
    // Adjusted severity: scale down by trust weight so weak reviews reduce impact
    const adjustedSeverity = Math.round(baseSeverity * trustWeight * 100) / 100;

    return {
      schema:          "mainsMistakeRecord",
      mistakeId,
      paper:           attempt?.source?.paper || attempt?.question?.paper || "unknown",
      marks:           attempt?.source?.questionMarks || null,
      questionText:    attempt?.question?.text?.substring(0, 100) || "",
      attemptId:       attempt?.attemptId || null,
      reviewId:        null, // set by caller
      baseSeverity,
      trustWeight,
      adjustedSeverity,
      reviewQuality:   qualityLabel,
      flaggedAt:       new Date().toISOString(),
      mustRevise:      adjustedSeverity >= 0.60,
      reviseNote:      "",
    };
  }).sort((a, b) => b.adjustedSeverity - a.adjustedSeverity); // highest severity first
}
