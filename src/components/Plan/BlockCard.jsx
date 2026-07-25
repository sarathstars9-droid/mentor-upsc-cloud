import { getDisplayStatus } from "../../utils/studyEngine";
import { useBlockTiming, formatConciseDuration } from "../../hooks/useBlockTiming";

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isMisc = (v) => /^misc/i.test(String(v || "").trim());

function deriveTitle(block) {
  const topic   = String(block.PlannedTopic   || "").trim();
  const subject = String(block.PlannedSubject || "").trim();
  const micro   = String(block.MappingMicroTheme || "").trim();
  const mapped  = String(block.finalMapping?.nodeName || "").trim();
  if (topic  && topic.toLowerCase()  !== subject.toLowerCase()) return topic;
  if (micro  && micro.toLowerCase()  !== subject.toLowerCase()) return micro;
  if (mapped && mapped.toLowerCase() !== subject.toLowerCase()) return mapped;
  return subject || "Study Block";
}

function derivePaper(block) {
  const explicit = String(block.GsPaper || "").trim().toUpperCase();
  if (explicit) return explicit;
  const nid = String(block.SyllabusNodeId || block.finalMapping?.nodeId || block.SyllabusTop1Code || "");
  const m = nid.match(/^(GS\d)/i);
  return m ? m[1].toUpperCase() : "";
}

function derivePyqNodeId(block) {
  const raw = String(block.finalMapping?.nodeId || block.SyllabusNodeId || block.SyllabusTop1Code || "").trim();
  return (raw && !isMisc(raw)) ? raw : "";
}

// â”€â”€ style constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SC = {
  active:    { bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.30)", color: "#f97316", dot: "#f97316", label: "ACTIVE"    },
  paused:    { bg: "rgba(234,179,8,0.09)",  border: "rgba(234,179,8,0.28)",  color: "#eab308", dot: "#eab308", label: "PAUSED"    },
  completed: { bg: "rgba(34, 197, 94, 0.08)",border: "rgba(34, 197, 94, 0.22)",color: "#16a34a", dot: "#15803d", label: "DONE"      },
  done:      { bg: "rgba(34, 197, 94, 0.08)",border: "rgba(34, 197, 94, 0.22)",color: "#16a34a", dot: "#15803d", label: "DONE"      },
  planned:   { bg: "rgba(148,163,184,0.06)",border: "rgba(148,163,184,0.14)",color: "#475569", dot: "#1e2d4a", label: "PLANNED"   },
  missed:    { bg: "rgba(239, 68, 68, 0.10)", border: "rgba(239, 68, 68, 0.30)", color: "#ef4444", dot: "#ef4444", label: "MISSED" },
  overdue:   { bg: "rgba(239, 68, 68, 0.10)", border: "rgba(239, 68, 68, 0.30)", color: "#ef4444", dot: "#ef4444", label: "START OVERDUE" },
  upcoming:  { bg: "rgba(148,163,184,0.06)",border: "rgba(148,163,184,0.14)",color: "#475569", dot: "#1e2d4a", label: "NEXT" },
};

const B = {
  base: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 32, padding: "0 13px", borderRadius: 8,
    fontWeight: 700, fontSize: 12, cursor: "pointer",
    border: "none", letterSpacing: "-0.01em", whiteSpace: "nowrap",
  },
  primary: { background: "linear-gradient(135deg, var(--mo-amber), var(--mo-amber-2))", color: "#111827", boxShadow: "0 12px 35px rgba(245, 158, 11, 0.25)", border: "none" },
  muted:   { background: "rgba(255,255,255,0.06)", color: "var(--mo-text-soft)", border: "1px solid var(--mo-border)" },
  stop:    { background: "transparent", color: "var(--mo-danger)", border: "1px solid var(--mo-danger-border)" },
  pyq:     { background: "transparent", color: "var(--mo-text-muted)", border: "1px solid var(--mo-border)", textDecoration: "none" },
};

