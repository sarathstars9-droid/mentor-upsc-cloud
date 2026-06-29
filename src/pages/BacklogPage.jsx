import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config';

const USER_ID = 'moulika';

export default function BacklogPage() {
  const [backlogData, setBacklogData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState(null);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(10);

  const fetchBacklog = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/planner/backlog?userId=${USER_ID}`);
      const data = await res.json();
      if (data.ok) {
        setBacklogData(data.backlog || {});
      } else {
        setError(data.message || 'Failed to fetch backlog summary');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklog();
  }, []);

  const handleRebalance = async () => {
    try {
      setRebalancing(true);
      setRebalanceResult(null);
      const res = await fetch(`${BACKEND_URL}/api/planner/rebalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          maxHoursPerDay: Number(maxHoursPerDay) || 10
        })
      });
      const data = await res.json();
      if (data.ok) {
        setRebalanceResult(data);
        fetchBacklog();
      } else {
        alert('Rebalancing failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setRebalancing(false);
    }
  };

  return (
    <div className="page-wrap" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Backlog Rescue Hub
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px' }}>
            Subject-wise backlog tracking, missed hours recovery, and realistic adaptive schedule rebalancing.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Analyzing backlog metrics...</div>
      ) : error ? (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#fca5a5' }}>
          {error}
        </div>
      ) : (
        <div>
          {/* Metrics Top Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Total Backlog Hours</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: backlogData.totalMissedHours > 10 ? '#ef4444' : backlogData.totalMissedHours > 0 ? '#f59e0b' : '#10b981' }}>
                {backlogData.totalMissedHours || 0} hrs
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{backlogData.totalMissedMinutes || 0} total uncompleted minutes</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Uncompleted Blocks</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc' }}>
                {backlogData.totalMissedBlocks || 0} blocks
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Missed, skipped or partial sessions</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Recovery Diagnosis</div>
              <div style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '600', marginTop: '4px', lineHeight: '1.4' }}>
                {backlogData.recoveryPlan || 'No diagnosis available.'}
              </div>
            </div>
          </div>

          {/* Rebalancing Banner Trigger */}
          <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.15))', borderRadius: '20px', padding: '24px', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: '#fbbf24' }}>⚡ Adaptive Schedule Rebalancing</h3>
              <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0 }}>
                Redistribute missed backlog blocks realistically across the upcoming 7 days without generating impossible schedules.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Max Day Cap:
                <input type="number" min="6" max="14" value={maxHoursPerDay} onChange={e => setMaxHoursPerDay(e.target.value)} style={{ width: '50px', padding: '6px', marginLeft: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', textAlign: 'center' }} /> hrs
              </div>
              <button onClick={handleRebalance} disabled={rebalancing || backlogData.totalMissedBlocks === 0} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(90deg, #f59e0b, #d97706)', color: '#000', fontWeight: '800', border: 'none', cursor: backlogData.totalMissedBlocks === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {rebalancing ? 'Rebalancing...' : 'Run Adaptive Rebalance'}
              </button>
            </div>
          </div>

          {rebalanceResult && (
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', color: '#6ee7b7', marginBottom: '24px', fontSize: '14px' }}>
              ✓ {rebalanceResult.message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
            {/* Subject Breakdown */}
            <div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#cbd5e1' }}>Subject Backlog Split</h3>
                {(!backlogData.subjectBreakdown || backlogData.subjectBreakdown.length === 0) ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>No subject backlog logged.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {backlogData.subjectBreakdown.map(s => (
                      <div key={s.subject} style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: '#f8fafc' }}>{s.subject}</span>
                          <span style={{ fontWeight: '800', fontSize: '14px', color: '#f59e0b' }}>{s.missedHours} hrs</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.missedBlocksCount} uncompleted session(s)</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Missed Blocks Detailed List */}
            <div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: '#cbd5e1' }}>Uncompleted Blocks Timeline</h3>
                {(!backlogData.missedBlocks || backlogData.missedBlocks.length === 0) ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>Your timeline has no missed blocks!</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {backlogData.missedBlocks.map(b => (
                      <div key={b.id || b.blockId} style={{ background: 'rgba(0,0,0,0.3)', padding: '14px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '700', fontSize: '15px', color: '#f8fafc' }}>{b.subject}</span>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', textTransform: 'uppercase', fontWeight: '700' }}>{b.status}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{b.topic || b.title || 'Focus Session'} • Date: {b.dayKey}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', fontSize: '15px', color: '#fbbf24' }}>{Math.round(b.remainingMinutes)}m</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>remaining</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}