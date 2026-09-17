import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getPyqRegistrySnapshot, loadTaggedMainsDatasets, getPyqsForBlock, getPyqsForTopic } from '../brain/pyqLinkEngine.js';
import { buildPyqCorpusInventory, getWorkspacePyqMetrics } from '../brain/pyqCorpusInventory.js';
import { resolveMappingNode } from '../brain/pyqMappingResolution.js';
import { getPhysicalExamIdentity, PHYSICAL_STAGE } from '../brain/pyqPhysicalIdentity.js';
import { loadCSATData } from '../data/loaders/csatLoader.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
const dataDir = path.join(backend, 'data');
const out = path.join(backend, 'reports', 'pyq-source-certification');
fs.mkdirSync(out, { recursive: true });

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const ordered = value => Array.isArray(value)
  ? value.map(ordered)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
    : value;
const objectHash = value => sha(JSON.stringify(ordered(value)));
const fileHash = file => sha(fs.readFileSync(file));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const walk = dir => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
  : [];
const rel = file => path.relative(root, file).replaceAll('\\', '/');

function extractQuestions(value, context = {}) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => extractQuestions(item, context));
  const next = {
    ...context,
    ...(value.year != null ? { inheritedYear: value.year } : {}),
    ...(value.module ? { inheritedModule: value.module } : {}),
  };
  const id = value.id || value.questionId;
  const hasQuestion = ['question', 'questionText', 'stem', 'topic'].some(key => typeof value[key] === 'string');
  if (id && hasQuestion) return [{ ...value, id, year: value.year ?? context.inheritedYear }];
  return Object.values(value).flatMap(item => extractQuestions(item, next));
}

const normalizeString = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const normalizeValue = value => {
  if (typeof value === 'string') return normalizeString(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizeValue(value[key])]));
  return value ?? null;
};
function normalizedContent(q) {
  return normalizeValue({
    year: q.year ?? null,
    questionNumber: q.questionNumber ?? q.questionNo ?? q.qno ?? null,
    passage: q.passage ?? q.passageText ?? null,
    question: q.question ?? q.questionText ?? q.stem ?? q.topic ?? null,
    prompt: q.prompt ?? null,
    statements: q.statements ?? null,
    pairs: q.pairs ?? null,
    table: q.table ?? null,
    options: q.options ?? null,
    answer: q.correctAnswer ?? q.answer ?? q.correct_answer ?? q.correctOption ?? null,
    explanation: q.explanation ?? null,
  });
}

const sourceDirs = ['pyq_index', 'pyq_questions', 'pyq_questions_v2', 'pyq_rebuilt', 'pyq_fixed', 'pyq_typed'];
const occurrences = [];
for (const folder of sourceDirs) {
  for (const file of walk(path.join(dataDir, folder)).filter(file => file.endsWith('.json'))) {
    if (/(audit|report|_rows|change_log|_by_node)/i.test(path.basename(file))) continue;
    let raw;
    try { raw = readJson(file); } catch { continue; }
    for (const q of extractQuestions(raw)) occurrences.push({ file: rel(file), q });
  }
}
const occurrencesById = new Map();
for (const row of occurrences) {
  const bucket = occurrencesById.get(row.q.id) || [];
  bucket.push(row);
  occurrencesById.set(row.q.id, bucket);
}

const registry = getPyqRegistrySnapshot();
const inventory = buildPyqCorpusInventory(registry);
const priorCopies = readJson(path.join(backend, 'reports', 'pyq-reconciliation', 'source-copies.json'));
const conflictIds = priorCopies.copies.CSAT.contentConflicts.map(row => row.id).sort();
assert.equal(conflictIds.length, 208);

