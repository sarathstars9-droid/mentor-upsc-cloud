import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '../styles/syllabus-intelligence.css';
import {
  PAPERS, canonicalPaperKey, count, dateText, filterPaperTree, firstDefined, list,
  nodeAttempted, nodeChildren, nodeId, nodeLinked, nodeName, nodeRevisionDue,
  nodeStatus, nodeWeak, normalizePaper, numberText, paperInfo, paperPath, percent,
  ratioPercent, text, topicPath, treeLeaves,
} from './syllabus-intelligence';
import {
  Badge, Button, EmptyState, FilterReset, Icon, PageHeader, Progress, ResourceState,
  SearchInput, SectionHeading, Select, getJsonWithFallback, useSyllabusResource,
} from './syllabus-ui';

const INITIAL_FILTERS = { search: '', status: 'ALL', pyq: 'ALL' };
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All coverage states' }, { value: 'UNTOUCHED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COVERED', label: 'Covered' },
  { value: 'REVISED', label: 'Revised' }, { value: 'MASTERED', label: 'Mastered' },
  { value: 'WEAK', label: 'Weak' }, { value: 'REVISION_DUE', label: 'Revision due' },
];
const PYQ_OPTIONS = [{ value: 'ALL', label: 'All PYQs' }, { value: 'HAS_PYQS', label: 'Has linked PYQs' }, { value: 'UNATTEMPTED', label: 'Has unattempted PYQs' }];

