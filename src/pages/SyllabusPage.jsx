import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/syllabus-intelligence.css';
import {
  PAPERS, canonicalPaperKey, classifyAttention, chooseMentorPriority, count, dateText,
  firstDefined, list, normalizeDashboard, numberText, overviewEvidence, paperInfo, paperPath,
  paperReadiness, percent, preparationStatus, ratioPercent, searchText, text, timeText,
  topicPath, focusPath, verifiedUserId, readinessState,
} from './syllabus-intelligence';
import {
  Badge, Button, EmptyState, FilterReset, Icon, Metric, PageHeader, Progress,
  ResourceState, SearchInput, SectionHeading, Segmented, Select, getJson,
  getJsonWithFallback, useSyllabusResource,
} from './syllabus-ui';

const INITIAL_FILTERS = { paper: 'ALL', status: 'ALL', search: '' };
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All readiness states' },
  { value: 'no_evidence', label: 'No evidence' },
  { value: 'critical', label: 'Critical' }, { value: 'lagging', label: 'Lagging' },
  { value: 'balanced', label: 'Balanced' }, { value: 'strong', label: 'Strong' },
  { value: 'exam_ready', label: 'Exam ready' },
];

function SummaryMetrics({ dashboard }) {
  const summary = dashboard.summary;
  const evidence = overviewEvidence(dashboard);
  const readiness = readinessState(summary.overallReadinessScore, summary, evidence);
  const totalNodes = firstDefined(summary.totalNodes, summary.syllabusTotalNodes);
  const totalPyqs = firstDefined(summary.totalPyqs, summary.availablePyqs);
  return <section className="si-metrics" aria-label="Overall preparation evidence">
    <Metric label="Syllabus coverage" value={percent(summary.overallSyllabusCoveragePercent)} helper={totalNodes != null ? `${numberText(firstDefined(summary.coveredNodes, 0))} of ${numberText(totalNodes)} nodes covered` : 'Node-level completion'} icon="book" tone="blue" progress={summary.overallSyllabusCoveragePercent}/>
    <Metric label="PYQ exposure" value={percent(summary.overallPyqCoveragePercent)} helper={totalPyqs != null ? `${numberText(firstDefined(summary.attemptedPyqs, 0))} of ${numberText(totalPyqs)} questions attempted` : 'Unique questions attempted'} icon="file" tone="violet" progress={summary.overallPyqCoveragePercent}/>
    <Metric label="Revision depth" value={percent(summary.overallRevisionPercent)} helper="Recorded revisits and reinforcement" icon="repeat" tone="teal" progress={summary.overallRevisionPercent}/>
    <Metric label="Readiness" value={readiness.value} helper={readiness.available ? 'Based on recorded study, PYQs and tests' : 'Complete study, PYQ and test evidence to establish a score'} icon="chart" tone="green"/>
  </section>;
}