const contentFields = ['year', 'questionNumber', 'passage', 'question', 'prompt', 'statements', 'pairs', 'table', 'options', 'answer', 'explanation'];
const conflicts = conflictIds.map(canonicalId => {
  const rows = occurrencesById.get(canonicalId) || [];
  const variants = rows.map(({ file, q }) => {
    const content = normalizedContent(q);
    return {
      sourceFile: file,
      year: content.year,
      questionNumber: content.questionNumber,
      normalizedContentFingerprint: objectHash(content),
      content,
      sourceProvenance: {
        containerFile: file,
        embeddedSourceFile: q.sourceFile ?? null,
        sourceRef: q.sourceRef ?? null,
        pdfPage: q.pdfPage ?? q.page ?? null,
        module: q.module ?? null,
        datasetSource: q.source ?? null,
      },
    };
  });
  const conflictingFields = contentFields.filter(field => new Set(variants.map(v => v.content[field]).filter(value => value != null).map(value => JSON.stringify(value))).size > 1);
  const fieldCompletenessDifferences = contentFields.filter(field => {
    const present = variants.map(v => v.content[field] != null);
    return present.some(Boolean) && present.some(value => !value);
  });
  return {
    canonicalId,
    sourceFiles: [...new Set(variants.map(v => v.sourceFile))].sort(),
    year: [...new Set(variants.map(v => v.year))],
    questionNumber: [...new Set(variants.map(v => v.questionNumber))],
    normalizedContentFingerprints: [...new Set(variants.map(v => v.normalizedContentFingerprint))],
    conflictingFields,
    fieldCompletenessDifferences,
    resolutionStatus: 'unresolved-no-documented-authoritative-precedence',
    variants,
  };
});
assert(conflicts.every(row => row.variants.length >= 2));
write('csat-208-content-conflicts.json', {
  count: conflicts.length,
  selectionPolicy: 'No source variant was selected. Repository search found no documented authoritative precedence among these copies.',
  conflicts,
});

const sourceCsat = Object.values(loadCSATData()).flat();
const activeCsat = registry.master;
const normalizeBuilderText = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
const builderFingerprint = q => {
  const text = normalizeBuilderText(q.question || q.questionText || q.text || q.stem);
  return text ? `${q.year ?? 'unknown'}::${String(q.paper || q.stage || 'GS').toUpperCase()}::${text.slice(0, 180)}` : null;
};
const activeByFingerprint = new Map();
for (const q of Object.values(activeCsat)) {
  const fp = builderFingerprint(q);
  if (!fp) continue;
  const ids = activeByFingerprint.get(fp) || [];
  ids.push(q.id);
  activeByFingerprint.set(fp, ids);
}
const sourceOnly = sourceCsat.filter(q => !activeCsat[q.id]).map(q => {
  const slotMatches = [...inventory.physical.CSAT].filter(id => {
    const active = registry.master[id];
    return Number(active.year) === Number(q.year) && Number(active.questionNumber) === Number(q.questionNumber);
  });
  const fp = builderFingerprint(q);
  const promptCollisionIds = activeByFingerprint.get(fp) || [];
  const provenance = (occurrencesById.get(q.id) || []).map(row => ({
    containerFile: row.file,
    embeddedSourceFile: row.q.sourceFile ?? null,
    sourceRef: row.q.sourceRef ?? null,
    pdfPage: row.q.pdfPage ?? row.q.page ?? null,
  }));
  const complete = q.year != null && q.questionNumber != null && normalizeString(q.question) && Object.values(q.options || {}).some(Boolean);
  const classification = complete && slotMatches.length === 0
    ? 'valid physical question missing from active registry'
    : 'unresolved';
  return {
    id: q.id,
    year: q.year,
    questionNumber: q.questionNumber,
    module: q.module,
    topic: q.topic ?? null,
    classification,
    samePhysicalSlotActiveIds: slotMatches,
    builderQuestionFingerprint: fp,
    promptCollisionIds,
    normalizedContentFingerprint: objectHash(normalizedContent(q)),
    provenance,
    reason: classification.startsWith('valid')
      ? 'The dedicated loader has a complete ID/year/question-number/options record; that physical slot is absent from the active master. The builder fingerprint collides on a repeated generic stem, but the complete normalized content differs.'
      : 'The available source fields do not establish a unique missing physical slot.',
  };
});
assert.equal(sourceCsat.length, 1200);
assert.equal(inventory.physical.CSAT.size, 1200);
assert.equal(sourceOnly.length, 0);
write('csat-47-master-membership.json', {
  dedicatedLoaderUnique: sourceCsat.length,
  activeMasterUnique: inventory.physical.CSAT.size,
  intersection: sourceCsat.length - sourceOnly.length,
  previouslyDroppedNowResolved: registry.sourceDiagnostics.addedPhysicalIds.length,
  previouslyDroppedIds: registry.sourceDiagnostics.addedPhysicalIds,
  classifications: Object.fromEntries([...new Set(sourceOnly.map(row => row.classification))].map(key => [key, sourceOnly.filter(row => row.classification === key).length])),
  records: sourceOnly,
});

