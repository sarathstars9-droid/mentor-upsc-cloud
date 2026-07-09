import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";
import FocusPyqSession from "../components/Prelims/FocusPyqSession";

const USER_ID = "user_1";

// ── Risk palette — consistent with RevisionPage and SyllabusPage ──────────────
const RISK_COLOR = { low: "#6b7280", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };
const RISK_BG    = { low: "#111",    medium: "#1a1200",  high: "#1a0800",  critical: "#1a0000" };

const MENTOR_MSG = {
  critical: "High-risk topic. Ignoring this will directly cost rank.",
  high:     "This topic is actively reducing your score. Immediate correction required.",
  medium:   "This node is leaking marks. Fix it before attempting new topics.",
  low:      "You are close to mastery. One focused session will complete this node.",
  none:     "No weakness score yet. Use this workspace to prepare this node from scratch.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function lookupWeakness(nodeId, weaknessMap) {
  if (!nodeId || !weaknessMap) return null;
  // Try all stage variants stored in the map
  for (const key of Object.keys(weaknessMap)) {
    const base = key.split("::")[0];
    if (base === nodeId) return weaknessMap[key];
  }
  return null;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const diff = new Date() - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatNext(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const diff = d - new Date();
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

// ── Small shared atoms ────────────────────────────────────────────────────────
function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#0f0f0f",
      border: `1px solid ${color ? color + "33" : "#1e1e1e"}`,
      borderRadius: 10, padding: "14px 16px", flex: "1 1 140px",
    }}>
      <div style={{
        fontSize: 26, fontWeight: 800,
        color: color || "#e5e7eb", fontFamily: "monospace", lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: "#555", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ActionBtn({ label, onClick, variant = "default" }) {
  const styles = {
    default: { background: "#111", border: "1px solid #2a2a2a", color: "#ccc" },
    primary: { background: "#1a1200", border: "1px solid #f59e0b66", color: "#f59e0b" },
    danger:  { background: "#1a0000", border: "1px solid #ef444466", color: "#ef4444" },
  };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles[variant],
        borderRadius: 8, padding: "9px 18px", fontSize: 12,
        fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
        letterSpacing: "0.04em", transition: "opacity 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: "#f59e0b",
        letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace",
      }}>{label}</span>
      {count !== undefined && (
        <span style={{
          background: "#1a1200", border: "1px solid #f59e0b44", color: "#f59e0b",
          fontSize: 10, fontWeight: 700, borderRadius: 10,
          padding: "1px 8px", fontFamily: "monospace",
        }}>{count}</span>
      )}
      <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
    </div>
  );
}

// ── MistakeCard ───────────────────────────────────────────────────────────────
function MistakeCard({ m }) {
  const statusColor = m.answer_status === "wrong" ? "#ef4444"
    : m.answer_status === "unattempted" ? "#6366f1" : "#22c55e";
  return (
    <div style={{
      background: "#0c0c0c",
      border: "1px solid #1a1a1a",
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 8, padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5, marginBottom: 6 }}>
        {m.question_text || m.question_id || "—"}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: statusColor, fontWeight: 700 }}>
          {m.answer_status || "unknown"}
        </span>
        {m.error_type && (
          <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
            {m.error_type}
          </span>
        )}
        {m.source_type && (
          <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>
            {m.source_type}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace", marginLeft: "auto" }}>
          {formatDate(m.updated_at || m.created_at)}
        </span>
      </div>
      {m.must_revise && (
        <span style={{
          display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 700,
          color: "#ef4444", fontFamily: "monospace", letterSpacing: "0.06em",
        }}>MUST REVISE</span>
      )}
    </div>
  );
}

