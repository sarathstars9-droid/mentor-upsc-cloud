// src/pages/MainsGS2Page.jsx
// GS2 Question Selection Page — pre-flight screen before AnswerWritingPage
// Fetches real data from GET /api/mains/gs2/questions

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          "#09090b",
  surface:     "#111113",
  surfaceHigh: "#18181b",
  border:      "#1f1f23",
  borderMid:   "#27272a",
  muted:       "#3f3f46",
  subtle:      "#52525b",
  dim:         "#71717a",
  text:        "#e4e4e7",
  textBright:  "#f4f4f5",
  blue:        "#3b82f6",
  green:       "#22c55e",
  amber:       "#f59e0b",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const ACCENT = T.blue;

// ─── GS2 Theme groups ─────────────────────────────────────────────────────────
const THEMES = [
  { id: "Polity",                   label: "Polity",                   icon: "⚖️",  desc: "Constitution, Parliament, Judiciary, Federalism" },
  { id: "Governance",               label: "Governance",               icon: "🏛️",  desc: "Civil Services, E-Governance, Transparency, RTI" },
  { id: "Social Justice",           label: "Social Justice",           icon: "🤝",  desc: "Welfare, Education, Health, Poverty, SHGs" },
  { id: "International Relations",  label: "International Relations",  icon: "🌐",  desc: "Foreign Policy, Bilateral, Multilateral, India's Neighbourhood" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
  fontSize: 11, fontWeight: 700, letterSpacing: "0.11em",
  textTransform: "uppercase", color,
});

// ─── Theme card ───────────────────────────────────────────────────────────────
function ThemeCard({ theme, active, onClick }) {
  const selected = active === theme.id;
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 140px",
        background: selected ? `${ACCENT}12` : T.surface,
        border: selected ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
        borderRadius: 12, padding: "14px 16px",
        cursor: "pointer", fontFamily: T.font,
        textAlign: "left", transition: "all 0.12s ease",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{theme.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? ACCENT : T.textBright, marginBottom: 4 }}>
        {theme.label}
      </div>
      <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.45 }}>{theme.desc}</div>
    </button>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────