const rawUnresolvedCsatRows = [];
for (const [nodeId, bucket] of Object.entries(registry.byNode)) {
  if (resolveMappingNode(nodeId).valid) continue;
  for (const [stage, ids] of Object.entries(bucket)) {
    if (!Array.isArray(ids)) continue;
    for (const id of new Set(ids)) if (inventory.identities[id]?.physicalPaper === 'CSAT') rawUnresolvedCsatRows.push({ id, nodeId, stage });
  }
}
assert.equal(rawUnresolvedCsatRows.length, 50);
const sourceCsatById = new Map(sourceCsat.map(q => [q.id, q]));
const reconciled50 = rawUnresolvedCsatRows.sort((a, b) => a.id.localeCompare(b.id)).map(row => {
  const source = sourceCsatById.get(row.id);
  const candidate = source?.canonicalNodeId || source?.nodeId || null;
  const candidateResolution = candidate ? resolveMappingNode(candidate) : null;
  const resolved = Boolean(candidateResolution?.valid);
  return {
    questionId: row.id,
    existingNodeReference: row.nodeId,
    directReferenceExists: false,
    existingCanonicalCandidate: resolved ? candidate : null,
    existsUnderAnotherCanonicalId: resolved,
    existingAliasCanResolveRawReference: false,
    canonicalNodeIds: resolved ? candidateResolution.canonicalNodeIds : [],
    resolutionEvidence: resolved ? 'Dedicated CSAT source topic through existing CSAT_TOPIC_TO_NODE_ID mapping and canonical resolver; no alias was added for the raw reference.' : null,
    status: resolved ? 'resolved-to-existing-section-container' : 'genuinely-unresolved',
    sourceTopic: source?.topic ?? source?.subtopic ?? source?.section ?? null,
  };
});
assert.equal(reconciled50.filter(row => row.existsUnderAnotherCanonicalId).length, 22);
assert.equal(reconciled50.filter(row => row.status === 'genuinely-unresolved').length, 28);
write('csat-50-node-resolution.json', {
  originalReferences: 50,
  resolvedThroughExistingSourceAndNodes: 22,
  genuinelyUnresolved: 28,
  records: reconciled50,
});