// ── RevisionCard ──────────────────────────────────────────────────────────────
function RevisionItemCard({ item, onReview, onSnooze, isFirst }) {
  const isOverdue = item.next_review_at && new Date(item.next_review_at) < new Date();
  const accentColor = isOverdue ? "#ef4444" : item.status === "snoozed" ? "#6366f1" : "#f59e0b";
  return (
    <div style={{ marginBottom: 8 }}>
      {isFirst && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: "#22c55e",
          fontFamily: "monospace", letterSpacing: "0.12em",
          marginBottom: 4, paddingLeft: 2,
        }}>▶ START HERE</div>
      )}
    <div style={{
      background: "#0c0c0c",
      border: `1px solid ${accentColor}22`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 8, padding: "12px 14px",
    }}>
      <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5, marginBottom: 6 }}>
        {item.title || item.question_text || item.question_id || "—"}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: accentColor, fontWeight: 600 }}>
          {isOverdue ? "⚠ overdue" : formatNext(item.next_review_at)}
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          reviews: {item.review_count ?? item.revision_count ?? 0}
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          interval: {item.interval_days ?? 1}d
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onReview(item.id)}
          style={{
            background: "#0a1a0a", border: "1px solid #22c55e44", color: "#22c55e",
            borderRadius: 6, padding: "5px 12px", fontSize: 10,
            cursor: "pointer", fontFamily: "monospace", fontWeight: 600,
          }}
        >✓ Reviewed</button>
        <button
          onClick={() => onSnooze(item.id, 1)}
          style={{
            background: "#0a0a1a", border: "1px solid #6366f144", color: "#6366f1",
            borderRadius: 6, padding: "5px 10px", fontSize: 10,
            cursor: "pointer", fontFamily: "monospace",
          }}
        >Snooze 1d</button>
      </div>
    </div>
    </div>
  );
}

