// backend/api/mainsGs3Questions.js
// Normalizes all 6 GS3 tagged mains JSON files into a clean unified format.
// Called by the /api/mains/gs3/questions route in server.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions", "mains");

// ─── File → Theme mapping ─────────────────────────────────────────────────────
// Agriculture and Disaster Management are folded into Economy and Internal Security
// respectively as theme groupings, matching user-specified GS3 theme list.
const GS3_FILES = [
  { file: "mains_gs3_economy_tagged.json",           theme: "Economy"           },
  { file: "mains_gs3_agriculture_tagged.json",       theme: "Economy"           }, // Agriculture → Economy group
  { file: "mains_gs3_environment_tagged.json",       theme: "Environment"       },
  { file: "mains_gs3_science_tech_tagged.json",      theme: "Science & Tech"    },
  { file: "mains_gs3_internal_security_tagged.json", theme: "Internal Security" },
  { file: "mains_gs3_disaster_management_tagged.json", theme: "Internal Security" }, // DM → Internal Security group
];

// ─── GS3 questions have no marks field — infer from questionNumber ────────────
// Each subject JSON numbers questions independently (1–N per subject file).
// Within each subject section: Q1–5 = 10 marks, Q6+ = 15 marks.
// GS papers have only 10M and 15M — no 20M questions.
function inferMarksGS3(questionNumber) {
  const n = Number(questionNumber);
  if (!n) return 10;
  return n <= 5 ? 10 : 15;
}

function structureFromMarks(marks) {
  if (marks === 10) return "Intro + 3 pts + Concl (~150 words)";
  if (marks === 15) return "Intro + 4–5 pts + Concl (~200 words)";
  if (marks === 20) return "Intro + 6 pts + Concl (~250 words)";
  return "Intro + key points + Concl";
}

function buildFocus(q) {
  const parts = [];
  if (q.theme)     parts.push(q.theme);
  if (q.directive) parts.push(`Directive: ${q.directive}`);
  return parts.join(" · ");
}

// ─── Main loader ─────────────────────────────────────────────────────────────
export function loadGs3Questions() {
  const all  = [];
  const seen = new Set();

  for (const { file, theme } of GS3_FILES) {
    const filePath = path.join(DATA_DIR, file);

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      console.warn(`[mainsGs3] Could not read ${file}:`, err.message);
      continue;
    }

    const questions = Array.isArray(raw?.questions) ? raw.questions : [];

    for (const q of questions) {
      const id = String(q?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const questionText = String(q?.question || "").trim();
      if (!questionText) continue;

      const marks = inferMarksGS3(q.questionNumber);

      all.push({
        id,
        paper:     "GS3",
        theme,
        year:      q.year ? Number(q.year) : null,
        marks,
        source:    "PYQ",
        question:  questionText,
        focus:     buildFocus(q),
        structure: structureFromMarks(marks),
        nodeId:    q.syllabusNodeId || "",
      });
    }
  }

  // Sort: newest year first, nulls at end, then by id
  all.sort((a, b) => {
    if (a.year && b.year) return b.year - a.year;
    if (a.year) return -1;
    if (b.year) return  1;
    return a.id < b.id ? -1 : 1;
  });

  return all;
}