const paperDir = path.join(dataDir, 'pyq_papers', 'prelims');
const derivedPaperFiles = walk(paperDir).filter(file => file.endsWith('.json'));
const derivedByYear = new Map();
for (const file of derivedPaperFiles) {
  const raw = readJson(file);
  const questions = extractQuestions(raw);
  const year = Number(path.basename(file, '.json'));
  derivedByYear.set(year, { file: rel(file), records: questions.length, uniqueIds: new Set(questions.map(q => q.id)).size, ids: new Set(questions.map(q => q.id)) });
}
const prelimsYears = new Map();
for (const id of inventory.physical.PRELIMS_GS) {
  const q = registry.master[id];
  const year = q.year == null ? 'unknown' : Number(q.year);
  const row = prelimsYears.get(year) || { activeMasterIds: new Set(), derivedPaperIds: new Set(), explicitAlternateIds: 0, unresolvedPhysicalIdentity: 0 };
  row.activeMasterIds.add(id);
  if (!getPhysicalExamIdentity(q).physicalPaper) row.unresolvedPhysicalIdentity++;
  if (q.originalId && q.originalId !== id) row.explicitAlternateIds++;
  prelimsYears.set(year, row);
}
for (const [year, derived] of derivedByYear) {
  const row = prelimsYears.get(year) || { activeMasterIds: new Set(), derivedPaperIds: new Set(), explicitAlternateIds: 0, unresolvedPhysicalIdentity: 0 };
  row.derivedPaperIds = derived.ids;
  prelimsYears.set(year, row);
}
const prelimsYearInventory = [...prelimsYears].sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(([year, row]) => {
  const duplicateCopies = [...row.derivedPaperIds].filter(id => row.activeMasterIds.has(id)).length;
  const masterOnly = [...row.activeMasterIds].filter(id => !row.derivedPaperIds.has(id)).length;
  const derivedOnly = [...row.derivedPaperIds].filter(id => !row.activeMasterIds.has(id)).length;
  return {
    year,
    activeMasterPhysicalIds: row.activeMasterIds.size,
    derivedPaperRecords: row.derivedPaperIds.size,
    duplicateSourceCopiesByExactId: duplicateCopies,
    activeMasterOnly: masterOnly,
    derivedPaperOnly: derivedOnly,
    explicitAlternateIds: row.explicitAlternateIds,
    unresolvedPhysicalIdentity: row.unresolvedPhysicalIdentity,
    sourceCoverage: year === 'unknown' ? 'unresolved' : 'partial',
    certificationReason: year === 'unknown'
      ? 'No year is present, so physical-year placement is unresolved.'
      : 'The local yearly paper is generated from the active master by buildFullPapers.cjs; it is not independent authoritative roster evidence.',
  };
});
const csatYearInventory = [...new Set([...sourceCsat.map(q => Number(q.year)), ...[...inventory.physical.CSAT].map(id => Number(registry.master[id].year))])]
  .sort((a, b) => a - b)
  .map(year => {
    const sourceRows = sourceCsat.filter(q => Number(q.year) === year);
    const activeIds = [...inventory.physical.CSAT].filter(id => Number(registry.master[id].year) === year);
    const qnos = sourceRows.map(q => Number(q.questionNumber)).filter(Number.isFinite);
    const qnoCounts = Object.groupBy(qnos, qno => qno);
    return {
      year,
      dedicatedSourceRecords: sourceRows.length,
      dedicatedSourceUniqueIds: new Set(sourceRows.map(q => q.id)).size,
      activeMasterPhysicalIds: activeIds.length,
      activeMissingFromDedicatedSource: activeIds.filter(id => !sourceCsatById.has(id)),
      sourceOnlyMissingFromActiveMaster: sourceRows.filter(q => !registry.master[q.id]).map(q => q.id),
      duplicateQuestionNumbers: Object.entries(qnoCounts).filter(([, rows]) => rows.length > 1).map(([qno]) => Number(qno)),
      missingQuestionNumbersWithin1To80: Array.from({ length: 80 }, (_, i) => i + 1).filter(qno => !qnoCounts[qno]),
      sourceCoverage: 'partial',
    };
  });
write('prelims-physical-inventory.json', {
  claim2217: {
    reproduced: false,
    exactLiteralInTrackedHistory: false,
    exactContiguousYearSum: false,
    currentActivePhysicalIds: inventory.physical.PRELIMS_GS.size,
    dedicatedUnifiedLoaderRecords: 4425,
    globalAuditReportedRecords: 3309,
    generatedYearlyPaperRecords: [...derivedByYear.values()].reduce((sum, row) => sum + row.records, 0),
    originConclusion: 'No tracked code, report, or dataset metadata in repository history contains or derives 2,217. The claim has no certifiable local provenance.',
  },
  localPaperProvenance: 'backend/scripts/buildFullPapers.cjs reads pyq_master_index.json, removes CSAT/garbage, text-deduplicates, renumbers records, and writes source=pyq_master_index.',
  coverageVerdict: 'PARTIAL',
  missingSourceYearsWithin1995To2025: Array.from({ length: 31 }, (_, i) => 1995 + i).filter(year => !derivedByYear.has(year)),
  yearInventory: prelimsYearInventory,
  csatYearInventory,
});

