import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '../styles/syllabus-intelligence.css';
import {
  canonicalPaperKey, count, dateText, filterQuestions, firstDefined, list, nodeChildren,
  nodeId, nodeLinked, nodeName, nodeStatus, normalizeQuestion, numberText, paperInfo,
  paperPath, percent, questionAttempt, questionDestination, ratioPercent, text, timeText,
  topicPath, focusPath, revisionPath, mistakesPath, unwrapPayload,
} from './syllabus-intelligence';
import {
  Badge, Button, EmptyState, Icon, PageHeader, Progress, ResourceState, SearchInput,
  SectionHeading, Segmented, Select, getJson, useSyllabusResource,
} from './syllabus-ui';

const ATTEMPT_OPTIONS = [
  { value: 'ALL', label: 'All attempt states' }, { value: 'UNATTEMPTED', label: 'Not attempted' },
  { value: 'ATTEMPTED', label: 'Attempted' }, { value: 'CORRECT', label: 'Correct' },
  { value: 'INCORRECT', label: 'Incorrect' }, { value: 'UNKNOWN', label: 'Status unavailable' },
];
const PAGE_SIZE = 20;

function EvidenceCard({ label, value, helper, icon, tone = 'blue' }) {
  return <div className="si-evidence-card"><span className={`si-icon si-icon--${tone}`}><Icon name={icon} size={19}/></span><span className="si-evidence-card__label">{label}</span><strong>{value}</strong><p>{helper}</p></div>;
}
function TopicEvidence({ data }) {
  const coverage = data.coverage || {};
  const pyq = data.pyqSummary || {};
  const status = nodeStatus(coverage.status);
  const attempted = count(pyq.attempted);
  const total = firstDefined(pyq.total, pyq.linkedPyqCount);
  const weakness = coverage.isWeak === true || count(coverage.weaknessScore) > 0;
  const hasSignals = weakness || Boolean(coverage.weaknessReason);
  return <section className="si-section"><SectionHeading title="Preparation evidence" description="Coverage, question exposure and revision are separate signals. Missing evidence is not treated as poor performance."/>
    <div className="si-evidence-grid">
      <EvidenceCard label="Coverage status" value={<Badge tone={status.tone}>{status.label}</Badge>} helper={coverage.coveragePercent != null ? `${percent(coverage.coveragePercent)} recorded coverage` : 'No coverage percentage reported'} icon="book" tone="blue"/>
      <EvidenceCard label="PYQ exposure" value={`${numberText(attempted)} / ${total != null ? numberText(total) : '—'}`} helper={total != null ? `${percent(ratioPercent(attempted, total))} of linked questions attempted` : 'Linked question total unavailable'} icon="file" tone="violet"/>
      <EvidenceCard label="Revision evidence" value={count(coverage.revisionCount) ? `${numberText(coverage.revisionCount)} revisits` : '—'} helper={coverage.lastRevisedAt ? `Last revised ${dateText(coverage.lastRevisedAt)}` : 'No revision recorded'} icon="repeat" tone="teal"/>
      <EvidenceCard label="Weakness signals" value={weakness ? <Badge tone="warning">Needs attention</Badge> : <Badge tone="neutral">{hasSignals ? 'Evidence available' : 'Not assessed'}</Badge>} helper={coverage.weaknessReason || 'No recorded weakness signal. This does not establish mastery.'} icon="target" tone="amber"/>
    </div>
    <div className="si-evidence-foot"><span><Icon name="clock" size={15}/> Last study: {dateText(firstDefined(coverage.lastStudyAt, coverage.lastStudiedAt, coverage.lastActivityAt))}</span>{coverage.isRevisionDue && <Badge tone="warning">Revision due</Badge>}{pyq.correctPercent != null && attempted > 0 && <span>Recorded PYQ accuracy: {percent(pyq.correctPercent)}</span>}</div>
  </section>;
}
function MentorGuidance({ data, nodeIdValue, navigate }) {
  const action = data.mentorAction || {};
  const recommendations = list(action.recommendations).filter(Boolean);
  const hasAction = Boolean(action.statusSummary || recommendations.length);
  return <section className="si-guidance"><div className="si-guidance__header"><span className="si-icon si-icon--blue"><Icon name="spark" size={21}/></span><div><div className="si-eyebrow">MENTOR GUIDANCE</div><h2>{hasAction ? 'Your next step' : 'Build evidence for this topic'}</h2></div></div>
    <p>{action.statusSummary || 'No topic-specific recommendation has been recorded yet. Start with a focused study block, then use linked PYQs and revision to build evidence.'}</p>
    {recommendations.length > 0 && <ol className="si-guidance__steps">{recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}</ol>}
    <div className="si-inline-actions"><Button variant="primary" icon="arrowRight" onClick={() => navigate(focusPath(nodeIdValue))}>Start focus block</Button><Button to={revisionPath(nodeIdValue)} variant="secondary" icon="calendar">Schedule revision</Button><Button to={mistakesPath(nodeIdValue)} variant="ghost">View mistakes</Button></div>
  </section>;
}
function ChildTopics({ data, paperKey }) {
  const children = list(data.children).length ? data.children : nodeChildren(data.node);
  if (!children.length) return null;
  return <section className="si-section"><SectionHeading title="Subtopics" description="Follow the canonical hierarchy without losing the parent topic." action={<span className="si-section-count">{numberText(children.length)} items</span>}/><div className="si-child-grid">{children.map((child, index) => {
    const id = nodeId(child);
    const status = nodeStatus(child.status);
    return <Link className="si-child-card" to={topicPath(paperKey, id)} key={id || index}><div><strong>{nodeName(child)}</strong><small>{id}</small></div><div><Badge tone={status.tone}>{status.label}</Badge><span>{numberText(nodeLinked(child))} linked PYQs</span></div><Icon name="arrowRight" size={18}/></Link>;
  })}</div></section>;
}
function QuestionOptions({ options }) {
  if (!options || typeof options !== 'object') return null;
  const entries = Array.isArray(options) ? options.map((value, index) => [String.fromCharCode(65 + index), value]) : Object.entries(options);
  return <div className="si-question-options">{entries.map(([key, value]) => <div key={key}><span>{key}</span><p>{typeof value === 'string' || typeof value === 'number' ? value : text(value?.text, 'Option text unavailable')}</p></div>)}</div>;
}
function QuestionCard({ question, nodeIdValue, paperKey, navigate, practiceRoutes }) {
  const q = question;
  const attempt = questionAttempt(q);
  const isPrelims = q.stage === 'prelims';
  const canOpen = Boolean(q.id && q.stage !== 'unknown');
  const open = () => navigate(questionDestination(q, { nodeId: nodeIdValue, paperKey }, practiceRoutes));
  return <article className="si-question-card"><div className="si-question-card__head"><div className="si-question-card__tags"><Badge tone="neutral">{q.year ? `UPSC CSE ${q.year}` : 'UPSC PYQ'}</Badge><Badge tone="info">{q.originalStage ? text(q.originalStage).toUpperCase() : 'STAGE UNKNOWN'}</Badge>{q.physicalPaper && <span className="si-question-card__paper">{q.physicalPaper}</span>}{q.marks != null && <span className="si-question-card__paper">{q.marks} marks</span>}</div><Badge tone={attempt.tone}>{attempt.label}</Badge></div>
    <p className="si-question-card__text">{q.question || 'Question text unavailable in the current inventory.'}</p>
    {isPrelims && <QuestionOptions options={q.options}/>}
    <div className="si-question-card__footer"><span className="si-question-card__id">{q.id}</span><Button variant={attempt.key === 'attempted' || attempt.key === 'correct' || attempt.key === 'incorrect' ? 'secondary' : 'primary'} icon="arrowRight" onClick={open} disabled={!canOpen}>{isPrelims ? 'Solve Prelims PYQ' : q.stage === 'mains' ? 'Write Mains Answer' : 'Question route unavailable'}</Button></div>
  </article>;
}
function PyqBrowser({ data, loading, error, refresh, nodeIdValue, paperKey, navigate, practiceRoutes }) {
  const [stage, setStage] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const questions = useMemo(() => list(data?.questions).map(normalizeQuestion), [data]);
  const filtered = useMemo(() => filterQuestions(questions, { stage, status, search }), [questions, stage, status, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setFilter = (setter) => (value) => { setter(value); setPage(1); };
  const summary = data?.summary || {};
  const totalAvailable = firstDefined(summary.total, summary.totalPyqs, data?.total, data?.pyqSummary?.total);
  const stages = [
    { value: 'ALL', label: `All (${numberText(questions.length)})` },
    { value: 'PRELIMS', label: `Prelims (${numberText(questions.filter((q) => q.stage === 'prelims').length)})` },
    { value: 'MAINS', label: `Mains (${numberText(questions.filter((q) => q.stage === 'mains').length)})` },
  ];
  return <section className="si-section" id="linked-pyqs"><SectionHeading title="Linked PYQ browser" description="Real questions from the existing inventory. Browse by exam stage and your recorded attempt state." action={<Button variant="ghost" icon="refresh" onClick={refresh} disabled={loading}>Refresh questions</Button>}/>
    <div className="si-pyq-browser"><div className="si-pyq-browser__toolbar"><Segmented options={stages} value={stage} onChange={setFilter(setStage)} label="Exam stage"/><SearchInput value={search} onChange={setFilter(setSearch)} placeholder="Search question text, year or ID"/><Select label="Attempt state" value={status} onChange={setFilter(setStatus)} options={ATTEMPT_OPTIONS}/></div>
      <div className="si-pyq-browser__summary"><span><strong>{numberText(filtered.length)}</strong> questions in this view</span>{data?.mappingStatus && <Badge tone={data.mappingStatus === 'unresolved' ? 'warning' : 'neutral'}>{text(data.mappingStatus).replace(/_/g, ' ')}</Badge>}{totalAvailable != null && <span>{numberText(totalAvailable)} reported linked PYQs</span>}</div>
      {loading && !data ? <div className="si-loading" role="status"><span className="si-spinner"/>Loading linked questions…</div> : error && !data ? <EmptyState icon="alert" title="Unable to load linked questions" description={error} action={<Button onClick={refresh}>Try again</Button>}/> : visible.length ? <div className="si-question-list">{visible.map((q, index) => <QuestionCard key={q.id || index} question={q} nodeIdValue={nodeIdValue} paperKey={paperKey} navigate={navigate} practiceRoutes={practiceRoutes}/>)}</div> : <EmptyState title="No questions in this view" description={questions.length ? 'Try a different stage, attempt state or search.' : 'No hydrated linked questions are available for this node. This does not mean the wider PYQ inventory is empty.'} action={questions.length ? <Button onClick={() => { setStage('ALL'); setStatus('ALL'); setSearch(''); setPage(1); }}>Clear question filters</Button> : null}/ >}
      {filtered.length > PAGE_SIZE && <nav className="si-pagination" aria-label="Question pages"><span>Showing {numberText((page - 1) * PAGE_SIZE + 1)}–{numberText(Math.min(page * PAGE_SIZE, filtered.length))} of {numberText(filtered.length)}</span><div><Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button><span>Page {page} of {pages}</span><Button variant="secondary" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>Next</Button></div></nav>}
      {error && data && <p className="si-data-note" role="status">Could not refresh question data: {error}. Previously loaded questions remain visible.</p>}
    </div>
  </section>;
}

export default function SyllabusTopicPage({ prelimsRoute = '/prelims/practice', mainsRoute = '/mains/answer-writing' }) {
  const { paperKey, nodeId: routeNodeId } = useParams();
  const navigate = useNavigate();
  const key = canonicalPaperKey(paperKey);
  const [tab, setTab] = useState('overview');
  useEffect(() => { setTab('overview'); }, [routeNodeId]);
  const loadNode = useCallback(async (signal) => {
    const value = unwrapPayload(await getJson(`/api/syllabus/nodes/${encodeURIComponent(routeNodeId)}`, signal), ['node', 'coverage', 'breadcrumbs']);
    if (!value.node) throw new Error('The server did not return the requested canonical node.');
    return value;
  }, [routeNodeId]);
  const loadQuestions = useCallback(async (signal) => unwrapPayload(await getJson(`/api/syllabus/nodes/${encodeURIComponent(routeNodeId)}/pyqs`, signal), ['questions']), [routeNodeId]);
  const nodeResource = useSyllabusResource(loadNode, [routeNodeId]);
  const pyqResource = useSyllabusResource(loadQuestions, [routeNodeId]);
  const data = nodeResource.data;
  const node = data?.node;
  const status = nodeStatus(data?.coverage?.status);
  const breadcrumbs = [{ label: 'Syllabus', to: '/syllabus' }, { label: paperInfo(key).label, to: paperPath(key) }, ...list(data?.breadcrumbs).filter((b) => b?.label && b.label !== 'Syllabus' && b.label !== paperInfo(key).label).map((b) => ({ label: b.label, to: b.path || undefined }))];
  if (!breadcrumbs.length || breadcrumbs[breadcrumbs.length - 1]?.label !== nodeName(node)) breadcrumbs.push({ label: nodeName(node) });
  const practiceRoutes = { prelims: prelimsRoute, mains: mainsRoute };
  return <main className="si si-topic-workspace">
    <PageHeader eyebrow="TOPIC INTELLIGENCE" title={node ? nodeName(node) : 'Topic intelligence'} description={node?.subject ? [node.subject, node.section].filter(Boolean).join(' · ') : 'Coverage, revision and linked question evidence'} breadcrumbs={breadcrumbs}><Button variant="secondary" icon="refresh" onClick={() => { nodeResource.refresh(); pyqResource.refresh(); }} disabled={nodeResource.loading}>Refresh</Button></PageHeader>
    <ResourceState loading={nodeResource.loading} error={nodeResource.error} onRetry={nodeResource.refresh} label="topic intelligence">{data && <>
      <div className="si-topic-topline"><div><Badge tone={status.tone}>{status.label}</Badge><span>{paperInfo(key).label}</span><span className="si-topic-topline__id">Canonical ID: {routeNodeId}</span></div><Link to={paperPath(key)} className="si-text-link"><Icon name="arrowLeft" size={16}/> Back to paper</Link></div>
      <nav className="si-topic-tabs" aria-label="Topic sections"><button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')} aria-current={tab === 'overview' ? 'page' : undefined}>Overview</button><button type="button" className={tab === 'pyqs' ? 'is-active' : ''} onClick={() => setTab('pyqs')} aria-current={tab === 'pyqs' ? 'page' : undefined}>Linked PYQs {pyqResource.data?.questions?.length != null ? `(${numberText(pyqResource.data.questions.length)})` : ''}</button></nav>
      {tab === 'overview' ? <><TopicEvidence data={data}/><MentorGuidance data={data} nodeIdValue={routeNodeId} navigate={navigate}/><ChildTopics data={data} paperKey={key}/><div className="si-help-strip"><Icon name="file" size={19}/><div><strong>Explore the evidence behind this topic</strong><p>Browse linked questions, check what you have attempted and open the existing practice or answer-writing workflow.</p></div><Button variant="secondary" onClick={() => setTab('pyqs')} icon="arrowRight">Browse PYQs</Button></div></> : <PyqBrowser key={routeNodeId} data={pyqResource.data} loading={pyqResource.loading} error={pyqResource.error} refresh={pyqResource.refresh} nodeIdValue={routeNodeId} paperKey={key} navigate={navigate} practiceRoutes={practiceRoutes}/>}
    </>}</ResourceState>
  </main>;
}
