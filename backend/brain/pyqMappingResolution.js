import { getNodeById, resolveToCanonicalNodeIds, isLeafNode } from './unifiedSyllabusIndex.js';
import { normalizePyqNodeId } from './pyqNodeAliasMap.js';
import OPTIONAL from './syllabusOptional.js';
import { CSAT_2026 } from './syllabusCSAT.js';
import { ESSAY_2026 } from './syllabusEssay.js';

// These existing syllabus containers are not all materialized in the generated
// microtheme index. Register their identity for browsing, never as new leaf links.
const containers = {};
function collect(tree, rootPaper) {
  for (const section of tree.sections || []) {
    const visit = (node, pathParts) => {
      containers[node.id] = { syllabusNodeId: node.id, name: node.name, rootPaper, section: section.name, pathParts, isContainer: true };
      for (const child of [...(node.topics || []), ...(node.subTopics || [])]) visit(child, [...pathParts, child.id]);
    };
    visit(section, [section.id]);
  }
}
collect(OPTIONAL.Paper1, 'OPTIONAL_P1');
collect(OPTIONAL.Paper2, 'OPTIONAL_P2');
collect(CSAT_2026, 'CSAT');
collect(ESSAY_2026, 'ESSAY');

export function resolveMappingNode(rawId) {
  let canonicalNodeIds = resolveToCanonicalNodeIds(rawId).filter(id => getNodeById(id));
  if (!canonicalNodeIds.length) canonicalNodeIds = resolveToCanonicalNodeIds(normalizePyqNodeId(rawId)).filter(id => getNodeById(id));
  const container = !canonicalNodeIds.length ? containers[rawId] : null;
  if (container) canonicalNodeIds = [rawId];
  const canonicalNodes = canonicalNodeIds.map(id => getNodeById(id) || containers[id]);
  const actionable = !container && canonicalNodeIds.length === 1 && isLeafNode(canonicalNodeIds[0]);
  return {
    canonicalNodeIds, actionable, valid: canonicalNodeIds.length > 0,
    workspaces: [...new Set(canonicalNodes.map(n => (n.rootPaper || n.paperKey || '').toUpperCase().replaceAll('-', '_').replace('OPTIONAL_PAPER', 'OPTIONAL_P')))],
    node: getNodeById(rawId) || container || (canonicalNodes.length ? { ...canonicalNodes[0], syllabusNodeId: rawId, name: rawId, microTheme: '', isContainer: !actionable } : null),
  };
}
