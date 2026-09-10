import fs from "fs";
import { isDeepStrictEqual } from "node:util";
import { getPhysicalExamIdentity, PHYSICAL_STAGE } from "./pyqPhysicalIdentity.js";
import { resolveMappingNode } from "./pyqMappingResolution.js";
import { loadCSATData } from "../data/loaders/csatLoader.js";
import { getCsatSourceConflictIndex, resetPyqSourceTrustCache } from "./pyqSourceTrust.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYQ_BY_NODE_PATH = path.join(
  __dirname,
  "../data/pyq_index/pyq_by_node.json"
);

const PYQ_MASTER_INDEX_PATH = path.join(
  __dirname,
  "../data/pyq_index/pyq_master_index.json"
);

// ---------------------------------------------------------
// LOAD INDEXES
// ---------------------------------------------------------

function safeReadJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[pyqLinkEngine] JSON read failed:", filePath, err.message);
    return fallback;
  }
}

const MAINS_QUESTIONS_DIR = path.join(__dirname, '../data/pyq_questions/mains');
export const TAGGED_MAINS_SPECS = [
  ...['art_culture', 'geography', 'history', 'society'].map(s => ({ file: 'mains_gs1_' + s + '_tagged.json', physicalPaper: 'MAINS_GS1' })),
  ...['governance', 'international_relations', 'polity', 'social_justice'].map(s => ({ file: 'mains_gs2_' + s + '_tagged.json', physicalPaper: 'MAINS_GS2' })),
  ...['agriculture', 'disaster_management', 'economy', 'environment', 'internal_security', 'science_tech'].map(s => ({ file: 'mains_gs3_' + s + '_tagged.json', physicalPaper: 'MAINS_GS3' })),
  { file: 'mains_gs4_ethics_tagged.json', physicalPaper: 'MAINS_GS4' },
  { file: 'mains_essay_tagged.json', physicalPaper: 'ESSAY' },
  { file: 'optional_geography_paper1_tagged.json', physicalPaper: 'OPTIONAL_P1' },
  { file: 'optional_geography_paper2_tagged.json', physicalPaper: 'OPTIONAL_P2' },
];
const BUCKET_STAGES = ['prelims', 'mains', 'csat', 'essay', 'ethics', 'optional'];

export function loadTaggedMainsDatasets(pyqByNodeMap = PYQ_BY_NODE, masterIndexMap = PYQ_MASTER_INDEX, specs = TAGGED_MAINS_SPECS) {
  const diagnostics = { conflicts: [], invalidRecords: [], fileErrors: [] };
  for (const spec of specs) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(MAINS_QUESTIONS_DIR, spec.file), 'utf8')); }
    catch (err) { diagnostics.fileErrors.push({ file: spec.file, error: err.message }); continue; }
    const items = Array.isArray(raw) ? raw : raw.questions || raw.topics || [];
    for (const item of items) {
      if (!item.id) { diagnostics.invalidRecords.push({ file: spec.file, reason: 'missing ID' }); continue; }
      const identity = getPhysicalExamIdentity(item, spec.physicalPaper);
      if (!identity.physicalPaper) { diagnostics.conflicts.push({ id: item.id, file: spec.file, ...identity }); continue; }
      const stage = PHYSICAL_STAGE[identity.physicalPaper];
      const nodeId = item.syllabusNodeId || item.nodeId || null;
      const record = {
        ...item, id: item.id, year: item.year || null,
        exam: item.exam || item.source || 'UPSC CSE', stage,
        physicalPaper: identity.physicalPaper,
        paper: item.paper || (identity.physicalPaper.startsWith('MAINS_') ? identity.physicalPaper.slice(6) : identity.physicalPaper),
        question: item.question || item.topic || '', syllabusNodeId: nodeId,
        sourceFile: item.sourceFile || spec.file,
      };
      const existing = masterIndexMap[item.id];
      if (existing && !isDeepStrictEqual(existing, record)) {
        diagnostics.conflicts.push({ id: item.id, file: spec.file, reason: 'duplicate ID with different record', existingIdentity: getPhysicalExamIdentity(existing), incomingIdentity: identity });
        continue;
      }
      if (!existing) masterIndexMap[item.id] = record;
      if (!nodeId) continue;
      const key = normalizeNodeId(nodeId);
      const bucket = pyqByNodeMap[key] ||= { total: 0, latestYear: null };
      for (const bucketStage of BUCKET_STAGES) bucket[bucketStage] = [...new Set(bucket[bucketStage] || [])];
      if (!bucket[stage].includes(item.id)) bucket[stage].push(item.id);
      bucket.total = new Set(BUCKET_STAGES.flatMap(k => bucket[k])).size;
      bucket.latestYear = Math.max(Number(bucket.latestYear) || 0, Number(item.year) || 0) || null;
    }
  }
  return diagnostics;
}