// â”€â”€ component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function BlockCard({ block, busy, onStart, onPause, onResume, onStop }) {
  const timing = useBlockTiming(block);

  const status      = getDisplayStatus(block.Status || "planned", block.Date).toLowerCase();

  // Use timing state to drive the badge label and styling
  let derivedStatus = status;
  if (timing) {
      if (timing.timingState === "UPCOMING") derivedStatus = "upcoming";
      else if (timing.timingState === "OVERDUE_NOT_STARTED") derivedStatus = "overdue";
      else if (timing.timingState === "ACTIVE" || timing.timingState === "OVERDUE_ACTIVE") derivedStatus = "active";
      else if (timing.timingState === "PAUSED") derivedStatus = "paused";
      else if (timing.timingState === "MISSED") derivedStatus = "missed";
      else if (timing.timingState === "COMPLETED") derivedStatus = "completed";

      // Keep skipped state if it came from the backend
      if (status === "skipped" || status === "skipped_rescue") derivedStatus = status;
  }

  const sc          = SC[derivedStatus] || SC.planned;
  const isActive    = derivedStatus === "active";
  const isPaused    = derivedStatus === "paused";
  const isPlanned   = derivedStatus === "planned" || derivedStatus === "upcoming" || derivedStatus === "overdue";
  const isCompleted = derivedStatus === "completed" || derivedStatus === "done" || derivedStatus === "stopped" || derivedStatus === "missed";
  const isDone      = isCompleted && derivedStatus !== "missed";

  const title    = deriveTitle(block);
  const subject  = String(block.PlannedSubject || "").trim();
  const paper    = derivePaper(block);
  const subtitle = (() => {
    const base = paper && subject ? `${paper} Â· ${subject}` : subject;
    return base.toLowerCase() === title.toLowerCase() ? "" : base;
  })();

  const nodeId   = derivePyqNodeId(block);
  const pyqCount = Number(block.linkedPyqs?.total || block.PyqCount || 0);
  const pyqHref  = nodeId ? `/pyq/topic/${nodeId}` : null;
  const pyqLabel = pyqCount > 0 ? `${pyqCount} PYQs â†’` : "PYQs â†’";

  const totalMin = block.PlannedMinutes || 0;

  // Use timing hook for concise progress display
  let conciseStatusDisplay = "";
  let pct = 0;
  if (timing) {
      pct = timing.completionPercentage;
      switch (timing.timingState) {
          case "UPCOMING":
              conciseStatusDisplay = `Starts in ${Math.floor(timing.secondsUntilStart / 60)} min`;
              break;
          case "OVERDUE_NOT_STARTED":
              conciseStatusDisplay = `${Math.floor(timing.overdueSeconds / 60)} min overdue`;
              break;
          case "ACTIVE":
          case "OVERDUE_ACTIVE":
              conciseStatusDisplay = `${formatConciseDuration(timing.remainingStudySeconds)} remaining`;
              break;
          case "PAUSED":
              conciseStatusDisplay = `Paused Â· ${formatConciseDuration(timing.remainingStudySeconds)} remaining`;
              break;
          case "COMPLETED":
              conciseStatusDisplay = `Completed Â· ${totalMin} min`;
              break;
          case "MISSED":
              conciseStatusDisplay = `Missed Â· recovery pending`;
              break;
      }
      if (status === "skipped" || status === "skipped_rescue") {
          conciseStatusDisplay = `Skipped Â· recovery pending`;
      }
  }

  const isPyqBlock = /pyq/i.test(block.PlannedTopic || "") || /pyq/i.test(block.PlannedSubject || "");

  const nodeTag = (() => {
    if (!nodeId) return null;
    const parts = nodeId.split("-");
    return parts.length > 2 ? parts.slice(1).join("-") : null;
  })();

  return (
    <article style={{
      background: isActive ? "linear-gradient(145deg, var(--mo-surface), var(--mo-surface-2))" : "linear-gradient(145deg, var(--mo-surface), var(--mo-bg-soft))",
      border: `1px solid ${isActive ? "var(--mo-border-amber)" : (isDone ? "rgba(34, 197, 94, 0.15)" : "var(--mo-border)")}`,
      borderRadius: 22,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      position: "relative",
      overflow: "hidden",
      boxShadow: isActive ? "var(--mo-shadow-amber)" : "0 4px 20px rgba(0,0,0,0.2)",
      opacity: isDone ? 0.7 : 1,
    }}>

      {/* â”€â”€ ROW 1: title + time range â”€â”€ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: "#e2e8f0",
          letterSpacing: "-0.025em", lineHeight: 1.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: "var(--mono,monospace)", fontSize: 11, fontWeight: 600,
          color: "#475569", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {block.PlannedStart} â†’ {block.PlannedEnd}
        </div>
      </div>

      {/* â”€â”€ ROW 2: subtitle + duration â”€â”€ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>
          {subtitle || "Â "}
        </div>
        <div style={{ fontFamily: "var(--mono,monospace)", fontSize: 11, color: "#1e2d4a" }}>
          {totalMin > 0 ? `${totalMin} min` : ""}
        </div>
      </div>

      {/* â”€â”€ ROW 3: status chip + node tag â”€â”€ */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 9px", borderRadius: 20,
          background: sc.bg, border: `1px solid ${sc.border}`,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: sc.dot,
            boxShadow: isActive ? `0 0 4px ${sc.dot}` : "none",
          }} />
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            color: sc.color, fontFamily: "var(--mono,monospace)",
          }}>
            {sc.label}
          </span>
        </div>
        {nodeTag && (
          <span style={{ fontSize: 10, color: "#1e2d4a", fontFamily: "var(--mono,monospace)", fontWeight: 600 }}>
            {nodeTag}
          </span>
        )}
      </div>

      {/* â”€â”€ ROW 4: progress / "starts at" â”€â”€ */}
      {totalMin > 0 ? (
        <div>
          {/* thin progress track */}
          <div style={{ height: 2, borderRadius: 2, background: "#0f1826", overflow: "hidden", marginBottom: 4 }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${pct}%`,
              background: isActive ? "#f97316" : isPaused ? "#eab308" : isDone ? "rgba(34, 197, 94, 0.4)" : "#1e2d4a",
              transition: "width 1s linear",
              minWidth: pct > 0 ? 2 : 0,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#334155", fontFamily: "var(--mono,monospace)" }}>
              {conciseStatusDisplay}
            </span>
            {pct > 0 && (
              <span style={{ fontSize: 10, color: "#1e2d4a", fontFamily: "var(--mono,monospace)" }}>
                {pct}%
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* â”€â”€ ROW 5: actions â”€â”€ */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", paddingTop: 2 }}>

        {isPlanned && (
          <button disabled={busy} onClick={() => onStart?.(block.BlockId)}
            style={{ ...B.base, ...B.primary }}>
            {isPyqBlock ? "â–¶ Start Practice" : "â–¶ Start"}
          </button>
        )}

        {isActive && (
          <>
            <button disabled={busy} onClick={() => onPause?.(block.BlockId)}
              style={{ ...B.base, ...B.muted }}>
              â¸ Pause
            </button>
            <button disabled={busy} onClick={() => onStop?.(block)}
              style={{ ...B.base, ...B.stop }}>
              â–  Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button disabled={busy} onClick={() => onResume?.(block.BlockId)}
              style={{ ...B.base, ...B.primary }}>
              â–¶ Resume
            </button>
            <button disabled={busy} onClick={() => onStop?.(block)}
              style={{ ...B.base, ...B.stop }}>
              â–  Stop
            </button>
          </>
        )}

        {pyqHref && (
          <a href={pyqHref} target="_blank" rel="noopener noreferrer"
            style={{ ...B.base, ...B.pyq, marginLeft: "auto" }}>
            {pyqLabel}
          </a>
        )}
      </div>

    </article>
  );
}