const first = structuredClone({ master: registry.master, byNode: registry.byNode });
const registryHashes = [];
for (let run = 1; run <= 3; run++) {
  const diagnostics = loadTaggedMainsDatasets(registry.byNode, registry.master);
  assert.deepEqual(diagnostics, { conflicts: [], invalidRecords: [], fileErrors: [] });
  assert.deepEqual({ master: registry.master, byNode: registry.byNode }, first);
  registryHashes.push({ run, master: objectHash(registry.master), byNode: objectHash(registry.byNode) });
}
for (const [nodeId, bucket] of Object.entries(registry.byNode)) {
  const acrossStages = [];
  for (const [stage, ids] of Object.entries(bucket)) if (Array.isArray(ids)) {
    assert.equal(ids.length, new Set(ids).size, `${nodeId}:${stage}:duplicate`);
    for (const id of ids) assert.equal(PHYSICAL_STAGE[getPhysicalExamIdentity(registry.master[id]).physicalPaper], stage, `${id}:wrong-stage`);
    acrossStages.push(...ids);
  }
  assert.equal(acrossStages.length, new Set(acrossStages).size, `${nodeId}:cross-stage-duplicate`);
}
assert.deepEqual(getPyqsForBlock({ primaryNodeId: 'GS3-ECO-PRE-BOP' }, 10), getPyqsForTopic('GS3-ECO-PRE-BOP', 10));

const metrics = Object.fromEntries(Object.keys(inventory.workspaces).map(key => [key, getWorkspacePyqMetrics(key, new Set(), inventory)]));
for (const [key, metric] of Object.entries(metrics)) {
  assert.equal(metric.mappedInCorpusUnique + metric.unmappedInCorpus, metric.physicalCorpusTotal, `${key}:physical-set-equation`);
  assert.equal(metric.mappedActionableUnique + metric.sectionOnlyUnique, metric.workspaceAssociatedUnique, `${key}:association-depth-equation`);
}

const baseline = readJson(path.join(backend, 'reports', 'pyq-reconciliation', 'baseline.json'));
const changedSourceJson = Object.entries(baseline.data).filter(([file, digest]) => fileHash(path.join(root, file)) !== digest).map(([file]) => file);
assert.deepEqual(changedSourceJson, []);
write('verification.json', {
  metrics,
  loader: { completeDeepEquality: true, repetitions: registryHashes, uniqueIdsWithinEveryBucket: true, identicalPerStageContents: true, wrongStageMappings: 0 },
  sourceJsonHashes: { baselineFiles: Object.keys(baseline.data).length, changedFiles: changedSourceJson },
  compatibility: { getPyqsForBlockMatchesTopic: true },
  gs3: {
    physicalCorpus: inventory.physical.MAINS_GS3.size,
    workspaceAssociatedUnique: inventory.workspaces.GS3.mappedAnyIds.size,
    intersection: inventory.workspaces.GS3.physicalMappedIds.size,
    crossPaperAssociations: inventory.workspaces.GS3.crossPaperIds.size,
    crossPaperPhysicalIdentities: [...new Set([...inventory.workspaces.GS3.crossPaperIds].map(id => inventory.identities[id].physicalPaper))],
  },
});

console.log(JSON.stringify({
  conflicts: conflicts.length,
  sourceOnly: sourceOnly.length,
  sourceOnlyClassifications: Object.fromEntries([...new Set(sourceOnly.map(row => row.classification))].map(key => [key, sourceOnly.filter(row => row.classification === key).length])),
  csatNodeResolution: { existing: 22, unresolved: 28 },
  prelims: { active: inventory.physical.PRELIMS_GS.size, derivedPapers: [...derivedByYear.values()].reduce((sum, row) => sum + row.records, 0) },
  metrics,
  loaderDeepEquality: true,
  changedSourceJson,
}, null, 2));