export function loadDedicatedCsatDataset(pyqByNodeMap = PYQ_BY_NODE, masterIndexMap = PYQ_MASTER_INDEX) {
  const conflicts = getCsatSourceConflictIndex();
  const diagnostics = { sourceUnique: 0, addedPhysicalIds: [], addedValidMappings: [], unresolvedSourceNodeIds: [], contentConflictIds: [...conflicts.keys()].sort() };
  const sourceQuestions = Object.values(loadCSATData()).flat();
  diagnostics.sourceUnique = new Set(sourceQuestions.map(q => q.id)).size;

  for (const source of sourceQuestions) {
    if (!source.id) continue;
    const conflict = conflicts.get(source.id);
    const existing = masterIndexMap[source.id];
    if (existing) {
      if (conflict) existing.sourceCertification = conflict;
      continue;
    }

    const nodeId = source.canonicalNodeId || source.nodeId || null;
    const record = {
      ...source,
      id: source.id,
      physicalPaper: "CSAT",
      stage: "csat",
      paper: "CSAT",
      question: source.question || source.questionText || "",
      syllabusNodeId: nodeId,
      nodeId,
      sourceFile: source.sourceFile || "dedicated-csat-loader",
      ...(conflict ? { sourceCertification: conflict } : {}),
    };
    masterIndexMap[source.id] = record;
    diagnostics.addedPhysicalIds.push(source.id);

    const resolution = nodeId ? resolveMappingNode(nodeId) : { valid: false };
    if (!resolution.valid) {
      diagnostics.unresolvedSourceNodeIds.push({ id: source.id, nodeId });
      continue;
    }
    const key = normalizeNodeId(nodeId);
    const bucket = pyqByNodeMap[key] ||= { total: 0, latestYear: null };
    for (const bucketStage of BUCKET_STAGES) bucket[bucketStage] = [...new Set(bucket[bucketStage] || [])];
    if (!bucket.csat.includes(source.id)) bucket.csat.push(source.id);
    bucket.total = new Set(BUCKET_STAGES.flatMap(stage => bucket[stage])).size;
    bucket.latestYear = Math.max(Number(bucket.latestYear) || 0, Number(source.year) || 0) || null;
    diagnostics.addedValidMappings.push({ id: source.id, nodeId: key });
  }
  return diagnostics;
}

let PYQ_BY_NODE = safeReadJson(PYQ_BY_NODE_PATH, {});
let PYQ_MASTER_INDEX = safeReadJson(PYQ_MASTER_INDEX_PATH, {});
let taggedLoadDiagnostics = loadTaggedMainsDatasets(PYQ_BY_NODE, PYQ_MASTER_INDEX);
let csatLoadDiagnostics = loadDedicatedCsatDataset(PYQ_BY_NODE, PYQ_MASTER_INDEX);

function reloadPyqIndexes() {
  PYQ_BY_NODE = safeReadJson(PYQ_BY_NODE_PATH, {});
  PYQ_MASTER_INDEX = safeReadJson(PYQ_MASTER_INDEX_PATH, {});
  taggedLoadDiagnostics = loadTaggedMainsDatasets(PYQ_BY_NODE, PYQ_MASTER_INDEX);
  resetPyqSourceTrustCache();
  csatLoadDiagnostics = loadDedicatedCsatDataset(PYQ_BY_NODE, PYQ_MASTER_INDEX);
  rebuildDerivedIndexes();
}

