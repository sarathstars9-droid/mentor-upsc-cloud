import React, { useState, useEffect } from "react";
import { getTimeAwareGreeting } from "../../utils/greetingUtils";

export default function MentorHeader({
  userName = "Moulika",
  date,
  onDateChange,
  activeBlock,
  pausedBlock,
  nextBlock,
  todayBlocks = [],
  dashboardMetrics,
  planPhoto,
  onUploadClick,
  onViewPhotoClick,
  onAddBlockClick,
  onQuickStartClick,
  busy = false
}) {
  const [greeting, setGreeting] = useState(() => getTimeAwareGreeting());
  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => {
    const update = () => setGreeting(getTimeAwareGreeting());
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  // Compute realistic contextual analysis & explanation (not a duplicate action trigger)
  let insightBadge = "DAILY STRATEGY ARCHITECTURE";
  let insightTitle = "Structuring your daily roadmap";
  let insightDetail = "Unscheduled days increase cognitive friction and risk syllabus drift. Define 2–4 high-leverage study blocks or upload your handwritten daily schedule to establish momentum.";

  const totalBlocks = todayBlocks.length;
  const completedBlocks = todayBlocks.filter(b => {
    const s = (b.Status || b.status || "").toLowerCase();
    return s === "completed" || s === "done";
  }).length;

  if (activeBlock) {
    const sub = activeBlock.PlannedSubject || activeBlock.subject || "Current Subject";
    const top = activeBlock.PlannedTopic || activeBlock.topic || activeBlock.custom_topic || "active topic";
    insightBadge = "ACTIVE SESSION ANALYSIS";
    insightTitle = `Deep work in progress on ${sub}`;
    insightDetail = `You are currently covering "${top}". Maintain uninterrupted focus through your target duration. Consolidate key terminology and linkages before finalizing this block.`;
  } else if (pausedBlock) {
    const sub = pausedBlock.PlannedSubject || pausedBlock.subject || "Paused Subject";
    const top = pausedBlock.PlannedTopic || pausedBlock.topic || pausedBlock.custom_topic || "paused topic";
    insightBadge = "BREAK & RECOVERY ANALYSIS";
    insightTitle = `Session temporarily paused on ${sub}`;
    insightDetail = `"${top}" was paused. Short strategic breaks assist memory consolidation, but resuming promptly preserves session momentum and prevents study fatigue.`;
  } else if (nextBlock) {
    const sub = nextBlock.PlannedSubject || nextBlock.subject || "Next Subject";
    const top = nextBlock.PlannedTopic || nextBlock.topic || nextBlock.custom_topic || "topic";
    insightBadge = "SYLLABUS EXECUTION STRATEGY";
    insightTitle = `Next scheduled focus: ${sub}`;
    insightDetail = `Preparing for "${top}". High-yield UPSC coverage favors active conceptual synthesis and diagram practice over passive reading.`;
  } else if (totalBlocks > 0 && completedBlocks === totalBlocks) {
    insightBadge = "DAILY MILESTONE EVALUATION";
    insightTitle = "100% of planned study blocks achieved";
    insightDetail = "All planned blocks for today have been executed. Consistent daily execution is the primary driver of top ranks in UPSC CSE 2027. Conduct a quick night review to cement recall.";
  }

  // Format date display
  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date + "T00:00:00"));

  return (
    <header className="mos-mentor-header" style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 18,
      padding: "24px 28px",
      marginBottom: 20,
      boxShadow: "var(--shadow-card)"
    }}>
      {/* Top greeting and date row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 16,
        borderBottom: "1px solid var(--border-subtle)",
        paddingBottom: 18,
        marginBottom: 18
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--brand-primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4
          }}>
            DAILY STUDY COMMAND CENTER
          </div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.02em"
          }}>
            {greeting}, <span style={{ color: "var(--brand-primary)" }}>{userName}.</span>
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
            {dateFormatted}
          </div>
        </div>

        {/* Primary Study Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy}
            onClick={onUploadClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 15px",
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "border-color 0.15s ease"
            }}
          >
            📷 Upload Daily Plan
          </button>

          {planPhoto && (
            <button
              type="button"
              onClick={onViewPhotoClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 15px",
                borderRadius: 10,
                border: "1px solid var(--brand-primary)",
                background: "var(--brand-primary-soft)",
                color: "var(--brand-primary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🔍 View Uploaded Plan
            </button>
          )}

          <button
            type="button"
            onClick={onAddBlockClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 15px",
              borderRadius: 10,
              border: "1px solid var(--success, #16a34a)",
              background: "rgba(34, 197, 94, 0.08)",
              color: "var(--success, #16a34a)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            + Add Study Block
          </button>

          <button
            type="button"
            onClick={onQuickStartClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--brand-primary)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(10, 100, 245, 0.25)"
            }}
          >
            ⚡ Quick Start
          </button>
        </div>
      </div>

      {/* Mentor Insight card: Contextual Analysis & Strategic Explanation */}
      <div style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--brand-primary-soft)",
          color: "var(--brand-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0
        }}>
          💡
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 2
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--brand-primary)"
            }}>
              MENTOR INSIGHT • {insightBadge}
            </span>
            <button
              type="button"
              onClick={() => setShowReasoning(prev => !prev)}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px 6px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--brand-primary)",
                cursor: "pointer",
                borderRadius: 4
              }}
            >
              {showReasoning ? "Hide reasoning ▴" : "View reasoning ▾"}
            </button>
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.4
          }}>
            {insightTitle}
          </div>
          {/* Expandable reasoning section for compact presentation on mobile */}
          {showReasoning && (
            <div style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px dashed var(--border-subtle)",
              lineHeight: 1.45
            }}>
              {insightDetail}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
