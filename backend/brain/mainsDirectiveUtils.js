// backend/brain/mainsDirectiveUtils.js
// Normalises raw directive strings from tagged question files into canonical forms.
// Deterministic. No external deps.

// ─── Canonical directive names ────────────────────────────────────────────────
export const DIRECTIVE_CANONICAL = [
  "Discuss",
  "Examine",
  "Analyze",
  "Critically Analyze",
  "Critically Examine",
  "Comment",
  "Explain",
  "Evaluate",
  "Elucidate",
  "Justify",
  "Distinguish",
  "Trace",
  "Highlight",
  "Illustrate",
  "Account For",
  "Misc",
];

// ─── Normalisation map ────────────────────────────────────────────────────────
// Key: lowercase pattern (trimmed). Value: canonical name.
const DIRECTIVE_MAP = new Map([
  // Analyze variants
  ["analyse",               "Analyze"],
  ["analyze",               "Analyze"],
  ["analysis",              "Analyze"],
  // Critically Analyze variants
  ["critically analyse",    "Critically Analyze"],
  ["critically analyze",    "Critically Analyze"],
  ["critical analysis",     "Critically Analyze"],
  // Critically Examine variants
  ["critically examine",    "Critically Examine"],
  ["critically examined",   "Critically Examine"],
  // Examine
  ["examine",               "Examine"],
  // Discuss
  ["discuss",               "Discuss"],
  ["discussion",            "Discuss"],
  // Explain
  ["explain",               "Explain"],
  // Evaluate
  ["evaluate",              "Evaluate"],
  ["evaluation",            "Evaluate"],
  ["assess",                "Evaluate"],
  ["assessment",            "Evaluate"],
  // Elucidate
  ["elucidate",             "Elucidate"],
  // Justify
  ["justify",               "Justify"],
  // Distinguish
  ["distinguish",           "Distinguish"],
  ["differentiate",         "Distinguish"],
  ["compare and contrast",  "Distinguish"],
  // Trace
  ["trace",                 "Trace"],
  // Highlight
  ["highlight",             "Highlight"],
  ["bring out",             "Highlight"],
  ["point out",             "Highlight"],
  // Illustrate
  ["illustrate",            "Illustrate"],
  ["give examples",         "Illustrate"],
  ["with examples",         "Illustrate"],
  // Account for
  ["account for",           "Account For"],
  ["account",               "Account For"],
  // Comment
  ["comment",               "Comment"],
  ["comment on",            "Comment"],
  // Misc / Unknown
  ["write a note",          "Misc"],
  ["write short notes",     "Misc"],
  ["write a note on",       "Misc"],
  ["write a short note",    "Misc"],
  ["elaborate",             "Misc"],
  ["describe",              "Misc"],
  ["enumerate",             "Misc"],
  ["list",                  "Misc"],
  ["state",                 "Misc"],
  ["mention",               "Misc"],
  ["define",                "Misc"],
]);

/**
 * Normalise a raw directive string to its canonical name.
 * Returns "Misc" if not recognized.
 *
 * @param {string} raw
 * @returns {string} canonical directive name
 */
export function normalizeDirective(raw) {
  const s = String(raw || "").trim().toLowerCase()
    .replace(/[.!?:;]$/, "")   // strip trailing punctuation
    .replace(/\s+/g, " ");      // collapse whitespace

  if (!s) return "Misc";

  // Exact map lookup first
  if (DIRECTIVE_MAP.has(s)) return DIRECTIVE_MAP.get(s);

  // Prefix scan: handles "critically examine the role of..." type raw values
  for (const [pattern, canonical] of DIRECTIVE_MAP) {
    if (s.startsWith(pattern + " ") || s.startsWith(pattern + ",")) {
      return canonical;
    }
  }

  // Single-word prefix: "discuss", "examine" etc. at start of longer string
  for (const [pattern, canonical] of DIRECTIVE_MAP) {
    if (!pattern.includes(" ") && s.startsWith(pattern)) return canonical;
  }

  return "Misc";
}

/**
 * Given a directives count map { raw: count }, return a normalized map.
 * Merges variants into canonical keys.
 *
 * @param {Object} rawMap  e.g. { "Analyse": 3, "Analyze": 1 }
 * @returns {Object}       e.g. { "Analyze": 4 }
 */
export function normalizeDirectiveMap(rawMap) {
  const result = {};
  for (const [raw, count] of Object.entries(rawMap || {})) {
    const canon = normalizeDirective(raw);
    result[canon] = (result[canon] || 0) + count;
  }
  return result;
}

/**
 * Get top directive from a normalized directive map.
 * Returns null if map is empty.
 *
 * @param {Object} dirMap
 * @returns {string|null}
 */
export function getTopDirective(dirMap) {
  const entries = Object.entries(dirMap || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Aggregate directive counts from multiple directive maps.
 *
 * @param {...Object} maps
 * @returns {Object}
 */
export function mergeDirectiveMaps(...maps) {
  const result = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m || {})) {
      result[k] = (result[k] || 0) + v;
    }
  }
  return result;
}
