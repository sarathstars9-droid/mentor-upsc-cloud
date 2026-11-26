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

  // 1. CURRENTLY STUDYING (Active or Paused)
  if (sectionType === "studying") {
    return (
      <div
        style={{
          background: isPaused
            ? "linear-gradient(145deg, var(--bg-surface), rgba(234, 179, 8, 0.08))"
            : "linear-gradient(145deg, var(--bg-surface), rgba(34, 197, 94, 0.08))",
          border: isPaused ? "2px solid var(--warning, #eab308)" : "2px solid var(--success, #16a34a)",
          borderRadius: 18,
          padding: "20px 24px",
          boxShadow: isPaused
            ? "0 8px 24px rgba(234, 179, 8, 0.12)"
            : "0 8px 24px rgba(22, 163, 74, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          position: "relative"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {subject}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  background: isPaused ? "rgba(234, 179, 8, 0.15)" : "rgba(34, 197, 94, 0.15)",
                  color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)"
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)" }} />
                {isPaused ? "PAUSED" : "LIVE"}
              </span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {topic}
              {subtopic && <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}> → {subtopic}</span>}
            </h3>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Target: {formatDuration(plannedMinutes)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Started: <strong>{formatClockTime(startedAt)}</strong>
            </div>
          </div>
        </div>

        {/* Big Live Elapsed Counter */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, background: "var(--bg-subtle)", padding: "12px 18px", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Elapsed</div>
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 26, fontWeight: 800, color: isPaused ? "var(--warning, #eab308)" : "var(--success, #16a34a)", letterSpacing: "0.04em" }}>
            {formatElapsedTimer(liveElapsedSec)}
          </div>
          {isPaused && (
            <span style={{ fontSize: 12, color: "var(--warning, #eab308)", fontWeight: 600 }}>(Timer paused)</span>
          )}
        </div>

        {/* Plan Comment or live notes */}
        {(planComment || studyReview) && (
          <div style={{ fontSize: 13, color: "var(--text-primary)", background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 8, borderLeft: "3px solid var(--brand-primary)" }}>
            {planComment && <div><span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>Plan: </span>{planComment}</div>}
            {studyReview && <div style={{ marginTop: 4 }}><span style={{ fontWeight: 700, color: "var(--success, #16a34a)" }}>Note: </span>{studyReview}</div>}
          </div>
        )}

        {/* Action Buttons: [+ Comment], [Pause/Resume], [Finish] */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onOpenComment?.(block)}
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
              color: "var(--text-primary)",
              fontSize: 13,
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
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--success, #16a34a)",
                background: "rgba(34, 197, 94, 0.12)",
                color: "var(--success, #16a34a)",
                fontSize: 13,
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
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--warning, #eab308)",
                background: "rgba(234, 179, 8, 0.12)",
                color: "var(--warning, #eab308)",
                fontSize: 13,
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
              padding: "8px 22px",
              borderRadius: 8,
              border: "none",
              background: "var(--success, #16a34a)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              marginLeft: "auto",
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)"
            }}
          >
            ✓ Finish Block
          </button>
        </div>
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
