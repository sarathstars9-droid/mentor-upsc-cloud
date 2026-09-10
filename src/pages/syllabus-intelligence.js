/* Pure, evidence-safe helpers. No backend or canonical-data mutations. */
export const PAPERS = [
  { key: 'gs1', label: 'GS1', short: 'GS1', description: 'History · Culture · Geography · Society', color: 'blue' },
  { key: 'gs2', label: 'GS2', short: 'GS2', description: 'Polity · Governance · Social Justice · IR', color: 'violet' },
  { key: 'gs3', label: 'GS3', short: 'GS3', description: 'Economy · Environment · Security · S&T', color: 'teal' },
  { key: 'gs4', label: 'GS4', short: 'GS4', description: 'Ethics · Integrity · Aptitude', color: 'amber' },
  { key: 'essay', label: 'Essay', short: 'ES', description: 'Essay themes and idea clusters', color: 'blue' },
  { key: 'csat', label: 'CSAT', short: 'CS', description: 'Comprehension · Reasoning · Numeracy', color: 'violet' },
  { key: 'optional-p1', label: 'Optional P1', short: 'P1', description: 'Geography Optional · Paper I', color: 'teal' },
  { key: 'optional-p2', label: 'Optional P2', short: 'P2', description: 'Geography Optional · Paper II', color: 'green' },
];

export const count = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
export const numberText = (value) => Math.round(count(value)).toLocaleString('en-IN');
export const percent = (value) => `${Math.max(0, Math.min(100, Math.round(count(value))))}%`;
export const ratioPercent = (part, total) => count(total) > 0 ? Math.min(100, count(part) / count(total) * 100) : 0;
export const firstDefined = (...values) => values.find((v) => v !== undefined && v !== null);
export const list = (value) => Array.isArray(value) ? value : [];
export const text = (value, fallback = '') => value === undefined || value === null || value === '' ? fallback : String(value);
export const pretty = (value) => text(value, 'Unknown').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const dateText = (value) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const timeText = (value) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
export const canonicalPaperKey = (value) => {
  const key = text(value).trim().toLowerCase().replace(/_/g, '-');
  if (['optional-paper1', 'optional-p1', 'opt-geo1', 'opt-p1', 'op1'].includes(key)) return 'optional-p1';
  if (['optional-paper2', 'optional-p2', 'opt-geo2', 'opt-p2', 'op2'].includes(key)) return 'optional-p2';
  return key;
};
export const paperInfo = (key) => PAPERS.find((p) => p.key === canonicalPaperKey(key)) || {
  key: canonicalPaperKey(key), label: text(key, 'Paper'), short: 'SY', description: 'Syllabus coverage', color: 'blue'
};
export const paperKeyForNode = (key, id) => {
  const supplied = canonicalPaperKey(key);
  if (PAPERS.some((paper) => paper.key === supplied)) return supplied;
  const prefix = text(id).toUpperCase();
  if (/^GS[1-4](?:-|$)/.test(prefix)) return prefix.slice(0, 3).toLowerCase();
  if (/^CSAT(?:-|$)/.test(prefix)) return 'csat';
  if (/^ESSAY(?:-|$)/.test(prefix)) return 'essay';
  if (/^(?:OPT|OP)(?:IONAL)?[-_]?P?1(?:-|_|$)/.test(prefix)) return 'optional-p1';
  if (/^(?:OPT|OP)(?:IONAL)?[-_]?P?2(?:-|_|$)/.test(prefix)) return 'optional-p2';
  return supplied;
};
export const paperPath = (key) => {
  const resolved = canonicalPaperKey(key);
  return resolved ? `/syllabus/${encodeURIComponent(resolved)}` : '/syllabus';
};
export const topicPath = (key, nodeId) => {
  const resolved = paperKeyForNode(key, nodeId);
  return resolved ? `${paperPath(resolved)}/topic/${encodeURIComponent(nodeId)}` : '/syllabus';
};
export const focusPath = (nodeId) => `/focus?nodeId=${encodeURIComponent(nodeId)}`;
export const revisionPath = (nodeId) => `/revision?nodeId=${encodeURIComponent(nodeId)}`;
export const mistakesPath = (nodeId) => `/mistakes?nodeId=${encodeURIComponent(nodeId)}`;
export const searchText = (...values) => values.flat(Infinity).filter((v) => v != null).join(' ').toLowerCase();

