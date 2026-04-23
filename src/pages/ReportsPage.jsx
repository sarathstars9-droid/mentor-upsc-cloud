// src/pages/ReportsPage.jsx
// Study reporting UI — PostgreSQL-backed, no Sheets/Calendar dependency.
// Answers: "What did I study today / last week / last month?"
//
// Tabs: Today | Last 7 Days | This Month
// Design: dark theme, inline styles only — matches existing MentorOS palette.

import { useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "../config";

// ── Theme constants (matches mentoros-plan.css palette) ──────────────────────
const C = {
  bg:      "#09090b",
  surface: "#111113",
  card:    "#18181b",
  border:  "rgba(255,255,255,0.08)",
  text:    "#f8fafc",
  muted:   "rgba(248,250,252,0.55)",
  dim:     "rgba(248,250,252,0.35)",
  green:   "#4ade80",
  amber:   "#fbbf24",
  blue:    "#60a5fa",
  red:     "#f87171",
  purple:  "#a78bfa",
};

const TAB = { TODAY: "today", WEEK: "week", MONTH: "month", SUGGEST: "suggest" };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchReport(type, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BACKEND_URL}/api/reports/${type}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || "Report fetch failed");
  return data.report;
}

async function fetchSuggestions() {
  const res = await fetch(`${BACKEND_URL}/api/planner/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || "Suggestions fetch failed");
  return data.suggestions;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function thisMonthKey() {
  return new Date().toISOString().slice(0, 7);
}
function secsToDisplay(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function pct(n, d) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = C.blue }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "16px 20px", minWidth: 120,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginTop: 4 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: C.muted, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function SubjectBar({ subject, actualSeconds, ratio, plannedMinutes }) {
  const barWidth = `${Math.min(ratio || 0, 100)}%`;
  const colors = [C.blue, C.green, C.amber, C.purple, C.red, "#34d399", "#f472b6"];
  const idx = Math.abs([...String(subject)].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;
  const color = colors[idx];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{subject}</span>
        <span style={{ fontSize: 12, color: C.muted }}>
          {secsToDisplay(actualSeconds)}
          {plannedMinutes ? <span style={{ color: C.dim }}> / {plannedMinutes}m planned</span> : null}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
        <div style={{ height: 6, borderRadius: 999, background: color, width: barWidth, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function BlockList({ blocks, title = "Studied Blocks" }) {
  const [expanded, setExpanded] = useState(false);
  if (!blocks?.length) return null;
  const shown = expanded ? blocks : blocks.slice(0, 8);

  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader>{title} ({blocks.length})</SectionHeader>
      {shown.map((b, i) => (
        <div key={b.id || i} style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "10px 14px", marginBottom: 6,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 10,
        }}>
          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
            background: b.status === "completed" ? C.green
              : b.status === "partial"   ? C.amber
              : b.status === "missed"    ? C.red
              : b.status === "active"    ? C.blue
              : C.dim,
          }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.subject}{b.topic ? ` — ${b.topic}` : ""}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                {secsToDisplay(b.actualSeconds)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {b.stage && (
                <span style={{ fontSize: 10, color: C.dim, background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                  {b.stage}
                </span>
              )}
              {b.status && (
                <span style={{ fontSize: 10, color: C.muted }}>{b.status}</span>
              )}
              {b.dayKey && (
                <span style={{ fontSize: 10, color: C.dim }}>{b.dayKey}</span>
              )}
              {b.plannedMinutes > 0 && (
                <span style={{ fontSize: 10, color: C.dim }}>{b.plannedMinutes}m planned</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {blocks.length > 8 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: 12, padding: "6px 16px", cursor: "pointer",
            width: "100%", marginTop: 4,
          }}
        >
          {expanded ? "Show less" : `Show ${blocks.length - 8} more`}
        </button>
      )}
    </div>
  );
}

function DayBar({ day }) {
  const maxH = 80;
  const actualMin = Math.floor(Number(day.actual_seconds || 0) / 60);
  const plannedMin = Number(day.planned_minutes || 0);
  const height = plannedMin > 0 ? Math.min((actualMin / Math.max(plannedMin, 1)) * maxH, maxH) : (actualMin > 0 ? 20 : 2);
  const dayLabel = new Date(day.day_key + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
  const isToday = day.day_key === todayKey();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
      <div style={{ fontSize: 10, color: C.dim }}>{actualMin > 0 ? secsToDisplay(day.actual_seconds) : ""}</div>
      <div style={{ width: "100%", height: maxH, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{
          width: "80%", borderRadius: "4px 4px 0 0",
          height: Math.max(height, 2),
          background: Number(day.completed_blocks) > 0 ? C.green
            : Number(day.started_blocks) > 0 ? C.amber
            : "rgba(255,255,255,0.08)",
        }} />
      </div>
      <div style={{ fontSize: 11, color: isToday ? C.blue : C.dim, fontWeight: isToday ? 700 : 400 }}>
        {dayLabel}
      </div>
    </div>
  );
}

// ── Intelligence panels ───────────────────────────────────────────────────────

function AiSummaryPanel({ summary }) {
  if (!summary) return null;
  return (
    <div style={{
      padding: "16px 20px",
      background: "rgba(167,139,250,0.07)",
      border: "1px solid rgba(167,139,250,0.25)",
      borderRadius: 12, marginBottom: 24,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        🧠 AI Summary
      </div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {summary}
      </div>
    </div>
  );
}

function InsightsPanel({ insights }) {
  if (!insights) return null;
  const { performanceGapDisplay, overPerformed, bestDay, worstDay, avgDailyStudyDisplay } = insights;
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader>📊 Performance Insights</SectionHeader>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{
          background: C.card,
          border: `1px solid ${overPerformed ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
          borderRadius: 10, padding: "12px 16px", flex: "1 1 160px",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: overPerformed ? C.green : C.red }}>
            {performanceGapDisplay}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>vs planned time</div>
        </div>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "12px 16px", flex: "1 1 160px",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{avgDailyStudyDisplay}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>avg / study day</div>
        </div>
        {bestDay && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 16px", flex: "1 1 160px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{bestDay.display}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>best day · {bestDay.dayKey}</div>
          </div>
        )}
        {worstDay && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 16px", flex: "1 1 160px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.dim }}>{worstDay.display}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>lowest day · {worstDay.dayKey}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeakAreasPanel({ weakSubjects }) {
  if (!weakSubjects?.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader>⚠️ Weak Areas</SectionHeader>
      {weakSubjects.map((w, i) => (
        <div key={i} style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "10px 14px", marginBottom: 6,
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: 10,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{w.subject}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{w.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Phase 8: Knowledge Linkage Panel — shows Study→PYQ follow-through metrics */
function KnowledgeLinkagePanel({ linkage }) {
  if (!linkage) return null;
  const {
    studiedTopicsCount = 0, practicedTopicsCount = 0,
    skippedPracticeCount = 0, revisionGeneratedCount = 0,
    followThroughRate = 0, avgPyqAccuracy = 0,
  } = linkage;

  // Don't show if no linkage data at all
  if (studiedTopicsCount === 0 && practicedTopicsCount === 0) return null;

  const ftColor = followThroughRate >= 70 ? C.green : followThroughRate >= 40 ? C.amber : C.red;

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader>🔗 Knowledge Linkage</SectionHeader>
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12,
      }}>
        <StatCard label="Topics Studied"   value={studiedTopicsCount}          accent={C.blue} />
        <StatCard label="PYQs Practiced"   value={practicedTopicsCount}        accent={C.green} />
        <StatCard label="Follow-through"   value={`${followThroughRate}%`}     accent={ftColor} />
        <StatCard label="PYQ Accuracy"     value={`${avgPyqAccuracy}%`}        accent={C.purple} />
        <StatCard label="Revisions Made"   value={revisionGeneratedCount}      accent={C.amber} />
      </div>

      {skippedPracticeCount > 0 && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.18)",
          borderRadius: 10,
          fontSize: 13, color: C.amber,
        }}>
          ⚡ {skippedPracticeCount} topic{skippedPracticeCount !== 1 ? "s" : ""} studied but PYQs not yet attempted
        </div>
      )}
    </div>
  );
}

