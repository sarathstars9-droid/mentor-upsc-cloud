// backend/mainsReview/mainsReviewPipeline.js
// Orchestrates the full mains review processing pipeline.
// Called by POST /api/mains/review/process
//
// Pipeline stages (in order):
//   1. Load attempt + review records
//   2. Parse pasted review (heuristic)
//   3. Audit review quality
//   4. Extract structured signals
//   5. Classify mistakes (canonical taxonomy)
//   6. Build revision tasks
//   7. Save derived output (raw + derived as separate files)
//   8. Return summary response compatible with frontend contract

import { parsePastedReview }        from "./parsePastedReview.js";
import { auditReviewQuality }       from "./auditReviewQuality.js";
import { extractReviewSignals }     from "./extractReviewSignals.js";
import { classifyMainsMistakes }    from "./classifyMainsMistakes.js";
import { buildMainsRevisionTasks }  from "./buildMainsRevisionTasks.js";
import { saveDerivedRecord }        from "./saveMainsReviewRecord.js";
import { safeReadJson, attemptFilePath, reviewFilePath } from "./mainsReviewUtils.js";

/**
 * Run the full review processing pipeline.
 *
 * @param {string} attemptId
 * @param {string} reviewId
 * @returns {object} { ok, result, error? }
 */
export async function runReviewPipeline(attemptId, reviewId) {
  // ── Stage 1: Load raw records ─────────────────────────────────────────────
  const attempt = safeReadJson(attemptFilePath(attemptId));
  if (!attempt) {
    return { ok: false, error: `Attempt not found: ${attemptId}` };
  }

  const review = safeReadJson(reviewFilePath(reviewId));
  if (!review) {
    return { ok: false, error: `Review not found: ${reviewId}` };
  }

  const rawReviewText = review.rawReviewText || "";
  if (!rawReviewText.trim()) {
    return { ok: false, error: "Review text is empty — cannot process." };
  }

  // ── Stage 2: Parse ────────────────────────────────────────────────────────
  const parsed = parsePastedReview(rawReviewText);

  // ── Stage 3: Audit ────────────────────────────────────────────────────────
  const attemptMeta = {
    marks: attempt?.source?.questionMarks || attempt?.question?.marks || 15,
  };
  const audit = auditReviewQuality(parsed, attemptMeta);

  // ── Stage 4: Extract signals ───────────────────────────────────────────────
  const signals = extractReviewSignals(parsed, audit);

  // ── Stage 5: Classify mistakes ────────────────────────────────────────────
  const mistakeRecords = classifyMainsMistakes(
    signals.rawMistakeLabels,
    audit,
    attempt
  );
  // Stamp reviewId onto each mistake
  for (const m of mistakeRecords) m.reviewId = reviewId;

  // ── Stage 6: Build revision tasks ─────────────────────────────────────────
  const revisionTasks = buildMainsRevisionTasks(mistakeRecords, attempt, audit);
  // Stamp reviewId onto each task
  for (const t of revisionTasks) t.reviewId = reviewId;

  // ── Stage 7: Save derived output ──────────────────────────────────────────
  const derivedData = { parsed, audit, signals, mistakeRecords, revisionTasks };
  const saved = saveDerivedRecord(attemptId, reviewId, derivedData);
  if (!saved) {
    console.warn(`[pipeline] Derived data could not be saved for ${attemptId}/${reviewId}`);
  }

  // ── Stage 8: Build frontend-compatible summary response ───────────────────
  const result = buildProcessedReviewResult({
    attempt,
    review,
    audit,
    signals,
    mistakeRecords,
    revisionTasks,
    derived: saved,
  });

  return { ok: true, result };
}

/**
 * Build the processedReviewResult object matching the frontend contract:
 * {
 *   qualityLabel, qualityScore,
 *   marksAwarded, marksTotal,
 *   mistakeFlags, revisionTaskCount,
 *   mistakeBookSynced, revisionSynced,
 * }
 */
function buildProcessedReviewResult({ attempt, review, audit, signals, mistakeRecords, revisionTasks, derived }) {
  return {
    // Frontend-required fields (matches MainsReviewResultCard.jsx)
    qualityLabel:       audit.qualityLabel,
    qualityScore:       audit.qualityScore,
    marksAwarded:       audit.marksAwarded,
    marksTotal:         audit.marksTotal,
    mistakeFlags:       mistakeRecords.map((m) => m.mistakeId),
    revisionTaskCount:  revisionTasks.length,
    mistakeBookSynced:  derived, // true = saved to local JSON (flat persistence)
    revisionSynced:     derived,

    // Extended intelligence (available for future UI expansion)
    verdictLabel:        audit.verdictLabel,
    trustWeight:         audit.trustWeight,
    auditFlags:          audit.auditFlags,
    strengths:           signals.strengths,
    missingDimensions:   signals.missingDimensions,
    upgradeActions:      signals.upgradeActions,
    examinerConcerns:    signals.examinerConcerns,
    directiveHandled:    signals.directiveHandled,
    structureRatings:    signals.structureRatings,
    rewriteBlueprint:    signals.rewriteBlueprint,
    revisionTasks,
    mistakeRecords,
    sectionCount:        audit.sectionCount,
    totalSections:       audit.totalSections,
    isPartial:           audit.isPartial,
    processedAt:         new Date().toISOString(),
  };
}
