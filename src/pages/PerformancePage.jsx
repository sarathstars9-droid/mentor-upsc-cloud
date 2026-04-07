// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useEffect, useRef } from "react";
import { fetchRealPerformanceData } from "../services/performanceService";
// ─────────────────────────────────────────────────────────────────────────────
// MOCK SEED  ←  replace getPerformanceDataSeed() with an API call later.
//              The shape of the returned object is the DATA contract.
// ─────────────────────────────────────────────────────────────────────────────

function getPerformanceDataSeed() {
  return {
    execution: {
      plannedHours: 9,
      actualHours: 6.5,
      deepWorkHours: 3.8,
      shallowWorkHours: 2.7,
      completedBlocks: 5,
      partialBlocks: 2,
      missedBlocks: 3,
      delayedStarts: 2,
      interruptions: 4,
      csatMinutes: 0,
      streakDays: 11,
      focusScore: 62,
      blockAdherence: 58,
    },

    subjects: [
      { id: "gs1", name: "GS1", score: 71, trend: +3, accuracy: 68, testCount: 4, revisionHealth: 72, topicCoverage: 61, status: "stable" },
      { id: "gs2", name: "GS2", score: 64, trend: -2, accuracy: 61, testCount: 3, revisionHealth: 55, topicCoverage: 54, status: "warning" },
      { id: "gs3", name: "GS3", score: 58, trend: -5, accuracy: 54, testCount: 5, revisionHealth: 48, topicCoverage: 49, status: "critical" },
      { id: "gs4", name: "GS4", score: 78, trend: +6, accuracy: 76, testCount: 2, revisionHealth: 80, topicCoverage: 70, status: "strong" },
      { id: "optional", name: "Optional", score: 82, trend: +2, accuracy: 80, testCount: 3, revisionHealth: 85, topicCoverage: 78, status: "strong" },
      { id: "essay", name: "Essay", score: 55, trend: -1, accuracy: 52, testCount: 2, revisionHealth: 50, topicCoverage: 40, status: "warning" },
      { id: "csat", name: "CSAT", score: 44, trend: -8, accuracy: 41, testCount: 1, revisionHealth: 30, topicCoverage: 35, status: "critical" },
    ],

    topics: [
      { id: 1, topicName: "Indian Economy – Growth Models", subject: "GS3", accuracy: 42, mistakes: 9, revisionHealth: 38, priorityScore: 91, trend: -4, lastStudiedDaysAgo: 9, status: "critical" },
      { id: 2, topicName: "Polity – Parliament Procedures", subject: "GS2", accuracy: 55, mistakes: 7, revisionHealth: 51, priorityScore: 84, trend: -2, lastStudiedDaysAgo: 6, status: "warning" },
      { id: 3, topicName: "Environment – Climate Agreements", subject: "GS3", accuracy: 48, mistakes: 8, revisionHealth: 44, priorityScore: 88, trend: -5, lastStudiedDaysAgo: 11, status: "critical" },
      { id: 4, topicName: "Medieval History – Bhakti Movement", subject: "GS1", accuracy: 74, mistakes: 3, revisionHealth: 78, priorityScore: 32, trend: +4, lastStudiedDaysAgo: 3, status: "strong" },
      { id: 5, topicName: "International Relations – ASEAN", subject: "GS2", accuracy: 60, mistakes: 5, revisionHealth: 58, priorityScore: 65, trend: 0, lastStudiedDaysAgo: 5, status: "stable" },
      { id: 6, topicName: "Ethics – Case Studies", subject: "GS4", accuracy: 76, mistakes: 2, revisionHealth: 82, priorityScore: 28, trend: +6, lastStudiedDaysAgo: 2, status: "strong" },
      { id: 7, topicName: "Geography – Monsoon Dynamics", subject: "GS1", accuracy: 63, mistakes: 6, revisionHealth: 60, priorityScore: 58, trend: +1, lastStudiedDaysAgo: 7, status: "stable" },
      { id: 8, topicName: "Science & Tech – Space Policy", subject: "GS3", accuracy: 52, mistakes: 7, revisionHealth: 49, priorityScore: 77, trend: -3, lastStudiedDaysAgo: 8, status: "warning" },
      { id: 9, topicName: "Social Issues – Poverty Metrics", subject: "GS2", accuracy: 58, mistakes: 6, revisionHealth: 53, priorityScore: 69, trend: -1, lastStudiedDaysAgo: 6, status: "warning" },
      { id: 10, topicName: "Ancient History – Mauryan Empire", subject: "GS1", accuracy: 80, mistakes: 2, revisionHealth: 84, priorityScore: 22, trend: +3, lastStudiedDaysAgo: 4, status: "strong" },
      { id: 11, topicName: "CSAT – Reading Comprehension", subject: "CSAT", accuracy: 41, mistakes: 11, revisionHealth: 28, priorityScore: 95, trend: -8, lastStudiedDaysAgo: 14, status: "critical" },
      { id: 12, topicName: "Agriculture – Food Security", subject: "GS3", accuracy: 50, mistakes: 8, revisionHealth: 46, priorityScore: 80, trend: -2, lastStudiedDaysAgo: 10, status: "warning" },
      { id: 13, topicName: "Essay – Philosophical Themes", subject: "Essay", accuracy: 54, mistakes: 5, revisionHealth: 50, priorityScore: 70, trend: -1, lastStudiedDaysAgo: 8, status: "warning" },
      { id: 14, topicName: "Governance – RTI & Transparency", subject: "GS2", accuracy: 67, mistakes: 4, revisionHealth: 64, priorityScore: 48, trend: +2, lastStudiedDaysAgo: 5, status: "stable" },
      { id: 15, topicName: "Disaster Management", subject: "GS3", accuracy: 45, mistakes: 9, revisionHealth: 40, priorityScore: 86, trend: -6, lastStudiedDaysAgo: 12, status: "critical" },
    ],

    revision: {
      dueToday: 8,
      overdue: 14,
      completedToday: 2,
      retentionScore: 54,
      revisionSuccessRate: 61,
      loopHealth: { one: 55, three: 62, seven: 48 },
    },

    mistakes: {
      conceptual: 28,
      silly: 14,
      guess: 19,
      repeat: 11,
      total: 72,
      illusionOfLearning: true,
      overconfidenceTrap: false,
      avoidanceBehavior: true,
    },

    csat: {
      todayMinutes: 0,
      last2DayTouched: false,
      weeklyMinutes: 35,
      status: "critical",
    },

    trends: {
      studyHours: [8.2, 7.5, 9.0, 6.0, 7.8, 8.5, 6.5],
      completion: [78, 71, 88, 55, 74, 81, 62],
      accuracy: [64, 62, 67, 60, 65, 63, 61],
      revision: [70, 68, 72, 60, 65, 66, 61],
      csat: [45, 30, 60, 0, 40, 55, 0],
    },

    mainAnswers: 6,
    testScoreThisWeek: 61,
    negativeMarksLost: 8,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function scoreStatus(v) {
  if (v >= 80) return "strong";
  if (v >= 60) return "stable";
  if (v >= 40) return "warning";
  return "critical";
}

function deriveMetrics(data) {
  const ex = data.execution;
  const total = ex.completedBlocks + ex.partialBlocks + ex.missedBlocks;

  const completionPct = Math.round((ex.completedBlocks / total) * 100);
  const executionScore = completionPct * 0.4 + (ex.actualHours / ex.plannedHours) * 100 * 0.3 + ex.blockAdherence * 0.3;
  const weakTopics = data.topics.filter(t => t.accuracy < 55).length;
  const subjectScoreAvg = data.subjects.reduce((acc, s) => acc + s.score, 0) / data.subjects.length;
  const academicScore = data.testScoreThisWeek * 0.4 + subjectScoreAvg * 0.35 + (100 - weakTopics * 5) * 0.25;
  const revisionScore = data.revision.retentionScore * 0.4 + data.revision.revisionSuccessRate * 0.3 + Math.max(0, 100 - data.revision.overdue * 3) * 0.3;
  const consistencyScore = Math.min(100, ex.streakDays * 4) * 0.5 + ex.focusScore * 0.5;
  const performanceScore = Math.round(executionScore * 0.3 + academicScore * 0.35 + revisionScore * 0.2 + consistencyScore * 0.15);

  const sortedByAccuracy = [...data.topics].sort((a, b) => a.accuracy - b.accuracy);
  const sortedSubjects = [...data.subjects].sort((a, b) => a.score - b.score);

  const weakestTopic = sortedByAccuracy[0];
  const weakestSubject = sortedSubjects[0];
  const strongestSubject = sortedSubjects[sortedSubjects.length - 1];

  const fatigueDetected = ex.interruptions >= 4 || ex.deepWorkHours < 4 || ex.actualHours < ex.plannedHours * 0.75;
  const csatCritical = !data.csat.last2DayTouched;

  const systemActions = [];
  systemActions.push({
    type: "escalate", title: "Escalated Topic",
    why: `Accuracy ${weakestTopic.accuracy}% · ${weakestTopic.mistakes} mistakes`,
    action: "90-min deep-work block tomorrow AM", urgency: "critical",
  });
  if (csatCritical) {
    systemActions.push({
      type: "csat", title: "Forced CSAT Block",
      why: `Untouched 2+ days · ${data.csat.weeklyMinutes} min weekly`,
      action: "60-min CSAT before deep-work unlock", urgency: "critical",
    });
  }
  if (data.revision.overdue > 10) {
    systemActions.push({
      type: "revision", title: "Revision Debt Push",
      why: `${data.revision.overdue} overdue · retention ${data.revision.retentionScore}%`,
      action: "45-min rapid revision loop, evening", urgency: "warning",
    });
  }
  if (fatigueDetected) {
    systemActions.push({
      type: "fatigue", title: "Fatigue Adjustment",
      why: `${ex.interruptions} interruptions · ${ex.deepWorkHours}h deep`,
      action: "Reduce load 20% · add buffer block", urgency: "warning",
    });
  }
  systemActions.push({
    type: "protect", title: "Protected Area",
    why: `${strongestSubject.name} at ${strongestSubject.score}% — over-alloc risk`,
    action: "Cap at 1 block · redirect to weak zones", urgency: "stable",
  });
  systemActions.push({
    type: "mistake", title: "Mistake Fix Task",
    why: `${data.mistakes.repeat} repeat · ${data.mistakes.conceptual} conceptual`,
    action: "30-min mistake review before new intake", urgency: "warning",
  });

  return {
    completionPct,
    executionScore: Math.round(executionScore),
    academicScore: Math.round(academicScore),
    revisionScore: Math.round(revisionScore),
    consistencyScore: Math.round(consistencyScore),
    performanceScore,
    execStatus: scoreStatus(executionScore),
    acadStatus: scoreStatus(academicScore),
    revStatus: scoreStatus(revisionScore),
    perfStatus: scoreStatus(performanceScore),
    weakestTopic,
    weakestSubject,
    strongestSubject,
    fatigueDetected,
    csatCritical,
    systemActions,
    weakTopics,
    subjectScoreAvg: Math.round(subjectScoreAvg),
  };
}

function sortTopics(topics, mode) {
  const a = [...topics];
  switch (mode) {
    case "weakest": return a.sort((x, y) => x.accuracy - y.accuracy);
    case "strongest": return a.sort((x, y) => y.accuracy - x.accuracy);
    case "priority": return a.sort((x, y) => y.priorityScore - x.priorityScore);
    case "mistakes": return a.sort((x, y) => y.mistakes - x.mistakes);
    default: return a;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target, dur = 950, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target]);
  return val;
}

function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setSeen(true); },
      { threshold: 0.06 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return seen;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  strong: "#4ade80",
  stable: "#f5a623",
  warning: "#fb923c",
  critical: "#f87171",
  bg: {
    strong: "rgba(74,222,128,.07)",
    stable: "rgba(245,166,35,.07)",
    warning: "rgba(251,146,60,.07)",
    critical: "rgba(248,113,113,.09)",
  },
  brd: {
    strong: "rgba(74,222,128,.18)",
    stable: "rgba(245,166,35,.18)",
    warning: "rgba(251,146,60,.18)",
    critical: "rgba(248,113,113,.2)",
  },
};