function HierarchyRow({ node, paperKey, depth = 0, expanded, onToggle, filtersActive }) {
  const children = nodeChildren(node);
  const id = nodeId(node);
  const status = nodeStatus(node.status);
  const open = expanded[id] === true;
  const linked = nodeLinked(node);
  const attempted = nodeAttempted(node);
  const hasChildren = children.length > 0;
  const shownChildren = filtersActive ? children.length : null;
  return <div className="si-tree-node">
    <div className={`si-tree-row ${hasChildren ? 'si-tree-row--parent' : ''}`} style={{ '--si-depth': depth }}>
      <div className="si-tree-row__main">
        {hasChildren ? <button type="button" className="si-tree-toggle" onClick={() => onToggle(id)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${nodeName(node)}`}><Icon name={open ? 'chevronDown' : 'chevronRight'} size={17}/></button> : <span className="si-tree-leaf-mark" aria-hidden="true"/>}
        <div className="si-tree-row__text"><Link to={topicPath(paperKey, id)} className="si-tree-row__name">{nodeName(node)}</Link><span className="si-tree-row__meta">{id}{filtersActive && hasChildren ? ` · ${shownChildren} matching branches` : ''}</span></div>
      </div>
      <div className="si-tree-row__facts"><Badge tone={status.tone}>{status.label}</Badge>{nodeWeak(node) && <Badge tone="warning">Weak</Badge>}{nodeRevisionDue(node) && <Badge tone="warning">Revision due</Badge>}<span className="si-tree-row__pyqs">{numberText(linked)} linked PYQs{linked > 0 && <small>{numberText(attempted)} attempted</small>}</span><Link className="si-icon-link" to={topicPath(paperKey, id)} aria-label={`View ${nodeName(node)}`}><Icon name="arrowRight" size={18}/></Link></div>
    </div>
    {hasChildren && open && <div className="si-tree-children">{children.map((child, index) => <HierarchyRow key={nodeId(child) || index} node={child} paperKey={paperKey} depth={depth + 1} expanded={expanded} onToggle={onToggle} filtersActive={filtersActive}/>)}</div>}
  </div>;
}

function PaperSummary({ data, paperKey }) {
  const s = data.summary || {};
  const leaves = treeLeaves(data.hierarchy);
  const total = count(s.totalNodes);
  const covered = count(s.coveredNodes);
  const attempted = count(firstDefined(s.attemptedPyqs, s.pyq?.attemptedPyqs));
  const totalPyqs = firstDefined(s.totalPyqs, s.linkedPyqs, s.pyq?.totalPyqs);
  const revised = count(s.revisedNodes);
  const weak = count(s.weakNodesCount);
  return <div className="si-paper-summary">
    <div><span>Coverage</span><strong>{numberText(covered)} <small>/ {numberText(total)}</small></strong><Progress value={ratioPercent(covered, total)} label={`${paperKey} coverage`}/></div>
    <div><span>PYQ exposure</span><strong>{numberText(attempted)} <small>/ {totalPyqs != null ? numberText(totalPyqs) : '—'}</small></strong><small>{totalPyqs != null ? 'Unique linked questions attempted' : 'Total not reported by this endpoint'}</small></div>
    <div><span>Revision</span><strong>{numberText(revised)}</strong><small>Revised nodes</small></div>
    <div><span>Weakness signals</span><strong>{numberText(weak)}</strong><small>Recorded by the backend</small></div>
  </div>;
}

export default function SyllabusPaperPage() {
  const { paperKey } = useParams();
  const navigate = useNavigate();
  const key = canonicalPaperKey(paperKey);
  const info = paperInfo(key);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [expanded, setExpanded] = useState({});
  const loadPaper = useCallback(async (signal) => normalizePaper(await getJsonWithFallback([
    `/api/syllabus/papers/${encodeURIComponent(key)}`,
    `/api/syllabus/drilldown/paper/${encodeURIComponent(key)}`,
  ], signal)), [key]);
  const { data, loading, error, refresh } = useSyllabusResource(loadPaper, [key]);
  const filtered = useMemo(() => filterPaperTree(data?.hierarchy, filters), [data, filters]);
  const activeFilters = filters.search || filters.status !== 'ALL' || filters.pyq !== 'ALL';
  const toggle = (id) => setExpanded((previous) => ({ ...previous, [id]: !previous[id] }));
  const openAll = () => {
    const ids = {};
    const walk = (nodes) => list(nodes).forEach((node) => { if (nodeChildren(node).length) { ids[nodeId(node)] = true; walk(nodeChildren(node)); } });
    walk(filtered); setExpanded(ids);
  };
  const resetFilters = () => setFilters(INITIAL_FILTERS);
  return <main className="si si-paper-workspace">
    <PageHeader eyebrow="PAPER EXPLORER" title={data?.title || info.label} description={data?.subjectsSummary || info.description} breadcrumbs={[{ label: 'Syllabus', to: '/syllabus' }, { label: info.label }]}><Button variant="secondary" icon="refresh" onClick={refresh} disabled={loading}>Refresh</Button></PageHeader>
    <nav className="si-paper-switcher" aria-label="Choose syllabus paper">{PAPERS.map((paper) => <Link key={paper.key} to={paperPath(paper.key)} className={key === paper.key ? 'is-active' : ''} aria-current={key === paper.key ? 'page' : undefined}>{paper.label}</Link>)}</nav>
    <ResourceState loading={loading} error={error} onRetry={refresh} label="paper syllabus">{data && <>
      <PaperSummary data={data} paperKey={info.label}/>
      <section className="si-section"><SectionHeading title="Explore the syllabus" description="Browse the complete canonical hierarchy. Expand sections, open any topic, or filter to your next area of work." action={<div className="si-inline-actions"><Button variant="ghost" onClick={openAll}>Expand all</Button><Button variant="ghost" onClick={() => setExpanded({})}>Collapse all</Button></div>}/>
        <div className="si-filterbar si-filterbar--paper"><SearchInput value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="Search topics or canonical codes"/><Select label="Coverage status" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={STATUS_OPTIONS}/><Select label="PYQ availability" value={filters.pyq} onChange={(value) => setFilters((prev) => ({ ...prev, pyq: value }))} options={PYQ_OPTIONS}/><FilterReset disabled={!activeFilters} onClick={resetFilters}/></div>
        {activeFilters && <div className="si-filter-note"><Icon name="info" size={15}/> Matching topics retain their parent sections. A topic with some attempted PYQs can still have unattempted questions.</div>}
        {filtered.length ? <div className="si-tree">{filtered.map((node, index) => <HierarchyRow key={nodeId(node) || index} node={node} paperKey={key} depth={0} expanded={expanded} onToggle={toggle} filtersActive={Boolean(activeFilters)}/>)}</div> : <EmptyState title="No matching syllabus topics" description="The current filters returned no topics. Your syllabus data has not been changed." action={<Button onClick={resetFilters}>Clear filters</Button>}/>}
      </section>
      <div className="si-help-strip"><Icon name="info" size={18}/><div><strong>How to use this explorer</strong><p>Coverage status records learning progress; weakness and revision-due are separate evidence signals. Open a topic to see linked PYQs, attempts and the recommended action.</p></div></div>
    </>}</ResourceState>
  </main>;
}
