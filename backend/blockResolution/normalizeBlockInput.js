/**
 * normalizeBlockInput.js
 * Sanitizes and normalizes raw block label/text before classification.
 *
 * Responsibilities:
 *  - Lowercase
 *  - Collapse extra whitespace
 *  - Strip punctuation noise (except slashes, hyphens, dots used in shorthand)
 *  - Expand common abbreviations
 *  - Return a clean string ready for keyword matching
 */

/** Map of shorthands → expanded form (all lowercase) */
const EXPANSION_MAP = {
  'p&e': 'polity and economy',
  'p & e': 'polity and economy',
  'e&p': 'economy and polity',
  'hist': 'history',
  'geo': 'geography',
  'env': 'environment',
  'sci': 'science',
  's&t': 'science and technology',
  'ca': 'current affairs',
  'int sec': 'internal security',
  'dis mgmt': 'disaster management',
  'ans writing': 'answer writing',
  'rev': 'revision',
  'prac': 'practice',
  'br storm': 'brainstorming',
  'bs': 'brainstorming',
  'pyq': 'pyqs',          // normalise singular → plural canonical form
  'prev yr': 'previous year',
  'prev year': 'previous year',
};

/**
 * Normalize a raw block label for classification.
 * @param {string} raw - Raw block label as entered by the user or plan engine.
 * @returns {string} - Normalized string.
 */
export function normalizeBlockInput(raw) {
  if (typeof raw !== 'string') return '';

  let text = raw.trim().toLowerCase();

  // Collapse multiple whitespace characters
  text = text.replace(/\s+/g, ' ');

  // Remove trailing/leading noise punctuation (keep hyphens, slashes, dots)
  text = text.replace(/^[,;:!?]+|[,;:!?]+$/g, '');

  // Expand abbreviations — sort by length descending to match longer keys first
  const sortedKeys = Object.keys(EXPANSION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    // Use word-boundary-aware replacement
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'g');
    text = text.replace(regex, EXPANSION_MAP[key]);
  }

  // Final whitespace collapse after expansions
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
