import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRELIMS_GS_DIR = path.join(
  __dirname,
  "..",
  "data",
  "pyq_questions",
  "prelims",
  "gs"
);

const PRELIMS_CSAT_DIR = path.join(
  __dirname,
  "..",
  "data",
  "pyq_questions",
  "prelims",
  "csat"
);

const PYQ_BY_NODE_PATH = path.join(__dirname, "..", "data", "pyq_by_node.json");

let cachedPool = null;
let cachedQuestionMap = null;
let cachedNodeMap = null;

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read JSON:", filePath, err.message);
    return null;
  }
}

function extractArray(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.questions)) return json.questions;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

function normalizeQuestion(raw, index, fileName) {
  const rawOptions = raw.options || raw.choices || {};

  const options = {
    A: rawOptions.A || rawOptions.a || raw.optionA || raw.a || "",
    B: rawOptions.B || rawOptions.b || raw.optionB || raw.b || "",
    C: rawOptions.C || rawOptions.c || raw.optionC || raw.c || "",
    D: rawOptions.D || rawOptions.d || raw.optionD || raw.d || "",
  };

  const normalizedCorrectAnswer = String(
    raw.correctAnswer ||
      raw.answer ||
      raw.correct_option ||
      raw.correct_option_key ||
      ""
  )
    .trim()
    .toUpperCase();

  return {
    id: raw.id || raw.questionId || `${fileName}_${index + 1}`,
    questionId: raw.questionId || raw.id || `${fileName}_${index + 1}`,
    questionText: raw.questionText || raw.question || raw.text || "",
    options: {
      A: options.A || "",
      B: options.B || "",
      C: options.C || "",
      D: options.D || "",
    },
    correctAnswer: normalizedCorrectAnswer,
    year: Number(raw.year || 0) || "",
    paper: raw.paper || "prelims",
    stage: raw.stage || "",
    exam: raw.exam || "",
    subjectId: raw.subjectId || raw.subject || "",
    subject: raw.subject || raw.subjectId || "",
    section: raw.section || "",
    questionNumber: raw.questionNumber || index + 1,
    questionType: raw.questionType || "MCQ",
    format: raw.format || "text",
    syllabusNodeId: raw.syllabusNodeId || raw.nodeId || "",
    microThemeId: raw.microThemeId || "",
    microThemeLabel: raw.microThemeLabel || raw.microTheme || raw.microtheme || "",
    sourceFile: fileName,
    sourceType: raw.sourceType || "pyq",
    difficulty: raw.difficulty || "",
    trapType: raw.trapType || "",
  };
}

function loadTaggedFilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith("_tagged.json"));

  const all = [];

  for (const fileName of files) {
    const fullPath = path.join(dirPath, fileName);
    const json = safeReadJson(fullPath);
    const arr = extractArray(json);

    const normalized = arr
      .map((item, index) => normalizeQuestion(item, index, fileName))
      .filter((q) => q.questionText);

    all.push(...normalized);
  }

  return all;
}

function loadAllPrelimsTaggedQuestions() {
  if (cachedPool) return cachedPool;

  const gsQuestions = loadTaggedFilesFromDir(PRELIMS_GS_DIR);
  const csatQuestions = loadTaggedFilesFromDir(PRELIMS_CSAT_DIR);

  cachedPool = [...gsQuestions, ...csatQuestions];
  console.log("[pyqTestService] loaded prelims tagged questions:", cachedPool.length);

  return cachedPool;
}

function loadQuestionMap() {
  if (cachedQuestionMap) return cachedQuestionMap;

  const map = {};
  for (const q of loadAllPrelimsTaggedQuestions()) {
    map[String(q.id)] = q;
    map[String(q.questionId)] = q;
  }

  cachedQuestionMap = map;
  return cachedQuestionMap;
}

