// src/pages/PrelimsTestResultPage.jsx
// Prelims Test Engine — Result page
// Shows score, accuracy, per-question review, mistake status

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BACKEND_URL } from "../config";

const USER_ID = "user_1";

const PAGE_BG = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 80% 5%, rgba(34,197,94,0.08), transparent 28%)," +
    "radial-gradient(circle at 10% 90%, rgba(168,85,247,0.07), transparent 28%), #020617",
  color: "#f8fafc",
  padding: "24px 20px 60px",
  fontFamily: "'Inter', sans-serif",
};

const CARD = {
  background: "rgba(15,23,42,0.90)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 20,
  padding: 22,
  marginBottom: 18,
};

function ScoreMeter({ paper, score, maxScore }) {
  const pct = Math.max(0, Math.min(100, (score / maxScore) * 100));
  const cutoff = paper === "CSAT" ? 50 : 33; // % of max score
  const color = pct >= cutoff ? "#22c55e" : pct >= cutoff * 0.7 ? "#f59e0b" : "#f87171";
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
        <span>0</span>
        <span style={{ color: "#fde047" }}>Cutoff ≈{Math.round(maxScore * cutoff / 100)}</span>
        <span>{maxScore}</span>
      </div>
      <div style={{ height: 12, background: "rgba(30,41,59,0.8)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 99, transition: "width 0.6s" }} />
      </div>
    </div>
  );
}

function StatusBadge({ isCorrect, isSkipped }) {
  if (isSkipped) return <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(100,116,139,0.2)", color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>—  Skipped</span>;
  if (isCorrect) return <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(34,197,94,0.15)", color: "#86efac", fontSize: 11, fontWeight: 700 }}>✓  Correct</span>;
  return         <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 11, fontWeight: 700 }}>✗  Wrong</span>;
}

