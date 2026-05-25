import { getDisplayStatus } from "../../utils/studyEngine";

const STATUS_CFG = {
  active:  { bg: "rgba(194, 65, 12, 0.15)",  border: "rgba(194, 65, 12, 0.3)",  color: "#FF7A45", dot: "#FF7A45", label: "ACTIVE"  },
  paused:  { bg: "rgba(234, 179, 8, 0.12)",   border: "rgba(234, 179, 8, 0.24)",   color: "#FACC15", dot: "#FACC15", label: "PAUSED"  },
  planned: { bg: "rgba(255, 255, 255, 0.05)", border: "rgba(255, 255, 255, 0.1)", color: "#9CA3AF", dot: "#6B7280", label: "READY"   },
};

const btnBase = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: 38, padding: "0 18px", borderRadius: 10,
  fontWeight: 700, fontSize: 14, cursor: "pointer",
  border: "none", letterSpacing: "-0.01em", whiteSpace: "nowrap",
  transition: "all 0.15s ease",
};

export default function SpotlightCard({
  currentBlock,
  currentBlockPyq,
  currentBlockPyqNodeId,
  liveElapsedSec,
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
  onMarkDone,
}) {
  if (!currentBlock) {
    return (
      <div style={{
        background: "var(--mos-surface)",
        border: "1px dashed var(--mos-border)",
        borderRadius: 16,
        padding: "24px",
        textAlign: "center",
        boxShadow: "var(--mos-shadow-soft)",
      }}>
        <div style={{ fontSize: 13, color: "var(--mos-text-soft)", fontFamily: "var(--mono,monospace)" }}>
          No active block — start one below
        </div>
      </div>
    );
  }

  const status     = getDisplayStatus(currentBlock.Status || "planned").toLowerCase();
  const cfg        = STATUS_CFG[status] || STATUS_CFG.planned;
  const isActive   = status === "active";
  const isPaused   = status === "paused";
  const isPlanned  = status === "planned";

  // ── Title logic: avoid showing subject if it duplicates topic ───────────────
  const rawTopic   = currentBlock.PlannedTopic || "";
  const rawSubject = currentBlock.PlannedSubject || "";
  const mappedNode = currentBlock.finalMapping?.nodeName || "";

  const mainTitle = (() => {
    if (rawTopic && rawTopic.toLowerCase() !== rawSubject.toLowerCase()) return rawTopic;
    if (mappedNode && mappedNode.toLowerCase() !== rawSubject.toLowerCase()) return mappedNode;
    return rawSubject || "Study Block";
  })();

  const subtitle = (() => {
    // Only show if it adds info (not a repeat of mainTitle)
    if (mappedNode && mappedNode !== mainTitle && mappedNode.toLowerCase() !== rawSubject.toLowerCase()) return mappedNode;
    const subj = currentBlock.finalMapping?.subjectName || rawSubject;
    if (subj && subj !== mainTitle) return subj;
    return null;
  })();

  // ── Progress ─────────────────────────────────────────────────────────────────
  const totalMin   = currentBlock.PlannedMinutes || 0;
  const elapsedSec = liveElapsedSec != null ? liveElapsedSec : (currentBlock.ActualMinutes || 0) * 60;
  const doneMin    = Math.floor(elapsedSec / 60);
  const leftMin    = Math.max(0, totalMin - doneMin);
  const pct        = totalMin > 0 ? Math.min(100, Math.round((doneMin / totalMin) * 100)) : 0;

  // Only show elapsed line when there's real data
  const showProgress = totalMin > 0 && (doneMin > 0 || isActive || isPaused);

  const progressLabel = (() => {
    if (doneMin > 0 && leftMin > 0) return `${doneMin} min done · ${leftMin} min left`;
    if (doneMin > 0 && leftMin === 0) return `${doneMin} min done · complete`;
    if (isActive || isPaused) return `0 min done · ${totalMin} min left`;
    return null;
  })();

  // ── Timer string ─────────────────────────────────────────────────────────────
  const timerStr = elapsedSec > 0
    ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`
    : null;

  // ── PYQ ──────────────────────────────────────────────────────────────────────
  const pyqTotal   = currentBlockPyq?.total || 0;
  const canOpenPyq = Boolean(currentBlockPyqNodeId);

  const handleMarkDone = onMarkDone || (onStop ? () => onStop(currentBlock) : undefined);

  return (
    <section style={{
      position: "relative",
      background: "#0B1220", /* Premium dark color */
      border: `1px solid ${isActive ? "rgba(194,65,12,0.30)" : "rgba(255,255,255,0.08)"}`,
      borderTop: `2px solid ${isActive ? "#C2410C" : "rgba(255,255,255,0.12)"}`,
      borderRadius: 16,
      padding: "20px 24px 18px",
      boxShadow: isActive
        ? "0 4px 20px rgba(194,65,12,0.12), 0 8px 30px rgba(0,0,0,0.4)"
        : "0 4px 12px rgba(0,0,0,0.3)",
      overflow: "hidden",
    }}>

      {/* decorative glow — no interaction */}
      <div style={{
        position: "absolute", top: -40, right: -40, width: 180, height: 180,
        background: "radial-gradient(circle, rgba(194,65,12,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Row 1: kicker + status chip ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{
          fontFamily: "var(--mono,monospace)", fontSize: 10, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#64748B", fontWeight: 600,
        }}>
          Current Block
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 11px", borderRadius: 20,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: cfg.dot,
            boxShadow: isActive ? `0 0 5px ${cfg.dot}` : "none",
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            color: cfg.color, fontFamily: "var(--mono,monospace)",
          }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── Row 2: title ── */}
      <div style={{ marginBottom: subtitle ? 2 : 12 }}>
        <div style={{
          fontSize: 24, fontWeight: 800, color: "#FFFFFF",
          letterSpacing: "-0.035em", lineHeight: 1.15,
        }}>
          {mainTitle}
        </div>
      </div>

      {/* ── Row 3: subtitle (only if non-redundant) ── */}
      {subtitle && (
        <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500, marginBottom: 12, letterSpacing: "-0.01em" }}>
          {subtitle}
        </div>
      )}

      {/* ── Row 4: time line ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        marginBottom: showProgress ? 10 : 16,
        fontFamily: "var(--mono,monospace)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#E5E7EB" }}>
          {currentBlock.PlannedStart} → {currentBlock.PlannedEnd}
        </span>
        <span style={{ color: "#374151" }}>·</span>
        <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 600 }}>
          {totalMin} min
        </span>
        {timerStr && (
          <>
            <span style={{ color: "#374151" }}>·</span>
            <span style={{ fontSize: 13, color: "#FF7A45", fontWeight: 700 }}>
              ⏱ {timerStr}
            </span>
          </>
        )}
      </div>

      {/* ── Row 5: progress bar + label ── */}
      {showProgress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 4, borderRadius: 4, background: "#1F2937", overflow: "hidden", marginBottom: 6 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${pct}%`,
              background: isActive ? "#C2410C" : isPaused ? "#D97706" : "#4B5563",
              transition: "width 1s linear",
              minWidth: pct > 0 ? 4 : 0,
            }} />
          </div>
          {progressLabel && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--mono,monospace)" }}>
                {progressLabel}
              </span>
              <span style={{ fontSize: 11, color: "#E5E7EB", fontFamily: "var(--mono,monospace)" }}>
                {pct}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Row 6: actions (all in one row, PYQ right-aligned) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>

        {isPlanned && (
          <button disabled={busy} onClick={() => onStart?.(currentBlock.BlockId)} style={{
            ...btnBase, background: "#C2410C", color: "#FFFFFF",
            boxShadow: "0 2px 8px rgba(194, 65, 12, 0.25)",
            padding: "0 22px",
          }}>
            ▶ Start
          </button>
        )}

        {isActive && (
          <>
            <button disabled={busy} onClick={handleMarkDone} style={{
              ...btnBase, background: "#C2410C", color: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(194, 65, 12, 0.25)",
              padding: "0 22px",
            }}>
              ✓ Done
            </button>
            <button disabled={busy} onClick={() => onPause?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "rgba(255, 255, 255, 0.08)", color: "#E5E7EB",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}>
              ⏸ Pause
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase,
              background: "rgba(239, 68, 68, 0.12)", color: "#FCA5A5",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}>
              ■ Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button disabled={busy} onClick={() => onResume?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "#C2410C", color: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(194, 65, 12, 0.25)",
              padding: "0 22px",
            }}>
              ▶ Resume
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase,
              background: "rgba(239, 68, 68, 0.12)", color: "#FCA5A5",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}>
              ■ Stop
            </button>
          </>
        )}

        {canOpenPyq && (
          <a
            href={`/pyq/topic/${currentBlockPyqNodeId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnBase,
              marginLeft: "auto",
              textDecoration: "none",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#9CA3AF", fontSize: 13,
            }}
          >
            {pyqTotal > 0 ? `${pyqTotal} PYQs →` : "PYQs →"}
          </a>
        )}
      </div>

      {/* ── Row 7: microcopy — only show when active or paused ── */}
      {(isActive || isPaused) && (
        <div style={{
          fontSize: 11, color: "#9CA3AF",
          fontFamily: "var(--mono,monospace)", letterSpacing: "0.01em",
        }}>
          {isActive ? "Stay focused. Every minute compounds." : "Paused. Resume when ready."}
        </div>
      )}
    </section>
  );
}