// ---------------------------------------------------------
// NORMALIZATION
// ---------------------------------------------------------

function normalizeNodeId(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitNodeId(nodeId) {
  return normalizeNodeId(nodeId).split("-").filter(Boolean);
}

function getAllParentPrefixes(nodeId) {
  const parts = splitNodeId(nodeId);
  const prefixes = [];

  for (let i = 1; i < parts.length; i += 1) {
    prefixes.push(parts.slice(0, i).join("-"));
  }

  return prefixes;
}
function getAncestorChainClosestFirst(nodeId) {
  const parts = splitNodeId(nodeId);
  const out = [];

  for (let i = parts.length - 1; i >= 1; i -= 1) {
    out.push(parts.slice(0, i).join("-"));
  }

  return out;
}

// ---------------------------------------------------------
// SUBJECT / FAMILY SAFETY
// ---------------------------------------------------------

function getFamilyAnchor(nodeId) {
  const normalized = normalizeNodeId(nodeId);
  if (!normalized) return "";

  // explicit alias-family harmonization
  if (normalized === "GS2-POLITY" || normalized.startsWith("GS2-POL-")) {
    return "GS2-POL";
  }

  if (
    normalized === "GS3-ENVIRONMENT" ||
    normalized === "GS3-ENV" ||
    normalized.startsWith("GS3-ENV-")
  ) {
    return "GS3-ENV";
  }

  if (
    normalized === "GS3-SCIENCE-AND-TECHNOLOGY" ||
    normalized === "GS3-SCIENCETECH" ||
    normalized === "GS3-SCIENCEANDTECH" ||
    normalized === "GS3-ST" ||
    normalized.startsWith("GS3-ST-")
  ) {
    return "GS3-ST";
  }

  if (
    normalized === "GS3-ECONOMY" ||
    normalized === "GS3-ECONICS" ||
    normalized === "GS3-ECO" ||
    normalized.startsWith("GS3-ECO-")
  ) {
    return "GS3-ECO";
  }

  if (
    normalized === "GS1-HISTORY" ||
    normalized === "GS1-HIS" ||
    normalized.startsWith("GS1-HIS-")
  ) {
    return "GS1-HIS";
  }

  if (
    normalized === "GS4-ETHICS" ||
    normalized === "GS4-ETH" ||
    normalized.startsWith("GS4-ETH-")
  ) {
    return "GS4-ETH";
  }

  if (
    normalized === "CSAT-NUMERACY" ||
    normalized === "CSAT-BASIC-NUMERACY" ||
    normalized === "CSAT-BN" ||
    normalized.startsWith("CSAT-BN-")
  ) {
    return "CSAT-BN";
  }

  if (
    normalized === "OPTIONAL-GEOGRAPHY" ||
    normalized === "GEOGRAPHY-OPTIONAL" ||
    normalized === "OPT-GEO" ||
    normalized.startsWith("OPT-GEO-")
  ) {
    return "OPT-GEO";
  }

  const parts = splitNodeId(normalized);
  if (!parts.length) return "";

  const [a, b] = parts;

  if (a === "ESSAY") return "ESSAY";
  if (a === "GS1" || a === "GS2" || a === "GS3" || a === "GS4") {
    return b ? `${a}-${b}` : a;
  }
  if (a === "CSAT") {
    return b ? `${a}-${b}` : a;
  }
  if (a === "OPT") {
    return b ? `${a}-${b}` : a;
  }

  return a;
}
function isSameFamilyAnchor(sourceId, candidateId) {
  const sourceAnchor = getFamilyAnchor(sourceId);
  const candidateAnchor = getFamilyAnchor(candidateId);

  if (!sourceAnchor || !candidateAnchor) return false;
  if (sourceAnchor === candidateAnchor) return true;

  const sourceParts = splitNodeId(sourceId);
  if (sourceParts.length === 1) {
    return (
      candidateId === sourceParts[0] ||
      candidateId.startsWith(`${sourceParts[0]}-`)
    );
  }

  return false;
}

// ---------------------------------------------------------
// DERIVED INDEXES
// ---------------------------------------------------------

let PYQ_NODE_KEYS = [];
let PYQ_NODE_KEY_SET = new Set();
let PREFIX_TO_DESCENDANT_PYQ_NODES = new Map();

function buildPrefixToDescendantPyqNodes(pyqNodeKeys) {
  const map = new Map();

  for (const rawKey of pyqNodeKeys) {
    const key = normalizeNodeId(rawKey);
    const prefixes = getAllParentPrefixes(key);

    for (const prefix of prefixes) {
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix).push(key);
    }
  }

  for (const [prefix, arr] of map.entries()) {
    const unique = Array.from(new Set(arr));
    unique.sort((a, b) => {
      const da = splitNodeId(a).length;
      const db = splitNodeId(b).length;
      if (da !== db) return da - db;
      return a.localeCompare(b);
    });
    map.set(prefix, unique);
  }

  return map;
}

