// backend/loaders/prelimsUnifiedLoader.js
// Global loader for all prelims PYQ data across every subject folder.
// Recursively scans pyq_questions_v2/prelims/, extracts questions from any
// supported JSON shape, normalises to a canonical schema, and deduplicates.

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { CSAT_TOPIC_TO_NODE_ID } from "../data/loaders/csatLoader.js";
import { resolveSubjectFromNodeId } from "../brain/subjectAliasMap.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PRELIMS_DIR = join(__dirname, "../data/pyq_questions_v2/prelims");

// ── Files that contain metadata / indexes, not question arrays ──────────────
const SKIP_TOKENS = [
  "validation_report",
  "production_report",
  "perfection_report",
  "correction_report",
  "correction_change_log",
  "_rebuild_audit",
  "_audit",
  "_by_node",
  "_master",       // catches _master.json and _master_index.json
  "_all_topics",
  "_zero_ambiguity",
  "readme",
];

function shouldSkipFile(filename) {
  const low = filename.toLowerCase();
  return SKIP_TOKENS.some((t) => low.includes(t));
}

// ── Subject label from folder name ──────────────────────────────────────────
const FOLDER_TO_SUBJECT = {
  "current affairs":        "current_affairs",
  "current_affairs":        "current_affairs",
  "internation_relations":  "international_relations",
  "ancient_history":        "ancient_history",
  "medieval_history":       "medieval_history",
  "modern_history":         "modern_history",
  "economy":                "economy",
  "environment":            "environment",
  "geography":              "geography",
  "indian_polity":          "indian_polity",
  "science_tech":           "science_tech",
  "csat":                   "csat",
};

function subjectFromPath(filePath) {
  const rel = relative(PRELIMS_DIR, filePath).replace(/\\/g, "/");
  const topFolder = rel.split("/")[0].toLowerCase();
  return FOLDER_TO_SUBJECT[topFolder] || topFolder;
}

// ── Extract raw question array from any supported JSON shape ─────────────────
function extractRawQuestions(data) {
  // Direct array  →  [ {question}, ... ]  or  [ { data: { questions } } ]
  if (Array.isArray(data)) {
    if (data.length && data[0]?.data?.questions) {
      return data.flatMap((item) => item.data?.questions || []);
    }
    return data;
  }

  // Standard wrapper  →  { questions: [...] }
  if (data?.questions && Array.isArray(data.questions)) return data.questions;

  // Double-wrapped  →  { data: { questions: [...] } }
  if (data?.data?.questions && Array.isArray(data.data.questions)) {
    return data.data.questions;
  }

  // CSAT RC years shape  →  { years: [{ year, sets: [{ questions }] }] }
  if (data?.years && Array.isArray(data.years)) {
    return data.years.flatMap((y) => {
      if (y.questions) return y.questions;
      return (y.sets || []).flatMap((s) => s.questions || []);
    });
  }

  // Master index / by-node index — skip
  if (data?.questionsById || data?.stageBuckets) return [];

  return [];
}

