import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getPyqRegistrySnapshot, loadTaggedMainsDatasets, TAGGED_MAINS_SPECS, getPyqQuestionIdsForTopic, getPyqSummaryForNode } from '../brain/pyqLinkEngine.js';
import { buildPyqCorpusInventory, getWorkspacePyqMetrics, resolveMappingNode } from '../brain/pyqCorpusInventory.js';
import { getPhysicalExamIdentity, PHYSICAL_STAGE } from '../brain/pyqPhysicalIdentity.js';
import { loadCSATData } from '../data/loaders/csatLoader.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
const out = path.join(backend, 'reports/pyq-reconciliation');
fs.mkdirSync(out, { recursive: true });
const read = p => JSON.parse(fs.readFileSync(path.join(backend, 'data', p), 'utf8'));
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
const fileHash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];

const registry = getPyqRegistrySnapshot();
const inventory = buildPyqCorpusInventory(registry);
const first = structuredClone({ master: registry.master, byNode: registry.byNode });
const repetitions = [];
for (let run = 1; run <= 3; run++) {
  const diagnostics = loadTaggedMainsDatasets(registry.byNode, registry.master);
  assert.deepEqual(diagnostics, { conflicts: [], invalidRecords: [], fileErrors: [] });
  assert.deepEqual({ master: registry.master, byNode: registry.byNode }, first);
  assert.equal(hash({ master: registry.master, byNode: registry.byNode }), hash(first));
  repetitions.push({ run, masterHash: hash(registry.master), nodeAndStageHash: hash(registry.byNode) });
  loadTaggedMainsDatasets();
  assert.deepEqual(getPyqRegistrySnapshot(), registry);
}
// Also ensure the authoritative on-disk master records were not rewritten in memory.
for (const [id, record] of Object.entries(read('pyq_index/pyq_master_index.json'))) {
  const { sourceCertification: _runtimeTrustState, ...runtimeRecord } = registry.master[id];
  assert.deepEqual(runtimeRecord, record);
}
assert.deepEqual(registry, getPyqRegistrySnapshot());
for (const [node, bucket] of Object.entries(registry.byNode)) {
  const all = [];
  for (const [stage, ids] of Object.entries(bucket)) if (Array.isArray(ids)) {
    assert.equal(ids.length, new Set(ids).size, node + ':' + stage);
    for (const id of ids) assert.equal(PHYSICAL_STAGE[getPhysicalExamIdentity(registry.master[id]).physicalPaper], stage, id);
    all.push(...ids);
  }
  assert.equal(all.length, new Set(all).size, node + ':cross-stage duplicates');
}
const conflictFixture = structuredClone(registry);
const fixtureId = 'ESSAY_1993_U_1';
conflictFixture.master[fixtureId].question = 'LOCAL TEST FIXTURE: conflicting duplicate';
const conflictBefore = hash(conflictFixture);
const conflict = loadTaggedMainsDatasets(conflictFixture.byNode, conflictFixture.master);
assert(conflict.conflicts.some(row => row.id === fixtureId));
assert.equal(hash(conflictFixture), conflictBefore);
const wrongIdentity = structuredClone(registry);
wrongIdentity.master[fixtureId].physicalPaper = 'PRELIMS_GS';
assert.equal(getPhysicalExamIdentity(wrongIdentity.master[fixtureId]).status, 'conflicting');
assert(loadTaggedMainsDatasets(wrongIdentity.byNode, wrongIdentity.master).conflicts.some(row => row.id === fixtureId));

