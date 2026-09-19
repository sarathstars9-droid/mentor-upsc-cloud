import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config';

const USER_ID = 'moulika';

const BACKLOG_CSS = `
.backlog-page-wrap {
  padding: 24px 20px 60px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  color: #fff;
  box-sizing: border-box;
  min-width: 0;
}
.backlog-header {
  margin-bottom: 24px;
}
.backlog-header h1 {
  font-size: clamp(22px, 4vw, 28px);
  font-weight: 800;
  margin: 0;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  overflow-wrap: break-word;
}
.backlog-header p {
  font-size: 13.5px;
  color: #94a3b8;
  margin-top: 6px;
  line-height: 1.5;
  overflow-wrap: break-word;
}
.backlog-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 14px;
  margin-bottom: 24px;
  min-width: 0;
}
.backlog-kpi-card {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 16px;
  padding: 18px 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
  box-sizing: border-box;
}
.backlog-kpi-label {
  font-size: 12.5px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}
.backlog-kpi-val {
  font-size: clamp(26px, 4vw, 32px);
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: break-word;
}
.backlog-kpi-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
  line-height: 1.4;
  overflow-wrap: break-word;
}
.backlog-rebalance-card {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.16));
  border-radius: 18px;
  padding: 22px 24px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  min-width: 0;
  box-sizing: border-box;
}
.backlog-rebalance-info {
  min-width: 0;
  flex: 1 1 auto;
}
.backlog-rebalance-info h3 {
  font-size: 17px;
  font-weight: 750;
  margin: 0 0 6px 0;
  color: #fbbf24;
  overflow-wrap: break-word;
}
.backlog-rebalance-info p {
  font-size: 13px;
  color: #e2e8f0;
  margin: 0;
  line-height: 1.5;
  overflow-wrap: break-word;
}
.backlog-rebalance-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.backlog-rebalance-cap {
  font-size: 12px;
  color: #cbd5e1;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.backlog-rebalance-input {
  width: 50px;
  padding: 6px;
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  color: #fff;
  text-align: center;
  font: inherit;
  font-size: 13px;
}
.backlog-rebalance-btn {
  padding: 10px 20px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f59e0b, #d97706);
  color: #000;
  font-weight: 750;
  border: none;
  cursor: pointer;
  font-size: 13.5px;
  transition: opacity 0.15s ease;
  white-space: nowrap;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.backlog-rebalance-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.backlog-main-grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 20px;
  min-width: 0;
}
.backlog-section-panel {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 18px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
  box-sizing: border-box;
}
.backlog-section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 14px 0;
  color: #cbd5e1;
  overflow-wrap: break-word;
}
.backlog-split-item {
  background: rgba(0, 0, 0, 0.32);
  padding: 13px 15px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
}
.backlog-split-left {
  min-width: 0;
}
.backlog-split-subj {
  font-weight: 700;
  font-size: 13.5px;
  color: #f8fafc;
  overflow-wrap: break-word;
  word-break: break-word;
}
.backlog-split-count {
  font-size: 11.5px;
  color: #94a3b8;
  margin-top: 2px;
  overflow-wrap: break-word;
}
.backlog-split-hours {
  font-weight: 800;
  font-size: 14px;
  color: #f59e0b;
  text-align: right;
  white-space: nowrap;
}
.backlog-block-item {
  background: rgba(0, 0, 0, 0.32);
  padding: 13px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
}
.backlog-block-info {
  min-width: 0;
}
.backlog-block-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.backlog-block-subj {
  font-weight: 700;
  font-size: 14px;
  color: #f8fafc;
  overflow-wrap: break-word;
}
.backlog-block-badge {
  font-size: 9.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.22);
  color: #fca5a5;
  text-transform: uppercase;
  font-weight: 750;
  flex-shrink: 0;
}
.backlog-block-meta {
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.4;
  overflow-wrap: break-word;
  word-break: break-word;
}
.backlog-block-right {
  text-align: right;
  flex-shrink: 0;
}
.backlog-block-min {
  font-weight: 800;
  font-size: 14.5px;
  color: #fbbf24;
}
.backlog-block-rem {
  font-size: 10.5px;
  color: #64748b;
}

@media (max-width: 860px) {
  .backlog-main-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .backlog-page-wrap {
    padding: 16px 12px 48px;
  }
  .backlog-kpi-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .backlog-rebalance-card {
    flex-direction: column;
    align-items: stretch;
    padding: 18px 16px;
    gap: 14px;
  }
  .backlog-rebalance-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    width: 100%;
  }
  .backlog-rebalance-cap {
    justify-content: space-between;
    width: 100%;
  }
  .backlog-rebalance-btn {
    width: 100%;
    min-height: 44px;
  }
  .backlog-section-panel {
    padding: 16px 12px;
  }
}
`;

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
    <div className="backlog-page-wrap">
      <style>{BACKLOG_CSS}</style>
      {/* Page Header */}
      <div className="backlog-header">
        <h1>Backlog Rescue Hub</h1>
        <p>
          Subject-wise backlog tracking, missed hours recovery, and realistic adaptive schedule rebalancing.
        </p>
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
          <div className="backlog-kpi-grid">
            <div className="backlog-kpi-card">
              <div className="backlog-kpi-label">Total Backlog Hours</div>
              <div className="backlog-kpi-val" style={{ color: backlogData.totalMissedHours > 10 ? '#ef4444' : backlogData.totalMissedHours > 0 ? '#f59e0b' : '#10b981' }}>
                {backlogData.totalMissedHours || 0} hrs
              </div>
              <div className="backlog-kpi-sub">{backlogData.totalMissedMinutes || 0} total uncompleted minutes</div>
            </div>

            <div className="backlog-kpi-card">
              <div className="backlog-kpi-label">Uncompleted Blocks</div>
              <div className="backlog-kpi-val" style={{ color: '#f8fafc' }}>
                {backlogData.totalMissedBlocks || 0} blocks
              </div>
              <div className="backlog-kpi-sub">Missed, skipped or partial sessions</div>
            </div>

            <div className="backlog-kpi-card">
              <div className="backlog-kpi-label">Recovery Diagnosis</div>
              <div style={{ fontSize: '13.5px', color: '#cbd5e1', fontWeight: '600', marginTop: '4px', lineHeight: '1.45', wordBreak: 'break-word' }}>
                {backlogData.recoveryPlan || 'No diagnosis available.'}
              </div>
            </div>
          </div>

          {/* Rebalancing Banner Trigger */}
          <div className="backlog-rebalance-card">
            <div className="backlog-rebalance-info">
              <h3>⚡ Adaptive Schedule Rebalancing</h3>
              <p>
                Redistribute missed backlog blocks realistically across the upcoming 7 days without generating impossible schedules.
              </p>
            </div>
            <div className="backlog-rebalance-actions">
              <div className="backlog-rebalance-cap">
                <span>Max Day Cap:</span>
                <input
                  type="number"
                  min="6"
                  max="14"
                  value={maxHoursPerDay}
                  onChange={e => setMaxHoursPerDay(e.target.value)}
                  className="backlog-rebalance-input"
                  aria-label="Max hours per day"
                />
                <span>hrs</span>
              </div>
              <button
                onClick={handleRebalance}
                disabled={rebalancing || backlogData.totalMissedBlocks === 0}
                className="backlog-rebalance-btn"
              >
                {rebalancing ? 'Rebalancing...' : 'Run Adaptive Rebalance'}
              </button>
            </div>
          </div>

          {rebalanceResult && (
            <div style={{ padding: '14px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', color: '#6ee7b7', marginBottom: '24px', fontSize: '13.5px', wordBreak: 'break-word' }}>
              ✓ {rebalanceResult.message}
            </div>
          )}

          <div className="backlog-main-grid">
            {/* Subject Breakdown */}
            <div>
              <div className="backlog-section-panel">
                <h3 className="backlog-section-title">Subject Backlog Split</h3>
                {(!backlogData.subjectBreakdown || backlogData.subjectBreakdown.length === 0) ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>No subject backlog logged.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {backlogData.subjectBreakdown.map(s => (
                      <div key={s.subject} className="backlog-split-item">
                        <div className="backlog-split-left">
                          <div className="backlog-split-subj">{s.subject}</div>
                          <div className="backlog-split-count">{s.missedBlocksCount} uncompleted session(s)</div>
                        </div>
                        <div className="backlog-split-hours">{s.missedHours} hrs</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Missed Blocks Detailed List */}
            <div>
              <div className="backlog-section-panel">
                <h3 className="backlog-section-title">Uncompleted Blocks Timeline</h3>
                {(!backlogData.missedBlocks || backlogData.missedBlocks.length === 0) ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>Your timeline has no missed blocks!</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {backlogData.missedBlocks.map(b => (
                      <div key={b.id || b.blockId} className="backlog-block-item">
                        <div className="backlog-block-info">
                          <div className="backlog-block-header">
                            <span className="backlog-block-subj">{b.subject}</span>
                            <span className="backlog-block-badge">{b.status}</span>
                          </div>
                          <div className="backlog-block-meta">{b.topic || b.title || 'Focus Session'} • Date: {b.dayKey}</div>
                        </div>
                        <div className="backlog-block-right">
                          <div className="backlog-block-min">{Math.round(b.remainingMinutes)}m</div>
                          <div className="backlog-block-rem">remaining</div>
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