// backend/api/mainsGs1TopicQuestions.js
// Loads GS1 topic practice questions from the static JSON dataset.
// Called by GET /api/mains/gs1/topic-questions in server.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_FILE = path.join(
  __dirname, "..", "data", "mains_topic_questions", "gs1_topic_questions.json"
);

// ─── Derive structure hint from marks ────────────────────────────────────────
function structureFromMarks(marks) {
  if (marks === 10) return "Intro + 3 pts + Concl (~150 words)";
  if (marks === 15) return "Intro + 4–5 pts + Concl (~200 words)";
  if (marks === 20) return "Intro + 6 pts + Concl (~250 words)";
  return "Intro + key points + Concl";
}

// ─── Main loader ─────────────────────────────────────────────────────────────
export function loadGs1TopicQuestions() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error("[mainsGs1TopicQuestions] Could not read dataset:", err.message);
    return [];
  }

  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  const seen = new Set();
  const all  = [];

  for (const q of questions) {
    const id = String(q?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const questionText = String(q?.question || "").trim();
    if (!questionText) continue;

    const marks = Number(q.marks) || null;

    all.push({
      id,
      paper:      "GS1",
      theme:      String(q.theme      || ""),
      subtopic:   String(q.subtopic   || ""),
      nodeId:     String(q.nodeId     || ""),
      source:     "Topic",
      marks,
      question:   questionText,
      focus:      String(q.focus      || ""),
      structure:  q.structure || structureFromMarks(marks),
      difficulty: String(q.difficulty || "medium"),
      origin:     "generated_template",
    });
  }

  // Sort by theme alphabetically, then marks ascending
  const THEME_ORDER = { "Art & Culture": 1, Geography: 2, History: 3, Society: 4 };
  all.sort((a, b) => {
    const tA = THEME_ORDER[a.theme] ?? 9;
    const tB = THEME_ORDER[b.theme] ?? 9;
    if (tA !== tB) return tA - tB;
    return (a.marks ?? 0) - (b.marks ?? 0);
  });

  return all;
}
