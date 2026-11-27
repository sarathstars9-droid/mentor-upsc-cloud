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

export default function StudyBlockCard({
  block,
  sectionType, // "studying" | "next" | "completed" | "skipped"
  liveElapsedSec = 0,
  busy = false,
  onStart,
  onPause,
  onResume,
  onFinish,
  onOpenComment,
  onEdit,
  onEditReview,
  onCarryForward
}) {
  const subject = block.PlannedSubject || block.subject || "Study Block";
  const topic = block.PlannedTopic || block.topic || block.custom_topic || "";
  const subtopic = block.subtopic || block.Subtopic || "";
  const plannedMinutes = Number(block.PlannedMinutes || block.planned_minutes || 0);
  const actualMinutes = Number(block.ActualMinutes || block.actual_minutes || 0);
  const startedAt = block.ActualStart || block.started_at;
  const endedAt = block.ActualEnd || block.ended_at;
  const isPaused = block.IsPaused || block.status === "paused";
  const planComment = block.plan_comment || block.PlanComment || "";
  const studyReview = block.study_review || block.StudyReview || "";
  const completionPercent = block.completion_percent ?? block.CompletionPercent ?? null;
  const quality = block.quality || block.Quality || "";
  const source = block.source || block.source_type || "manual";
  const netElapsedMinutes = liveElapsedSec > 0 ? Math.floor(liveElapsedSec / 60) : actualMinutes;
  const overTargetMinutes = plannedMinutes > 0 && netElapsedMinutes > plannedMinutes ? (netElapsedMinutes - plannedMinutes) : 0;

  // 1. CURRENTLY STUDYING (Active or Paused) - Compact Horizontal Execution Card
  if (sectionType === "studying") {
    return (
      <div
        className="mos-active-block-card"
        style={{
          background: isPaused
            ? "linear-gradient(135deg, var(--bg-surface), rgba(234, 179, 8, 0.05))"
            : "linear-gradient(135deg, var(--bg-surface), rgba(34, 197, 94, 0.05))",
          border: isPaused ? "1px solid var(--warning, #eab308)" : "1px solid var(--success, #16a34a)",
          borderRadius: 14,
          padding: "16px 20px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {subject}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 7px",
                  borderRadius: 12,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  background: isPaused ? "rgba(234, 179, 8, 0.15)" : "rgba(34, 197, 94, 0.15)",
                  color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)"
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)" }} />
                {isPaused ? "PAUSED" : "LIVE"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Started: <strong>{formatClockTime(startedAt)}</strong>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                • Target: {formatDuration(plannedMinutes)}
              </span>
              {overTargetMinutes > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--warning, #eab308)",
                    background: "rgba(234, 179, 8, 0.14)",
                    padding: "2px 7px",
                    borderRadius: 8,
                    letterSpacing: "0.02em"
                  }}
                >
                  +{overTargetMinutes}m over target
                </span>
              )}
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
              {topic}
              {subtopic && <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}> → {subtopic}</span>}
            </h3>
          </div>

          {/* Proportional live timer and execution controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              background: "var(--bg-subtle)",
              padding: "6px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)"
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Elapsed
              </span>
              <span style={{
                fontFamily: "var(--mono, monospace)",
                fontSize: 20,
                fontWeight: 800,
                color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)",
                letterSpacing: "0.04em"
              }}>
                {formatElapsedTimer(liveElapsedSec)}
              </span>
              {overTargetMinutes > 0 && (
                <span style={{ fontSize: 10, color: "var(--warning, #eab308)", fontWeight: 700 }}>
                  (+{overTargetMinutes}m)
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => onOpenComment?.(block)}
                disabled={busy}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                + Comment
              </button>

              {isPaused ? (
                <button
                  type="button"
                  onClick={() => onResume?.(block.BlockId || block.block_id || block.id)}
                  disabled={busy}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--success, #16a34a)",
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "var(--success, #16a34a)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  ▶ Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPause?.(block.BlockId || block.block_id || block.id)}
                  disabled={busy}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--warning, #eab308)",
                    background: "rgba(234, 179, 8, 0.12)",
                    color: "var(--warning, #eab308)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  ⏸ Pause
                </button>
              )}

              <button
                type="button"
                onClick={() => onFinish?.(block)}
                disabled={busy}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--success, #16a34a)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)"
                }}
              >
                ✓ Finish Block
              </button>
            </div>
          </div>
        </div>

        {planComment && (
          <div style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            background: "var(--bg-subtle)",
            padding: "6px 12px",
            borderRadius: 6,
            borderLeft: "3px solid var(--brand-primary)"
          }}>
            <span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>Intent: </span>
            {planComment}
          </div>
        )}
      </div>
    );
  }

  // 2. NEXT (Planned blocks)
  if (sectionType === "next") {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "var(--shadow-card)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {subject}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {topic}
              {subtopic && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}> → {subtopic}</span>}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ padding: "4px 10px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              Target: {formatDuration(plannedMinutes)}
            </span>
          </div>
        </div>

        {planComment && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-subtle)", padding: "6px 10px", borderRadius: 6, borderLeft: "3px solid var(--border-default)" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Plan: </span>{planComment}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {source === "ocr" ? "Source: OCR" : (source === "carried_forward" ? "Source: Carried Forward" : "")}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onEdit?.(block)}
              disabled={busy}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onStart?.(block.BlockId || block.block_id || block.id)}
              disabled={busy}
              style={{
                padding: "6px 20px",
                borderRadius: 8,
                border: "none",
                background: "var(--brand-primary)",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(10, 100, 245, 0.25)"
              }}
            >
              ▶ START
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. COMPLETED
  if (sectionType === "completed") {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "var(--shadow-card)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--success, #16a34a)", fontWeight: 800 }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success, #16a34a)", textTransform: "uppercase" }}>
                {subject}
              </span>
              {quality && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(34, 197, 94, 0.12)", color: "var(--success, #16a34a)" }}>
                  {quality}
                </span>
              )}
              {completionPercent !== null && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                  {completionPercent}%
                </span>
              )}
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {topic}
              {subtopic && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}> → {subtopic}</span>}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              Actual: <span style={{ color: "var(--success, #16a34a)" }}>{formatDuration(actualMinutes)}</span>
              <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}> (Target: {formatDuration(plannedMinutes)})</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {formatClockTime(startedAt)} → {formatClockTime(endedAt)}
            </div>
          </div>
        </div>

        {planComment && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            <strong>Intent:</strong> {planComment}
          </div>
        )}

        {studyReview && (
          <div style={{ fontSize: 13, color: "var(--text-primary)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid var(--success, #16a34a)" }}>
            <span style={{ fontWeight: 700, color: "var(--success, #16a34a)" }}>Review: </span>
            {studyReview}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onEditReview?.(block)}
            disabled={busy}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Edit Review
          </button>

          <button
            type="button"
            onClick={() => onCarryForward?.(block)}
            disabled={busy}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid rgba(139, 92, 246, 0.3)",
              background: "rgba(139, 92, 246, 0.12)",
              color: "#a78bfa",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Carry Pending Topic →
          </button>
        </div>
      </div>
    );
  }

  // 4. SKIPPED / CARRIED FORWARD
  return (
    <div
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "14px 18px",
        opacity: 0.85,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{subject}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{topic}</div>
        {planComment && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{planComment}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--border-subtle)", color: "var(--text-secondary)" }}>
          {block.status || "skipped"}
        </span>
        <button
          type="button"
          onClick={() => onCarryForward?.(block)}
          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: 11, fontWeight: 600, color: "var(--brand-primary)", cursor: "pointer" }}
        >
          Reschedule
        </button>
      </div>
    </div>
  );
}
