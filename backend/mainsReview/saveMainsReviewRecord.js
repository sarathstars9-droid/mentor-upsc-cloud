// backend/mainsReview/saveMainsReviewRecord.js
// Persists all review pipeline outputs to flat JSON files.
// Writes: raw attempt, raw review, and derived (parsed + audit + signals + mistakes + tasks).

import {
  attemptFilePath,
  reviewFilePath,
  derivedFilePath,
  safeWriteJson,
} from "./mainsReviewUtils.js";

/**
 * Persist attempt record.
 * Returns true on success, false on failure (non-fatal — log and continue).
 */
export function saveAttemptRecord(attemptRecord) {
  const filePath = attemptFilePath(attemptRecord.attemptId);
  const ok = safeWriteJson(filePath, attemptRecord);
  if (ok) {
    console.log(`[mainsReview] Saved attempt: ${attemptRecord.attemptId}`);
  } else {
    console.error(`[mainsReview] FAILED to save attempt: ${attemptRecord.attemptId}`);
  }
  return ok;
}

/**
 * Persist review record (raw pasted text + userAgreement).
 */
export function saveReviewRecord(reviewRecord) {
  const filePath = reviewFilePath(reviewRecord.reviewId);
  const ok = safeWriteJson(filePath, reviewRecord);
  if (ok) {
    console.log(`[mainsReview] Saved review: ${reviewRecord.reviewId}`);
  } else {
    console.error(`[mainsReview] FAILED to save review: ${reviewRecord.reviewId}`);
  }
  return ok;
}

/**
 * Persist derived pipeline output:
 * { parsed, audit, signals, mistakeRecords, revisionTasks }
 * Written to derived/<attemptId>_<reviewId>.json
 */
export function saveDerivedRecord(attemptId, reviewId, derivedData) {
  const filePath = derivedFilePath(attemptId, reviewId);
  const record = {
    schema:      "mainsReviewDerived",
    savedAt:     new Date().toISOString(),
    attemptId,
    reviewId,
    ...derivedData,
  };
  const ok = safeWriteJson(filePath, record);
  if (ok) {
    console.log(`[mainsReview] Saved derived: ${attemptId}_${reviewId}`);
  } else {
    console.error(`[mainsReview] FAILED to save derived: ${attemptId}_${reviewId}`);
  }
  return ok;
}
