// src/pages/ReportsPage.jsx
// MentorOS Learning Loop Report — premium Apple-style, dark/light aware.
// Preserves existing report APIs and suggestion workflow.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const TAB = {
  DASHBOARD: "dashboard",
  TODAY: "today",
  WEEK: "week",
  MONTH: "month",
  SUGGEST: "suggest",
};

function detectTheme() {
  const html = document.documentElement;
  const body = document.body;

  const explicit = (
    html.getAttribute("data-theme") ||
    body?.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    localStorage.getItem("mentor-theme") ||
    ""
  ).toLowerCase();

  if (explicit.includes("dark")) return "dark";
  if (explicit.includes("light")) return "light";
  if (html.classList.contains("dark") || body?.classList.contains("dark")) return "dark";

  try {
    const bg = getComputedStyle(body).backgroundColor;
    const nums = bg.match(/\d+/g)?.map(Number);
    if (nums?.length >= 3) {
      const luminance = (nums[0] * 299 + nums[1] * 587 + nums[2] * 114) / 1000;
      return luminance < 120 ? "dark" : "light";
    }
  } catch (_) {}

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useMentorTheme() {
  const [mode, setMode] = useState(() => detectTheme());

  useEffect(() => {
    const update = () => setMode(detectTheme());
    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }

    window.addEventListener("storage", update);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
      media?.removeEventListener?.("change", update);
    };
  }, []);

  return mode;
}

function palette(mode) {
  const dark = mode === "dark";
  return {
    dark,
    bg: dark ? "#05070A" : "#F5F7FB",
    surface: dark ? "#0D1117" : "#FFFFFF",
    surface2: dark ? "#121923" : "#F8FAFC",
    surface3: dark ? "#17212E" : "#EEF3F8",
    border: dark ? "#202A36" : "#E3E9F1",
    borderStrong: dark ? "#2C3949" : "#D7E0EA",
    text: dark ? "#F8FAFC" : "#0F172A",
    text2: dark ? "#D5DCE6" : "#344054",
    muted: dark ? "#95A1B3" : "#667085",
    faint: dark ? "#627084" : "#98A2B3",
    blue: "#0A64F5",
    green: "#16B364",
    amber: "#D99100",
    red: "#EF4D56",
    violet: "#8B5CF6",
    blueSoft: dark ? "rgba(10,100,245,.14)" : "rgba(10,100,245,.075)",
    greenSoft: dark ? "rgba(22,179,100,.12)" : "#ECFDF3",
    amberSoft: dark ? "rgba(217,145,0,.12)" : "#FFF7E7",
    redSoft: dark ? "rgba(239,77,86,.12)" : "#FFF1F2",
    violetSoft: dark ? "rgba(139,92,246,.12)" : "#F5F3FF",
    shadow: dark ? "none" : "0 10px 28px rgba(15,23,42,.055)",
    shadowStrong: dark ? "none" : "0 20px 48px rgba(15,23,42,.075)",
  };
}

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

function cardStyle(P, extra = {}) {
  return {
    background: P.surface,
    border: `1px solid ${P.border}`,
    borderRadius: 18,
    boxShadow: P.shadow,
    ...extra,
  };
}

