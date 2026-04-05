/**
 * detectStage.js
 * Detects WHICH exam stage a block belongs to: prelims, mains, essay, csat, or general.
 *
 * Priority order (STRICT — stage must be resolved before subject/topic):
 *  1. Explicit GS paper keywords (gs-2 mains, gs2, paper 1) → always mains
 *  2. Explicit stage keywords in text (prelims, mains, csat, essay)
 *  3. Subject registry default stage (only if stage === 'mains' | 'essay' | 'csat', never 'general')
 *  4. General fallback
 *
 * IMPORTANT: 'pyq' / 'pyqs' alone do NOT lock stage to prelims.
 *   PYQ practice exists at both prelims and mains.
 *   Stage must come from an EXPLICIT keyword like "Prelims" or "Mains".
 */

import { STAGES, STAGE_KEYWORDS, GS_PAPER_KEYWORDS } from './constants.js';
import { findSubject } from './subjectRegistry.js';

/**
 * @typedef {Object} StageDetectionResult
 * @property {string}   stage        - One of STAGES values
 * @property {string[]} matchedTerms - Stage keywords that matched
 * @property {number}   confidence   - 0–1 confidence score
 * @property {string|null} gsPaper   - GS paper if detected (GS1|GS2|GS3|GS4), else null
 */

/**
 * Detect exam stage from normalized block text.
 *
 * @param {string} normalizedText      - Pre-normalized block text.
 * @param {string|null} [subjectSlug]  - Already-detected subject slug (optional).
 * @returns {StageDetectionResult}
 */
export function detectStage(normalizedText, subjectSlug = null) {
  const text = normalizedText.toLowerCase();

  // ── 1. Explicit GS paper detection (always mains) ─────────────────────────
  // Sort by length descending so "gs-2 mains" matches "gs-2" before "gs"
  const sortedGsPapers = Object.entries(GS_PAPER_KEYWORDS).sort(([a], [b]) => b.length - a.length);
  for (const [keyword, paperTag] of sortedGsPapers) {
    // Use word-boundary check to avoid 'gs2' matching inside 'gs20'
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-z\\d])${escaped}(?![a-z\\d])`, 'i');
    if (regex.test(text)) {
      return {
        stage: STAGES.MAINS,
        matchedTerms: [keyword],
        confidence: 0.97,
        gsPaper: paperTag,
      };
    }
  }

  // ── 2. Explicit stage keyword match ───────────────────────────────────────
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
    const confidence = bestScore > 10 ? 0.95 : 0.85;
    return { stage: bestExplicit, matchedTerms, confidence, gsPaper: null };
  }

  // ── 3. Subject registry default stage (only for non-general subjects) ──────
  if (subjectSlug) {
    const subject = findSubject(text) ?? null;
    if (subject && subject.stage !== 'general') {
      return {
        stage: subject.stage,
        matchedTerms: [`[subject:${subject.slug}]`],
        confidence: 0.65,
        gsPaper: null,
      };
    }
  }

  // ── 4. Direct subject lookup from text ────────────────────────────────────
  const subjectFromText = findSubject(text);
  if (subjectFromText && subjectFromText.stage !== 'general') {
    return {
      stage: subjectFromText.stage,
      matchedTerms: [`[subject:${subjectFromText.slug}]`],
      confidence: 0.60,
      gsPaper: null,
    };
  }

  // ── 5. General fallback ───────────────────────────────────────────────────
  return {
    stage: STAGES.GENERAL,
    matchedTerms: [],
    confidence: 0.4,
    gsPaper: null,
  };
}