function rebuildDerivedIndexes() {
  PYQ_NODE_KEYS = Object.keys(PYQ_BY_NODE || {}).map(normalizeNodeId);
  PYQ_NODE_KEY_SET = new Set(PYQ_NODE_KEYS);
  PREFIX_TO_DESCENDANT_PYQ_NODES = buildPrefixToDescendantPyqNodes(PYQ_NODE_KEYS);

  console.log("[pyqLinkEngine] indexes loaded");
  console.log("[pyqLinkEngine] pyq_by_node keys:", PYQ_NODE_KEYS.length);
  console.log(
    "[pyqLinkEngine] parent prefixes:",
    PREFIX_TO_DESCENDANT_PYQ_NODES.size
  );
}

rebuildDerivedIndexes();

// ---------------------------------------------------------
// SMALL HELPERS
// ---------------------------------------------------------

function pushUnique(arr, seen, value) {
  if (!value) return;
  if (seen.has(value)) return;
  seen.add(value);
  arr.push(value);
}

function getDescendantPyqNodeIds(prefixNodeId) {
  const key = normalizeNodeId(prefixNodeId);
  return PREFIX_TO_DESCENDANT_PYQ_NODES.get(key) || [];
}

function getBucketStageArrays(bucket) {
  if (!bucket || typeof bucket !== "object") {
    return {
      prelims: [],
      mains: [],
      ethics: [],
      essay: [],
      optional: [],
      csat: [],
    };
  }

  return {
    prelims: Array.isArray(bucket.prelims) ? bucket.prelims : [],
    mains: Array.isArray(bucket.mains) ? bucket.mains : [],
    ethics: Array.isArray(bucket.ethics) ? bucket.ethics : [],
    essay: Array.isArray(bucket.essay) ? bucket.essay : [],
    optional: Array.isArray(bucket.optional) ? bucket.optional : [],
    csat: Array.isArray(bucket.csat) ? bucket.csat : [],
  };
}

import { getAllDescendantLeafNodeIds } from "./unifiedSyllabusIndex.js";

// ---------------------------------------------------------
// PREFIX ALIAS CANONICALIZATION
// ---------------------------------------------------------
// Maps long-form node ID prefixes to their canonical short forms.
// These mirror the explicit alias cases in getFamilyAnchor so the
// resolver can handle inputs like GS2-POLITY-FR (user-facing label)
// that should map to GS2-POL-FR (actual index key).
// Keys must be already normalised (uppercase, hyphens only).
const PREFIX_ALIAS = {
  "GS1-HISTORY":                  "GS1-HIS",
  "GS1-GEOGRAPHY":                "GS1-GEO",
  "GS1-CULTURE":                  "GS1-CULT",
  "GS1-SOCIETY":                  "GS1-SOC",
  "GS2-POLITY":                   "GS2-POL",
  "GS2-GOVERNANCE":               "GS2-GOV",
  "GS2-INTERNATIONAL-RELATIONS":  "GS2-IR",
  "GS3-ECONOMY":                  "GS3-ECO",
  "GS3-ENVIRONMENT":              "GS3-ENV",
  "GS3-SCIENCE-AND-TECHNOLOGY":   "GS3-ST",
  "GS3-SCIENCETECH":              "GS3-ST",
  "GS3-SCIENCEANDTECH":           "GS3-ST",
  "GS3-SECURITY":                 "GS3-SEC",
  "GS4-ETHICS":                   "GS4-ETH",
  "CSAT-NUMERACY":                "CSAT-BN",
  "CSAT-BASIC-NUMERACY":          "CSAT-BN",
  "OPTIONAL-GEOGRAPHY":           "OPT-GEO",
  "GEOGRAPHY-OPTIONAL":           "OPT-GEO",
};

