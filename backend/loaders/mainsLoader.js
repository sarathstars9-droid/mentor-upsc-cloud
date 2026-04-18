// backend/loaders/mainsLoader.js
// Loads mains_master_clean_fixed.json — the clean unified mains PYQ dataset.
// ESM module (matches the rest of the backend).
// DO NOT modify the source JSON file.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_FILE = path.resolve(
  __dirname,
  "../data/pyq_questions/mains/mains_master_clean_fixed.json"
);

// ─── In-process cache ─────────────────────────────────────────────────────────
let _cache = null;

/**
 * Load and cache all questions from mains_master_clean_fixed.json.
 * Returns the raw questions array; callers apply their own filters.
 *
 * @returns {Array} questions
 */
export function loadMainsQuestions() {
  if (_cache) return _cache;

  if (!fs.existsSync(DATA_FILE)) {
    console.error("[mainsLoader] File not found:", DATA_FILE);
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    console.error("[mainsLoader] JSON parse error:", err.message);
    return [];
  }

  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  _cache = questions;

  console.log(
    `[mainsLoader] Loaded ${questions.length} questions from mains_master_clean_fixed.json`
  );
  return _cache;
}

/** Bust the cache (useful if the data file is hot-swapped at runtime). */
export function resetMainsCache() {
  _cache = null;
}
