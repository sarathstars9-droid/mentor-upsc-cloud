/**
 * Sanitizes and normalizes raw OCR text.
 *
 * IMPORTANT: Abbreviation expansion is deliberately conservative.
 * Short tokens like "st", "eco", "gov", "pol", "his", "geo", "ir" are NOT
 * expanded via simple word-replace because they appear inside valid topic phrases
 * (e.g. "ecosystem", "polity", "historic", "geography") and cause corruption.
 *
 * Only clearly unambiguous, multi-character abbreviations with strong signals are expanded.
 */

export function cleanOcrText(rawText) {
  if (typeof rawText !== "string") return "";

  let cleaned = rawText
    .toLowerCase()
    .normalize("NFKD") // Remove diacritics
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()[]{}<>]/g, "") // Remove brackets
    .replace(/[^\w\s-]/g, " ") // Replace remaining special chars with space
    .trim();

  // Normalize separators but preserve hyphens in GS-1, GS-2 etc.
  // Only collapse multiple hyphens, not single ones
  cleaned = cleaned.replace(/\s+/g, " ");

  // Normalize GS paper references: gs 1 → gs1, g s 2 → gs2
  cleaned = cleaned.replace(/\bgs\s+([1-4])\b/gi, "gs$1");

  // Fix common OCR errors — ONLY unambiguous multi-char tokens
  const replacements = {
    "monetry": "monetary",
    "bankng": "banking",
    "cur aff": "current affairs",
    "sci tech": "science tech",
    "science and tech": "science and technology",
    "ans writing": "answer writing",
    "prev yr": "previous year",
    "prev year": "previous year",
  };

  // Apply replacements with word-boundary awareness
  for (const [abbr, expansion] of Object.entries(replacements)) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "gi");
    cleaned = cleaned.replace(re, expansion);
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Assesses the quality of the OCR text.
 * Returns true if the text is of acceptable quality, false if LOW quality (too short, ambiguous).
 */
export function assessTextQuality(cleanedText) {
  if (!cleanedText) return false;
  if (cleanedText.length < 3 && cleanedText !== "rc" && cleanedText !== "ca" && cleanedText !== "fr") return false;

  // If text is composed entirely of single letters, it's noise
  const words = cleanedText.split(" ");
  const isAllSingleLetters = words.every(w => w.length === 1);
  if (isAllSingleLetters && words.length < 3) return false;

  return true;
}
