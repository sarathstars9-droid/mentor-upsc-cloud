import React from "react";

export default function NextBestAction({
  activeBlock,
  pausedBlock,
  nextBlock,
  todayBlocks = [],
  dashboardMetrics,
  onStartBlock,
  onResumeBlock,
  onFinishBlock,
  onCarryForward,
  onAddBlock,
  onUploadPlan,
  onQuickStart,
  onOpenNightReview
}) {
  const totalBlocks = todayBlocks.length;
  const completedBlocks = todayBlocks.filter(b => {
    const s = (b.Status || b.status || "").toLowerCase();
    return s === "completed" || s === "done";
  });
  const skippedOrPartialBlocks = todayBlocks.filter(b => {
    const s = (b.Status || b.status || "").toLowerCase();
    return s === "skipped" || s === "stopped" || s === "missed";
  });

  let actionConfig = null;

  // Priority 1: Active Block
  if (activeBlock) {
    const sub = activeBlock.PlannedSubject || activeBlock.subject || "Study Block";
    const top = activeBlock.PlannedTopic || activeBlock.topic || activeBlock.custom_topic || "Active Topic";
    actionConfig = {
      badge: "LIVE STUDYING",
      badgeColor: "var(--success, #16a34a)",
      icon: "⚡",
      title: `Continue studying ${sub}`,
      description: `Current session: "${top}". Complete your target duration before switching topics.`,
      primaryActionLabel: "Finish Block",
      primaryActionClick: () => onFinishBlock?.(activeBlock),
      primaryButtonStyle: {
        background: "var(--success, #16a34a)",
        color: "#ffffff"
      }
    };
  }
  // Priority 2: Paused Block
  else if (pausedBlock) {
    const sub = pausedBlock.PlannedSubject || pausedBlock.subject || "Study Block";
    const top = pausedBlock.PlannedTopic || pausedBlock.topic || pausedBlock.custom_topic || "Paused Topic";
    actionConfig = {
      badge: "SESSION PAUSED",
      badgeColor: "var(--warning, #eab308)",
      icon: "⏸️",
      title: `Resume ${sub}`,
      description: `"${top}" is paused. Resume the timer to finish your scheduled study quota.`,
      primaryActionLabel: "▶ Resume Block",
      primaryActionClick: () => onResumeBlock?.(pausedBlock.BlockId || pausedBlock.block_id || pausedBlock.id),
      primaryButtonStyle: {
        background: "var(--warning, #eab308)",
        color: "#1e293b"
      }
    };
  }
  // Priority 3: Pending Planned Blocks
  else if (nextBlock) {
    const sub = nextBlock.PlannedSubject || nextBlock.subject || "Study Block";
    const top = nextBlock.PlannedTopic || nextBlock.topic || nextBlock.custom_topic || "Upcoming Topic";
    const mins = nextBlock.PlannedMinutes || nextBlock.planned_minutes || 60;
    actionConfig = {
      badge: "NEXT RECOMMENDED",
      badgeColor: "var(--brand-primary)",
      icon: "🎯",
      title: `Start ${sub}: ${top}`,
      description: `Scheduled duration: ${mins} minutes. Focus on high-retention syllabus coverage.`,
      primaryActionLabel: `Start ${sub} ›`,
      primaryActionClick: () => onStartBlock?.(nextBlock.BlockId || nextBlock.block_id || nextBlock.id),
      primaryButtonStyle: {
        background: "var(--brand-primary)",
        color: "#ffffff"
      }
    };
  }
  // Priority 4: Partial / Skipped Work to Carry Forward
  else if (skippedOrPartialBlocks.length > 0) {
    const target = skippedOrPartialBlocks[0];
    const sub = target.PlannedSubject || target.subject || "Study Block";
    const top = target.PlannedTopic || target.topic || target.custom_topic || "Incomplete Topic";
    actionConfig = {
      badge: "RECOVERY / CARRY FORWARD",
      badgeColor: "var(--text-tertiary)",
      icon: "↩️",
      title: `Carry forward unfinished ${sub}`,
      description: `"${top}" was skipped or partially completed. Move it to tomorrow's schedule so no syllabus backlog accumulates.`,
      primaryActionLabel: "Carry Forward ›",
      primaryActionClick: () => onCarryForward?.(target),
      primaryButtonStyle: {
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        color: "var(--text-primary)"
      }
    };
  }
  // Priority 5: No Plan Scheduled Today
  else if (totalBlocks === 0) {
    actionConfig = {
      badge: "DAY NOT PLANNED",
      badgeColor: "var(--brand-primary)",
      icon: "📋",
      title: "Set up today's study plan",
      description: "Upload a handwritten daily plan, create custom study blocks, or launch a Quick Start session.",
      primaryActionLabel: "+ Add Study Block",
      primaryActionClick: () => onAddBlock?.(),
      secondaryActionLabel: "⚡ Quick Start",
      secondaryActionClick: () => onQuickStart?.(),
      tertiaryActionLabel: "📷 Upload Plan",
      tertiaryActionClick: () => onUploadPlan?.(),
      primaryButtonStyle: {
        background: "var(--brand-primary)",
        color: "#ffffff"
      }
    };
  }
  // Priority 6: Day Complete
  else if (totalBlocks > 0 && completedBlocks.length === totalBlocks) {
    actionConfig = {
      badge: "DAY COMPLETE",
      badgeColor: "var(--success, #16a34a)",
      icon: "🏆",
      title: "All study blocks completed today!",
      description: "Great execution today. Complete a 5-minute review of key takeaways and draft tomorrow's targets.",
      primaryActionLabel: "Review Today's Execution ›",
      primaryActionClick: () => onOpenNightReview?.(),
      primaryButtonStyle: {
        background: "var(--brand-primary)",
        color: "#ffffff"
      }
    };
  }

  if (!actionConfig) return null;

  return (
    <div className="mos-next-best-action" style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 14,
      padding: "16px 20px",
      marginBottom: 20,
      boxShadow: "var(--shadow-card)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 16
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, maxWidth: 680 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0
        }}>
          {actionConfig.icon}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: actionConfig.badgeColor
            }}>
              NEXT BEST ACTION • {actionConfig.badge}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {actionConfig.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
            {actionConfig.description}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {actionConfig.tertiaryActionLabel && (
          <button
            type="button"
            onClick={actionConfig.tertiaryActionClick}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {actionConfig.tertiaryActionLabel}
          </button>
        )}

        {actionConfig.secondaryActionLabel && (
          <button
            type="button"
            onClick={actionConfig.secondaryActionClick}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--brand-primary)",
              background: "var(--brand-primary-soft)",
              color: "var(--brand-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {actionConfig.secondaryActionLabel}
          </button>
        )}

        {actionConfig.primaryActionLabel && (
          <button
            type="button"
            onClick={actionConfig.primaryActionClick}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              ...actionConfig.primaryButtonStyle
            }}
          >
            {actionConfig.primaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
