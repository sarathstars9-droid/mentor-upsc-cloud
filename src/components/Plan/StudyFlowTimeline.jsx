import React from "react";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "active":
    case "studying":
      return {
        label: "ACTIVE",
        color: "var(--success, #16a34a)",
        bg: "rgba(34, 197, 94, 0.12)"
      };
    case "paused":
      return {
        label: "PAUSED",
        color: "var(--warning, #eab308)",
        bg: "rgba(234, 179, 8, 0.12)"
      };
    case "completed":
    case "done":
      return {
        label: "COMPLETED",
        color: "var(--success, #16a34a)",
        bg: "rgba(34, 197, 94, 0.08)"
      };
    case "planned":
    case "pending":
      return {
        label: "PLANNED",
        color: "var(--brand-primary)",
        bg: "var(--brand-primary-soft)"
      };
    case "skipped":
    case "stopped":
    case "missed":
      return {
        label: "SKIPPED",
        color: "var(--text-tertiary)",
        bg: "var(--bg-subtle)"
      };
    case "carried_forward":
      return {
        label: "CARRIED FORWARD",
        color: "#a78bfa",
        bg: "rgba(139, 92, 246, 0.1)"
      };
    default:
      return {
        label: (status || "PLANNED").toUpperCase(),
        color: "var(--text-secondary)",
        bg: "var(--bg-subtle)"
      };
  }
}

export default function StudyFlowTimeline({
  todayBlocks = [],
  onStartBlock,
  onEditBlock,
  onEditReview,
  onCarryForward,
  onAddBlock,
  onManageToday,
  busy = false
}) {
  if (todayBlocks.length === 0) return null;

  return (
    <section className="mos-study-flow-section" style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 16,
      padding: "20px 24px",
      marginBottom: 24,
      boxShadow: "var(--shadow-card)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: "1px solid var(--border-subtle)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>⏱️</span>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "0.01em" }}>
            Today's Study Flow ({todayBlocks.length} {todayBlocks.length === 1 ? "block" : "blocks"})
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onManageToday}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "5px 11px",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            Manage Timetable
          </button>
          <button
            type="button"
            onClick={onAddBlock}
            style={{
              background: "var(--brand-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "5px 12px",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            + Add Block
          </button>
        </div>
      </div>

      {/* Timeline Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {todayBlocks.map((block, idx) => {
          const s = (block.Status || block.status || "").toLowerCase();
          const badge = getStatusBadge(s);
          const subject = block.PlannedSubject || block.subject || "Study Block";
          const topic = block.PlannedTopic || block.topic || block.custom_topic || "Study Session";
          const subtopic = block.subtopic || block.Subtopic || "";
          const planned = Number(block.PlannedMinutes || block.planned_minutes || 0);
          const actual = Number(block.ActualMinutes || block.actual_minutes || 0);
          const isDone = s === "completed" || s === "done";
          const isActive = s === "active" || s === "studying";
          const isPaused = s === "paused";
          const isPlanned = s === "planned" || s === "pending" || !s;

          return (
            <div
              key={block.BlockId || block.id || idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: 12,
                background: isActive
                  ? "rgba(34, 197, 94, 0.04)"
                  : (isPaused ? "rgba(234, 179, 8, 0.04)" : "var(--bg-subtle)"),
                border: isActive
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : (isPaused ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid var(--border-subtle)"),
                gap: 14,
                flexWrap: "wrap",
                transition: "background 0.15s ease"
              }}
            >
              {/* Order index + Subject & Topic */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260, flex: "1 1 280px" }}>
                <span style={{
                  fontSize: 12,
                  fontFamily: "var(--mono, monospace)",
                  fontWeight: 800,
                  color: "var(--text-tertiary)",
                  width: 20
                }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase" }}>
                      {subject}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: badge.color,
                      background: badge.bg,
                      padding: "1px 6px",
                      borderRadius: 6,
                      letterSpacing: "0.04em"
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                    {topic}
                    {subtopic && <span style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: 13 }}> → {subtopic}</span>}
                  </div>
                </div>
              </div>

              {/* Time display: Planned vs Actual */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    {isDone ? (
                      <span style={{ color: "var(--success, #16a34a)" }}>{formatDuration(actual)}</span>
                    ) : (
                      <span>{formatDuration(planned)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                    {isDone ? `Target: ${formatDuration(planned)}` : "Planned Duration"}
                  </div>
                </div>

                {/* Context-specific action pill */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isPlanned && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditBlock?.(block)}
                        disabled={busy}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-surface)",
                          color: "var(--text-secondary)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartBlock?.(block.BlockId || block.block_id || block.id)}
                        disabled={busy}
                        style={{
                          padding: "5px 14px",
                          borderRadius: 6,
                          border: "none",
                          background: "var(--brand-primary)",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Start
                      </button>
                    </>
                  )}

                  {isActive && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--success, #16a34a)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(34, 197, 94, 0.12)"
                    }}>
                      Studying above ↑
                    </span>
                  )}

                  {isPaused && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--warning, #eab308)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(234, 179, 8, 0.12)"
                    }}>
                      Paused above ↑
                    </span>
                  )}

                  {isDone && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditReview?.(block)}
                        disabled={busy}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-surface)",
                          color: "var(--text-secondary)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => onCarryForward?.(block)}
                        disabled={busy}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid rgba(139, 92, 246, 0.3)",
                          background: "rgba(139, 92, 246, 0.08)",
                          color: "#a78bfa",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Carry Topic →
                      </button>
                    </>
                  )}

                  {(s === "skipped" || s === "stopped" || s === "missed") && (
                    <button
                      type="button"
                      onClick={() => onCarryForward?.(block)}
                      disabled={busy}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        color: "var(--brand-primary)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Reschedule →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