// Attempt to canonicalize the leading prefix of a node ID using PREFIX_ALIAS.
// Tries each prefix length (longest first) so compound subjects like
// GS3-SCIENCE-AND-TECHNOLOGY-AI collapse to GS3-ST-AI before GS3 alone is tried.
// Returns the canonical form if found, or the original node ID unchanged.
function tryCanonicalizePrefix(nodeId) {
  const parts = nodeId.split("-");
  const maxPrefixLen = Math.min(4, parts.length - 1);

  for (let len = maxPrefixLen; len >= 1; len--) {
    const prefix = parts.slice(0, len).join("-");
    const canonical = PREFIX_ALIAS[prefix];
    if (canonical && canonical !== prefix) {
      const rest = parts.slice(len);
      return rest.length > 0 ? `${canonical}-${rest.join("-")}` : canonical;
    }
  }

  return nodeId;
}

// ---------------------------------------------------------
// REWRITTEN SAFE RESOLVER FOR RETRIEVAL
// ---------------------------------------------------------
export function resolveInputToLookupNodeIds(inputId) {
  const normalizedInput = normalizeNodeId(inputId);
  if (!normalizedInput) return [];

  const canonicalIds = resolveMappingNode(normalizedInput).canonicalNodeIds;
  const lookup = new Set(PYQ_NODE_KEY_SET.has(normalizedInput) ? [normalizedInput] : []);
  // Broad alias mappings belong to their container, not to every child leaf.
  const nodes = new Set(canonicalIds.flatMap(id => [id, ...getAllDescendantLeafNodeIds(id)]));
  for (const id of nodes) if (PYQ_NODE_KEY_SET.has(id)) lookup.add(id);
  for (const alias of PYQ_NODE_KEYS) {
    const targets = resolveMappingNode(alias).canonicalNodeIds;
    if (targets.length && targets.every(id => nodes.has(id))) {
      if (PYQ_NODE_KEY_SET.has(normalizeNodeId(alias))) lookup.add(normalizeNodeId(alias));
    }
  }
  if (lookup.size) return [...lookup];
  if (canonicalIds.length) return canonicalIds;
  const canonical = tryCanonicalizePrefix(normalizedInput);
  if (canonical !== normalizedInput) return resolveInputToLookupNodeIds(canonical);
  return getDescendantPyqNodeIds(normalizedInput);
}

// ---------------------------------------------------------
// QUESTION COLLECTION
// ---------------------------------------------------------

