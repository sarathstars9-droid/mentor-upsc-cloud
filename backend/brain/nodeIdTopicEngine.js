import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePyqNodeId } from "./pyqNodeAliasMap.js";
import { resolveSubjectAlias, resolveSubjectFromNodeId } from "./subjectAliasMap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_DIR = path.join(__dirname, "..", "data", "pyq_index");

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function getQuestionNodeId(q = {}) {
  return normalizePyqNodeId(
    q.nodeId ||
    q.syllabusNodeId ||
    q.topicNodeId ||
    q.node_id ||
    q.syllabus_node_id ||
    ""
  );
}

export function loadPyqNodeIndexes() {
  const byNodePath = path.join(INDEX_DIR, "pyq_by_node.json");
  const masterPath = path.join(INDEX_DIR, "pyq_master_index.json");

  const pyqByNode = readJsonSafe(byNodePath, {});
  const masterRaw = readJsonSafe(masterPath, []);

  const masterById = Array.isArray(masterRaw)
    ? Object.fromEntries(masterRaw.map((q) => [q.id, q]))
    : masterRaw;

  return { pyqByNode, masterById };
}

export function getQuestionsByNodeId({ nodeId, subjectId, fallbackPool = [] }) {
  const canonicalNodeId = normalizePyqNodeId(nodeId);
  if (!canonicalNodeId) {
    return {
      questions: [],
      source: "missing_node",
      canonicalNodeId: "",
    };
  }

  const resolvedSubject = resolveSubjectAlias(subjectId || "");

  // Primary: raw string match against dataset — avoids alias collisions from normalizePyqNodeId
  const rawNodeId = String(nodeId || "").trim();
  const datasetMatches = fallbackPool.filter((q) => {
    const rawQ = String(
      q.nodeId || q.syllabusNodeId || q.topicNodeId || q.node_id || q.syllabus_node_id || ""
    ).trim();
    if (rawQ !== rawNodeId) return false;
    if (!resolvedSubject) return true;
    if (resolveSubjectAlias(q.subject || "") === resolvedSubject) return true;
    if (resolveSubjectFromNodeId(q.nodeId || q.syllabusNodeId) === resolvedSubject) return true;
    return false;
  });

  if (datasetMatches.length > 0) {
    return {
      questions: datasetMatches,
      source: "dataset_node_filter",
      canonicalNodeId,
      rawMatched: datasetMatches.length,
      subjectFiltered: datasetMatches.length,
    };
  }

  // Fallback: pyq_by_node index (only when dataset gives 0)
  const { pyqByNode, masterById } = loadPyqNodeIndexes();

  const ids =
    pyqByNode?.[canonicalNodeId]?.prelims ||
    pyqByNode?.[canonicalNodeId] ||
    [];

  let fromIndex = [];
  if (Array.isArray(ids) && ids.length) {
    fromIndex = ids.map((id) => masterById[id]).filter(Boolean);
  }

  if (fromIndex.length) {
    const filtered = resolvedSubject
      ? fromIndex.filter((q) => {
          if (resolveSubjectAlias(q.subject || "") === resolvedSubject) return true;
          if (resolveSubjectFromNodeId(q.nodeId || q.syllabusNodeId) === resolvedSubject) return true;
          return false;
        })
      : fromIndex;

    return {
      questions: filtered,
      source: "pyq_by_node_fallback",
      canonicalNodeId,
      rawMatched: fromIndex.length,
      subjectFiltered: filtered.length,
    };
  }

  return {
    questions: [],
    source: "no_match",
    canonicalNodeId,
    rawMatched: 0,
    subjectFiltered: 0,
  };
}

export function filterQuestionsByNodeId(questions = [], nodeId) {
  const canonicalNodeId = normalizePyqNodeId(nodeId);
  if (!canonicalNodeId) return [];

  return questions.filter((q) => getQuestionNodeId(q) === canonicalNodeId);
}