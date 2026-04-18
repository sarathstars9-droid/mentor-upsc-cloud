/**
 * backend/ocrMapping/stageDetector.js
 *
 * OCR-level stage detection.
 * This is the FIRST step in the OCR pipeline — must run before subject/topic.
 *
 * Priority:
 *  1. GS paper keywords (gs-2, gs2, paper 2) → always mains + gsPaper set
 *  2. Explicit "Prelims" or "Mains" keyword
 *  3. CSAT / Essay keywords
 *  4. General fallback
 *
 * NOTE: "pyq" / "pyqs" alone do NOT determine stage.
 *   PYQs exist for both prelims and mains.
 *   Stage must come from an explicit keyword.
 */

// GS paper keyword → paper tag (always mains)
const GS_PAPER_MAP = [
  { patterns: [/\bgs[\s-]?1\b/i, /\bpaper[\s-]?1\b/i], paper: 'GS1' },
  { patterns: [/\bgs[\s-]?2\b/i, /\bpaper[\s-]?2\b/i], paper: 'GS2' },
  { patterns: [/\bgs[\s-]?3\b/i, /\bpaper[\s-]?3\b/i], paper: 'GS3' },
  {
    patterns: [
      /\bgs[\s-]?4\b/i,
      /\bpaper[\s-]?4\b/i,
      /\bgs[\s-]?iv\b/i,
      /\bgeneral[\s-]?studies[\s-]?4\b/i,
      /\bgeneral[\s-]?studies[\s-]?iv\b/i,
      /\bgeneral[\s-]?studies[\s-]?paper[\s-]?4\b/i,
      /\bethics,?\s*(integrity,?\s*)?(aptitude)?\b/i,
    ],
    paper: 'GS4',
  },
];

// Explicit stage keyword → stage value
const EXPLICIT_STAGE_PATTERNS = [
  { patterns: [/\bprelims?\b/i, /\bpreliminary\b/i], stage: 'prelims' },
  { patterns: [/\bmains?\b/i, /\bgeneral[\s-]?studies\b/i], stage: 'mains' },
  { patterns: [/\bessay\b/i], stage: 'essay' },
  { patterns: [/\bcsat\b/i, /\bbasic[\s-]?numeracy\b/i, /\breading[\s-]?comprehension\b/i], stage: 'csat' },
];

/**
 * Detect the exam stage from cleaned OCR text.
 *
 * @param {string} cleanedText - OCR text after sanitization
 * @returns {{ stage: string, gsPaper: string|null, stageConfidence: number, matchedTerm: string|null }}
 */
export function detectOcrStage(cleanedText) {
  const text = String(cleanedText || '');

  // ── 1. GS paper detection (always mains) ────────────────────────────────
  for (const { patterns, paper } of GS_PAPER_MAP) {
    for (const re of patterns) {
      if (re.test(text)) {
        return {
          stage: 'mains',
          gsPaper: paper,
          stageConfidence: 0.97,
          matchedTerm: paper,
        };
      }
    }
  }

  // ── 2. Explicit stage keyword ────────────────────────────────────────────
  for (const { patterns, stage } of EXPLICIT_STAGE_PATTERNS) {
    for (const re of patterns) {
      if (re.test(text)) {
        return {
          stage,
          gsPaper: null,
          stageConfidence: 0.95,
          matchedTerm: stage,
        };
      }
    }
  }

  // ── 3. General fallback ──────────────────────────────────────────────────
  return {
    stage: 'general',
    gsPaper: null,
    stageConfidence: 0.4,
    matchedTerm: null,
  };
}