function MissedWorkPanel({ missedBlocks }) {
  const [expanded, setExpanded] = useState(false);
  if (!missedBlocks?.length) return null;
  const shown = expanded ? missedBlocks : missedBlocks.slice(0, 6);
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader>📉 Missed Work ({missedBlocks.length})</SectionHeader>
      {shown.map((b, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", marginBottom: 4,
          background: "rgba(248,113,113,0.05)",
          border: "1px solid rgba(248,113,113,0.15)",
          borderRadius: 8,
        }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.subject}</span>
            {b.topic && <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>— {b.topic}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {b.plannedMinutes > 0 && (
              <span style={{ fontSize: 11, color: C.dim }}>{b.plannedMinutes}m</span>
            )}
            <span style={{ fontSize: 10, color: C.dim }}>{b.dayKey}</span>
          </div>
        </div>
      ))}
      {missedBlocks.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: 12, padding: "5px 14px", cursor: "pointer",
            width: "100%", marginTop: 4,
          }}
        >
          {expanded ? "Show less" : `Show ${missedBlocks.length - 6} more`}
        </button>
      )}
    </div>
  );
}

// ── Suggestions panel ─────────────────────────────────────────────────────────

const PRIORITY_COLOR = { HIGH: "#f87171", MEDIUM: "#fbbf24", LOW: "#4ade80" };
const PRIORITY_BG    = { HIGH: "rgba(248,113,113,0.08)", MEDIUM: "rgba(251,191,36,0.08)", LOW: "rgba(74,222,128,0.08)" };
const TYPE_META = {
  REVISION: { label: "REVISION", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  NEW:      { label: "NEW",      color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  PRACTICE: { label: "PRACTICE", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

function ConfidenceBar({ confidence }) {
  const color = confidence >= 70 ? C.green : confidence >= 45 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div style={{
        flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${confidence}%`,
          background: color, borderRadius: 999,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>
        {confidence}%
      </span>
    </div>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.REVISION;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
      padding: "2px 7px", borderRadius: 4,
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}44`,
    }}>
      {m.label}
    </span>
  );
}

function SuggestionsPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await fetchSuggestions()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorMsg msg={error} onRetry={load} />;
  if (!data)   return null;

  const {
    recommendedBlocks, priority, confidence, strategy,
    context, weakSubjects, missedBlocks, basePeriod, _cached,
  } = data;

  const priColor = PRIORITY_COLOR[priority] || C.blue;
  const priBg    = PRIORITY_BG[priority]    || "rgba(96,165,250,0.08)";

  return (
    <div>
      {/* ── Header strip: priority + confidence + strategy ────────────────── */}
      <div style={{
        padding: "14px 18px", marginBottom: 20,
        background: priBg, border: `1px solid ${priColor}33`, borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          {/* Priority badge */}
          <div style={{
            padding: "3px 10px", borderRadius: 6,
            background: priColor + "22", border: `1px solid ${priColor}55`,
            fontSize: 11, fontWeight: 800, color: priColor, letterSpacing: "0.06em", flexShrink: 0,
          }}>
            {priority}
          </div>
          {/* Confidence bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.04em" }}>CONFIDENCE</span>
            <ConfidenceBar confidence={confidence || 0} />
          </div>
          {/* Period + cache indicator */}
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.dim }}>
            {basePeriod.start} → {basePeriod.end}
            {_cached && <span style={{ marginLeft: 6, color: C.dim }}>(cached)</span>}
          </div>
        </div>
        {/* Strategy */}
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{strategy}</div>
      </div>

      {/* ── Context stats ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        {[
          { label: "Study Days",    value: `${context.studyDays}/7`,                  accent: C.blue  },
          { label: "Total Studied", value: context.totalStudyDisplay,                  accent: C.green },
          { label: "vs Planned",    value: context.performanceGapDisplay,              accent: context.performanceGap >= 0 ? C.green : C.red },
          { label: "Missed",        value: `${context.missedBlocks} sessions`,         accent: context.missedBlocks > 2 ? C.red : C.amber },
          { label: "Weak Areas",    value: `${context.weakSubjectsCount} subjects`,    accent: C.amber },
        ].map((s) => (
          <div key={s.label} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.accent }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Recommended blocks ────────────────────────────────────────────── */}
      {recommendedBlocks.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📌 Suggested for You</SectionHeader>
          {recommendedBlocks.map((b, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "12px 16px", marginBottom: 8,
              background: C.card,
              border: `1px solid ${i === 0 ? priColor + "55" : C.border}`,
              borderRadius: 10,
            }}>
              {/* Rank circle */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i === 0 ? priColor + "22" : "rgba(255,255,255,0.05)",
                fontSize: 12, fontWeight: 800,
                color: i === 0 ? priColor : C.dim,
              }}>
                {i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Subject + topic + type badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.subject}</span>
                  {b.topic && (
                    <span style={{ fontSize: 13, color: C.muted }}>— {b.topic}</span>
                  )}
                  <TypeBadge type={b.type} />
                </div>

                {/* Reason */}
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 5 }}>{b.reason}</div>

                {/* Time suggestion */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 11, color: C.muted,
                    background: "rgba(255,255,255,0.05)",
                    padding: "2px 8px", borderRadius: 4,
                    border: `1px solid ${C.border}`,
                  }}>
                    ⏱ {b.suggestedMinutes}m suggested
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No specific suggestions — you're on track!" />
      )}

      {/* ── Weak areas ───────────────────────────────────────────────────── */}
      {weakSubjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>⚠️ Weak Areas Detected</SectionHeader>
          {weakSubjects.map((w, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 6,
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{w.subject}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{w.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Missed / unfinished ───────────────────────────────────────────── */}
      {missedBlocks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📉 Unfinished This Week ({missedBlocks.length})</SectionHeader>
          {missedBlocks.slice(0, 8).map((b, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 14px", marginBottom: 4,
              background: "rgba(248,113,113,0.05)",
              border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8,
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.subject}</span>
                {b.topic && <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>— {b.topic}</span>}
              </div>
              <span style={{ fontSize: 10, color: C.dim }}>{b.dayKey}</span>
            </div>
          ))}
          {missedBlocks.length > 8 && (
            <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 4 }}>
              +{missedBlocks.length - 8} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsistencyRing({ score }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(score / 100, 1);
  const color = score >= 70 ? C.green : score >= 40 ? C.amber : C.red;

  return (
    <div style={{ position: "relative", width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 16, fontWeight: 800, color,
      }}>
        {score}
      </div>
    </div>
  );
}

// ── Daily panel ───────────────────────────────────────────────────────────────

function DailyPanel({ date, onDateChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await fetchReport("daily", { date })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const { totalStudySeconds, totalPauseSeconds, totalActualMinutes, totalPlannedMinutes,
    completedBlocks, totalBlocks, completionRate, subjectWiseSplit, studiedBlocks } = report;

  return (
    <div>
      {/* Date picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)}
          style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, padding: "6px 12px", fontSize: 14,
          }} />
        <span style={{ fontSize: 13, color: C.muted }}>
          {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message={`No blocks recorded for ${date}`} />
      ) : (
        <>
          {/* Key metrics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Study Time"    value={secsToDisplay(totalStudySeconds)} accent={C.green} />
            <StatCard label="Pause Time"    value={secsToDisplay(totalPauseSeconds)} accent={C.amber} />
            <StatCard label="Planned"       value={`${totalPlannedMinutes}m`}        accent={C.blue} />
            <StatCard label="Blocks Done"   value={`${completedBlocks}/${totalBlocks}`} sub={`${completionRate}% done`} accent={C.purple} />
          </div>

          {/* Subject breakdown */}
          {subjectWiseSplit?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Time by Subject</SectionHeader>
              {subjectWiseSplit.map((s) => (
                <SubjectBar key={s.subject} {...s} />
              ))}
            </div>
          )}

          <BlockList blocks={studiedBlocks} title="What I Studied Today" />
        </>
      )}
    </div>
  );
}

// ── Weekly panel ──────────────────────────────────────────────────────────────

function WeeklyPanel({ endDate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await fetchReport("weekly", { endDate })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const {
    weekStart, weekEnd, totalStudySeconds, totalPauseSeconds,
    totalActualMinutes, totalPlannedMinutes,
    completedBlocks, totalBlocks, completionRate,
    studyDaysCount, avgDailyStudyMinutes, streakCount, consistencyScore,
    subjectWiseSplit, dayWiseBreakdown, studiedBlocks, topicWiseSplit,
    insights, weakSubjects, missedBlocks, aiSummary,
    knowledgeLinkage,
  } = report;

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        {weekStart} → {weekEnd}
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message="No blocks recorded last week" />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Study Time"   value={secsToDisplay(totalStudySeconds)} accent={C.green} />
            <StatCard label="Study Days"   value={`${studyDaysCount}/7`}            accent={C.blue} />
            <StatCard label="Daily Avg"    value={`${avgDailyStudyMinutes}m`}       accent={C.amber} />
            <StatCard label="Streak"       value={`${streakCount}d`}                accent={C.purple} />
            <StatCard label="Completion"   value={`${completionRate}%`} sub={`${completedBlocks}/${totalBlocks} blocks`} accent={C.green} />
          </div>

          {/* Consistency ring */}
          <div style={{
            display: "flex", gap: 20, alignItems: "center",
            padding: "16px 20px", background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, marginBottom: 24,
          }}>
            <ConsistencyRing score={consistencyScore || 0} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                Consistency Score
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 280, lineHeight: 1.5 }}>
                Based on study-day ratio, planned vs actual time, and current streak.
                {consistencyScore >= 70 ? " Strong week." : consistencyScore >= 40 ? " Decent effort." : " Needs improvement."}
              </div>
            </div>
          </div>

          <AiSummaryPanel summary={aiSummary} />
          <InsightsPanel insights={insights} />
          <WeakAreasPanel weakSubjects={weakSubjects} />
          <KnowledgeLinkagePanel linkage={knowledgeLinkage} />
          <MissedWorkPanel missedBlocks={missedBlocks} />

          {/* Day-wise bar chart */}
          {dayWiseBreakdown?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Day-Wise Breakdown</SectionHeader>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", padding: "0 4px" }}>
                {dayWiseBreakdown.map((d) => <DayBar key={d.day_key} day={d} />)}
              </div>
            </div>
          )}

          {/* Subject split */}
          {subjectWiseSplit?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Time by Subject (This Week)</SectionHeader>
              {subjectWiseSplit.map((s) => <SubjectBar key={s.subject} {...s} />)}
            </div>
          )}

          {/* Topic list */}
          {topicWiseSplit?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Topics Studied</SectionHeader>
              {topicWiseSplit.slice(0, 12).map((t, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.topic || t.subject}</span>
                    {t.topic && <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>{t.subject}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{secsToDisplay(t.actual_seconds)}</span>
                </div>
              ))}
            </div>
          )}

          <BlockList blocks={studiedBlocks} title="What I Studied Last Week" />
        </>
      )}
    </div>
  );
}