// ── Mode Selection Modal ──────────────────────────────────────────────────────
function PyqModeModal({ nodeId, allPrelimsMCQs, weakAreaQs, onStart, onClose }) {
  const modes = [
    {
      id: "quick",
      label: "Quick Drill",
      sub: "5 most recent prelims questions",
      count: Math.min(5, allPrelimsMCQs.length),
      questions: allPrelimsMCQs.slice(0, 5),
      color: "#f59e0b",
    },
    {
      id: "full",
      label: "Full Topic",
      sub: `All prelims questions for this node`,
      count: allPrelimsMCQs.length,
      questions: allPrelimsMCQs,
      color: "#38bdf8",
    },
    {
      id: "weak",
      label: "Weak Areas Only",
      sub: "Questions you previously got wrong",
      count: weakAreaQs.length,
      questions: weakAreaQs,
      color: "#ef4444",
    },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.88)",
      zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <div style={{
        background: "#0c0c0c",
        border: "1px solid #222",
        borderRadius: 14,
        padding: "28px 28px 22px",
        width: "min(460px, 92vw)",
      }}>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
          PYQ PRACTICE · {nodeId}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#e5e7eb", marginBottom: 20 }}>
          Choose practice mode
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modes.map((m) => {
            const disabled = m.count === 0;
            return (
              <button
                key={m.id}
                disabled={disabled}
                onClick={() => !disabled && onStart(m.id, m.questions)}
                style={{
                  background: disabled ? "#0a0a0a" : "#111",
                  border: `1px solid ${disabled ? "#1e1e1e" : m.color + "33"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  textAlign: "left",
                  cursor: disabled ? "not-allowed" : "pointer",
                  color: disabled ? "#333" : "#e5e7eb",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                    color: disabled ? "#333" : m.color,
                  }}>
                    {m.label}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                    color: disabled ? "#2a2a2a" : m.color,
                  }}>
                    {m.count} Q
                  </span>
                </div>
                <div style={{ fontSize: 11, color: disabled ? "#2a2a2a" : "#555", fontFamily: "monospace" }}>
                  {disabled ? "No questions available for this mode" : m.sub}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18, background: "none", border: "none",
            color: "#444", cursor: "pointer", fontSize: 11,
            fontFamily: "monospace", padding: 0,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPrelimsMCQ(q) {
  const id = String(q?.id || q?.questionId || "").toUpperCase();
  if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) return false;
  if (id.startsWith("PRE_")) return true;
  return String(q?.exam || "").toLowerCase() === "prelims";
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FocusPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nodeId = searchParams.get("nodeId") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weakness, setWeakness] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [pyq, setPyq] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [pyqSession, setPyqSession] = useState(null);
  const [showModeModal, setShowModeModal] = useState(false);

  // Active Block State
  const [activeTask, setActiveTask] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [outputType, setOutputType] = useState('notes');
  const [outputCount, setOutputCount] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [noProofRequired, setNoProofRequired] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);

  const getTodayKey = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayKey = getTodayKey();
      const [weakRes, mistakeRes, revRes, pyqRes, cmdCenterRes] = await Promise.allSettled([
        nodeId ? fetch(`${BACKEND_URL}/api/weakness/map?userId=${USER_ID}`, { cache: "no-store" }) : Promise.resolve({ ok: false }),
        nodeId ? fetch(`${BACKEND_URL}/api/mistakes?userId=${USER_ID}`, { cache: "no-store" }) : Promise.resolve({ ok: false }),
        nodeId ? fetch(`${BACKEND_URL}/api/revision-items?userId=${USER_ID}`, { cache: "no-store" }) : Promise.resolve({ ok: false }),
        nodeId ? fetch(`${BACKEND_URL}/api/pyq/node/${encodeURIComponent(nodeId)}`, { cache: "no-store" }) : Promise.resolve({ ok: false }),
        fetch(`${BACKEND_URL}/api/daily-execution/command-center?userId=${USER_ID}&date=${todayKey}`, { cache: "no-store" })
      ]);

      if (cmdCenterRes.status === "fulfilled" && cmdCenterRes.value.ok) {
        try {
          const d = await cmdCenterRes.value.json();
          if (d.nowTask && (d.nowTask.status === 'active' || d.command?.primaryAction === 'Continue Focus')) {
            setActiveTask(d.nowTask);
          } else {
            setActiveTask(null);
          }
        } catch (_) {}
      }

      if (!nodeId) {
        setLoading(false);
        return;
      }

      // Weakness
      if (weakRes.status === "fulfilled" && weakRes.value.ok) {
        try {
          const d = await weakRes.value.json();
          setWeakness(lookupWeakness(nodeId, d.map || {}));
        } catch (_) {}
      }

      // Mistakes filtered by node_id
      if (mistakeRes.status === "fulfilled" && mistakeRes.value.ok) {
        try {
          const d = await mistakeRes.value.json();
          const arr = Array.isArray(d) ? d : (d.items || []);
          setMistakes(arr.filter(m => m.node_id === nodeId));
        } catch (_) {}
      }

      // Revisions filtered by node_id, active only
      if (revRes.status === "fulfilled" && revRes.value.ok) {
        try {
          const d = await revRes.value.json();
          const arr = Array.isArray(d) ? d : (d.items || d.data || []);
          setRevisions(
            arr
              .filter(r => r.node_id === nodeId && r.status !== "reviewed")
              .sort((a, b) => {
                const da = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
                const db = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
                return da - db;
              })
          );
        } catch (_) {}
      }

      // PYQ
      if (pyqRes.status === "fulfilled" && pyqRes.value.ok) {
        try {
          const d = await pyqRes.value.json();
          if (d.success) setPyq(d);
        } catch (_) {}
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/revision-items/${id}/review`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTimeout(() => load(), 150);
    } catch (e) {
      setActionMsg(`Review failed: ${e.message}`);
    }
  };

  const handleSnooze = async (id, days) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/revision-items/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTimeout(() => load(), 150);
    } catch (e) {
      setActionMsg(`Snooze failed: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!activeTask) return;
    const startStr = activeTask.actual_start || activeTask.started_at;
    let startTime = startStr ? new Date(startStr).getTime() : Date.now();
    const pausedSecs = activeTask.total_pause_seconds || 0;
    
    const interval = setInterval(() => {
      const now = Date.now();
      let diff = Math.floor((now - startTime) / 1000) - pausedSecs;
      if (diff < 0) diff = 0;
      setElapsed(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTask]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const handlePause = async () => {
    if (!activeTask) return;
    try {
      const todayKey = getTodayKey();
      const blockId = activeTask?.blockId || activeTask?.block_id || activeTask?.id;
      if (!blockId) {
        alert("Cannot identify the active study block. Please go back to Execution and start again.");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pauseBlock', userId: USER_ID, payload: { blockId, dayKey: todayKey } })
      });
      const data = await res.json();
      if (data.ok) navigate('/execution');
      else alert(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteWithProof = async () => {
    if (!activeTask) return;
    if (!noProofRequired && !selectedFile && !proofNotes.trim()) {
      alert('Proof validation required! Please upload a photo/file, enter proof notes, or check "No proof required".');
      return;
    }
    try {
      setSubmittingProof(true);
      let proofUrl = null;
      let proofStatus = noProofRequired ? 'waived' : 'verified';
      let proofType = noProofRequired ? 'none' : (selectedFile ? 'image' : 'notes_text');
      const todayKey = getTodayKey();
      const blockId = activeTask?.blockId || activeTask?.block_id || activeTask?.id;
      
      if (!blockId) {
        alert("Cannot identify the active study block. Please go back to Execution and start again.");
        setSubmittingProof(false);
        return;
      }

      if (selectedFile && !noProofRequired) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('blockId', blockId);
        formData.append('dayKey', todayKey);
        formData.append('proofType', proofType);
        formData.append('proofNotes', proofNotes);
        const uploadRes = await fetch(`${BACKEND_URL}/api/plan/blocks/upload-proof?userId=${USER_ID}`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.ok) { proofUrl = uploadData.proofUrl; } 
        else { alert('Failed to upload proof file: ' + uploadData.message); setSubmittingProof(false); return; }
      }

      const completeRes = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'completeBlock',
          userId: USER_ID,
          payload: { blockId, dayKey: todayKey, reason: 'completed', outputType, outputCount: Number(outputCount) || 1, proofUrl, proofType, proofStatus, proofNotes }
        })
      });
      const completeData = await completeRes.json();
      if (completeData.ok) {
        setSelectedFile(null); setProofNotes(''); setNoProofRequired(false); navigate('/execution');
      } else {
        alert(completeData.message || 'Failed to complete block');
      }
    } catch (err) { alert('Error: ' + err.message); } finally { setSubmittingProof(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const risk = weakness?.risk_level || "none";
  const score = weakness ? Number(weakness.weakness_score) || 0 : null;
  const subject = weakness?.subject || mistakes[0]?.subject || revisions[0]?.subject || "—";
  const stage = weakness?.stage || mistakes[0]?.stage || revisions[0]?.stage || "—";
  const riskColor = RISK_COLOR[risk] || "#6b7280";

  const overdueMistakeCount = mistakes.filter(m => m.must_revise).length;
  const overdueRevCount = revisions.filter(r =>
    r.next_review_at && new Date(r.next_review_at) < new Date()
  ).length;
  const unresolvedTotal = mistakes.length + revisions.filter(r => r.status === "pending").length;

  const pyqTotal = pyq?.counts?.total || 0;
  const pyqPrelims = pyq?.counts?.prelims || 0;
  const pyqMains = pyq?.counts?.mains || 0;
  const pyqQuestions = Array.isArray(pyq?.questions) ? pyq.questions : [];
  const lastAskedYear = pyqQuestions.reduce((acc, q) => {
    const y = Number(q?.year || q?.Year || 0);
    return y > acc ? y : acc;
  }, 0);

  const allPrelimsMCQs = pyqQuestions.filter(isPrelimsMCQ);
  const mistakeQids = new Set(mistakes.map((m) => m.question_id).filter(Boolean));
  const weakAreaQs = allPrelimsMCQs.filter((q) => {
    const id = String(q.id || q.questionId || "");
    return id && mistakeQids.has(id);
  });

  const nextStep = unresolvedTotal === 0
    ? "All clear. Take a practice test on this node."
    : revisions.length > 0
      ? `Review ${revisions.length} pending revision item${revisions.length > 1 ? "s" : ""} first.`
      : `Solve ${mistakes.length} unanswered mistake${mistakes.length > 1 ? "s" : ""}.`;

  if (pyqSession) {
    return (
      <FocusPyqSession
        nodeId={nodeId}
        questions={pyqSession.questions}
        mode={pyqSession.mode}
        onClose={() => {
          setPyqSession(null);
          load();
        }}
      />
    );
  }

  if (activeTask) {
    return (
      <div style={{ background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" }}>
        <button onClick={() => navigate('/execution')} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, fontFamily: "monospace", marginBottom: 20, padding: 0 }}>← Back to Execution</button>
        <div style={{ background: "#0c0c0c", border: "1px solid #2FBF7133", borderLeft: "4px solid #2FBF71", borderRadius: 12, padding: "22px 26px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>CURRENT FOCUS BLOCK</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{activeTask.subject || activeTask.title || 'Focus Session'}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Planned: {activeTask.planned_start} - {activeTask.planned_end} ({activeTask.planned_minutes} min)</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#2FBF71", fontFamily: "monospace", lineHeight: 1 }}>{formatTime(elapsed)}</div>
          <div style={{ fontSize: 12, color: "#7F8897", marginTop: 6, marginBottom: 20 }}>Elapsed Time</div>
          
          <button onClick={handlePause} style={{ background: "#1a1200", border: "1px solid #f59e0b66", color: "#f59e0b", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>Pause Block</button>
        </div>

        <div style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderRadius: 12, padding: "22px 26px" }}>
          <h3 style={{ fontSize: 14, color: "#D6B56D", margin: "0 0 20px 0", fontFamily: "monospace" }}>🛡️ Mandatory Study Proof</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#7F8897', marginBottom: '8px', fontFamily: "monospace" }}>Output Type</label>
              <select value={outputType} onChange={e => setOutputType(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#e5e7eb', outline: 'none', fontFamily: "monospace" }}>
                <option value="notes">Handwritten / Digital Notes</option>
                <option value="pyq_practice">PYQ Questions Solved</option>
                <option value="answer_written">Mains Answer Written</option>
                <option value="revision_sheet">Revision Summary Sheet</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#7F8897', marginBottom: '8px', fontFamily: "monospace" }}>Quantity (Pages/Qs)</label>
              <input type="number" min="1" value={outputCount} onChange={e => setOutputCount(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#e5e7eb', outline: 'none', boxSizing: 'border-box', fontFamily: "monospace" }} />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#7F8897', marginBottom: '8px', fontFamily: "monospace" }}>Proof File / Photo</label>
            <input type="file" disabled={noProofRequired} onChange={e => setSelectedFile(e.target.files[0])} style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#B8C0CC', boxSizing: 'border-box', fontFamily: "monospace" }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#7F8897', marginBottom: '8px', fontFamily: "monospace" }}>Study Notes</label>
            <textarea rows="2" placeholder="Describe key takeaways..." value={proofNotes} onChange={e => setProofNotes(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#F5F7FB', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: "monospace" }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <input type="checkbox" id="noProof" checked={noProofRequired} onChange={e => setNoProofRequired(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#D6B56D', cursor: 'pointer' }} />
            <label htmlFor="noProof" style={{ fontSize: '12px', color: '#B8C0CC', cursor: 'pointer', fontFamily: "monospace" }}>
              Mark "No proof required for this block"
            </label>
          </div>

          <button 
            onClick={handleCompleteWithProof} 
            disabled={submittingProof} 
            style={{ width: '100%', padding: '14px', fontSize: '14px', background: '#1a1a1a', border: '1px solid #2FBF7166', color: '#2FBF71', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: "monospace" }}
          >
            {submittingProof ? 'Verifying...' : '✓ Complete Block & Submit Verification'}
          </button>
        </div>
      </div>
    );
  }

  if (!nodeId) {
    return (
      <div style={{ background: "#080808", minHeight: "100vh", padding: "48px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 8, color: "#fff" }}>No active focus session.</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Start a study block from Execution or Plan to enter Focus Mode.</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <ActionBtn label="Go to Execution" onClick={() => navigate('/execution')} variant="primary" />
          <ActionBtn label="Go to Plan" onClick={() => navigate('/plan')} variant="default" />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#080808", minHeight: "100vh", padding: "28px 32px",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb",
    }}>

      {/* ── MODE SELECTION MODAL ─────────────────────────────────────────────── */}
      {showModeModal && (
        <PyqModeModal
          nodeId={nodeId}
          allPrelimsMCQs={allPrelimsMCQs}
          weakAreaQs={weakAreaQs}
          onStart={(mode, questions) => {
            setShowModeModal(false);
            setPyqSession({ questions, mode });
          }}
          onClose={() => setShowModeModal(false)}
        />
      )}

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none", border: "none", color: "#555", cursor: "pointer",
          fontSize: 12, fontFamily: "monospace", marginBottom: 20, padding: 0,
        }}
      >
        ← Back
      </button>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div style={{
        background: "#0c0c0c",
        border: `1px solid ${riskColor}33`,
        borderLeft: `4px solid ${riskColor}`,
        borderRadius: 12, padding: "22px 26px", marginBottom: 24,
        boxShadow: risk !== "none" && risk !== "low"
          ? `0 0 0 1px ${riskColor}18`
          : "none",
      }}>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
          MENTOROS · FOCUS WORKSPACE
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", marginBottom: 4 }}>
              {nodeId}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
              {subject !== "—" && (
                <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>
                  <span style={{ color: "#333" }}>subject</span> {subject}
                </span>
              )}
              {stage !== "—" && (
                <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>
                  <span style={{ color: "#333" }}>stage</span> {stage}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#666", maxWidth: 520, lineHeight: 1.6 }}>
              {MENTOR_MSG[risk]}
            </div>
          </div>

          {/* Score / risk badge */}
          {score !== null && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontSize: 48, fontWeight: 900, color: riskColor,
                fontFamily: "monospace", lineHeight: 1,
              }}>{score}</div>
              <div style={{
                background: RISK_BG[risk] || "#111",
                border: `1px solid ${riskColor}44`,
                color: riskColor,
                fontSize: 10, fontWeight: 700, borderRadius: 4,
                padding: "3px 10px", letterSpacing: "0.1em",
                textTransform: "uppercase", fontFamily: "monospace",
                display: "inline-block", marginTop: 6,
              }}>{risk}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── RECOVERY PROGRESS BAR ───────────────────────────────────────────── */}
      {(mistakes.length > 0 || revisions.length > 0 || (weakness?.reviewed_count || 0) > 0) && (() => {
        const resolved = Number(weakness?.reviewed_count || 0);
        const unresolved = mistakes.length + revisions.length;
        const total = resolved + unresolved;
        const pct = total > 0 ? Math.min(100, Math.round((resolved / total) * 100)) : 0;
        const barColor = pct >= 75 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "#444", fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Node Recovery
              </span>
              <span style={{ fontSize: 10, color: barColor, fontFamily: "monospace", fontWeight: 700 }}>
                {pct}% — {resolved} reviewed · {unresolved} pending
              </span>
            </div>
            <div style={{ height: 4, background: "#111", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: barColor,
                borderRadius: 4,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── ERROR / LOADING ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: "#1a0000", border: "1px solid #ef444433",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          fontSize: 12, color: "#ef4444", fontFamily: "monospace",
        }}>
          ⚠ {error}
          <button onClick={load} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", marginLeft: 12, fontFamily: "monospace", fontSize: 11 }}>Retry</button>
        </div>
      )}
      {actionMsg && (
        <div style={{
          background: "#1a0800", border: "1px solid #f9731633",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 12, color: "#f97316", fontFamily: "monospace",
        }}>
          {actionMsg}
          <button onClick={() => setActionMsg("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", marginLeft: 12 }}>×</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#333", fontSize: 12, fontFamily: "monospace" }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>⟳</div>
          Loading node data…
        </div>
      ) : (
        <>
          {/* ── WHY WEAK ─────────────────────────────────────────────────────── */}
          {weakness && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle label="Why This Node Is Weak" />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <MetricCard
                  label="Mistakes"
                  value={weakness.mistake_count || 0}
                  color={Number(weakness.mistake_count) > 0 ? "#ef4444" : null}
                  sub="wrong answers logged"
                />
                <MetricCard
                  label="Repeat Mistakes"
                  value={weakness.repeat_mistake_count || 0}
                  color={Number(weakness.repeat_mistake_count) > 0 ? "#ef4444" : null}
                  sub="same question re-failed"
                />
                <MetricCard
                  label="Pending Revision"
                  value={weakness.pending_revision_count || 0}
                  color={Number(weakness.pending_revision_count) > 0 ? "#f59e0b" : null}
                  sub="items not yet reviewed"
                />
                <MetricCard
                  label="Overdue"
                  value={weakness.overdue_revision_count || 0}
                  color={Number(weakness.overdue_revision_count) > 0 ? "#f97316" : null}
                  sub="past due date"
                />
                <MetricCard
                  label="Reviewed"
                  value={weakness.reviewed_count || 0}
                  color="#22c55e"
                  sub="sessions completed"
                />
              </div>
            </div>
          )}

          {/* ── ACTION STRIP ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <SectionTitle label="Quick Actions" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <ActionBtn
                label="Revise Theory"
                variant="primary"
                onClick={() => navigate(`/pyq/topic/${encodeURIComponent(nodeId)}`)}
              />
              <ActionBtn
                label="Solve PYQs"
                variant={revisions.length > 0 ? "default" : "primary"}
                onClick={() => {
                  if (revisions.length > 0) {
                    setActionMsg("Finish revision items first.");
                    return;
                  }
                  if (allPrelimsMCQs.length === 0) {
                    setActionMsg("No prelims questions available for this node.");
                    return;
                  }
                  setShowModeModal(true);
                }}
              />
              <ActionBtn
                label="Recompute Score"
                variant="default"
                onClick={async () => {
                  await fetch(`${BACKEND_URL}/api/weakness/recompute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: USER_ID }),
                  });
                  load();
                }}
              />
              <ActionBtn
                label="Go to Revision Queue"
                variant="default"
                onClick={() => navigate("/revision")}
              />
            </div>
            <div style={{
              fontSize: 11, color: "#555", fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}>
              ⚠ Follow order: Revision → Mistakes → PYQs. Do not skip.
            </div>
          </div>

          {/* ── TWO-COLUMN LAYOUT ────────────────────────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}>
            {/* LEFT COLUMN */}
            <div>
              {/* Mistake stack */}
              <div style={{ marginBottom: 28 }}>
                <SectionTitle label="Mistake Stack" count={mistakes.length} />
                {mistakes.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace", padding: "14px 0" }}>
                    No mistakes recorded for this node.
                  </div>
                ) : (
                  mistakes.map((m) => <MistakeCard key={m.id} m={m} />)
                )}
              </div>

              {/* Recovery status */}
              <div style={{
                background: "#0f0f0f",
                border: `1px solid ${unresolvedTotal > 0 ? "#f59e0b33" : "#1e1e1e"}`,
                borderRadius: 10, padding: "18px 20px",
              }}>
                <SectionTitle label="Recovery Status" />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <MetricCard label="Unresolved" value={unresolvedTotal} color={unresolvedTotal > 0 ? "#f97316" : "#22c55e"} />
                  <MetricCard label="Must Revise" value={overdueMistakeCount} color={overdueMistakeCount > 0 ? "#ef4444" : null} />
                  <MetricCard label="Overdue Rev." value={overdueRevCount} color={overdueRevCount > 0 ? "#f97316" : null} />
                </div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
                  <span style={{ color: "#555" }}>Suggested next step: </span>
                  {nextStep}
                </div>
                {unresolvedTotal === 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                    ✓ This node is cleared. Maintain with spaced repetition.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* Revision queue */}
              <div style={{ marginBottom: 28 }}>
                <SectionTitle label="Revision Queue" count={revisions.length} />
                {revisions.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace", padding: "14px 0" }}>
                    No pending revision items for this node.
                  </div>
                ) : (
                  revisions.map((r, idx) => (
                    <RevisionItemCard key={r.id} item={r} onReview={handleReview} onSnooze={handleSnooze} isFirst={idx === 0} />
                  ))
                )}
              </div>

              {/* PYQ summary */}
              <div style={{
                background: "#0f0f0f",
                border: "1px solid #1e1e1e",
                borderRadius: 10, padding: "18px 20px",
              }}>
                <SectionTitle label="PYQ Summary" />
                {pyqTotal === 0 ? (
                  <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace", lineHeight: 1.6, marginBottom: 14 }}>
                    No direct PYQs linked to this node yet. Use this node for concept strengthening or open broader topic PYQs.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <MetricCard label="Total PYQs" value={pyqTotal} color="#38bdf8" />
                    <MetricCard label="Prelims" value={pyqPrelims} />
                    <MetricCard label="Mains" value={pyqMains} />
                    {lastAskedYear > 0 && (
                      <MetricCard label="Last Asked" value={lastAskedYear} />
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionBtn
                    label={pyqPrelims > 0 ? `Start ${pyqPrelims} PYQs` : "Browse PYQs"}
                    variant="primary"
                    onClick={() => {
                      if (allPrelimsMCQs.length === 0) {
                        setActionMsg("No prelims questions available for this node.");
                        return;
                      }
                      setShowModeModal(true);
                    }}
                  />
                  <ActionBtn
                    label="View All PYQs"
                    variant="default"
                    onClick={() => navigate(`/pyq/topic/${encodeURIComponent(nodeId)}`)}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