function QuestionCard({ q, onStart }) {
  const themeLabel = THEMES.find(t => t.id === q.theme)?.label || q.theme;

  // Check LocalStorage for attempt state
  const [questionState, setQuestionState] = React.useState({
    hasAttempt: false,
    hasSavedAnswer: false,
    hasExternalReview: false,
    hasProcessedReview: false,
  });

  React.useEffect(() => {
    try {
      const attempts = JSON.parse(localStorage.getItem("mains_answer_attempts_v1") || "[]");
      const matchingAttempt = attempts.find(a => 
        a.question?.substring(0, 50) === q.question?.substring(0, 50)
      );
      if (matchingAttempt) {
        setQuestionState({
          hasAttempt: true,
          hasSavedAnswer: !!matchingAttempt.answerText,
          hasExternalReview: false,
          hasProcessedReview: false,
        });
      }
    } catch (e) {
      // localStorage unavailable
    }
  }, [q.question]);

  const { hasSavedAnswer, hasProcessedReview } = questionState;

  const renderButtons = () => {
    if (hasProcessedReview) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onStart(q)}
            style={{
              background: ACCENT, color: "#fff",
              border: "none", borderRadius: 8,
              fontWeight: 900, fontSize: 12,
              padding: "9px 20px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.04em",
            }}
          >
            👁 View Review
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            🔄 Redo
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            📚 Mistakes
          </button>
        </div>
      );
    }

    if (hasSavedAnswer) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onStart(q)}
            style={{
              background: ACCENT, color: "#fff",
              border: "none", borderRadius: 8,
              fontWeight: 900, fontSize: 12,
              padding: "9px 20px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.04em",
            }}
          >
            ✏️ Continue Attempt
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            🤖 Review Now
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => onStart(q)}
        style={{
          background: ACCENT, color: "#fff",
          border: "none", borderRadius: 8,
          fontWeight: 900, fontSize: 12,
          padding: "9px 20px", cursor: "pointer",
          fontFamily: T.font, letterSpacing: "0.04em",
          boxShadow: `0 0 16px ${ACCENT}28`,
        }}
      >
        ✏️&nbsp;&nbsp;Start Writing
      </button>
    );
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}88, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: T.green,
            background: `${T.green}14`, border: `1px solid ${T.green}33`,
            borderRadius: 5, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            PYQ
          </span>
          {q.year && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: T.dim,
              background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 5, padding: "2px 9px",
            }}>
              UPSC {q.year}
            </span>
          )}
          {q.marks && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: T.textBright,
              background: T.bg, border: `1px solid ${T.borderMid}`,
              borderRadius: 5, padding: "2px 9px",
            }}>
              {q.marks} Marks
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, color: ACCENT,
            background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`,
            borderRadius: 5, padding: "2px 9px", letterSpacing: "0.05em", textTransform: "uppercase",
            marginLeft: "auto",
          }}>
            {themeLabel}
          </span>
        </div>

        {/* Question text */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.textBright,
          lineHeight: 1.7, marginBottom: 14,
        }}>
          {q.question}
        </div>

        {/* Focus hint */}
        {q.focus && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 16,
          }}>
            <span style={{ ...label11(ACCENT), fontSize: 9, flexShrink: 0, marginTop: 1 }}>Focus</span>
            <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>{q.focus}</span>
          </div>
        )}

        {/* Action */}
        {renderButtons()}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{ height: 12, width: "30%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`, marginBottom: 14 }} />
          <div style={{ height: 16, width: "90%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`, marginBottom: 8 }} />
          <div style={{ height: 16, width: "70%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center",
      border: `1px solid ${T.red}33`, borderRadius: 14,
      background: `${T.red}08`,
    }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>Failed to load questions</div>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 18 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          background: T.surface, color: T.text,
          border: `1px solid ${T.border}`, borderRadius: 8,
          fontWeight: 700, fontSize: 12, padding: "8px 20px",
          cursor: "pointer", fontFamily: T.font,
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsGS2Page() {
  const navigate = useNavigate();

  const [questions,     setQuestions]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [activeTheme,   setActiveTheme]   = useState("all");
  const [markFilter,    setMarkFilter]    = useState("all");
  const [sourceFilter,  setSourceFilter]  = useState("all");

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mains/gs2/questions`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown error");
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (err) {
      setError(err.message || "Could not connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchQuestions(); }, []);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (activeTheme !== "all" && q.theme !== activeTheme) return false;
      if (markFilter  !== "all" && String(q.marks) !== markFilter) return false;
      if (sourceFilter !== "all" && q.source !== sourceFilter) return false;
      return true;
    });
  }, [questions, activeTheme, markFilter, sourceFilter]);

  function handleStart(q) {
    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper:     "GS2",
          mode:      q.source || "PYQ",
          marks:     q.marks != null ? String(q.marks) : "",
          year:      q.year || null,
          structure: q.structure || "",
          focus:     q.focus || "",
          priority:  "UPSC PYQ · High Priority",
          question:  q.question,
          nodeId:    q.nodeId || "",
        },
      },
    });
  }

  function toggleTheme(id) {
    setActiveTheme(prev => (prev === id ? "all" : id));
  }

  const pyqCount   = questions.filter(q => q.source === "PYQ").length;
  const topicCount = questions.filter(q => q.source === "Topic").length;

  const yearsPresent = questions.map(q => q.year).filter(Boolean);
  const latestYear   = yearsPresent.length ? Math.max(...yearsPresent) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 8,
        background: T.bg, position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate("/mains")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font }}
        >
          <span style={label11(T.subtle)}>Mains</span>
        </button>
        <span style={{ color: T.muted, fontSize: 11 }}>›</span>
        <span style={label11(ACCENT)}>General Studies II</span>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Hero header ─────────────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceHigh} 100%)`,
          border: `1px solid ${T.borderMid}`, borderRadius: 16,
          padding: "28px 32px", marginBottom: 28, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT}44)`,
            borderRadius: "14px 0 0 14px",
          }} />
          <div style={{ ...label11(ACCENT), marginBottom: 8 }}>GS Paper II</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            General Studies II
          </h1>
          <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 520 }}>
            Polity, Governance, Social Justice &amp; International Relations — select a theme or question below.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {loading ? (
              <span style={{ fontSize: 11, color: T.dim }}>Loading questions…</span>
            ) : error ? (
              <span style={{ fontSize: 11, color: T.red }}>Could not load count</span>
            ) : (
              [
                { label: `${questions.length} Questions`, color: T.textBright },
                { label: `${pyqCount} PYQs`,              color: T.green },
                { label: latestYear ? `Latest: ${latestYear}` : "No year data", color: ACCENT },
              ].map(p => (
                <span key={p.label} style={{
                  fontSize: 11, fontWeight: 700, color: p.color,
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 20, padding: "4px 12px",
                }}>{p.label}</span>
              ))
            )}
          </div>
        </div>

        {/* ── Theme cards ──────────────────────────────────────────────────────── */}
        <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Filter by Theme</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => setActiveTheme("all")}
            style={{
              flex: "0 0 auto",
              background: activeTheme === "all" ? `${ACCENT}12` : T.surface,
              border: activeTheme === "all" ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
              borderRadius: 12, padding: "10px 20px",
              cursor: "pointer", fontFamily: T.font,
              fontSize: 12, fontWeight: activeTheme === "all" ? 800 : 600,
              color: activeTheme === "all" ? ACCENT : T.dim,
            }}
          >
            All Themes
          </button>
          {THEMES.map(t => (
            <ThemeCard key={t.id} theme={t} active={activeTheme} onClick={() => toggleTheme(t.id)} />
          ))}
        </div>

        {/* ── Inline filters ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={label11(T.subtle)}>Filter:</div>

          <div style={{ display: "flex", gap: 6 }}>
            {["all", "10", "15", "20"].map(m => (
              <button
                key={m}
                onClick={() => setMarkFilter(m)}
                style={{
                  padding: "5px 12px", borderRadius: 7,
                  border: markFilter === m ? `1.5px solid ${ACCENT}` : `1px solid ${T.borderMid}`,
                  background: markFilter === m ? `${ACCENT}15` : T.surface,
                  color: markFilter === m ? ACCENT : T.dim,
                  fontWeight: markFilter === m ? 800 : 500,
                  fontSize: 11, cursor: "pointer", fontFamily: T.font,
                }}
              >
                {m === "all" ? "All Marks" : `${m}M`}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: T.border }} />

          <div style={{ display: "flex", gap: 6 }}>
            {[{ v: "all", l: "All" }, { v: "PYQ", l: "PYQ Only" }].map(s => (
              <button
                key={s.v}
                onClick={() => setSourceFilter(s.v)}
                style={{
                  padding: "5px 12px", borderRadius: 7,
                  border: sourceFilter === s.v ? `1.5px solid ${T.purple}` : `1px solid ${T.borderMid}`,
                  background: sourceFilter === s.v ? `${T.purple}15` : T.surface,
                  color: sourceFilter === s.v ? T.purple : T.dim,
                  fontWeight: sourceFilter === s.v ? 800 : 500,
                  fontSize: 11, cursor: "pointer", fontFamily: T.font,
                }}
              >
                {s.l}
              </button>
            ))}
          </div>

          {!loading && !error && (
            <span style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>
              {filtered.length} question{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Question list / states ───────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {!loading && error && <ErrorState message={error} onRetry={fetchQuestions} />}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(q => <QuestionCard key={q.id} q={q} onStart={handleStart} />)}
          </div>
        )}

        {!loading && !error && questions.length > 0 && filtered.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: `1px dashed ${T.borderMid}`, borderRadius: 14,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions match this filter</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Try changing the theme or marks filter above.
            </div>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: `1px dashed ${T.borderMid}`, borderRadius: 14,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions loaded</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Check that the tagged data files are present in the backend.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
