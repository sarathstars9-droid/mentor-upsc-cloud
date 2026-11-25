import React, { useState, useEffect } from "react";

const DURATION_CHIPS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "1h30m", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "2h30m", minutes: 150 },
  { label: "3h", minutes: 180 },
  { label: "3h30m", minutes: 210 }
];

export default function EditPlannedBlockModal({
  open,
  block,
  onClose,
  onSavePatch,
  onDuplicate,
  onMoveToTomorrow,
  onSkip,
  onDelete,
  busy = false
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [planComment, setPlanComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && block) {
      setSubject(block.PlannedSubject || block.subject || "");
      setTopic(block.PlannedTopic || block.topic || block.custom_topic || "");
      setSubtopic(block.subtopic || block.Subtopic || "");
      setPlannedMinutes(Number(block.PlannedMinutes || block.planned_minutes || 60));
      setPlanComment(block.plan_comment || block.PlanComment || "");
      setError("");
    }
  }, [open, block]);

  if (!open || !block) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!topic.trim()) {
      setError("Topic is required.");
      return;
    }
    const mins = Number(plannedMinutes);
    if (!Number.isInteger(mins) || mins <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }

    onSavePatch({
      blockId: block.BlockId || block.block_id || block.id,
      dayKey: block.Date || block.day_key,
      patch: {
        subject: subject.trim(),
        topic: topic.trim(),
        subtopic: subtopic.trim(),
        customTopic: topic.trim(),
        plannedMinutes: mins,
        planComment: planComment.trim()
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
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
          width: "min(560px, 98vw)",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Planned Block
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "2px 0 0 0" }}>
              Edit Study Block
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13, boxSizing: "border-box" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13, boxSizing: "border-box" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Subtopic (Optional)
            </label>
            <input
              type="text"
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Duration: {plannedMinutes} min
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DURATION_CHIPS.map((chip) => {
                const isSelected = plannedMinutes === chip.minutes;
                return (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => setPlannedMinutes(chip.minutes)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSelected ? "2px solid #0A64F5" : "1px solid #cbd5e1",
                      background: isSelected ? "#0A64F5" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#1e293b"
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Plan Comment (Intent)
            </label>
            <textarea
              rows={3}
              value={planComment}
              onChange={(e) => setPlanComment(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {/* Quick actions: Move to tomorrow, Duplicate, Skip, Delete */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => onDuplicate?.(block)}
              disabled={busy}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer" }}
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => onMoveToTomorrow?.(block)}
              disabled={busy}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#8b5cf6", cursor: "pointer" }}
            >
              Move to Tomorrow
            </button>
            <button
              type="button"
              onClick={() => onSkip?.(block)}
              disabled={busy}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#d97706", cursor: "pointer" }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(block)}
              disabled={busy}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", marginLeft: "auto" }}
            >
              Delete
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#0A64F5", color: "#ffffff", fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