const DEC_ICONS = { escalate: "⬆", csat: "⚡", revision: "↩", fatigue: "🌙", protect: "🛡", mistake: "✕" };

// ─────────────────────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ status, label }) {
  return (
    <span style={{
      background: C.bg[status],
      color: C[status],
      border: `1px solid ${C.brd[status]}`,
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "'JetBrains Mono',monospace",
      letterSpacing: "0.1em",
      fontWeight: 700,
      whiteSpace: "nowrap",
      display: "inline-block",
      lineHeight: 1.6,
    }}>
      {label ?? status.toUpperCase()}
    </span>
  );
}

function Bar({ value, max = 100, color = "#f5a623", h = 5, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW((value / max) * 100), delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);
  return (
    <div style={{ height: h, background: "rgba(255,255,255,.05)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${w}%`,
        background: color,
        borderRadius: 2,
        transition: "width 0.85s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: `0 0 5px ${color}33`,
      }} />
    </div>
  );
}

function Arrow({ v }) {
  if (v > 0) return <span style={{ color: C.strong, fontSize: 10 }}>▲ +{v}%</span>;
  if (v < 0) return <span style={{ color: C.critical, fontSize: 10 }}>▼ {v}%</span>;
  return <span style={{ color: "#555", fontSize: 10 }}>— 0%</span>;
}

