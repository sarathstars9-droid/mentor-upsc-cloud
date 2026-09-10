import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// The helper has no dependencies. A data URL keeps this test runnable even in a CommonJS host repo.
const source = await readFile(new URL('../pages/syllabus-intelligence.js', import.meta.url), 'utf8');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const node = (id, name, status = 'untouched', children = [], extra = {}) => ({ nodeId: id, name, status, children, ...extra });

const tree = [node('GS1-HIST', 'History', 'untouched', [
  node('GS1-HIST-ANC', 'Ancient History', 'untouched', [
    node('GS1-HIST-ANC-MT01', 'Pre-historic Period & Harappan Culture', 'untouched', [], { linkedPyqCount: 12, attemptedPyqCount: 3 }),
    node('GS1-HIST-ANC-MT02', 'Vedic Period', 'revised', [], { linkedPyqCount: 8, attemptedPyqCount: 8 }),
  ]),
  node('GS1-HIST-MOD', 'Modern History', 'covered', [node('GS1-HIST-MOD-MT01', 'National Movement', 'covered', [], { linkedPyqCount: 15 })]),
])];
const baseline = { summary: { overallSyllabusCoveragePercent: 0, overallPyqCoveragePercent: 0, overallRevisionPercent: 0, overallReadinessScore: 0, untouchedNodes: 367 }, papers: [], weakZones: [{ nodeId: 'GS1-HIST-ANC-MT01', paperKey: 'GS1', topicLabel: 'Ancient History', reason: 'Very low syllabus coverage', priority: 'high' }], untouchedZones: [{ nodeId: 'GS1-HIST-ANC-MT01', paperKey: 'GS1', topicLabel: 'Ancient History', suggestedBlockMinutes: 60 }], nextActions: [{ label: 'GS1 is under-prepared', action: 'Add focused blocks' }] };