function Pill({ P, active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? P.blue : P.border}`,
        background: active ? P.blueSoft : "transparent",
        color: active ? P.text : P.muted,
        borderRadius: 11,
        padding: "10px 14px",
        fontFamily: FONT_STACK,
        fontSize: 11.5,
        fontWeight: active ? 800 : 700,
        cursor: "pointer",
        transition: ".18s ease",
      }}
    >
      {children}
    </button>
  );
}

function Badge({ P, tone = "neutral", children }) {
  const tones = {
    neutral: { bg: P.surface3, color: P.muted, border: P.border },
    blue: { bg: P.blueSoft, color: P.blue, border: `${P.blue}33` },
    green: { bg: P.greenSoft, color: P.green, border: `${P.green}33` },
    amber: { bg: P.amberSoft, color: P.amber, border: `${P.amber}33` },
    red: { bg: P.redSoft, color: P.red, border: `${P.red}33` },
    violet: { bg: P.violetSoft, color: P.violet, border: `${P.violet}33` },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 760,
        lineHeight: 1,
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {children}
    </span>
  );
}

function Spinner({ P, label = "Loading report data…" }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: P.muted }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `3px solid ${P.border}`,
          borderTopColor: P.blue,
          margin: "0 auto 12px",
          animation: "mentorReportSpin .8s linear infinite",
        }}
      />
      {label}
    </div>
  );
}

function ErrorMsg({ P, msg, onRetry }) {
  return (
    <div
      style={{
        ...cardStyle(P, {
          padding: "16px 18px",
          borderColor: `${P.red}44`,
          background: P.redSoft,
          color: P.red,
        }),
      }}
    >
      Error: {msg}
      <button
        onClick={onRetry}
        style={{
          marginLeft: 10,
          border: "none",
          background: "transparent",
          color: P.blue,
          fontFamily: FONT_STACK,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ P, message, icon = "◎" }) {
  return (
    <div
      style={{
        ...cardStyle(P, {
          padding: "48px 20px",
          borderStyle: "dashed",
          textAlign: "center",
          background: P.surface,
        }),
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 10, color: P.faint }}>{icon}</div>
      <div style={{ color: P.muted, fontSize: 13.5 }}>{message}</div>
    </div>
  );
}

function SectionHeader({ P, title, sub, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <div>
        <div style={{ color: P.text, fontSize: 14, fontWeight: 820 }}>{title}</div>
        {sub ? <div style={{ color: P.faint, fontSize: 10.5, marginTop: 3 }}>{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

function StatCard({ P, label, value, sub, accent }) {
  return (
    <div
      style={{
        ...cardStyle(P, {
          padding: "18px 18px 16px",
          position: "relative",
          overflow: "hidden",
        }),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          height: 3,
          background: accent,
        }}
      />
      <div style={{ color: P.text, fontSize: 15, fontWeight: 780, minHeight: 18 }}>{label}</div>
      <div style={{ color: value === "—" ? P.muted : P.text, fontSize: 32, fontWeight: 860, letterSpacing: "-.04em", marginTop: 10 }}>
        {value}
      </div>
      {sub ? <div style={{ color: P.muted, fontSize: 12, marginTop: 6 }}>{sub}</div> : null}
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: P.surface3,
          marginTop: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", background: accent, opacity: 0.25 }} />
      </div>
    </div>
  );
}

function Ring({ P, score, tone = "blue", label = "" }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(score || 0)));
  const filled = (pct / 100) * circumference;
  const color =
    tone === "green"
      ? P.green
      : tone === "red"
        ? P.red
        : tone === "amber"
          ? P.amber
          : tone === "violet"
            ? P.violet
            : P.blue;

  return (
    <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
      <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="46" cy="46" r={radius} fill="none" stroke={P.surface3} strokeWidth="8" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ color, fontSize: 28, fontWeight: 850, lineHeight: 1 }}>{pct}%</div>
          {label ? <div style={{ color: P.faint, fontSize: 10.5, marginTop: 2 }}>{label}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ P, value, max = 10, color }) {
  const pct = Math.min(100, ((Number(value || 0) / Math.max(1, max)) * 100));
  return (
    <div style={{ height: 7, background: P.surface3, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function DayBar({ P, day }) {
  const maxH = 84;
  const actualMin = Math.floor(Number(day.actual_seconds || 0) / 60);
  const plannedMin = Number(day.planned_minutes || 0);
  const height = plannedMin > 0 ? Math.min((actualMin / Math.max(plannedMin, 1)) * maxH, maxH) : actualMin > 0 ? 22 : 4;
  const dayLabel = new Date(`${day.day_key}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
  const isToday = day.day_key === todayKey();

  const color =
    Number(day.completed_blocks) > 0
      ? P.green
      : Number(day.started_blocks) > 0
        ? P.amber
        : P.surface3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", flex: 1 }}>
      <div style={{ color: P.faint, fontSize: 10, minHeight: 12 }}>{actualMin > 0 ? secsToDisplay(day.actual_seconds) : ""}</div>
      <div style={{ width: "100%", height: maxH, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <div
          style={{
            width: "64%",
            height: Math.max(height, 3),
            borderRadius: "8px 8px 2px 2px",
            background: color,
          }}
        />
      </div>
      <div style={{ color: isToday ? P.blue : P.faint, fontWeight: isToday ? 800 : 600, fontSize: 10.5 }}>{dayLabel}</div>
    </div>
  );
}

function SubjectBar({ P, subject, actualSeconds, ratio, plannedMinutes, idx = 0 }) {
  const palette = [P.blue, P.green, P.amber, P.violet, P.red, "#14B8A6", "#EC4899"];
  const color = palette[idx % palette.length];
  const pct = Math.min(100, Number(ratio || 0));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ color: P.text2, fontSize: 12.5, fontWeight: 730 }}>{subject}</div>
        <div style={{ color: P.muted, fontSize: 11 }}>
          {secsToDisplay(actualSeconds)}
          {plannedMinutes ? <span style={{ color: P.faint }}> / {plannedMinutes}m</span> : null}
        </div>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: P.surface3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const asArray = (val) => (Array.isArray(val) ? val : []);

