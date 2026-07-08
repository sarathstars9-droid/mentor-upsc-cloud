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
  bg:          "#09090b",
  surface:     "#111113",
  card:        "#18181b",
  border:      "#1f1f23",
  borderMid:   "#27272a",
  text:        "#d4d4d8",
  textBright:  "#f4f4f5",
  muted:       "#a1a1aa",
  dim:         "#71717a",
  green:       "#10b981",
  amber:       "#f59e0b",
  blue:        "#3b82f6",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
  mono:        "'JetBrains Mono', 'Fira Code', monospace",
};

const TAB = { DASHBOARD: "dashboard", TODAY: "today", WEEK: "week", MONTH: "month", SUGGEST: "suggest" };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchReport(type, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BACKEND_URL}/api/reports/${type}?${qs}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = C.blue }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12, 
      padding: "16px 20px", 
      minWidth: 125,
      flex: "1 1 125px",
      fontFamily: C.font,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: value !== "0" && value !== "0%" && value !== "—" ? accent : C.textBright, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
      textTransform: "uppercase", color: C.dim, marginBottom: 12,
      fontFamily: C.font,
    }}>
      {children}
    </div>
  );
}

function SubjectBar({ subject, actualSeconds, ratio, plannedMinutes }) {
  const barWidth = `${Math.min(ratio || 0, 100)}%`;
  const colors = [C.blue, C.green, C.amber, C.purple, C.red, "#10b981", "#ec4899"];
  const idx = Math.abs([...String(subject)].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;
  const color = colors[idx];

  return (
    <div style={{ marginBottom: 14, fontFamily: C.font }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{subject}</span>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
          {secsToDisplay(actualSeconds)}
          {plannedMinutes ? <span style={{ color: C.dim }}> / {plannedMinutes}m planned</span> : null}
        </span>
      </div>
      <div style={{ height: 6, background: "#1f1f23", borderRadius: 999 }}>
        <div style={{ height: 6, borderRadius: 999, background: color, width: barWidth, transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }} />
      </div>
    </div>
  );
}

function BlockList({ blocks, title = "Studied Blocks" }) {
  const [expanded, setExpanded] = useState(false);
  if (!blocks?.length) return null;
  const shown = expanded ? blocks : blocks.slice(0, 8);

  return (
    <div style={{ marginTop: 24, fontFamily: C.font }}>
      <SectionHeader>{title} ({blocks.length})</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((b, i) => (
          <div key={b.id || i} style={{
            display: "flex", gap: 12, alignItems: "center",
            padding: "12px 16px",
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10,
          }}>
            {/* Status dot */}
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: b.status === "completed" ? C.green
                : b.status === "partial"   ? C.amber
                : b.status === "missed"    ? C.red
                : b.status === "active"    ? C.blue
                : C.dim,
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {b.subject}{b.topic ? ` — ${b.topic}` : ""}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                  {secsToDisplay(b.actualSeconds)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                {b.stage && (
                  <span style={{ fontSize: 10, color: C.dim, background: "rgba(255,255,255,0.04)", border: "1px solid #1f1f23", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                    {b.stage.toUpperCase()}
                  </span>
                )}
                {b.status && (
                  <span style={{ fontSize: 11, color: C.muted, textTransform: "capitalize", fontWeight: 500 }}>{b.status}</span>
                )}
                {b.dayKey && (
                  <span style={{ fontSize: 11, color: C.dim }}>{b.dayKey}</span>
                )}
                {b.plannedMinutes > 0 && (
                  <span style={{ fontSize: 11, color: C.dim }}>{b.plannedMinutes}m planned</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {blocks.length > 8 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: 12, padding: "8px 16px", cursor: "pointer",
            width: "100%", marginTop: 10, fontWeight: 600, fontFamily: C.font,
            transition: "all 0.15s ease",
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, fontFamily: C.font }}>
      <div style={{ fontSize: 10, color: C.dim, height: 12, fontWeight: 600 }}>{actualMin > 0 ? secsToDisplay(day.actual_seconds) : ""}</div>
      <div style={{ width: "100%", height: maxH, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{
          width: "60%", borderRadius: "4px 4px 0 0",
          height: Math.max(height, 2),
          background: Number(day.completed_blocks) > 0 ? C.green
            : Number(day.started_blocks) > 0 ? C.amber
            : "rgba(255,255,255,0.06)",
          transition: "all 0.3s ease",
        }} />
      </div>
      <div style={{ fontSize: 11, color: isToday ? C.blue : C.dim, fontWeight: isToday ? 700 : 500 }}>
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
      padding: "20px 22px",
      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(139, 92, 246, 0.06) 100%)",
      border: "1px solid rgba(139, 92, 246, 0.18)",
      borderLeft: `4px solid ${C.purple}`,
      borderRadius: 12, marginBottom: 24,
      fontFamily: C.font,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
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
    <div style={{ marginBottom: 24, fontFamily: C.font }}>
      <SectionHeader>📊 Performance Insights</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${overPerformed ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.2)"}`,
          borderRadius: 12, padding: "14px 18px",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: overPerformed ? C.green : C.red }}>
            {performanceGapDisplay}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>vs planned time</div>
        </div>
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: "14px 18px",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{avgDailyStudyDisplay}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>avg / study day</div>
        </div>
        {bestDay && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{bestDay.display}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>best day · {bestDay.dayKey}</div>
          </div>
        )}
        {worstDay && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.dim }}>{worstDay.display}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>lowest day · {worstDay.dayKey}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeakAreasPanel({ weakSubjects }) {
  if (!weakSubjects?.length) return null;
  return (
    <div style={{ marginBottom: 24, fontFamily: C.font }}>
      <SectionHeader>⚠️ Weak Areas</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {weakSubjects.map((w, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "12px 16px",
            background: "rgba(245, 158, 11, 0.02)",
            border: "1px solid rgba(245, 158, 11, 0.15)",
            borderRadius: 10,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{w.subject}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{w.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeLinkagePanel({ linkage }) {
  if (!linkage) return null;
  const {
    studiedTopicsCount = 0, practicedTopicsCount = 0,
    skippedPracticeCount = 0, revisionGeneratedCount = 0,
    followThroughRate = 0, avgPyqAccuracy = 0,
  } = linkage;

  if (studiedTopicsCount === 0 && practicedTopicsCount === 0) return null;

  const ftColor = followThroughRate >= 70 ? C.green : followThroughRate >= 40 ? C.amber : C.red;

  return (
    <div style={{ marginBottom: 24, fontFamily: C.font }}>
      <SectionHeader>🔗 Knowledge Linkage</SectionHeader>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 12,
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
          background: "rgba(245, 158, 11, 0.05)",
          border: "1px solid rgba(245, 158, 11, 0.15)",
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
    <div style={{ marginBottom: 24, fontFamily: C.font }}>
      <SectionHeader>📉 Missed Work ({missedBlocks.length})</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((b, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.02)",
            border: "1px solid rgba(239, 68, 68, 0.12)",
            borderRadius: 8,
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{b.subject}</span>
              {b.topic && <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>— {b.topic}</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {b.plannedMinutes > 0 && (
                <span style={{ fontSize: 11, color: C.dim }}>{b.plannedMinutes}m</span>
              )}
              <span style={{ fontSize: 11, color: C.dim }}>{b.dayKey}</span>
            </div>
          </div>
        ))}
      </div>
      {missedBlocks.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: 12, padding: "8px 16px", cursor: "pointer",
            width: "100%", marginTop: 8, fontWeight: 600, fontFamily: C.font,
            transition: "all 0.15s ease",
          }}
        >
          {expanded ? "Show less" : `Show ${missedBlocks.length - 6} more`}
        </button>
      )}
    </div>
  );
}

// ── Suggestions panel ─────────────────────────────────────────────────────────

const PRIORITY_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: C.green };
const PRIORITY_BG    = { HIGH: "rgba(239, 68, 68, 0.03)", MEDIUM: "rgba(245, 158, 11, 0.03)", LOW: "rgba(16, 185, 129, 0.03)" };
const TYPE_META = {
  REVISION: { label: "REVISION", color: C.blue, bg: "rgba(59, 130, 246, 0.08)" },
  NEW:      { label: "NEW",      color: C.green, bg: "rgba(16, 185, 129, 0.08)" },
  PRACTICE: { label: "PRACTICE", color: C.purple, bg: "rgba(139, 92, 246, 0.08)" },
};

function ConfidenceBar({ confidence }) {
  const color = confidence >= 70 ? C.green : confidence >= 45 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div style={{
        flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden",
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
      fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
      padding: "2px 7px", borderRadius: 4,
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}33`,
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
  const priBg    = PRIORITY_BG[priority]    || "rgba(59, 130, 246, 0.03)";

  return (
    <div style={{ fontFamily: C.font }}>
      {/* ── Header strip: priority + confidence + strategy ────────────────── */}
      <div style={{
        padding: "16px 20px", marginBottom: 20,
        background: priBg, border: `1px solid ${priColor}25`, borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          {/* Priority badge */}
          <div style={{
            padding: "3px 10px", borderRadius: 6,
            background: priColor + "15", border: `1px solid ${priColor}33`,
            fontSize: 11, fontWeight: 800, color: priColor, letterSpacing: "0.06em", flexShrink: 0,
          }}>
            {priority} PRIORITY
          </div>
          {/* Confidence bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.04em", fontWeight: 700 }}>CONFIDENCE</span>
            <ConfidenceBar confidence={confidence || 0} />
          </div>
          {/* Period + cache indicator */}
          <div style={{ marginLeft: "auto", fontSize: 11, color: C.dim }}>
            {basePeriod.start} &rarr; {basePeriod.end}
            {_cached && <span style={{ marginLeft: 6, color: C.dim }}>[cached]</span>}
          </div>
        </div>
        {/* Strategy */}
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{strategy}</div>
      </div>

      {/* ── Context stats ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Study Days",    value: `${context.studyDays}/7`,                  accent: C.blue  },
          { label: "Total Studied", value: context.totalStudyDisplay,                  accent: C.green },
          { label: "vs Planned",    value: context.performanceGapDisplay,              accent: context.performanceGap >= 0 ? C.green : C.red },
          { label: "Missed",        value: `${context.missedBlocks} sessions`,         accent: context.missedBlocks > 2 ? C.red : C.amber },
          { label: "Weak Areas",    value: `${context.weakSubjectsCount} subjects`,    accent: C.amber },
        ].map((s) => (
          <div key={s.label} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.accent }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Recommended blocks ────────────────────────────────────────────── */}
      {recommendedBlocks.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📌 Suggested for You</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recommendedBlocks.map((b, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "14px 18px",
                background: C.surface,
                border: `1px solid ${i === 0 ? priColor + "44" : C.border}`,
                borderRadius: 12,
              }}>
                {/* Rank circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i === 0 ? priColor + "15" : "rgba(255,255,255,0.03)",
                  fontSize: 12, fontWeight: 800,
                  color: i === 0 ? priColor : C.dim,
                  border: `1px solid ${i === 0 ? priColor + "33" : C.border}`,
                }}>
                  {i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Subject + topic + type badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>{b.subject}</span>
                    {b.topic && (
                      <span style={{ fontSize: 13, color: C.muted }}>&mdash; {b.topic}</span>
                    )}
                    <TypeBadge type={b.type} />
                  </div>

                  {/* Reason */}
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>{b.reason}</div>

                  {/* Time suggestion */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 11, color: C.muted,
                      background: "rgba(255,255,255,0.03)",
                      padding: "2px 8px", borderRadius: 4,
                      border: `1px solid ${C.border}`,
                      fontWeight: 600,
                    }}>
                      ⏱ {b.suggestedMinutes}m suggested
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState message="No specific suggestions — you're on track!" />
      )}

      {/* ── Weak areas ───────────────────────────────────────────────────── */}
      {weakSubjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>⚠️ Weak Areas Detected</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weakSubjects.map((w, i) => (
              <div key={i} style={{
                padding: "12px 14px",
                background: "rgba(245, 158, 11, 0.02)",
                border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: 10,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{w.subject}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{w.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Missed / unfinished ───────────────────────────────────────────── */}
      {missedBlocks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📉 Unfinished This Week ({missedBlocks.length})</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {missedBlocks.slice(0, 8).map((b, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.02)",
                border: "1px solid rgba(239, 68, 68, 0.12)", borderRadius: 8,
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{b.subject}</span>
                  {b.topic && <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>— {b.topic}</span>}
                </div>
                <span style={{ fontSize: 11, color: C.dim }}>{b.dayKey}</span>
              </div>
            ))}
          </div>
          {missedBlocks.length > 8 && (
            <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 8, fontWeight: 600 }}>
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
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 16, fontWeight: 800, color,
        fontFamily: C.font,
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
    <div style={{ fontFamily: C.font }}>
      {/* Date picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.textBright, padding: "6px 12px", fontSize: 14, outline: "none",
          }} />
        <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
          {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message={`No study sessions recorded for ${date}`} />
      ) : (
        <>
          {/* Key metrics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Study Time"    value={secsToDisplay(totalStudySeconds)} accent={C.green} />
            <StatCard label="Pause Time"    value={secsToDisplay(totalPauseSeconds)} accent={C.amber} />
            <StatCard label="Planned"       value={`${totalPlannedMinutes}m`}        accent={C.blue} />
            <StatCard label="Blocks Done"   value={`${completedBlocks}/${totalBlocks}`} sub={`${completionRate}% completion`} accent={C.purple} />
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
    <div style={{ fontFamily: C.font }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, fontWeight: 500 }}>
        {weekStart} &rarr; {weekEnd}
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message="No study blocks recorded last week" />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Study Time"   value={secsToDisplay(totalStudySeconds)} accent={C.green} />
            <StatCard label="Study Days"   value={`${studyDaysCount}/7`}            accent={C.blue} />
            <StatCard label="Daily Avg"    value={`${avgDailyStudyMinutes}m`}       accent={C.amber} />
            <StatCard label="Streak"       value={`${streakCount}d`}                accent={C.purple} />
            <StatCard label="Completion"   value={`${completionRate}%`} sub={`${completedBlocks}/${totalBlocks} blocks`} accent={C.green} />
          </div>

          {/* Consistency */}
          <div style={{
            display: "flex", gap: 20, alignItems: "center",
            padding: "16px 20px", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, marginBottom: 24,
          }}>
            <ConsistencyRing score={consistencyScore || 0} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>
                Consistency Score
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4, maxWidth: 380, lineHeight: 1.5 }}>
                Based on study-day ratio, planned vs actual time, and current streak.
                {consistencyScore >= 70 ? " Outstanding consistency." : consistencyScore >= 40 ? " Solid effort this week." : " Room for improvement."}
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
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", padding: "10px 4px 0", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {topicWiseSplit.slice(0, 12).map((t, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{t.topic || t.subject}</span>
                      {t.topic && <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>{t.subject}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{secsToDisplay(t.actual_seconds)}</span>
                  </div>
                ))}
              </div>
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
    <div style={{ fontFamily: C.font }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, fontWeight: 500 }}>
        {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        &nbsp;· {calendarDays} calendar days
      </div>

      {totalBlocks === 0 ? (
        <EmptyState message="No study blocks recorded this month" />
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
            padding: "16px 20px", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, marginBottom: 24,
          }}>
            <ConsistencyRing score={consistencyScore || 0} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>Monthly Consistency</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4, maxWidth: 380, lineHeight: 1.5 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weeklyBreakdown.map((w) => (
                  <div key={w.iso_week} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px",
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>
                        {w.week_start} &rarr; {w.week_end}
                      </div>
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                        {w.completed_blocks} blocks done
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>
                      {secsToDisplay(w.actual_seconds)}
                    </div>
                  </div>
                ))}
              </div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {topStudiedTopics.map((t, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{t.topic}</span>
                      <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>{t.subject}</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{t.display}</span>
                  </div>
                ))}
              </div>
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
    <div style={{ textAlign: "center", padding: "56px 0", color: C.muted, fontFamily: C.font }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>◌</div>
      Loading report…
    </div>
  );
}

function ErrorMsg({ msg, onRetry }) {
  return (
    <div style={{
      padding: "20px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)",
      borderRadius: 10, color: C.red, fontSize: 13, fontFamily: C.font,
    }}>
      {msg}
      {onRetry && (
        <button onClick={onRetry} style={{
          marginLeft: 12, background: "none", border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 6, color: C.red, fontSize: 12, padding: "4px 12px", cursor: "pointer",
          fontFamily: C.font, fontWeight: 600,
        }}>
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 0", color: C.dim, fontSize: 14, fontFamily: C.font }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      {message}
    </div>
  );
}

function DashboardPanel() {
  const [range, setRange] = useState("week");
  const [paper, setPaper] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/learning-loop?range=${range}&paper=${paper}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);
      if (!data.ok) throw new Error(data.message || "Report fetch failed");
      setReport(data.report);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range, paper]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const { execution, answers, mistakes, revisions, trends, prescription } = report;

  // Detect if there is any data
  const hasData = execution.plannedBlocks > 0 || answers.totalWritten > 0 || mistakes.totalOpen > 0 || revisions.completed > 0 || revisions.dueToday > 0;

  return (
    <div style={{ fontFamily: C.font }}>
      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center",
        background: C.surface, padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              style={{
                height: 30,
                background: range === r.id ? "rgba(245,158,11,0.12)" : "transparent",
                border: `1px solid ${range === r.id ? "rgba(245,158,11,0.4)" : C.border}`,
                borderRadius: 20, color: range === r.id ? "#f59e0b" : C.muted,
                padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: C.font,
                transition: "all 0.15s ease", whiteSpace: "nowrap",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Paper:</span>
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
            style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
              color: C.textBright, padding: "6px 12px", fontSize: 13, cursor: "pointer", outline: "none",
              fontFamily: C.font, fontWeight: 600,
            }}
          >
            <option value="all">All Papers</option>
            <option value="GS1">GS1 (GS Paper II)</option>
            <option value="GS2">GS2 (GS Paper III)</option>
            <option value="GS3">GS3 (GS Paper IV)</option>
            <option value="Ethics">Ethics (GS Paper V)</option>
            <option value="Essay">Essay</option>
            <option value="Geography Optional">Geography Optional</option>
          </select>
        </div>
      </div>

      {/* ── Dynamic Prescription Banner ──────────────────────────────────── */}
      {prescription && (
        <div style={{
          padding: "18px 20px",
          background: "rgba(245,158,11,0.02)",
          border: "1px solid rgba(245,158,11,0.15)",
          borderLeft: "4px solid #f59e0b",
          borderRadius: 12, marginBottom: 24
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Mentor Prescription
          </div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65 }}>
            {prescription}
          </div>
        </div>
      )}

      {/* ── Top KPI Cards Grid ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Execution Rate" value={`${execution.executionRate}%`} sub={`${execution.completedBlocks}/${execution.plannedBlocks} blocks`} accent={C.green} />
        <StatCard label="Study Hours" value={`${execution.totalCompletedHours}h`} sub={`${execution.totalPlannedHours}h planned`} accent={C.blue} />
        <StatCard label="Avg Score" value={answers.totalWritten > 0 ? `${answers.averageScore}/10` : "—"} sub={`${answers.totalWritten} answers`} accent={C.amber} />
        <StatCard label="Open Mistakes" value={`${mistakes.totalOpen}`} sub={`${mistakes.totalResolved} resolved`} accent={C.red} />
        <StatCard label="Revisions Due" value={`${revisions.dueToday}`} sub={`${revisions.overdue} overdue`} accent={C.purple} />
      </div>

      {!hasData ? (
        <div style={{
          background: C.surface, border: `1px dashed ${C.borderMid}`, borderRadius: 12,
          padding: "48px 24px", textAlign: "center", color: C.dim
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textBright }}>No learning loop metrics available for this period.</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 4, maxWidth: 360, margin: "6px auto 0", lineHeight: 1.6 }}>Start writing answers or scheduling blocks to populate the metrics dashboard.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Execution / Study Summary */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <SectionHeader>📅 Study Execution</SectionHeader>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Streak:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>🔥 {execution.streak} days</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Blocks Completed:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{execution.completedBlocks} blocks</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Blocks Missed:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{execution.missedBlocks} blocks</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Completed Study Hours:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{execution.totalCompletedHours}h / {execution.totalPlannedHours}h</span>
              </div>
            </div>

            {/* Answer Score Trend */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <SectionHeader>📈 Answer Score Trend</SectionHeader>
              {answers.trend.length === 0 ? (
                <div style={{ fontSize: 13, color: C.dim, textAlign: "center", padding: "20px 0" }}>No evaluated answer attempts in this period.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {answers.trend.slice(-5).map((t, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{t.date}</span>
                      <div style={{ flex: 1, margin: "0 12px", height: 6, background: "#1f1f23", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(t.avg_score / 10) * 100}%`, background: C.amber, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>{t.avg_score}/10</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Latest Attempts */}
            {answers.latestAttempts.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <SectionHeader>📝 Latest Answer Attempts</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {answers.latestAttempts.map((a, idx) => (
                    <div key={idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingBottom: 10, borderBottom: idx !== answers.latestAttempts.length - 1 ? `1px solid ${C.border}` : "none"
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.subject}{a.topic ? ` — ${a.topic}` : ""}
                        </div>
                        <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{a.paper} · {new Date(a.created_at).toLocaleDateString("en-IN")}</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.green, marginLeft: 12 }}>{a.current_score || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Revision Health */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <SectionHeader>🔄 Revision Health</SectionHeader>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <ConsistencyRing score={revisions.completionRate} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>Revisions Completed:</span>
                    <span style={{ fontWeight: 700, color: C.green }}>{revisions.completed}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>Overdue Revisions:</span>
                    <span style={{ fontWeight: 700, color: C.red }}>{revisions.overdue}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>Must Revise Pending:</span>
                    <span style={{ fontWeight: 700, color: C.purple }}>{revisions.mustRevisePending}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Paper-wise Weakness */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <SectionHeader>⚠️ Weakness by Paper</SectionHeader>
              {mistakes.topWeakPapers.length === 0 ? (
                <div style={{ fontSize: 13, color: C.dim, textAlign: "center", padding: "20px 0" }}>No open mistakes recorded.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mistakes.topWeakPapers.map((wp, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{wp.paper}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{wp.count} open</span>
                        <div style={{ width: 48, height: 6, background: "#1f1f23", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${Math.min((wp.count / 10) * 100, 100)}%`, background: C.red, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top 5 Must Fix Areas */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <SectionHeader>🎯 Top 5 Must Fix Areas</SectionHeader>
              {mistakes.topWeakAreas.length === 0 ? (
                <div style={{ fontSize: 13, color: C.dim, textAlign: "center", padding: "20px 0" }}>No weak areas identified.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mistakes.topWeakAreas.map((wa, idx) => (
                    <div key={idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingBottom: 8, borderBottom: idx !== mistakes.topWeakAreas.length - 1 ? `1px solid ${C.border}` : "none"
                    }}>
                      <span style={{ fontSize: 13, color: C.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{wa.area}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginLeft: 12 }}>{wa.count} errors</span>
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

// ── Page component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab,   setTab]   = useState(TAB.DASHBOARD);
  const [date,  setDate]  = useState(todayKey());
  const [month, setMonth] = useState(thisMonthKey());

  const tabStyle = (t) => ({
    height:       32,
    padding:      "0 18px",
    background:   tab === t ? "rgba(245,158,11,0.12)" : "transparent",
    border:       "none",
    borderRadius: 20,
    color:        tab === t ? "#f59e0b" : C.muted,
    cursor:       "pointer",
    fontSize:     13,
    fontWeight:   700,
    fontFamily:   C.font,
    transition:   "all 0.15s ease",
    whiteSpace:   "nowrap",
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "0 0 60px 0", fontFamily: C.font }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: "32px 24px 0 24px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 24,
        paddingBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          MentorOS · Reports
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.textBright, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Study Reports
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Review your study progress, consistency, and completed work
        </div>

        {/* ── Tab Switcher segment control ── */}
        <div style={{
          display: "inline-flex",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          padding: 4,
          gap: 2,
          marginTop: 18,
          flexWrap: "wrap",
        }}>
          <button style={tabStyle(TAB.DASHBOARD)} onClick={() => setTab(TAB.DASHBOARD)}>Learning Loop</button>
          <button style={tabStyle(TAB.TODAY)}   onClick={() => setTab(TAB.TODAY)}>Today</button>
          <button style={tabStyle(TAB.WEEK)}    onClick={() => setTab(TAB.WEEK)}>Last 7 Days</button>
          <button style={tabStyle(TAB.MONTH)}   onClick={() => setTab(TAB.MONTH)}>This Month</button>
          <button style={tabStyle(TAB.SUGGEST)} onClick={() => setTab(TAB.SUGGEST)}>📌 Suggest</button>
        </div>

        {/* ── Month Selector ── */}
        {tab === TAB.MONTH && (
          <div style={{ marginTop: 14 }}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.textBright, padding: "6px 12px", fontSize: 13, outline: "none",
                fontFamily: C.font, fontWeight: 600,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Panel Content Area ───────────────────────────────────────────── */}
      <div style={{ padding: "0 24px" }}>
        {tab === TAB.DASHBOARD && <DashboardPanel />}
        {tab === TAB.TODAY   && <DailyPanel date={date} onDateChange={setDate} />}
        {tab === TAB.WEEK    && <WeeklyPanel endDate={todayKey()} />}
        {tab === TAB.MONTH   && <MonthlyPanel month={month} />}
        {tab === TAB.SUGGEST && <SuggestionsPanel />}
      </div>
    </div>
  );
}
