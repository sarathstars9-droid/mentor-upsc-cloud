/**
 * src/pages/VisualStudioPage.jsx
 *
 * Current Affairs -> Visual Studio (Phase 2B).
 * Search any topic and build exam-ready visual understanding with official provenance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainsVisualRenderer } from '../components/mains/MainsVisualRenderer';
import { ExamSketchRenderer } from '../components/visualStudio/ExamSketchRenderer';

const QUICK_TOPICS = [
  { label: 'Urban Flooding', query: 'Urban Flooding' },
  { label: 'Inflation', query: 'Inflation' },
  { label: 'Andhra Pradesh Budget', query: 'Andhra Pradesh Budget' },
  { label: 'Governor Office', query: 'Governor' },
  { label: 'Green Hydrogen', query: 'Green Hydrogen' }
];

export default function VisualStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialVisualId = searchParams.get('visual');
  const initialTopicQuery = searchParams.get('topic') || (initialVisualId ? '' : 'Urban Flooding');

  const [searchQuery, setSearchQuery] = useState(initialTopicQuery);
  const [examContext, setExamContext] = useState('both');
  const [region, setRegion] = useState('india');
  const [mode, setMode] = useState('learn'); // 'learn' | 'exam' | 'recall'
  const [activeTab, setActiveTab] = useState('recommended'); // 'recommended' | 'sketch' | 'evidence'

  // UI state machine: 'idle' | 'resolving' | 'topic_not_found' | 'loading_assets' | 'topic_found_no_assets' | 'ready' | 'error'
  const [uiState, setUiState] = useState('idle');
  const [resolvedTopic, setResolvedTopic] = useState(null);
  const [topicPack, setTopicPack] = useState(null);
  const [selectedVisual, setSelectedVisual] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [userState, setUserState] = useState({ is_saved: false, is_pinned: false, revision_status: 'none' });
  const [stateSaving, setStateSaving] = useState(false);

  const fetchTopicData = useCallback(async (queryText, targetVisualId = null) => {
    if (!queryText || !queryText.trim()) {
      setUiState('idle');
      setTopicPack(null);
      setResolvedTopic(null);
      setSelectedVisual(null);
      return;
    }

    setUiState('resolving');
    setErrorMessage('');

    try {
      // 1. Resolve Topic
      const resolveRes = await fetch('/api/visual-knowledge/topics/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryText: queryText.trim() })
      });

      if (!resolveRes.ok) {
        setUiState('error');
        setErrorMessage(`Server responded with status ${resolveRes.status} during topic resolution.`);
        return;
      }

      const resolveData = await resolveRes.json();

      if (!resolveData.resolved || !resolveData.topic) {
        setUiState('topic_not_found');
        setResolvedTopic(null);
        setTopicPack(null);
        setSelectedVisual(null);
        return;
      }

      const topic = resolveData.topic;
      setResolvedTopic(topic);
      setUiState('loading_assets');

      // 2. Fetch Topic Visual Pack
      const packRes = await fetch(
        `/api/visual-knowledge/topics/${topic.id}/visual-pack?examContext=${examContext}&region=${region || ''}`
      );

      if (!packRes.ok) {
        setUiState('error');
        setErrorMessage(`Server error ${packRes.status} while fetching visual knowledge pack.`);
        return;
      }

      const pack = await packRes.json();
      setTopicPack(pack);

      const hasVisuals = pack.visuals && pack.visuals.length > 0;
      if (!hasVisuals) {
        setUiState('topic_found_no_assets');
        setSelectedVisual(null);
        return;
      }

      setUiState('ready');

      // Select specific visual or first available
      const requestedId = targetVisualId || initialVisualId;
      if (requestedId && pack.visuals.some(v => v.id === requestedId)) {
        const matched = pack.visuals.find(v => v.id === requestedId);
        setSelectedVisual(matched);
        setUserState(matched.user_state || { is_saved: false, is_pinned: false, revision_status: 'none' });
        if (matched.visual_type === 'exam_sketch') {
          setActiveTab('sketch');
        }
      } else {
        const first = pack.visuals[0];
        setSelectedVisual(first);
        setUserState(first.user_state || { is_saved: false, is_pinned: false, revision_status: 'none' });
      }
    } catch (err) {
      console.error('Visual Studio fetch error:', err);
      setUiState('error');
      setErrorMessage(err.message || 'Network error communicating with Visual Knowledge backend.');
    }
  }, [examContext, region, initialVisualId]);

  useEffect(() => {
    if (initialTopicQuery) {
      fetchTopicData(initialTopicQuery, initialVisualId);
    }
  }, [initialTopicQuery, initialVisualId, fetchTopicData]);

  // Handle mode switches
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'exam') {
      setActiveTab('sketch');
      const sketch = topicPack?.visuals?.find(v => v.visual_type === 'exam_sketch');
      if (sketch) setSelectedVisual(sketch);
    } else if (newMode === 'learn') {
      setActiveTab('recommended');
      if (topicPack?.visuals?.length > 0) {
        setSelectedVisual(topicPack.visuals[0]);
      }
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ topic: searchQuery.trim() });
      fetchTopicData(searchQuery.trim());
    }
  };

  const handleGeneratePack = async () => {
    if (!resolvedTopic) return;
    setUiState('generating');
    setErrorMessage('');
    try {
      const res = await fetch(`/api/visual-knowledge/topics/${resolvedTopic.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examContext, region, mode: 'recommended' })
      });

      if (!res.ok) {
        throw new Error(`Generation failed with server status ${res.status}`);
      }

      const result = await res.json();
      if (result.success) {
        // Reload visual pack
        await fetchTopicData(resolvedTopic.canonical_name || resolvedTopic.title);
      } else {
        throw new Error(result.message || 'Visual generation failed');
      }
    } catch (err) {
      console.error('Visual generation error:', err);
      setUiState('error');
      setErrorMessage(err.message || 'Error generating visual pack');
    }
  };

  async function handleToggleState(field) {
    if (!selectedVisual) return;
    setStateSaving(true);
    const updated = {
      ...userState,
      [field]: !userState[field]
    };

    try {
      const res = await fetch(`/api/visual-knowledge/visuals/${selectedVisual.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        setUserState(data.user_state);
      }
    } catch (e) {
      console.error('Failed to update visual state', e);
    } finally {
      setStateSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!selectedVisual) return;
    try {
      const res = await fetch(`/api/visual-knowledge/visuals/${selectedVisual.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userState, personal_notes: personalNotes })
      });
      if (res.ok) {
        alert('Personal notes saved to Visual Knowledge state!');
      }
    } catch (e) {
      console.error('Failed to save notes', e);
    }
  }

  const examSketches = topicPack?.visuals?.filter(v => v.visual_type === 'exam_sketch') || [];
  const standardVisuals = topicPack?.visuals?.filter(v => v.visual_type !== 'exam_sketch') || [];

  return (
    <div style={styles.container}>
      {/* Top Banner & Header */}
      <div style={styles.topHeader}>
        <div>
          <div style={styles.kicker}>CURRENT AFFAIRS & MAINS VISUAL STUDIO</div>
          <h1 style={styles.pageTitle}>Visual Studio</h1>
          <p style={styles.pageSubtitle}>
            Search any topic and build exam-ready visual understanding with official source verification.
          </p>
        </div>

        {/* Global Controls */}
        <div style={styles.controlsRow}>
          <div style={styles.modeSwitcher}>
            <button
              onClick={() => handleModeChange('learn')}
              style={{ ...styles.modeBtn, ...(mode === 'learn' ? styles.modeBtnActive : {}) }}
            >
              📖 Learn
            </button>
            <button
              onClick={() => handleModeChange('exam')}
              style={{ ...styles.modeBtn, ...(mode === 'exam' ? styles.modeBtnActive : {}) }}
            >
              ⏱️ Exam Sketch (30s)
            </button>
            <button
              onClick={() => handleModeChange('recall')}
              style={{ ...styles.modeBtn, ...(mode === 'recall' ? styles.modeBtnActive : {}) }}
            >
              🧠 Active Recall
            </button>
          </div>

          <div style={styles.filterGroup}>
            <select
              value={examContext}
              onChange={(e) => setExamContext(e.target.value)}
              style={styles.selectInput}
            >
              <option value="both">All Exams (UPSC + APPSC)</option>
              <option value="upsc">UPSC Civil Services</option>
              <option value="appsc">APPSC (Andhra Pradesh)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Search Bar */}
      <div style={styles.searchSection}>
        <form onSubmit={handleSearchSubmit} style={styles.searchBarWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search topic, issue, scheme, judgment, concept or event (e.g. Urban Flooding, Inflation, AP Budget)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.mainSearchInput}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
        </form>

        {/* Quick Topic Pills */}
        <div style={styles.pillRow}>
          <span style={styles.pillLabel}>Popular Topics:</span>
          {QUICK_TOPICS.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setSearchQuery(t.query);
                setSearchParams({ topic: t.query });
                fetchTopicData(t.query);
              }}
              style={{
                ...styles.pillBtn,
                ...(searchQuery.toLowerCase() === t.query.toLowerCase() ? styles.pillBtnActive : {})
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* State Machine Views */}
      {uiState === 'idle' && (
        <div style={styles.emptyTopicBox}>
          <div style={styles.stateIcon}>🔍</div>
          <h3 style={styles.stateHeading}>Search a Topic to Begin</h3>
          <p style={styles.stateSubtitle}>
            Enter a syllabus topic above or select one of the popular topics to load exam diagrams and official evidence.
          </p>
        </div>
      )}

      {uiState === 'resolving' && (
        <div style={styles.loadingBox}>
          <div style={styles.loadingSpinner}>⚙️</div>
          <div style={styles.loadingTitle}>Resolving canonical syllabus topic...</div>
          <div style={styles.loadingSubtitle}>Matching topic aliases and official syllabus nodes</div>
        </div>
      )}

      {uiState === 'loading_assets' && (
        <div style={styles.loadingBox}>
          <div style={styles.loadingSpinner}>📊</div>
          <div style={styles.loadingTitle}>Loading visual pack & verified evidence...</div>
          <div style={styles.loadingSubtitle}>
            Topic: <strong>{resolvedTopic?.canonical_name || resolvedTopic?.title}</strong>
          </div>
        </div>
      )}

      {uiState === 'topic_not_found' && (
        <div style={styles.emptyTopicBox}>
          <div style={styles.stateIcon}>🔎</div>
          <h3 style={styles.stateHeading}>Topic Not Found</h3>
          <p style={styles.stateSubtitle}>
            No canonical syllabus topic matching "<strong>{searchQuery}</strong>" was found in the database catalogue.
          </p>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginRight: 8 }}>Try canonical topics:</span>
            {QUICK_TOPICS.map(t => (
              <button
                key={t.label}
                onClick={() => {
                  setSearchQuery(t.query);
                  setSearchParams({ topic: t.query });
                  fetchTopicData(t.query);
                }}
                style={styles.suggestionPill}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {uiState === 'topic_found_no_assets' && (
        <div style={styles.noAssetsCard}>
          <div style={styles.topicHeaderTop}>
            <div>
              <span style={styles.subjectBadge}>{resolvedTopic?.subject || 'GENERAL STUDIES'}</span>
              <h2 style={styles.topicTitle}>{resolvedTopic?.canonical_name || resolvedTopic?.title}</h2>
            </div>
            <div style={styles.examTag}>
              {resolvedTopic?.exam_context?.toUpperCase() || 'UPSC + APPSC'}
            </div>
          </div>
          <div style={styles.noAssetsNotice}>
            <div style={styles.stateIcon}>⏱️</div>
            <h3 style={styles.stateHeading}>Topic found — no visual generated yet</h3>
            <p style={styles.stateSubtitle}>
              The canonical syllabus topic is registered, but persistent visual knowledge assets for this specific scope are not yet generated.
            </p>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={handleGeneratePack}
                style={styles.generateBtn}
              >
                ⚡ Generate Recommended Visual Pack
              </button>
            </div>
          </div>
        </div>
      )}

      {uiState === 'generating' && (
        <div style={styles.loadingBox}>
          <div style={styles.loadingSpinner}>✨</div>
          <div style={styles.loadingTitle}>Generating Exam Visual Knowledge...</div>
          <div style={styles.loadingSubtitle}>
            Synthesizing 30-second sketch and structured diagrams for <strong>{resolvedTopic?.canonical_name || resolvedTopic?.title}</strong>
          </div>
        </div>
      )}

      {uiState === 'error' && (
        <div style={styles.errorBox}>
          <div style={styles.stateIcon}>⚠️</div>
          <h3 style={styles.errorHeading}>Visual Studio Service Error</h3>
          <p style={styles.errorSubtitle}>{errorMessage}</p>
          <button
            onClick={() => fetchTopicData(searchQuery)}
            style={styles.retryBtn}
          >
            🔄 Retry Request
          </button>
        </div>
      )}

      {uiState === 'ready' && topicPack && (
        <div style={styles.workspace}>
          {/* Topic Summary Card */}
          <div style={styles.topicCard}>
            <div style={styles.topicHeader}>
              <div>
                <div style={styles.metaRow}>
                  <span style={styles.subjectBadge}>{topicPack.topic.subject || "General Studies"}</span>
                  {topicPack.topic.exam_context && (
                    <span style={styles.examTagBadge}>
                      {topicPack.topic.exam_context === 'both' ? 'UPSC + APPSC' : topicPack.topic.exam_context.toUpperCase()}
                    </span>
                  )}
                  {topicPack.topic.region && topicPack.topic.region !== 'all' && (
                    <span style={styles.regionTagBadge}>
                      {topicPack.topic.region === 'andhra_pradesh' ? 'Andhra Pradesh' : topicPack.topic.region.toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 style={styles.topicTitle}>{topicPack.topic.title || topicPack.topic.canonical_name}</h2>
              </div>
            </div>
            {topicPack.topic.summary && <p style={styles.topicSummary}>{topicPack.topic.summary}</p>}

            {/* Key Exam Dimensions */}
            {topicPack.topic.dimensions && topicPack.topic.dimensions.length > 0 && (
              <div style={styles.dimensionRow}>
                <span style={styles.dimensionLabel}>Key Exam Dimensions:</span>
                {topicPack.topic.dimensions.map((dim, i) => (
                  <span key={i} style={styles.dimensionBadge}>{dim}</span>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div style={styles.tabBar}>
            <button
              onClick={() => setActiveTab('recommended')}
              style={{ ...styles.tabBtn, ...(activeTab === 'recommended' ? styles.tabBtnActive : {}) }}
            >
              ⭐ Recommended Pack ({topicPack.visuals_count})
            </button>
            <button
              onClick={() => setActiveTab('sketch')}
              style={{ ...styles.tabBtn, ...(activeTab === 'sketch' ? styles.tabBtnActive : {}) }}
            >
              ⏱️ 30-Sec Exam Sketches ({examSketches.length})
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              style={{ ...styles.tabBtn, ...(activeTab === 'evidence' ? styles.tabBtnActive : {}) }}
            >
              🏛️ Official Evidence & Provenance ({topicPack.evidence_count})
            </button>
          </div>

          {/* Tab 1 & 2: Recommended Pack / 30s Sketches */}
          {(activeTab === 'recommended' || activeTab === 'sketch') && (
            <div style={styles.visualGrid}>
              {/* Left Column: Visual Canvas */}
              <div style={styles.visualMainCol}>
                {selectedVisual ? (
                  <div style={styles.canvasContainer}>
                    <div style={styles.canvasTopBar}>
                      <div>
                        <div style={styles.canvasType}>
                          {selectedVisual.visual_type?.toUpperCase().replace('_', ' ')}
                        </div>
                        <h3 style={styles.canvasTitle}>{selectedVisual.title}</h3>
                      </div>

                      {/* Personalization buttons */}
                      <div style={styles.actionBtnGroup}>
                        <button
                          onClick={() => handleToggleState('is_saved')}
                          disabled={stateSaving}
                          style={{ ...styles.actionBtn, ...(userState.is_saved ? styles.actionBtnSaved : {}) }}
                        >
                          {userState.is_saved ? '⭐ Saved' : '☆ Save'}
                        </button>
                        <button
                          onClick={() => handleToggleState('is_pinned')}
                          disabled={stateSaving}
                          style={{ ...styles.actionBtn, ...(userState.is_pinned ? styles.actionBtnPinned : {}) }}
                        >
                          📌 Pin
                        </button>
                      </div>
                    </div>

                    {/* Dedicated Grammar Renderer */}
                    <ExamSketchRenderer
                      schema={selectedVisual.visual_spec}
                      visual={selectedVisual}
                      mode={mode}
                      drawTimeSeconds={selectedVisual.target_draw_seconds}
                    />

                    {/* Official Evidence Provenance Footer */}
                    {selectedVisual.linked_evidence && selectedVisual.linked_evidence.length > 0 && (
                      <div style={styles.provenanceBox}>
                        <div style={styles.provenanceTitle}>🏛️ Verified Official Source Provenance</div>
                        {selectedVisual.linked_evidence.map((ev, idx) => (
                          <div key={idx} style={styles.provenanceItem}>
                            <div style={styles.provenanceHeader}>
                              {ev.verification_status === 'verified_current' || (ev.is_latest_release && !ev.is_stale && !ev.refreshRequired) ? (
                                <span style={{ ...styles.officialTag, backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}>
                                  ✓ Current Official
                                </span>
                              ) : ev.verification_status === 'verified_historical' ? (
                                <span style={{ ...styles.verifiedTag, backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' }}>
                                  ✓ Verified Historical
                                </span>
                              ) : ev.verification_status === 'stale' || ev.is_stale || ev.refreshRequired ? (
                                <span style={{ ...styles.staleTag, backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' }}>
                                  ⚠️ Stale — Refresh Required
                                </span>
                              ) : (
                                <span style={{ ...styles.staleTag, backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' }}>
                                  ⚠️ Unverified
                                </span>
                              )}
                              <span style={styles.sourceDomain}>{ev.source_name} ({ev.source_domain || 'Official Portal'})</span>
                              {ev.data_period && <span style={styles.periodTag}>Period: {ev.data_period}</span>}
                            </div>
                            <div style={styles.provenanceDoc}>{ev.source_document_title || ev.title}</div>
                            {ev.source_section && <div style={styles.provenanceSection}>Section: {ev.source_section}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={styles.emptySelect}>Select a visual from the right column to view.</div>
                )}
              </div>

              {/* Right Column: Visual List & Personal Notes */}
              <div style={styles.visualSideCol}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={styles.sideColTitle}>Topic Visual Structures</h4>
                  {topicPack.current_cycle && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0A64F5', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: 6 }}>
                      {topicPack.current_cycle}
                    </span>
                  )}
                </div>

                <div style={styles.visualList}>
                  {topicPack.visuals.map((vis) => {
                    const isSelected = selectedVisual?.id === vis.id;
                    const spec = vis.visual_spec || {};
                    const grammar = spec.visualGrammar || spec.grammar || vis.visual_type || 'flowchart';
                    const hasExplicitTiming = Boolean(vis.target_draw_seconds || spec.targetDrawSeconds);

                    const grammarNameMap = {
                      hub_spoke: 'Hub & Spoke',
                      cause_effect: 'Cause–Effect',
                      cycle: 'Cycle',
                      timeline: 'Timeline',
                      stakeholder_map: 'Stakeholder Map',
                      institutional_web: 'Institutional Web',
                      decision_tree: 'Decision Tree',
                      fishbone: 'Fishbone',
                      geography_sketch: 'Process Diagram',
                      map_sketch: 'Map Sketch',
                      pyramid: 'Pyramid',
                      matrix: 'Matrix',
                      flowchart: 'Flowchart'
                    };

                    const displayGrammar = grammarNameMap[grammar] || grammar.toUpperCase().replace('_', ' ');

                    return (
                      <div
                        key={vis.id}
                        onClick={() => setSelectedVisual(vis)}
                        style={{
                          ...styles.visualListItem,
                          borderColor: isSelected ? '#0A64F5' : '#CBD5E1',
                          backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF'
                        }}
                      >
                        <div style={styles.listItemHeader}>
                          <span style={styles.sketchTypeTag}>
                            📐 {displayGrammar}
                          </span>
                          {hasExplicitTiming && (
                            <span style={styles.drawTimeTag}>⏱️ {vis.target_draw_seconds || spec.targetDrawSeconds}s</span>
                          )}
                        </div>
                        <div style={styles.listItemTitle}>{vis.title}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Historical / Superseded Visuals Section */}
                {topicPack.historical_visuals && topicPack.historical_visuals.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h5 style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                      📜 Historical / Prior Cycle Visuals
                    </h5>
                    <div style={styles.visualList}>
                      {topicPack.historical_visuals.map((vis) => {
                        const isSelected = selectedVisual?.id === vis.id;
                        return (
                          <div
                            key={vis.id}
                            onClick={() => setSelectedVisual(vis)}
                            style={{
                              ...styles.visualListItem,
                              borderColor: isSelected ? '#64748B' : '#E2E8F0',
                              backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                              opacity: 0.9
                            }}
                          >
                            <div style={styles.listItemHeader}>
                              <span style={{ ...styles.visualTypeTag, backgroundColor: '#F1F5F9', color: '#475569' }}>
                                📜 Historical
                              </span>
                            </div>
                            <div style={styles.listItemTitle}>{vis.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Personal Notes Box */}
                <div style={styles.notesBox}>
                  <h4 style={styles.notesTitle}>📝 My Exam Notes & Mnemonics</h4>
                  <textarea
                    placeholder="Add personal recall anchors, keywords, or exam trigger notes..."
                    value={personalNotes}
                    onChange={(e) => setPersonalNotes(e.target.value)}
                    style={styles.notesTextarea}
                  />
                  <button onClick={handleSaveNotes} style={styles.notesSaveBtn}>
                    Save Personal Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Official Evidence Explorer */}
          {activeTab === 'evidence' && (
            <div style={styles.evidenceCatalogGrid}>
              {topicPack.evidence && topicPack.evidence.length > 0 ? (
                topicPack.evidence.map((ev) => (
                  <div key={ev.id} style={styles.evidenceCard}>
                    <div style={styles.evCardHeader}>
                      <span style={ev.is_official ? styles.officialTag : styles.verifiedTag}>
                        🏛️ {ev.source_name}
                      </span>
                      {ev.verification_status === 'verified_current' || (ev.is_latest_release && !ev.is_stale && !ev.refreshRequired) ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                          ✓ Current Official
                        </span>
                      ) : ev.verification_status === 'verified_historical' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }}>
                          ✓ Verified Historical
                        </span>
                      ) : ev.verification_status === 'stale' || ev.is_stale || ev.refreshRequired ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                          ⚠️ Stale — Refresh Required
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                          ⚠️ Unverified
                        </span>
                      )}
                    </div>

                    <h4 style={styles.evTitle}>{ev.title}</h4>
                    <div style={styles.evValue}>{ev.value_text}</div>

                    {ev.data_period && (
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        <strong>Data Period:</strong> {ev.data_period}
                      </div>
                    )}

                    {ev.source_document_title && (
                      <div style={styles.docBox}>
                        <div><strong>Document:</strong> {ev.source_document_title}</div>
                        {ev.source_section && <div><strong>Section:</strong> {ev.source_section}</div>}
                        {ev.source_document_date && <div><strong>Date:</strong> {ev.source_document_date}</div>}
                      </div>
                    )}

                    {ev.source_url && (
                      <div style={styles.urlRow}>
                        <a href={ev.source_url} target="_blank" rel="noreferrer" style={styles.sourceLink}>
                          🔗 View Official Portal Release ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={styles.emptyTopicBox}>
                  <p style={styles.stateSubtitle}>No verified evidence records linked to this topic yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px',
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: 20,
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    color: '#0A64F5',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 6px 0'
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#475569',
    margin: 0,
    maxWidth: 600,
    lineHeight: 1.4
  },
  controlsRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  modeSwitcher: {
    display: 'flex',
    background: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 2
  },
  modeBtn: {
    border: 'none',
    background: 'transparent',
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    borderRadius: 6,
    cursor: 'pointer'
  },
  modeBtnActive: {
    background: '#FFFFFF',
    color: '#0A64F5',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center'
  },
  selectInput: {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    fontSize: 12,
    fontWeight: 700,
    background: '#FFFFFF',
    color: '#0F172A'
  },
  searchSection: {
    marginBottom: 24
  },
  searchBarWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '2px solid #CBD5E1',
    borderRadius: 10,
    padding: '8px 12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10
  },
  mainSearchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 15,
    fontWeight: 600,
    color: '#0F172A'
  },
  searchBtn: {
    background: '#0A64F5',
    color: '#FFFFFF',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer'
  },
  pillRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap'
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#475569'
  },
  pillBtn: {
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer'
  },
  pillBtnActive: {
    background: '#EAF2FF',
    borderColor: '#0A64F5',
    color: '#0A64F5',
    fontWeight: 700
  },
  suggestionPill: {
    background: '#FFFFFF',
    border: '1px solid #0A64F5',
    borderRadius: 16,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    color: '#0A64F5',
    cursor: 'pointer',
    marginRight: 6,
    marginTop: 6
  },
  emptyTopicBox: {
    padding: '48px 24px',
    textAlign: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  },
  noAssetsCard: {
    padding: 24,
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  },
  topicHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: 16,
    marginBottom: 20
  },
  noAssetsNotice: {
    padding: '32px 16px',
    textAlign: 'center'
  },
  stateIcon: {
    fontSize: 32,
    marginBottom: 12
  },
  stateHeading: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 8px 0'
  },
  stateSubtitle: {
    fontSize: 13,
    color: '#475569',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: 520,
    marginLeft: 'auto',
    marginRight: 'auto'
  },
  loadingBox: {
    padding: '48px 24px',
    textAlign: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 12
  },
  loadingSpinner: {
    fontSize: 32,
    marginBottom: 12
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 4
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#475569'
  },
  errorBox: {
    padding: '36px 24px',
    textAlign: 'center',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: 12
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: 800,
    color: '#991B1B',
    margin: '0 0 8px 0'
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#B91C1C',
    margin: '0 0 16px 0'
  },
  retryBtn: {
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  workspace: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  topicCard: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 10,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
  },
  topicHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  metaRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  subjectBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#0A64F5',
    background: '#EAF2FF',
    border: '1px solid #BFDBFE',
    padding: '2px 8px',
    borderRadius: 4,
    textTransform: 'uppercase'
  },
  examTagBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#475569',
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    padding: '2px 8px',
    borderRadius: 4
  },
  regionTagBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#6B21A8',
    background: '#FAF5FF',
    border: '1px solid #E9D5FF',
    padding: '2px 8px',
    borderRadius: 4
  },
  topicTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0F172A',
    margin: '4px 0 0 0'
  },
  examTag: {
    fontSize: 11,
    fontWeight: 800,
    color: '#475569',
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    padding: '4px 10px',
    borderRadius: 6
  },
  topicSummary: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 1.5,
    margin: '8px 0 12px 0'
  },
  dimensionRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  dimensionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#475569'
  },
  dimensionBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#0F172A',
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    padding: '3px 8px',
    borderRadius: 4
  },
  tabBar: {
    display: 'flex',
    borderBottom: '2px solid #E2E8F0',
    gap: 16
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    color: '#64748B',
    cursor: 'pointer'
  },
  tabBtnActive: {
    color: '#0A64F5',
    borderBottomColor: '#0A64F5'
  },
  visualGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: 20
  },
  visualMainCol: {
    display: 'flex',
    flexDirection: 'column'
  },
  canvasContainer: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 10,
    padding: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  },
  canvasTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  canvasType: {
    fontSize: 10,
    fontWeight: 800,
    color: '#0A64F5',
    letterSpacing: '0.04em'
  },
  canvasTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0F172A',
    margin: '2px 0 0 0'
  },
  actionBtnGroup: {
    display: 'flex',
    gap: 8
  },
  actionBtn: {
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    padding: '5px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#334155',
    cursor: 'pointer'
  },
  actionBtnSaved: {
    background: '#FEF3C7',
    borderColor: '#F59E0B',
    color: '#B45309'
  },
  actionBtnPinned: {
    background: '#EAF2FF',
    borderColor: '#0A64F5',
    color: '#0A64F5'
  },
  provenanceBox: {
    marginTop: 20,
    padding: 14,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8
  },
  provenanceTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: '#1E293B',
    marginBottom: 8
  },
  provenanceItem: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 6
  },
  provenanceHeader: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 2
  },
  officialTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#047857',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '2px 6px',
    borderRadius: 4
  },
  verifiedTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#0369A1',
    background: '#F0F9FF',
    padding: '2px 6px',
    borderRadius: 4
  },
  currentTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#047857',
    background: '#ECFDF5',
    padding: '2px 6px',
    borderRadius: 4
  },
  historicalTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#64748B',
    background: '#F1F5F9',
    padding: '2px 6px',
    borderRadius: 4
  },
  periodTag: {
    fontSize: 10,
    fontWeight: 600,
    color: '#64748B'
  },
  staleTag: {
    fontSize: 10,
    fontWeight: 800,
    color: '#B45309'
  },
  sourceDomain: {
    fontWeight: 700,
    color: '#0F172A'
  },
  provenanceDoc: {
    color: '#334155',
    fontWeight: 600
  },
  provenanceSection: {
    color: '#64748B',
    fontSize: 11
  },
  visualSideCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  sideColTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 8px 0'
  },
  visualList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 380,
    overflowY: 'auto'
  },
  visualListItem: {
    padding: 12,
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  visualTypeTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#0A64F5',
    background: '#EAF2FF',
    padding: '2px 6px',
    borderRadius: 4
  },
  sketchTypeTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#047857',
    background: '#ECFDF5',
    padding: '2px 6px',
    borderRadius: 4
  },
  drawTimeTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748B'
  },
  listItemTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A'
  },
  notesBox: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: 14
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 8px 0'
  },
  notesTextarea: {
    width: '100%',
    height: 90,
    padding: 8,
    borderRadius: 6,
    border: '1px solid #CBD5E1',
    fontSize: 12,
    boxSizing: 'border-box',
    marginBottom: 8
  },
  notesSaveBtn: {
    width: '100%',
    background: '#0A64F5',
    color: '#FFFFFF',
    border: 'none',
    padding: '7px 0',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  evidenceCatalogGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 16
  },
  evidenceCard: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  evCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  evTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
    margin: 0
  },
  evValue: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.4
  },
  docBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    padding: 8,
    fontSize: 11,
    color: '#475569',
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  urlRow: {
    marginTop: 4
  },
  sourceLink: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0A64F5',
    textDecoration: 'none'
  },
  emptySelect: {
    padding: 32,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13
  },
  generateBtn: {
    background: '#0A64F5',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(10, 100, 245, 0.2)'
  }
};

