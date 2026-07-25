import { getEffectiveBlockStatus, getBlockTimeRange } from "../../utils/studyEngine";
import { useBlockTiming } from "../../hooks/useBlockTiming";

const btnBase = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: 40, padding: "0 18px", borderRadius: 8,
  fontWeight: 600, fontSize: 14, cursor: "pointer",
  border: "none", transition: "all 0.15s ease",
};

export default function SpotlightCard({
  currentBlock,
  currentBlockPyq,
  currentBlockPyqNodeId,
  liveElapsedSec, // Left in for signature compatibility, but ignored in favor of hook
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
  onMarkDone,
  todayBlocks = [],
  nowTick = Date.now(),
  formatCountdown = () => "", // Unused now
  onOpenFocus
}) {
  const timing = useBlockTiming(currentBlock, nowTick);

  if (!currentBlock || !timing) {
    const nextBlockIndex = todayBlocks.findIndex(b => {
      const s = getEffectiveBlockStatus(b).toLowerCase();
      return !['active', 'completed', 'done', 'missed', 'paused'].includes(s);
    });
    const nextBlock = nextBlockIndex !== -1 ? todayBlocks[nextBlockIndex] : null;

    return (
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: "32px",
        textAlign: "center",
        boxShadow: "var(--shadow-card)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Current Execution</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, marginBottom: 20 }}>
          No active block
          <br/>
          Start the next scheduled block from Todayâ€™s Sequence.
        </div>
        <button
          disabled={!nextBlock || busy}
          onClick={() => nextBlock && onStart && onStart(nextBlock)}
          style={{ ...btnBase, background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
          Start next block
        </button>
      </div>
    );
  }

  const {
    timingState,
    completionPercentage,
    displayPrimary,
    displaySecondary,
    plannedWindowOverdueSeconds
  } = timing;

  const rawTopic = currentBlock.PlannedTopic || "";
  const rawSubject = currentBlock.PlannedSubject || "";
  const mainTitle = rawSubject || "Study Block";
  const subtitle = rawTopic;

  const pyqTotal = currentBlockPyq?.total || 0;
  const canOpenPyq = Boolean(currentBlockPyqNodeId) && pyqTotal > 0;

  // Determine Label and Timer color based on state
  let headerLabel = "STARTS IN";
  let headerColor = "var(--text-secondary)";
  let primaryColor = "var(--text-primary)";

  if (timingState === "UPCOMING") {
    headerLabel = "STARTS IN";
  } else if (timingState === "OVERDUE_NOT_STARTED") {
    headerLabel = "BLOCK NOT STARTED";
    if (timing.overdueSeconds > 600) {
       headerColor = "var(--error)"; // red
       primaryColor = "var(--error)";
    } else {
       headerColor = "var(--warning)"; // amber
       primaryColor = "var(--warning)";
    }
  } else if (timingState === "ACTIVE" || timingState === "OVERDUE_ACTIVE") {
    headerLabel = "ACTIVE";
    headerColor = "var(--brand-primary)";
  } else if (timingState === "PAUSED") {
    headerLabel = "PAUSED";
    headerColor = "var(--warning)";
  } else if (timingState === "MISSED") {
    headerLabel = "BLOCK MISSED";
    headerColor = "var(--error)";
    primaryColor = "var(--error)";
  } else if (timingState === "COMPLETED") {
    headerLabel = "COMPLETED";
    headerColor = "var(--success)";
  }

  return (
    <section style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: 16,
      padding: "28px 32px",
      boxShadow: "0 2px 8px rgba(16, 24, 40, 0.04)",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Current Execution
      </div>

      <div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>
          {mainTitle}
        </h2>
        {subtitle && (
          <div style={{ fontSize: 15, color: "var(--text-secondary)", fontWeight: 500 }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>â±</span> {getBlockTimeRange(currentBlock)}
        </span>
        {timing.secondsUntilPlannedEnd > 0 && timingState === "ACTIVE" && (
           <>
             <span>Â·</span>
             <span style={{ color: "var(--text-secondary)" }}>Planned window ends in {Math.floor(timing.secondsUntilPlannedEnd / 60)} min</span>
           </>
        )}
      </div>

      <div style={{
          marginTop: 8,
          marginBottom: 8,
          padding: "16px 0",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 4
      }}>
         <div style={{ fontSize: 12, fontWeight: 700, color: headerColor, letterSpacing: "0.05em" }}>
           {headerLabel}
         </div>
         <div style={{ fontSize: 40, fontWeight: 800, color: primaryColor, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
           {displayPrimary}
         </div>
         <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>
           {displaySecondary}
         </div>
      </div>

      <div style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        padding: "12px 16px",
        fontSize: 14,
        color: "var(--text-primary)",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 8
      }}>
        <span style={{ color: "var(--text-secondary)" }}>ðŸ“„</span>
        Required output: 20-page revision{pyqTotal > 0 ? ` + ${pyqTotal} PYQs` : ''}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ height: 8, borderRadius: 4, background: "var(--brand-primary-soft)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%", borderRadius: 4, width: `${completionPercentage}%`, background: "var(--brand-primary)",
            transition: "width 1s linear", minWidth: completionPercentage > 0 ? 8 : 0,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          <span>{completionPercentage}% complete</span>
        </div>
      </div>

      <div className="mos-current-execution-actions" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>

        {timingState === "UPCOMING" && (
          <button className="mos-primary-action" disabled={busy} onClick={() => onStart?.(currentBlock)} style={{
            ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
            padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
          }}>
            Start early
          </button>
        )}

        {timingState === "OVERDUE_NOT_STARTED" && (
          <button className="mos-primary-action" disabled={busy} onClick={() => onStart?.(currentBlock)} style={{
            ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
            padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
          }}>
            Start block now
          </button>
        )}

        {(timingState === "ACTIVE" || timingState === "OVERDUE_ACTIVE") && (
          <>
            <button className="mos-primary-action" disabled={busy} onClick={onOpenFocus} style={{
              ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
              padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
            }}>
              Open focus mode
            </button>
            <button disabled={busy} onClick={() => onPause?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              â¸ Pause session
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              â‹® End block
            </button>
          </>
        )}

        {timingState === "PAUSED" && (
          <>
            <button className="mos-primary-action" disabled={busy} onClick={() => onResume?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
              padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
            }}>
              Resume session
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              â‹® End block
            </button>
          </>
        )}

        {timingState === "MISSED" && (
          <>
            <button className="mos-primary-action" disabled={busy} onClick={() => onStart?.(currentBlock)} style={{
              ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
              padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
            }}>
              Start recovery block
            </button>
            <button disabled={busy} onClick={() => {}} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              Reschedule
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              Mark skipped
            </button>
          </>
        )}

        {canOpenPyq && (
          <a
            className="mos-pyq-action"
            href={`/pyq/topic/${currentBlockPyqNodeId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnBase,
              marginLeft: "auto", background: "transparent",
              color: "var(--brand-primary)", textDecoration: "none",
            }}
          >
            View PYQs â†’
          </a>
        )}
      </div>
    </section>
  );
}

