// src/pages/PrelimsTestAttemptPage.jsx
// Prelims Test Engine — Live attempt UI
// Questions, options, palette, timer, mark-for-review, auto-save on answer

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BACKEND_URL } from "../config";

const USER_ID = "user_1";

// ── Design tokens ─────────────────────────────────────────────────────────────
const PAGE_BG = {
  minHeight: "100vh",
  background: "#020617",
  color: "#f8fafc",
  fontFamily: "'Inter', sans-serif",
};

const CARD = {
  background: "rgba(15,23,42,0.94)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 18,
  padding: 22,
};

const OPT_KEY = ["A", "B", "C", "D"];

const optionStyle = (selected, key) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "13px 16px",
  borderRadius: 12,
  border: selected === key
    ? "1.5px solid rgba(56,189,248,0.7)"
    : "1px solid rgba(148,163,184,0.14)",
  background: selected === key
    ? "rgba(14,165,233,0.14)"
    : "rgba(15,23,42,0.7)",
  cursor: "pointer",
  marginBottom: 10,
  transition: "all 0.15s",
});

const PAL_CELL = (status) => {
  const base = { width: 36, height: 36, borderRadius: 8, border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.1s" };
  if (status === "answered")  return { ...base, background: "rgba(34,197,94,0.25)", color: "#86efac", border: "1px solid #22c55e44" };
  if (status === "review")    return { ...base, background: "rgba(250,204,21,0.2)", color: "#fde047", border: "1px solid #facc1544" };
  if (status === "skipped")   return { ...base, background: "rgba(248,113,113,0.15)", color: "#fca5a5", border: "1px solid #f8717144" };
  return { ...base, background: "rgba(30,41,59,0.8)", color: "#64748b", border: "1px solid rgba(148,163,184,0.1)" };
};

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PrelimsTestAttemptPage() {
  const { attemptId } = useParams();
  const location  = useLocation();
  const navigate  = useNavigate();

  const { questions = [], attempt, title = "Prelims Test", paper = "GS", mode = "mixed" }
    = location.state || {};

  // ── State ─────────────────────────────────────────────────────────────────
  const [currentIdx, setCurrentIdx]         = useState(0);
  const [answers, setAnswers]               = useState({});   // { questionId: "A"|"B"|"C"|"D" }
  const [markedForReview, setMarkedForReview] = useState({}); // { questionId: bool }
  const [timeSpent, setTimeSpent]           = useState({});   // { questionId: seconds }
  const [totalElapsed, setTotalElapsed]     = useState(0);
  const [saving, setSaving]                 = useState(false);
  const [submitLoading, setSubmitLoading]   = useState(false);
  const [confirmSubmit, setConfirmSubmit]   = useState(false);

  const questionEnteredAt = useRef(Date.now());
  const timerRef          = useRef(null);

  // ── Global timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setTotalElapsed(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Track time when question changes
  useEffect(() => {
    const prev = currentIdx;
    return () => {
      const spent = Math.round((Date.now() - questionEnteredAt.current) / 1000);
      const qid   = questions[prev]?.id;
      if (qid) setTimeSpent(ts => ({ ...ts, [qid]: (ts[qid] || 0) + spent }));
      questionEnteredAt.current = Date.now();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  if (!questions.length) {
    return (
      <div style={{ ...PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ color: "#64748b", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div>No questions loaded. Please go back and start a new test.</div>
          <button onClick={() => navigate("/prelims/test")} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: "none", background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" }}>← Back</button>
        </div>
      </div>
    );
  }

  const q   = questions[currentIdx];
  const qid = q?.id;

  // ── Select answer (auto-save) ──────────────────────────────────────────────
  const handleSelect = useCallback(async (key) => {
    if (!qid) return;
    setAnswers(prev => ({ ...prev, [qid]: key }));
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/prelims-tests/attempts/${attemptId}/response`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: USER_ID,
          questionId: qid,
          selectedAnswer: key,
          timeSpentSeconds: (timeSpent[qid] || 0) + Math.round((Date.now() - questionEnteredAt.current) / 1000),
          markedForReview: markedForReview[qid] ?? false,
        }),
      });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }, [qid, attemptId, timeSpent, markedForReview]);

  function toggleReview() {
    if (!qid) return;
    setMarkedForReview(prev => ({ ...prev, [qid]: !prev[qid] }));
  }

  // ── Palette status ────────────────────────────────────────────────────────
  function paletteStatus(q) {
    const id = q?.id;
    if (markedForReview[id])  return "review";
    if (answers[id])          return "answered";
    return "unattempted";
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitLoading(true);
    try {
      // Flush current question time
      const finalTimeSpent = {
        ...timeSpent,
        [qid]: (timeSpent[qid] || 0) + Math.round((Date.now() - questionEnteredAt.current) / 1000),
      };

      const responses = questions.map(q => ({
        questionId:      q.id,
        selectedAnswer:  answers[q.id] || null,
        timeSpentSeconds: finalTimeSpent[q.id] || 0,
        markedForReview: markedForReview[q.id] ?? false,
      }));

      const res = await fetch(`${BACKEND_URL}/api/prelims-tests/attempts/${attemptId}/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, responses }),
      });
      const data = await res.json();
      if (!data.ok && !data.attemptId) throw new Error(data.error || "Submit failed");

      navigate(`/prelims/test/result/${attemptId}`, {
        state: { result: data, questions, paper, mode, title },
      });
    } catch (err) {
      alert(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitLoading(false);
      setConfirmSubmit(false);
    }
  }

  const answered  = Object.keys(answers).filter(id => answers[id]).length;
  const reviewed  = Object.keys(markedForReview).filter(id => markedForReview[id]).length;
  const unattempted = questions.length - answered;

  return (
    <div style={PAGE_BG}>
      {/* ── Top bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(2,6,23,0.96)", borderBottom: "1px solid rgba(148,163,184,0.1)",
        padding: "12px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#e0f2fe", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {saving && <span style={{ fontSize: 11, color: "#38bdf8" }}>Saving…</span>}
          <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#fde047" }}>⏱ {formatTime(totalElapsed)}</span>
          <button
            onClick={() => setConfirmSubmit(true)}
            style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.12)", color: "#86efac", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >Submit Test</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 0, height: "calc(100vh - 57px)" }}>

        {/* ── Question area ── */}
        <div style={{ padding: "20px 24px", overflowY: "auto" }}>
          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Question {currentIdx + 1} of {questions.length}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(34,197,94,0.15)", color: "#86efac", fontWeight: 700 }}>{answered} answered</span>
              {reviewed > 0 && <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(250,204,21,0.12)", color: "#fde047", fontWeight: 700 }}>{reviewed} marked</span>}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(30,41,59,0.8)", borderRadius: 99, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((currentIdx + 1) / questions.length) * 100}%`, background: "linear-gradient(90deg,#0ea5e9,#8b5cf6)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>

          {/* Question card */}
          <div style={CARD}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {q?.year && `${q.year}  ·  `}{paper} Prelims  ·  Q{q?.questionNumber || currentIdx + 1}
            </div>
            <div style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.75, marginBottom: 22, fontWeight: 500 }}>
              {q?.question || "Question text not available."}
            </div>

            {/* Options */}
            {OPT_KEY.map(key => {
              const text = q?.options?.[key];
              if (!text) return null;
              return (
                <div key={key} onClick={() => handleSelect(key)} style={optionStyle(answers[qid], key)}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: answers[qid] === key ? "rgba(14,165,233,0.3)" : "rgba(30,41,59,0.8)",
                    color: answers[qid] === key ? "#38bdf8" : "#64748b",
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>{key}</span>
                  <span style={{ fontSize: 14, color: answers[qid] === key ? "#e0f2fe" : "#94a3b8", lineHeight: 1.6, fontWeight: answers[qid] === key ? 600 : 400 }}>
                    {text}
                  </span>
                </div>
              );
            })}

            {/* Mark for review */}
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={toggleReview}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: markedForReview[qid] ? "1px solid rgba(250,204,21,0.5)" : "1px solid rgba(148,163,184,0.2)",
                  background: markedForReview[qid] ? "rgba(250,204,21,0.12)" : "rgba(15,23,42,0.7)",
                  color: markedForReview[qid] ? "#fde047" : "#94a3b8",
                  fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}
              >
                {markedForReview[qid] ? "★ Marked for Review" : "☆ Mark for Review"}
              </button>
              {answers[qid] && (
                <button
                  onClick={() => setAnswers(prev => { const n = { ...prev }; delete n[qid]; return n; })}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >Clear Answer</button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(i => i - 1)}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(15,23,42,0.8)", color: currentIdx === 0 ? "#334155" : "#94a3b8", fontWeight: 700, fontSize: 14, cursor: currentIdx === 0 ? "not-allowed" : "pointer" }}
            >← Previous</button>
            <button
              disabled={currentIdx === questions.length - 1}
              onClick={() => setCurrentIdx(i => i + 1)}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid rgba(56,189,248,0.25)", background: "rgba(14,165,233,0.1)", color: currentIdx === questions.length - 1 ? "#334155" : "#38bdf8", fontWeight: 700, fontSize: 14, cursor: currentIdx === questions.length - 1 ? "not-allowed" : "pointer" }}
            >Next →</button>
          </div>
        </div>

        {/* ── Right panel: palette ── */}
        <div style={{ borderLeft: "1px solid rgba(148,163,184,0.08)", padding: "20px 16px", overflowY: "auto", background: "rgba(2,6,23,0.5)" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Question Palette</div>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Answered", color: "#22c55e" },
              { label: "Marked", color: "#facc15" },
              { label: "Not visited", color: "#475569" },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => setCurrentIdx(i)} style={{
                ...PAL_CELL(paletteStatus(q)),
                outline: i === currentIdx ? "2px solid #38bdf8" : "none",
                outlineOffset: 2,
              }}>{i + 1}</button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Answered", val: answered, color: "#22c55e" },
              { label: "Unanswered", val: unattempted, color: "#f87171" },
              { label: "Marked", val: reviewed, color: "#facc15" },
              { label: "Total", val: questions.length, color: "#94a3b8" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "rgba(15,23,42,0.8)", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(148,163,184,0.08)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setConfirmSubmit(true)}
            style={{ width: "100%", marginTop: 20, padding: "13px 0", borderRadius: 12, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.12)", color: "#86efac", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >Submit Test</button>
        </div>
      </div>

      {/* ── Submit confirmation modal ── */}
      {confirmSubmit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ ...CARD, maxWidth: 400, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📝</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#e0f2fe", marginBottom: 8 }}>Submit Test?</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20, lineHeight: 1.7 }}>
              Answered: <b style={{ color: "#22c55e" }}>{answered}</b>  · 
              Unanswered: <b style={{ color: "#f87171" }}>{unattempted}</b>  · 
              Marked: <b style={{ color: "#facc15" }}>{reviewed}</b>
              <br />Wrong answers will be logged to your Mistake Book automatically.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmSubmit(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid rgba(148,163,184,0.2)", background: "transparent", color: "#94a3b8", fontWeight: 700, cursor: "pointer" }}>
                Go Back
              </button>
              <button onClick={handleSubmit} disabled={submitLoading} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                {submitLoading ? "Submitting…" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
