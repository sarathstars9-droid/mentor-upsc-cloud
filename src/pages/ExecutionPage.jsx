import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../config';
import '../styles/mentorosPremium.css';

const USER_ID = 'moulika';

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ExecutionPage() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  
  // Proof states
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [noProofRequired, setNoProofRequired] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [outputType, setOutputType] = useState('notes');
  const [outputCount, setOutputCount] = useState(1);

  const todayKey = new Date().toISOString().slice(0, 10);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/daily-execution/command-center?date=${todayKey}&userId=${USER_ID}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.message || 'Error fetching command center data');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Block Actions
  const handleStart = async (blockId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'startBlock', userId: USER_ID, payload: { blockId, dayKey: todayKey } })
      });
      const data = await res.json();
      if (data.ok) fetchData();
      else alert(data.message || 'Failed to start block');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePause = async (blockId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pauseBlock', userId: USER_ID, payload: { blockId, dayKey: todayKey } })
      });
      const data = await res.json();
      if (data.ok) fetchData();
      else alert(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResume = async (blockId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resumeBlock', userId: USER_ID, payload: { blockId, dayKey: todayKey } })
      });
      const data = await res.json();
      if (data.ok) fetchData();
      else alert(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteWithProof = async (blockId) => {
    if (!noProofRequired && !selectedFile && !proofNotes.trim()) {
      alert('Proof validation required! Please upload a photo/file, enter proof notes, or check "No proof required".');
      return;
    }

    try {
      setSubmittingProof(true);
      let proofUrl = null;
      let proofStatus = noProofRequired ? 'waived' : 'verified';
      let proofType = noProofRequired ? 'none' : (selectedFile ? 'image' : 'notes_text');

      if (selectedFile && !noProofRequired) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('blockId', blockId);
        formData.append('dayKey', todayKey);
        formData.append('userId', USER_ID);
        formData.append('proofType', proofType);
        formData.append('proofNotes', proofNotes);

        const uploadRes = await fetch(`${BACKEND_URL}/api/plan/blocks/upload-proof`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.ok) {
          proofUrl = uploadData.proofUrl;
        } else {
          alert('Failed to upload proof file: ' + uploadData.message);
          setSubmittingProof(false);
          return;
        }
      }

      const completeRes = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'completeBlock',
          userId: USER_ID,
          payload: {
            blockId,
            dayKey: todayKey,
            reason: 'completed',
            outputType,
            outputCount: Number(outputCount) || 1,
            proofUrl,
            proofType,
            proofStatus,
            proofNotes
          }
        })
      });

      const completeData = await completeRes.json();
      if (completeData.ok) {
        setSelectedFile(null);
        setProofNotes('');
        setNoProofRequired(false);
        fetchData();
      } else {
        alert(completeData.message || 'Failed to complete block');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const executeCommand = async (cmd, task) => {
    if (cmd.actionRoute) {
      navigate(cmd.actionRoute);
      return;
    }
    
    const blockId = task?.blockId || task?.block_id || task?.id;

    if (cmd.primaryAction === 'Start Block') {
      if (blockId) await handleStart(blockId);
      navigate('/focus');
      return;
    }
    
    if (cmd.primaryAction === 'Resume Block') {
      if (blockId) await handleResume(blockId);
      navigate('/focus');
      return;
    }
    
    if (cmd.primaryAction === 'Continue Focus') {
      navigate('/focus');
      return;
    }
    
    if (cmd.primaryAction === 'Pause Block') {
      if (blockId) handlePause(blockId);
    }
  };

  return (
    <div className="premium-container">
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="premium-page-title">Command Center</h1>
          <p className="premium-page-subtitle" style={{ margin: 0 }}>Daily Execution & Focus Workspace</p>
        </div>
        <div className="premium-badge premium-badge-neutral">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#7F8897' }}>Synchronizing workspace...</div>
      ) : error ? (
        <div className="premium-surface-card" style={{ borderColor: '#E05252', marginBottom: '24px' }}>
          <p style={{ color: '#E05252', margin: 0 }}>{error}</p>
        </div>
      ) : data ? (
        <>
          {/* SECTION 1: TODAY'S COMMAND PANEL (HERO) */}
          <div className="premium-directive-hero" style={{ 
            background: data.command.primaryAction === 'Continue Focus' ? 'linear-gradient(135deg, rgba(47, 191, 113, 0.08) 0%, rgba(47, 191, 113, 0.02) 100%)' :
                        data.command.primaryAction === 'Resume Block' ? 'linear-gradient(135deg, rgba(214, 181, 109, 0.08) 0%, rgba(214, 181, 109, 0.02) 100%)' :
                        'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
            borderColor: data.command.primaryAction === 'Continue Focus' ? 'rgba(47, 191, 113, 0.3)' :
                         data.command.primaryAction === 'Resume Block' ? 'rgba(214, 181, 109, 0.3)' :
                         'rgba(255, 255, 255, 0.1)',
            marginBottom: '40px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: data.command.primaryAction === 'Continue Focus' ? '#2FBF71' : '#D6B56D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              Do this now
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#F5F7FB', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  {data.command.primaryAction}
                </h2>
                
                <p style={{ fontSize: '15px', color: '#B8C0CC', margin: 0, lineHeight: 1.5, maxWidth: '500px' }}>
                  {data.command.message}
                </p>
                
                {data.nowTask && data.nowTask.subject && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className="premium-badge premium-badge-neutral">
                      Target: {data.nowTask.subject || data.nowTask.title}
                    </span>
                  </div>
                )}
              </div>

              {data.command.primaryAction === 'Continue Focus' && data.nowTask && (
                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '20px 32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '48px', fontWeight: '800', fontFamily: 'monospace', color: '#2FBF71', lineHeight: 1 }}>
                    {formatTime(data.nowTask.total_pause_seconds || 0)} 
                  </div>
                  <div style={{ fontSize: '12px', color: '#7F8897', marginTop: '6px' }}>Elapsed</div>
                </div>
              )}

              <div style={{ flexShrink: 0 }}>
                <button 
                  onClick={() => executeCommand(data.command, data.nowTask)}
                  className="premium-button-primary" 
                  style={{ 
                    padding: '14px 28px', 
                    fontSize: '15px',
                    background: data.command.primaryAction === 'Continue Focus' ? 'transparent' : '#D6B56D',
                    color: data.command.primaryAction === 'Continue Focus' ? '#F5F7FB' : '#0E1117',
                    border: data.command.primaryAction === 'Continue Focus' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  }}
                >
                  {data.command.primaryAction}
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE BLOCK PROOF FORM */}
          {data.command.primaryAction === 'Continue Focus' && data.nowTask && (
            <div className="premium-surface-card" style={{ marginBottom: '40px' }}>
              <h3 className="premium-section-title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#D6B56D' }}>🛡️</span> Mandatory Study Proof
              </h3>
              <p className="premium-body" style={{ marginBottom: '20px' }}>
                To complete this block, you must verify your output.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#7F8897', marginBottom: '8px' }}>Output Type</label>
                  <select value={outputType} onChange={e => setOutputType(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#F5F7FB', outline: 'none' }}>
                    <option value="notes">Handwritten / Digital Notes</option>
                    <option value="pyq_practice">PYQ Questions Solved</option>
                    <option value="answer_written">Mains Answer Written</option>
                    <option value="revision_sheet">Revision Summary Sheet</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#7F8897', marginBottom: '8px' }}>Quantity (Pages/Qs)</label>
                  <input type="number" min="1" value={outputCount} onChange={e => setOutputCount(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#F5F7FB', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#7F8897', marginBottom: '8px' }}>Proof File / Photo</label>
                <input type="file" disabled={noProofRequired} onChange={e => setSelectedFile(e.target.files[0])} style={{ width: '100%', padding: '10px', background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#B8C0CC', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#7F8897', marginBottom: '8px' }}>Study Notes</label>
                <textarea rows="2" placeholder="Describe key takeaways..." value={proofNotes} onChange={e => setProofNotes(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#F5F7FB', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <input type="checkbox" id="noProof" checked={noProofRequired} onChange={e => setNoProofRequired(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#D6B56D', cursor: 'pointer' }} />
                <label htmlFor="noProof" style={{ fontSize: '14px', color: '#B8C0CC', cursor: 'pointer' }}>
                  Mark "No proof required for this block"
                </label>
              </div>

              <button 
                onClick={() => handleCompleteWithProof(data.nowTask.blockId || data.nowTask.block_id || data.nowTask.id)} 
                disabled={submittingProof} 
                className="premium-button-primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                {submittingProof ? 'Verifying...' : '✓ Complete Block & Submit Verification'}
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            
            {/* OVERDUE / AT RISK SECTION */}
            <div className="premium-surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="premium-section-title" style={{ margin: 0 }}>Overdue & At Risk</h3>
                <button onClick={() => navigate('/plan')} className="premium-text-link" style={{ fontSize: '13px' }}>View all</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.overdue.blocks.length === 0 && data.overdue.mistakes.length === 0 ? (
                  <p className="premium-body" style={{ margin: 0 }}>No overdue items.</p>
                ) : (
                  <>
                    {data.overdue.blocks.map(b => (
                      <div key={`blk-${b.blockId || b.block_id || b.id}`} className="premium-surface-card-inner" style={{ borderColor: 'rgba(214, 181, 109, 0.3)' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#D6B56D', marginBottom: '4px' }}>Missed Block</div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>{b.subject} at {b.planned_start}</div>
                      </div>
                    ))}
                    {data.overdue.mistakes.map(m => (
                      <div key={`mst-${m.id}`} className="premium-surface-card-inner" style={{ borderColor: 'rgba(224, 82, 82, 0.3)' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#E05252', marginBottom: '4px' }}>Must Revise</div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>{m.subject || m.paper || 'Mistake'} • Unresolved</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* REVISION DUE TODAY */}
            <div className="premium-surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="premium-section-title" style={{ margin: 0 }}>Revision Due Today</h3>
                <button onClick={() => navigate('/revision')} className="premium-text-link" style={{ fontSize: '13px' }}>View all</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.revisionsDue.length === 0 ? (
                  <p className="premium-body" style={{ margin: 0 }}>No revision due right now. Continue with today’s next study block.</p>
                ) : (
                  data.revisionsDue.map(r => (
                    <div key={`rev-${r.id}`} className="premium-surface-card-inner">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#F5F7FB', marginBottom: '4px' }}>{r.title}</div>
                          <div style={{ fontSize: '13px', color: '#7F8897' }}>Severity: {r.priority || 'medium'} • {r.subject || 'General'}</div>
                        </div>
                        <button onClick={() => navigate('/revision')} className="premium-button-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Open
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ANSWER WRITING RECOMMENDATION */}
            <div className="premium-surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="premium-section-title" style={{ margin: 0 }}>Answer Recommendation</h3>
              </div>
              
              <div className="premium-surface-card-inner" style={{ background: 'rgba(56, 189, 248, 0.04)', borderColor: 'rgba(56, 189, 248, 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>
                      {data.answerSuggestion.paper || 'General'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#B8C0CC', lineHeight: 1.5, marginBottom: '12px' }}>
                      {data.answerSuggestion.reason || "Write one answer today to start tracking answer-writing improvement."}
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate(data.answerSuggestion.route || '/mains')} className="premium-button-secondary" style={{ width: '100%', padding: '10px' }}>
                  Open Answer Writing
                </button>
              </div>
            </div>
          </div>

          {/* GUARDIAN SNAPSHOT (Display Only) */}
          <div className="premium-surface-card" style={{ background: 'rgba(20, 24, 35, 0.8)', borderColor: 'rgba(255,255,255,0.05)' }}>
            <h3 className="premium-section-title" style={{ color: '#D6B56D', marginBottom: '20px' }}>Guardian / Mentor Snapshot</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ borderLeft: '2px solid #2FBF71', paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Plan Uploaded</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.planUploaded ? 'Yes' : 'No'}
                </div>
              </div>
              <div style={{ borderLeft: '2px solid #38bdf8', paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Blocks Completed</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.blocksCompleted} today
                </div>
              </div>
              <div style={{ borderLeft: `2px solid ${data.guardianSnapshot.blocksMissed > 0 ? '#E05252' : '#2FBF71'}`, paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Blocks Missed</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.blocksMissed} today
                </div>
              </div>
              <div style={{ borderLeft: '2px solid #D6B56D', paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Current Active Block</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.currentActiveBlock || 'None'}
                </div>
              </div>
              <div style={{ borderLeft: `2px solid ${data.guardianSnapshot.revisionsOverdue > 0 ? '#E05252' : '#2FBF71'}`, paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Revisions Overdue</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.revisionsOverdue} items
                </div>
              </div>
              <div style={{ borderLeft: `2px solid ${data.guardianSnapshot.mustRevisePending > 0 ? '#E05252' : '#2FBF71'}`, paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Must-Revise Pending</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.mustRevisePending} items
                </div>
              </div>
              <div style={{ borderLeft: '2px solid #8A5A9E', paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Last Answer Written</div>
                <div style={{ fontSize: '15px', color: '#F5F7FB', fontWeight: '600' }}>
                  {data.guardianSnapshot.lastAnswerWritten ? new Date(data.guardianSnapshot.lastAnswerWritten).toLocaleDateString() : 'Never'}
                </div>
              </div>
              <div style={{ borderLeft: `2px solid ${data.guardianSnapshot.riskLevel === 'High' ? '#E05252' : data.guardianSnapshot.riskLevel === 'Medium' ? '#D6B56D' : '#2FBF71'}`, paddingLeft: '12px' }}>
                <div style={{ fontSize: '12px', color: '#7F8897', marginBottom: '4px' }}>Current Risk Level</div>
                <div style={{ fontSize: '15px', color: data.guardianSnapshot.riskLevel === 'High' ? '#E05252' : data.guardianSnapshot.riskLevel === 'Medium' ? '#D6B56D' : '#2FBF71', fontWeight: '600' }}>
                  {data.guardianSnapshot.riskLevel}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}