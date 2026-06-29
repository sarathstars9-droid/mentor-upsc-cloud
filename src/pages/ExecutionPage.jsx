import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config';

const USER_ID = 'moulika';

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ExecutionPage() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [noProofRequired, setNoProofRequired] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [outputType, setOutputType] = useState('notes');
  const [outputCount, setOutputCount] = useState(1);

  const todayKey = new Date().toISOString().slice(0, 10);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/plan/blocks?dayKey=${todayKey}&userId=${USER_ID}`);
      const data = await res.json();
      if (data.ok) {
        setBlocks(data.blocks || []);
      } else {
        setError(data.message || 'Failed to load execution blocks');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeBlock = blocks.find(b => b.status === 'active' || b.status === 'paused');
  const upcomingBlocks = blocks.filter(b => b.status === 'planned' || b.status === 'upcoming');
  const completedBlocks = blocks.filter(b => ['completed', 'partial', 'done'].includes(b.status));

  const handleStart = async (blockId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/plan/blocks/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, dayKey: todayKey, userId: USER_ID })
      });
      const data = await res.json();
      if (data.ok) fetchBlocks();
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
      if (data.ok) fetchBlocks();
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
      if (data.ok) fetchBlocks();
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
        fetchBlocks();
      } else {
        alert(completeData.message || 'Failed to complete block');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <div className="page-wrap" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Active Execution Workbench
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px' }}>
            Real-time study session execution, live timer, and mandatory proof verification.
          </p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', fontFamily: 'monospace' }}>
          Date: {todayKey}
        </div>
      </div>

      {loading && blocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading execution workspace...</div>
      ) : error ? (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#fca5a5' }}>
          {error}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          
          {/* Main Work Area */}
          <div>
            {/* Active / Paused Block Focus Card */}
            {activeBlock ? (
              <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))', borderRadius: '20px', padding: '28px', border: '1px solid rgba(56, 189, 248, 0.3)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ background: activeBlock.status === 'active' ? '#0ea5e9' : '#f59e0b', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {activeBlock.status === 'active' ? '● LIVE ACTIVE SESSION' : '⏸ SESSION PAUSED'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Planned: {activeBlock.planned_minutes} mins</span>
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', color: '#f8fafc' }}>{activeBlock.subject || 'Study Session'}</h2>
                <p style={{ fontSize: '15px', color: '#cbd5e1', margin: '0 0 24px 0' }}>{activeBlock.topic || activeBlock.title || 'General Focus Block'}</p>

                {/* Live Timer Box */}
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: '16px', padding: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '28px' }}>
                  <div style={{ fontSize: '56px', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '2px', color: activeBlock.status === 'active' ? '#38bdf8' : '#fbbf24' }}>
                    {formatTime(activeBlock.actualSeconds || 0)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Actual Study Elapsed (Pauses Excluded: {activeBlock.pauseMinutes || 0}m)
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
                  {activeBlock.status === 'active' ? (
                    <button onClick={() => handlePause(activeBlock.block_id)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#f59e0b', color: '#000', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                      Pause Session
                    </button>
                  ) : (
                    <button onClick={() => handleResume(activeBlock.block_id)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#10b981', color: '#fff', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                      Resume Session
                    </button>
                  )}
                </div>

                {/* Mandatory Proof & Output Logging Form */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 14px 0', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🛡️</span> Mandatory Study Proof & Completion
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Output Type</label>
                      <select value={outputType} onChange={e => setOutputType(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}>
                        <option value="notes">Handwritten / Digital Notes</option>
                        <option value="pyq_practice">PYQ Questions Solved</option>
                        <option value="answer_written">Mains Answer Written</option>
                        <option value="revision_sheet">Revision Summary Sheet</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Output Quantity (Pages/Questions)</label>
                      <input type="number" min="1" value={outputCount} onChange={e => setOutputCount(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Proof File / Photo Attachment</label>
                    <input type="file" disabled={noProofRequired} onChange={e => setSelectedFile(e.target.files[0])} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Proof Summary / Study Notes</label>
                    <textarea rows="2" placeholder="Describe key topics covered or proof details..." value={proofNotes} onChange={e => setProofNotes(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                    <input type="checkbox" id="noProof" checked={noProofRequired} onChange={e => setNoProofRequired(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="noProof" style={{ fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                      Mark "No proof required for this block" (Waived)
                    </label>
                  </div>

                  <button onClick={() => handleCompleteWithProof(activeBlock.block_id)} disabled={submittingProof} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(90deg, #3b82f6, #6366f1)', color: '#fff', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}>
                    {submittingProof ? 'Verifying & Completing...' : '✓ Complete Block & Submit Verification'}
                  </button>
                </div>

              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '48px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.15)', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#f1f5f9' }}>No Active Study Session</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0' }}>Select an upcoming planned block below to begin execution.</p>
              </div>
            )}

            {/* Upcoming Blocks List */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#cbd5e1' }}>Upcoming Planned Blocks ({upcomingBlocks.length})</h3>
              {upcomingBlocks.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px' }}>No pending upcoming blocks for today.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {upcomingBlocks.map(b => (
                    <div key={b.block_id} style={{ background: 'rgba(0,0,0,0.3)', padding: '14px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#f8fafc' }}>{b.subject || 'Study Block'}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{b.topic || b.title || 'General Focus'} • {b.planned_minutes}m</div>
                      </div>
                      <button onClick={() => handleStart(b.block_id)} disabled={Boolean(activeBlock)} style={{ padding: '8px 16px', borderRadius: '8px', background: activeBlock ? '#334155' : '#0ea5e9', color: activeBlock ? '#94a3b8' : '#fff', fontWeight: '700', border: 'none', cursor: activeBlock ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                        Start Session
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Execution Summary & History */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 14px 0', color: '#cbd5e1' }}>Completed Today ({completedBlocks.length})</h3>
              {completedBlocks.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px' }}>No completed sessions yet today.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {completedBlocks.map(b => (
                    <div key={b.block_id} style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#6ee7b7' }}>{b.subject}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{b.actualMinutes}m completed • Status: {b.proofVerificationStatus || 'verified'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}