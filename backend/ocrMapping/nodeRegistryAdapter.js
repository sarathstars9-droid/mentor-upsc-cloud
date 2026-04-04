import {
  UNIFIED_SYLLABUS_INDEX,
  UNIFIED_NODES_BY_SUBJECT,
  getNodeById as rawGetNodeById,
  getAllDescendantLeafNodeIds,
} from "../brain/unifiedSyllabusIndex.js";

/**
 * Normalizes text for comparison
 */
function normalizeId(id) {
  return String(id || "").trim().toUpperCase();
}

/**
 * Returns all node objects for a given subject string
 */
export function getNodesBySubject(subjectId) {
  const normSubj = normalizeId(subjectId);
  // Match prefix like GS3-ECO or GS1-HIS
  return UNIFIED_SYLLABUS_INDEX.filter((node) => {
    const code = normalizeId(node.syllabusNodeId);
    if (!code) return false;
    
    // Direct matches for base subjects
    if (normSubj === "ECONOMY" || normSubj === "GS3-ECO") return code.startsWith("GS3-ECO");
    if (normSubj === "HISTORY" || normSubj === "GS1-HIS") return code.startsWith("GS1-HIS");
    if (normSubj === "SCIENCE_TECH" || normSubj === "GS3-ST") return code.startsWith("GS3-ST");
    if (normSubj === "POLITY" || normSubj === "GS2-POL") return code.startsWith("GS2-POL");
    if (normSubj === "GEOGRAPHY" || normSubj === "GS1-GEO") return code.startsWith("GS1-GEO");
    if (normSubj === "CULTURE" || normSubj === "GS1-CUL") return code.startsWith("GS1-CUL");
    if (normSubj === "ENVIRONMENT" || normSubj === "GS3-ENV") return code.startsWith("GS3-ENV");
    if (normSubj.startsWith("CSAT")) return code.startsWith("CSAT");
    
    // Fallback exact match or general startsWith
    if (code.startsWith(normSubj)) return true;
    
    // Check subjectKey or subjectGroup
    const sKey = String(node.subjectKey || "").toUpperCase();
    if (sKey === normSubj || sKey.includes(normSubj)) return true;
    
    return false;
  });
}

/**
 * Gets a node string ID and returns the node object from syllabus
 */
export function getNodeById(nodeId) {
  if (!nodeId) return null;
  return rawGetNodeById(nodeId);
}

/**
 * Returns all leaf descendants for a nodeId by tapping into unifiedSyllabusIndex
 */
export function getLeafDescendants(nodeId) {
  const leafIds = getAllDescendantLeafNodeIds(nodeId);
  return leafIds.map(id => getNodeById(id)).filter(Boolean);
}

/**
 * Extracts all valid aliases, keywords, and text fragments for matching a node
 */
export function getAliasesForNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return [];
  
  const tokens = [
    node.syllabusNodeId,
    node.microTheme,
    node.subtopic,
    node.topic,
    node.section,
    ...(node.keywords || []),
    ...(node.tags || []),
    ...(node.legacyIds || [])
  ];
  
  return Array.from(new Set(tokens.filter(Boolean).map(t => String(t).trim().toLowerCase())));
}

/**
 * Confirms if a specific nodeId belongs to a specific subjectId
 */
export function validateSubjectNodeMatch(subjectId, nodeId) {
  const normSubj = normalizeId(subjectId);
  const code = normalizeId(nodeId);
  if (!code) return false;

  if (normSubj.includes("ECONOMY") || normSubj === "GS3-ECO") return code.startsWith("GS3-ECO");
  if (normSubj.includes("HISTORY") || normSubj === "GS1-HIS") return code.startsWith("GS1-HIS");
  if (normSubj.includes("SCIENCE") || normSubj === "GS3-ST") return code.startsWith("GS3-ST");
  if (normSubj.includes("POLITY") || normSubj === "GS2-POL") return code.startsWith("GS2-POL");
  if (normSubj.includes("GEOGRAPHY") || normSubj === "GS1-GEO") return code.startsWith("GS1-GEO");
  if (normSubj.includes("ENVIRONMENT") || normSubj === "GS3-ENV") return code.startsWith("GS3-ENV");
  if (normSubj.includes("CULTURE") || normSubj === "GS1-CUL") return code.startsWith("GS1-CUL");
  if (normSubj.includes("CSAT") || normSubj === "CSAT") return code.startsWith("CSAT");

  return code.startsWith(normSubj);
}
