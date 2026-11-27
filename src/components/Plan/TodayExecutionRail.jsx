import React from "react";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m === 0) return "0m";
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export default function TodayExecutionRail({
  dashboardMetrics,
  todayBlocks = [],
  overTargetMinutes = 0
}) {
  const planned = Number(dashboardMetrics?.plannedMinutes) || 0;
  const completed = Number(dashboardMetrics?.completedMinutes) || 0;
  const provisional = Number(dashboardMetrics?.provisionalMinutes) || 0;
  const studying = Number(dashboardMetrics?.studyingMinutes) || 0;
  const remaining = Number(dashboardMetrics?.remainingMinutes) || 0;
  const progressPercent = Math.min(100, Number(dashboardMetrics?.executionPercent) || 0);

  const totalBlocks = todayBlocks.length;
  const completedBlocks = todayBlocks.filter(b => {
    const s = (b.Status || b.status || "").toLowerCase();
    return s === "completed" || s === "done";
  }).length;

  return (
    <div
      className="mos-execution-rail"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 16,
        boxShadow: "var(--shadow-card)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          TODAY'S EXECUTION
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--mono, monospace)",
            color: "var(--brand-primary)"
          }}
        >
          Blocks: {completedBlocks}/{totalBlocks} completed
        </span>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
            Planned Time
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--mono, monospace)", marginTop: 2 }}>
            {formatDuration(planned)}
          </div>
        </div>

        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success, #16a34a)", textTransform: "uppercase" }}>
            Completed Time
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--success, #16a34a)", fontFamily: "var(--mono, monospace)", marginTop: 2 }}>
            {formatDuration(completed)}
          </div>
        </div>

        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase" }}>
            Currently Studying
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--mono, monospace)", marginTop: 2 }}>
            {formatDuration(studying)}
          </div>
        </div>

        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
            Remaining Time
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--mono, monospace)", marginTop: 2 }}>
            {formatDuration(remaining)}
          </div>
        </div>
      </div>

      {/* Provisional (Unconfirmed) Recovery Notice */}
      {provisional > 0 && (
        <div
          style={{
            background: "rgba(217, 119, 6, 0.08)",
            border: "1px solid rgba(217, 119, 6, 0.25)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warning, #d97706)" }}>
              Provisional Recovery Time
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--mono, monospace)", color: "var(--warning, #d97706)" }}>
              {formatDuration(provisional)} (unconfirmed)
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.3 }}>
            Auto-recovered session — excluded from verified study time until confirmed.
          </div>
        </div>
      )}

      {/* Over-Target Badge if applicable */}
      {overTargetMinutes > 0 && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warning, #eab308)" }}>
            Over Target Duration
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--mono, monospace)", color: "var(--warning, #eab308)" }}>
            +{overTargetMinutes}m
          </span>
        </div>
      )}

      {/* Execution Progress Bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span>Execution Progress</span>
          <span style={{ fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--mono, monospace)" }}>
            {progressPercent}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--border-default)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "var(--brand-primary)",
              borderRadius: 3,
              transition: "width 0.3s ease"
            }}
          />
        </div>
      </div>
    </div>
  );
}
