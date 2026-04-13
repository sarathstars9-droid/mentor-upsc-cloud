import fs from "fs";
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

let PYQ_BY_NODE = safeReadJson(PYQ_BY_NODE_PATH, {});
let PYQ_MASTER_INDEX = safeReadJson(PYQ_MASTER_INDEX_PATH, {});

function reloadPyqIndexes() {
  PYQ_BY_NODE = safeReadJson(PYQ_BY_NODE_PATH, {});
  PYQ_MASTER_INDEX = safeReadJson(PYQ_MASTER_INDEX_PATH, {});
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

import { getNodeById, getAllDescendantLeafNodeIds, isLeafNode } from "./unifiedSyllabusIndex.js";

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

  // 1. Is it a known node in the registry?
  const node = getNodeById(normalizedInput);
  if (!node) {
    // Direct hit in PYQ index?
    if (PYQ_NODE_KEY_SET.has(normalizedInput)) return [normalizedInput];
    // Prefix-descendant lookup (handles mismatched naming schemes)
    const descendantsByPrefix = getDescendantPyqNodeIds(normalizedInput);
    if (descendantsByPrefix.length > 0) return descendantsByPrefix;
    // Subject prefix canonicalization: e.g. GS2-POLITY-FR → GS2-POL-FR.
    // Fires only when the above two paths both fail, so it never overrides
    // any node that already resolves correctly.
    const canonical = tryCanonicalizePrefix(normalizedInput);
    if (canonical !== normalizedInput) {
      const canonicalResult = resolveInputToLookupNodeIds(canonical);
      if (canonicalResult.length > 0) return canonicalResult;
    }
    return [];
  }

  // 2. If it's a leaf, just return it — but also try prefix descendants if it has no direct PYQ
  if (isLeafNode(normalizedInput)) {
    // Direct hit in PYQ index?
    if (PYQ_NODE_KEY_SET.has(normalizedInput)) return [normalizedInput];
    // Walk ancestor prefixes to find PYQ-keyed relatives (bridges naming gap)
    const parts = normalizedInput.split("-");
    for (let len = parts.length - 1; len >= 2; len--) {
      const prefix = parts.slice(0, len).join("-");
      const descendants = getDescendantPyqNodeIds(prefix);
      if (descendants.length > 0) return descendants;
    }
    return [normalizedInput]; // fallback to self even if not in index
  }

  // 3. If it's a parent, fetch all leaf descendants from registry.
  // The registry already guarantees they are strict children of this node, thus same subject.
  const leaves = getAllDescendantLeafNodeIds(normalizedInput);
  
  if (leaves.length === 0) {
    return [normalizedInput]; // Fallback to itself if no leaves
  }

  // Also include the parent itself just in case pyqs are mapped directly to it
  return Array.from(new Set([normalizedInput, ...leaves]));
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
      const q = PYQ_MASTER_INDEX[qid];
      if (!q) return null;

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
  const id = String(q?.id || "").trim().toUpperCase();
  const exam = String(q?.exam || "").trim().toLowerCase();
  const paper = String(q?.paper || "").trim().toLowerCase();
  const subject = String(q?.subject || "").trim().toLowerCase();

  // 1) ID PREFIX HAS HIGHEST PRIORITY
  if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) return "csat";
  if (id.startsWith("PRE_")) return "prelims";
  if (id.startsWith("ESSAY_")) return "essay";
  if (id.startsWith("ETH_")) return "ethics";
  if (id.startsWith("OPT_")) return "optional";
  if (id.startsWith("MAINS_") || id.startsWith("MAIN_")) return "mains";

  // support mains ids like GS1_2020_Q1, GS2_2019_Q3, etc.
  if (/^GS[1-4]_/.test(id)) {
    if (id.startsWith("GS4_")) return "ethics";
    return "mains";
  }

  // 2) EXAM FIELD NEXT
  if (
    exam === "prelims" ||
    exam === "mains" ||
    exam === "essay" ||
    exam === "ethics" ||
    exam === "optional" ||
    exam === "csat"
  ) {
    return exam;
  }

  // 3) PAPER FIELD LAST
  if (paper === "prelims") return "prelims";
  if (paper === "mains") return "mains";
  if (paper === "essay") return "essay";
  if (paper === "ethics") return "ethics";
  if (paper === "optional") return "optional";
  if (paper === "csat") return "csat";

  if (paper.includes("optional")) return "optional";
  if (paper === "gs4") return "ethics";

  if (
    (paper === "gs1" || paper === "gs2" || paper === "gs3") &&
    subject.includes("csat")
  ) {
    return "csat";
  }

  return "";
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
