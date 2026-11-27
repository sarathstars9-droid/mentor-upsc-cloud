import React from "react";

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m === 0) return "0m";
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getStatusPill(status) {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "active":
    case "studying":
      return {
        label: "IN PROGRESS",
        color: "var(--brand-primary)",
        bg: "var(--brand-primary-soft)"
      };
    case "paused":
      return {
        label: "PAUSED",
        color: "var(--warning, #eab308)",
        bg: "rgba(234, 179, 8, 0.14)"
      };
    case "completed":
    case "done":
      return {
        label: "COMPLETED",
        color: "var(--success, #16a34a)",
        bg: "rgba(34, 197, 94, 0.1)"
      };
    case "planned":
    case "pending":
      return {
        label: "PLANNED",
        color: "var(--text-secondary)",
        bg: "var(--bg-subtle)"
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

export default function StudyFlowTable({
  todayBlocks = [],
  onStartBlock,
  onPauseBlock,
  onResumeBlock,
  onFinishBlock,
  onEditBlock,
  onEditReview,
  onCarryForward,
  onAddBlock,
  busy = false
}) {
  if (todayBlocks.length === 0) return null;

  return (
    <section
      className="mos-study-flow-table"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "20px 24px",
        boxShadow: "var(--shadow-card)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
            TODAY'S STUDY FLOW
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            ({todayBlocks.length} {todayBlocks.length === 1 ? "block" : "blocks"})
          </span>
        </div>

        <button
          type="button"
          onClick={onAddBlock}
          style={{
            background: "transparent",
            color: "var(--brand-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          + Add Block
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {todayBlocks.map((block, idx) => {
          const s = (block.Status || block.status || "planned").toLowerCase();
          const subject = block.PlannedSubject || block.subject || "Study Block";
          const topic = block.PlannedTopic || block.topic || block.custom_topic || "Topic";
          const subtopic = block.subtopic || block.Subtopic || "";
          const plannedMins = Number(block.PlannedMinutes || block.planned_minutes || 0);
          const actualMins = Number(block.ActualMinutes || block.actual_minutes || 0);
          const pill = getStatusPill(s);
          const blockId = block.BlockId || block.block_id || block.id;

          const isActive = s === "active" || s === "studying";
          const isPaused = s === "paused";
          const isDone = s === "completed" || s === "done";
          const isSkipped = s === "skipped" || s === "stopped" || s === "missed";
          const isPlanned = s === "planned" || s === "pending";

          return (
            <div
              key={blockId || idx}
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12
              }}
            >
              {/* Sequence, Subject & Topic */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "1 1 240px", minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--mono, monospace)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--text-tertiary)",
                    marginTop: 2
                  }}
                >
                  #{idx + 1}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--brand-primary)" }}>
                      {subject}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        color: pill.color,
                        background: pill.bg,
                        padding: "1px 6px",
                        borderRadius: 4
                      }}
                    >
                      {pill.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: 1.35 }}>
                    {topic}
                  </div>

                  {subtopic && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                      {subtopic}
                    </div>
                  )}
                </div>
              </div>

              {/* Planned vs Actual Duration */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--mono, monospace)", color: "var(--text-primary)" }}>
                  {isDone ? `${formatDuration(actualMins)} done` : formatDuration(plannedMins)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                  {isDone ? `Planned: ${formatDuration(plannedMins)}` : "Planned target"}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isPlanned && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onStartBlock?.(blockId)}
                      style={{
                        background: "var(--brand-primary)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditBlock?.(block)}
                      style={{
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Edit
                    </button>
                  </>
                )}

                {isActive && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onFinishBlock?.(block)}
                      style={{
                        background: "var(--brand-primary)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Finish
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPauseBlock?.(blockId)}
                      style={{
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Pause
                    </button>
                  </>
                )}

                {isPaused && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResumeBlock?.(blockId)}
                      style={{
                        background: "var(--brand-primary)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onFinishBlock?.(block)}
                      style={{
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Finish
                    </button>
                  </>
                )}

                {isDone && (
                  <button
                    type="button"
                    onClick={() => onEditReview?.(block)}
                    style={{
                      background: "transparent",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Review
                  </button>
                )}

                {isSkipped && (
                  <button
                    type="button"
                    onClick={() => onCarryForward?.(block)}
                    style={{
                      background: "transparent",
                      color: "var(--brand-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Carry Forward
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
