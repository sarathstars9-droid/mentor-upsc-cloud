// backend/api/mainsGs2Questions.js
// Normalizes all 4 GS2 tagged mains JSON files into a clean unified format.
// Called by the /api/mains/gs2/questions route in server.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions", "mains");

// ─── File → Theme mapping ─────────────────────────────────────────────────────
const GS2_FILES = [
  { file: "mains_gs2_polity_tagged.json",                theme: "Polity"                  },
  { file: "mains_gs2_governance_tagged.json",            theme: "Governance"              },
  { file: "mains_gs2_social_justice_tagged.json",        theme: "Social Justice"          },
  { file: "mains_gs2_international_relations_tagged.json", theme: "International Relations" },
];

// ─── GS2 questions have no marks field — infer from questionNumber ────────────
// UPSC GS2: Q1–10 are 10 marks, Q11–17 are 15 marks (approx), Q18–20 are 20 marks
function inferMarksGS2(questionNumber) {
  const n = Number(questionNumber);
  if (!n) return 10;
  if (n <= 10) return 10;
  if (n <= 17) return 15;
  return 20;
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
export function loadGs2Questions() {
  const all  = [];
  const seen = new Set();

  for (const { file, theme } of GS2_FILES) {
    const filePath = path.join(DATA_DIR, file);

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      console.warn(`[mainsGs2] Could not read ${file}:`, err.message);
      continue;
    }

    const questions = Array.isArray(raw?.questions) ? raw.questions : [];

    for (const q of questions) {
      const id = String(q?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const questionText = String(q?.question || "").trim();
      if (!questionText) continue;

      const marks = inferMarksGS2(q.questionNumber);

      all.push({
        id,
        paper:     "GS2",
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