export default function PrelimsTestResultPage() {
  const { attemptId } = useParams();
  const location  = useLocation();
  const navigate  = useNavigate();

  const stateResult    = location.state?.result;
  const stateQuestions = location.state?.questions || [];
  const paper          = location.state?.paper || "GS";
  const title          = location.state?.title || "Prelims Test";

  const [result, setResult]   = useState(stateResult || null);
  const [loading, setLoading] = useState(!stateResult);
  const [filter, setFilter]   = useState("all"); // all | correct | wrong | skipped

  // Load from API if not in state (page reload)
  useEffect(() => {
    if (stateResult || !attemptId) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/prelims-tests/attempts/${attemptId}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          const a = d.attempt;
          const responses = d.responses || [];
          setResult({
            attemptId,
            totalQuestions: a.total_questions,
            attempted: a.attempted_count,
            correct: a.correct_count,
            wrong: a.wrong_count,
            skipped: a.skipped_count,
            score: a.score,
            accuracy: a.accuracy,
            resultByQuestion: responses.map(r => ({
              questionId: r.question_id,
              selectedAnswer: r.selected_answer,
              correctAnswer: r.correct_answer,
              isCorrect: r.is_correct,
              isSkipped: r.is_skipped,
              markedForReview: r.marked_for_review,
              timeSpentSeconds: r.time_spent_seconds,
              question: r.question,
            })),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [attemptId, stateResult]);

  if (loading) {
    return (
      <div style={{ ...PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 16 }}>Loading result…</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ ...PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div>Result not found.</div>
          <button onClick={() => navigate("/prelims/test")} style={{ marginTop: 14, padding: "10px 18px", borderRadius: 10, border: "none", background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" }}>← Home</button>
        </div>
      </div>
    );
  }

  const { totalQuestions, attempted, correct, wrong, skipped, score, accuracy, resultByQuestion = [], mistakesLogged = 0 } = result;
  const maxScore = paper === "CSAT" ? totalQuestions * 2.5 : totalQuestions * 2;

  // Per-question map from hydrated questions in state
  const qMap = {};
  stateQuestions.forEach(q => { qMap[q.id] = q; });

  const filteredResults = resultByQuestion.filter(r => {
    if (filter === "correct") return r.isCorrect === true;
    if (filter === "wrong")   return r.isCorrect === false;
    if (filter === "skipped") return r.isSkipped;
    return true;
  });

  return (
    <div style={PAGE_BG}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#e0f2fe" }}>🎯 Result</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{title}</div>
          </div>
          <button onClick={() => navigate("/prelims/test")} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.2)", background: "transparent", color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            ← New Test
          </button>
        </div>

        {/* Score card */}
        <div style={{ ...CARD, background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(17,24,39,0.92))" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 14, marginBottom: 18 }}>
            {[
              { label: "Score",    val: `${score}`, color: "#22c55e", sub: `/ ${maxScore.toFixed(0)}` },
              { label: "Accuracy", val: `${accuracy}%`, color: "#38bdf8" },
              { label: "Correct",  val: correct,  color: "#86efac" },
              { label: "Wrong",    val: wrong,    color: "#fca5a5" },
              { label: "Skipped",  val: skipped,  color: "#94a3b8" },
              { label: "Attempted",val: attempted, color: "#a78bfa" },
            ].map(({ label, val, color, sub }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px 10px", background: "rgba(15,23,42,0.7)", borderRadius: 12, border: "1px solid rgba(148,163,184,0.08)" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color }}>{val}{sub && <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>{sub}</span>}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <ScoreMeter paper={paper} score={Number(score)} maxScore={maxScore} />
          {mistakesLogged > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#f59e0b", textAlign: "center" }}>
              📌 {mistakesLogged} wrong answer{mistakesLogged !== 1 ? "s" : ""} logged to Mistake Book
            </div>
          )}
        </div>

        {/* Scoring info */}
        <div style={{ ...CARD, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Scoring Formula</div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
            {paper === "CSAT"
              ? "Correct +2.5  ·  Wrong −0.83  ·  Skipped 0"
              : "Correct +2  ·  Wrong −0.66  ·  Skipped 0"}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { key: "all",     label: `All (${totalQuestions})`,    color: "#94a3b8" },
            { key: "correct", label: `Correct (${correct})`,       color: "#22c55e" },
            { key: "wrong",   label: `Wrong (${wrong})`,           color: "#f87171" },
            { key: "skipped", label: `Skipped (${skipped})`,       color: "#64748b" },
          ].map(({ key, label, color }) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: "8px 16px", borderRadius: 99, fontWeight: 700, fontSize: 13, cursor: "pointer",
              border: filter === key ? `1px solid ${color}55` : "1px solid rgba(148,163,184,0.18)",
              background: filter === key ? `${color}15` : "rgba(15,23,42,0.7)",
              color: filter === key ? color : "#64748b",
            }}>{label}</button>
          ))}
        </div>

        {/* Question review */}
        {filteredResults.map((r, i) => {
          const q = r.question || qMap[r.questionId];
          const opts = q?.options || {};
          return (
            <div key={r.questionId || i} style={{
              ...CARD,
              borderLeft: `3px solid ${r.isSkipped ? "#64748b" : r.isCorrect ? "#22c55e" : "#f87171"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  Q{i + 1} {q?.year ? `· ${q.year}` : ""}
                </span>
                <StatusBadge isCorrect={r.isCorrect} isSkipped={r.isSkipped} />
              </div>

              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.75, marginBottom: 14 }}>
                {q?.question || r.questionId}
              </div>

              {/* Options with colour coding */}
              {["A", "B", "C", "D"].map(key => {
                if (!opts[key]) return null;
                const isUserAnswer    = r.selectedAnswer === key;
                const isCorrectAnswer = r.correctAnswer === key;
                let bg    = "rgba(15,23,42,0.5)";
                let color = "#64748b";
                let border = "1px solid rgba(148,163,184,0.1)";
                if (isCorrectAnswer) { bg = "rgba(34,197,94,0.1)"; color = "#86efac"; border = "1px solid rgba(34,197,94,0.35)"; }
                if (isUserAnswer && !isCorrectAnswer) { bg = "rgba(239,68,68,0.1)"; color = "#fca5a5"; border = "1px solid rgba(239,68,68,0.3)"; }

                return (
                  <div key={key} style={{ display: "flex", gap: 10, padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: bg, border }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color, flexShrink: 0, width: 18 }}>{key}</span>
                    <span style={{ fontSize: 13, color, lineHeight: 1.6 }}>
                      {opts[key]}
                      {isCorrectAnswer && <span style={{ marginLeft: 8, fontSize: 11 }}>✓</span>}
                      {isUserAnswer && !isCorrectAnswer && <span style={{ marginLeft: 8, fontSize: 11 }}>← Your answer</span>}
                    </span>
                  </div>
                );
              })}

              {/* Metadata */}
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#475569" }}>
                {q?.syllabusNodeId && <span style={{ background: "rgba(30,41,59,0.8)", padding: "3px 8px", borderRadius: 6 }}>{q.syllabusNodeId}</span>}
                {r.timeSpentSeconds > 0 && <span>⏱ {r.timeSpentSeconds}s</span>}
                {r.markedForReview && <span style={{ color: "#fde047" }}>★ Marked</span>}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => navigate("/prelims/test")}
          style={{ width: "100%", marginTop: 8, padding: "14px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
        >
          ← Start Another Test
        </button>
      </div>
    </div>
  );
}
