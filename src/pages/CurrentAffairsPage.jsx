/**
 * src/pages/CurrentAffairsPage.jsx
 *
 * MentorOS Current Affairs Intelligence Hub (Phase 3A).
 * Official-Source-First Current Affairs Pipeline:
 * [Today] | [Issues] | [Visual Studio] | [Exam Use] | [Revision] | [Vault]
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GrammarVisualRenderer from '../components/visualStudio/GrammarVisualRenderer';

export default function CurrentAffairsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'today';
  const selectedSlug = searchParams.get('issue') || 'inflation';

  const [examContext, setExamContext] = useState('both'); // 'both', 'upsc', 'appsc'
  const [todayUpdates, setTodayUpdates] = useState([]);
  const [issuesList, setIssuesList] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [deploymentKit, setDeploymentKit] = useState(null);
  const [revisionQueue, setRevisionQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // 1. Fetch Today Updates
  useEffect(() => {
    async function fetchToday() {
      try {
        const res = await fetch(`/api/current-affairs/today?examContext=${examContext}`);
        const data = await res.json();
        if (data.success) {
          setTodayUpdates(data.todayUpdates || []);
        }
      } catch (err) {
        console.error('Failed to load today updates:', err);
      }
    }
    fetchToday();
  }, [examContext]);

  // 2. Fetch Issues List
  useEffect(() => {
    async function fetchIssues() {
      try {
        const res = await fetch(`/api/current-affairs/issues?examContext=${examContext}&search=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) {
          setIssuesList(data.issues || []);
        }
      } catch (err) {
        console.error('Failed to load issues:', err);
      }
    }
    fetchIssues();
  }, [examContext, searchQuery]);

  // 3. Fetch Selected Issue & Deployment Kit
  useEffect(() => {
    if (!selectedSlug) return;
    setLoading(true);

    async function fetchIssueDossier() {
      try {
        const [issueRes, kitRes] = await Promise.all([
          fetch(`/api/current-affairs/issues/${selectedSlug}`),
          fetch(`/api/current-affairs/issues/${selectedSlug}/kit?examContext=${examContext}`)
        ]);
        const issueData = await issueRes.json();
        const kitData = await kitRes.json();

        if (issueData.success) setSelectedIssue(issueData.issue);
        if (kitData.success) setDeploymentKit(kitData.kit);
      } catch (err) {
        console.error('Failed to fetch issue dossier:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchIssueDossier();
  }, [selectedSlug, examContext]);

  // 4. Fetch Revision Queue
  useEffect(() => {
    if (activeTab === 'revision') {
      fetch('/api/current-affairs/user/revision')
        .then(r => r.json())
        .then(d => { if (d.success) setRevisionQueue(d.queue || []); })
        .catch(err => console.error('Failed to load revision queue:', err));
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setSearchParams({ tab, issue: selectedSlug });
  };

  const handleSelectIssue = (slug) => {
    setSearchParams({ tab: activeTab === 'today' ? 'exam_use' : activeTab, issue: slug });
  };

  const handleSaveToRevision = async (issueId) => {
    try {
      const res = await fetch('/api/current-affairs/user/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          isSaved: true,
          readState: 'READ',
          recallConfidence: 4
        })
      });
      const data = await res.json();
      if (data.success) {
        setRevisionFeedback('Added to your revision queue!');
        setTimeout(() => setRevisionFeedback(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save revision state:', err);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: '#1E293B', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
              Current Affairs Intelligence
            </h1>
            <span style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', border: '1px solid #C7D2FE' }}>
              OFFICIAL-SOURCE-FIRST
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>
            Verified official releases, canonical issue dossiers, 1726-node syllabus links, and structured Exam Deployment Kits.
          </p>
        </div>

        {/* Exam Context Filter Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setExamContext('both')}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: examContext === 'both' ? '#FFFFFF' : 'transparent', color: examContext === 'both' ? '#0F172A' : '#64748B', boxShadow: examContext === 'both' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            All Contexts
          </button>
          <button
            onClick={() => setExamContext('upsc')}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: examContext === 'upsc' ? '#FFFFFF' : 'transparent', color: examContext === 'upsc' ? '#4F46E5' : '#64748B', boxShadow: examContext === 'upsc' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            UPSC CSE
          </button>
          <button
            onClick={() => setExamContext('appsc')}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: examContext === 'appsc' ? '#FFFFFF' : 'transparent', color: examContext === 'appsc' ? '#059669' : '#64748B', boxShadow: examContext === 'appsc' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            APPSC Group 1
          </button>
        </div>
      </div>

      {revisionFeedback && (
        <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #10B981', color: '#065F46', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>
          ✓ {revisionFeedback}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #F1F5F9', paddingBottom: '2px' }}>
        {[
          { key: 'today', label: 'Today', icon: '⚡' },
          { key: 'issues', label: 'Issues', icon: '📁' },
          { key: 'exam_use', label: 'Exam Use & Deployment Kit', icon: '🎯' },
          { key: 'visual_studio', label: 'Visual Studio', icon: '🎨' },
          { key: 'revision', label: 'Revision', icon: '🔄' },
          { key: 'vault', label: 'Official Source Vault', icon: '🔒' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #4F46E5' : '3px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#4F46E5' : '#64748B',
              transition: 'all 0.15s ease'
            }}>
            <span style={{ marginRight: '6px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: TODAY VIEW */}
      {activeTab === 'today' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              What Changed That Matters for Your Exam
            </h2>
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              Showing {todayUpdates.length} verified updates
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {todayUpdates.map(item => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span style={{
                      backgroundColor: item.importance === 'CRITICAL' ? '#FEE2E2' : '#EFF6FF',
                      color: item.importance === 'CRITICAL' ? '#DC2626' : '#2563EB',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {item.importance} PRIORITY
                    </span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {new Date(item.lastUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A', lineHeight: 1.4 }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {item.whyInNews}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    <span style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', fontSize: '11px', fontWeight: 600, color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                      📊 {item.evidenceCount} Verified Evidence
                    </span>
                    <span style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', fontSize: '11px', fontWeight: 600, color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                      📚 {item.syllabusCount} Syllabus Nodes
                    </span>
                    <span style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', fontSize: '11px', fontWeight: 600, color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                      📝 {item.pyqCount} Relevant PYQs
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <button
                    onClick={() => handleSelectIssue(item.slug)}
                    style={{ flex: 1, padding: '8px 12px', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Read Exam Kit
                  </button>
                  <button
                    onClick={() => { handleSelectIssue(item.slug); handleTabChange('visual_studio'); }}
                    style={{ padding: '8px 12px', backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Visuals
                  </button>
                  <button
                    onClick={() => handleSaveToRevision(item.id)}
                    style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    + Revise
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ISSUES DOSSIER LIST */}
      {activeTab === 'issues' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search canonical issues (e.g. Inflation, AP Budget, Urban Flooding, Green Hydrogen)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {issuesList.map(issue => (
              <div
                key={issue.id}
                onClick={() => handleSelectIssue(issue.slug)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: selectedSlug === issue.slug ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: issue.exam_context === 'appsc' ? '#059669' : '#4F46E5' }}>
                    {issue.exam_context === 'appsc' ? 'APPSC GROUP 1' : 'UPSC CSE'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{issue.status}</span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{issue.title}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {issue.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EXAM USE & DEPLOYMENT KIT */}
      {activeTab === 'exam_use' && deploymentKit && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          
          {/* Left Sidebar: Issue Navigator */}
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', height: 'fit-content' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Canonical Issues
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {issuesList.map(iss => (
                <button
                  key={iss.id}
                  onClick={() => handleSelectIssue(iss.slug)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: selectedSlug === iss.slug ? 700 : 500,
                    backgroundColor: selectedSlug === iss.slug ? '#EEF2FF' : 'transparent',
                    color: selectedSlug === iss.slug ? '#4F46E5' : '#334155'
                  }}>
                  {iss.title}
                </button>
              ))}
            </div>
          </div>

          {/* Right Main Panel: Structured Exam Deployment Kit */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                  {deploymentKit.examContext} • {deploymentKit.region} • {deploymentKit.importance} YIELD
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                  {deploymentKit.title}
                </h2>
              </div>
              <button
                onClick={() => handleSaveToRevision(deploymentKit.issueId)}
                style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                ✓ Add to Revision
              </button>
            </div>

            {/* Section 1: Context & Core Connection */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>1-LINE CONTEXT: </span>
                <span style={{ fontSize: '13px', color: '#1E293B', fontWeight: 600 }}>{deploymentKit.oneLineContext}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>WHY IN NEWS: </span>
                <span style={{ fontSize: '13px', color: '#334155' }}>{deploymentKit.whyInNews}</span>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>STATIC FOUNDATION: </span>
                <span style={{ fontSize: '13px', color: '#334155' }}>{deploymentKit.staticCoreConnection}</span>
              </div>
            </div>

            {/* Section 2: Segregated Evidence Buckets */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>
                Verified Official Evidence Tiers
              </h3>

              {/* Current Verified Evidence */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ backgroundColor: '#059669', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    CURRENT VERIFIED
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Active release cycle backed by official documents</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                  {deploymentKit.evidenceBuckets.currentVerified.map(ev => (
                    <div key={ev.id} style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>{ev.title}</div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: ev.provenanceOrigin === 'live_official_retrieval' ? '#DCFCE7' : '#F1F5F9',
                          color: ev.provenanceOrigin === 'live_official_retrieval' ? '#166534' : '#475569',
                          border: '1px solid ' + (ev.provenanceOrigin === 'live_official_retrieval' ? '#86EFAC' : '#CBD5E1')
                        }}>
                          {ev.provenanceOrigin === 'live_official_retrieval' ? '📡 LIVE OFFICIAL' : '🌱 DEV SEED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#14532D', margin: '4px 0' }}>{ev.valueText}</div>
                      <div style={{ fontSize: '11px', color: '#15803D' }}>{ev.sourceTitle} ({ev.dataPeriod})</div>
                      {ev.sourceSection && (
                        <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px', opacity: 0.85 }}>Section: {ev.sourceSection}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Verified Evidence */}
              {deploymentKit.evidenceBuckets.historicalVerified.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                      HISTORICAL VERIFIED
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Prior cycle benchmarks preserved for trend comparison</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                    {deploymentKit.evidenceBuckets.historicalVerified.map(ev => (
                      <div key={ev.id} style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>{ev.title}</div>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                            HISTORICAL
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E3A8A', margin: '4px 0' }}>{ev.valueText}</div>
                        <div style={{ fontSize: '11px', color: '#2563EB' }}>Historical Benchmark ({ev.dataPeriod})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Analytical Arguments & Challenges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#166534' }}>Key Arguments & Impact</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                  {deploymentKit.arguments.map((arg, i) => <li key={i}>{arg}</li>)}
                </ul>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>Bottlenecks & Challenges</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                  {deploymentKit.challenges.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            </div>

            {/* Section 4: Relevant PYQs */}
            {deploymentKit.relevantPyqs.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                  Relevant Previous Years Questions (PYQs)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deploymentKit.relevantPyqs.map((q, i) => (
                    <div key={i} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4F46E5' }}>{q.paper} ({q.year})</span>
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Relevance: {(q.relevanceScore * 100).toFixed(0)}%</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#1E293B', lineHeight: 1.5 }}>{q.questionText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VISUAL STUDIO INTEGRATION */}
      {activeTab === 'visual_studio' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Visual Studio Diagrams for {selectedIssue?.title || selectedSlug}
            </h2>
            <button
              onClick={() => navigate(`/current-affairs/visual-studio?topic=${selectedSlug}`)}
              style={{ padding: '8px 16px', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Open in Full Visual Studio ↗
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' }}>
            {(deploymentKit?.recommendedVisuals || []).map(vis => (
              <div key={vis.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                    {vis.visual_grammar || vis.visual_type}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Target Draw: {vis.target_draw_seconds || 30}s</span>
                </div>
                <div style={{ height: '360px', overflow: 'hidden', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
                  <GrammarVisualRenderer visual={vis} renderMode="exam" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: REVISION QUEUE */}
      {activeTab === 'revision' && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>
            Your Saved & Due Current Affairs Dossiers
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {revisionQueue.map(item => (
              <div key={item.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                    RECALL CONFIDENCE: {item.recall_confidence}/5
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{item.read_state}</span>
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{item.title}</h4>
                {item.weak_dimension && (
                  <div style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>
                    Weak Dimension: {item.weak_dimension}
                  </div>
                )}
                <button
                  onClick={() => handleSelectIssue(item.slug)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  Revise Now ➔
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: OFFICIAL SOURCE VAULT */}
      {activeTab === 'vault' && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>
            Official Source Audit & Provenance Vault
          </h2>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
            MentorOS only ingests content from registered primary constitutional, statutory, and central banking authorities.
          </p>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Source Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Domain</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Authority Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Exam Context</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Press Information Bureau (PIB)', domain: 'pib.gov.in', auth: 'PRIMARY_OFFICIAL', context: 'both' },
                  { name: 'Ministry of Statistics & PI (MoSPI)', domain: 'mospi.gov.in', auth: 'STATISTICAL_AUTHORITY', context: 'upsc' },
                  { name: 'Reserve Bank of India (RBI)', domain: 'rbi.org.in', auth: 'CENTRAL_BANK', context: 'both' },
                  { name: 'Finance Department, Andhra Pradesh', domain: 'apfinance.gov.in', auth: 'STATE_PRIMARY_OFFICIAL', context: 'appsc' },
                  { name: 'Union Public Service Commission (UPSC)', domain: 'upsc.gov.in', auth: 'CONSTITUTIONAL_BODY', context: 'upsc' },
                  { name: 'APPSC Commission', domain: 'psc.ap.gov.in', auth: 'CONSTITUTIONAL_BODY', context: 'appsc' }
                ].map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{s.name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#4F46E5' }}>{s.domain}</td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>{s.auth}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontWeight: 700, color: s.context === 'appsc' ? '#059669' : '#2563EB' }}>{s.context}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>CERTIFIED</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