// ── Monthly panel ─────────────────────────────────────────────────────────────

function MonthlyPanel({ month }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await fetchReport("monthly", { month })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const {
    totalStudySeconds, totalPlannedMinutes,
    completedBlocks, totalBlocks, completionRate,
    activeStudyDays, calendarDays, avgDailyStudyMinutes, streakCount, consistencyScore,
    subjectWiseSplit, dayWiseBreakdown, weeklyBreakdown,
    topStudiedSubjects, topStudiedTopics, studiedBlocks,
    insights, weakSubjects, missedBlocks, aiSummary,
    knowledgeLinkage,
  } = report;

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        &nbsp;· {calendarDays} calendar days
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message="No blocks recorded this month" />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Study Time"   value={secsToDisplay(totalStudySeconds)} accent={C.green} />
            <StatCard label="Study Days"   value={`${activeStudyDays}/${calendarDays}`} accent={C.blue} />
            <StatCard label="Daily Avg"    value={`${avgDailyStudyMinutes}m`}        accent={C.amber} />
            <StatCard label="Streak"       value={`${streakCount}d`}                 accent={C.purple} />
            <StatCard label="Completion"   value={`${completionRate}%`} sub={`${completedBlocks}/${totalBlocks} blocks`} accent={C.green} />
          </div>

          {/* Consistency */}
          <div style={{
            display: "flex", gap: 20, alignItems: "center",
            padding: "16px 20px", background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, marginBottom: 24,
          }}>
            <ConsistencyRing score={consistencyScore || 0} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Monthly Consistency</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 280, lineHeight: 1.5 }}>
                Studied {activeStudyDays} of {calendarDays} days. Planned {totalPlannedMinutes}m,
                achieved {secsToDisplay(totalStudySeconds)}.
              </div>
            </div>
          </div>

          <AiSummaryPanel summary={aiSummary} />
          <InsightsPanel insights={insights} />
          <WeakAreasPanel weakSubjects={weakSubjects} />
          <KnowledgeLinkagePanel linkage={knowledgeLinkage} />
          <MissedWorkPanel missedBlocks={missedBlocks} />

          {/* Weekly breakdown */}
          {weeklyBreakdown?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Week-by-Week</SectionHeader>
              {weeklyBreakdown.map((w) => (
                <div key={w.iso_week} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", marginBottom: 6,
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {w.week_start} → {w.week_end}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      {w.completed_blocks} blocks done
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>
                    {secsToDisplay(w.actual_seconds)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top subjects */}
          {topStudiedSubjects?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Top Subjects This Month</SectionHeader>
              {subjectWiseSplit.map((s) => <SubjectBar key={s.subject} {...s} />)}
            </div>
          )}

          {/* Top topics */}
          {topStudiedTopics?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Top Topics This Month</SectionHeader>
              {topStudiedTopics.map((t, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.topic}</span>
                    <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>{t.subject}</span>
                  </div>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{t.display}</span>
                </div>
              ))}
            </div>
          )}

          <BlockList blocks={studiedBlocks} title="What I Studied This Month" />
        </>
      )}
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
      Loading report…
    </div>
  );
}