function SecHead({ eyebrow, title, badge }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ display: "inline-block", width: 12, height: 1, background: "#f5a623" }} />
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.18em", color: "#f5a623" }}>
          {eyebrow}
        </span>
        {badge && (
          <span style={{
            background: "rgba(245,166,35,.1)",
            color: "#f5a623",
            border: "1px solid rgba(245,166,35,.25)",
            padding: "0 6px",
            borderRadius: 3,
            fontSize: 9,
            letterSpacing: "0.1em",
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            {badge}
          </span>
        )}
      </div>
      <h2 style={{
        margin: 0,
        fontSize: "clamp(13px,2.2vw,16px)",
        fontWeight: 700,
        color: "#e8e8e8",
        fontFamily: "'DM Sans','Inter',sans-serif",
        letterSpacing: "-0.02em",
      }}>
        {title}
      </h2>
    </div>
  );
}

function Sec({ children, style = {}, className = "" }) {
  const ref = useRef(null);
  const v = useInView(ref);
  return (
    <div
      ref={ref}
      className={`pp-sec${className ? " " + className : ""}`}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, status, delay = 0, suffix = "" }) {
  const ref = useRef(null);
  const v = useInView(ref);
  const num = useCountUp(v ? (typeof value === "number" ? value : 0) : 0, 900, delay);
  const col = C[status] ?? "#aaa";
  return (
    <div
      ref={ref}
      style={{
        background: "#0b0b12",
        border: `1px solid ${col}18`,
        borderTop: `2px solid ${col}`,
        borderRadius: 7,
        padding: "12px 12px 10px",
        position: "relative",
        overflow: "hidden",
        opacity: v ? 1 : 0,
        transform: v ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
      }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at 90% 0%,${col}08 0%,transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.12em", color: "#484848", marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "clamp(18px,3vw,22px)", fontWeight: 800, color: "#f0f0f0", fontFamily: "'DM Sans','Inter',sans-serif", lineHeight: 1, marginBottom: 5 }}>
        {typeof value === "number" ? `${num}${suffix}` : value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
          {sub}
        </div>
      )}
      <Pill status={status} />
    </div>
  );
}

function TrendStrip({ values, color = "#f5a623", label }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "#404040", letterSpacing: "0.12em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 26 }}>
        {values.map((val, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${Math.max(10, (val / max) * 100)}%`,
            background: i === values.length - 1 ? color : `${color}38`,
            borderRadius: "2px 2px 0 0",
            boxShadow: i === values.length - 1 ? `0 0 5px ${color}55` : "none",
            transition: `height 0.65s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
          }} />
        ))}
      </div>
    </div>
  );
}

