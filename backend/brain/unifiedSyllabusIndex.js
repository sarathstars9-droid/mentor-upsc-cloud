// backend/brain/unifiedSyllabusIndex.js
// ESM ONLY
// Canonical unified syllabus index loader
// Source of truth:
//   backend/data/syllabus_index/unified_nodes_master.json
//   backend/data/syllabus_index/unified_nodes_by_id.json
//   backend/data/syllabus_index/unified_nodes_by_subject.json
//   backend/data/syllabus_index/legacy_node_alias_map.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GS4_2026 } from "./syllabusGS4.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(BACKEND_DIR, "data", "syllabus_index");

const MASTER_FILE = path.join(DATA_DIR, "unified_nodes_master.json");
const BY_ID_FILE = path.join(DATA_DIR, "unified_nodes_by_id.json");
const BY_SUBJECT_FILE = path.join(DATA_DIR, "unified_nodes_by_subject.json");
const LEGACY_ALIAS_FILE = path.join(DATA_DIR, "legacy_node_alias_map.json");

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[unifiedSyllabusIndex] Failed to read ${filePath}`, err);
    return fallback;
  }
}

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&]/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(text = "") {
  return normalize(text).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  );
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSearchText(node) {
  return [
    node.syllabusNodeId,
    node.rootPaper,
    node.subject,
    node.section,
    node.topic,
    node.subtopic,
    node.microTheme,
    ...(node.tags || []),
    ...(node.keywords || []),
    ...(node.legacyIds || []),
    ...(node.pathParts || []),
  ]
    .filter(Boolean)
    .join(" | ");
}

function inferSubjectKey(node) {
  const s = normalizeLoose(node.subject || "");

  if (s === "history") return "history";
  if (s === "culture") return "culture";
  if (s === "geography") return "geography";
  if (s === "society") return "society";
  if (s === "polity") return "polity";
  if (s === "governance") return "governance";
  if (s === "internationalrelations" || s === "international relations") {
    return "international relations";
  }
  if (s === "economy") return "economy";
  if (s === "environment") return "environment and ecology";
  if (s === "sciencetech" || s === "science tech" || s === "science and technology") {
    return "science and technology";
  }
  if (s === "internalsecurity" || s === "internal security") return "internal security";
  if (s === "disastermanagement" || s === "disaster management") return "disaster management";
  if (s === "ethics") return "ethics";
  if (s === "essay") return "essay";
  if (s === "csat") return "csat";
  if (s === "geography optional") return "geography optional";

  return s || "unknown";
}

function inferGsPaper(node) {
  const root = String(node.rootPaper || "").toUpperCase();
  if (root.startsWith("GS1")) return "GS1";
  if (root.startsWith("GS2")) return "GS2";
  if (root.startsWith("GS3")) return "GS3";
  if (root.startsWith("GS4")) return "GS4";
  if (root.startsWith("CSAT")) return "CSAT";
  if (root.startsWith("ESSAY")) return "ESSAY";
  if (root.startsWith("OPTIONAL")) return "OPTIONAL";
  return null;
}

function inferSubjectGroup(node) {
  const root = String(node.rootPaper || "").toUpperCase();
  if (root.startsWith("CSAT")) return "csat";
  if (root.startsWith("ESSAY")) return "essay";
  if (root.startsWith("GS4")) return "ethics";
  if (root.startsWith("OPTIONAL")) return "optional";
  if (root.startsWith("GS")) return "gs";
  return "other";
}

function enrichNode(node) {
  const enriched = {
    ...node,
    code: node.syllabusNodeId,
    name: node.microTheme || node.subtopic || node.topic || node.section || node.subject || "",
    title: node.microTheme || node.subtopic || node.topic || "",
    sectionName: node.section || "",
    topicName: node.topic || "",
    subtopicName: node.subtopic || "",
    macroTheme: node.section || "",
    gsPaper: inferGsPaper(node),
    subjectKey: inferSubjectKey(node),
    subjectGroup: inferSubjectGroup(node),
    normalizedSubject: normalizeLoose(node.subject || ""),
    normalizedSection: normalizeLoose(node.section || ""),
    normalizedTopic: normalizeLoose(node.topic || ""),
    normalizedSubtopic: normalizeLoose(node.subtopic || ""),
    normalizedMicroTheme: normalizeLoose(node.microTheme || ""),
    normalizedKeywords: uniqueStrings((node.keywords || []).map(normalizeLoose)),
    normalizedLegacyIds: uniqueStrings((node.legacyIds || []).map(normalizeLoose)),
    searchableText: buildSearchText(node),
    searchableTextNormalized: normalizeLoose(buildSearchText(node)),
  };

  return enriched;
}

function buildLegacyLeafLookup(aliasMap = {}, byId = {}) {
  const out = {};

  for (const [legacyId, meta] of Object.entries(aliasMap)) {
    const canonicalIds = toArray(meta?.canonicalIds);
    const leafNodes = canonicalIds.map((id) => byId[id]).filter(Boolean);

    out[legacyId] = {
      ...meta,
      canonicalIds,
      primaryNodeId: meta?.primaryNodeId || canonicalIds[0] || null,
      leafNodes,
    };
  }

  return out;
}

function buildSubjectLookup(nodes = []) {
  const map = new Map();

  for (const node of nodes) {
    const keys = uniqueStrings([
      node.subjectKey,
      node.normalizedSubject,
      normalizeLoose(node.subject || ""),
    ]);

    for (const key of keys) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    }
  }

  return map;
}

function buildKeywordLookup(nodes = []) {
  const map = new Map();

  for (const node of nodes) {
    const tokens = uniqueStrings([
      node.normalizedSubject,
      node.normalizedSection,
      node.normalizedTopic,
      node.normalizedSubtopic,
      node.normalizedMicroTheme,
      ...node.normalizedKeywords,
      ...node.normalizedLegacyIds,
    ]);

    for (const token of tokens) {
      if (!token || token.length < 2) continue;
      if (!map.has(token)) map.set(token, []);
      map.get(token).push(node.syllabusNodeId);
    }
  }

  return map;
}

const masterJson = readJsonSafe(MASTER_FILE, { version: "missing", summary: {}, nodes: [] });
const byIdJson = readJsonSafe(BY_ID_FILE, {});
const bySubjectJson = readJsonSafe(BY_SUBJECT_FILE, {});
const legacyAliasJson = readJsonSafe(LEGACY_ALIAS_FILE, {});

const rawNodes = Array.isArray(masterJson?.nodes) ? masterJson.nodes : [];
const enrichedNodes = rawNodes.map(enrichNode);

const byIdFromMaster = Object.fromEntries(
  enrichedNodes.map((node) => [node.syllabusNodeId, node])
);

// Prefer enriched master-backed nodes over plain file copy
const mergedById = {};
for (const [id, node] of Object.entries(byIdJson || {})) {
  mergedById[id] = enrichNode(node);
}
for (const [id, node] of Object.entries(byIdFromMaster)) {
  mergedById[id] = node;
}

// ── GS4 syllabus registration ─────────────────────────────────────────────────
// syllabusGS4.js defines the canonical GS4 node tree but was never wired into
// the JSON-backed unified index. We flatten it here so that getNodeById() and
// expandCanonicalOrLegacyToLeafNodeIds() resolve GS4-ETH-* IDs correctly.
function flattenGS4Nodes(gs4) {
  const nodes = [];
  for (const section of gs4.sections || []) {
    for (const topic of section.topics || []) {
      nodes.push({
        syllabusNodeId: topic.id,
        rootPaper:      "GS4",
        subject:        "Ethics",
        section:        section.name,
        topic:          topic.name,
        subtopic:       "",
        microTheme:     (topic.microThemes || [])[0] || "",
        keywords:       topic.keywords || [],
        tags:           topic.tags || [],
        legacyIds:      [],
        pathParts:      [section.id, topic.id],
      });
      for (const sub of topic.subTopics || []) {
        nodes.push({
          syllabusNodeId: sub.id,
          rootPaper:      "GS4",
          subject:        "Ethics",
          section:        section.name,
          topic:          topic.name,
          subtopic:       sub.name,
          microTheme:     (sub.microThemes || [])[0] || "",
          keywords:       sub.keywords || [],
          tags:           sub.tags || [],
          legacyIds:      [],
          pathParts:      [section.id, topic.id, sub.id],
        });
      }
    }
  }
  return nodes;
}

for (const rawNode of flattenGS4Nodes(GS4_2026)) {
  if (!mergedById[rawNode.syllabusNodeId]) {
    mergedById[rawNode.syllabusNodeId] = enrichNode(rawNode);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const mergedBySubject = {};
for (const [subject, ids] of Object.entries(bySubjectJson || {})) {
  mergedBySubject[subject] = uniqueStrings(ids);
}

// Backfill subject buckets from nodes in case file is incomplete
for (const node of enrichedNodes) {
  const key = node.subject || "UNKNOWN";
  if (!mergedBySubject[key]) mergedBySubject[key] = [];
  mergedBySubject[key].push(node.syllabusNodeId);
}
for (const key of Object.keys(mergedBySubject)) {
  mergedBySubject[key] = uniqueStrings(mergedBySubject[key]).sort();
}

const legacyLeafLookup = buildLegacyLeafLookup(legacyAliasJson, mergedById);
const subjectLookup = buildSubjectLookup(enrichedNodes);
const keywordLookup = buildKeywordLookup(enrichedNodes);
const parentToChildrenMap = buildParentToChildrenMap(mergedById);
function buildParentToChildrenMap(nodesById = {}) {
  const out = new Map();

  for (const node of Object.values(nodesById || {})) {
    const pathParts = Array.isArray(node.pathParts) ? node.pathParts : [];
    const idsFromPath = pathParts
      .map((part) => {
        if (!part) return null;
        if (typeof part === "string") return part;
        return part.id || part.syllabusNodeId || null;
      })
      .filter(Boolean);

    for (let i = 0; i < idsFromPath.length - 1; i += 1) {
      const parentId = idsFromPath[i];
      const childId = idsFromPath[i + 1];

      if (!out.has(parentId)) out.set(parentId, new Set());
      out.get(parentId).add(childId);
    }
  }

  return out;
}
export const UNIFIED_SYLLABUS_VERSION = masterJson?.version || "missing";
export const UNIFIED_SYLLABUS_SUMMARY = masterJson?.summary || {};

export const UNIFIED_SYLLABUS_INDEX = enrichedNodes;
export const UNIFIED_NODES_BY_ID = mergedById;
export const UNIFIED_NODES_BY_SUBJECT = mergedBySubject;
export const LEGACY_NODE_ALIAS_MAP = legacyAliasJson;
export const LEGACY_NODE_LEAF_LOOKUP = legacyLeafLookup;
export const UNIFIED_SUBJECT_LOOKUP = subjectLookup;
export const UNIFIED_KEYWORD_LOOKUP = keywordLookup;
export const UNIFIED_PARENT_TO_CHILDREN = parentToChildrenMap;
export function getNodeById(nodeId) {
  return mergedById[nodeId] || null;
}

export function getNodesByIds(nodeIds = []) {
  return uniqueStrings(nodeIds)
    .map((id) => mergedById[id])
    .filter(Boolean);
}

export function getNodesBySubject(subject = "") {
  const key = normalizeLoose(subject);
  const nodes = subjectLookup.get(key) || [];
  return nodes.slice();
}

export function resolveLegacyNodeAlias(legacyId = "") {
  return legacyLeafLookup[legacyId] || null;
}

export function resolveToCanonicalNodeIds(idOrAlias = "") {
  if (!idOrAlias) return [];

  if (mergedById[idOrAlias]) return [idOrAlias];

  const alias = legacyLeafLookup[idOrAlias];
  if (alias?.canonicalIds?.length) {
    return alias.canonicalIds.slice();
  }

  return [];
}

export function searchUnifiedNodes(query = "", options = {}) {
  const normalizedQuery = normalizeLoose(query);
  if (!normalizedQuery) return [];

  const {
    subject = "",
    limit = 20,
    tags = [],
  } = options;

  const subjectKey = normalizeLoose(subject);
  const requestedTags = new Set(toArray(tags).map((x) => String(x).trim()).filter(Boolean));

  let pool = subjectKey ? getNodesBySubject(subjectKey) : enrichedNodes.slice();

  if (requestedTags.size) {
    pool = pool.filter((node) => (node.tags || []).some((tag) => requestedTags.has(tag)));
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  const scored = pool
    .map((node) => {
      let score = 0;
      const hay = node.searchableTextNormalized;

      if (hay === normalizedQuery) score += 200;
      if (node.normalizedMicroTheme === normalizedQuery) score += 160;
      if (node.normalizedSubtopic === normalizedQuery) score += 140;
      if (node.normalizedTopic === normalizedQuery) score += 120;
      if (node.normalizedSection === normalizedQuery) score += 100;
      if (node.normalizedSubject === normalizedQuery) score += 80;

      if (hay.includes(normalizedQuery)) score += 60;

      for (const token of queryTokens) {
        if (node.normalizedMicroTheme.includes(token)) score += 20;
        if (node.normalizedSubtopic.includes(token)) score += 16;
        if (node.normalizedTopic.includes(token)) score += 14;
        if (node.normalizedSection.includes(token)) score += 10;
        if (node.normalizedSubject.includes(token)) score += 8;
        if (node.normalizedKeywords.some((k) => k.includes(token))) score += 10;
        if (hay.includes(token)) score += 2;
      }

      return { node, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((x) => x.node);
}

export function getKeywordMatchedNodeIds(token = "") {
  const key = normalizeLoose(token);
  return keywordLookup.get(key)?.slice() || [];
}
export function getChildNodeIds(nodeId = "") {
  if (!nodeId) return [];
  return Array.from(parentToChildrenMap.get(nodeId) || []);
}

export function hasChildren(nodeId = "") {
  return getChildNodeIds(nodeId).length > 0;
}

export function isLeafNode(nodeId = "") {
  if (!nodeId) return false;
  return getChildNodeIds(nodeId).length === 0;
}

export function getAllDescendantLeafNodeIds(nodeId = "") {
  if (!nodeId) return [];

  const canonicalIds = resolveToCanonicalNodeIds(nodeId);
  const seeds = canonicalIds.length ? canonicalIds : [nodeId];

  const leafSet = new Set();
  const visited = new Set();

  function dfs(currentId) {
    if (!currentId || visited.has(currentId)) return;
    visited.add(currentId);

    const node = getNodeById(currentId);
    if (!node) return;

    const children = getChildNodeIds(currentId);

    if (!children.length) {
      leafSet.add(currentId);
      return;
    }

    for (const childId of children) {
      dfs(childId);
    }
  }

  for (const seedId of seeds) {
    dfs(seedId);
  }

  return Array.from(leafSet);
}

export function expandCanonicalOrLegacyToLeafNodeIds(nodeIdOrAlias = "") {
  if (!nodeIdOrAlias) return [];

  const canonicalIds = resolveToCanonicalNodeIds(nodeIdOrAlias);
  const seeds = canonicalIds.length ? canonicalIds : [nodeIdOrAlias];

  const out = new Set();

  for (const seedId of seeds) {
    const leafIds = getAllDescendantLeafNodeIds(seedId);
    if (leafIds.length) {
      for (const id of leafIds) out.add(id);
    } else if (getNodeById(seedId)) {
      out.add(seedId);
    }
  }

  return Array.from(out);
}
console.log("[unifiedSyllabusIndex] loaded", {
  version: UNIFIED_SYLLABUS_VERSION,
  totalNodes: UNIFIED_SYLLABUS_INDEX.length,
  subjects: Object.keys(UNIFIED_NODES_BY_SUBJECT).length,
});