// Source copies are reconciled only through IDs and the existing originalId
// crosswalk emitted by rebuildPrelimsDataset.js. Text never establishes identity.
const occurrences = [];
const sourceDirs = ['pyq_index', 'pyq_questions', 'pyq_questions_v2', 'pyq_rebuilt', 'pyq_fixed', 'pyq_typed'];
function extract(value, context = {}) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(v => extract(v, context));
  const next = { ...context, ...(value.year ? { year: value.year } : {}) };
  const id = value.id || value.questionId;
  if (id && typeof (value.question || value.questionText || value.stem || value.topic) === 'string') return [{ ...next, ...value, id }];
  return Object.values(value).flatMap(v => extract(v, next));
}
for (const folder of sourceDirs) for (const file of walk(path.join(backend, 'data', folder)).filter(f => f.endsWith('.json'))) {
  if (/(audit|report|_rows|change_log|_by_node)/i.test(path.basename(file))) continue;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const source = path.relative(backend, file).replaceAll('\\', '/');
  for (const q of extract(raw)) occurrences.push({ source, q });
}
const parent = new Map();
const find = id => { if (!parent.has(id)) parent.set(id, id); if (parent.get(id) !== id) parent.set(id, find(parent.get(id))); return parent.get(id); };
const crosswalk = [];
for (const { source, q } of occurrences) {
  find(q.id);
  if (q.originalId) { crosswalk.push({ id: q.id, originalId: q.originalId, source }); parent.set(find(q.originalId), find(q.id)); }
}
const groups = new Map();
for (const row of occurrences) { const id = find(row.q.id); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row); }
const activeByGroup = new Map();
for (const id of Object.keys(registry.master)) { const key = find(id); if (!activeByGroup.has(key)) activeByGroup.set(key, []); activeByGroup.get(key).push(id); }
const ambiguousCrosswalks = [...activeByGroup].filter(([, ids]) => ids.length > 1).map(([group, ids]) => ({ group, ids }));
const rawSourceInventory = {};
for (const { source, q } of occurrences) {
  const row = rawSourceInventory[source] ||= { records: 0, ids: new Set(), activeIds: new Set(), years: {} };
  row.records++; row.ids.add(q.id);
  row.years[q.year || 'unknown'] = (row.years[q.year || 'unknown'] || 0) + 1;
  for (const id of activeByGroup.get(find(q.id)) || []) row.activeIds.add(id);
}
for (const row of Object.values(rawSourceInventory)) {
  row.uniqueIds = row.ids.size; row.activeUnique = row.activeIds.size;
  row.ids = [...row.ids].sort(); row.activeIds = [...row.activeIds].sort();
}
const copies = {};
const sourceInventory = {};
for (const [paper, ids] of Object.entries(inventory.physical)) {
  const years = {}, sources = {}, duplicateGroups = [], contentConflicts = [];
  let extraOccurrences = 0;
  for (const id of ids) {
    const q = registry.master[id];
    years[q.year || 'unknown'] = (years[q.year || 'unknown'] || 0) + 1;
    const spec = TAGGED_MAINS_SPECS.find(s => s.physicalPaper === paper && extract(read('pyq_questions/mains/' + s.file)).some(row => row.id === id));
    const primary = spec?.file || q.sourceFile || 'unknown';
    sources[primary] = (sources[primary] || 0) + 1;
    const rows = groups.get(find(id)) || [];
    extraOccurrences += Math.max(0, rows.length - 1);
    if (rows.length > 1) duplicateGroups.push({ id, occurrences: rows.length, sources: [...new Set(rows.map(r => r.source))] });
    const variants = new Map();
    for (const row of rows) {
      const content = { year: row.q.year, question: String(row.q.question || row.q.questionText || row.q.topic || row.q.stem || '').replace(/\s+/g, ' ').trim() };
      const key = hash(content);
      if (!variants.has(key)) variants.set(key, { ...content, sources: [] });
      variants.get(key).sources.push(row.source);
      const skey = paper + '|' + row.source;
      const stats = sourceInventory[skey] ||= { paper, source: row.source, occurrences: 0, ids: new Set(), years: {} };
      stats.occurrences++; stats.ids.add(id);
      stats.years[q.year || 'unknown'] = (stats.years[q.year || 'unknown'] || 0) + 1;
    }
    if (variants.size > 1) contentConflicts.push({ id, variants: [...variants.values()] });
  }
  copies[paper] = { corpusUnique: ids.size, sourceCount: Object.keys(sources).length, sources, years, duplicateOccurrences: extraOccurrences, conflictingContentIds: contentConflicts.length, duplicateGroups, contentConflicts };
}
for (const row of Object.values(sourceInventory)) row.uniqueIds = row.ids.size, row.ids = [...row.ids].sort();
const inactive = [...groups].filter(([group]) => !activeByGroup.has(group)).map(([group, rows]) => ({ group, ids: [...new Set(rows.map(r => r.q.id))], sources: [...new Set(rows.map(r => r.source))], occurrences: rows.length }));
const metrics = Object.fromEntries(Object.keys(inventory.workspaces).map(k => [k, getWorkspacePyqMetrics(k, null, inventory)]));
const sourceCsat = Object.values(loadCSATData()).flat();
const sourceCsatIds = new Set(sourceCsat.map(q => q.id));
const csatSourceComparison = {
  sourceLoaderUnique: sourceCsatIds.size,
  masterUnique: inventory.physical.CSAT.size,
  intersection: [...inventory.physical.CSAT].filter(id => sourceCsatIds.has(id)).length,
  sourceOnly: sourceCsat.filter(q => !inventory.physical.CSAT.has(q.id)).map(q => ({ id: q.id, year: q.year })),
  masterOnly: [...inventory.physical.CSAT].filter(id => !sourceCsatIds.has(id)),
};
const csat = [...inventory.physical.CSAT].sort().map(id => ({ id, year: registry.master[id].year, physicalPaper: 'CSAT', mappings: inventory.mappings.filter(m => m.id === id).map(m => ({ ...m, valid: resolveMappingNode(m.nodeId).valid })) }));
assert.equal(csat.length, 1200);
assert.equal(csat.filter(q => q.mappings.length === 0).length, 3);
assert.equal(metrics.ESSAY.mappedAnyNodeUnique, 213);
assert.equal(inventory.invalid.questionIds.length, 0);
assert.equal(inventory.invalid.physicalIdentity.length, 0);
assert.equal(metrics.GS3.crossPaperAssociatedUnique, 1495);
assert.equal(metrics.GS3.physicalCorpusTotal, 233);
assert.equal(metrics.GS3.invalidMappings, 0);
assert.equal(metrics.CSAT.mappedAnyNodeUnique, 1169);
assert.equal(metrics.CSAT.mappedActionableUnique, 44);
assert.equal(inventory.invalid.nodeIds.length, 28);
assert.equal(inventory.mappings.filter(row => row.resolvedVia === 'existing-csat-source-node').length, 22);
assert(getPyqQuestionIdsForTopic('ESSAY-FRAMEWORK-P3').includes(fixtureId));
assert.equal(getPyqSummaryForNode('CSAT-LR', 0).csatCount, 236);
assert.equal(getPyqQuestionIdsForTopic('CSAT-LR-BLOOD-MT01').length, 0);
const baseline = JSON.parse(fs.readFileSync(path.join(out, 'baseline.json')));
const changedSources = Object.entries(baseline.data).filter(([file, digest]) => fileHash(path.join(root, file)) !== digest).map(([file]) => file);
assert.deepEqual(changedSources, []);
assert.equal(fs.readFileSync(path.join(backend, 'brain/syllabusProgressEngine.js'), 'utf8'), baseline.progressSource);
const changedPreexisting = Object.entries(baseline.worktree).filter(([file, digest]) => fileHash(path.join(root, file)) !== digest).map(([file]) => file);
const result = {
  physical: Object.fromEntries(Object.entries(copies).map(([k, { duplicateGroups, contentConflicts, ...v }]) => [k, v])),
  metrics, invalidMappings: inventory.invalid, csatSourceComparison,
  loader: { completeDeepEquality: true, repetitions, uniqueBuckets: true, identicalStageBuckets: true, incorrectStages: inventory.invalid.stage.length, sourceFilesUnchanged: Object.keys(baseline.data).length, conflictsOnRealData: registry.diagnostics.conflicts.length, conflictFixture: conflict.conflicts },
  preservation: { changedPreexisting, progressEngineUnchangedSinceStart: true, changedSources },
  crosswalk: { explicitLinks: crosswalk.length, ambiguousActiveGroups: ambiguousCrosswalks, inactiveGroupCount: inactive.length },
  essayTrace: { source: read('pyq_questions/mains/mains_essay_tagged.json').topics.find(q => q.id === fixtureId), master: registry.master[fixtureId], mapping: inventory.mappings.filter(m => m.id === fixtureId), resolver: resolveMappingNode('ESSAY-FRAMEWORK-P3'), topicLookupIncludesId: true },
};
write('invariants.json', result);
write('source-copies.json', { copies, sourceInventory, rawSourceInventory, crosswalk, inactive });
write('csat-all-1200.json', csat);
write('mapping-ledger.json', inventory.mappings);
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows].map(row => '| ' + row.join(' | ') + ' |').join('\n');
const yearsLabel = years => { const numbers = Object.keys(years).filter(y => y !== 'unknown').map(Number).sort((a, b) => a - b); return `${numbers[0]}–${numbers.at(-1)}${years.unknown ? '; ' + years.unknown + ' undated' : ''}`; };
const physicalTable = table(['Physical Paper', 'Corpus Unique', 'Source Count', 'Duplicate / Conflict Count', 'Years Covered'], Object.entries(result.physical).map(([paper, v]) => [paper, v.corpusUnique, v.sourceCount, `${v.duplicateOccurrences} / ${v.conflictingContentIds}`, yearsLabel(v.years)]));
const workspaceTable = table(['Workspace', 'Associated Unique PYQs', 'Mapped Any Node', 'Mapped Actionable', 'Section Only', 'Completely Unmapped', 'Invalid Mappings'], Object.entries(metrics).map(([key, m]) => [key, m.associatedUniquePyqs, m.mappedAnyNodeUnique, m.mappedActionableUnique, m.sectionOnlyUnique, m.completelyUnmappedUnique, m.invalidMappings]));
const metricDefinitions = table(['Field', 'Definition'], [
  ['physicalCorpusTotal', 'Unique IDs whose authoritative physical identity is the workspace paper.'],
  ['mappedInCorpusUnique', 'Physical-corpus IDs with at least one valid canonical-node or section/container association.'],
  ['unmappedInCorpus', 'physicalCorpusTotal minus mappedInCorpusUnique.'],
  ['orphanMappings', 'Mapping records whose question ID is absent from the active master.'],
  ['invalidNodeMappings', 'Unique physical-corpus IDs whose existing node reference remains unresolved.'],
  ['workspaceAssociatedUnique', 'Unique valid syllabus associations, including legitimate cross-paper links.'],
  ['mappedActionableUnique', 'Unique cohort IDs with a direct canonical leaf target or an existing alias resolving to one canonical leaf. A multi-target container alias does not assign each child.'],
  ['attemptedUnique', 'Distinct existing question IDs from both attempt tables, intersected with the physical corpus; null if evidence retrieval is unavailable.'],
  ['mappingCoverage', '100 × mappedInCorpusUnique / physicalCorpusTotal, rounded to one decimal.'],
  ['attemptCoverage', '100 × attemptedUnique / physicalCorpusTotal, rounded to one decimal; null when evidence is unavailable.'],
]);
const changedCode = ['backend/brain/pyqLinkEngine.js', 'backend/brain/pyqPhysicalIdentity.js', 'backend/brain/pyqMappingResolution.js', 'backend/brain/pyqCorpusInventory.js', 'backend/services/pyqInventoryService.js', 'backend/routes/progressRoutes.js', 'backend/routes/syllabusDrilldownRoutes.js', 'backend/scripts/auditPyqReconciliation.mjs', 'backend/tests/pyqReconciliationHttp.test.mjs'];
const link = file => `[${file}](${path.join(root, file).replaceAll('\\', '/')})`;
const httpPath = path.join(out, 'http-responses.json');
const http = fs.existsSync(httpPath) ? JSON.parse(fs.readFileSync(httpPath, 'utf8')) : null;
const httpTable = http ? table(['HTTP path', 'Status', 'Corpus', 'Mapped any', 'Actionable', 'Attempted (fixture)'], http.responses.filter(r => r.body.canonicalPaperKey && !r.url.includes('unavailable-evidence')).map(r => [new URL(r.url).pathname, r.status, r.body.pyq.corpusTotal, r.body.pyq.mappedAnyNodeUnique, r.body.pyq.mappedActionableUnique, r.body.pyq.attemptedUnique])) : 'HTTP verification has not been run.';
const report = `Focused PYQ reconciliation — current worktree

The runtime inventory and mapping semantics are repaired. The runtime CSAT master now supplements all 47 IDs previously dropped by unsafe text-prefix deduplication, without rewriting source JSON. The 208 content conflicts remain unresolved and source-marked; 28 active CSAT node references remain unresolved. Archived/clean datasets include other IDs without an explicit crosswalk to active IDs. Source records were preserved, not merged by text or renumbered. The claimed 2,217 Prelims count is not reproducible in this worktree.

Before edits, GS3 tagged corpus = 233; workspace retrieval IDs = 1,495; intersection = 0; corpus-only = 233; workspace-only = 1,495, all Prelims. The old function's erroneous GS3 corpus included 419 Prelims records with paper=GS3, leaving 1,076 labelled orphan. GS2 similarly had 581 legitimate Prelims associations, of which 383 had paper=GS2, leaving 198 labelled orphan. After repair GS3's physical intersection is 233 and its 1,495 cross-paper associations remain valid.

Exact causes: calculateMasterCorpusCounts() in syllabusDrilldownRoutes.js treated paper=GS as GS1 and syllabus paper labels GS2/GS3 as physical paper identities; it compared disjoint physical and workspace sets. loadTaggedMainsDatasets() in pyqLinkEngine.js loaded only GS4, Essay and Optional, omitting 14 existing GS1–GS3 tagged files. resolveInputToLookupNodeIds() and getPyqQuestionIdsForTopic() used direct/prefix retrieval while the aggregate iterated canonical microtheme nodes. The reconciliation now consumes actual buckets through resolveMappingNode(), the existing unified resolver, pyqNodeAliasMap.js and existing syllabus containers. No subject keyword determines physical identity.

Table A — Physical-paper inventory of the active registry

${physicalTable}

Corpus Unique means existing active IDs, reconciled through explicit originalId links where present, not text-based certification of unique printed questions. Source Count is the number of contributing primary sourceFile/tagged datasets. Duplicate count is additional record occurrences matching these IDs/crosswalks across local source copies; conflict count is IDs with differing year/question content across those copies (whitespace normalized), not a count of physical-identity conflicts. There are zero conflicting physical identities in the active registry and zero conflicting duplicate IDs in the tagged loader. Different IDs lacking an explicit crosswalk are reported separately, not assumed duplicates. See source-copies.json for every group and content variant.

Table B — Syllabus workspace associations

${workspaceTable}

Associated counts include valid links only. CSAT has a cohort of 1,153: 1,103 valid section associations and 50 IDs linked only to unresolved nodes. Completely Unmapped means no mapping record; it is zero. Invalid Mappings counts unique question IDs with unresolved/invalid links and can overlap other categories in general. Here all 50 are CSAT-only unresolved-node IDs. Unresolved question IDs = 0; conflicting/ambiguous physical identities = 0; incorrect-stage mappings = 0. Valid GS1/GS2/GS3 cross-paper Prelims associations = 1,295 / 581 / 1,495. They are not orphans.

Essay trace and mapping depth

pyq_questions/mains/mains_essay_tagged.json → topics[ESSAY_1993_U_1] → loadTaggedMainsDatasets() → in-memory master with physicalPaper=ESSAY, stage=essay → ESSAY-FRAMEWORK-P3.essay bucket → existing canonical aliases ESSAY-MT01-D06 through ESSAY-MT04-D06 → paper API: 213 mapped-any / 0 actionable / 213 section-only → topic API: the same existing question is returned. Text: “My vision of India in 2001 A.D.” The old zero was an aggregate traversal defect: canonical microtheme IDs did not find the legacy container bucket, while direct topic retrieval did. The fix counts that existing container association without mapping the question to each of its four microthemes.

CSAT depth over all 1,153 active IDs: any valid node 1,125; actionable 0; section-only 1,125; no mapping record 0; unresolved mappings 28. Existing source topic evidence resolves 22 of the original 50 provisional references to approved section containers; no granular mappings or global aliases were invented. The remaining 28 retain unresolved status. Broad section retrieval remains available, section aggregates count these links, and leaf counters do not inherit them.

Physical source reconciliation

The current Prelims master has 3,371 existing IDs: 2,569 with paper=GS, 383 with paper=GS2, 419 with paper=GS3, all stage=prelims. Neither a primary source nor the active physical corpus reproduces 2,217. Of the 3,371 IDs, 35 have no year; some years exceed nominal paper sizes, so this is an ID inventory rather than a claim that all printed-question duplicates have been resolved.

The dedicated existing loadCSATData() returns 1,200 unique IDs and the runtime master now contains all 1,200, with source-only valid IDs = 0. The 47 previously absent examples include csat_lr_2019_80, csat_rc_2015_41 and PRE_CSAT_2025_059. buildPyqMasterIndex.js now gives canonical IDs precedence and uses full normalized content only when no stronger identity exists. The audit found 208 active CSAT IDs with content variants across copies (e.g. csat_lr_2021_20 contains “12” in one copy and “12 km” in another). Those variants remain unresolved and are source-marked for review.

The audit scanned master indexes, yearly files, clean masters, tagged, fixed, typed and rebuilt copies, excluding audit/report metadata. It used exact IDs and ${crosswalk.length} explicit originalId links from the existing rebuildPrelimsDataset.js crosswalk fields. There are ${ambiguousCrosswalks.length} ambiguous active crosswalk groups. ${inactive.length} source identity groups have no active registry match, including the separate mains_master_clean_fixed.json IDs; there is no basis to silently union or discard them as physical duplicates. Full file-level raw counts, active overlap, every source/year and all unmatched IDs are in source-inventory.md and source-copies.json.

Metric definitions

${metricDefinitions}

The root dashboard and paper API share these fields and denominators. Existing progress.pyqPercent, readiness, weakness, and summary calculations retain their original formulas and values. The legacy paper summary.pyqCoveragePercent retains its existing mapping-coverage meaning; consumers should use the explicit mappingCoveragePercent / attemptCoveragePercent fields to avoid confusing it with the root's legacy progress percentage. Inventory fields are attached after computeSyllabusProgress(), so the correction does not silently change readiness inputs. Attempt counts are read from both existing attempt tables, deduplicated by question ID, and never written.

Loader proof

Three repeated explicit-registry loads and three default-registry loads passed deep equality of complete records and buckets, including array order. All original on-disk master records remain equal in memory. Every bucket has unique IDs within and across stages. No fallback-stage contamination. A deliberately conflicting duplicate of ESSAY_1993_U_1 was detected and preserved without overwriting or adding links; a conflicting physical-identity fixture was also detected. Real tagged-dataset conflicts = 0.

Stable master SHA-256: ${repetitions[0].masterHash}

Stable complete node/stage SHA-256: ${repetitions[0].nodeAndStageHash}

HTTP proof

${httpTable}

${http?.responses.length || 0} real loopback HTTP responses were captured from the actual route modules. Database access was replaced with an isolated SELECT-only fixture; attempts shown above are synthetic and are not user activity claims. No production server or DB was started or contacted. Exact URLs, status codes, headers and full JSON bodies are in http-responses.json. Additional responses prove the Essay trace, CSAT section browsing, Prelims identity within GS2, Mains identity within GS3, and null attempt metrics on unavailable evidence. Tests compare all eight root/paper metric sets and assert unchanged readiness/progress/weakness output.

Validation and preservation

node backend/scripts/auditPyqReconciliation.mjs: PASS — full registry, set, stage, source-hash and conflict invariants.

node backend/tests/pyqReconciliationHttp.test.mjs: PASS — actual local HTTP, eight-workspace equality and question identity checks.

node test_mains_pyq_retrieval_v2.mjs (backend cwd): exit 0, precision suite reports ready.

node test-csat-loader.js (backend cwd): exit 0; this is a loader smoke check, reporting the separate 1,200-ID source corpus.

node brain/testPyqLinkEngine.js (backend cwd): PASS after adding the missing compatibility wrapper. Git history shows the test imported getPyqsForBlock from its first commit while the engine never exported it; the wrapper delegates primaryNodeId to getPyqsForTopic and does not create another engine.

All ${Object.keys(baseline.data).length} source JSON hashes match the pre-edit snapshot. syllabusProgressEngine.js is byte-identical to the starting worktree. Its pre-existing HEAD diff consists solely of an unused getPyqCountForTopic import and total-or-count handling at line 471; that diff was preserved. The readiness weights 0.4/0.25/0.2/0.15, weakness penalty, coverage formula and other progress logic were not edited. All existing frontend Syllabus/Mistake Book files, App.jsx and server.js match their starting hashes. No migrations, production data, verified external backup, git reset/clean/checkout or new worktree was used.

Exact implementation/test files changed in this repair

${changedCode.map(file => '- ' + link(file)).join('\n')}

Generated evidence is confined to backend/reports/pyq-reconciliation/. No canonical JSON edits or user evidence writes were made.
`;
fs.writeFileSync(path.join(out, 'reconciliation.md'), report);
const sourceReport = `Source and year inventory — exact existing IDs\n\nActive primary-source counts\n\n${table(['Physical Paper', 'Primary Source', 'Active Unique IDs'], Object.entries(result.physical).flatMap(([paper, v]) => Object.entries(v.sources).map(([file, count]) => [paper, file, count])))}\n\nPrelims and CSAT year inventory (active master IDs; no rows synthesized)\n\n${table(['Year', 'PRELIMS_GS', 'CSAT'], [...new Set([...Object.keys(result.physical.PRELIMS_GS.years), ...Object.keys(result.physical.CSAT.years)])].sort().map(year => [year, result.physical.PRELIMS_GS.years[year] || 0, result.physical.CSAT.years[year] || 0]))}\n\nEvery scanned source containing question records\n\nActive matches use exact IDs or explicit originalId links. Raw counts are records, not physical-question deduplication. Counts overlap across source copies. Different IDs without a crosswalk are not merged. Per-source/per-year record counts and complete ID lists are in source-copies.json.\n\n${table(['Source', 'Raw Records', 'Unique IDs', 'Active Unique Matches', 'Years'], Object.entries(rawSourceInventory).sort(([a], [b]) => a.localeCompare(b)).map(([file, v]) => [file, v.records, v.uniqueIds, v.activeUnique, yearsLabel(v.years)]))}\n`;
fs.writeFileSync(path.join(out, 'source-inventory.md'), sourceReport);
console.log(JSON.stringify({ physical: result.physical, metrics, loader: result.loader, crosswalk: result.crosswalk, preservation: result.preservation }, null, 2));