function Heatmap() {
  const weights = [0, 0.2, 0.5, 0.8, 1.0, 0.7, 0.4, 0.6, 0.9, 0.3, 0.1, 0.85, 0.95, 0.55, 0.4, 0.7, 0.6, 0.3, 0.8, 0.9, 0.5, 0.2, 0.6, 0.4, 0.7, 0.55, 0.3, 0.65];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const hours = ["06–09", "09–13", "14–17", "19–22"];
  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 3, paddingLeft: 38 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "monospace", color: "#333" }}>{d}</div>
        ))}
      </div>
      {hours.map((h, ri) => (
        <div key={ri} style={{ display: "flex", gap: 3, marginBottom: 3, alignItems: "center" }}>
          <div style={{ width: 36, fontSize: 8, fontFamily: "monospace", color: "#333", whiteSpace: "nowrap" }}>{h}</div>
          {Array.from({ length: 7 }).map((_, ci) => {
            const w = weights[ri * 7 + ci];
            const bg = w >= 0.8 ? "#f5a623" : w >= 0.5 ? "#f5a62350" : w >= 0.2 ? "#f5a62318" : "#141420";
            return (
              <div key={ci} style={{
                flex: 1,
                height: 14,
                borderRadius: 2,
                background: bg,
                boxShadow: w >= 0.8 ? "0 0 4px #f5a62344" : "none",
                transition: `background 0.3s ease ${(ri * 7 + ci) * 22}ms`,
              }} />
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
        <span style={{ fontSize: 8, fontFamily: "monospace", color: "#333" }}>LOW</span>
        {["#141420", "#f5a62318", "#f5a62350", "#f5a623"].map((c, i) => (
          <div key={i} style={{ width: 12, height: 7, background: c, borderRadius: 2 }} />
        ))}
        <span style={{ fontSize: 8, fontFamily: "monospace", color: "#333" }}>HIGH</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PerformancePage() {

  // ── Data layer ─────────────────────────────────────────────
  const [DATA, setDATA] = useState(null);

  useEffect(() => {
    let mounted = true;

    fetchRealPerformanceData().then((result) => {
      if (mounted) setDATA(result);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // ── UI STATE (MOVE UP) ─────────────────────────────────────
  const [timeframe, setTimeframe] = useState("today");
  const [topicSort, setTopicSort] = useState("weakest");

  // ── DERIVED HOOKS ──────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!DATA) return null;
    return deriveMetrics(DATA);
  }, [DATA]);

  const sortedTopics = useMemo(() => {
    if (!DATA) return [];
    return sortTopics(DATA.topics, topicSort);
  }, [DATA, topicSort]);

  // ── RETURN AFTER ALL HOOKS ─────────────────────────────────
  if (!DATA || !metrics) {
    return (
      <div style={{ minHeight: "100vh", background: "#08080f", color: "#e8e8e8", padding: 24 }}>
        Loading performance intelligence...
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  // Convenience aliases — always sourced from DATA, never from seed directly.
  const ex = DATA.execution;
  const subjects = DATA.subjects;
  const revision = DATA.revision;
  const mistakes = DATA.mistakes;
  const csat = DATA.csat;
  const trends = DATA.trends;


  // ── Derived CSAT badge label ─────────────────────────────────────────────────
  const csatBadgeStatus = metrics.csatCritical ? "critical" : "strong";
  const csatBadgeLabel = `CSAT · ${metrics.csatCritical ? "CRITICAL" : "HEALTHY"}`;

  // ── Score driver strings (uses DATA, not hardcoded values) ───────────────────
  const liftingDrivers = [
    `Streak: ${ex.streakDays} days`,
    `${metrics.strongestSubject.name} at ${metrics.strongestSubject.score}%`,
    `${subjects.find(s => s.id === "optional")?.name ?? "Optional"} anchoring strong`,
  ];
  const draggingDrivers = [
    `CSAT: ${ex.csatMinutes} min today`,
    `${metrics.weakTopics} topics below 55% accuracy`,
    `${revision.overdue} overdue revision nodes`,
    metrics.fatigueDetected ? "Fatigue degrading execution" : "Interruptions fragmenting deep work",
  ];

  // ── Trend insight lines (derived from DATA.trends) ──────────────────────────
  const trendInsights = [
    { col: C.stable, text: `Study hours ${trends.studyHours[0]}h → ${trends.studyHours[trends.studyHours.length - 1]}h this week` },
    { col: C.critical, text: `CSAT skipped ${trends.csat.filter(v => v === 0).length} of ${trends.csat.length} days` },
    { col: C.strong, text: `Completion improved mid-week, then dipped` },
    { col: "#60a5fa", text: `Accuracy plateau ${Math.min(...trends.accuracy)}–${Math.max(...trends.accuracy)}% — needs intervention` },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scan    { 0%{transform:translateY(-100%)} 100%{transform:translateY(500%)} }
        @keyframes glow    { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.12} }
        @keyframes bpulse  { 0%,100%{border-color:rgba(248,113,113,.22)} 50%{border-color:rgba(248,113,113,.5)} }

        .pp-root {
          min-height:100vh; background:#08080f; color:#e0e0e0;
          font-family:'DM Sans','Inter',sans-serif; font-size:13px; line-height:1.5;
          -webkit-font-smoothing:antialiased;
        }
        .pp-wrap { max-width:1080px; margin:0 auto; padding:0 16px; }

        .pp-hero {
          border-bottom:1px solid rgba(245,166,35,.1);
          background:linear-gradient(180deg,#0d0d1a 0%,#08080f 100%);
          padding:24px 0 20px; position:relative; overflow:hidden;
          animation:fadeUp .5s ease both;
        }
        .pp-hero-inner {
          display:flex; align-items:flex-start; justify-content:space-between;
          flex-wrap:wrap; gap:14px;
        }

        .pp-sec {
          background:#0b0b12; border:1px solid rgba(255,255,255,.05);
          border-radius:8px; padding:16px; margin-bottom:12px;
        }
        .pp-sec.csat-alert { animation:bpulse 2s ease infinite; }

        .kpi-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
        @media(max-width:880px){ .kpi-grid{ grid-template-columns:repeat(3,1fr); } }
        @media(max-width:520px){ .kpi-grid{ grid-template-columns:repeat(2,1fr); } }

        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:680px){ .two-col{ grid-template-columns:1fr; } }

        .subj-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:7px; margin-bottom:18px; }

        .t-hdr,.t-row { display:grid; grid-template-columns:1fr 48px 44px 48px 66px 68px; gap:7px; align-items:center; }
        .t-hdr { padding:4px 0; border-bottom:1px solid rgba(245,166,35,.12); }
        .t-row { padding:7px 0; border-bottom:1px solid rgba(255,255,255,.04); transition:background .15s; }
        .t-row:hover { background:rgba(245,166,35,.03); border-radius:5px; }
        @media(max-width:680px){
          .t-hdr,.t-row { grid-template-columns:1fr 44px 68px; }
          .tc-hide { display:none !important; }
        }

        .dec-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
        @media(max-width:640px){ .dec-grid{ grid-template-columns:1fr; } }

        .mk-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-bottom:14px; }
        @media(max-width:520px){ .mk-grid{ grid-template-columns:repeat(2,1fr); } }

        .rev-top { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-bottom:14px; }

        .st-mini { background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); border-radius:6px; padding:9px 10px; }

        .tf-btn {
          background:none; border:1px solid rgba(255,255,255,.1); color:#484848;
          padding:3px 11px; border-radius:20px; font-size:10px;
          font-family:'JetBrains Mono',monospace; letter-spacing:.12em;
          cursor:pointer; text-transform:uppercase; transition:all .18s;
        }
        .tf-btn:hover,.tf-btn.active { background:rgba(245,166,35,.1); border-color:rgba(245,166,35,.45); color:#f5a623; }

        .srt-btn {
          background:none; border:1px solid rgba(255,255,255,.07); color:#404040;
          padding:2px 8px; border-radius:3px; font-size:9px;
          font-family:'JetBrains Mono',monospace; letter-spacing:.1em;
          cursor:pointer; text-transform:uppercase; transition:all .18s;
        }
        .srt-btn.active,.srt-btn:hover { background:rgba(245,166,35,.1); border-color:rgba(245,166,35,.4); color:#f5a623; }

        .subj-card { background:#0b0b12; border:1px solid rgba(255,255,255,.06); border-radius:7px; padding:11px; transition:all .2s; }
        .subj-card:hover { border-color:rgba(245,166,35,.2); transform:translateY(-2px); }

        .dec-card { background:rgba(255,255,255,.025); border-left:2px solid transparent; border-radius:7px; padding:11px 13px; transition:all .2s; }
        .dec-card:hover { background:rgba(255,255,255,.04); transform:translateX(3px); }

        .flag-card { background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05); border-radius:7px; padding:11px; }
        .flag-card:hover { background:rgba(255,255,255,.035); }

        .live-dot { width:6px; height:6px; background:#f5a623; border-radius:50%; display:inline-block; animation:blink 1.8s ease infinite; }
        .score-big { font-weight:800; font-family:'DM Sans',sans-serif; line-height:1; animation:glow 3s ease infinite; }
        .mono { font-family:'JetBrains Mono',monospace; }
      `}</style>

      <div className="pp-root">

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <div className="pp-hero">
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "35%",
            background: "linear-gradient(180deg,rgba(245,166,35,.035) 0%,transparent 100%)",
            animation: "scan 7s linear infinite", pointerEvents: "none",
          }} />
          <div className="pp-wrap">
            <div className="pp-hero-inner">

              {/* left */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <span className="live-dot" />
                  <span className="mono" style={{ fontSize: 10, color: "#f5a623", letterSpacing: "0.2em" }}>
                    PERFORMANCE INTELLIGENCE
                  </span>
                </div>
                <h1 style={{
                  fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, letterSpacing: "-0.03em",
                  fontFamily: "'DM Sans',sans-serif", color: "#f0f0f0", lineHeight: 1.05, marginBottom: 5,
                }}>
                  War Dashboard
                </h1>
                <p className="mono" style={{ fontSize: 10, color: "#323232", letterSpacing: "0.04em", marginBottom: 14 }}>
                  Every decision has a consequence. The system is watching.
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["today", "7days", "30days"].map(tf => (
                    <button
                      key={tf}
                      className={`tf-btn${timeframe === tf ? " active" : ""}`}
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf === "today" ? "Today" : tf === "7days" ? "7 Days" : "30 Days"}
                    </button>
                  ))}
                </div>
              </div>

              {/* right */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end" }}>
                <div className="mono" style={{ fontSize: 9, color: "#303030", letterSpacing: "0.12em" }}>
                  SYSTEM STATUS
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Pill status={metrics.execStatus} label={`EXEC · ${metrics.execStatus.toUpperCase()}`} />
                  <Pill status={metrics.acadStatus} label={`ACADEMIC · ${metrics.acadStatus.toUpperCase()}`} />
                  <Pill status={metrics.revStatus} label={`REVISION · ${metrics.revStatus.toUpperCase()}`} />
                  <Pill status={csatBadgeStatus} label={csatBadgeLabel} />
                </div>
                <div style={{
                  background: "rgba(245,166,35,.06)",
                  border: "1px solid rgba(245,166,35,.2)",
                  borderRadius: 7,
                  padding: "10px 14px",
                  textAlign: "right",
                }}>
                  <div className="mono" style={{ fontSize: 9, color: "#f5a623", letterSpacing: "0.14em", marginBottom: 4 }}>
                    PERFORMANCE SCORE
                  </div>
                  <div
                    className="score-big"
                    style={{
                      fontSize: "clamp(28px,5vw,38px)",
                      color: C[metrics.perfStatus],
                      textShadow: `0 0 16px ${C[metrics.perfStatus]}33`,
                    }}
                  >
                    {metrics.performanceScore}
                    <span style={{ fontSize: 12, color: "#333", marginLeft: 3 }}>/100</span>
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <Pill status={metrics.perfStatus} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────────── */}
        <div className="pp-wrap" style={{ paddingTop: 12 }}>

          {/* KPI GRID */}
          <Sec>
            <SecHead eyebrow="KEY METRICS" title="Performance Overview" badge="10 INDICATORS" />
            <div className="kpi-grid">
              <KpiCard label="Completion" value={metrics.completionPct} suffix="%" delay={0} status={metrics.completionPct >= 75 ? "stable" : "warning"} sub={`${ex.completedBlocks}/${ex.completedBlocks + ex.partialBlocks + ex.missedBlocks} blocks`} />
              <KpiCard label="Study Hours" value={ex.actualHours} suffix="h" delay={50} status={ex.actualHours >= ex.plannedHours * 0.8 ? "stable" : "warning"} sub={`Planned ${ex.plannedHours}h`} />
              <KpiCard label="Prelims Acc." value={DATA.testScoreThisWeek} suffix="%" delay={100} status={DATA.testScoreThisWeek >= 70 ? "stable" : DATA.testScoreThisWeek >= 55 ? "warning" : "critical"} sub="This week" />
              <KpiCard label="Mains Answers" value={DATA.mainAnswers} delay={150} status={DATA.mainAnswers >= 5 ? "stable" : "warning"} sub="Written today" />
              <KpiCard label="Weak Topics" value={metrics.weakTopics} delay={200} status={metrics.weakTopics <= 3 ? "stable" : metrics.weakTopics <= 6 ? "warning" : "critical"} sub="Accuracy < 55%" />
              <KpiCard label="Revision Due" value={revision.dueToday + revision.overdue} delay={250} status={revision.overdue > 10 ? "critical" : "warning"} sub={`${revision.overdue} overdue`} />
              <KpiCard label="CSAT Min" value={ex.csatMinutes} delay={300} status={ex.csatMinutes === 0 ? "critical" : ex.csatMinutes < 30 ? "warning" : "stable"} sub="Today" />
              <KpiCard label="Streak" value={ex.streakDays} suffix=" d" delay={350} status={ex.streakDays >= 10 ? "strong" : "stable"} sub="Consecutive" />
              <KpiCard label="Retention" value={revision.retentionScore} suffix="%" delay={400} status={revision.retentionScore >= 70 ? "stable" : revision.retentionScore >= 50 ? "warning" : "critical"} sub="Memory health" />
              <KpiCard label="Neg. Marks" value={DATA.negativeMarksLost} delay={450} status={DATA.negativeMarksLost <= 4 ? "stable" : "warning"} sub="Lost this week" />
            </div>
          </Sec>

          {/* EXECUTION INTELLIGENCE */}
          <Sec>
            <SecHead eyebrow="LAYER A · EXECUTION" title="Execution Intelligence" />
            <div className="two-col">

              <div>
                {/* Plan vs actual */}
                <div style={{ marginBottom: 12 }}>
                  {[
                    { lbl: "PLANNED", val: ex.plannedHours, max: 12, col: "rgba(245,166,35,.35)" },
                    { lbl: "ACTUAL", val: ex.actualHours, max: 12, col: C.strong },
                  ].map((r, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span className="mono" style={{ fontSize: 9, color: "#404040" }}>{r.lbl} HOURS</span>
                        <span className="mono" style={{ fontSize: 9, color: r.col }}>{r.val}h</span>
                      </div>
                      <Bar value={r.val} max={r.max} color={r.col} h={5} delay={i * 80 + 150} />
                    </div>
                  ))}
                </div>

                {/* Block breakdown */}
                {[
                  { label: "Completed", val: ex.completedBlocks, col: C.strong },
                  { label: "Partial", val: ex.partialBlocks, col: C.stable },
                  { label: "Missed", val: ex.missedBlocks, col: C.critical },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 9, color: "#404040", width: 56 }}>{r.label}</span>
                    <div style={{ flex: 1 }}><Bar value={r.val} max={10} color={r.col} h={4} delay={180 + i * 55} /></div>
                    <span className="mono" style={{ fontSize: 11, color: r.col, width: 16, textAlign: "right" }}>{r.val}</span>
                  </div>
                ))}

                {/* Stat mini grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                  {[
                    { lbl: "Focus", val: `${ex.focusScore}%`, st: ex.focusScore >= 70 ? "stable" : "warning" },
                    { lbl: "Adherence", val: `${ex.blockAdherence}%`, st: ex.blockAdherence >= 70 ? "stable" : "warning" },
                    { lbl: "Deep Work", val: `${ex.deepWorkHours}h`, st: ex.deepWorkHours >= 5 ? "stable" : "warning" },
                    { lbl: "Interrupts", val: ex.interruptions, st: ex.interruptions <= 2 ? "stable" : "critical" },
                    { lbl: "Del. Starts", val: ex.delayedStarts, st: ex.delayedStarts <= 1 ? "stable" : "warning" },
                    { lbl: "Shallow", val: `${ex.shallowWorkHours}h`, st: "stable" },
                  ].map((s, i) => (
                    <div key={i} className="st-mini">
                      <div className="mono" style={{ fontSize: 8, color: "#333", letterSpacing: "0.1em", marginBottom: 4 }}>
                        {s.lbl.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#d0d0d0", marginBottom: 4 }}>{s.val}</div>
                      <Pill status={s.st} />
                    </div>
                  ))}
                </div>

                {metrics.fatigueDetected && (
                  <div style={{
                    marginTop: 10, background: "rgba(248,113,113,.07)", border: "1px solid rgba(248,113,113,.2)",
                    borderRadius: 6, padding: "8px 11px", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 12 }}>⚡</span>
                    <div>
                      <div className="mono" style={{ fontSize: 9, color: C.critical, letterSpacing: "0.1em" }}>FATIGUE DETECTED</div>
                      <div style={{ fontSize: 11, color: "#484848", marginTop: 2 }}>
                        Deep work low + high interruptions. Tomorrow load reduced.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.14em", marginBottom: 10 }}>
                  WEEKLY FOCUS HEATMAP
                </div>
                <Heatmap />
              </div>

            </div>
          </Sec>

          {/* ACADEMIC PERFORMANCE */}
          <Sec>
            <SecHead eyebrow="LAYER B · ACADEMIC" title="Academic Performance" />

            <div className="subj-grid">
              {subjects.map((s, i) => (
                <div
                  key={s.id}
                  className="subj-card"
                  style={{
                    borderTop: `2px solid ${C[s.status]}`,
                    opacity: 0,
                    animation: `fadeUp 0.32s ease forwards ${i * 50}ms`,
                  }}
                >
                  <div className="mono" style={{ fontSize: 9, color: "#484848", marginBottom: 5 }}>{s.name}</div>
                  <div style={{ fontSize: "clamp(16px,2.5vw,20px)", fontWeight: 800, color: C[s.status], fontFamily: "'DM Sans',sans-serif", lineHeight: 1, marginBottom: 4 }}>
                    {s.score}%
                  </div>
                  <div style={{ marginBottom: 6 }}><Arrow v={s.trend} /></div>
                  <div className="mono" style={{ fontSize: 8, color: "#333", marginBottom: 3 }}>COV {s.topicCoverage}%</div>
                  <Bar value={s.topicCoverage} color={C[s.status]} h={3} delay={i * 55 + 220} />
                  <div style={{ marginTop: 6 }}><Pill status={s.status} /></div>
                </div>
              ))}
            </div>

            {/* Topic table */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9, flexWrap: "wrap", gap: 6 }}>
                <div className="mono" style={{ fontSize: 9, color: "#383838", letterSpacing: "0.12em" }}>
                  TOPIC NODES · {DATA.topics.length}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[["weakest", "WEAKEST"], ["strongest", "STRONGEST"], ["priority", "PRIORITY"], ["mistakes", "MISTAKES"]].map(([k, l]) => (
                    <button key={k} className={`srt-btn${topicSort === k ? " active" : ""}`} onClick={() => setTopicSort(k)}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="t-hdr">
                {["TOPIC", "SUBJ", "ACC", "ERR", "REV", "STATUS"].map((h, hi) => (
                  <div key={h} className={`mono${[1, 3, 4].includes(hi) ? " tc-hide" : ""}`}
                    style={{ fontSize: 8, color: "#333", letterSpacing: "0.1em" }}>
                    {h}
                  </div>
                ))}
              </div>

              {sortedTopics.map((t, i) => (
                <div key={t.id} className="t-row" style={{ opacity: 0, animation: `fadeUp 0.28s ease forwards ${i * 30}ms` }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.3 }}>{t.topicName}</div>
                    <div className="mono" style={{ fontSize: 9, color: "#383838", marginTop: 2 }}>
                      {t.lastStudiedDaysAgo}d ago · <Arrow v={t.trend} />
                    </div>
                  </div>
                  <div className="mono tc-hide" style={{ fontSize: 10, color: "#484848" }}>{t.subject}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.accuracy < 55 ? C.critical : t.accuracy >= 70 ? C.strong : C.stable }}>
                    {t.accuracy}%
                  </div>
                  <div className="mono tc-hide" style={{ fontSize: 12, fontWeight: 700, color: t.mistakes >= 8 ? C.critical : "#999" }}>
                    {t.mistakes}
                  </div>
                  <div className="tc-hide">
                    <Bar value={t.revisionHealth} color={t.revisionHealth < 50 ? C.critical : C.stable} h={4} delay={i * 30 + 120} />
                    <div className="mono" style={{ fontSize: 8, color: "#333", marginTop: 2 }}>{t.revisionHealth}%</div>
                  </div>
                  <Pill status={t.status} />
                </div>
              ))}
            </div>
          </Sec>

          {/* MISTAKE INTELLIGENCE */}
          <Sec>
            <SecHead eyebrow="MISTAKE INTELLIGENCE" title="Error Anatomy" badge={`${mistakes.total} ACTIVE`} />
            <div className="two-col">

              <div>
                <div className="mk-grid">
                  {[
                    { l: "Conceptual", v: mistakes.conceptual, c: C.critical },
                    { l: "Silly", v: mistakes.silly, c: C.warning },
                    { l: "Guess", v: mistakes.guess, c: C.stable },
                    { l: "Repeat", v: mistakes.repeat, c: "#ef4444" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: `${m.c}0a`, border: `1px solid ${m.c}1a`, borderRadius: 7, padding: "10px 11px" }}>
                      <div className="mono" style={{ fontSize: 8, color: "#3a3a3a", letterSpacing: "0.1em", marginBottom: 5 }}>
                        {m.l.toUpperCase()}
                      </div>
                      <div style={{ fontSize: "clamp(16px,2.5vw,20px)", fontWeight: 800, color: m.c, fontFamily: "'DM Sans',sans-serif", marginBottom: 5 }}>
                        {m.v}
                      </div>
                      <Bar value={m.v} max={35} color={m.c} h={3} delay={i * 70 + 180} />
                    </div>
                  ))}
                </div>

                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 7 }}>
                  TOP MISTAKE NODES
                </div>
                {[...DATA.topics].sort((a, b) => b.mistakes - a.mistakes).slice(0, 4).map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize: 12, color: "#888" }}>{t.topicName}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: C.critical, fontWeight: 700 }}>{t.mistakes}</span>
                      <Pill status={t.status} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 9 }}>
                  INTELLIGENCE FLAGS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { flag: mistakes.illusionOfLearning, title: "Illusion of Learning", sev: "critical", desc: "High coverage, accuracy stagnant. Recognition without retrieval.", action: "Force active recall before new intake." },
                    { flag: mistakes.overconfidenceTrap, title: "Overconfidence Trap", sev: "warning", desc: "Strong areas over-studied at cost of critical weak zones.", action: "Cap strong subject at 1 block." },
                    { flag: mistakes.avoidanceBehavior, title: "Avoidance Behavior", sev: "critical", desc: "CSAT and weak topics consistently skipped. Pattern confirmed.", action: "System will lock alternatives until done." },
                  ].map((item, i) => (
                    <div key={i} className="flag-card" style={{ borderLeft: `2px solid ${item.flag ? C[item.sev] : "#222"}`, opacity: item.flag ? 1 : 0.28 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#bbb" }}>{item.title}</div>
                        <Pill status={item.flag ? item.sev : "stable"} label={item.flag ? "ACTIVE" : "CLEAR"} />
                      </div>
                      <div style={{ fontSize: 11, color: "#424242", marginBottom: item.flag ? 7 : 0, lineHeight: 1.5 }}>{item.desc}</div>
                      {item.flag && (
                        <div className="mono" style={{ fontSize: 9, color: C[item.sev], background: `${C[item.sev]}0a`, padding: "5px 8px", borderRadius: 4, letterSpacing: "0.04em" }}>
                          ↳ {item.action}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Sec>

          {/* REVISION INTELLIGENCE */}
          <Sec>
            <SecHead eyebrow="REVISION INTELLIGENCE" title="Memory Decay Monitor" />
            <div className="two-col">

              <div>
                <div className="rev-top">
                  {[
                    { l: "Due Today", v: revision.dueToday, c: C.stable },
                    { l: "Overdue", v: revision.overdue, c: C.critical },
                    { l: "Done Today", v: revision.completedToday, c: C.strong },
                  ].map((r, i) => (
                    <div key={i} style={{ background: `${r.c}0a`, border: `1px solid ${r.c}1a`, borderRadius: 7, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: "clamp(16px,2.5vw,20px)", fontWeight: 800, color: r.c, fontFamily: "'DM Sans',sans-serif" }}>{r.v}</div>
                      <div className="mono" style={{ fontSize: 8, color: "#3a3a3a", marginTop: 3 }}>{r.l.toUpperCase()}</div>
                    </div>
                  ))}
                </div>

                {[
                  { lbl: "Retention Score", val: revision.retentionScore, col: revision.retentionScore >= 70 ? C.strong : C.critical },
                  { lbl: "Success Rate", val: revision.revisionSuccessRate, col: C.stable },
                ].map((r, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span className="mono" style={{ fontSize: 9, color: "#383838" }}>{r.lbl.toUpperCase()}</span>
                      <span className="mono" style={{ fontSize: 9, color: r.col }}>{r.val}%</span>
                    </div>
                    <Bar value={r.val} color={r.col} h={5} delay={i * 90 + 180} />
                  </div>
                ))}

                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 7 }}>
                  SPACED REP LOOP HEALTH
                </div>
                {[
                  ["1-Day", revision.loopHealth.one],
                  ["3-Day", revision.loopHealth.three],
                  ["7-Day", revision.loopHealth.seven],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 9, color: "#383838", width: 38 }}>{l}</span>
                    <div style={{ flex: 1 }}><Bar value={v} color={v >= 65 ? C.strong : C.critical} h={4} delay={i * 60 + 220} /></div>
                    <span className="mono" style={{ fontSize: 10, color: v >= 65 ? C.strong : C.critical, width: 30, textAlign: "right" }}>{v}%</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 8 }}>URGENT NODES</div>
                {[...DATA.topics]
                  .filter(t => t.revisionHealth < 55)
                  .sort((a, b) => a.revisionHealth - b.revisionHealth)
                  .slice(0, 6)
                  .map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#ccc" }}>{t.topicName}</div>
                        <div className="mono" style={{ fontSize: 9, color: "#383838" }}>{t.subject} · {t.lastStudiedDaysAgo}d ago</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.critical }}>{t.revisionHealth}%</div>
                        <div className="mono" style={{ fontSize: 8, color: "#333" }}>retention</div>
                      </div>
                    </div>
                  ))}

                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginTop: 12, marginBottom: 8 }}>STABLE NODES</div>
                {[...DATA.topics]
                  .filter(t => t.revisionHealth >= 75)
                  .slice(0, 3)
                  .map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <div style={{ fontSize: 12, color: "#404040" }}>{t.topicName}</div>
                      <span className="mono" style={{ fontSize: 11, color: C.strong }}>{t.revisionHealth}%</span>
                    </div>
                  ))}
              </div>

            </div>
          </Sec>

          {/* CSAT ENFORCEMENT */}
          <Sec
            className={metrics.csatCritical ? "csat-alert" : ""}
            style={{ border: metrics.csatCritical ? "1px solid rgba(248,113,113,.28)" : "1px solid rgba(74,222,128,.14)" }}
          >
            <SecHead eyebrow="CSAT ENFORCEMENT" title="CSAT Compliance" badge={metrics.csatCritical ? "⚠ CRITICAL" : "HEALTHY"} />
            <div className="two-col">

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[
                  { lbl: "Today", val: `${csat.todayMinutes} min`, st: csat.todayMinutes === 0 ? "critical" : "stable" },
                  { lbl: "Weekly", val: `${csat.weeklyMinutes} min`, st: csat.weeklyMinutes < 120 ? "warning" : "stable" },
                  { lbl: "Last 2 Days", val: csat.last2DayTouched ? "Touched" : "Skipped", st: csat.last2DayTouched ? "stable" : "critical" },
                  { lbl: "Compliance", val: csat.status.toUpperCase(), st: csat.status },
                ].map((r, i) => (
                  <div key={i} style={{ background: C.bg[r.st], border: `1px solid ${C.brd[r.st]}`, borderRadius: 7, padding: "10px 11px" }}>
                    <div className="mono" style={{ fontSize: 8, color: "#3a3a3a", letterSpacing: "0.1em", marginBottom: 4 }}>
                      {r.lbl.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C[r.st] }}>{r.val}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: metrics.csatCritical ? "rgba(248,113,113,.06)" : "rgba(74,222,128,.06)",
                border: `1px solid ${metrics.csatCritical ? "rgba(248,113,113,.22)" : "rgba(74,222,128,.18)"}`,
                borderRadius: 7,
                padding: "13px 14px",
              }}>
                <div className="mono" style={{ fontSize: 9, color: metrics.csatCritical ? C.critical : C.strong, letterSpacing: "0.12em", marginBottom: 6 }}>
                  {metrics.csatCritical ? "⚠ SYSTEM LOCK PENDING" : "✓ CSAT CLEARED"}
                </div>
                <div style={{ fontSize: 12, color: "#484848", lineHeight: 1.6, marginBottom: metrics.csatCritical ? 9 : 0 }}>
                  {metrics.csatCritical
                    ? "CSAT untouched for 2+ days. Avoidance pattern confirmed. System will intervene."
                    : "CSAT compliance healthy. Maintain minimum 45 min daily."}
                </div>
                {metrics.csatCritical && (
                  <div className="mono" style={{ fontSize: 9, color: C.critical, background: "rgba(248,113,113,.08)", padding: "6px 9px", borderRadius: 4, letterSpacing: "0.04em" }}>
                    ↳ Forced 60-min CSAT block tomorrow before deep-work unlock.
                  </div>
                )}
              </div>

            </div>
          </Sec>

          {/* ADAPTIVE PLANNER DECISIONS */}
          <Sec style={{ background: "linear-gradient(135deg,#0d0d1a,#0b0b12)", border: "1px solid rgba(245,166,35,.16)" }}>
            <SecHead eyebrow="MENTOROS DECISION ENGINE" title="Tomorrow's Interventions" badge={`${metrics.systemActions.length} ACTIONS`} />
            <div className="dec-grid">
              {metrics.systemActions.map((a, i) => {
                const col = C[a.urgency] ?? "#888";
                return (
                  <div key={i} className="dec-card" style={{ borderLeftColor: col, opacity: 0, animation: `fadeUp 0.38s ease forwards ${i * 65}ms` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{DEC_ICONS[a.type]}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#d0d0d0" }}>{a.title}</span>
                      <div style={{ marginLeft: "auto" }}><Pill status={a.urgency} /></div>
                    </div>
                    <div style={{ fontSize: 11, color: "#3a3a3a", marginBottom: 7, lineHeight: 1.5 }}>{a.why}</div>
                    <div className="mono" style={{ fontSize: 9, color: col, background: `${col}0a`, padding: "5px 8px", borderRadius: 4, letterSpacing: "0.04em" }}>
                      ↳ {a.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </Sec>

          {/* PERFORMANCE SCORE MODEL */}
          <Sec>
            <SecHead eyebrow="SCORE ARCHITECTURE" title="Performance Score Model" />
            <div className="two-col">

              <div>
                <div
                  className="score-big"
                  style={{ fontSize: "clamp(28px,5vw,40px)", color: C[metrics.perfStatus], textShadow: `0 0 18px ${C[metrics.perfStatus]}30`, marginBottom: 5 }}
                >
                  {metrics.performanceScore}
                  <span style={{ fontSize: 12, color: "#2a2a2a", marginLeft: 4 }}>/100</span>
                </div>
                <div style={{ marginBottom: 12 }}><Pill status={metrics.perfStatus} /></div>

                {[
                  { lbl: "Execution (30%)", val: metrics.executionScore, st: metrics.execStatus },
                  { lbl: "Academic (35%)", val: metrics.academicScore, st: metrics.acadStatus },
                  { lbl: "Revision (20%)", val: metrics.revisionScore, st: metrics.revStatus },
                  { lbl: "Consistency (15%)", val: metrics.consistencyScore, st: "stable" },
                ].map((r, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 9, color: "#404040" }}>{r.lbl}</span>
                      <span className="mono" style={{ fontSize: 9, color: C[r.st] }}>{r.val}</span>
                    </div>
                    <Bar value={r.val} color={C[r.st]} h={5} delay={i * 80 + 180} />
                  </div>
                ))}
              </div>

              <div>
                <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 9 }}>SCORE DRIVERS</div>

                <div style={{ marginBottom: 12 }}>
                  <div className="mono" style={{ fontSize: 9, color: C.strong, marginBottom: 5, letterSpacing: "0.08em" }}>▲ LIFTING</div>
                  {liftingDrivers.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#404040", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <span style={{ color: C.strong, marginRight: 6 }}>+</span>{s}
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mono" style={{ fontSize: 9, color: C.critical, marginBottom: 5, letterSpacing: "0.08em" }}>▼ DRAGGING</div>
                  {draggingDrivers.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#404040", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <span style={{ color: C.critical, marginRight: 6 }}>−</span>{s}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Sec>

          {/* TREND ANALYSIS */}
          <Sec>
            <SecHead eyebrow="TREND ANALYSIS" title="7-Day Performance Trend" />
            <div className="two-col">

              <div>
                <TrendStrip values={trends.studyHours} color="#f5a623" label="STUDY HOURS / DAY" />
                <TrendStrip values={trends.completion} color="#4ade80" label="COMPLETION % / DAY" />
                <TrendStrip values={trends.accuracy} color="#60a5fa" label="PRELIMS ACCURACY %" />
              </div>

              <div>
                <TrendStrip values={trends.revision} color="#a78bfa" label="REVISION HEALTH %" />
                <TrendStrip values={trends.csat} color="#f87171" label="CSAT MINUTES / DAY" />
                <div style={{ marginTop: 10 }}>
                  {trendInsights.map(({ col, text }, i) => (
                    <div key={i} className="mono" style={{ fontSize: 9, color: "#404040", lineHeight: 2 }}>
                      <span style={{ color: col, marginRight: 6 }}>→</span>{text}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Sec>

        </div>
      </div>
    </>
  );
}