// ── Normalise one raw question to the canonical schema ────────────────────────
function normalizeQuestion(q, subject, sourceFolder, topicName, index) {
  q.subject = (q.subject || sourceFolder)
    .toLowerCase()
    .replace("internation_relations", "international_relations");

  const questionText =
    q.question || q.questionText || q.stem || q.prompt || "";
  if (!questionText.trim()) return null;

  // Resolve correctAnswer: direct field > answer.correct_option > answer string
  let ca = q.correctAnswer;
  if (!ca && q.answer?.correct_option) ca = q.answer.correct_option;
  if (!ca && typeof q.answer === "string" && /^[A-Da-d]$/.test(q.answer)) {
    ca = q.answer;
  }
  if (ca) ca = String(ca).toUpperCase().trim();

  // Validate: must be A/B/C/D when options are present
  const options =
    q.options && typeof q.options === "object" && !Array.isArray(q.options)
      ? q.options
      : null;
  if (options && ca && !/^[A-D]$/.test(ca)) ca = null;

  const id =
    q.id ||
    q.questionId ||
    `${sourceFolder.replace(/[/\\]/g, "_")}_${q.year || "UNK"}_${index}`;

  // For CSAT questions, resolve canonical nodeId from topic field using the shared map.
  // GS questions keep using their existing nodeId / syllabusNodeId / sectionId chain.
  const isCsat = (subject || "").toLowerCase() === "csat";
  let nodeId =
    q.nodeId ||
    q.syllabusNodeId ||
    q.sectionId ||
    q.topicId ||
    null;

  if (!nodeId && isCsat) {
    // Try: q.topic → q.subtopic → q.section → q.module → topicName (file-level)
    const topicCandidates = [q.topic, q.subtopic, q.section, q.module, topicName].filter(Boolean);
    for (const candidate of topicCandidates) {
      nodeId = CSAT_TOPIC_TO_NODE_ID[candidate] || null;
      if (nodeId) break;
      // Case-insensitive fallback
      const lower = candidate.toLowerCase();
      for (const [k, v] of Object.entries(CSAT_TOPIC_TO_NODE_ID)) {
        if (k.toLowerCase() === lower) { nodeId = v; break; }
      }
      if (nodeId) break;
    }
  }

  if (!nodeId) nodeId = q.topic || sourceFolder;


  // For CSAT, use topic/subtopic as microTheme instead of "general"
  const microTheme = q.microTheme
    || (isCsat ? (q.subtopic || q.topic || "general") : "general");

  return {
    id,
    year:           q.year   || null,
    question:       questionText,
    options,
    correctAnswer:  ca       || null,
    questionType:   q.questionType || q.type || (options ? "MCQ_SINGLE" : "STATEMENT"),
    subject:        subject        || q.subject || "unknown",
    sourceFolder,
    topicName:      q.topicName    || q.mappedTopicName || q.module || q.topic || topicName || "",
    nodeId,
    syllabusNodeId: q.syllabusNodeId || q.nodeId || nodeId,
    microTheme,
    stage:          q.stage        || "Prelims",
    paper:          q.paper        || q.gsPaper || "",
    confidenceBand: q.confidenceBand || "",
    reviewRequired: q.reviewRequired || false,
  };
}

// ── Main loader ───────────────────────────────────────────────────────────────
export function loadAllPrelimsQuestions() {
  const audit = {
    totalFiles:       0,
    skippedFiles:     0,
    loadedFiles:      0,
    totalLoaded:      0,
    skipped:          0,
    duplicatesRemoved: 0,
    subjectsFound:    new Set(),
    fileErrors:       [],
  };

  const questions     = [];
  const seenIds       = new Set();
  const seenFingerprt = new Set();

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }

      if (stat.isDirectory()) { walk(fullPath); continue; }
      if (!entry.endsWith(".json")) continue;

      audit.totalFiles++;

      if (shouldSkipFile(entry)) { audit.skippedFiles++; continue; }

      let data;
      try {
        data = JSON.parse(readFileSync(fullPath, "utf8"));
      } catch (e) {
        audit.fileErrors.push({ file: entry, error: e.message });
        audit.skippedFiles++;
        continue;
      }

      const subject     = subjectFromPath(fullPath);
      const sourceFolder = relative(PRELIMS_DIR, fullPath)
        .replace(/\\/g, "/")
        .replace(/\.json$/, "");
      const topicName   =
        data.topicName || data.module || basename(entry, ".json");

      const rawQs = extractRawQuestions(data);
      if (!rawQs.length) { audit.skippedFiles++; continue; }

      audit.loadedFiles++;

      for (let i = 0; i < rawQs.length; i++) {
        const norm = normalizeQuestion(
          rawQs[i], subject, sourceFolder, topicName, i + 1
        );

        if (!norm) { audit.skipped++; continue; }

        // Dedup by id
        if (seenIds.has(norm.id)) { audit.duplicatesRemoved++; continue; }

        // Dedup by content fingerprint
        const fp = `${norm.year}|${norm.question.slice(0, 80)}`;
        if (seenFingerprt.has(fp)) { audit.duplicatesRemoved++; continue; }

        seenIds.add(norm.id);
        seenFingerprt.add(fp);
        questions.push(norm);
        audit.subjectsFound.add(norm.subject);
        audit.totalLoaded++;
      }
    }
  }

  walk(PRELIMS_DIR);

  // ── Fix orphaned "patches" subject using nodeId-based resolution ──────────
  let patchesReassigned = 0;
  let patchesUnresolved = 0;
  for (const q of questions) {
    if (q.subject === "patches") {
      const resolved = resolveSubjectFromNodeId(q.nodeId);
      if (resolved) {
        q.subject = resolved;
        patchesReassigned++;
      } else {
        patchesUnresolved++;
      }
    }
  }
  if (patchesReassigned || patchesUnresolved) {
    console.log(`[UNIFIED LOADER] Patches subject fix: ${patchesReassigned} reassigned, ${patchesUnresolved} unresolved`);
  }

  return {
    questions,
    audit: {
      ...audit,
      subjectsFound: [...audit.subjectsFound].sort(),
      patchesReassigned,
      patchesUnresolved,
    },
  };
}