function loadNodeMap() {
  if (cachedNodeMap) return cachedNodeMap;
  cachedNodeMap = safeReadJson(PYQ_BY_NODE_PATH) || {};
  return cachedNodeMap;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getGsQuestions() {
  return loadAllPrelimsTaggedQuestions().filter((q) => {
    const subject = String(q.subject || q.subjectId || "").toUpperCase();
    const node = String(q.syllabusNodeId || "").toUpperCase();
    return !subject.startsWith("CSAT") && !node.startsWith("CSAT");
  });
}

function getCsatQuestions() {
  return loadAllPrelimsTaggedQuestions().filter((q) => {
    const subject = String(q.subject || q.subjectId || "").toUpperCase();
    const node = String(q.syllabusNodeId || "").toUpperCase();
    return subject.startsWith("CSAT") || node.startsWith("CSAT");
  });
}

function getQuestionsByNodeIds(nodeIds = [], paper = "GS") {
  const ids = Array.isArray(nodeIds) ? nodeIds.filter(Boolean) : [];
  const nodeMap = loadNodeMap();
  const questionMap = loadQuestionMap();
  const source = paper === "CSAT" ? getCsatQuestions() : getGsQuestions();

  if (!ids.length) return source;

  const questionIds = new Set();
  for (const nodeId of ids) {
    const entry = nodeMap?.[nodeId];
    const prelimsIds = Array.isArray(entry?.prelims) ? entry.prelims : [];
    for (const id of prelimsIds) {
      questionIds.add(String(id));
    }
  }

  if (!questionIds.size) {
    return source.filter((q) => ids.includes(String(q.syllabusNodeId || "")));
  }

  const mapped = Array.from(questionIds)
    .map((id) => questionMap[id])
    .filter(Boolean);

  if (mapped.length) {
    return mapped;
  }

  return source.filter((q) => ids.includes(String(q.syllabusNodeId || "")));
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function dedupeQuestions(questions = []) {
  const seen = new Set();
  const result = [];
  for (const q of questions) {
    const key = String(q.questionId || q.id || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(q);
  }
  return result;
}

function matchesSelectedMicroTheme(question, selectedIds = []) {
  if (!selectedIds.length) return true;

  const normalizedSelected = new Set(selectedIds.map((item) => normalizeToken(item)).filter(Boolean));
  const candidates = [
    question.microThemeId,
    question.microThemeLabel,
    question.syllabusNodeId,
  ].map(normalizeToken).filter(Boolean);

  return candidates.some((candidate) => normalizedSelected.has(candidate));
}

export function getSectionalPyqTest({ nodeId, limit = 10 }) {
  const all = loadAllPrelimsTaggedQuestions();

  const filtered = all.filter(
    (q) => String(q.syllabusNodeId || "").trim() === String(nodeId || "").trim()
  );

  return shuffle(filtered).slice(0, Number(limit) || 10);
}

export function getPracticeQuestionPool({
  paper = "GS",
  scope = "subject",
  subjectTopicIds = [],
  topicId = "",
  microThemeIds = [],
}) {
  let filtered = [];

  if (scope === "subject") {
    filtered = getQuestionsByNodeIds(subjectTopicIds, paper);
  } else {
    filtered = getQuestionsByNodeIds([topicId], paper);
  }

  filtered = dedupeQuestions(filtered);

  if (scope === "subtopic" || (paper === "CSAT" && scope === "topic")) {
    filtered = filtered.filter((q) => matchesSelectedMicroTheme(q, microThemeIds));
  }

  return dedupeQuestions(filtered);
}

export function getPracticePyqTest({
  paper = "GS",
  scope = "subject",
  subjectTopicIds = [],
  topicId = "",
  microThemeIds = [],
  limit = 10,
}) {
  const filtered = getPracticeQuestionPool({
    paper,
    scope,
    subjectTopicIds,
    topicId,
    microThemeIds,
  });

  return shuffle(filtered).slice(0, Number(limit) || 10);
}

export function getPracticeQuestionCount(payload = {}) {
  return getPracticeQuestionPool(payload).length;
}

export function getYearWisePyqTest({ paperType, year }) {
  const numericYear = Number(year);
  const source = paperType === "CSAT" ? getCsatQuestions() : getGsQuestions();

  return source
    .filter((q) => Number(q.year) === numericYear)
    .sort((a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0));
}

export function getMixedPyqTest({ paperType, count }) {
  const source = paperType === "CSAT" ? getCsatQuestions() : getGsQuestions();
  const numericCount = Number(count) || (paperType === "CSAT" ? 80 : 100);

  return shuffle(source).slice(0, numericCount);
}

export function buildFullLengthMeta(type, year, count) {
  if (type === "gs_yearwise") {
    return {
      title: `GS Full-Length ${year}`,
      year: String(year),
      paper: "GS",
      source: "PYQ",
      questionCount: count,
    };
  }

  if (type === "csat_yearwise") {
    return {
      title: `CSAT Full-Length ${year}`,
      year: String(year),
      paper: "CSAT",
      source: "PYQ",
      questionCount: count,
    };
  }

  if (type === "gs_mixed") {
    return {
      title: "GS Mixed Full-Length",
      year: "",
      paper: "GS",
      source: "PYQ",
      questionCount: count,
    };
  }

  return {
    title: "CSAT Mixed Full-Length",
    year: "",
    paper: "CSAT",
    source: "PYQ",
    questionCount: count,
  };
}