// src/components/Prelims/RcPassageBlock.jsx
// Renders one RC passage group: passage text once, all linked questions below.
// Used in PrelimsPage for CSAT RC sectional mode.

import { useState, useEffect, useRef } from "react";

// ── Option key normalization (data uses lowercase a/b/c/d) ────────────────────
function normKey(k) {
  return String(k || "").trim().toUpperCase();
}

function sanitizeOptionText(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\.\s]*(?:Solution|Answer|Ans)\s*[:\-]?\s*[a-dA-D1-4]\s*\)?\.?\s*$/i, "")
    .trim();
}

function resolveOptions(q) {
  const raw = q?.options || {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  // Accept both {A: ..., a: ...} and {a: ..., b: ...}
  ["A", "B", "C", "D"].forEach((K) => {
    const v = raw[K] ?? raw[K.toLowerCase()];
    if (v != null) out[K] = sanitizeOptionText(String(v));
  });
  return out;
}

function getQid(q) {
  return q?.id || q?.questionId || q?.qid || null;
}

// ── Style constants (match PrelimsPage dark palette) ─────────────────────────
const SURFACE   = "rgba(15, 23, 42, 0.88)";
const SURFACE_H = "rgba(17, 24, 39, 0.92)";
const BG        = "rgba(2, 6, 23, 0.95)";
const BORDER    = "rgba(148, 163, 184, 0.12)";
const BORDER_M  = "rgba(148, 163, 184, 0.18)";
const TEXT      = "#e2e8f0";
const TEXT_BR   = "#f8fafc";
const DIM       = "#94a3b8";
const MUTED     = "#64748b";
const BLUE      = "#38bdf8";
const GREEN     = "#22c55e";
const AMBER     = "#f59e0b";
const FONT      = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif";

function pill(color) {
  return {
    display: "inline-flex", alignItems: "center",
    fontSize: 11, fontWeight: 700,
    background: `${color}18`, border: `1px solid ${color}33`,
    color, borderRadius: 6, padding: "2px 9px",
    letterSpacing: "0.06em",
  };
}

// ── RcPassageBlock ────────────────────────────────────────────────────────────
export default function RcPassageBlock({
  passage,          // string — passage text (shown once)
  questions = [],   // array of question objects sharing this passage
  passageIndex,     // 0-based
  totalPassages,    // total passage groups in the set
  answersMap = {},
  onSelectOption,   // (qid, upperCaseKey) => void
  onClearOption,    // (qid) => void
  confidenceMap = {},
  onSetConfidence,  // (qid, level) => void
  onPrevPassage,    // () => void
  onNextPassage,    // () => void
  onSubmit,         // () => void — only shown on last passage
  submitting = false,
}) {
  const [passageCollapsed, setPassageCollapsed] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [passageIndex]);

  const answeredCount = questions.filter((q) => {
    const qid = getQid(q);
    return qid && answersMap[qid];
  }).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;
  const isLast = passageIndex >= totalPassages - 1;

  return (
    <div ref={topRef} style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>

      {/* ── Passage card ─────────────────────────────────────────────────────── */}
      <div style={{
        background: SURFACE,
        border: `1px solid ${BORDER_M}`,
        borderRadius: 16,
        overflow: "hidden",
      }}>
        {/* top accent */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, ${BLUE}, #8b5cf6, transparent)`,
        }} />

        {/* header row */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 20px",
            cursor: "pointer",
            borderBottom: passageCollapsed ? "none" : `1px solid ${BORDER}`,
          }}
          onClick={() => setPassageCollapsed((c) => !c)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={pill(BLUE)}>
              Passage {passageIndex + 1} / {totalPassages}
            </span>
            <span style={{ fontSize: 12, color: DIM, fontWeight: 600 }}>
              {questions.length} Q{questions.length !== 1 ? "s" : ""}
            </span>
            <span style={pill(allAnswered ? GREEN : AMBER)}>
              {answeredCount}/{questions.length} answered
            </span>
          </div>
          <span style={{ fontSize: 13, color: MUTED, userSelect: "none" }}>
            {passageCollapsed ? "▼ Show" : "▲ Hide"}
          </span>
        </div>

        {/* passage text */}
        {!passageCollapsed && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: MUTED,
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
            }}>
              Passage
            </div>
            <div style={{
              fontSize: 14, color: TEXT, lineHeight: 1.9,
              background: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "16px 20px",
              maxHeight: 340, overflowY: "auto",
              whiteSpace: "pre-wrap",
              scrollbarWidth: "thin",
              scrollbarColor: `${MUTED} transparent`,
            }}>
              {passage || "Passage text not available."}
            </div>
          </div>
        )}
      </div>

      {/* ── Questions ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {questions.map((q, qi) => {
          const qid = getQid(q) || `q_${passageIndex}_${qi}`;
          const options = resolveOptions(q);
          const optKeys = ["A", "B", "C", "D"].filter((k) => options[k]);
          const selected = normKey(answersMap[qid] || "");
          const confidence = confidenceMap[qid] || "";

          return (
            <div key={qid} style={{
              background: SURFACE,
              border: `1px solid ${selected ? BLUE + "44" : BORDER}`,
              borderRadius: 14,
              overflow: "hidden",
              transition: "border-color 0.18s",
            }}>
              {/* question meta bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 18px",
                background: selected ? `${BLUE}08` : `${SURFACE_H}`,
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                    background: selected ? `${BLUE}22` : `${MUTED}18`,
                    border: `1px solid ${selected ? BLUE + "55" : BORDER_M}`,
                    color: selected ? BLUE : DIM,
                  }}>
                    {qi + 1}
                  </span>
                  {q.year && (
                    <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                      UPSC {q.year}
                    </span>
                  )}
                  {/* confidence chips */}
                  {["sure", "unsure", "guess"].map((lvl) => {
                    const tones = {
                      sure:   { active: "#10b981", inactive: "rgba(16,185,129,0.35)" },
                      unsure: { active: AMBER,      inactive: `${AMBER}55` },
                      guess:  { active: "#6366f1",  inactive: "rgba(99,102,241,0.4)" },
                    };
                    const isActive = confidence === lvl;
                    const col = tones[lvl];
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onSetConfidence?.(qid, isActive ? "" : lvl)}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          border: `1px solid ${isActive ? col.active : col.inactive}`,
                          background: isActive ? `${col.active}20` : "transparent",
                          color: isActive ? col.active : col.inactive,
                          cursor: "pointer", fontFamily: FONT, textTransform: "capitalize",
                        }}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
                {selected && (
                  <button
                    type="button"
                    onClick={() => onClearOption?.(qid)}
                    style={{
                      background: "transparent", border: "none",
                      color: MUTED, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", padding: "2px 8px", borderRadius: 4,
                      fontFamily: FONT,
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* question text */}
              <div style={{ padding: "14px 18px 10px" }}>
                <div style={{
                  fontSize: 14, color: TEXT_BR, lineHeight: 1.78,
                  fontWeight: 500, whiteSpace: "pre-wrap",
                }}>
                  {q.question || q.questionText || q.stem || ""}
                </div>
              </div>

              {/* options */}
              {optKeys.length > 0 && (
                <div style={{ padding: "4px 18px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {optKeys.map((key) => {
                    const isSelected = selected === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          isSelected ? onClearOption?.(qid) : onSelectOption?.(qid, key)
                        }
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "10px 14px", borderRadius: 10,
                          border: isSelected
                            ? `1px solid ${BLUE}66`
                            : `1px solid ${BORDER}`,
                          background: isSelected ? `${BLUE}12` : `${BG}`,
                          cursor: "pointer", textAlign: "left", width: "100%",
                          transition: "all 0.15s", fontFamily: FONT,
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800,
                          background: isSelected ? BLUE : "transparent",
                          border: `2px solid ${isSelected ? BLUE : MUTED}`,
                          color: isSelected ? "#09090b" : DIM,
                          transition: "all 0.15s",
                        }}>
                          {key}
                        </span>
                        <span style={{
                          fontSize: 13.5, lineHeight: 1.65,
                          color: isSelected ? TEXT_BR : TEXT,
                          fontWeight: isSelected ? 600 : 400,
                        }}>
                          {options[key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Navigation footer ────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
        padding: "16px 0 4px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        {/* prev */}
        <button
          type="button"
          disabled={passageIndex === 0}
          onClick={onPrevPassage}
          style={{
            height: 42, padding: "0 20px", borderRadius: 10,
            fontWeight: 700, fontSize: 13,
            border: "1px solid rgba(148,163,184,0.2)",
            background: passageIndex === 0 ? "transparent" : "rgba(30,41,59,0.6)",
            color: passageIndex === 0 ? MUTED : TEXT,
            cursor: passageIndex === 0 ? "not-allowed" : "pointer",
            opacity: passageIndex === 0 ? 0.38 : 1,
            fontFamily: FONT,
          }}
        >
          ← Prev Passage
        </button>

        {/* passage progress dots */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {Array.from({ length: totalPassages }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === passageIndex ? 22 : 8,
                height: 8, borderRadius: 99,
                background: i === passageIndex ? BLUE : MUTED,
                transition: "width 0.22s, background 0.22s",
              }}
            />
          ))}
        </div>

        {/* next / submit */}
        {!isLast ? (
          <button
            type="button"
            onClick={onNextPassage}
            style={{
              height: 42, padding: "0 20px", borderRadius: 10,
              fontWeight: 700, fontSize: 13,
              border: `1px solid ${BLUE}44`,
              background: `${BLUE}12`,
              color: BLUE, cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Next Passage →
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            style={{
              height: 42, padding: "0 24px", borderRadius: 10,
              fontWeight: 800, fontSize: 13,
              border: `1px solid ${GREEN}44`,
              background: `${GREEN}14`,
              color: submitting ? MUTED : GREEN,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.65 : 1,
              fontFamily: FONT,
            }}
          >
            {submitting ? "Submitting…" : "Submit Test ✓"}
          </button>
        )}
      </div>
    </div>
  );
}