function MentorVerdict({ dashboard, weaknessMap, onFocus }) {
  const priority = useMemo(() => chooseMentorPriority(dashboard, weaknessMap), [dashboard, weaknessMap]);
  const target = priority.target;
  const destination = target?.nodeId ? topicPath(target.paperKey, target.nodeId) : target?.paperKey ? paperPath(target.paperKey) : '/plan';
  const evidence = priority.evidence;
  const readiness = readinessState(dashboard.summary?.overallReadinessScore, dashboard.summary, evidence);
  return <section className="si-verdict" aria-labelledby="si-verdict-title">
    <div className="si-verdict__main">
      <div className="si-verdict__eyebrow"><span className="si-verdict__mark"><Icon name="spark" size={18}/></span><span>MENTOR VERDICT</span><Badge tone={priority.baseline ? 'info' : 'success'}>{priority.baseline ? 'Baseline building' : readiness.available ? 'Evidence active' : 'Early signals'}</Badge></div>
      <h2 id="si-verdict-title">{priority.title}</h2>
      <p className="si-verdict__description">{priority.reason}</p>
      <div className="si-verdict__evidence"><span><Icon name="checkCircle" size={15}/> {evidence.study ? 'Study evidence recorded' : 'Study evidence pending'}</span><span><Icon name="file" size={15}/> {evidence.pyq ? 'PYQ attempts recorded' : 'PYQ attempts pending'}</span><span><Icon name="chart" size={15}/> {evidence.test ? 'Test evidence recorded' : 'Test evidence pending'}</span></div>
      {target?.nodeId && <Link className="si-text-link si-verdict__detail" to={destination}>View topic evidence <Icon name="arrowRight" size={16}/></Link>}
    </div>
    <div className="si-verdict__action">
      <div className="si-eyebrow">{priority.baseline ? 'SUGGESTED STARTING POINT' : 'YOUR NEXT STEP'}</div>
      <h3>{priority.label}</h3>
      <p>{priority.action}</p>
      <div className="si-verdict__buttons">
        {target?.nodeId ? <Button variant="primary" icon="arrowRight" onClick={() => onFocus(target.nodeId)}>Open focus block</Button> : <Button variant="primary" to={destination} icon="arrowRight">Open preparation plan</Button>}
        {target?.nodeId && <Button to={destination} variant="secondary">View topic</Button>}
      </div>
      {priority.baseline && <small>Suggested from existing syllabus data, not a measured weakness.</small>}
    </div>
  </section>;
}

function PaperCard({ paper }) {
  const info = paperInfo(paper.paperKey);
  const totals = paper.totals || {};
  const pyq = paper.pyq || {};
  const progress = paper.progress || {};
  const status = preparationStatus(paper);
  const readiness = paperReadiness(paper);
  return <article className="si-paper-card">
    <div className="si-paper-card__top"><span className={`si-paper-icon si-paper-icon--${info.color}`}>{info.short}</span><div className="si-paper-card__identity"><h3>{paper.paperLabel || info.label}</h3><p>{paper.subtitle || info.description}</p></div><Link className="si-icon-link" to={paperPath(paper.paperKey)} aria-label={`Open ${info.label}`}><Icon name="arrowRight" size={18}/></Link></div>
    <div className="si-paper-card__status"><Badge tone={status.tone}>{status.label}</Badge>{status.key !== 'no_evidence' && readiness.available && <span className="si-paper-card__readiness">Readiness {readiness.value}</span>}</div>
    <div className="si-paper-card__coverage"><strong>{percent(progress.syllabusPercent)}</strong><span>{numberText(totals.coveredNodes)} / {numberText(totals.totalNodes)} nodes covered</span></div>
    <Progress value={progress.syllabusPercent} label={`${info.label} syllabus coverage`} tone={info.color}/>
    <div className="si-paper-card__facts"><div><span>PYQ exposure</span><strong>{percent(progress.pyqPercent)}</strong></div><div><span>Revision</span><strong>{percent(progress.revisionPercent)}</strong></div><div><span>Not started</span><strong>{numberText(totals.untouchedNodes)}</strong></div></div>
    <div className="si-paper-card__footer"><span>{numberText(pyq.attemptedPyqs)} / {numberText(pyq.totalPyqs)} PYQs attempted</span><Link to={paperPath(paper.paperKey)}>Explore <Icon name="arrowRight" size={15}/></Link></div>
  </article>;
}

