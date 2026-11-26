import React, { useState, useEffect } from "react";

const COMPLETION_OPTIONS = [25, 50, 75, 100];
const QUALITY_OPTIONS = ["Poor", "Okay", "Good", "Strong"];

function formatTimeOnly(dateObj) {
  if (!dateObj) return "—";
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function toTimeInputValue(dateObj) {
  if (!dateObj) return "";
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function CompletionSheetModal({
  open,
  block,
  onClose,
  onComplete,
  busy = false
}) {
  const [endTimeInput, setEndTimeInput] = useState("");
  const [completionPercent, setCompletionPercent] = useState(75);
  const [quality, setQuality] = useState("Good");
  const [studyReview, setStudyReview] = useState("");
  const [actualMinutesCalculated, setActualMinutesCalculated] = useState(0);
  const [error, setError] = useState("");

  const startedAt = block?.ActualStart ? new Date(block.ActualStart) : (block?.started_at ? new Date(block.started_at) : new Date());

  useEffect(() => {
    if (open && block) {
      const now = new Date();
      setEndTimeInput(toTimeInputValue(now));
      setCompletionPercent(block.completion_percent || block.CompletionPercent || 75);
      setQuality(block.quality || block.Quality || "Good");
      setStudyReview(block.study_review || block.StudyReview || "");
      setError("");
    }
  }, [open, block]);

  // Recalculate actual study minutes whenever endTimeInput changes
  useEffect(() => {
    if (!startedAt || isNaN(startedAt.getTime()) || !endTimeInput) {
      setActualMinutesCalculated(0);
      return;
    }

    const [hh, mm] = endTimeInput.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return;

    const endCandidate = new Date(startedAt);
    endCandidate.setHours(hh, mm, 0, 0);

    const pauseSec = Number(block?.TotalPauseSeconds || block?.total_pause_seconds || 0);

    let diffMs = endCandidate.getTime() - startedAt.getTime();
    if (diffMs < 0) {
      if (Math.abs(diffMs) < 60000) {
        diffMs = 60000;
      } else if (startedAt.getHours() >= 20) {
        // Possible midnight crossing
        const nextDayEnd = new Date(endCandidate.getTime() + 24 * 60 * 60 * 1000);
        const crossDiff = nextDayEnd.getTime() - startedAt.getTime();
        if (crossDiff > 0 && crossDiff <= 16 * 3600 * 1000) {
          diffMs = crossDiff;
        }
      }
    }

    const totalActualMins = Math.max(0, Math.round((diffMs - pauseSec * 1000) / 60000));
    setActualMinutesCalculated(totalActualMins);
  }, [endTimeInput, startedAt, block]);

  if (!open || !block) return null;

  function formatDurationDisplay(minutes) {
    const mins = Number(minutes) || 0;
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!endTimeInput) {
      setError("Please specify the study end time.");
      return;
    }

    const [hh, mm] = endTimeInput.split(":").map(Number);
    const endCandidate = new Date(startedAt);
    endCandidate.setHours(hh, mm, 0, 0);

    let finalEndDate = endCandidate;
    if (endCandidate.getTime() < startedAt.getTime()) {
      if (startedAt.getTime() - endCandidate.getTime() < 60000) {
        // Same minute rounding edge case: within 60s
        finalEndDate = new Date(startedAt.getTime() + 60000);
      } else {
        const nextDayCandidate = new Date(endCandidate.getTime() + 24 * 60 * 60 * 1000);
        if (nextDayCandidate.getTime() - startedAt.getTime() <= 16 * 3600 * 1000 && startedAt.getHours() >= 20) {
          finalEndDate = nextDayCandidate;
        } else {
          setError("End time cannot be earlier than start time.");
          return;
        }
      }
    }

    onComplete({
      blockId: block.BlockId || block.block_id || block.id,
      dayKey: block.Date || block.day_key,
      actualEndTime: finalEndDate.toISOString(),
      actualMinutes: actualMinutesCalculated,
      completionPercent,
      quality,
      studyReview: studyReview.trim(),
      reason: "completed"
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
          width: "min(580px, 98vw)",
          maxHeight: "92vh",
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
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--success, #16a34a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Study Execution Complete
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>
              Finish: {block.PlannedSubject || block.subject || "Study Block"}
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {block.PlannedTopic || block.topic || block.custom_topic || ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)" }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid var(--error, #dc2626)", borderRadius: 10, color: "var(--error, #dc2626)", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Timing Section: Start, End (editable), Actual Duration */}
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Started</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                {formatTimeOnly(startedAt)}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase", marginBottom: 2 }}>
                End Time (Correct)
              </label>
              <input
                type="time"
                value={endTimeInput}
                onChange={(e) => setEndTimeInput(e.target.value)}
                style={{
                  height: 32,
                  width: "100%",
                  padding: "0 6px",
                  borderRadius: 6,
                  border: "1px solid var(--brand-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  background: "var(--bg-surface)"
                }}
              />
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success, #16a34a)", textTransform: "uppercase" }}>Actual Time</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--success, #16a34a)", marginTop: 2 }}>
                {formatDurationDisplay(actualMinutesCalculated)}
              </div>
            </div>
          </div>

          {/* Completion % Chips */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              Completion Percentage
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {COMPLETION_OPTIONS.map((val) => {
                const isSelected = completionPercent === val;
                return (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setCompletionPercent(val)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--brand-primary)" : "1px solid var(--border-default)",
                      background: isSelected ? "var(--brand-primary)" : "var(--bg-subtle)",
                      color: isSelected ? "#ffffff" : "var(--text-secondary)"
                    }}
                  >
                    {val}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality Chips */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              Study Quality
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {QUALITY_OPTIONS.map((q) => {
                const isSelected = quality.toLowerCase() === q.toLowerCase();
                return (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setQuality(q)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--success, #16a34a)" : "1px solid var(--border-default)",
                      background: isSelected ? "rgba(34, 197, 94, 0.15)" : "var(--bg-subtle)",
                      color: isSelected ? "var(--success, #16a34a)" : "var(--text-secondary)"
                    }}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STUDY REVIEW / COMMENT */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
              STUDY REVIEW / COMMENT
            </label>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>
              What did you actually study / learn / struggle with? (Preserved for Log Book and carry forward)
            </div>
            <textarea
              rows={4}
              placeholder={`e.g. "Completed Jet Streams notes.\nPYQs still pending.\nWeak in subtropical jet mechanism.\nRevise tomorrow."`}
              value={studyReview}
              onChange={(e) => setStudyReview(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box"
              }}
              autoFocus
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
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
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: "var(--success, #16a34a)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)"
              }}
            >
              {busy ? "Saving..." : "✓ COMPLETE BLOCK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
