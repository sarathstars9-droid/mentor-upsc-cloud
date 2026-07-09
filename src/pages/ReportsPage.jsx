// src/pages/ReportsPage.jsx
// Study reporting UI — PostgreSQL-backed, no Sheets/Calendar dependency.
// Design: premium corporate style, imports mentorosPremium.css

import { useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "../config";
import "../styles/mentorosPremium.css";

// ── Theme constants ──────────────────────
const C = {
  bg:          "#0E1117",
  surface:     "#171B23",
  card:        "#1C2230",
  border:      "rgba(255,255,255,0.08)",
  borderMid:   "rgba(255,255,255,0.12)",
  text:        "#F5F7FB",
  textBright:  "#F5F7FB",
  muted:       "#B8C0CC",
  dim:         "#7F8897",
  green:       "#2FBF71",
  amber:       "#D6B56D",
  blue:        "#3b82f6",
  red:         "#E05252",
  purple:      "#8b5cf6",
  font:        "Inter, Manrope, Aptos, system-ui, sans-serif",
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
    <div className="premium-kpi-card" style={{ borderTop: `2px solid ${accent}` }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: value !== "0" && value !== "0%" && value !== "—" ? C.textBright : C.muted, lineHeight: 1, marginBottom: 8 }}>
        {value ?? "—"}
      </div>
      <div className="premium-kpi-lbl" style={{ marginBottom: 4 }}>
        {label}
      </div>
      {sub && (
        <div className="premium-metadata" style={{ color: C.dim }}>{sub}</div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`premium-pill-button ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ children }) {
  return (
    <h3 className="premium-section-title" style={{ fontSize: 16, marginBottom: 14 }}>
      {children}
    </h3>
  );
}

function SubjectBar({ subject, actualSeconds, ratio, plannedMinutes }) {
  const barWidth = `${Math.min(ratio || 0, 100)}%`;
  const colors = [C.blue, C.green, C.amber, C.purple, C.red, "#2FBF71", "#ec4899"];
  const idx = Math.abs([...String(subject)].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;
  const color = colors[idx];

  return (
    <div style={{ marginBottom: 14, fontFamily: C.font }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 550, color: C.text }}>{subject}</span>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
          {secsToDisplay(actualSeconds)}
          {plannedMinutes ? <span style={{ color: C.dim }}> / {plannedMinutes}m planned</span> : null}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
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
          <div key={b.id || i} className="premium-surface-card-inner" style={{
            display: "flex", gap: 12, alignItems: "center",
            padding: "12px 16px",
          }}>
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
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {b.subject}{b.topic ? ` — ${b.topic}` : ""}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                  {secsToDisplay(b.actualSeconds)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                {b.stage && (
                  <span className="premium-metadata" style={{ background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>
                    {b.stage.toUpperCase()}
                  </span>
                )}
                {b.status && (
                  <span className="premium-metadata" style={{ textTransform: "capitalize" }}>{b.status}</span>
                )}
                {b.dayKey && (
                  <span className="premium-metadata">{b.dayKey}</span>
                )}
                {b.plannedMinutes > 0 && (
                  <span className="premium-metadata">{b.plannedMinutes}m planned</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {blocks.length > 8 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="premium-button-secondary"
          style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
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
      <div style={{ fontSize: 11, color: isToday ? C.accent : C.dim, fontWeight: isToday ? 700 : 500 }}>
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
      background: "linear-gradient(135deg, rgba(214, 181, 109, 0.02) 0%, rgba(214, 181, 109, 0.05) 100%)",
      border: "1px solid rgba(214, 181, 109, 0.18)",
      borderLeft: `4px solid ${C.amber}`,
      borderRadius: 12, marginBottom: 24,
      fontFamily: C.font,
    }}>
      <div className="premium-metadata" style={{ color: C.amber, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
        🧠 AI Summary
      </div>
      <div className="premium-body" style={{ color: C.text, whiteSpace: "pre-wrap" }}>
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
        <div className="premium-surface-card" style={{
          padding: "16px",
          borderColor: overPerformed ? "rgba(47, 191, 113, 0.15)" : "rgba(224, 82, 82, 0.15)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: overPerformed ? C.green : C.red }}>
            {performanceGapDisplay}
          </div>
          <div className="premium-metadata" style={{ marginTop: 4 }}>vs planned time</div>
        </div>
        <div className="premium-surface-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.amber }}>{avgDailyStudyDisplay}</div>
          <div className="premium-metadata" style={{ marginTop: 4 }}>avg / study day</div>
        </div>
        {bestDay && (
          <div className="premium-surface-card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{bestDay.display}</div>
            <div className="premium-metadata" style={{ marginTop: 4 }}>best day · {bestDay.dayKey}</div>
          </div>
        )}
        {worstDay && (
          <div className="premium-surface-card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dim }}>{worstDay.display}</div>
            <div className="premium-metadata" style={{ marginTop: 4 }}>lowest day · {worstDay.dayKey}</div>
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
          <div key={i} className="premium-surface-card" style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "12px 16px",
            background: "rgba(214, 181, 109, 0.02)",
            borderColor: "rgba(214, 181, 109, 0.18)"
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{w.subject}</div>
              <div className="premium-body" style={{ fontSize: 12.5, marginTop: 3 }}>{w.reason}</div>
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
      <div className="premium-kpi-grid" style={{ marginBottom: 12 }}>
        <StatCard label="Topics Studied"   value={studiedTopicsCount}          accent={C.blue} />
        <StatCard label="PYQs Practiced"   value={practicedTopicsCount}        accent={C.green} />
        <StatCard label="Follow-through"   value={`${followThroughRate}%`}     accent={ftColor} />
        <StatCard label="PYQ Accuracy"     value={`${avgPyqAccuracy}%`}        accent={C.purple} />
        <StatCard label="Revisions Made"   value={revisionGeneratedCount}      accent={C.amber} />
      </div>

      {skippedPracticeCount > 0 && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(214, 181, 109, 0.04)",
          border: "1px solid rgba(214, 181, 109, 0.18)",
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
          <div key={i} className="premium-surface-card" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px",
            background: "rgba(224, 82, 82, 0.02)",
            borderColor: "rgba(224, 82, 82, 0.15)",
            borderRadius: 8,
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{b.subject}</span>
              {b.topic && <span className="premium-metadata" style={{ marginLeft: 6 }}>— {b.topic}</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {b.plannedMinutes > 0 && (
                <span className="premium-metadata">{b.plannedMinutes}m</span>
              )}
              <span className="premium-metadata">{b.dayKey}</span>
            </div>
          </div>
        ))}
      </div>
      {missedBlocks.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="premium-button-secondary"
          style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
        >
          {expanded ? "Show less" : `Show ${missedBlocks.length - 6} more`}
        </button>
      )}
    </div>
  );
}

// ── Suggestions panel ─────────────────────────────────────────────────────────

const PRIORITY_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: C.green };
const PRIORITY_BG    = { HIGH: "rgba(224, 82, 82, 0.03)", MEDIUM: "rgba(214, 181, 109, 0.03)", LOW: "rgba(47, 191, 113, 0.03)" };
const TYPE_META = {
  REVISION: { label: "REVISION", color: C.blue, bg: "rgba(59, 130, 246, 0.08)" },
  NEW:      { label: "NEW",      color: C.green, bg: "rgba(47, 191, 113, 0.08)" },
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
      fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em",
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
      <div style={{
        padding: "16px 20px", marginBottom: 20,
        background: priBg, border: `1px solid ${priColor}25`, borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{
            padding: "3px 10px", borderRadius: 6,
            background: priColor + "15", border: `1px solid ${priColor}33`,
            fontSize: 11, fontWeight: 800, color: priColor, letterSpacing: "0.06em", flexShrink: 0,
          }}>
            {priority} PRIORITY
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="premium-metadata" style={{ fontWeight: 700 }}>CONFIDENCE</span>
            <ConfidenceBar confidence={confidence || 0} />
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: C.dim }}>
            {basePeriod.start} &rarr; {basePeriod.end}
            {_cached && <span style={{ marginLeft: 6, color: C.dim }}>[cached]</span>}
          </div>
        </div>
        <div className="premium-body" style={{ color: C.text }}>{strategy}</div>
      </div>

      <div className="premium-kpi-grid">
        {[
          { label: "Study Days",    value: `${context.studyDays}/7`,                  accent: C.blue  },
          { label: "Total Studied", value: context.totalStudyDisplay,                  accent: C.green },
          { label: "vs Planned",    value: context.performanceGapDisplay,              accent: context.performanceGap >= 0 ? C.green : C.red },
          { label: "Missed",        value: `${context.missedBlocks} sessions`,         accent: context.missedBlocks > 2 ? C.red : C.amber },
          { label: "Weak Areas",    value: `${context.weakSubjectsCount} subjects`,    accent: C.amber },
        ].map((s) => (
          <div key={s.label} className="premium-kpi-card" style={{ borderTop: `2px solid ${s.accent}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.accent, marginBottom: 8 }}>{s.value}</div>
            <div className="premium-kpi-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {recommendedBlocks.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📌 Suggested for You</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recommendedBlocks.map((b, i) => (
              <div key={i} className="premium-surface-card" style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "16px 20px",
                borderColor: i === 0 ? priColor + "44" : C.border,
              }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.textBright }}>{b.subject}</span>
                    {b.topic && (
                      <span className="premium-metadata">&mdash; {b.topic}</span>
                    )}
                    <TypeBadge type={b.type} />
                  </div>

                  <div className="premium-body" style={{ fontSize: 13.5, marginBottom: 8 }}>{b.reason}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="premium-metadata" style={{ background: "rgba(255,255,255,0.03)", padding: "2px 8px", borderRadius: 4 }}>
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

      {weakSubjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>⚠️ Weak Areas Detected</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weakSubjects.map((w, i) => (
              <div key={i} className="premium-surface-card" style={{
                padding: "12px 14px",
                background: "rgba(214, 181, 109, 0.02)",
                borderColor: "rgba(214, 181, 109, 0.15)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{w.subject}</div>
                <div className="premium-body" style={{ fontSize: 12.5, marginTop: 3 }}>{w.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {missedBlocks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>📉 Unfinished This Week ({missedBlocks.length})</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {missedBlocks.slice(0, 8).map((b, i) => (
              <div key={i} className="premium-surface-card" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px",
                background: "rgba(224, 82, 82, 0.02)",
                borderColor: "rgba(224, 82, 82, 0.12)",
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{b.subject}</span>
                  {b.topic && <span className="premium-metadata" style={{ marginLeft: 6 }}>— {b.topic}</span>}
                </div>
                <span className="premium-metadata">{b.dayKey}</span>
              </div>
            ))}
          </div>
          {missedBlocks.length > 8 && (
            <div className="premium-metadata" style={{ textAlign: "center", marginTop: 8, fontWeight: 600 }}>
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
        justifyContent: "center", fontSize: 15, fontWeight: 700, color,
        fontFamily: C.font,
      }}>
        {score}%
      </div>
    </div>
  );
}

// ── Daily panel ───────────────────────────────────────────────────────────────

function DailyPanel({ date, onDateChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReport("daily", { date });
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const { totalSeconds, plannedMinutes, ratio, blocks, streak } = report;

  return (
    <div style={{ fontFamily: C.font }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.textBright, padding: "6px 12px", fontSize: 13, outline: "none",
            fontFamily: C.font, fontWeight: 600,
          }}
        />
        {streak > 0 && (
          <span style={{ fontSize: 13, color: C.amber, fontWeight: 700 }}>🔥 {streak} day streak</span>
        )}
      </div>

      <div className="premium-kpi-grid">
        <StatCard label="Study Time" value={secsToDisplay(totalSeconds)} sub={plannedMinutes ? `${plannedMinutes}m planned` : "no plan set"} accent={C.blue} />
        <StatCard label="Execution Rate" value={`${ratio}%`} sub={plannedMinutes ? "based on planned time" : "—"} accent={C.green} />
        <StatCard label="Completed Blocks" value={blocks.filter(b => b.status === "completed").length} sub={`${blocks.length} sessions total`} accent={C.amber} />
      </div>

      {blocks.length === 0 ? (
        <EmptyState message="No study blocks scheduled or studied for this day." />
      ) : (
        <BlockList blocks={blocks} title="Day Study Sessions" />
      )}
    </div>
  );
}

// ── Weekly panel ──────────────────────────────────────────────────────────────

function WeeklyPanel({ endDate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReport("weekly", { endDate });
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const { totalSeconds, plannedMinutes, ratio, days, subjectBreakdown, blocks } = report;

  return (
    <div style={{ fontFamily: C.font }}>
      <div className="premium-kpi-grid">
        <StatCard label="Weekly Time" value={secsToDisplay(totalSeconds)} sub={`${Math.round((plannedMinutes || 0)/60)}h planned`} accent={C.blue} />
        <StatCard label="Execution Rate" value={`${ratio}%`} sub="weekly planned time met" accent={C.green} />
        <StatCard label="Active Days" value={days.filter(d => Number(d.actual_seconds) > 0).length} sub="out of 7 days" accent={C.amber} />
      </div>

      {/* Weekly Column Chart */}
      <div className="premium-surface-card" style={{ padding: "24px 28px", marginBottom: 24 }}>
        <SectionHeader>📅 Daily Consistency</SectionHeader>
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 12 }}>
          {days.map((day) => (
            <DayBar key={day.day_key} day={day} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Breakdown */}
        <div className="premium-surface-card" style={{ padding: 20 }}>
          <SectionHeader>📚 Subject Distribution</SectionHeader>
          {subjectBreakdown.length === 0 ? (
            <div className="premium-body" style={{ color: C.dim }}>No distribution data.</div>
          ) : (
            subjectBreakdown.map((sb) => (
              <SubjectBar
                key={sb.subject}
                subject={sb.subject}
                actualSeconds={sb.actualSeconds}
                ratio={sb.ratio}
                plannedMinutes={sb.plannedMinutes}
              />
            ))
          )}
        </div>

        {/* Blocks list */}
        <div className="premium-surface-card" style={{ padding: 20 }}>
          <BlockList blocks={blocks} title="Weekly Study Sessions" />
        </div>
      </div>
    </div>
  );
}

// ── Monthly panel ─────────────────────────────────────────────────────────────

function MonthlyPanel({ month }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReport("monthly", { month });
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} onRetry={load} />;
  if (!report) return null;

  const { totalSeconds, plannedMinutes, ratio, subjectBreakdown, blocks } = report;

  return (
    <div style={{ fontFamily: C.font }}>
      <div className="premium-kpi-grid">
        <StatCard label="Monthly Time" value={secsToDisplay(totalSeconds)} sub={`${Math.round((plannedMinutes || 0)/60)}h planned`} accent={C.blue} />
        <StatCard label="Execution Rate" value={`${ratio}%`} sub="monthly target met" accent={C.green} />
        <StatCard label="Completed Sessions" value={blocks.filter(b => b.status === "completed").length} sub={`${blocks.length} sessions total`} accent={C.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Breakdown */}
        <div className="premium-surface-card" style={{ padding: 20 }}>
          <SectionHeader>📚 Subject Distribution</SectionHeader>
          {subjectBreakdown.length === 0 ? (
            <div className="premium-body" style={{ color: C.dim }}>No distribution data.</div>
          ) : (
            subjectBreakdown.map((sb) => (
              <SubjectBar
                key={sb.subject}
                subject={sb.subject}
                actualSeconds={sb.actualSeconds}
                ratio={sb.ratio}
                plannedMinutes={sb.plannedMinutes}
              />
            ))
          )}
        </div>

        {/* Blocks list */}
        <div className="premium-surface-card" style={{ padding: 20 }}>
          <BlockList blocks={blocks} title="Monthly Study Sessions" />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "56px 0", color: C.muted, fontFamily: C.font }}>
      <div style={{ fontSize: 24, marginBottom: 8, color: C.amber }}>◌</div>
      Loading report data…
    </div>
  );
}

function ErrorMsg({ msg, onRetry }) {
  return (
    <div style={{
      background: "rgba(224, 82, 82, 0.05)", border: `1px solid ${C.red}33`, borderRadius: 10,
      padding: "16px 20px", color: C.red, fontFamily: C.font, fontSize: 14
    }}>
      Error: {msg}
      <button onClick={onRetry} className="premium-text-link" style={{ marginLeft: 12, color: C.amber }}>Retry</button>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="premium-surface-card" style={{ borderStyle: "dashed", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
      <div className="premium-body" style={{ color: C.muted }}>{message}</div>
    </div>
  );
}

// ── Dashboard / Learning Loop Panel ──────────────────────────────────────────

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

  const { execution, answers, mistakes, revisions, prescription } = report;

  const hasData = execution.plannedBlocks > 0 || answers.totalWritten > 0 || mistakes.totalOpen > 0 || revisions.completed > 0 || revisions.dueToday > 0;

  // Dynamic hero prescription message
  const executionRate = execution.executionRate || 0;
  const heroTitle = executionRate < 60 ? "This week’s bottleneck is execution" : "Study consistency is strong";
  const heroSub = executionRate < 60 
    ? `Complete planned blocks before adding new study targets. Current execution rate is ${executionRate}%.` 
    : `Execution rate is currently stable at ${executionRate}%. Keep up the follow-through pace.`;

  return (
    <div style={{ fontFamily: C.font }}>
      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <div className="premium-surface-card" style={{
        display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
        padding: "12px 18px", borderRadius: 12,
      }}>
        <div className="premium-pill-group">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" }
          ].map(r => (
            <FilterPill
              key={r.id}
              label={r.label}
              active={range === r.id}
              onClick={() => setRange(r.id)}
            />
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="premium-metadata">Paper:</span>
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

      {/* ── Dynamic Hero Insight Card ──────────────────────────────────── */}
      {hasData && (
        <div className="premium-directive-hero" style={{ padding: "24px 28px", marginBottom: 24 }}>
          <div className="premium-metadata" style={{ color: C.amber, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
            {heroTitle}
          </div>
          <div className="premium-body" style={{ color: C.text, fontSize: 14.5 }}>
            {heroSub}
          </div>
        </div>
      )}

      {/* ── Top KPI Cards Grid ─────────────────────────────────────────── */}
      <div className="premium-kpi-grid">
        <StatCard label="Execution rate" value={`${execution.executionRate}%`} sub={`${execution.completedBlocks}/${execution.plannedBlocks} blocks`} accent={C.green} />
        <StatCard label="Completed study hours" value={`${execution.totalCompletedHours}h`} sub={`${execution.totalPlannedHours}h planned`} accent={C.blue} />
        <StatCard label="Average answer score" value={answers.totalWritten > 0 ? `${answers.averageScore}/10` : "—"} sub={`${answers.totalWritten} answers`} accent={C.amber} />
        <StatCard label="Open mistake count" value={`${mistakes.totalOpen}`} sub={`${mistakes.totalResolved} resolved`} accent={C.red} />
        <StatCard label="Overdue revisions" value={`${revisions.dueToday}`} sub={`${revisions.overdue} overdue`} accent={C.purple} />
      </div>

      {!hasData ? (
        <EmptyState message="No evaluated answers this week. Write one answer to activate score trends." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Execution / Study Summary */}
            <div className="premium-surface-card" style={{ padding: 20 }}>
              <SectionHeader>📅 Execution Health</SectionHeader>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>Streak:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>🔥 {execution.streak} days</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>Blocks Completed:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{execution.completedBlocks} blocks</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>Blocks Missed:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{execution.missedBlocks} blocks</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>Completed Study Hours:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{execution.totalCompletedHours}h / {execution.totalPlannedHours}h</span>
              </div>
            </div>

            {/* Answer Score Trend */}
            <div className="premium-surface-card" style={{ padding: 20 }}>
              <SectionHeader>📈 Mistake Trend</SectionHeader>
              {answers.trend.length === 0 ? (
                <div style={{ fontSize: 13.5, color: C.dim, textAlign: "center", padding: "20px 0" }}>
                  No evaluated answers this week. Write one answer to activate score trends.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {answers.trend.slice(-5).map((t, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="premium-metadata">{t.date}</span>
                      <div style={{ flex: 1, margin: "0 12px", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
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
              <div className="premium-surface-card" style={{ padding: 20 }}>
                <SectionHeader>📝 Recent Answer Attempts</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {answers.latestAttempts.map((a, idx) => (
                    <div key={idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingBottom: 10, borderBottom: idx !== answers.latestAttempts.length - 1 ? `1px solid ${C.border}` : "none"
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            <div className="premium-surface-card" style={{ padding: 20 }}>
              <SectionHeader>🔄 Revision Health</SectionHeader>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <ConsistencyRing score={revisions.completionRate} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>Completed:</span>
                    <span style={{ fontWeight: 700, color: C.green }}>{revisions.completed}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>Overdue:</span>
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
            <div className="premium-surface-card" style={{ padding: 20 }}>
              <SectionHeader>⚠️ Weakness by Paper</SectionHeader>
              {mistakes.topWeakPapers.length === 0 ? (
                <div className="premium-body" style={{ color: C.dim }}>No open mistakes recorded.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mistakes.topWeakPapers.map((wp, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 550, color: C.textBright }}>{wp.paper}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="premium-metadata">{wp.count} open</span>
                        <div style={{ width: 48, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${Math.min((wp.count / 10) * 100, 100)}%`, background: C.red, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top 5 Must Fix Areas */}
            <div className="premium-surface-card" style={{ padding: 20 }}>
              <SectionHeader>🎯 Top 5 Must Fix Areas</SectionHeader>
              {mistakes.topWeakAreas.length === 0 ? (
                <div className="premium-body" style={{ color: C.dim }}>No weak areas identified.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mistakes.topWeakAreas.map((wa, idx) => (
                    <div key={idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingBottom: 8, borderBottom: idx !== mistakes.topWeakAreas.length - 1 ? `1px solid ${C.border}` : "none"
                    }}>
                      <span style={{ fontSize: 13.5, color: C.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{wa.area}</span>
                      <span className="premium-metadata" style={{ color: C.amber, fontWeight: 700 }}>{wa.count} errors</span>
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

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "0 0 60px 0", fontFamily: C.font }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: "32px 32px 0 32px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 24,
        paddingBottom: 20,
      }}>
        <div className="premium-metadata" style={{ textTransform: "uppercase", marginBottom: 8, color: C.dim }}>
          MentorOS · Reports
        </div>
        <div className="premium-page-title" style={{ margin: "0 0 10px 0" }}>
          Learning Loop Report
        </div>
        <div className="premium-page-subtitle" style={{ margin: "0 0 20px 0" }}>
          Execution, revision, and answer-writing progress for this period.
        </div>

        {/* ── Tab Switcher segment control ── */}
        <div className="premium-pill-group" style={{ marginTop: 8 }}>
          <button className={`premium-pill-button ${tab === TAB.DASHBOARD ? "active" : ""}`} onClick={() => setTab(TAB.DASHBOARD)}>Learning Loop</button>
          <button className={`premium-pill-button ${tab === TAB.TODAY ? "active" : ""}`} onClick={() => setTab(TAB.TODAY)}>Today</button>
          <button className={`premium-pill-button ${tab === TAB.WEEK ? "active" : ""}`} onClick={() => setTab(TAB.WEEK)}>Last 7 Days</button>
          <button className={`premium-pill-button ${tab === TAB.MONTH ? "active" : ""}`} onClick={() => setTab(TAB.MONTH)}>This Month</button>
          <button className={`premium-pill-button ${tab === TAB.SUGGEST ? "active" : ""}`} onClick={() => setTab(TAB.SUGGEST)}>📌 Suggest</button>
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
      <div className="premium-container" style={{ paddingTop: 0 }}>
        {tab === TAB.DASHBOARD && <DashboardPanel />}
        {tab === TAB.TODAY   && <DailyPanel date={date} onDateChange={setDate} />}
        {tab === TAB.WEEK    && <WeeklyPanel endDate={todayKey()} />}
        {tab === TAB.MONTH   && <MonthlyPanel month={month} />}
        {tab === TAB.SUGGEST && <SuggestionsPanel />}
      </div>
    </div>
  );
}
