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

// ---------------------------------------------------------
// SAFE CANONICAL RESOLUTION
// ---------------------------------------------------------

const LEGACY_ALIAS_TO_CANONICAL = {
  "GS3-ECONOMY": "GS3-ECO",
  "GS3-ECONICS": "GS3-ECO",
  "GS3-SCIENCEANDTECH": "GS3-ST",
  "GS3-SCIENCE-AND-TECHNOLOGY": "GS3-ST",
  "GS3-SCIENCETECH": "GS3-ST",
  "GS2-POLITY": "GS2-POL",
  "GS1-HISTORY": "GS1-HIS",
  "GS4-ETHICS": "GS4-ETH",
  "CSAT-NUMERACY": "CSAT-BN",
  "CSAT-BASIC-NUMERACY": "CSAT-BN",
  "OPTIONAL-GEOGRAPHY": "OPT-GEO",
  "GEOGRAPHY-OPTIONAL": "OPT-GEO",
};

export function resolveToCanonicalNodeIds(inputId) {
  const normalized = normalizeNodeId(inputId);
  if (!normalized) return [];

  const out = [];
  const seen = new Set();

  pushUnique(out, seen, normalized);

  const aliasHit = LEGACY_ALIAS_TO_CANONICAL[normalized];
  if (aliasHit) {
    pushUnique(out, seen, normalizeNodeId(aliasHit));
  }

  if (normalized === "GS1HIS") pushUnique(out, seen, "GS1-HIS");
  if (normalized === "GS2POL") pushUnique(out, seen, "GS2-POL");
  if (normalized === "GS3ST") pushUnique(out, seen, "GS3-ST");
  if (normalized === "GS3ECO") pushUnique(out, seen, "GS3-ECO");
  if (normalized === "GS4ETH") pushUnique(out, seen, "GS4-ETH");
  if (normalized === "CSATBN") pushUnique(out, seen, "CSAT-BN");
  if (normalized === "OPTGEO") pushUnique(out, seen, "OPT-GEO");

  return out;
}

// ---------------------------------------------------------
// CANONICAL / LEGACY → LEAF EXPANSION
// ---------------------------------------------------------

export function expandCanonicalOrLegacyToLeafNodeIds(nodeIds = []) {
  const out = [];
  const seen = new Set();

  for (const rawId of nodeIds) {
    const nodeId = normalizeNodeId(rawId);
    if (!nodeId) continue;

    if (PYQ_NODE_KEY_SET.has(nodeId)) {
      pushUnique(out, seen, nodeId);
    }

    const descendants = getDescendantPyqNodeIds(nodeId);
    for (const childId of descendants) {
      pushUnique(out, seen, childId);
    }
  }

  return out;
}

// ---------------------------------------------------------
// FINAL GENERIC RESOLVER
// ---------------------------------------------------------

export function resolveInputToLookupNodeIds(inputId) {
  const normalizedInput = normalizeNodeId(inputId);
  if (!normalizedInput) return [];

  const resolved = [];
  const seen = new Set();

  const directCandidates = [normalizedInput];

  let canonicalCandidates = [];
  try {
    canonicalCandidates = resolveToCanonicalNodeIds(normalizedInput)
      .map(normalizeNodeId)
      .filter(Boolean);
  } catch (err) {
    console.error(
      "[pyqLinkEngine] resolveToCanonicalNodeIds failed:",
      err.message
    );
    canonicalCandidates = [];
  }

  const expandedCanonicalLeafs = expandCanonicalOrLegacyToLeafNodeIds(
    canonicalCandidates
  ).map(normalizeNodeId).filter(Boolean);

  const familySeeds = [
    normalizedInput,
    ...canonicalCandidates,
    ...expandedCanonicalLeafs,
  ].filter(Boolean);

  const belongsToAllowedFamily = (candidateId) =>
    familySeeds.some((seed) => isSameFamilyAnchor(seed, candidateId));

  const seedIds = [
    ...directCandidates,
    ...canonicalCandidates,
    ...expandedCanonicalLeafs,
  ]
    .map(normalizeNodeId)
    .filter(Boolean);

  // 1) exact + descendants
  for (const seedId of seedIds) {
    if (!belongsToAllowedFamily(seedId)) continue;

    if (PYQ_NODE_KEY_SET.has(seedId)) {
      pushUnique(resolved, seen, seedId);
    }

    const descendants = getDescendantPyqNodeIds(seedId);
    for (const childId of descendants) {
      if (!belongsToAllowedFamily(childId)) continue;
      pushUnique(resolved, seen, childId);
    }
  }

  // 2) closest ancestor fallback
  if (!resolved.length) {
    const ancestorSeeds = [];
    const ancestorSeen = new Set();

    for (const seedId of seedIds) {
      const ancestors = getAncestorChainClosestFirst(seedId);

      for (const anc of ancestors) {
        if (!belongsToAllowedFamily(anc)) continue;
        if (ancestorSeen.has(anc)) continue;
        ancestorSeen.add(anc);
        ancestorSeeds.push(anc);
      }
    }

    for (const ancestorId of ancestorSeeds) {
      if (PYQ_NODE_KEY_SET.has(ancestorId)) {
        pushUnique(resolved, seen, ancestorId);
      }

      const descendants = getDescendantPyqNodeIds(ancestorId);
      for (const childId of descendants) {
        if (!belongsToAllowedFamily(childId)) continue;
        pushUnique(resolved, seen, childId);
      }

      if (resolved.length) break;
    }
  }

  // 3) final broad fallback scan
  if (!resolved.length) {
    for (const nodeId of PYQ_NODE_KEY_SET) {
      if (belongsToAllowedFamily(nodeId)) {
        pushUnique(resolved, seen, nodeId);
      }
    }
  }

  return resolved;
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

function hydrateQuestions(questionIds = []) {
  return questionIds
    .map((qid) => PYQ_MASTER_INDEX[qid])
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
  const questions = hydrateQuestions(uniqueQids);

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
  const questions = hydrateQuestions(uniqueQids);

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
  const canonical = resolveToCanonicalNodeIds(normalized);
  const expanded = expandCanonicalOrLegacyToLeafNodeIds(canonical);
  const ancestors = getAncestorChainClosestFirst(normalized);
  const finalLookup = resolveInputToLookupNodeIds(normalized);

  return {
    input: inputNodeId,
    normalized,
    familyAnchor: getFamilyAnchor(normalized),
    canonicalCandidates: canonical,
    expandedCanonicalLeafs: expanded,
    ancestors,
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