function PriorityQueue({ dashboard, weaknessMap, filters, navigate }) {
  const [tab, setTab] = useState('actions');
  const [showAll, setShowAll] = useState(false);
  const groups = useMemo(() => classifyAttention(dashboard, weaknessMap), [dashboard, weaknessMap]);
  const matches = (item) => {
    if (filters.paper !== 'ALL' && canonicalPaperKey(item.paperKey) !== canonicalPaperKey(filters.paper)) return false;
    return !filters.search || searchText(item.topicLabel, item.label, item.nodeId, item.reason, item.action, item.suggestedAction).includes(filters.search.toLowerCase());
  };
  const actions = list(dashboard.nextActions).filter(matches);
  const observed = groups.observed.filter(matches);
  const gaps = groups.gaps.filter(matches);
  const untouched = groups.untouched.filter(matches);
  const options = [
    { value: 'actions', label: `Next actions (${actions.length})` },
    { value: 'weak', label: `Observed weakness (${observed.length})` },
    { value: 'gaps', label: `Coverage gaps (${gaps.length})` },
    { value: 'untouched', label: `Not started (${untouched.length})` },
  ];
  const rows = tab === 'actions' ? actions : tab === 'weak' ? observed : tab === 'gaps' ? gaps : untouched;
  const descriptions = {
    actions: 'Recommendations supplied by MentorOS. Open a topic to see its evidence before acting.',
    weak: 'Recorded performance signals, not simply topics with low syllabus coverage.',
    gaps: 'Preparation coverage requiring attention. These are not automatically proven weaknesses.',
    untouched: 'Topics with no recorded coverage. The backend supplies their suggested order.',
  };
  const visible = showAll ? rows : rows.slice(0, 5);
  return <section className="si-section" aria-labelledby="si-queue-title">
    <SectionHeading id="si-queue-title" title="What needs your attention" description="One queue for recommendations and preparation gaps, without repeating the same lists."/>
    <div className="si-panel si-queue"><div className="si-queue__toolbar"><Segmented options={options} value={tab} onChange={(value) => { setTab(value); setShowAll(false); }} label="Priority category"/></div><p className="si-queue__description">{descriptions[tab]}</p>
      {visible.length ? <div className="si-queue__rows">{visible.map((item, index) => {
        const title = item.topicLabel || item.label || item.nodeId || 'Recommended action';
        const reason = tab === 'actions' ? item.action : item.reason || item.suggestedAction || 'Open the topic for its recorded evidence.';
        const target = item.nodeId ? topicPath(item.paperKey, item.nodeId) : item.paperKey ? paperPath(item.paperKey) : '/plan';
        return <div className="si-queue-row" key={`${tab}-${item.nodeId || title}-${index}`}><span className="si-queue-row__number">{String(index + 1).padStart(2, '0')}</span><div className="si-queue-row__body"><div className="si-queue-row__title"><strong>{title}</strong>{item.priority && <Badge tone={tab === 'weak' ? 'warning' : 'neutral'}>{prettyPriority(item.priority)}</Badge>}</div><p>{reason}</p>{item.paperKey && <small>{paperInfo(item.paperKey).label}{item.linkedPyqCount != null ? ` · ${numberText(item.linkedPyqCount)} linked PYQs` : ''}{item.suggestedBlockMinutes ? ` · ${numberText(item.suggestedBlockMinutes)} min suggested` : ''}</small>}</div><div className="si-queue-row__actions">{item.nodeId && <Button variant="ghost" onClick={() => navigate(focusPath(item.nodeId))}>Focus</Button>}<Button to={target} variant="secondary" icon="arrowRight">{item.nodeId ? 'Details' : 'Open'}</Button></div></div>;
      })}</div> : <EmptyState title={tab === 'weak' ? 'No observed weaknesses to show' : 'Nothing matches this view'} description={tab === 'weak' ? 'A low coverage score alone is not proof of weakness. Recorded test and mistake signals will appear here when available.' : 'Try another category or clear the filters.'}/>}
      {rows.length > 5 && <div className="si-queue__footer"><Button variant="ghost" onClick={() => setShowAll((value) => !value)} icon={showAll ? 'chevronDown' : 'arrowRight'}>{showAll ? 'Show fewer' : `Show all ${numberText(rows.length)}`}</Button></div>}
    </div>
  </section>;
}
function prettyPriority(value) { return text(value).replace(/[_-]/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()); }