function BlockList({ P, blocks, title = "Study Sessions" }) {
  const [expanded, setExpanded] = useState(false);
  const safeBlocks = asArray(blocks);
  if (!safeBlocks.length) return null;

  const shown = expanded ? safeBlocks : safeBlocks.slice(0, 8);

  return (
    <div style={{ marginTop: 4 }}>
      <SectionHeader P={P} title={`${title} (${safeBlocks.length})`} />
      <div style={{ display: "grid", gap: 8 }}>
        {shown.map((b, i) => {
          const status = String(b?.status || "").toLowerCase();
          const dot =
            status === "completed"
              ? P.green
              : status === "partial"
                ? P.amber
                : status === "missed"
                  ? P.red
                  : status === "active"
                    ? P.blue
                    : P.faint;

          return (
            <div
              key={b?.id || i}
              style={{
                background: P.surface2,
                border: `1px solid ${P.border}`,
                borderRadius: 14,
                padding: "12px 14px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: dot, marginTop: 5, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ color: P.text, fontSize: 13, fontWeight: 760, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b?.subject}{b?.topic ? ` — ${b.topic}` : ""}
                  </div>
                  <div style={{ color: P.green, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {secsToDisplay(b?.actualSeconds ?? b?.actual_seconds ?? 0)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {b?.stage ? <Badge P={P}>{String(b.stage).toUpperCase()}</Badge> : null}
                  {b?.status ? <Badge P={P} tone={status === "completed" ? "green" : status === "missed" ? "red" : status === "partial" ? "amber" : "blue"}>{b.status}</Badge> : null}
                  {b?.dayKey ? <Badge P={P}>{b.dayKey}</Badge> : null}
                  {(b?.plannedMinutes ?? b?.planned_minutes ?? 0) > 0 ? <Badge P={P}>{b.plannedMinutes ?? b.planned_minutes}m planned</Badge> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {safeBlocks.length > 8 ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 10,
            width: "100%",
            border: `1px solid ${P.borderStrong}`,
            background: "transparent",
            color: P.text2,
            borderRadius: 12,
            padding: "10px 12px",
            fontFamily: FONT_STACK,
            fontWeight: 760,
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : `Show ${safeBlocks.length - 8} more`}
        </button>
      ) : null}
    </div>
  );
}

function DashboardPanel({ P }) {
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

  if (loading) return <Spinner P={P} />;
  if (error) return <ErrorMsg P={P} msg={error} onRetry={load} />;
  if (!report) return null;

  const execution = report?.execution ?? {};
  const answers = report?.answers ?? {};
  const mistakes = report?.mistakes ?? {};
  const revisions = report?.revisions ?? {};

  const answerTrend = asArray(answers?.trend);
  const latestAttempts = asArray(answers?.latestAttempts);
  const topWeakPapers = asArray(mistakes?.topWeakPapers);
  const topWeakAreas = asArray(mistakes?.topWeakAreas);

  const executionRate = Number(execution?.executionRate ?? 0);
  const plannedBlocks = Number(execution?.plannedBlocks ?? 0);
  const completedBlocks = Number(execution?.completedBlocks ?? 0);
  const totalCompletedHours = Number(execution?.totalCompletedHours ?? 0);
  const totalPlannedHours = Number(execution?.totalPlannedHours ?? 0);
  const missedBlocks = Number(execution?.missedBlocks ?? 0);

  const totalWritten = Number(answers?.totalWritten ?? 0);
  const averageScore = answers?.averageScore ?? "—";
  const totalOpenMistakes = Number(mistakes?.totalOpen ?? 0);
  const totalResolvedMistakes = Number(mistakes?.totalResolved ?? 0);

  const revisionCompletionRate = Number(revisions?.completionRate ?? 0);
  const revisionsCompleted = Number(revisions?.completed ?? 0);
  const revisionsOverdue = Number(revisions?.overdue ?? 0);
  const revisionsDueToday = Number(revisions?.dueToday ?? 0);
  const revisionsMustRevisePending = Number(revisions?.mustRevisePending ?? 0);

  const hasData =
    plannedBlocks > 0 ||
    totalWritten > 0 ||
    totalOpenMistakes > 0 ||
    revisionsCompleted > 0 ||
    revisionsDueToday > 0;

  const answerScore = totalWritten > 0 ? `${averageScore}/10` : "—";
  const verdictTitle =
    executionRate < 60 ? "This week's bottleneck is execution." :
    revisionCompletionRate < 50 ? "This week's bottleneck is revision follow-through." :
    totalWritten === 0 ? "Answer-writing exposure is currently low." :
    "Learning loop is reasonably stable.";

  const verdictBody =
    executionRate < 60
      ? `Complete planned blocks before adding new study targets. Current execution rate is ${executionRate}%.`
      : revisionCompletionRate < 50
        ? `Evaluation is generating work, but revision completion is still only ${revisionCompletionRate}%.`
        : totalWritten === 0
          ? "No evaluated answers are available in this period. Write one answer to activate answer-quality trends."
          : "Execution, answer writing and revision are all feeding the learning loop with fewer visible leaks.";

  const execTone = executionRate >= 70 ? "green" : executionRate >= 40 ? "amber" : "red";
  const mistakeTone = totalOpenMistakes > 0 ? "red" : "green";
  const revisionTone = revisionsOverdue > 0 ? "red" : "violet";

  return (
    <div>
      <div
        style={{
          ...cardStyle(P, {
            padding: "14px 18px",
            marginBottom: 18,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }),
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" },
          ].map((r) => (
            <Pill key={r.id} P={P} active={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </Pill>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: P.faint, fontSize: 11.5, fontWeight: 700 }}>Paper:</span>
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
            style={{
              background: P.surface2,
              border: `1px solid ${P.border}`,
              borderRadius: 10,
              color: P.text,
              padding: "10px 12px",
              fontFamily: FONT_STACK,
              fontWeight: 760,
              fontSize: 11.5,
              outline: "none",
              minWidth: 170,
            }}
          >
            <option value="all">All Papers</option>
            <option value="GS1">GS1</option>
            <option value="GS2">GS2</option>
            <option value="GS3">GS3</option>
            <option value="Ethics">Ethics</option>
            <option value="Essay">Essay</option>
            <option value="Geography Optional">Geography Optional</option>
          </select>
        </div>
      </div>

      {hasData ? (
        <>
          <div
            style={{
              ...cardStyle(P, {
                padding: "20px 22px",
                marginBottom: 18,
                borderColor: `${P.amber}50`,
                background: P.dark
                  ? "linear-gradient(135deg, rgba(217,145,0,.15), rgba(255,255,255,0))"
                  : "linear-gradient(135deg, rgba(217,145,0,.09), rgba(255,255,255,.8))",
              }),
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr) 180px", gap: 16, alignItems: "center" }} className="mentor-hero-grid">
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: "50%",
                  border: `1px solid ${P.amber}55`,
                  background: P.dark ? "rgba(217,145,0,.10)" : "rgba(217,145,0,.08)",
                  display: "grid",
                  placeItems: "center",
                  color: P.amber,
                  fontSize: 28,
                }}
              >
                ⚡
              </div>

              <div>
                <div style={{ color: P.amber, fontSize: 10.5, fontWeight: 840, textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Mentor Verdict
                </div>
                <div style={{ color: P.text, fontSize: 20, fontWeight: 840, letterSpacing: "-.03em", marginTop: 5 }}>
                  {verdictTitle}
                </div>
                <div style={{ color: P.text2, fontSize: 13.5, lineHeight: 1.55, marginTop: 6 }}>
                  {verdictBody}
                </div>
              </div>

              <div style={{ borderLeft: `1px solid ${P.border}`, paddingLeft: 16 }} className="mentor-hero-side">
                <div style={{ color: P.faint, fontSize: 12 }}>Small consistent steps unlock big results.</div>
              </div>
            </div>
          </div>

          <div className="mentor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
            <StatCard P={P} label="Execution rate" value={`${executionRate}%`} sub={`${completedBlocks}/${plannedBlocks} blocks`} accent={execTone === "green" ? P.green : execTone === "amber" ? P.amber : P.red} />
            <StatCard P={P} label="Completed study hours" value={`${totalCompletedHours}h`} sub={`${totalPlannedHours}h planned`} accent={P.blue} />
            <StatCard P={P} label="Average answer score" value={answerScore} sub={`${totalWritten} answers`} accent={P.amber} />
            <StatCard P={P} label="Open mistake count" value={`${totalOpenMistakes}`} sub={`${totalResolvedMistakes} resolved`} accent={mistakeTone === "green" ? P.green : P.red} />
            <StatCard P={P} label="Overdue revisions" value={`${revisionsDueToday}`} sub={`${revisionsOverdue} overdue`} accent={revisionTone === "red" ? P.red : P.violet} />
          </div>

          <div className="mentor-reports-main-grid" style={{ display: "grid", gridTemplateColumns: "1.08fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(P, { padding: "18px 18px 16px" }) }}>
                <SectionHeader
                  P={P}
                  title="Execution Health"
                  sub="Your planned vs actual study execution."
                  action={<Badge P={P} tone="blue">{range === "today" ? "Today" : range === "month" ? "This Month" : range === "all" ? "All Time" : "This Week"}</Badge>}
                />
                <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 20, alignItems: "center" }}>
                  <Ring P={P} score={executionRate} tone={execTone} label={executionRate >= 70 ? "On Track" : executionRate >= 40 ? "Needs Push" : "At Risk"} />
                  <div>
                    {[
                      ["Blocks Completed", completedBlocks, P.green],
                      ["Blocks Missed", missedBlocks, P.red],
                      ["Planned Study Hours", `${totalPlannedHours}h`, P.muted],
                      ["Completed Hours", `${totalCompletedHours}h`, P.blue],
                    ].map(([label, value, color], i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 10, alignItems: "center" }}>
                        <div style={{ color: P.text2, fontSize: 12.5 }}>{label}</div>
                        <div style={{ color, fontWeight: 800, fontSize: 12.5 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    background: P.surface2,
                    border: `1px solid ${P.border}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    color: P.text2,
                    fontSize: 12.5,
                  }}
                >
                  Focus on completing planned blocks to build momentum.
                </div>
              </div>

              <div style={{ ...cardStyle(P, { padding: "18px 18px 14px" }) }}>
                <SectionHeader P={P} title="Mistake Trend" sub="New mistakes vs resolved (recent trend)." />
                {answerTrend.length ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: P.faint, fontSize: 11, marginBottom: 10 }}>
                      <span>Recent answer score trend</span>
                      <div style={{ display: "flex", gap: 14 }}>
                        <span style={{ color: P.red }}>● New Mistakes</span>
                        <span style={{ color: P.green }}>● Resolved</span>
                      </div>
                    </div>
                    <div style={{ height: 170, padding: "10px 6px 0", display: "grid", gridTemplateRows: "1fr 20px" }}>
                      <div style={{ position: "relative", borderTop: `1px solid ${P.border}`, borderBottom: `1px solid ${P.border}` }}>
                        {[0,1,2,3,4].map((l) => (
                          <div key={l} style={{ position: "absolute", left: 0, right: 0, top: `${l*25}%`, borderTop: `1px solid ${P.border}`, opacity: l===0 ? 0 : 1 }} />
                        ))}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
                          {answerTrend.slice(-7).map((t, idx) => {
                            const v = Number(t?.avg_score ?? t?.avgScore ?? 0);
                            return (
                              <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                <div style={{ display: "flex", gap: 6, width: "100%", justifyContent: "center", alignItems: "flex-end", height: 120 }}>
                                  <div style={{ width: 10, height: `${Math.max(4, v * 11)}px`, background: P.amber, borderRadius: 999 }} />
                                  <div style={{ width: 10, height: `${Math.max(4, Math.min(50, totalOpenMistakes * 3))}px`, background: P.red, borderRadius: 999, opacity: .6 }} />
                                  <div style={{ width: 10, height: `${Math.max(4, Math.min(50, totalResolvedMistakes * 3))}px`, background: P.green, borderRadius: 999, opacity: .7 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: P.faint, fontSize: 10.5, paddingTop: 8 }}>
                        {answerTrend.slice(-7).map((t, idx) => (
                          <div key={idx}>{String(t?.date || "").slice(5)}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState P={P} message="No evaluated answers in this period. Write one answer to activate score trends." icon="▤" />
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
                <SectionHeader
                  P={P}
                  title="Revision Health"
                  sub="Track your revision completion and pending work."
                  action={<Badge P={P} tone="blue">{range === "today" ? "Today" : range === "month" ? "This Month" : range === "all" ? "All Time" : "This Week"}</Badge>}
                />
                <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 20, alignItems: "center" }}>
                  <Ring P={P} score={revisionCompletionRate} tone={revisionCompletionRate >= 70 ? "green" : revisionCompletionRate >= 40 ? "amber" : "red"} label="Revisions Done" />
                  <div>
                    {[
                      ["Completed", revisionsCompleted, P.green],
                      ["Overdue", revisionsOverdue, P.red],
                      ["Must Revise Pending", revisionsMustRevisePending, P.violet],
                    ].map(([label, value, color], i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 12, alignItems: "center" }}>
                        <div style={{ color: P.text2, fontSize: 12.5 }}>{label}</div>
                        <div style={{ color, fontWeight: 800, fontSize: 12.5 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 16, background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 14, padding: "12px 14px", color: P.text2, fontSize: 12.5 }}>
                  Keep up with timely revisions to strengthen retention.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mentor-small-grid">
                <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
                  <SectionHeader P={P} title="Weakness by Paper" sub="Papers with the most open mistakes." />
                  {topWeakPapers.length ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      {topWeakPapers.map((wp, idx) => (
                        <div key={idx}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 6 }}>
                            <div style={{ color: P.text2, fontSize: 12.5, fontWeight: 730 }}>{wp.paper}</div>
                            <div style={{ color: P.red, fontWeight: 800, fontSize: 11.5 }}>{wp.count} open</div>
                          </div>
                          <MiniBar P={P} value={wp.count} max={10} color={P.red} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState P={P} message="No open mistakes recorded yet." icon="⌁" />
                  )}
                </div>

                <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
                  <SectionHeader P={P} title="Top 5 Must Fix Areas" sub="Based on open mistakes and weak performance." />
                  {topWeakAreas.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {topWeakAreas.map((wa, idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, paddingBottom: 8, borderBottom: idx !== topWeakAreas.length - 1 ? `1px solid ${P.border}` : "none" }}>
                          <div style={{ color: P.text2, fontSize: 12.5 }}>{wa.area}</div>
                          <div style={{ color: P.amber, fontWeight: 800, fontSize: 11.5 }}>{wa.count} errors</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState P={P} message="No weak areas identified yet." icon="⌘" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState P={P} message="No evaluated answers or loop data in this period. Continue execution and answer writing to activate insights." icon="▣" />
      )}
    </div>
  );
}

function DailyPanel({ P, date, onDateChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchReport("daily", { date }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner P={P} />;
  if (error) return <ErrorMsg P={P} msg={error} onRetry={load} />;
  if (!report) return null;

  const totalSeconds = Number(report?.totalSeconds ?? report?.totalStudySeconds ?? 0);
  const plannedMinutes = Number(report?.plannedMinutes ?? report?.totalPlannedMinutes ?? 0);
  const ratio = Number(
    report?.ratio ??
    report?.completionRate ??
    (plannedMinutes > 0 ? Math.round((Math.floor(totalSeconds / 60) / plannedMinutes) * 100) : 0)
  );
  const streak = Number(report?.streak ?? report?.streakCount ?? 0);
  const safeBlocks = asArray(report?.blocks || report?.studiedBlocks);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          style={{
            background: P.surface2,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            color: P.text,
            padding: "10px 12px",
            fontFamily: FONT_STACK,
            fontWeight: 760,
            fontSize: 12,
            outline: "none",
          }}
        />
        {streak > 0 ? <Badge P={P} tone="amber">🔥 {streak} day streak</Badge> : null}
      </div>

      <div className="mentor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
        <StatCard P={P} label="Study Time" value={secsToDisplay(totalSeconds)} sub={plannedMinutes ? `${plannedMinutes}m planned` : "No plan set"} accent={P.blue} />
        <StatCard P={P} label="Execution Rate" value={`${ratio}%`} sub={plannedMinutes ? "Based on planned time" : "—"} accent={P.green} />
        <StatCard P={P} label="Completed Blocks" value={`${safeBlocks.filter((b) => b?.status === "completed").length}`} sub={`${safeBlocks.length} sessions total`} accent={P.amber} />
      </div>

      <div style={{ marginTop: 18 }}>
        {safeBlocks.length ? <BlockList P={P} blocks={safeBlocks} title="Day Study Sessions" /> : <EmptyState P={P} message="No study blocks scheduled or studied for this day." />}
      </div>
    </div>
  );
}

function WeeklyPanel({ P, endDate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchReport("weekly", { endDate }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner P={P} />;
  if (error) return <ErrorMsg P={P} msg={error} onRetry={load} />;
  if (!report) return null;

  const totalSeconds = Number(report?.totalSeconds ?? report?.totalStudySeconds ?? 0);
  const plannedMinutes = Number(report?.plannedMinutes ?? report?.totalPlannedMinutes ?? 0);
  const ratio = Number(
    report?.ratio ??
    report?.completionRate ??
    report?.consistencyScore ??
    (plannedMinutes > 0 ? Math.round((Math.floor(totalSeconds / 60) / plannedMinutes) * 100) : 0)
  );
  const safeDays = asArray(report?.days || report?.dayWiseBreakdown);
  const safeSubjects = asArray(report?.subjectBreakdown || report?.subjectWiseSplit);
  const safeBlocks = asArray(report?.blocks || report?.studiedBlocks);

  return (
    <div>
      <div className="mentor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard P={P} label="Weekly Time" value={secsToDisplay(totalSeconds)} sub={`${Math.round((plannedMinutes || 0) / 60)}h planned`} accent={P.blue} />
        <StatCard P={P} label="Execution Rate" value={`${ratio}%`} sub="Weekly planned time met" accent={P.green} />
        <StatCard P={P} label="Active Days" value={`${safeDays.filter((d) => Number(d?.actual_seconds ?? d?.actualSeconds ?? 0) > 0).length}`} sub="Out of 7 days" accent={P.amber} />
      </div>

      <div style={{ ...cardStyle(P, { padding: "18px", marginBottom: 18 }) }}>
        <SectionHeader P={P} title="Daily Consistency" sub="Last 7 days execution rhythm." />
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
          {safeDays.map((day, idx) => <DayBar key={day?.day_key || day?.dayKey || idx} P={P} day={day} />)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mentor-two-col">
        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <SectionHeader P={P} title="Subject Distribution" sub="How study time was distributed." />
          {safeSubjects.length ? (
            safeSubjects.map((sb, idx) => (
              <SubjectBar
                key={sb?.subject || idx}
                P={P}
                idx={idx}
                subject={sb?.subject}
                actualSeconds={sb?.actualSeconds ?? sb?.actual_seconds ?? 0}
                ratio={sb?.ratio ?? sb?.percentage ?? 0}
                plannedMinutes={sb?.plannedMinutes ?? sb?.planned_minutes ?? 0}
              />
            ))
          ) : (
            <EmptyState P={P} message="No subject distribution data." icon="◌" />
          )}
        </div>

        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <BlockList P={P} blocks={safeBlocks} title="Weekly Study Sessions" />
        </div>
      </div>
    </div>
  );
}

function MonthlyPanel({ P, month }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchReport("monthly", { month }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner P={P} />;
  if (error) return <ErrorMsg P={P} msg={error} onRetry={load} />;
  if (!report) return null;

  const totalSeconds = Number(report?.totalSeconds ?? report?.totalStudySeconds ?? 0);
  const plannedMinutes = Number(report?.plannedMinutes ?? report?.totalPlannedMinutes ?? 0);
  const ratio = Number(
    report?.ratio ??
    report?.completionRate ??
    (plannedMinutes > 0 ? Math.round((Math.floor(totalSeconds / 60) / plannedMinutes) * 100) : 0)
  );
  const safeSubjects = asArray(report?.subjectBreakdown || report?.subjectWiseSplit);
  const safeBlocks = asArray(report?.blocks || report?.studiedBlocks);

  return (
    <div>
      <div className="mentor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard P={P} label="Monthly Time" value={secsToDisplay(totalSeconds)} sub={`${Math.round((plannedMinutes || 0) / 60)}h planned`} accent={P.blue} />
        <StatCard P={P} label="Execution Rate" value={`${ratio}%`} sub="Monthly target met" accent={P.green} />
        <StatCard P={P} label="Completed Sessions" value={`${safeBlocks.filter((b) => b?.status === "completed").length}`} sub={`${safeBlocks.length} sessions total`} accent={P.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mentor-two-col">
        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <SectionHeader P={P} title="Subject Distribution" sub="Time spread across subjects." />
          {safeSubjects.length ? (
            safeSubjects.map((sb, idx) => (
              <SubjectBar
                key={sb?.subject || idx}
                P={P}
                idx={idx}
                subject={sb?.subject}
                actualSeconds={sb?.actualSeconds ?? sb?.actual_seconds ?? 0}
                ratio={sb?.ratio ?? sb?.percentage ?? 0}
                plannedMinutes={sb?.plannedMinutes ?? sb?.planned_minutes ?? 0}
              />
            ))
          ) : (
            <EmptyState P={P} message="No distribution data." icon="◌" />
          )}
        </div>

        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <BlockList P={P} blocks={safeBlocks} title="Monthly Study Sessions" />
        </div>
      </div>
    </div>
  );
}

function SuggestionsPanel({ P }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchSuggestions());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner P={P} label="Generating suggestions…" />;
  if (error) return <ErrorMsg P={P} msg={error} onRetry={load} />;
  if (!data) return null;

  const recommendedBlocks = asArray(data?.recommendedBlocks);
  const priority = String(data?.priority || "MEDIUM");
  const confidence = Number(data?.confidence || 0);
  const strategy = String(data?.strategy || "");
  const context = data?.context ?? {};
  const weakSubjects = asArray(data?.weakSubjects);
  const missedBlocks = asArray(data?.missedBlocks);
  const basePeriod = data?.basePeriod ?? {};
  const _cached = Boolean(data?._cached);

  const priorityTone = priority === "HIGH" ? "red" : priority === "LOW" ? "green" : "amber";
  const priorityColor = priorityTone === "red" ? P.red : priorityTone === "green" ? P.green : P.amber;

  return (
    <div>
      <div
        style={{
          ...cardStyle(P, {
            padding: "18px 20px",
            marginBottom: 18,
            borderColor: `${priorityColor}44`,
            background: priorityTone === "red" ? P.redSoft : priorityTone === "green" ? P.greenSoft : P.amberSoft,
          }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge P={P} tone={priorityTone}>{priority} PRIORITY</Badge>
          <div style={{ color: P.faint, fontSize: 11.5, fontWeight: 700 }}>
            Confidence: <span style={{ color: priorityColor }}>{confidence}%</span>
          </div>
          <div style={{ marginLeft: "auto", color: P.faint, fontSize: 11 }}>
            {basePeriod?.start} → {basePeriod?.end} {_cached ? "[cached]" : ""}
          </div>
        </div>
        <div style={{ color: P.text, fontSize: 14, fontWeight: 760, marginBottom: 6 }}>Mentor Recommendation</div>
        <div style={{ color: P.text2, fontSize: 13.5, lineHeight: 1.6 }}>{strategy || "No recommendation message available."}</div>
      </div>

      <div className="mentor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard P={P} label="Study Days" value={`${context?.studyDays || 0}/7`} sub="Days with meaningful study" accent={P.blue} />
        <StatCard P={P} label="Total Studied" value={context?.totalStudyDisplay || "0h"} sub="Observed in base period" accent={P.green} />
        <StatCard P={P} label="vs Planned" value={context?.performanceGapDisplay || "—"} sub="Performance gap" accent={(context?.performanceGap || 0) >= 0 ? P.green : P.red} />
        <StatCard P={P} label="Missed" value={`${context?.missedBlocks || 0} sessions`} sub="Unfinished / missed" accent={(context?.missedBlocks || 0) > 2 ? P.red : P.amber} />
        <StatCard P={P} label="Weak Areas" value={`${context?.weakSubjectsCount || 0} subjects`} sub="Detected weak spots" accent={P.amber} />
      </div>

      {recommendedBlocks.length ? (
        <div style={{ marginBottom: 18 }}>
          <SectionHeader P={P} title="Suggested for You" sub="Generated based on recent execution and weak areas." />
          <div style={{ display: "grid", gap: 10 }}>
            {recommendedBlocks.map((b, i) => (
              <div
                key={i}
                style={{
                  ...cardStyle(P, {
                    padding: "16px 18px",
                    borderColor: i === 0 ? `${priorityColor}55` : P.border,
                  }),
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: i === 0 ? (priorityTone === "red" ? P.redSoft : priorityTone === "green" ? P.greenSoft : P.amberSoft) : P.surface3,
                      color: i === 0 ? priorityColor : P.faint,
                      border: `1px solid ${i === 0 ? priorityColor + "33" : P.border}`,
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ color: P.text, fontSize: 13.5, fontWeight: 800 }}>
                        {b?.subject}{b?.topic ? ` — ${b.topic}` : ""}
                      </div>
                      <Badge P={P} tone={b?.type === "NEW" ? "green" : b?.type === "PRACTICE" ? "violet" : "blue"}>{b?.type || "REVISION"}</Badge>
                    </div>
                    <div style={{ color: P.text2, fontSize: 12.8, lineHeight: 1.55 }}>{b?.reason}</div>
                    <div style={{ marginTop: 8 }}>
                      <Badge P={P}>⏱ {b?.suggestedMinutes ?? b?.suggested_minutes ?? 0}m suggested</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState P={P} message="No specific suggestions right now — you're on track." icon="✓" />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mentor-two-col">
        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <SectionHeader P={P} title="Weak Areas Detected" sub="Subjects that need attention." />
          {weakSubjects.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {weakSubjects.map((w, i) => (
                <div key={i} style={{ background: P.amberSoft, border: `1px solid ${P.amber}33`, borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ color: P.amber, fontWeight: 800, fontSize: 12.8 }}>{w?.subject}</div>
                  <div style={{ color: P.text2, fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{w?.reason}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState P={P} message="No weak areas detected." icon="◌" />
          )}
        </div>

        <div style={{ ...cardStyle(P, { padding: "18px" }) }}>
          <SectionHeader P={P} title={`Unfinished This Week (${missedBlocks.length})`} sub="Carry-over and missed work." />
          {missedBlocks.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {missedBlocks.slice(0, 8).map((b, i) => (
                <div key={i} style={{ background: P.redSoft, border: `1px solid ${P.red}22`, borderRadius: 14, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <div style={{ color: P.text2, fontSize: 12.8 }}>
                    <span style={{ color: P.text, fontWeight: 780 }}>{b?.subject}</span>
                    {b?.topic ? ` — ${b.topic}` : ""}
                  </div>
                  <div style={{ color: P.faint, fontSize: 11 }}>{b?.dayKey || b?.day_key}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState P={P} message="No unfinished work in the observed period." icon="✓" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState(TAB.DASHBOARD);
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(thisMonthKey());
  const mode = useMentorTheme();
  const P = useMemo(() => palette(mode), [mode]);

  return (
    <div
      style={{
        background: P.bg,
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ padding: "28px 26px 42px", boxSizing: "border-box" }}>
        <div style={{ color: P.blue, fontSize: 10, fontWeight: 840, letterSpacing: ".11em", textTransform: "uppercase" }}>
          MentorOS · Reports
        </div>

        <div className="mentor-header-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, alignItems: "start", marginTop: 12 }}>
          <div>
            <h1 style={{ margin: 0, color: P.text, fontSize: 54, lineHeight: .96, fontWeight: 880, letterSpacing: "-.055em" }}>
              Learning Loop Report
            </h1>
            <div style={{ color: P.muted, fontSize: 18, lineHeight: 1.5, marginTop: 14, maxWidth: 760 }}>
              Execution, revision, and answer-writing progress for this period.
            </div>
          </div>

          <div
            style={{
              ...cardStyle(P, {
                padding: "16px 18px",
                background: P.dark
                  ? "linear-gradient(135deg, rgba(10,100,245,.10), rgba(139,92,246,.08))"
                  : "linear-gradient(135deg, rgba(10,100,245,.06), rgba(139,92,246,.04))",
              }),
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: P.blueSoft, display: "grid", placeItems: "center", color: P.violet, fontSize: 24 }}>
                ✺
              </div>
              <div>
                <div style={{ color: P.text, fontSize: 14.5, fontWeight: 760, lineHeight: 1.5 }}>
                  Disciplined practice today, a stronger you tomorrow.
                </div>
                <div style={{ marginTop: 12, height: 34, position: "relative", overflow: "hidden" }}>
                  <svg viewBox="0 0 280 34" width="100%" height="34">
                    <path d="M0,26 C20,26 24,12 48,12 C72,12 84,28 108,28 C132,28 138,9 164,9 C190,9 198,22 220,22 C242,22 252,4 280,4" stroke={P.blue} strokeOpacity="0.65" strokeWidth="2" fill="none" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...cardStyle(P, {
              marginTop: 22,
              padding: "8px",
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 14,
              alignItems: "center",
            }),
          }}
          className="mentor-top-tabs"
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill P={P} active={tab === TAB.DASHBOARD} onClick={() => setTab(TAB.DASHBOARD)}>Learning Loop</Pill>
            <Pill P={P} active={tab === TAB.TODAY} onClick={() => setTab(TAB.TODAY)}>Today</Pill>
            <Pill P={P} active={tab === TAB.WEEK} onClick={() => setTab(TAB.WEEK)}>Last 7 Days</Pill>
            <Pill P={P} active={tab === TAB.MONTH} onClick={() => setTab(TAB.MONTH)}>This Month</Pill>
            <Pill P={P} active={tab === TAB.SUGGEST} onClick={() => setTab(TAB.SUGGEST)}>Suggest</Pill>
          </div>

          {tab === TAB.MONTH ? (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                background: P.surface2,
                border: `1px solid ${P.border}`,
                borderRadius: 10,
                color: P.text,
                padding: "10px 12px",
                fontFamily: FONT_STACK,
                fontWeight: 760,
                fontSize: 11.5,
                outline: "none",
              }}
            />
          ) : null}
        </div>

        <div style={{ marginTop: 18 }}>
          {tab === TAB.DASHBOARD && <DashboardPanel P={P} />}
          {tab === TAB.TODAY && <DailyPanel P={P} date={date} onDateChange={setDate} />}
          {tab === TAB.WEEK && <WeeklyPanel P={P} endDate={todayKey()} />}
          {tab === TAB.MONTH && <MonthlyPanel P={P} month={month} />}
          {tab === TAB.SUGGEST && <SuggestionsPanel P={P} />}
        </div>
      </div>

      <style>{`
        @keyframes mentorReportSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1280px) {
          .mentor-kpi-grid {
            grid-template-columns: repeat(3, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 1080px) {
          .mentor-header-grid,
          .mentor-top-tabs,
          .mentor-reports-main-grid,
          .mentor-two-col,
          .mentor-small-grid {
            grid-template-columns: 1fr !important;
          }

          .mentor-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .mentor-hero-side {
            border-left: none !important;
            border-top: 1px solid ${P.border} !important;
            padding-left: 0 !important;
            padding-top: 14px !important;
          }
        }

        @media (max-width: 840px) {
          .mentor-kpi-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .mentor-kpi-grid {
            grid-template-columns: 1fr !important;
          }

          .mentor-header-grid h1 {
            font-size: 40px !important;
          }
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible {
          outline: 2px solid ${P.blue};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
