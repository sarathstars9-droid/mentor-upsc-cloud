/**
 * detectEntityType.js
 * Detects WHAT the block is about: subject, topic, test-series, material, skill, or unknown.
 *
 * Uses subjectRegistry for subject detection and keyword heuristics for others.
 */

import { ENTITY_TYPES, TEST_SERIES_KEYWORDS } from './constants.js';
import { findSubject } from './subjectRegistry.js';

/**
 * @typedef {Object} EntityDetectionResult
 * @property {string}      entityType   - One of ENTITY_TYPES values
 * @property {string|null} subjectSlug  - Canonical subject slug if entityType === 'subject'
 * @property {string|null} subjectLabel - Human-readable label if entityType === 'subject'
 * @property {string|null} testFamily   - Test series family if entityType === 'test_series'
 * @property {number}      confidence   - 0–1 confidence score
 */

/** keywords → material */
const MATERIAL_KEYWORDS = ['ncert', 'laxmikant', 'ramesh singh', 'bipin chandra', 'vision ias notes', 'notes'];

/** keywords → skill */
const SKILL_KEYWORDS = ['answer writing skill', 'writing skill', 'time management', 'speed reading', 'note making skill'];

/**
 * Detect the entity type from normalized block text.
 * @param {string} normalizedText - Pre-normalized block text.
 * @returns {EntityDetectionResult}
 */
export function detectEntityType(normalizedText) {
  const text = normalizedText;

  // ── 1. Test series detection (specific — check early) ────────────────────
  // Use word-boundary regex so "vision" doesn't match inside "revision"
  for (const [keyword, family] of Object.entries(TEST_SERIES_KEYWORDS)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
    if (regex.test(text)) {
      return {
        entityType: ENTITY_TYPES.TEST_SERIES,
        subjectSlug: null,
        subjectLabel: null,
        testFamily: family,
        confidence: 0.9,
      };
    }
  }

  // ── 2. Material detection ─────────────────────────────────────────────────
  const isMaterial = MATERIAL_KEYWORDS.some((kw) => text.includes(kw));
  if (isMaterial) {
    return {
      entityType: ENTITY_TYPES.MATERIAL,
      subjectSlug: null,
      subjectLabel: null,
      testFamily: null,
      confidence: 0.85,
    };
  }

  // ── 3. Skill detection ────────────────────────────────────────────────────
  const isSkill = SKILL_KEYWORDS.some((kw) => text.includes(kw));
  if (isSkill) {
    return {
      entityType: ENTITY_TYPES.SKILL,
      subjectSlug: null,
      subjectLabel: null,
      testFamily: null,
      confidence: 0.85,
    };
  }

  // ── 4. Subject detection via registry ────────────────────────────────────
  const subject = findSubject(text);
  if (subject) {
    return {
      entityType: ENTITY_TYPES.SUBJECT,
      subjectSlug: subject.slug,
      subjectLabel: subject.label,
      testFamily: null,
      confidence: 0.9,
    };
  }

  // ── 5. Unknown fallback ───────────────────────────────────────────────────
  return {
    entityType: ENTITY_TYPES.UNKNOWN,
    subjectSlug: null,
    subjectLabel: null,
    testFamily: null,
    confidence: 0.0,
  };
}
