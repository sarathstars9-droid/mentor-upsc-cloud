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
  const [blocks, setBlocks] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [noProofRequired, setNoProofRequired] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [outputType, setOutputType] = useState('notes');
  const [outputCount, setOutputCount] = useState(1);

  const todayKey = new Date().toISOString().slice(0, 10);
  const isNight = new Date().getHours() >= 20; // 8 PM onwards

  const fetchData = async () => {
    try {
      setLoading(true);
      const [blockRes, revRes, mistakeRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/plan/blocks?dayKey=${todayKey}&userId=${USER_ID}`),
        fetch(`${BACKEND_URL}/api/revision-items?userId=${USER_ID}`),
        fetch(`${BACKEND_URL}/api/mistakes?userId=${USER_ID}`)
      ]);

      if (blockRes.status === 'fulfilled' && blockRes.value.ok) {
        const d = await blockRes.value.json();
        setBlocks(d.blocks || []);
      }

      if (revRes.status === 'fulfilled' && revRes.value.ok) {
        const d = await revRes.value.json();
        const arr = Array.isArray(d) ? d : (d.items || d.data || []);
        setRevisions(arr.filter(r => r.status !== 'reviewed' && new Date(r.next_review_at) <= new Date()));
      }

      if (mistakeRes.status === 'fulfilled' && mistakeRes.value.ok) {
        const d = await mistakeRes.value.json();
        const arr = Array.isArray(d) ? d : (d.items || []);
        setMistakes(arr.filter(m => m.must_revise));
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

  // Actions
  const handleStart = async (blockId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/plan/blocks/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, dayKey: todayKey, userId: USER_ID })
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
      const res = await fetch(`${BACKEND_URL}/api/plan/blocks/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, dayKey: todayKey, userId: USER_ID })
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
      const res = await fetch(`${BACKEND_URL}/api/plan/blocks/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, dayKey: todayKey, userId: USER_ID })
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

      const completeRes = await fetch(`${BACKEND_URL}/api/plan/blocks/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId,
          dayKey: todayKey,
          userId: USER_ID,
          reason: 'completed',
          outputType,
          outputCount: Number(outputCount) || 1,
          proofUrl,
          proofType,
          proofStatus,
          proofNotes
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

  // Derive categories
  const activeBlock = blocks.find(b => b.status === 'active');
  const pausedBlock = blocks.find(b => b.status === 'paused');
  
  const nowStr = formatTime(new Date().getHours() * 60 + new Date().getMinutes());
  
  // A block is overdue if it's planned/upcoming but its start time has passed (assuming we had a planned start time, otherwise we just show missed/skipped or the next one)
  const upcomingBlocks = blocks.filter(b => b.status === 'planned' || b.status === 'upcoming');
  const completedBlocks = blocks.filter(b => ['completed', 'partial', 'done', 'skipped'].includes(b.status));
  
  // Find overdue block (for simplicity, we consider a block overdue if it's past 10 AM and no blocks are completed, etc. Let's just pick the first uncompleted block if there's no active/paused)
  const overdueBlock = upcomingBlocks.length > 0 ? upcomingBlocks[0] : null; 
  
  // Find mains block
  const mainsBlock = upcomingBlocks.find(b => (b.subject || '').toLowerCase().includes('answer') || (b.topic || '').toLowerCase().includes('answer') || (b.topic || '').toLowerCase().includes('mains'));

  // Derive the Primary Directive
  let primaryDirective = null;

  if (activeBlock) {
    primaryDirective = {
      type: 'active',
      title: 'Active Study Session',
      block: activeBlock,
      actionLabel: 'Pause Session',
      action: () => handlePause(activeBlock.block_id)
    };
  } else if (pausedBlock) {
    primaryDirective = {
      type: 'paused',
      title: 'Session Paused',
      block: pausedBlock,
      actionLabel: 'Resume Session',
      action: () => handleResume(pausedBlock.block_id)
    };
  } else if (blocks.length === 0 && !loading) {
    primaryDirective = {
      type: 'no-plan',
      title: 'No Plan Uploaded',
      description: 'You haven\'t uploaded a study plan for today. A plan is critical for focused execution.',
      actionLabel: 'Upload Today\'s Plan',
      action: () => navigate('/plan')
    };
  } else if (overdueBlock && overdueBlock.planned_minutes > 0) { // arbitrary rule for overdue
     primaryDirective = {
       type: 'overdue',
       title: 'Start Next Block',
       block: overdueBlock,
       actionLabel: 'Start Session',
       action: () => handleStart(overdueBlock.block_id)
     };
  } else if (revisions.length > 0) {
    primaryDirective = {
      type: 'revision',
      title: 'Pending Revision',
      description: `You have ${revisions.length} revision item(s) due today. Spaced repetition prevents memory decay.`,
      actionLabel: 'Do Revision Now',
      action: () => navigate('/revision')
    };
  } else if (mainsBlock) {
    primaryDirective = {
      type: 'mains',
      title: 'Mains Answer Writing',
      block: mainsBlock,
      actionLabel: 'Write Answer Now',
      action: () => handleStart(mainsBlock.block_id)
    };
  } else if (upcomingBlocks.length === 0 && blocks.length > 0) {
     primaryDirective = {
       type: 'completed',
       title: 'Day Complete',
       description: 'You have completed all planned blocks for today. Great consistency!',
       actionLabel: 'View Night Report',
       action: () => navigate('/reports')
     };
  } else {
     primaryDirective = {
       type: 'general',
       title: 'Ready for Next Action',
       description: 'Check your pending queue and prepare for the next study block.',
       actionLabel: 'Attempt Prelims Practice',
       action: () => navigate('/prelims')
     };
  }

  const showNightReview = isNight || (blocks.length > 0 && upcomingBlocks.length === 0);

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

      {loading && blocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#7F8897' }}>Synchronizing workspace...</div>
      ) : error ? (
        <div className="premium-surface-card" style={{ borderColor: '#E05252', marginBottom: '24px' }}>
          <p style={{ color: '#E05252', margin: 0 }}>{error}</p>
        </div>
      ) : (
        <>
          {/* TOP SECTION: ONLY ONE PRIMARY DIRECTIVE */}
          <div className="premium-directive-hero" style={{ 
            background: primaryDirective.type === 'active' ? 'linear-gradient(135deg, rgba(47, 191, 113, 0.08) 0%, rgba(47, 191, 113, 0.02) 100%)' :
                        primaryDirective.type === 'paused' ? 'linear-gradient(135deg, rgba(214, 181, 109, 0.08) 0%, rgba(214, 181, 109, 0.02) 100%)' :
                        primaryDirective.type === 'completed' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(56, 189, 248, 0.02) 100%)' :
                        'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
            borderColor: primaryDirective.type === 'active' ? 'rgba(47, 191, 113, 0.3)' :
                         primaryDirective.type === 'paused' ? 'rgba(214, 181, 109, 0.3)' :
                         primaryDirective.type === 'completed' ? 'rgba(56, 189, 248, 0.3)' :
                         'rgba(255, 255, 255, 0.1)',
            marginBottom: '40px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: primaryDirective.type === 'active' ? '#2FBF71' : '#D6B56D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              Do this now
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#F5F7FB', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  {primaryDirective.title}
                </h2>
                
                {primaryDirective.block ? (
                  <div>
                    <p style={{ fontSize: '16px', color: '#B8C0CC', margin: '0 0 16px 0' }}>
                      {primaryDirective.block.subject} • {primaryDirective.block.topic || 'General Focus'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span className="premium-badge premium-badge-neutral">
                        Planned: {primaryDirective.block.planned_minutes}m
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '15px', color: '#B8C0CC', margin: 0, lineHeight: 1.5, maxWidth: '500px' }}>
                    {primaryDirective.description}
                  </p>
                )}
              </div>

              {primaryDirective.block && (primaryDirective.type === 'active' || primaryDirective.type === 'paused') && (
                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '20px 32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '48px', fontWeight: '800', fontFamily: 'monospace', color: primaryDirective.type === 'active' ? '#2FBF71' : '#D6B56D', lineHeight: 1 }}>
                    {formatTime(primaryDirective.block.actualSeconds || 0)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7F8897', marginTop: '6px' }}>Elapsed Time</div>
                </div>
              )}

              <div style={{ flexShrink: 0 }}>
                <button 
                  onClick={primaryDirective.action}
                  className="premium-button-primary" 
                  style={{ 
                    padding: '14px 28px', 
                    fontSize: '15px',
                    background: primaryDirective.type === 'active' ? 'transparent' : '#D6B56D',
                    color: primaryDirective.type === 'active' ? '#F5F7FB' : '#0E1117',
                    border: primaryDirective.type === 'active' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  }}
                >
                  {primaryDirective.actionLabel}
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE BLOCK PROOF FORM */}
          {(activeBlock || pausedBlock) && (
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
                onClick={() => handleCompleteWithProof((activeBlock || pausedBlock).block_id)} 
                disabled={submittingProof} 
                className="premium-button-primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                {submittingProof ? 'Verifying...' : '✓ Complete Block & Submit Verification'}
              </button>
            </div>
          )}

          {/* MIDDLE SECTION: PENDING QUEUES */}
          {blocks.length === 0 ? (
            <div className="premium-surface-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📝</div>
              <h3 className="premium-card-title">Ready to begin your day?</h3>
              <p className="premium-body" style={{ maxWidth: '400px', margin: '0 auto 24px' }}>
                You don't have an active study plan for today. Upload your plan to get focused execution tracking.
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/plan')} className="premium-button-primary">Upload Plan</button>
                <button onClick={() => navigate('/revision')} className="premium-button-secondary">Do Revision</button>
                <button onClick={() => navigate('/mains')} className="premium-button-secondary">Write Mains Answer</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              
              {/* Upcoming / Overdue Blocks */}
              <div className="premium-surface-card">
                <h3 className="premium-section-title">Pending Blocks ({upcomingBlocks.length})</h3>
                {upcomingBlocks.length === 0 ? (
                  <p className="premium-body" style={{ margin: 0 }}>No more pending blocks for today.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {upcomingBlocks.map(b => (
                      <div key={b.block_id} className="premium-surface-card-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#F5F7FB', marginBottom: '4px' }}>{b.subject || 'Focus Block'}</div>
                          <div style={{ fontSize: '13px', color: '#7F8897' }}>{b.topic} • {b.planned_minutes}m</div>
                        </div>
                        <button 
                          onClick={() => handleStart(b.block_id)} 
                          disabled={Boolean(activeBlock || pausedBlock)} 
                          className={activeBlock || pausedBlock ? "premium-button-secondary" : "premium-text-link"}
                          style={{ opacity: (activeBlock || pausedBlock) ? 0.5 : 1, padding: '6px 12px' }}
                        >
                          Start
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Revision & Mistake Queues */}
              <div className="premium-surface-card">
                <h3 className="premium-section-title">Daily Maintenance</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Revisions */}
                  <div className="premium-surface-card-inner" style={{ borderColor: revisions.length > 0 ? 'rgba(214, 181, 109, 0.3)' : 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: revisions.length > 0 ? '#D6B56D' : '#F5F7FB', marginBottom: '4px' }}>Spaced Revision</div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>{revisions.length} items due today</div>
                      </div>
                      <button onClick={() => navigate('/revision')} className="premium-text-link" style={{ padding: '6px 12px' }}>
                        View
                      </button>
                    </div>
                  </div>

                  {/* Mains Answer */}
                  <div className="premium-surface-card-inner" style={{ borderColor: mainsBlock ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: mainsBlock ? '#38bdf8' : '#F5F7FB', marginBottom: '4px' }}>Mains Answer</div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>{mainsBlock ? 'Pending today' : 'No target set'}</div>
                      </div>
                      <button onClick={() => navigate('/mains')} className="premium-text-link" style={{ padding: '6px 12px' }}>
                        Write
                      </button>
                    </div>
                  </div>

                  {/* Mistakes */}
                  <div className="premium-surface-card-inner" style={{ borderColor: mistakes.length > 0 ? 'rgba(224, 82, 82, 0.3)' : 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: mistakes.length > 0 ? '#E05252' : '#F5F7FB', marginBottom: '4px' }}>Mistake Book</div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>{mistakes.length} unresolved</div>
                      </div>
                      <button onClick={() => navigate('/mistakes')} className="premium-text-link" style={{ padding: '6px 12px' }}>
                        Review
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* BOTTOM SECTION: COMPLETED & NIGHT REVIEW */}
          {(completedBlocks.length > 0 || showNightReview) && blocks.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              <div className="premium-surface-card">
                <h3 className="premium-section-title">Completed Today ({completedBlocks.length})</h3>
                {completedBlocks.length === 0 ? (
                  <p className="premium-body" style={{ margin: 0 }}>No sessions completed yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {completedBlocks.map(b => (
                      <div key={b.block_id} className="premium-surface-card-inner" style={{ background: 'rgba(47, 191, 113, 0.04)', borderColor: 'rgba(47, 191, 113, 0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#2FBF71' }}>{b.subject}</span>
                          <span className="premium-badge premium-badge-success">{b.actualMinutes || b.planned_minutes}m</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#7F8897' }}>Status: Verified • {b.topic}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {showNightReview && (
                <div className="premium-surface-card" style={{ background: 'rgba(214, 181, 109, 0.04)', borderColor: 'rgba(214, 181, 109, 0.2)' }}>
                  <h3 className="premium-section-title" style={{ color: '#D6B56D' }}>Guardian & Night Review</h3>
                  <p className="premium-body" style={{ marginBottom: '24px' }}>
                    Your day is winding down. Review your daily analytics and prepare for tomorrow before your guardian summary is generated.
                  </p>
                  <button onClick={() => navigate('/reports')} className="premium-button-primary" style={{ width: '100%', padding: '12px' }}>
                    View Daily Report
                  </button>
                </div>
              )}

            </div>
          )}

        </>
      )}
    </div>
  );
}