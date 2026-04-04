/**
 * detectStage.js
 * Detects WHICH exam stage a block belongs to: prelims, mains, essay, csat, or general.
 *
 * Stage detection uses explicit keywords, subject registry defaults, and activity type signals.
 */

import { STAGES, STAGE_KEYWORDS } from './constants.js';
import { findSubject } from './subjectRegistry.js';

/**
 * @typedef {Object} StageDetectionResult
 * @property {string}   stage        - One of STAGES values
 * @property {string[]} matchedTerms - Stage keywords that matched
 * @property {number}   confidence   - 0–1 confidence score
 */

/**
 * Detect exam stage from normalized block text.
 *
 * Priority:
 *  1. Explicit stage keywords in text (highest confidence)
 *  2. Subject registry default stage
 *  3. General fallback
 *
 * @param {string} normalizedText      - Pre-normalized block text.
 * @param {string|null} [subjectSlug]  - Already-detected subject slug (optional).
 * @returns {StageDetectionResult}
 */
export function detectStage(normalizedText, subjectSlug = null) {
  const text = normalizedText;

  // ── 1. Explicit keyword match ─────────────────────────────────────────────
  const matchedTerms = [];
  const stageCounts = {};

  for (const stage of Object.values(STAGES)) {
    stageCounts[stage] = 0;
  }

  // Sort keywords by length descending (longer = more specific)
  const sortedKeywords = Object.entries(STAGE_KEYWORDS).sort(([a], [b]) => b.length - a.length);

  for (const [keyword, stage] of sortedKeywords) {
    if (text.includes(keyword)) {
      stageCounts[stage] += keyword.length;
      matchedTerms.push(keyword);
    }
  }

  // Find stage with highest keyword score
  let bestExplicit = null;
  let bestScore = 0;
  for (const [stage, score] of Object.entries(stageCounts)) {
    if (score > bestScore) {
      bestScore = score;
      bestExplicit = stage;
    }
  }

  if (bestExplicit && bestScore > 0) {
    let confidence = bestScore > 10 ? 0.95 : 0.8;
    return { stage: bestExplicit, matchedTerms, confidence };
  }

  // ── 2. Subject registry default stage ────────────────────────────────────
  if (subjectSlug) {
    const subject = findSubject(text) ?? null;
    // If subject resolved and has a specific stage, use it
    if (subject && subject.stage !== 'general') {
      return {
        stage: subject.stage,
        matchedTerms: [`[subject:${subject.slug}]`],
        confidence: 0.7,
      };
    }
  }

  // ── 3. Direct subject lookup from text ────────────────────────────────────
  const subjectFromText = findSubject(text);
  if (subjectFromText && subjectFromText.stage !== 'general') {
    return {
      stage: subjectFromText.stage,
      matchedTerms: [`[subject:${subjectFromText.slug}]`],
      confidence: 0.65,
    };
  }

  // ── 4. General fallback ───────────────────────────────────────────────────
  return {
    stage: STAGES.GENERAL,
    matchedTerms: [],
    confidence: 0.4,
  };
}
