import React from "react";

function formatClockTime(isoOrStr) {
  if (!isoOrStr) return "—";
  const str = String(isoOrStr);
  if (/^\d{1,2}:\d{2}(\s*[APap][Mm])?$/.test(str)) return str;
  const d = new Date(isoOrStr);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatElapsedTimer(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export default function LiveStudyWorkspace({
  activeBlock,
  pausedBlock,
  nextBlock,
  liveElapsedSec = 0,
  overTargetMinutes = 0,
  acknowledgedContinue = false,
  busy = false,
  onStartBlock,
  onPauseBlock,
  onResumeBlock,
  onFinishBlock,
  onContinue,
  onOpenComment,
  onAddBlock,
  onUploadPlan,
  onQuickStart
}) {
  const currentBlock = activeBlock || pausedBlock;

  // Case 1: Active or Paused Block in Execution
  if (currentBlock) {
    const isPaused = Boolean(pausedBlock) || currentBlock.IsPaused || currentBlock.status === "paused";
    const subject = currentBlock.PlannedSubject || currentBlock.subject || "Study Block";
    const topic = currentBlock.PlannedTopic || currentBlock.topic || currentBlock.custom_topic || "Active Session";
    const subtopic = currentBlock.subtopic || currentBlock.Subtopic || "";
    const plannedMinutes = Number(currentBlock.PlannedMinutes || currentBlock.planned_minutes || 0);
    const actualMinutes = Number(currentBlock.ActualMinutes || currentBlock.actual_minutes || 0);
    const startedAt = currentBlock.ActualStart || currentBlock.started_at;
    const planComment = currentBlock.plan_comment || currentBlock.PlanComment || "";

    const netElapsedMinutes = liveElapsedSec > 0 ? Math.floor(liveElapsedSec / 60) : actualMinutes;
    const timeProgressPercent = plannedMinutes > 0
      ? Math.min(100, Math.round((netElapsedMinutes / plannedMinutes) * 100))
      : 0;

    const isOverTarget = overTargetMinutes > 0;

    return (
      <section
        className="mos-live-study-workspace"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 20,
          boxShadow: "var(--shadow-card)",
          position: "relative",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%"
        }}
      >
        {/* Workspace Top Bar */}
        <div className="mos-workspace-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16, width: "100%" }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--brand-primary)"
                }}
              >
                {subject}
              </span>

              {/* Status Pill */}
              {isOverTarget ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--warning, #eab308)",
                    background: "rgba(234, 179, 8, 0.14)",
                    padding: "2px 8px",
                    borderRadius: 12
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning, #eab308)" }} />
                  OVER TARGET
                </span>
              ) : isPaused ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--warning, #eab308)",
                    background: "rgba(234, 179, 8, 0.14)",
                    padding: "2px 8px",
                    borderRadius: 12
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning, #eab308)" }} />
                  PAUSED
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--brand-primary)",
                    background: "var(--brand-primary-soft)",
                    padding: "2px 8px",
                    borderRadius: 12
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)" }} />
                  IN PROGRESS
                </span>
              )}
            </div>

            <h2
              className="mos-live-topic-title"
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 4px 0",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
            >
              {topic}
            </h2>

            {subtopic && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                {subtopic}
              </div>
            )}
          </div>

          {/* Time Metadata Badges */}
          <div className="mos-workspace-meta-badges" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                padding: "4px 10px",
                borderRadius: 8,
                whiteSpace: "nowrap"
              }}
            >
              Started: <strong>{formatClockTime(startedAt)}</strong>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                padding: "4px 10px",
                borderRadius: 8,
                whiteSpace: "nowrap"
              }}
            >
              Target: <strong>{formatDuration(plannedMinutes)}</strong>
            </div>
          </div>
        </div>

        {/* Big Live Timer & Metrics Display */}
        <div
          className="mos-live-timer-card"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            boxSizing: "border-box",
            width: "100%"
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {isPaused ? "PAUSED STUDY TIME" : "LIVE STUDY ELAPSED"}
            </div>
            <div
              className="mos-live-timer-digits"
              style={{
                fontFamily: "var(--mono, monospace)",
                fontSize: 44,
                fontWeight: 800,
                color: isOverTarget ? "var(--warning, #eab308)" : "var(--text-primary)",
                letterSpacing: "0.02em",
                lineHeight: 1
              }}
            >
              {formatElapsedTimer(liveElapsedSec)}
            </div>
          </div>

          <div className="mos-live-timer-meta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--mono, monospace)" }}>
              {netElapsedMinutes}m / {plannedMinutes}m
            </div>

            {isOverTarget && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--warning, #eab308)",
                  background: "rgba(234, 179, 8, 0.15)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap"
                }}
              >
                +{overTargetMinutes}m over target
              </span>
            )}

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
              {timeProgressPercent}% of time target
            </div>
          </div>
        </div>

        {/* Progress Bar (capped at 100%) */}
        <div style={{ marginBottom: 18, width: "100%" }}>
          <div style={{ height: 6, borderRadius: 3, background: "var(--border-default)", overflow: "hidden", width: "100%" }}>
            <div
              style={{
                height: "100%",
                width: `${timeProgressPercent}%`,
                background: isOverTarget
                  ? "var(--warning, #eab308)"
                  : "var(--brand-primary)",
                borderRadius: 3,
                transition: "width 0.3s ease"
              }}
            />
          </div>
        </div>

        {/* Plan Comment Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-subtle)",
            border: "1px dashed var(--border-default)",
            borderRadius: 10,
            padding: "8px 14px",
            marginBottom: 20,
            fontSize: 12,
            color: planComment ? "var(--text-primary)" : "var(--text-tertiary)",
            boxSizing: "border-box",
            width: "100%",
            gap: 8,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 180px", minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}>💬</span>
            <span style={{ fontStyle: planComment ? "normal" : "italic", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {planComment ? planComment : "No comment added for this study block"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenComment?.(currentBlock)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--brand-primary)",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
              padding: "4px 8px",
              flexShrink: 0
            }}
          >
            {planComment ? "Edit Note" : "+ Add Note"}
          </button>
        </div>

        {/* Action Controls Row */}
        <div className="mos-workspace-actions-row">
          <div className="mos-workspace-actions-group">
            {/* Primary Action: Finish & Review */}
            <button
              type="button"
              className="mos-btn-finish"
              disabled={busy}
              onClick={() => onFinishBlock?.(currentBlock)}
              style={{
                background: "var(--brand-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(10, 100, 245, 0.2)"
              }}
            >
              Finish & Review
            </button>

            {/* Over-Target Continue Button */}
            {isOverTarget && (
              <button
                type="button"
                className="mos-btn-continue"
                onClick={() => onContinue?.(currentBlock)}
                style={{
                  background: acknowledgedContinue ? "var(--bg-subtle)" : "transparent",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                {acknowledgedContinue ? "✓ Continuing" : "Continue"}
              </button>
            )}

            {/* Pause or Resume */}
            {isPaused ? (
              <button
                type="button"
                className="mos-btn-pause"
                disabled={busy}
                onClick={() => onResumeBlock?.(currentBlock.BlockId || currentBlock.block_id || currentBlock.id)}
                style={{
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                ▶ Resume Study
              </button>
            ) : (
              <button
                type="button"
                className="mos-btn-pause"
                disabled={busy}
                onClick={() => onPauseBlock?.(currentBlock.BlockId || currentBlock.block_id || currentBlock.id)}
                style={{
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                ⏸ Pause
              </button>
            )}
          </div>

          <div className="mos-workspace-comment-btn">
            <button
              type="button"
              className="mos-btn-comment"
              onClick={() => onOpenComment?.(currentBlock)}
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              + Comment
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Case 2: Next Block Scheduled (Ready to Start)
  if (nextBlock) {
    const subject = nextBlock.PlannedSubject || nextBlock.subject || "Study Block";
    const topic = nextBlock.PlannedTopic || nextBlock.topic || nextBlock.custom_topic || "Next Scheduled Topic";
    const subtopic = nextBlock.subtopic || nextBlock.Subtopic || "";
    const plannedMinutes = Number(nextBlock.PlannedMinutes || nextBlock.planned_minutes || 60);

    return (
      <section
        className="mos-live-study-workspace"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 20,
          boxShadow: "var(--shadow-card)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brand-primary)" }}>
                {subject}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  padding: "2px 8px",
                  borderRadius: 12
                }}
              >
                READY TO START
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
              {topic}
            </h2>

            {subtopic && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                {subtopic}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-secondary)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              padding: "6px 12px",
              borderRadius: 8
            }}
          >
            Target: <strong>{formatDuration(plannedMinutes)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onStartBlock?.(nextBlock.BlockId || nextBlock.block_id || nextBlock.id)}
            style={{
              background: "var(--brand-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(10, 100, 245, 0.25)"
            }}
          >
            Start Study
          </button>
          <button
            type="button"
            onClick={onAddBlock}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            + Add Another Block
          </button>
        </div>
      </section>
    );
  }

  // Case 3: Empty Day (No blocks planned)
  return (
    <section
      className="mos-live-study-workspace"
      style={{
        background: "var(--bg-surface)",
        border: "1px dashed var(--border-default)",
        borderRadius: 16,
        padding: "36px 28px",
        marginBottom: 20,
        boxShadow: "var(--shadow-card)",
        textAlign: "center"
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>📖</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px 0" }}>
        No Active Study Block
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 auto 20px auto", maxWidth: 460, lineHeight: 1.5 }}>
        Upload your handwritten daily plan, add structured study blocks, or launch a quick session to start tracking execution.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy}
          onClick={onUploadPlan}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          📷 Upload Daily Plan
        </button>
        <button
          type="button"
          onClick={onAddBlock}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          + Add Study Block
        </button>
        <button
          type="button"
          onClick={onQuickStart}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(10, 100, 245, 0.25)"
          }}
        >
          ⚡ Quick Start
        </button>
      </div>
    </section>
  );
}