function Details({ dashboard, filters }) {
  const [source, setSource] = useState('ALL');
  const rows = list(dashboard.tableRows).filter((row) => filters.paper === 'ALL' || canonicalPaperKey(row.paperKey) === canonicalPaperKey(filters.paper));
  const activity = list(dashboard.recentActivity).filter((row) => (source === 'ALL' || row.source === source) && (filters.paper === 'ALL' || canonicalPaperKey(row.paperKey) === canonicalPaperKey(filters.paper)) && (!filters.search || searchText(row.label, row.paperKey, row.mappedNodeIds).includes(filters.search.toLowerCase())));
  const sources = [...new Set(list(dashboard.recentActivity).map((row) => row.source).filter(Boolean))];
  const metadata = dashboard.meta || {};
  return <details className="si-details"><summary><span className="si-details__icon"><Icon name="chart" size={20}/></span><span><strong>Detailed coverage and evidence</strong><small>Full audit table, source activity and inventory metadata</small></span><Icon name="chevronDown" size={19}/></summary><div className="si-details__content">
    <div className="si-section-heading"><div><h2>Coverage audit</h2><p>Reported totals from the syllabus API. Percentages do not imply readiness.</p></div></div>
    <div className="si-table-scroll"><table className="si-table"><thead><tr><th>Paper</th><th>Nodes</th><th>Covered</th><th>Revised</th><th>Untouched</th><th>Available PYQs</th><th>Attempted</th><th>Accuracy</th><th>Weak</th><th>Readiness</th><th>Last activity</th></tr></thead><tbody>{rows.map((row) => {
      const paper = list(dashboard.papers).find((p) => canonicalPaperKey(p.paperKey) === canonicalPaperKey(row.paperKey));
      const readiness = paper ? paperReadiness(paper) : readinessState(row.readinessScore, row, { study: count(row.touchedNodes) > 0, pyq: count(row.attemptedPyqs) > 0, test: count(row.sectionalTests) + count(row.fullTests) + count(row.institutionalTests) > 0 });
      return <tr key={row.paperKey || row.paperLabel}><th scope="row"><Link to={paperPath(row.paperKey)}>{row.paperLabel || row.paperKey}</Link></th><td>{numberText(row.totalNodes)}</td><td>{numberText(row.coveredNodes)}</td><td>{numberText(row.revisedNodes)}</td><td>{numberText(row.untouchedNodes)}</td><td>{numberText(row.totalPyqs)}</td><td>{numberText(row.attemptedPyqs)}</td><td>{count(row.attemptedPyqs) ? percent(row.correctPercent) : '—'}</td><td>{numberText(row.weakZones)}</td><td>{readiness.value}</td><td>{dateText(row.lastActivityAt)}</td></tr>;
    })}</tbody></table></div>
    <div className="si-details__activity-head"><h3>Recent activity</h3><Select label="Activity source" value={source} onChange={setSource} options={[{ value: 'ALL', label: 'All sources' }, ...sources.map((value) => ({ value, label: text(value).replace(/_/g, ' ') }))]}/></div>
    {activity.length ? <div className="si-activity-list">{activity.map((item, index) => <div className="si-activity-row" key={`${item.time}-${index}`}><div><strong>{item.label || item.activityType || 'Study activity'}</strong><small>{[item.paperKey, item.source, item.activityType].filter(Boolean).join(' · ')}</small></div><time>{timeText(item.time)}</time></div>)}</div> : <EmptyState title="No activity matches these filters" description="Recorded study and test events will appear here."/>}
    {(metadata.mappingCompleteness != null || metadata.unresolvedMappings != null) && <p className="si-data-note">Inventory data quality: {metadata.mappingCompleteness != null ? `Mapping completeness ${percent(metadata.mappingCompleteness)}. ` : ''}{metadata.unresolvedMappings != null ? `${numberText(metadata.unresolvedMappings)} unresolved mappings.` : ''} Mapping completeness is not learner PYQ exposure.</p>}
  </div></details>;
}

