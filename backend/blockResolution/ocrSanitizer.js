/**
 * backend/blockResolution/ocrSanitizer.js
 *
 * STEP 1 — OCR SANITIZER
 *
 * Sanitizes raw OCR text and produces a structured object for downstream
 * subject/section classifiers.
 *
 * RULES:
 * - Do NOT over-clean
 * - Do NOT destroy domain terms
 * - Conservative abbreviation expansion only (no global blind rewrites)
 * - Preserve: rbi, mpc, gst, cop, biodiversity, parliament, judiciary
 */

/* ─── OCR VARIANT NORMALIZATION (unambiguous only) ──────────────────────────── */

// Only expand abbreviations that are unambiguous in ALL UPSC contexts.
// "fr" is NOT expanded globally — it could be Fundamental Rights or French.
// "bop" IS expanded — it only ever means Balance of Payments in UPSC Eco.
const OCR_VARIANTS = [
  // Article variants
  [/\bart\.?\s*(\d+)/gi, "article $1"],
  [/\barticle-(\d+)/gi, "article $1"],
  [/\barticle(\d+)/gi, "article $1"],

  // Fundamental Rights spelling variants
  [/\bfundamental\s+right\b(?!s)/gi, "fundamental rights"],

  // Economy-specific unambiguous expansions
  [/\bbop\b/gi, "balance of payments"],
  [/\bcad\b/gi, "current account deficit"],

  // Common OCR errors in UPSC context
  [/\bmonetry\b/gi, "monetary"],
  [/\bmonetory\b/gi, "monetary"],
  [/\bcurent\s+account\b/gi, "current account"],
  [/\benviroment\b/gi, "environment"],
  [/\bbiodiveristy\b/gi, "biodiversity"],
  [/\bparliment\b/gi, "parliament"],
  [/\bconstitition\b/gi, "constitution"],
  [/\binfrastructure\b/gi, "infrastructure"],

  // Hyphenation / spacing variants
  [/\bpre-\s*liminary\b/gi, "preliminary"],
  [/\bgeo-\s*stationary\b/gi, "geostationary"],
  [/\bnano-\s*technology\b/gi, "nanotechnology"],
  [/\bbio-\s*technology\b/gi, "biotechnology"],
  [/\bself-\s*governance\b/gi, "self governance"],
];

/* ─── PHRASE BUILDER ─────────────────────────────────────────────────────────── */

function buildTokens(text) {
  return text
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ""))
    .filter(t => t.length > 1);
}

function buildPhrases(tokens) {
  const phrases = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]) phrases.add(tokens[i]);
    if (i + 1 < tokens.length && tokens[i + 1]) {
      phrases.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
    if (i + 2 < tokens.length && tokens[i + 2]) {
      phrases.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
    if (i + 3 < tokens.length && tokens[i + 3]) {
      phrases.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]} ${tokens[i + 3]}`);
    }
  }
  return Array.from(phrases);
}

/* ─── MAIN EXPORT ──────────────────────────────────────────────────────────── */

/**
 * Sanitize raw OCR text for downstream classification.
 *
 * @param {string} rawText - Raw OCR string
 * @returns {{
 *   rawText: string,
 *   cleanText: string,
 *   normalizedText: string,
 *   tokens: string[],
 *   phrases: string[]
 * }}
 */
export function sanitizeOcrText(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return {
      rawText: rawText || "",
      cleanText: "",
      normalizedText: "",
      tokens: [],
      phrases: [],
    };
  }

  // Step 1: Basic clean — preserve structure
  let cleanText = rawText
    .trim()
    .replace(/[ \t]+/g, " ")         // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n")       // collapse excess newlines
    .replace(/[""'']/g, '"')          // normalize smart quotes
    .replace(/[–—]/g, "-")            // normalize dashes
    .replace(/\s*\n\s*/g, " ")        // flatten to single line
    .replace(/\s{2,}/g, " ")
    .trim();

  // Step 2: Build normalized (lowercase) copy  
  let normalizedText = cleanText
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .replace(/[^a-z0-9\s.,-]/g, " ") // keep alphanumeric + light punctuation
    .replace(/\s{2,}/g, " ")
    .trim();

  // Step 3: Apply OCR variant corrections on normalized copy
  for (const [pattern, replacement] of OCR_VARIANTS) {
    normalizedText = normalizedText.replace(pattern, replacement);
  }
  normalizedText = normalizedText.replace(/\s{2,}/g, " ").trim();

  // Step 4: Build tokens from normalized
  const tokens = buildTokens(normalizedText);

  // Step 5: Build bigram + trigram + 4-gram phrases  
  const phrases = buildPhrases(tokens);

  return {
    rawText,
    cleanText,
    normalizedText,
    tokens,
    phrases,
  };
}