test('dashboard normalization preserves source data without synthetic progress', () => {
  const result = m.normalizeDashboard(baseline);
  assert.equal(result.summary.overallReadinessScore, 0);
  assert.equal(result.summary.untouchedNodes, 367);
  assert.equal(result.papers.length, 0);
  assert.equal(result.tableRows.length, 0);
});
test('zero-activity readiness is unavailable, not a failing score', () => {
  assert.deepEqual(m.readinessState(0, {}, { study: false, pyq: false, test: false }), { available: false, label: 'Building baseline', value: '—' });
  assert.equal(m.overviewEvidence(baseline).any, false);
});
test('readiness requires sufficient evidence or explicit backend eligibility', () => {
  assert.equal(m.readinessState(64, {}, { study: true, pyq: true, test: true }).value, 64);
  assert.equal(m.readinessState(64, { readinessEligible: false }, { study: true, pyq: true, test: true }).available, false);
  assert.equal(m.readinessState(0, { readinessEligible: true }, {}).value, 0);
});
test('no evidence remains neutral rather than critical or healthy', () => {
  assert.equal(m.preparationStatus({ status: 'critical', totals: { totalNodes: 100 } }).label, 'No evidence');
  assert.equal(m.nodeStatus('').label, 'Unknown');
  assert.equal(m.nodeStatus('mastered').label, 'Mastered');
  assert.equal(m.preparationStatus({status:'critical', lastActivityAt:'2026-09-09T12:00:00Z', totals:{totalNodes:100}}).label,'No evidence');
});
test('low syllabus coverage alone is not an observed performance weakness', () => {
  const result = m.classifyAttention(baseline, {});
  assert.equal(result.observed.length, 0);
  assert.equal(result.gaps.length, 1);
});
test('recorded mistakes and test evidence qualify as observed weakness', () => {
  const result = m.classifyAttention({ weakZones: [{ nodeId: 'A', wrongCount: 3 }, { nodeId: 'B', evidenceType: 'test' }, { nodeId: 'C', reason: 'Untouched' }] });
  assert.deepEqual(result.observed.map((x) => x.nodeId), ['A', 'B']);
  assert.deepEqual(result.gaps.map((x) => x.nodeId), ['C']);
});
test('a positive coverage-only weakness score does not fabricate performance evidence', () => {
  assert.equal(m.hasPerformanceEvidence({ nodeId: 'A' }, { A: { weakness_score: 80, evidenceType: 'coverage' } }), false);
});
test('baseline priority is a suggested starting point, not a measured weakness', () => {
  const p = m.chooseMentorPriority(baseline);
  assert.equal(p.baseline, true);
  assert.equal(p.target.nodeId, 'GS1-HIST-ANC-MT01');
  assert.match(p.reason, /not enough/i);
});
test('unknown node routes are not silently assigned to GS1', () => {
  assert.equal(m.topicPath(null, 'UNKNOWN-NODE'), '/syllabus');
  assert.equal(m.topicPath(null, 'GS3-ECO-GROWTH-MT01'), '/syllabus/gs3/topic/GS3-ECO-GROWTH-MT01');
  assert.equal(m.paperPath('opt-geo2'), '/syllabus/optional-p2');
});
test('a verified user ID is used without a hard-coded fallback', () => {
  assert.equal(m.verifiedUserId({}, null), null);
  assert.equal(m.verifiedUserId({ meta: { userId: 'real-user' } }), 'real-user');
  assert.equal(m.verifiedUserId({}, 'explicit-user'), 'explicit-user');
});
test('canonical leaves are preserved and not counted twice', () => {
  assert.equal(m.treeLeaves(tree).length, 3);
  const result = m.normalizePaper({ hierarchy: tree, summary: {} });
  assert.equal(result.summary.totalNodes, 3);
  assert.equal(result.summary.coveredNodes, 2);
  assert.equal(result.summary.revisedNodes, 1);
});
test('a deeply matched topic retains its ancestors', () => {
  const filtered = m.filterPaperTree(tree, { search: 'Harappan', status: 'ALL', pyq: 'ALL' });
  assert.equal(filtered.length, 1);
  assert.equal(m.nodeChildren(filtered[0])[0].name, 'Ancient History');
  assert.equal(m.treeLeaves(filtered).length, 1);
});
test('searching a parent retains its descendants', () => {
  const filtered = m.filterPaperTree(tree, { search: 'Ancient History', status: 'ALL', pyq: 'ALL' });
  assert.equal(m.treeLeaves(filtered).length, 2);
});
test('unattempted filter uses linked minus attempted, not attempted equals zero', () => {
  const result = m.filterPaperTree(tree, { status: 'ALL', pyq: 'UNATTEMPTED' });
  assert.deepEqual(m.treeLeaves(result).map(m.nodeId), ['GS1-HIST-ANC-MT01', 'GS1-HIST-MOD-MT01']);
});
test('coverage status, weak, and revision due remain separate filters', () => {
  const weak = m.filterPaperTree([node('A','A','covered',[],{isWeak:true}),node('B','B','untouched')], { status:'WEAK',pyq:'ALL' });
  assert.deepEqual(m.treeLeaves(weak).map(m.nodeId), ['A']);
  const due = m.filterPaperTree([node('A','A','covered',[],{isRevisionDue:true}),node('B','B','revised')], { status:'REVISION_DUE',pyq:'ALL' });
  assert.deepEqual(m.treeLeaves(due).map(m.nodeId), ['A']);
});
test('CSAT container and unresolved mapping remain canonical without fabricated microthemes', () => {
  const rows = [node('CSAT-LR','Logical Reasoning','untouched',[],{linkedPyqCount:1103}),node('CSAT-QUANT-NUMBERS','Numbers','unknown',[],{mappingStatus:'unresolved'})];
  assert.equal(m.treeLeaves(rows).length, 2);
  assert.equal(m.nodeLinked(rows[0]), 1103);
  assert.equal(m.nodeStatus(rows[1].status).label, 'Unknown');
});
test('question normalization preserves physical paper metadata and Mains stages', () => {
  const q = m.normalizeQuestion({ id:'MAINS_GS2_2020_Q4', stage:'mains', examPaper:'GS2', year:2020, marks:10, question:'Discuss.' });
  assert.equal(q.stage,'mains'); assert.equal(q.physicalPaper,'GS2'); assert.equal(q.marks,10);
  assert.equal(m.questionAttempt(q).key,'unknown');
  assert.equal(m.normalizeQuestion({stage:'ethics'}).stage,'mains');
  assert.equal(m.normalizeQuestion({stage:'essay'}).stage,'mains');
  assert.equal(m.normalizeQuestion({stage:'optional'}).stage,'mains');
});
test('missing attempt evidence is not silently treated as unattempted', () => {
  assert.equal(m.questionAttempt(m.normalizeQuestion({id:'Q'})).key,'unknown');
  assert.equal(m.questionAttempt(m.normalizeQuestion({attemptStatus:'not_attempted'})).key,'unattempted');
});
test('question filters distinguish attempt, correctness and stage', () => {
  const qs = [
    {id:'A',stage:'prelims',question:'A',attemptStatus:'unattempted'},
    {id:'B',stage:'prelims',question:'B',attemptStatus:'attempted',isCorrect:false},
    {id:'C',stage:'mains',question:'C',attemptStatus:'attempted',isCorrect:true},
    {id:'D',stage:'mains',question:'D',attemptStatus:'attempted'},
  ].map(m.normalizeQuestion);
  assert.deepEqual(m.filterQuestions(qs,{status:'INCORRECT'}).map(x=>x.id),['B']);
  assert.deepEqual(m.filterQuestions(qs,{status:'CORRECT'}).map(x=>x.id),['C']);
  assert.deepEqual(m.filterQuestions(qs,{status:'ATTEMPTED'}).map(x=>x.id),['D']);
  assert.deepEqual(m.filterQuestions(qs,{status:'UNATTEMPTED'}).map(x=>x.id),['A']);
  assert.deepEqual(m.filterQuestions(qs,{stage:'MAINS'}).map(x=>x.id),['C','D']);
});
test('practice destination retains question ID, canonical context, and optional route override', () => {
  const q = m.normalizeQuestion({id:'PRELIMS_GS_2021_Q42',stage:'prelims',question:'Question'});
  const destination = m.questionDestination(q,{nodeId:'GS1-HIST-ANC-MT01',paperKey:'gs1'});
  assert.equal(destination.pathname,'/prelims');
  assert.equal(new URLSearchParams(destination.search).get('questionId'),q.id);
  assert.equal(destination.state.question.id,q.id);
  assert.equal(destination.state.nodeId,'GS1-HIST-ANC-MT01');
  assert.equal(m.questionDestination(q,{}, {prelims:'/prelims/practice'}).pathname,'/prelims/practice');
});
test('Mains destination preserves existing answer-writing route', () => {
  const q=m.normalizeQuestion({id:'MAINS_GS2_2020_Q4',stage:'mains',question:'Discuss.'});
  const destination=m.questionDestination(q,{nodeId:'GS2-POL-CSREL-MT01',paperKey:'gs2'});
  assert.equal(destination.pathname,'/mains/answer-writing');
  assert.equal(destination.state.selectedQuestion.id,q.id);
});
test('all eight paper workspaces remain distinct', () => {
  assert.equal(m.PAPERS.length,8);
  assert.equal(new Set(m.PAPERS.map(p=>p.key)).size,8);
  assert.equal(m.paperInfo('optional-p1').label,'Optional P1');
  assert.notEqual(m.paperPath('optional-p1'),m.paperPath('optional-p2'));
});
test('percentage helpers clamp and preserve zero denominators', () => {
  assert.equal(m.percent(0), '0%');
  assert.equal(m.percent(200),'100%');
  assert.equal(m.ratioPercent(0,0),0);
  assert.equal(m.ratioPercent(3,12),25);
});
