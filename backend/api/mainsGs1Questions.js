// backend/api/mainsGs1Questions.js
// Normalizes all 4 GS1 tagged mains JSON files into a clean unified format.
// Called by the /api/mains/gs1/questions route in server.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions", "mains");

// ─── File → Theme mapping ─────────────────────────────────────────────────────
const GS1_FILES = [
  { file: "mains_gs1_history_tagged.json",     theme: "History"      },
  { file: "mains_gs1_society_tagged.json",     theme: "Society"      },
  { file: "mains_gs1_geography_tagged.json",   theme: "Geography"    },
  { file: "mains_gs1_art_culture_tagged.json", theme: "Art & Culture" },
];

// ─── Infer marks from wordLimit when marks field is null ─────────────────────
function inferMarks(marks, wordLimit) {
  if (marks != null && Number.isFinite(Number(marks))) return Number(marks);
  const w = Number(wordLimit);
  if (!w) return null;
  if (w <= 100) return 10;
  if (w <= 200) return 15;
  return 20;
}

// ─── Derive structure hint from marks ────────────────────────────────────────
function structureFromMarks(marks) {
  if (marks === 10) return "Intro + 3 pts + Concl (~150 words)";
  if (marks === 15) return "Intro + 4–5 pts + Concl (~200 words)";
  if (marks === 20) return "Intro + 6 pts + Concl (~250 words)";
  return "Intro + key points + Concl";
}

// ─── Build a focus hint from section/microtheme ───────────────────────────────
function buildFocus(q) {
  const parts = [];
  if (q.section)    parts.push(q.section);
  if (q.microtheme) parts.push(q.microtheme);
  if (q.directive)  parts.push(`Directive: ${q.directive}`);
  return parts.join(" · ");
}

// ─── Main loader ─────────────────────────────────────────────────────────────
export function loadGs1Questions() {
  const all   = [];
  const seen  = new Set();

  for (const { file, theme } of GS1_FILES) {
    const filePath = path.join(DATA_DIR, file);

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      console.warn(`[mainsGs1] Could not read ${file}:`, err.message);
      continue;
    }

    const questions = Array.isArray(raw?.questions) ? raw.questions : [];

    for (const q of questions) {
      const id = String(q?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const questionText = String(q?.question || "").trim();
      if (!questionText) continue;

      const marks = inferMarks(q.marks, q.wordLimit);

      all.push({
        id,
        paper:     "GS1",
        theme,
        year:      q.year  ? Number(q.year) : null,
        marks,
        source:    "PYQ",           // all tagged files are PYQ by definition
        question:  questionText,
        focus:     buildFocus(q),
        structure: structureFromMarks(marks),
        // Extra fields for frontend Start Writing state:
        section:   q.section    || "",
        nodeId:    q.syllabusNodeId || "",
      });
    }
  }

  // Sort: newest year first, then nulls at end, then by id
  all.sort((a, b) => {
    if (a.year && b.year) return b.year - a.year;
    if (a.year) return -1;
    if (b.year) return  1;
    return a.id < b.id ? -1 : 1;
  });

  return all;
}