function ErrorMsg({ msg, onRetry }) {
  return (
    <div style={{
      padding: "20px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
      borderRadius: 10, color: C.red, fontSize: 13,
    }}>
      {msg}
      {onRetry && (
        <button onClick={onRetry} style={{
          marginLeft: 12, background: "none", border: "1px solid rgba(248,113,113,0.4)",
          borderRadius: 6, color: C.red, fontSize: 12, padding: "3px 10px", cursor: "pointer",
        }}>
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.dim, fontSize: 14 }}>
      {message}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab,   setTab]   = useState(TAB.TODAY);
  const [date,  setDate]  = useState(todayKey());
  const [month, setMonth] = useState(thisMonthKey());

  const tabStyle = (t) => ({
    background:   tab === t ? "rgba(96,165,250,0.15)" : "none",
    border:       `1px solid ${tab === t ? "rgba(96,165,250,0.4)" : C.border}`,
    borderRadius: 8,
    color:        tab === t ? C.blue : C.muted,
    cursor:       "pointer",
    fontSize:     13,
    fontWeight:   700,
    padding:      "7px 18px",
    transition:   "all 0.15s",
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "0 0 60px 0" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: "24px 24px 0 24px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 24,
        paddingBottom: 20,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
          Study Reports
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          PostgreSQL-backed · what I actually studied
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <button style={tabStyle(TAB.TODAY)}   onClick={() => setTab(TAB.TODAY)}>Today</button>
          <button style={tabStyle(TAB.WEEK)}    onClick={() => setTab(TAB.WEEK)}>Last 7 Days</button>
          <button style={tabStyle(TAB.MONTH)}   onClick={() => setTab(TAB.MONTH)}>This Month</button>
          <button style={tabStyle(TAB.SUGGEST)} onClick={() => setTab(TAB.SUGGEST)}>📌 Suggest</button>
        </div>

        {/* ── Period controls ─────────────────────────────────────────────── */}
        {tab === TAB.MONTH && (
          <div style={{ marginTop: 12 }}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, padding: "6px 12px", fontSize: 13,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Panel area ───────────────────────────────────────────────────── */}
      <div style={{ padding: "0 24px" }}>
        {tab === TAB.TODAY   && <DailyPanel date={date} onDateChange={setDate} />}
        {tab === TAB.WEEK    && <WeeklyPanel endDate={todayKey()} />}
        {tab === TAB.MONTH   && <MonthlyPanel month={month} />}
        {tab === TAB.SUGGEST && <SuggestionsPanel />}
      </div>
    </div>
  );
}
