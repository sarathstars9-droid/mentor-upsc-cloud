
// /mnt/data/EthicsPyqPage_GS3Style.jsx
// Ethics Question Selection Page — styled like MainsGS3Page
// Adapted from uploaded EthicsPyqPage and MainsGS3Page
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config";

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
  green:       "#22c55e",
  amber:       "#f59e0b",
  blue:        "#3b82f6",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  teal:        "#14b8a6",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const ACCENT = T.purple;

// ─── Ethics theme groups ──────────────────────────────────────────────────────
const ETHICS_CATS = [
  { id: "GS4-ETH-GOV",     label: "Public Service",   icon: "🏛️", desc: "Civil servant values, governance, accountability" },
  { id: "GS4-ETH-HV",      label: "Human Values",     icon: "🌿", desc: "Ethics, integrity, family, social values" },
  { id: "GS4-ETH-PROB",    label: "Probity",          icon: "⚖️", desc: "Integrity, transparency, whistle-blowing" },
  { id: "GS4-ETH-EI",      label: "Emotional Intel.", icon: "💡", desc: "EI in administration, empathy, self-awareness" },
  { id: "GS4-ETH-ATT",     label: "Attitude",         icon: "🧭", desc: "Content, structure, function, role in life" },
  { id: "GS4-ETH-APPLIED", label: "Applied Ethics",   icon: "⚙️", desc: "Contemporary, digital, governance dilemmas" },
  { id: "GS4-ETH-THINK",   label: "Thinkers",         icon: "📚", desc: "Gandhi, Aristotle, Kant, Rawls" },
  { id: "GS4-ETH-CS",      label: "Case Studies",     icon: "🔍", desc: "Administrative dilemmas, ethical conflicts" },
];

const TYPE_LABELS = {
  ETHICS_THEORY: "Theory",
  QUOTE_BASED: "Quote",
  SHORT_NOTE: "Short Note",
  CASE_STUDY: "Case Study",
};

const label11 = (color = T.subtle) => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  color,
});

// ─── Theme card ───────────────────────────────────────────────────────────────
function ThemeCard({ theme, active, onClick, count }) {
  const selected = active === theme.id;
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 140px",
        background: selected ? `${ACCENT}12` : T.surface,
        border: selected ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        fontFamily: T.font,
        textAlign: "left",
        transition: "all 0.12s ease",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{theme.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? ACCENT : T.textBright, marginBottom: 4 }}>
        {theme.label}
      </div>
      <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.45, marginBottom: 8 }}>{theme.desc}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: selected ? ACCENT : T.subtle }}>
        {count || 0} Questions
      </div>
    </button>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────
