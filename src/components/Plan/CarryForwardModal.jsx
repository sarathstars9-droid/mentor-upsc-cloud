import React, { useState, useEffect } from "react";

const DURATION_CHIPS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "1h30m", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "2h30m", minutes: 150 },
  { label: "3h", minutes: 180 }
];

function getTomorrowDateString(baseDateStr) {
  const d = baseDateStr ? new Date(`${baseDateStr}T00:00:00`) : new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CarryForwardModal({
  open,
  block,
  onClose,
  onCarryForward,
  busy = false
}) {
  const [targetDate, setTargetDate] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [planComment, setPlanComment] = useState("");

  useEffect(() => {
    if (open && block) {
      setTargetDate(getTomorrowDateString(block.Date || block.day_key));
      const remainingMin = Math.max(30, (block.PlannedMinutes || 60) - (block.ActualMinutes || 0));
      setPlannedMinutes(remainingMin);

      // Requirement 8: When carrying forward, new block should clearly reflect pending work.
      // Do not blindly copy the entire old Study Review into next day's plan comment.
      const oldReview = String(block.study_review || block.StudyReview || "").trim();
      let pendingNote = "";
      if (oldReview) {
        if (oldReview.toLowerCase().includes("pending")) {
          pendingNote = oldReview;
        } else {
          pendingNote = `Pending from previous block: ${oldReview}`;
        }
      } else {
        pendingNote = `Pending: finish remaining topics for ${block.PlannedTopic || block.topic || "study block"}`;
      }

      setPlanComment(pendingNote);
    }
  }, [open, block]);

  if (!open || !block) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onCarryForward({
      blockId: block.BlockId || block.block_id || block.id,
      targetDate: targetDate,
      plannedMinutes: Math.round(Number(plannedMinutes) || 60),
      planComment: planComment.trim()
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 98vw)",
          backgroundColor: "var(--bg-surface)",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-default)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Work Continuity
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>
              Carry Pending Topic Forward
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Original Block</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {block.PlannedSubject || block.subject} • {block.PlannedTopic || block.topic}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Target: {block.PlannedMinutes || block.planned_minutes || 60}m • Actual done: {block.ActualMinutes || block.actual_minutes || 0}m
              {block.study_review ? ` • Note: "${block.study_review}"` : ""}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                padding: "0 12px",
                fontSize: 14,
                boxSizing: "border-box"
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              Target Duration for Remaining Work
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DURATION_CHIPS.map((chip) => {
                const isSelected = chip.minutes === plannedMinutes;
                return (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => setPlannedMinutes(chip.minutes)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSelected ? "2px solid #8b5cf6" : "1px solid var(--border-default)",
                      background: isSelected ? "rgba(139, 92, 246, 0.15)" : "var(--bg-subtle)",
                      color: isSelected ? "#a78bfa" : "var(--text-secondary)"
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              Plan Comment for Carried Block (Editable)
            </label>
            <textarea
              rows={3}
              value={planComment}
              onChange={(e) => setPlanComment(e.target.value)}
              placeholder="Clearly state what remains to be completed..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box"
              }}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                border: "none",
                background: "#8b5cf6",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)"
              }}
            >
              {busy ? "Carrying…" : "Confirm Carry Forward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