function flattenQuestionIdsFromNodeBuckets(nodeIds = [], options = {}) {
  const {
    includePrelims = true,
    includeMains = true,
    includeEthics = true,
    includeEssay = true,
    includeOptional = true,
    includeCsat = true,
  } = options;

  const questionIds = [];
  const seen = new Set();

  for (const nodeId of nodeIds) {
    const bucket = PYQ_BY_NODE[nodeId];
    if (!bucket) continue;

    const stages = getBucketStageArrays(bucket);

    if (includePrelims) {
      for (const qid of stages.prelims) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }

    if (includeMains) {
      for (const qid of stages.mains) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }

    if (includeEthics) {
      for (const qid of stages.ethics) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }

    if (includeEssay) {
      for (const qid of stages.essay) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }

    if (includeOptional) {
      for (const qid of stages.optional) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }

    if (includeCsat) {
      for (const qid of stages.csat) {
        if (!seen.has(qid)) {
          seen.add(qid);
          questionIds.push(qid);
        }
      }
    }
  }

  return questionIds;
}
function humanizeTopicFromNodeId(nodeId = "") {
  const id = String(nodeId || "").toUpperCase();

  if (id.includes("MAURYA")) return "Mauryan Empire";
  if (id.includes("GUPTA")) return "Gupta Period";
  if (id.includes("VEDIC")) return "Vedic Period";
  if (id.includes("PREHIST")) return "Prehistory";
  if (id.includes("SANGAM")) return "Sangam Age";
  if (id.includes("JAIN")) return "Jainism";
  if (id.includes("IVC")) return "Indus Valley Civilization";

  if (id.includes("ANC")) return "Ancient History";
  if (id.includes("MED")) return "Medieval History";
  if (id.includes("MOD")) return "Modern History";
  if (id.includes("WORLD")) return "World History";
  if (id.includes("HIS")) return "History";

  if (id.includes("POL")) return "Polity";
  if (id.includes("CONST")) return "Constitution";
  if (id.includes("ECO")) return "Economy";
  if (id.includes("ENV")) return "Environment";
  if (id.includes("BIOTECH")) return "Biotechnology";
  if (id.includes("ST")) return "Science & Technology";

  if (id.includes("CSAT-BN")) return "Basic Numeracy";
  if (id.includes("CSAT-RC")) return "Reading Comprehension";
  if (id.includes("CSAT-LR")) return "Logical Reasoning";
  if (id.includes("CSAT")) return "CSAT";

  return "";
}
function hydrateQuestions(questionIds = [], fallbackNodeId = "") {
  return questionIds
    .map((qid) => {
      const source = PYQ_MASTER_INDEX[qid];
      if (!source) return null;
      const q = { ...source, physicalPaper: getPhysicalExamIdentity(source).physicalPaper };

      const topic =
        String(
          q?.topic ||
          q?.section ||
          q?.subtopic ||
          q?.microtheme ||
          q?.microTheme ||
          ""
        ).trim() || humanizeTopicFromNodeId(fallbackNodeId);

      return {
        ...q,
        topic,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const yA = Number(a?.year || 0);
      const yB = Number(b?.year || 0);
      return yB - yA;
    });
}

// ---------------------------------------------------------
// PUBLIC APIs
// ---------------------------------------------------------

export function getPyqsForTopic(inputNodeId, limit = 50, options = {}) {
  function hasAnyPyqBucket(nodeBucket) {
    if (!nodeBucket || typeof nodeBucket !== "object") return false;

    return (
      (Array.isArray(nodeBucket.prelims) && nodeBucket.prelims.length > 0) ||
      (Array.isArray(nodeBucket.mains) && nodeBucket.mains.length > 0) ||
      (Array.isArray(nodeBucket.essay) && nodeBucket.essay.length > 0) ||
      (Array.isArray(nodeBucket.ethics) && nodeBucket.ethics.length > 0) ||
      (Array.isArray(nodeBucket.optional) && nodeBucket.optional.length > 0) ||
      (Array.isArray(nodeBucket.csat) && nodeBucket.csat.length > 0)
    );
  }
  const lookupNodeIds = resolveInputToLookupNodeIds(inputNodeId);
  const qids = flattenQuestionIdsFromNodeBuckets(lookupNodeIds, options);
  const uniqueQids = Array.from(new Set(qids));
  const questions = hydrateQuestions(uniqueQids, inputNodeId);

  if (typeof limit === "number" && limit > 0) {
    return questions.slice(0, limit);
  }

  return questions;
}

export function getPyqById(questionId) {
  const id = String(questionId || "").trim();
  if (!id || !PYQ_MASTER_INDEX[id]) return null;
  return hydrateQuestions([id])[0] || null;
}

// Historical callers pass a block object whose primaryNodeId identifies the
// same syllabus target accepted by getPyqsForTopic(). This compatibility
// wrapper existed in the test contract but was never exported by the engine.
export function getPyqsForBlock(block = {}, limit = 50, options = {}) {
  const nodeId = block.primaryNodeId || block.syllabusNodeId || block.nodeId;
  return nodeId ? getPyqsForTopic(nodeId, limit, options) : [];
}

export function getPyqQuestionIdsForTopic(inputNodeId, options = {}) {
  const lookupNodeIds = resolveInputToLookupNodeIds(inputNodeId);
  return flattenQuestionIdsFromNodeBuckets(lookupNodeIds, options);
}

export function getPyqBucketsForTopic(inputNodeId) {
  const lookupNodeIds = resolveInputToLookupNodeIds(inputNodeId);

  return lookupNodeIds.map((nodeId) => ({
    nodeId,
    bucket: PYQ_BY_NODE[nodeId] || null,
  }));
}

function getQuestionStage(q = {}) {
  return PHYSICAL_STAGE[getPhysicalExamIdentity(q).physicalPaper] || '';
}

export function getPyqSummaryForNode(inputNodeId, limit = 50, options = {}) {
  const lookupNodeIds = resolveInputToLookupNodeIds(inputNodeId);
  const qids = flattenQuestionIdsFromNodeBuckets(lookupNodeIds, options);
  const uniqueQids = Array.from(new Set(qids));
  const questions = hydrateQuestions(uniqueQids, inputNodeId);

  const limitedQuestions =
    typeof limit === "number" && limit > 0
      ? questions.slice(0, limit)
      : questions;

  let prelimsCount = 0;
  let mainsCount = 0;
  let essayCount = 0;
  let ethicsCount = 0;
  let optionalCount = 0;
  let csatCount = 0;
  let lastAskedYear = null;

  for (const q of questions) {
    const stage = getQuestionStage(q);

    if (stage === "prelims") prelimsCount++;
    else if (stage === "mains") mainsCount++;
    else if (stage === "essay") essayCount++;
    else if (stage === "ethics") ethicsCount++;
    else if (stage === "optional") optionalCount++;
    else if (stage === "csat") csatCount++;

    const year = Number(q?.year || 0);
    if (year && (!lastAskedYear || year > lastAskedYear)) {
      lastAskedYear = year;
    }
  }

  return {
    syllabusNodeId: inputNodeId,
    matchedNodeId: lookupNodeIds[0] || null,
    lookupNodeIds,
    total: questions.length,
    lastAskedYear,
    frequency: questions.length,
    prelimsCount,
    mainsCount,
    essayCount,
    ethicsCount,
    optionalCount,
    csatCount,
    questions: limitedQuestions,
  };
}

export function getPyqCountForTopic(inputNodeId, options = {}) {
  const qids = getPyqQuestionIdsForTopic(inputNodeId, options);
  return qids.length;
}
export function explainPyqResolution(inputNodeId) {
  const normalized = normalizeNodeId(inputNodeId);
  const canonical = tryCanonicalizePrefix(normalized);
  const finalLookup = resolveInputToLookupNodeIds(normalized);

  return {
    input: inputNodeId,
    normalized,
    // present only when prefix canonicalization was applied (e.g. GS2-POLITY-FR → GS2-POL-FR)
    canonicalInput: canonical !== normalized ? canonical : undefined,
    finalLookupNodeIds: finalLookup,
  };
}
export function getPyqIndexesMeta() {
  return {
    pyqByNodePath: PYQ_BY_NODE_PATH,
    pyqMasterIndexPath: PYQ_MASTER_INDEX_PATH,
    pyqNodeKeyCount: PYQ_NODE_KEYS.length,
    prefixCount: PREFIX_TO_DESCENDANT_PYQ_NODES.size,
  };
}

export { reloadPyqIndexes };
export function getPyqRegistrySnapshot() {
  return structuredClone({ master: PYQ_MASTER_INDEX, byNode: PYQ_BY_NODE, diagnostics: taggedLoadDiagnostics, sourceDiagnostics: csatLoadDiagnostics });
}
