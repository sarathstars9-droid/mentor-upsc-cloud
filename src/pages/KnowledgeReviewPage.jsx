import React, { useState, useEffect } from 'react';
import { Archive, CheckCircle, Clock, AlertTriangle, FileText, Search, Play } from 'lucide-react';
import { MainsVisualRenderer } from '../components/mains/MainsVisualRenderer';

export default function KnowledgeReviewPage() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    lifecycle_status: 'PENDING_REVIEW',
    verification_status: '',
    is_active: undefined,
  });

  // Source editing state
  const [sourceForm, setSourceForm] = useState({
    source_reference: '',
    source_year: '',
    source_title: ''
  });

  // V1.6A Source Discovery States
  const [candidates, setCandidates] = useState(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Build state
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [buildForm, setBuildForm] = useState({
    knowledgeType: 'SUBJECT_LANGUAGE',
    questionText: '',
    syllabusNodeId: ''
  });
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildMessage, setBuildMessage] = useState(null);

  useEffect(() => {
    fetchItems();
  }, [filters]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('mos_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `/api/mains/knowledge/review?limit=100`;
      if (filters.lifecycle_status) url += `&lifecycle_status=${filters.lifecycle_status}`;
      if (filters.verification_status) url += `&verification_status=${filters.verification_status}`;
      if (filters.is_active !== undefined) url += `&is_active=${filters.is_active}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access Denied: You do not have permission to view the Knowledge Review Console.');
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch');
      }
      
      setItems(data.data || []);
      if (selectedItem) {
        const stillExists = (data.data || []).find(i => i.id === selectedItem.id);
        if (!stillExists) {
          setSelectedItem(null);
          setCandidates(null);
          setVerificationResult(null);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, id, body = null) => {
    try {
      const token = localStorage.getItem('mos_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = { method: 'POST', headers };
      if (body) options.body = JSON.stringify(body);

      const res = await fetch(`/api/mains/knowledge/review/${id}/${action}`, options);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || `Action ${action} failed`);
      }
      
      // Update selected item explicitly if it was verified
      if (action === 'verify') {
        setSelectedItem(data.data);
      } else {
        fetchItems(); // refresh list to drop approved/retired from pending
      }
      
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const renderStatus = (item) => {
    if (item.verification_status === 'SOURCE_REQUIRED') return <span style={{color: '#f59e0b'}}><AlertTriangle size={14}/> SOURCE REQUIRED</span>;
    if (item.verification_status === 'VERIFIED') return <span style={{color: '#3b82f6'}}><CheckCircle size={14}/> VERIFIED</span>;
    if (item.lifecycle_status === 'ACTIVE') return <span style={{color: '#10b981'}}><CheckCircle size={14}/> ACTIVE</span>;
    if (item.lifecycle_status === 'RETIRED') return <span style={{color: '#6b7280'}}><Archive size={14}/> RETIRED</span>;
    return <span style={{color: '#6366f1'}}><Clock size={14}/> PENDING REVIEW</span>;
  };

  const handleVerify = () => {
    handleAction('verify', selectedItem.id, sourceForm);
  };

  const handleDiscoverSource = async () => {
    setIsDiscovering(true);
    setCandidates(null);
    setVerificationResult(null);
    try {
      const token = localStorage.getItem('mos_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/mains/knowledge/review/${selectedItem.id}/discover-source`, {
        method: 'POST', headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Discovery failed');
      setCandidates(data.data.candidates);
    } catch (err) {
      alert(`Discovery Error: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleVerifyClaim = async (candidateUrl) => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const token = localStorage.getItem('mos_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/mains/knowledge/review/${selectedItem.id}/verify-claim`, {
        method: 'POST', headers, body: JSON.stringify({ candidateUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      
      setVerificationResult(data.data);
      if (data.data.claim_supported) {
         setSourceForm(prev => ({
           ...prev,
           source_reference: candidateUrl
         }));
      }
    } catch (err) {
      alert(`Verify Claim Error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBuild = async () => {
    if (!buildForm.knowledgeType || (!buildForm.questionText && !buildForm.syllabusNodeId)) {
      alert("Provide Knowledge Type and either a Question or a Node ID");
      return;
    }
    setBuildLoading(true);
    setBuildMessage(null);
    try {
      const token = localStorage.getItem('mos_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const payload = {
        knowledgeType: buildForm.knowledgeType,
        queryText: buildForm.questionText,
        questionIntelligence: {
          syllabus_node_id: buildForm.syllabusNodeId || null
        }
      };

      const res = await fetch(`/api/mains/knowledge/review/build`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to build');
      }
      
      if (data.data.status === 'DUPLICATE') {
        setBuildMessage('Similar knowledge already exists.');
        // Optionally fetch and select the existing item here
        fetchItems();
      } else {
        setBuildMessage('Successfully created new candidate.');
        setShowBuildModal(false);
        fetchItems();
      }
    } catch (err) {
      setBuildMessage(`Error: ${err.message}`);
    } finally {
      setBuildLoading(false);
    }
  };

  return (
    <div className="knowledge-review-page" style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column', color: 'var(--text-primary, #e2e8f0)', background: 'var(--bg-primary, #0f172a)' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Knowledge Review Console</h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: 0, marginTop: '4px' }}>Internal MentorOS Workflow</p>
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setFilters({ lifecycle_status: 'PENDING_REVIEW', verification_status: '', is_active: undefined })}
            style={{ padding: '0.5rem 1rem', background: filters.lifecycle_status === 'PENDING_REVIEW' && !filters.verification_status ? '#334155' : 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            Pending
          </button>
          <button 
            onClick={() => setFilters({ lifecycle_status: 'PENDING_REVIEW', verification_status: 'SOURCE_REQUIRED', is_active: undefined })}
            style={{ padding: '0.5rem 1rem', background: filters.verification_status === 'SOURCE_REQUIRED' ? '#334155' : 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            Source Req
          </button>
          <button 
            onClick={() => setFilters({ lifecycle_status: 'PENDING_REVIEW', verification_status: 'VERIFIED', is_active: undefined })}
            style={{ padding: '0.5rem 1rem', background: filters.verification_status === 'VERIFIED' ? '#334155' : 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            Verified
          </button>
          <button 
            onClick={() => setFilters({ lifecycle_status: 'ACTIVE', verification_status: '', is_active: true })}
            style={{ padding: '0.5rem 1rem', background: filters.lifecycle_status === 'ACTIVE' ? '#334155' : 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            Active
          </button>
          <div style={{ width: '1px', background: '#334155', margin: '0 8px' }}></div>
          <button 
            onClick={() => { setShowBuildModal(true); setBuildMessage(null); }}
            style={{ padding: '0.5rem 1rem', background: '#4f46e5', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Build Candidate
          </button>
        </div>
      </header>

      {/* Build Modal */}
      {showBuildModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', width: '400px', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#e2e8f0' }}>Build Candidate</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Knowledge Type</label>
              <select 
                value={buildForm.knowledgeType} 
                onChange={e => setBuildForm({...buildForm, knowledgeType: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
              >
                <option value="SUBJECT_LANGUAGE">Subject Language</option>
                <option value="VALUE_ADDITION">Value Addition</option>
                <option value="EVIDENCE">Evidence</option>
                <option value="GEOGRAPHY_OPTIONAL">Geography Optional</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Context / Question Text</label>
              <textarea 
                value={buildForm.questionText} 
                onChange={e => setBuildForm({...buildForm, questionText: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px', minHeight: '80px' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Syllabus Node ID (Optional)</label>
              <input 
                type="text" 
                value={buildForm.syllabusNodeId} 
                onChange={e => setBuildForm({...buildForm, syllabusNodeId: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
              />
            </div>
            {buildMessage && (
              <div style={{ padding: '0.75rem', background: buildMessage.includes('Error') ? '#450a0a' : (buildMessage.includes('Similar') ? '#78350f' : '#064e3b'), color: buildMessage.includes('Error') ? '#fca5a5' : (buildMessage.includes('Similar') ? '#fbbf24' : '#34d399'), borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {buildMessage}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowBuildModal(false)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleBuild}
                disabled={buildLoading}
                style={{ padding: '0.5rem 1rem', background: '#4f46e5', border: 'none', borderRadius: '4px', color: '#fff', cursor: buildLoading ? 'wait' : 'pointer' }}
              >
                {buildLoading ? 'Building...' : 'Build'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div style={{ margin: 'auto', padding: '2rem', background: '#450a0a', color: '#fca5a5', borderRadius: '8px', maxWidth: '600px', textAlign: 'center', border: '1px solid #7f1d1d' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ marginTop: 0 }}>Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
          {/* List View */}
          <div style={{ flex: '0 0 350px', background: 'var(--bg-secondary, #1e293b)', borderRadius: '8px', overflowY: 'auto', border: '1px solid #334155' }}>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div> : items.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No items found</div> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map(item => (
                  <li 
                    key={item.id} 
                    onClick={() => { 
                      setSelectedItem(item); 
                      setCandidates(null);
                      setVerificationResult(null);
                      setSourceForm({ source_reference: item.source_reference || '', source_year: item.source_year || '', source_title: item.source_title || '' }); 
                    }}
                    style={{ 
                      padding: '1rem', 
                      borderBottom: '1px solid #334155', 
                      cursor: 'pointer',
                      background: selectedItem?.id === item.id ? '#334155' : 'transparent'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.paper} &middot; {item.subject}</span>
                      <span style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>{item.knowledge_type}</span>
                    </div>
                    <div style={{ fontWeight: '500', marginBottom: '8px', lineHeight: 1.4 }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {renderStatus(item)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail View */}
          <div style={{ flex: 1, background: 'var(--bg-secondary, #1e293b)', borderRadius: '8px', border: '1px solid #334155', overflowY: 'auto', padding: '2rem' }}>
            {selectedItem ? (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      {selectedItem.paper} &middot; {selectedItem.subject} {selectedItem.topic ? `· ${selectedItem.topic}` : ''}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{selectedItem.title}</h2>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px 10px', borderRadius: '6px' }}>
                        {renderStatus(selectedItem)}
                      </span>
                      <span style={{ background: '#0f172a', padding: '4px 10px', borderRadius: '6px', color: '#94a3b8' }}>
                        Node: {selectedItem.syllabus_node_id || 'unlinked'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', border: '1px solid #334155' }}>
                  {selectedItem.content}
                </div>

                {/* Evidence Source Flow */}
                {(selectedItem.knowledge_type === 'EVIDENCE' || selectedItem.verification_status === 'SOURCE_REQUIRED') && (
                  <div style={{ background: '#1e1b4b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3730a3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, color: '#a5b4fc', fontSize: '1rem' }}>Source Verification</h3>
                      {selectedItem.verification_status === 'SOURCE_REQUIRED' && (
                         <button 
                           onClick={handleDiscoverSource}
                           disabled={isDiscovering}
                           style={{ padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                         >
                           {isDiscovering ? 'Discovering...' : 'Find Source'}
                         </button>
                      )}
                    </div>

                    {candidates && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#c7d2fe', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Discovered Candidates</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {candidates.map((cand, idx) => (
                            <div key={idx} style={{ background: '#312e81', padding: '1rem', borderRadius: '4px', border: '1px solid #4338ca' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#e0e7ff' }}>{cand.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginBottom: '8px' }}>
                                {cand.publisher} &middot; {cand.domain} &middot; {cand.authority_level} &middot; {cand.source_year}
                              </div>
                              <button 
                                onClick={() => handleVerifyClaim(cand.url)}
                                disabled={isVerifying}
                                style={{ padding: '0.4rem 0.75rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                {isVerifying ? 'Verifying...' : 'Verify Claim'}
                              </button>
                            </div>
                          ))}
                          {candidates.length === 0 && <div style={{ fontSize: '0.875rem', color: '#a5b4fc' }}>No suitable sources found.</div>}
                        </div>
                      </div>
                    )}

                    {verificationResult && (
                      <div style={{ background: verificationResult.claim_supported ? '#064e3b' : '#450a0a', border: `1px solid ${verificationResult.claim_supported ? '#059669' : '#b91c1c'}`, padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: verificationResult.claim_supported ? '#34d399' : '#f87171', marginBottom: '0.5rem' }}>
                          {verificationResult.claim_supported ? 'CLAIM SUPPORTED' : 'CLAIM NOT SUPPORTED'} ({verificationResult.support_type})
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                          "{verificationResult.source_excerpt_or_summary}"
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Notes: {verificationResult.verification_notes}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', marginTop: '1rem' }}>
                      <input 
                        type="text" 
                        placeholder="Source Ref (e.g. URL or Name)" 
                        value={sourceForm.source_reference}
                        onChange={(e) => setSourceForm(prev => ({...prev, source_reference: e.target.value}))}
                        style={{ flex: 1, padding: '0.75rem', background: '#312e81', border: 'none', color: '#fff', borderRadius: '4px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Year (e.g. 2026)" 
                        value={sourceForm.source_year}
                        onChange={(e) => setSourceForm(prev => ({...prev, source_year: e.target.value}))}
                        style={{ width: '120px', padding: '0.75rem', background: '#312e81', border: 'none', color: '#fff', borderRadius: '4px' }}
                      />
                    </div>
                    {selectedItem.verification_status === 'SOURCE_REQUIRED' && (
                      <button 
                        onClick={handleVerify}
                        disabled={!sourceForm.source_reference}
                        style={{ padding: '0.75rem 1.5rem', background: sourceForm.source_reference ? '#4f46e5' : '#4338ca', color: '#fff', border: 'none', borderRadius: '4px', cursor: sourceForm.source_reference ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
                      >
                        Save Verification
                      </button>
                    )}
                  </div>
                )}

                {/* Visual Renderer Preview for VALUE_ADDITION */}
                {selectedItem.knowledge_type === 'VALUE_ADDITION' && selectedItem.structured_content && (
                  <div style={{ marginBottom: '2rem', border: '1px solid #334155', borderRadius: '8px', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#94a3b8' }}>Preview</h3>
                    <MainsVisualRenderer 
                      schema={selectedItem.structured_content.schema || 'PROCESS_FLOW'}
                    />
                  </div>
                )}

                {/* Geography Optional Structured Data */}
                {selectedItem.knowledge_type === 'GEOGRAPHY_OPTIONAL' && selectedItem.structured_content && (
                  <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#94a3b8' }}>Structured Model/Theory Data</h3>
                    <pre style={{ margin: 0, color: '#e2e8f0', overflowX: 'auto', fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedItem.structured_content, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #334155' }}>
                  <button 
                    onClick={() => handleAction('approve', selectedItem.id)}
                    disabled={selectedItem.verification_status === 'SOURCE_REQUIRED'}
                    style={{ 
                      padding: '0.75rem 1.5rem', 
                      background: selectedItem.verification_status === 'SOURCE_REQUIRED' ? '#1e293b' : '#10b981', 
                      color: selectedItem.verification_status === 'SOURCE_REQUIRED' ? '#64748b' : '#fff', 
                      border: 'none', borderRadius: '6px', 
                      cursor: selectedItem.verification_status === 'SOURCE_REQUIRED' ? 'not-allowed' : 'pointer', 
                      fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' 
                    }}
                  >
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button 
                    onClick={() => handleAction('retire', selectedItem.id)}
                    style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Retire
                  </button>
                </div>

                <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                  Generated by: {selectedItem.generated_by_model || 'Unknown'} (Prompt: {selectedItem.prompt_version || 'N/A'})
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Select a candidate to review
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