export default function SyllabusPage({ userId = null }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [weaknessMap, setWeaknessMap] = useState({});
  const [weaknessError, setWeaknessError] = useState('');
  const loadDashboard = useCallback(async (signal) => normalizeDashboard(await getJsonWithFallback(['/api/syllabus/dashboard', '/api/syllabus'], signal)), []);
  const { data: dashboard, loading, error, refresh } = useSyllabusResource(loadDashboard, []);
  const identity = verifiedUserId(dashboard, userId);
  useEffect(() => {
    if (!dashboard) return undefined;
    const controller = new AbortController();
    setWeaknessMap({}); setWeaknessError('');
    const url = `/api/weakness/map${identity ? `?userId=${encodeURIComponent(identity)}` : ''}`;
    getJson(url, controller.signal).then((value) => { if (!controller.signal.aborted) setWeaknessMap(value.map || {}); }).catch((err) => {
      if (!controller.signal.aborted) setWeaknessError(err?.message || 'Weakness signals unavailable.');
    });
    return () => controller.abort();
  }, [dashboard, identity]);
  const filteredPapers = useMemo(() => list(dashboard?.papers).filter((paper) => {
    if (filters.paper !== 'ALL' && canonicalPaperKey(paper.paperKey) !== canonicalPaperKey(filters.paper)) return false;
    if (filters.status !== 'ALL' && preparationStatus(paper).key !== filters.status) return false;
    return !filters.search || searchText(paper.paperKey, paper.paperLabel, paper.subtitle, paperInfo(paper.paperKey).description).includes(filters.search.toLowerCase());
  }), [dashboard, filters]);
  const activeFilters = Object.values(filters).some((value) => value && value !== 'ALL');
  return <main className="si si-overview">
    <PageHeader eyebrow="KNOWLEDGE · COVERAGE" title="Syllabus Intelligence" description="Know what’s covered, what’s weak, and what to do next." breadcrumbs={[{ label: 'Syllabus' }]}><Button variant="secondary" icon="refresh" onClick={refresh} disabled={loading}>Refresh</Button></PageHeader>
    <ResourceState loading={loading} error={error} onRetry={refresh} label="syllabus intelligence">{dashboard && <>
      <MentorVerdict dashboard={dashboard} weaknessMap={weaknessMap} onFocus={(nodeId) => navigate(focusPath(nodeId))}/>
      <SummaryMetrics dashboard={dashboard}/>
      <section className="si-section" aria-labelledby="si-subject-title"><SectionHeading id="si-subject-title" title="Subject health" description="See the preparation state of each paper. Open one to inspect its canonical syllabus and linked questions." action={<span className="si-section-count">{numberText(filteredPapers.length)} of {numberText(dashboard.papers.length)} papers</span>}/>
        <div className="si-filterbar"><SearchInput value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="Search papers or subjects"/><Select label="Paper" value={filters.paper} onChange={(value) => setFilters((prev) => ({ ...prev, paper: value }))} options={[{ value: 'ALL', label: 'All papers' }, ...PAPERS.map((paper) => ({ value: paper.key, label: paper.label }))]}/><Select label="Readiness state" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={STATUS_OPTIONS}/><FilterReset disabled={!activeFilters} onClick={() => setFilters(INITIAL_FILTERS)}/></div>
        {filteredPapers.length ? <div className="si-paper-grid">{filteredPapers.map((paper) => <PaperCard key={paper.paperKey} paper={paper}/>)}</div> : <EmptyState title="No papers match" description="Try a different search or clear the filters." action={<Button onClick={() => setFilters(INITIAL_FILTERS)}>Clear filters</Button>}/>}
      </section>
      <PriorityQueue dashboard={dashboard} weaknessMap={weaknessMap} filters={filters} navigate={navigate}/>
      <Details dashboard={dashboard} filters={filters}/>
      <footer className="si-footer"><span><Icon name="info" size={15}/> Counts and recommendations come from your recorded syllabus evidence.</span><span>{dashboard.meta.generatedAt ? `Updated ${timeText(dashboard.meta.generatedAt)}` : 'Live syllabus view'}</span></footer>
      {weaknessError && <p className="si-data-note" role="status">Additional weakness signals could not be loaded: {weaknessError}. The syllabus overview remains available.</p>}
    </>}</ResourceState>
  </main>;
}
