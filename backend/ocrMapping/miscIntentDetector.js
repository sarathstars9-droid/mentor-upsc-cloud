/**
 * backend/ocrMapping/miscIntentDetector.js
 *
 * Detects whether a block is an explicit generic / non-syllabus intent
 * that is ALLOWED to receive MISC-GEN label.
 *
 * MISC-GEN is ONLY returned for these explicit patterns.
 * Any normal syllabus topic block (Environment, Economy, Polity, etc.)
 * must NEVER receive MISC-GEN — it should receive null (unresolved) instead.
 *
 * Allowed MISC-GEN intents:
 *   - current affairs / daily CA / newspaper
 *   - mapping / map practice (standalone — not subject-specific)
 *   - pyq practice (standalone — without a specific subject)
 *   - revision (standalone — without a specific subject)
 *   - mock analysis / mock review
 *   - admin / general planning / schedule
 */

/**
 * @typedef {Object} MiscIntentResult
 * @property {boolean} isMiscGen     - True if MISC-GEN is allowed
 * @property {string}  intentLabel   - Human-readable label for the intent
 * @property {string}  intentType    - Slug: 'current_affairs'|'mapping'|'pyq'|'revision'|'mock_analysis'|'admin'
 */

const MISC_GEN_PATTERNS = [
  {
    type: 'current_affairs',
    label: 'Current Affairs',
    patterns: [
      /\bcurrent[\s-]?affairs\b/i,
      /\bdaily[\s-]?ca\b/i,
      /\bmonthly[\s-]?mag\b/i,
      /\bnewspaper\b/i,
      /\bthe[\s-]?hindu\b/i,
      /\bindian[\s-]?express\b/i,
      /\beditorial\b/i,
    ],
  },
  {
    type: 'mock_analysis',
    label: 'Mock Analysis',
    patterns: [
      /\bmock[\s-]?analysis\b/i,
      /\bmock[\s-]?review\b/i,
      /\btest[\s-]?analysis\b/i,
      /\bflt[\s-]?analysis\b/i,
      /\btest[\s-]?review\b/i,
    ],
  },
  {
    type: 'admin',
    label: 'Admin / Planning',
    patterns: [
      /\badmin\b/i,
      /\bgeneral[\s-]?planning\b/i,
      /\bschedule[\s-]?planning\b/i,
      /\bplanning[\s-]?session\b/i,
      /\bweekly[\s-]?plan\b/i,
      /\bgoal[\s-]?setting\b/i,
    ],
  },
];

// These standalone keywords are ONLY misc if they appear WITHOUT a specific subject.
// "Revision" with "Polity" → NOT MISC. "Revision" alone → MISC.
// "PYQ Practice" alone → MISC. "History PYQ Practice" → NOT MISC.

/**
 * Quick check whether text contains any known subject keyword.
 * If yes, standalone generic keywords like 'revision' or 'pyq' are NOT MISC-GEN.
 */
const SUBJECT_SIGNALS = [
  'polity', 'economy', 'economics', 'history', 'geography', 'environment',
  'ecology', 'biodiversity', 'science', 'technology', 'ethics', 'governance',
  'international relations', 'internal security', 'disaster', 'society',
  'culture', 'sociology', 'essay', 'csat', 'optionals', 'optional',
  'gs1', 'gs2', 'gs3', 'gs4', 'gs-1', 'gs-2', 'gs-3', 'gs-4',
  'geography india', 'geography world', 'modern history', 'ancient history',
  'medieval history', 'world history',
];

function hasSubjectSignal(text) {
  const lower = text.toLowerCase();
  return SUBJECT_SIGNALS.some((s) => lower.includes(s));
}

// Standalone keywords that are MISC only without a subject
const STANDALONE_MISC_PATTERNS = [
  { type: 'revision', label: 'Revision', patterns: [/^revision$/i, /^revise$/i, /^quick[\s-]?revision$/i] },
  { type: 'pyq', label: 'PYQ Practice', patterns: [/^pyq[\s-]?practice$/i, /^previous[\s-]?year[\s-]?practice$/i, /^pyqs?$/i] },
];

/**
 * Detect if a block is an explicit MISC-GEN intent.
 *
 * @param {string} cleanedText  - Cleaned OCR text
 * @returns {MiscIntentResult}
 */
export function detectOcrMiscIntent(cleanedText) {
  const text = String(cleanedText || '').trim();

  // ── 1. Always-MISC intents (regardless of subject presence) ─────────────
  for (const { type, label, patterns } of MISC_GEN_PATTERNS) {
    for (const re of patterns) {
      if (re.test(text)) {
        return { isMiscGen: true, intentLabel: label, intentType: type };
      }
    }
  }

  // ── 2. Standalone-only MISC intents (only if no subject present) ─────────
  if (!hasSubjectSignal(text)) {
    for (const { type, label, patterns } of STANDALONE_MISC_PATTERNS) {
      for (const re of patterns) {
        if (re.test(text)) {
          return { isMiscGen: true, intentLabel: label, intentType: type };
        }
      }
    }
  }

  return { isMiscGen: false, intentLabel: null, intentType: null };
}