export function unwrapPayload(raw, keys = []) {
  if (raw?.ok === false) throw new Error(raw.error || raw.message || 'The server could not load this data.');
  if (raw?.data && typeof raw.data === 'object' && !keys.some((key) => raw[key] !== undefined)) return raw.data;
  return raw || {};
}
export function normalizeDashboard(raw) {
  const data = unwrapPayload(raw, ['summary', 'papers', 'tableRows']);
  const papers = list(data.papers);
  const summary = data.summary || {};
  return {
    ...data,
    meta: data.meta || {},
    summary,
    papers,
    tableRows: list(data.tableRows).length ? data.tableRows : papers.map((paper) => ({
      paperKey: paper.paperKey, paperLabel: paper.paperLabel,
      ...paper.totals, totalPyqs: paper.pyq?.totalPyqs,
      attemptedPyqs: paper.pyq?.attemptedPyqs, correctPercent: paper.pyq?.correctPercent,
      weakZones: paper.weakZonesCount, readinessScore: paper.readinessScore,
      lastActivityAt: paper.lastActivityAt, status: paper.status,
    })),
    weakZones: list(data.weakZones), untouchedZones: list(data.untouchedZones),
    recentActivity: list(data.recentActivity), nextActions: list(data.nextActions),
  };
}
export function verifiedUserId(raw, explicitUserId) {
  return firstDefined(explicitUserId, raw?.meta?.userId, raw?.meta?.user_id, raw?.userId, raw?.user_id) || null;
}
export function studyEvidence(paper) {
  const t = paper?.totals || paper?.summary || {};
  const p = paper?.pyq || {};
  return count(firstDefined(t.touchedNodes, t.touchedCount)) > 0 || count(t.coveredNodes) > 0 ||
    count(t.revisedNodes) > 0 || count(t.masteredNodes) > 0 ||
    count(firstDefined(p.attemptedPyqs, paper?.attemptedPyqs)) > 0 ||
    count(t.studyBlocks) > 0 || count(t.studyMinutes) > 0 || count(t.studySessions) > 0;
}
export function testCount(paper) {
  const tests = paper?.tests || {};
  const summary = count(tests.sectionalCount) + count(tests.fullTestCount) + count(tests.institutionalTestCount);
  const flat = count(paper?.sectionalTests) + count(paper?.fullTests) + count(paper?.institutionalTests);
  return count(firstDefined(tests.totalCount, tests.attemptedCount, summary || flat));
}
export function readinessState(score, source, evidence) {
  const status = text(firstDefined(source?.readinessStatus, source?.readiness?.status, source?.readinessScoreStatus)).toLowerCase();
  const explicit = firstDefined(source?.readinessEligible, source?.readiness?.eligible);
  const enough = explicit === true || (explicit !== false && ['active', 'ready', 'sufficient', 'performance_active'].includes(status)) ||
    (explicit !== false && !status && Boolean(evidence?.study) && Boolean(evidence?.pyq) && Boolean(evidence?.test));
  if (!enough || !Number.isFinite(Number(score))) return { available: false, label: 'Building baseline', value: '—' };
  return { available: true, label: 'Readiness', value: Math.round(Number(score)) };
}
export function overviewEvidence(data) {
  const s = data?.summary || {};
  const papers = list(data?.papers);
  const study = papers.some(studyEvidence) || count(firstDefined(s.touchedNodes, s.coveredNodes)) > 0 ||
    count(s.studyBlocks) > 0 || count(s.studyMinutes) > 0 || count(s.studySessions) > 0;
  const pyq = papers.some((p) => count(p.pyq?.attemptedPyqs) > 0) || count(s.attemptedPyqs) > 0;
  const test = papers.some((p) => testCount(p) > 0) || count(firstDefined(s.testCount, s.testsAttempted)) > 0;
  return { study, pyq, test, any: study || pyq || test };
}
export function paperReadiness(paper) {
  return readinessState(paper?.readinessScore, paper, {
    study: studyEvidence(paper), pyq: count(paper?.pyq?.attemptedPyqs) > 0, test: testCount(paper) > 0,
  });
}
export function preparationStatus(paper) {
  if (!studyEvidence(paper)) return { label: 'No evidence', tone: 'neutral', key: 'no_evidence' };
  const key = text(paper?.status, 'in_progress').toLowerCase();
  const tones = { critical: 'danger', lagging: 'warning', strong: 'success', exam_ready: 'success', balanced: 'info' };
  return { label: pretty(key), tone: tones[key] || 'info', key };
}
export function normalizeNodeStatus(value) {
  const status = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (status === 'untouched' || status === 'not_started') return 'untouched';
  if (['in_progress', 'covered', 'revised', 'mastered'].includes(status)) return status;
  return status || 'unknown';
}
export function nodeStatus(value) {
  const key = normalizeNodeStatus(value);
  const names = { untouched: 'Not started', in_progress: 'In progress', covered: 'Covered', revised: 'Revised', mastered: 'Mastered', unknown: 'Unknown' };
  const tones = { untouched: 'neutral', in_progress: 'info', covered: 'info', revised: 'success', mastered: 'success', unknown: 'neutral' };
  return { key, label: names[key] || pretty(key), tone: tones[key] || 'neutral' };
}
export function nodeChildren(node) {
  if (Array.isArray(node?.children)) return node.children;
  if (Array.isArray(node?.sections)) return node.sections;
  if (Array.isArray(node?.topics)) return node.topics;
  return [];
}
export function nodeId(node) { return text(firstDefined(node?.nodeId, node?.node_id, node?.id)); }
export function nodeName(node) { return text(firstDefined(node?.name, node?.title, node?.label), nodeId(node) || 'Untitled topic'); }
export function nodeLinked(node) { return count(firstDefined(node?.linkedPyqCount, node?.pyq?.linkedPyqs, node?.pyqSummary?.total)); }
export function nodeAttempted(node) { return count(firstDefined(node?.attemptedPyqCount, node?.attemptedPyqs, node?.pyq?.attemptedPyqs, node?.pyqSummary?.attempted)); }
export function nodeWeak(node) { return node?.isWeak === true || count(firstDefined(node?.weaknessScore, node?.weakness_score)) > 0; }
export function nodeRevisionDue(node) { return node?.isRevisionDue === true || node?.revisionDue === true; }
export function treeLeaves(nodes) {
  return list(nodes).flatMap((node) => nodeChildren(node).length ? treeLeaves(nodeChildren(node)) : [node]);
}
export function normalizePaper(raw) {
  const data = unwrapPayload(raw, ['hierarchy', 'summary', 'title']);
  const hierarchy = firstDefined(data.hierarchy, data.tree, data.paper?.hierarchy);
  if (!Array.isArray(hierarchy)) throw new Error('The server did not return a usable syllabus hierarchy. No topics have been invented.');
  const summary = data.summary || {};
  const leaves = treeLeaves(hierarchy);
  return {
    ...data, hierarchy, summary: {
      ...summary,
      totalNodes: firstDefined(summary.totalNodes, leaves.length),
      coveredNodes: firstDefined(summary.coveredNodes, leaves.filter((n) => ['covered', 'revised', 'mastered'].includes(normalizeNodeStatus(n.status))).length),
      revisedNodes: firstDefined(summary.revisedNodes, leaves.filter((n) => ['revised', 'mastered'].includes(normalizeNodeStatus(n.status))).length),
      weakNodesCount: firstDefined(summary.weakNodesCount, leaves.filter(nodeWeak).length),
    },
  };
}
export function filterPaperTree(nodes, filters = {}, ancestorMatch = false) {
  const q = text(filters.search).trim().toLowerCase();
  const state = text(filters.status, 'ALL');
  const pyq = text(filters.pyq, 'ALL');
  const hasFacet = state !== 'ALL' || pyq !== 'ALL';
  const walk = (node, inheritedSearch) => {
    const ownSearch = !q || inheritedSearch || searchText(nodeName(node), nodeId(node), node.subject, node.section).includes(q);
    const ownStatus = state === 'ALL' ||
      (state === 'WEAK' ? nodeWeak(node) : state === 'REVISION_DUE' ? nodeRevisionDue(node) : normalizeNodeStatus(node.status) === state.toLowerCase());
    const linked = nodeLinked(node), attempted = nodeAttempted(node);
    const ownPyq = pyq === 'ALL' || (pyq === 'HAS_PYQS' && linked > 0) || (pyq === 'UNATTEMPTED' && linked > attempted);
    const children = nodeChildren(node);
    const retained = children.map((child) => walk(child, ownSearch && !hasFacet)).filter(Boolean);
    const ownMatch = ownSearch && ownStatus && ownPyq;
    if (!ownMatch && !retained.length) return null;
    return { ...node, children: ownMatch && !hasFacet && ownSearch ? children : retained, __matchesFilter: ownMatch };
  };
  return list(nodes).map((node) => walk(node, ancestorMatch)).filter(Boolean);
}
export function weaknessEntry(nodeIdValue, stage, map) {
  if (!nodeIdValue || !map) return null;
  return map[`${nodeIdValue}::${stage || ''}`] || map[nodeIdValue] ||
    Object.values(map).find((v) => text(firstDefined(v?.node_id, v?.nodeId)) === nodeIdValue && (!stage || !v.stage || v.stage === stage)) || null;
}
export function hasPerformanceEvidence(item, weaknessMap = {}) {
  const signal = weaknessEntry(item?.nodeId, item?.stage, weaknessMap);
  if (item?.isWeak === true && item?.evidenceType && !['coverage', 'untouched'].includes(item.evidenceType)) return true;
  const fields = ['attemptedPyqCount', 'attemptedPyqs', 'testsAttempted', 'testCount', 'mistakeCount', 'wrongCount', 'incorrectCount', 'evidenceCount'];
  const hasCounts = (object) => fields.some((key) => count(object?.[key]) > 0);
  const explicitPerformance = (object) => ['test', 'pyq', 'mistake', 'performance', 'answer_evaluation'].includes(text(object?.evidenceType).toLowerCase());
  return hasCounts(item) || hasCounts(signal) || explicitPerformance(item) || explicitPerformance(signal);
}
export function classifyAttention(data, weaknessMap = {}) {
  const all = list(data?.weakZones);
  return {
    observed: all.filter((item) => hasPerformanceEvidence(item, weaknessMap)),
    gaps: all.filter((item) => !hasPerformanceEvidence(item, weaknessMap)),
    untouched: list(data?.untouchedZones),
  };
}
export function chooseMentorPriority(data, weaknessMap = {}) {
  const evidence = overviewEvidence(data);
  const groups = classifyAttention(data, weaknessMap);
  const actions = list(data?.nextActions);
  const actionable = actions.find((a) => a.nodeId) || null;
  const target = evidence.any
    ? actionable || groups.observed[0] || groups.gaps[0] || groups.untouched[0] || actions[0] || null
    : groups.untouched[0] || actions.find((a) => a.nodeId) || actions[0] || null;
  const isObserved = target && groups.observed.includes(target);
  const isUntouched = target && groups.untouched.includes(target);
  return {
    baseline: !evidence.any,
    title: !evidence.any ? 'Building your syllabus baseline' : isObserved ? 'Your next priority is ready' : 'A clear next step for your preparation',
    label: text(firstDefined(target?.topicLabel, target?.label), !evidence.any ? 'Choose your first study topic' : 'Review your preparation plan'),
    reason: !evidence.any
      ? 'There is not enough study, PYQ and test evidence to diagnose your strengths or weaknesses yet.'
      : text(target?.reason, isObserved ? 'Recorded performance signals suggest this area needs attention.' : 'This is a suggested starting point from your current syllabus data.'),
    action: text(firstDefined(target?.suggestedAction, target?.action), isUntouched ? 'Study the concept, attempt linked PYQs and record your review.' : 'Open the topic to review its evidence and choose the next action.'),
    target,
    evidence,
  };
}
export function normalizeQuestion(raw) {
  const q = raw || {};
  const stageRaw = text(q.stage).toLowerCase();
  const stage = stageRaw === 'prelims' || stageRaw === 'csat' ? 'prelims' : ['mains', 'ethics', 'essay', 'optional'].includes(stageRaw) ? 'mains' : 'unknown';
  const attemptStatus = text(q.attemptStatus).toLowerCase().replace(/[\s-]+/g, '_');
  const attempted = ['attempted', 'correct', 'incorrect'].includes(attemptStatus) || q.isCorrect === true || q.isCorrect === false || q.attempted === true;
  return { ...q, id: firstDefined(q.id, q.questionId), stage, originalStage: stageRaw,
    attemptStatus: attempted ? 'attempted' : ['unattempted', 'not_attempted', 'new'].includes(attemptStatus) || q.attempted === false ? 'unattempted' : 'unknown',
    question: firstDefined(q.question, q.questionText, q.text),
    physicalPaper: firstDefined(q.physicalPaper, q.examPaper, q.paperLabel, q.paper),
  };
}
export function questionAttempt(q) {
  if (q.attemptStatus === 'unattempted') return { key: 'unattempted', label: 'Not attempted', tone: 'neutral' };
  if (q.attemptStatus !== 'attempted') return { key: 'unknown', label: 'Status unavailable', tone: 'neutral' };
  if (q.isCorrect === true) return { key: 'correct', label: 'Correct', tone: 'success' };
  if (q.isCorrect === false) return { key: 'incorrect', label: 'Incorrect', tone: 'danger' };
  return { key: 'attempted', label: 'Attempted', tone: 'info' };
}
export function filterQuestions(questions, filters = {}) {
  const q = text(filters.search).toLowerCase().trim();
  return list(questions).filter((item) => {
    if (filters.stage && filters.stage !== 'ALL' && item.stage !== filters.stage.toLowerCase()) return false;
    if (filters.status && filters.status !== 'ALL' && questionAttempt(item).key !== filters.status.toLowerCase()) return false;
    return !q || searchText(item.question, item.id, item.year, item.physicalPaper).includes(q);
  });
}
export function questionDestination(q, context = {}, routes = {}) {
  const prelimsRoute = routes.prelims || '/prelims';
  const mainsRoute = routes.mains || '/mains/answer-writing';
  const isPrelims = q.stage === 'prelims';
  const route = isPrelims ? prelimsRoute : mainsRoute;
  const params = new URLSearchParams({ questionId: text(q.id) });
  return {
    pathname: route,
    search: `?${params.toString()}`,
    state: { source: 'syllabus', questionId: q.id, question: q, selectedQuestion: q,
      nodeId: context.nodeId, paperKey: context.paperKey },
  };
}
