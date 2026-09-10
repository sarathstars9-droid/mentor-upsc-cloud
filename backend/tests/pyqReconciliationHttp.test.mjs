import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';

// Real HTTP and production route modules, with an isolated read-only evidence
// fixture. No DB module, credentials, background services or production server.
const calls = [];
globalThis.__pyqAuditQuery = async (sql, values) => {
  assert(/^\s*SELECT\b/i.test(sql), 'Only SELECT is permitted in the HTTP fixture');
  calls.push({ sql, values });
  if (values?.[0] === 'unavailable-evidence' && /public\.(pyq_attempts|mains_answer_attempts)/.test(sql)) throw new Error('Evidence unavailable fixture');
  const ids = sql.includes('public.pyq_attempts')
    ? ['POL_ANTI_DEFECTION_LAW_2025_Q1', 'csat_lr_2024_56', 'POL_ANTI_DEFECTION_LAW_2025_Q1']
    : sql.includes('public.mains_answer_attempts') ? ['ESSAY_1993_U_1', 'GS3_AGRI_2024_01'] : [];
  return { rows: ids.filter(id => !Array.isArray(values?.[1]) || values[1].includes(id)).map(question_id => ({ question_id })) };
};
const databaseStub = 'data:text/javascript,' + encodeURIComponent('export const query = (...args) => globalThis.__pyqAuditQuery(...args); export const pool = { query, end: async () => {} };');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/db/index.js')) return { url: databaseStub, shortCircuit: true };
    // Dashboard handlers do not use these services. Prevent unrelated import side effects.
    if (context.parentURL?.endsWith('/routes/progressRoutes.js') && /\/(progressService|telegramService)\.js$/.test(specifier)) return { url: 'data:text/javascript,export%20const%20unused%20%3D%20true', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const { default: drilldown } = await import('../routes/syllabusDrilldownRoutes.js');
const { default: progress } = await import('../routes/progressRoutes.js');
const { default: prelimsUnified } = await import('../routes/prelimsUnifiedRoutes.js');
const { computeSyllabusProgress } = await import('../brain/syllabusProgressEngine.js');
const app = express();
app.use('/api/syllabus', drilldown);
app.use('/api', progress);
app.use('/api/prelims-unified', prelimsUnified);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const responses = [];
async function get(url, userId = 'pyq-audit-fixture') {
  const response = await fetch(base + url + '?userId=' + userId);
  const body = await response.json();
  responses.push({ url: base + url + '?userId=' + userId, status: response.status, headers: Object.fromEntries(response.headers), body });
  assert.equal(response.status, 200, url);
  return body;
}
try {
  const beforeProgress = await computeSyllabusProgress();
  const dashboard = await get('/api/syllabus/dashboard');
  const metricsKeys = ['physicalCorpusTotal', 'mappedInCorpusUnique', 'unmappedInCorpus', 'orphanMappings', 'invalidNodeMappings', 'attemptedUnique', 'mappingCoverage', 'attemptCoverage', 'workspaceAssociatedUnique', 'mappedActionableUnique', 'sectionOnlyUnique'];
  const summary = {};
  for (const urlKey of ['gs1', 'gs2', 'gs3', 'gs4', 'essay', 'csat', 'optional-p1', 'optional-p2']) {
    const paper = await get('/api/syllabus/papers/' + urlKey);
    const root = dashboard.papers.find(p => p.paperKey.toUpperCase().replaceAll('-', '_') === paper.canonicalPaperKey);
    assert(root, 'Root workspace exists: ' + urlKey);
    for (const key of metricsKeys) assert.equal(paper.pyq[key], root.pyq[key], urlKey + ':' + key);
    assert.equal(paper.summary.pyqCoveragePercent, paper.pyq.attemptCoverage);
    assert.equal(paper.summary.mappingCompletenessPercent, paper.pyq.mappingCoverage);
    assert.equal(paper.pyq.mappedInCorpusUnique + paper.pyq.unmappedInCorpus, paper.pyq.physicalCorpusTotal);
    assert.equal(paper.pyq.mappedActionableUnique + paper.pyq.sectionOnlyUnique, paper.pyq.workspaceAssociatedUnique);
    summary[urlKey] = paper.pyq;
    if (urlKey === 'csat') assert.equal(paper.hierarchy.flatMap(s => s.sections).reduce((sum, s) => sum + s.linkedPyqCount, 0), 1169);
  }
  for (const paper of dashboard.papers) {
    const old = beforeProgress.papers.find(p => p.paperKey === paper.paperKey);
    assert.deepEqual(paper.progress, old.progress);
    assert.equal(paper.readinessScore, old.readinessScore);
    assert.equal(paper.weakZonesCount, old.weakZonesCount);
  }
  assert.deepEqual(dashboard.summary, beforeProgress.summary);
  const essay = await get('/api/syllabus/nodes/ESSAY-FRAMEWORK-P3');
  const essayQuestions = await get('/api/syllabus/nodes/ESSAY-FRAMEWORK-P3/pyqs');
  const q = essayQuestions.questions.find(q => q.id === 'ESSAY_1993_U_1');
  assert(q); assert.equal(q.physicalPaper, 'ESSAY'); assert.equal(essay.pyqSummary.total, essayQuestions.total);
  const csat = await get('/api/syllabus/nodes/CSAT-LR');
  assert.equal(csat.pyqSummary.total, 236);
  const csatQuestions = await get('/api/syllabus/nodes/CSAT-LR/pyqs');
  assert.equal(csatQuestions.total, 236);
  assert.equal(csatQuestions.returnedCount, 200);
  const polity = await get('/api/syllabus/nodes/GS2-POL-EXEC-MT01/pyqs');
  assert(polity.questions.some(q => q.physicalPaper === 'PRELIMS_GS' && q.stage === 'prelims'));
  const gs3Questions = await get('/api/syllabus/nodes/GS3-ECO-LANDREFORMS/pyqs');
  assert(gs3Questions.questions.some(q => q.id === 'GS3_AGRI_2024_01' && q.physicalPaper === 'MAINS_GS3'));
  const unavailable = await get('/api/syllabus/papers/essay', 'unavailable-evidence');
  assert.equal(unavailable.pyq.attemptedUnique, null);
  assert.equal(unavailable.pyq.attemptCoverage, null);
  for (const questionId of ['csat_lr_2019_80', 'csat_rc_2015_41', 'PRE_CSAT_2025_059']) {
    const exact = await get('/api/prelims-unified/questions/' + questionId);
    assert.equal(exact.question.id, questionId);
    assert.equal(exact.question.physicalPaper, 'CSAT');
  }
  const conflicted = await get('/api/prelims-unified/questions/csat_lr_2021_20');
  assert.equal(conflicted.question.sourceCertification.status, 'unresolved-content-conflict');
  const invalidResponse = await fetch(base + '/api/prelims-unified/questions/DOES_NOT_EXIST');
  assert.equal(invalidResponse.status, 404);
  fs.writeFileSync('reports/pyq-reconciliation/http-responses.json', JSON.stringify({ evidenceMode: 'isolated read-only fixture; corpus and route code are real; user attempts are synthetic', responses, calls, summary }, null, 2));
  console.log(JSON.stringify({ httpResponses: responses.length, status: 'PASS', rootPaperMetricsEqual: true, progressReadinessWeaknessUnchanged: true, summary }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  delete globalThis.__pyqAuditQuery;
}
