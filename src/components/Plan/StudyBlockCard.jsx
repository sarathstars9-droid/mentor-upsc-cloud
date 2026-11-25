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
  return rem > 0 ? `${hrs}h${rem}m` : `${hrs}h`;
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
          background: "linear-gradient(145deg, #ffffff, #f0fdf4)",
          border: isPaused ? "2px solid #eab308" : "2px solid #16a34a",
          borderRadius: 18,
          padding: "20px 24px",
          boxShadow: isPaused ? "0 10px 25px rgba(234, 179, 8, 0.15)" : "0 10px 25px rgba(22, 163, 74, 0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          position: "relative"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: isPaused ? "#b45309" : "#15803d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
                  background: isPaused ? "rgba(234, 179, 8, 0.15)" : "rgba(22, 163, 74, 0.15)",
                  color: isPaused ? "#b45309" : "#16a34a"
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPaused ? "#eab308" : "#16a34a" }} />
                {isPaused ? "PAUSED" : "LIVE"}
              </span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {topic}
              {subtopic && <span style={{ color: "#64748b", fontWeight: 600 }}> → {subtopic}</span>}
            </h3>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Target: {formatDuration(plannedMinutes)}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
              Started: <strong>{formatClockTime(startedAt)}</strong>
            </div>
          </div>
        </div>

        {/* Big Live Elapsed Counter */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, background: "rgba(255, 255, 255, 0.7)", padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(22, 163, 74, 0.2)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Elapsed</div>
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 26, fontWeight: 800, color: isPaused ? "#b45309" : "#16a34a", letterSpacing: "0.04em" }}>
            {formatElapsedTimer(liveElapsedSec)}
          </div>
          {isPaused && (
            <span style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>(Timer paused)</span>
          )}
        </div>

        {/* Plan Comment or live notes */}
        {(planComment || studyReview) && (
          <div style={{ fontSize: 13, color: "#334155", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid #0A64F5" }}>
            {planComment && <div><span style={{ fontWeight: 700, color: "#0A64F5" }}>Plan: </span>{planComment}</div>}
            {studyReview && <div style={{ marginTop: 4 }}><span style={{ fontWeight: 700, color: "#16a34a" }}>Note: </span>{studyReview}</div>}
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
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
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
                border: "1px solid #16a34a",
                background: "rgba(22, 163, 74, 0.1)",
                color: "#15803d",
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
                border: "1px solid #eab308",
                background: "rgba(234, 179, 8, 0.1)",
                color: "#b45309",
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
              background: "#16a34a",
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
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {subject}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              {topic}
              {subtopic && <span style={{ color: "#64748b", fontWeight: 500 }}> → {subtopic}</span>}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ padding: "4px 10px", background: "#f1f5f9", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#334155" }}>
              Target: {formatDuration(plannedMinutes)}
            </span>
          </div>
        </div>

        {planComment && (
          <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "6px 10px", borderRadius: 6, borderLeft: "3px solid #cbd5e1" }}>
            <span style={{ fontWeight: 600, color: "#334155" }}>Plan: </span>{planComment}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
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
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
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
                background: "#0A64F5",
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
          background: "#ffffff",
          border: "1px solid #dcfce7",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#16a34a", fontWeight: 800 }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d", textTransform: "uppercase" }}>
                {subject}
              </span>
              {quality && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(22, 163, 74, 0.1)", color: "#15803d" }}>
                  {quality}
                </span>
              )}
              {completionPercent !== null && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "#f1f5f9", color: "#334155" }}>
                  {completionPercent}%
                </span>
              )}
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              {topic}
              {subtopic && <span style={{ color: "#64748b", fontWeight: 500 }}> → {subtopic}</span>}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              Actual: <span style={{ color: "#16a34a" }}>{formatDuration(actualMinutes)}</span>
              <span style={{ color: "#94a3b8", fontWeight: 500 }}> (Target: {formatDuration(plannedMinutes)})</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {formatClockTime(startedAt)} → {formatClockTime(endedAt)}
            </div>
          </div>
        </div>

        {planComment && (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <strong>Intent:</strong> {planComment}
          </div>
        )}

        {studyReview && (
          <div style={{ fontSize: 13, color: "#1e293b", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid #16a34a" }}>
            <span style={{ fontWeight: 700, color: "#15803d" }}>Review: </span>
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
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
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
              border: "1px solid #c4b5fd",
              background: "rgba(139, 92, 246, 0.08)",
              color: "#7c3aed",
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
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "14px 18px",
        opacity: 0.75,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{subject}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{topic}</div>
        {planComment && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{planComment}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#e2e8f0", color: "#475569" }}>
          {block.status || "skipped"}
        </span>
        <button
          type="button"
          onClick={() => onCarryForward?.(block)}
          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 11, fontWeight: 600, color: "#0A64F5", cursor: "pointer" }}
        >
          Reschedule
        </button>
      </div>
    </div>
  );
}
