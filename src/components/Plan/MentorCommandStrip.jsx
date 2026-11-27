import React from "react";

export default function MentorCommandStrip({
  activeBlock,
  pausedBlock,
  nextBlock,
  todayBlocks = [],
  dashboardMetrics,
  overTargetMinutes = 0,
  acknowledgedContinue = false,
  onFinishBlock,
  onContinue,
  onStartBlock,
  onResumeBlock,
  onOpenComment,
  onAddBlock,
  onUploadPlan,
  onQuickStart,
  onOpenDailyReview
}) {
  const totalBlocks = todayBlocks.length;
  const completedBlocks = todayBlocks.filter(b => {
    const s = (b.Status || b.status || "").toLowerCase();
    return s === "completed" || s === "done";
  });

  let stateBadge = "DAILY COMMAND";
  let stateMessage = "Build your daily study plan to maintain momentum for UPSC CSE 2027.";
  let actionButtons = null;
  let accentColor = "var(--brand-primary)";

  // State 1: Active block over target
  if (activeBlock && overTargetMinutes > 0 && !acknowledgedContinue) {
    const sub = activeBlock.PlannedSubject || activeBlock.subject || "Study Block";
    const planned = Number(activeBlock.PlannedMinutes || activeBlock.planned_minutes || 0);
    stateBadge = "OVER TARGET DURATION";
    accentColor = "var(--warning, #eab308)";
    stateMessage = `${sub} is ${overTargetMinutes} minutes over its planned duration (${planned}m target).`;
    actionButtons = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onFinishBlock?.(activeBlock)}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }}
        >
          Finish & Review
        </button>
        <button
          type="button"
          onClick={() => onContinue?.(activeBlock)}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Continue
        </button>
      </div>
    );
  }
  // State 2: Active block within target
  else if (activeBlock) {
    const sub = activeBlock.PlannedSubject || activeBlock.subject || "Study Block";
    stateBadge = "ACTIVE STUDY SESSION";
    accentColor = "var(--brand-primary)";
    stateMessage = `You're studying ${sub}. Continue this block or finish when the planned work is completed.`;
    actionButtons = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onFinishBlock?.(activeBlock)}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Finish & Review
        </button>
        <button
          type="button"
          onClick={() => onOpenComment?.(activeBlock)}
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          + Comment
        </button>
      </div>
    );
  }
  // State 3: Paused session
  else if (pausedBlock) {
    const sub = pausedBlock.PlannedSubject || pausedBlock.subject || "Study Block";
    stateBadge = "SESSION PAUSED";
    accentColor = "var(--warning, #eab308)";
    stateMessage = `Your ${sub} session is paused. Resume when you are ready to continue.`;
    actionButtons = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onResumeBlock?.(pausedBlock.BlockId || pausedBlock.block_id || pausedBlock.id)}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Resume Study
        </button>
        <button
          type="button"
          onClick={() => onFinishBlock?.(pausedBlock)}
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Finish & Review
        </button>
      </div>
    );
  }
  // State 4: Ready to start next block
  else if (nextBlock) {
    const sub = nextBlock.PlannedSubject || nextBlock.subject || "Study Block";
    const top = nextBlock.PlannedTopic || nextBlock.topic || nextBlock.custom_topic || "Topic";
    const planned = Number(nextBlock.PlannedMinutes || nextBlock.planned_minutes || 60);
    stateBadge = "NEXT BLOCK READY";
    accentColor = "var(--brand-primary)";
    stateMessage = `Ready to start ${sub}: ${top} (${planned}m target).`;
    actionButtons = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onStartBlock?.(nextBlock.BlockId || nextBlock.block_id || nextBlock.id)}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
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
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          + Add Block
        </button>
      </div>
    );
  }
  // State 5: All planned blocks completed
  else if (totalBlocks > 0 && completedBlocks.length === totalBlocks) {
    stateBadge = "DAILY QUOTA ACHIEVED";
    accentColor = "var(--success, #16a34a)";
    stateMessage = "Today's planned study blocks are complete. Consolidate your recall and log your daily progress.";
    actionButtons = (
      <button
        type="button"
        onClick={onOpenDailyReview}
        style={{
          background: "var(--brand-primary)",
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          padding: "7px 16px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer"
        }}
      >
        Open Daily Review
      </button>
    );
  }
  // State 6: No plan
  else {
    stateBadge = "NO ACTIVE PLAN";
    accentColor = "var(--text-tertiary)";
    stateMessage = "No study blocks planned for today. Upload a handwritten schedule, add study blocks, or launch Quick Start.";
    actionButtons = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onUploadPlan}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          📷 Upload Plan
        </button>
        <button
          type="button"
          onClick={onAddBlock}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          + Add Block
        </button>
        <button
          type="button"
          onClick={onQuickStart}
          style={{
            background: "var(--brand-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          ⚡ Quick Start
        </button>
      </div>
    );
  }

  return (
    <div
      className="mos-command-strip"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 12,
        padding: "14px 20px",
        marginBottom: 20,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 14,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 auto", minWidth: 0, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: accentColor,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            padding: "3px 8px",
            borderRadius: 6,
            flexShrink: 0
          }}
        >
          {stateBadge}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>
          {stateMessage}
        </span>
      </div>

      <div className="mos-command-strip-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {actionButtons}
      </div>
    </div>
  );
}