function QuestionCard({ q, onStart }) {
  const categoryLabel = ETHICS_CATS.find(t => t.id === q.syllabusNodeId)?.label || q.syllabusNodeId;
  const typeLabel = TYPE_LABELS[q.type] || q.type || "Ethics";
  const paperLabel = q.section ? `Section ${q.section}` : "GS Paper IV";

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}88, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: ACCENT,
              background: `${ACCENT}14`,
              border: `1px solid ${ACCENT}33`,
              borderRadius: 5,
              padding: "2px 8px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ETHICS PYQ
          </span>

          {q.year && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.dim,
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 5,
                padding: "2px 9px",
              }}
            >
              UPSC {q.year}
            </span>
          )}

          {q.marks != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.textBright,
                background: T.bg,
                border: `1px solid ${T.borderMid}`,
                borderRadius: 5,
                padding: "2px 9px",
              }}
            >
              {q.marks}M
            </span>
          )}

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.blue,
              background: `${T.blue}10`,
              border: `1px solid ${T.blue}28`,
              borderRadius: 5,
              padding: "2px 9px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {typeLabel}
          </span>

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: ACCENT,
              background: `${ACCENT}10`,
              border: `1px solid ${ACCENT}28`,
              borderRadius: 5,
              padding: "2px 9px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginLeft: "auto",
            }}
          >
            {categoryLabel}
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.textBright,
            lineHeight: 1.7,
            marginBottom: 14,
          }}
        >
          {q.question}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            borderTop: `1px solid ${T.border}`,
            paddingTop: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ ...label11(ACCENT), fontSize: 9, flexShrink: 0, marginTop: 1 }}>
            Focus
          </span>
          <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
            {paperLabel} · {typeLabel} · {categoryLabel}
          </span>
        </div>

        <button
          onClick={() => onStart(q)}
          style={{
            background: ACCENT,
            color: "#09090b",
            border: "none",
            borderRadius: 8,
            fontWeight: 900,
            fontSize: 12,
            padding: "9px 20px",
            cursor: "pointer",
            fontFamily: T.font,
            letterSpacing: "0.04em",
            boxShadow: `0 0 16px ${ACCENT}28`,
          }}
        >
          ✏️&nbsp;&nbsp;Start Writing
        </button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              height: 12,
              width: "30%",
              borderRadius: 6,
              background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
              marginBottom: 14,
            }}
          />
          <div
            style={{
              height: 16,
              width: "90%",
              borderRadius: 6,
              background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 16,
              width: "70%",
              borderRadius: 6,
              background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        border: `1px solid ${T.red}33`,
        borderRadius: 14,
        background: `${T.red}08`,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>
        Failed to load questions
      </div>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 18 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          background: T.surface,
          color: T.text,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 12,
          padding: "8px 20px",
          cursor: "pointer",
          fontFamily: T.font,
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EthicsPyqPage() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTheme, setActiveTheme] = useState("all");
  const [markFilter, setMarkFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/subject-pyq?subject=ethics`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      setError(err.message || "Could not connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuestions();
  }, []);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (activeTheme !== "all" && q.syllabusNodeId !== activeTheme) return false;
      if (markFilter !== "all" && String(q.marks) !== markFilter) return false;
      if (typeFilter !== "all" && q.type !== typeFilter) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!(q.question || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [questions, activeTheme, markFilter, typeFilter, searchText]);

  const countsByTheme = useMemo(() => {
    const map = {};
    ETHICS_CATS.forEach(cat => {
      map[cat.id] = questions.filter(q => q.syllabusNodeId === cat.id).length;
    });
    return map;
  }, [questions]);

  function handleStart(q) {
    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper: "GS4",
          mode: "PYQ",
          marks: q.marks != null ? String(q.marks) : "",
          year: q.year || null,
          structure: q.type || "",
          focus: ETHICS_CATS.find(c => c.id === q.syllabusNodeId)?.label || "",
          priority: "UPSC Ethics PYQ · High Priority",
          question: q.question,
          nodeId: q.syllabusNodeId || "",
          source: `UPSC ${q.year || ""}`.trim(),
        },
      },
    });
  }

  function toggleTheme(id) {
    setActiveTheme(prev => (prev === id ? "all" : id));
  }

  const yearsPresent = questions.map(q => q.year).filter(Boolean);
  const latestYear = yearsPresent.length ? Math.max(...yearsPresent) : null;
  const theoryCount = questions.filter(q => q.type === "ETHICS_THEORY").length;
  const caseCount = questions.filter(q => q.syllabusNodeId === "GS4-ETH-CS").length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
      <div
        style={{
          borderBottom: `1px solid ${T.border}`,
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: T.bg,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => navigate("/mains")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font }}
        >
          <span style={label11(T.subtle)}>Mains</span>
        </button>
        <span style={{ color: T.muted, fontSize: 11 }}>›</span>
        <span style={label11(ACCENT)}>Ethics / GS Paper IV</span>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceHigh} 100%)`,
            border: `1px solid ${T.borderMid}`,
            borderRadius: 16,
            padding: "28px 32px",
            marginBottom: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT}44)`,
              borderRadius: "14px 0 0 14px",
            }}
          />
          <div style={{ ...label11(ACCENT), marginBottom: 8 }}>GS Paper IV</div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: T.textBright,
              margin: "0 0 6px 0",
              letterSpacing: "-0.02em",
            }}
          >
            Ethics PYQ
          </h1>
          <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 560 }}>
            Public service values, human values, probity, emotional intelligence, attitude, thinkers and case studies.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {loading ? (
              <span style={{ fontSize: 11, color: T.dim }}>Loading questions…</span>
            ) : error ? (
              <span style={{ fontSize: 11, color: T.red }}>Could not load count</span>
            ) : (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textBright, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>
                  {questions.length} Questions
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>
                  {theoryCount} Theory
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.blue, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>
                  {caseCount} Case Studies
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>
                  {latestYear ? `Latest: ${latestYear}` : "No year data"}
                </span>
              </>
            )}

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search ethics questions…"
              style={{
                background: T.surface,
                border: `1px solid ${T.borderMid}`,
                borderRadius: 8,
                color: T.text,
                fontSize: 12,
                padding: "8px 12px",
                fontFamily: T.font,
                outline: "none",
                width: 220,
                marginLeft: "auto",
              }}
            />
          </div>
        </div>

        <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Filter by Theme</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => setActiveTheme("all")}
            style={{
              flex: "0 0 auto",
              background: activeTheme === "all" ? `${ACCENT}12` : T.surface,
              border: activeTheme === "all" ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "10px 20px",
              cursor: "pointer",
              fontFamily: T.font,
              fontSize: 12,
              fontWeight: activeTheme === "all" ? 800 : 600,
              color: activeTheme === "all" ? ACCENT : T.dim,
            }}
          >
            All Themes
          </button>
          {ETHICS_CATS.map(t => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={activeTheme}
              count={countsByTheme[t.id]}
              onClick={() => toggleTheme(t.id)}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={label11(T.subtle)}>Filter:</div>

          <div style={{ display: "flex", gap: 6 }}>
            {["all", "10", "2"].map(m => (
              <button
                key={m}
                onClick={() => setMarkFilter(m)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  border: markFilter === m ? `1.5px solid ${ACCENT}` : `1px solid ${T.borderMid}`,
                  background: markFilter === m ? `${ACCENT}15` : T.surface,
                  color: markFilter === m ? ACCENT : T.dim,
                  fontWeight: markFilter === m ? 800 : 500,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: T.font,
                }}
              >
                {m === "all" ? "All Marks" : `${m}M`}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: T.border }} />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { v: "all", l: "All Types" },
              { v: "ETHICS_THEORY", l: "Theory" },
              { v: "QUOTE_BASED", l: "Quote" },
              { v: "SHORT_NOTE", l: "Short Note" },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => setTypeFilter(s.v)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  border: typeFilter === s.v ? `1.5px solid ${T.blue}` : `1px solid ${T.borderMid}`,
                  background: typeFilter === s.v ? `${T.blue}15` : T.surface,
                  color: typeFilter === s.v ? T.blue : T.dim,
                  fontWeight: typeFilter === s.v ? 800 : 500,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: T.font,
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

        {loading && <LoadingSkeleton />}
        {!loading && error && <ErrorState message={error} onRetry={fetchQuestions} />}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(q => (
              <QuestionCard key={q.id} q={q} onStart={handleStart} />
            ))}
          </div>
        )}

        {!loading && !error && questions.length > 0 && filtered.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              border: `1px dashed ${T.borderMid}`,
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions match this filter</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Try changing the theme, marks, or type filter above.
            </div>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              border: `1px dashed ${T.borderMid}`,
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions loaded</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Check that the ethics dataset is available in the backend.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
