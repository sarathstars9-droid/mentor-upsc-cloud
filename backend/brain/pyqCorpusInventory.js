import { getPyqRegistrySnapshot } from './pyqLinkEngine.js';
import { resolveMappingNode } from './pyqMappingResolution.js';
export { resolveMappingNode } from './pyqMappingResolution.js';
import { PHYSICAL_PAPERS, PHYSICAL_STAGE, getPhysicalExamIdentity } from './pyqPhysicalIdentity.js';
import { loadCSATData } from '../data/loaders/csatLoader.js';

export const WORKSPACE_PAPERS = { GS1: 'MAINS_GS1', GS2: 'MAINS_GS2', GS3: 'MAINS_GS3', GS4: 'MAINS_GS4', ESSAY: 'ESSAY', CSAT: 'CSAT', OPTIONAL_P1: 'OPTIONAL_P1', OPTIONAL_P2: 'OPTIONAL_P2' };
export function normalizeWorkspace(key = '') {
  return key.toUpperCase().replaceAll('-', '_').replace('OPTIONAL_PAPER', 'OPTIONAL_P');
}

export function buildPyqCorpusInventory(registry = getPyqRegistrySnapshot()) {
  const physical = Object.fromEntries(PHYSICAL_PAPERS.map(p => [p, new Set()]));
  const identities = {};
  const invalid = { questionIds: [], nodeIds: [], physicalIdentity: [], stage: [] };
  const workspaces = Object.fromEntries(Object.keys(WORKSPACE_PAPERS).map(p => [p, { associatedIds: new Set(), mappedAnyIds: new Set(), actionableIds: new Set(), invalidIds: new Set() }]));
  for (const [id, question] of Object.entries(registry.master)) {
    identities[id] = getPhysicalExamIdentity(question);
    const paper = identities[id].physicalPaper;
    if (paper) physical[paper].add(id);
    else invalid.physicalIdentity.push({ id, ...identities[id] });
  }
  // Some legacy CSAT buckets use provisional node names. The dedicated CSAT
  // source records already carry topic-derived node IDs through the existing
  // CSAT_TOPIC_TO_NODE_ID table. Use that per-question evidence only when the
  // bucket reference itself is unresolved, and still require the candidate to
  // resolve to an existing canonical syllabus node.
  const csatSourceNodes = new Map(
    Object.values(loadCSATData()).flat().map(q => [q.id, q.canonicalNodeId || q.nodeId || null]),
  );
  const mappings = [];
  for (const [nodeId, bucket] of Object.entries(registry.byNode)) {
    const bucketResolution = resolveMappingNode(nodeId);
    for (const [stage, ids] of Object.entries(bucket)) {
      if (!Array.isArray(ids)) continue;
      for (const id of new Set(ids)) {
        const question = registry.master[id];
        const sourceNodeId = !bucketResolution.valid && identities[id]?.physicalPaper === 'CSAT' ? csatSourceNodes.get(id) : null;
        const sourceResolution = sourceNodeId ? resolveMappingNode(sourceNodeId) : null;
        const resolution = sourceResolution?.valid ? sourceResolution : bucketResolution;
        const row = {
          id,
          nodeId,
          stage,
          physicalPaper: identities[id]?.physicalPaper || null,
          canonicalNodeIds: resolution.canonicalNodeIds,
          actionable: resolution.actionable,
          valid: resolution.valid,
          resolvedVia: sourceResolution?.valid ? 'existing-csat-source-node' : bucketResolution.valid ? 'bucket-node' : null,
          sourceNodeId: sourceResolution?.valid ? sourceNodeId : null,
        };
        mappings.push(row);
        if (!question) invalid.questionIds.push(row);
        if (!resolution.valid) invalid.nodeIds.push(row);
        if (question && !row.physicalPaper) invalid.physicalIdentity.push(row);
        if (row.physicalPaper && PHYSICAL_STAGE[row.physicalPaper] !== stage) invalid.stage.push(row);
        for (const workspace of resolution.workspaces) {
          const w = workspaces[workspace];
          if (!w) continue;
          if (!question || !row.physicalPaper) { w.invalidIds.add(id); continue; }
          w.associatedIds.add(id);
          w.mappedAnyIds.add(id);
          if (resolution.actionable) w.actionableIds.add(id);
          if (PHYSICAL_STAGE[row.physicalPaper] !== stage) w.invalidIds.add(id);
        }
        // Unresolved node mappings can only be attributed by physical corpus;
        // do not guess a syllabus workspace from node/subject keywords.
        if (!resolution.valid) for (const [workspace, paper] of Object.entries(WORKSPACE_PAPERS)) {
          if (paper === row.physicalPaper) workspaces[workspace].invalidIds.add(id);
        }
      }
    }
  }
  const linkedIds = new Set(mappings.map(row => row.id));
  for (const [key, workspace] of Object.entries(workspaces)) {
    workspace.corpusIds = new Set([...physical[WORKSPACE_PAPERS[key]], ...workspace.associatedIds]);
    workspace.physicalMappedIds = new Set([...physical[WORKSPACE_PAPERS[key]]].filter(id => workspace.mappedAnyIds.has(id)));
    workspace.crossPaperIds = new Set([...workspace.associatedIds].filter(id => identities[id].physicalPaper !== WORKSPACE_PAPERS[key]));
    workspace.sectionOnlyIds = new Set([...workspace.mappedAnyIds].filter(id => !workspace.actionableIds.has(id)));
    workspace.unmappedIds = new Set([...workspace.corpusIds].filter(id => !workspace.mappedAnyIds.has(id)));
    workspace.completelyUnmappedIds = new Set([...workspace.corpusIds].filter(id => !linkedIds.has(id)));
  }
  return { physical, identities, workspaces, invalid, mappings, loaderDiagnostics: registry.diagnostics };
}

