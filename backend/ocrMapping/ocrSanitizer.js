/**
 * Sanitizes and normalizes raw OCR text
 */

export function cleanOcrText(rawText) {
  if (typeof rawText !== "string") return "";

  let cleaned = rawText
    .toLowerCase()
    .normalize("NFKD") // Remove diacritics
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()[\]{}<>]/g, "") // Remove brackets
    .replace(/[^\w\s-]/g, " ") // Replace remaining special chars with space
    .trim();

  // Normalize separators
  cleaned = cleaned.replace(/-/g, " ").replace(/\s+/g, " ");

  // Fix common OCR errors and shorthands
  const replacements = {
    "monetry": "monetary",
    "bankng": "banking",
    "fr": "fundamental rights",
    "dpsp": "directive principles of state policy",
    "env": "environment",
    "eco": "economy",
    "pol": "polity",
    "geo": "geography",
    "his": "history",
    "cur aff": "current affairs",
    "ca": "current affairs",
    "sci tech": "science tech",
    "st": "science tech",
    "gov": "governance",
    "ir": "international relations",
    "num": "number system",
    "rc": "reading comprehension"
  };

  const words = cleaned.split(" ");
  const mappedWords = words.map(w => replacements[w] || w);
  
  return mappedWords.join(" ").trim();
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
