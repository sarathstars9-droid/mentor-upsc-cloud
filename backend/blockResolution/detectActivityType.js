/**
 * detectActivityType.js
 * Detects HOW a block should be engaged: revision, practice, test, writing, etc.
 *
 * Uses ACTIVITY_KEYWORDS from constants and scores based on keyword specificity.
 */

import { ACTIVITY_TYPES, ACTIVITY_KEYWORDS } from './constants.js';

/**
 * @typedef {Object} ActivityDetectionResult
 * @property {string}   activityType - One of ACTIVITY_TYPES values
 * @property {string[]} matchedTerms - Keywords that triggered this detection
 * @property {number}   confidence   - 0–1 confidence score
 */

/**
 * Detect activity type from normalized block text.
 * Returns the best-matching activity type based on longest keyword match wins.
 *
 * @param {string} normalizedText - Pre-normalized block text.
 * @returns {ActivityDetectionResult}
 */
export function detectActivityType(normalizedText) {
  const text = normalizedText;
  const matched = [];

  // Score each activity type by summing lengths of matched keywords
  const scores = {};
  for (const type of Object.values(ACTIVITY_TYPES)) {
    scores[type] = { total: 0, terms: [] };
  }

  for (const [keyword, activityType] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (text.includes(keyword)) {
      scores[activityType].total += keyword.length;
      scores[activityType].terms.push(keyword);
    }
  }

  // Find the activity with highest score
  let best = ACTIVITY_TYPES.UNKNOWN;
  let bestScore = 0;

  for (const [type, data] of Object.entries(scores)) {
    if (data.total > bestScore) {
      bestScore = data.total;
      best = type;
    }
  }

  const terms = scores[best]?.terms ?? [];

  // Confidence: full match on a multi-word keyword = high; single short keyword = low
  let confidence = 0;
  if (bestScore > 12) confidence = 0.95;
  else if (bestScore > 6) confidence = 0.8;
  else if (bestScore > 0) confidence = 0.65;

  return {
    activityType: best,
    matchedTerms: terms,
    confidence,
  };
}