export function getWorkspacePyqMetrics(key, attemptedIds = null, inventory = buildPyqCorpusInventory()) {
  const normalizedKey = normalizeWorkspace(key);
  const workspace = inventory.workspaces[normalizedKey];
  if (!workspace) return null;
  const physicalIds = inventory.physical[WORKSPACE_PAPERS[normalizedKey]];
  const physicalCorpusTotal = physicalIds.size;
  const mappedInCorpusUnique = workspace.physicalMappedIds.size;
  const unmappedInCorpus = physicalCorpusTotal - mappedInCorpusUnique;
  const attemptedUnique = attemptedIds === null ? null : [...new Set(attemptedIds)].filter(id => physicalIds.has(id)).length;
  const attemptCoverage = attemptedUnique === null ? null : physicalCorpusTotal > 0 ? Number(((attemptedUnique / physicalCorpusTotal) * 100).toFixed(1)) : 0;
  const mappingCoverage = physicalCorpusTotal > 0 ? Number(((mappedInCorpusUnique / physicalCorpusTotal) * 100).toFixed(1)) : 0;
  const orphanMappings = inventory.invalid.questionIds.filter(row => resolveMappingNode(row.nodeId).workspaces.includes(normalizedKey)).length;

  return {
    physicalCorpusTotal,
    mappedInCorpusUnique,
    unmappedInCorpus,
    orphanMappings,
    invalidNodeMappings: workspace.invalidIds.size,
    workspaceAssociatedUnique: workspace.mappedAnyIds.size,
    mappingCoverage,
    attemptCoverage,
    // Compatibility fields retain the same explicit meanings.
    corpusTotal: physicalCorpusTotal,
    associatedUniquePyqs: workspace.associatedIds.size,
    mappedAnyNodeUnique: workspace.mappedAnyIds.size,
    mappedActionableUnique: workspace.actionableIds.size,
    sectionOnlyUnique: workspace.sectionOnlyIds.size,
    unmappedUnique: unmappedInCorpus,
    completelyUnmappedUnique: workspace.completelyUnmappedIds.size,
    crossPaperAssociatedUnique: workspace.crossPaperIds.size,
    invalidMappings: workspace.invalidIds.size,
    attemptedUnique,
    pyqExposurePercent: attemptCoverage,
    attemptCoveragePercent: attemptCoverage,
    mappingCoveragePercent: mappingCoverage,
  };
}
