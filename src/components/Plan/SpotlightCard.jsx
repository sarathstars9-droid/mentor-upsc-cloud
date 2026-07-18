import { getEffectiveBlockStatus, formatTimeOnly, getBlockTimeRange } from "../../utils/studyEngine";


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
  liveElapsedSec,
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
  onMarkDone,
  todayBlocks = [],
  nowTick = Date.now(),
  formatCountdown = () => "",
  onOpenFocus
}) {
  if (!currentBlock) {
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
          Start the next scheduled block from Today’s Sequence.
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

  const status = getEffectiveBlockStatus(currentBlock).toLowerCase();
  const isActive = status === "active";
  const isPaused = status === "paused";
  const isPlanned = ["planned", "ready_to_start", "overdue"].includes(status);

  const rawTopic = currentBlock.PlannedTopic || "";
  const rawSubject = currentBlock.PlannedSubject || "";
  const mainTitle = rawSubject || "Study Block";
  const subtitle = rawTopic;

  const totalMin = currentBlock.PlannedMinutes || 0;
  const elapsedSec = liveElapsedSec != null ? liveElapsedSec : (currentBlock.ActualMinutes || 0) * 60;
  const doneMin = Math.floor(elapsedSec / 60);
  const leftMin = Math.max(0, totalMin - doneMin);
  const pctRaw = (doneMin / (doneMin + leftMin)) * 100;
  const pct = isNaN(pctRaw) ? 0 : Math.min(100, Math.round(pctRaw));

  let timeRemainingDisplay = "";
  if (currentBlock && currentBlock.PlannedEnd) {
    const status = getEffectiveBlockStatus(currentBlock).toLowerCase();
    
    // Convert e.g., "12:30" (or check if it's already am/pm)
    // We assume PlannedEnd is HH:mm in 24h format for calculation
    let h = 0, m = 0;
    if (currentBlock.PlannedEnd.includes(':')) {
       // if it already has AM/PM, parse it? studyEngine outputs HH:mm for PlannedEnd usually
       const parts = currentBlock.PlannedEnd.replace(/AM|PM/i, '').trim().split(':');
       h = parseInt(parts[0], 10);
       m = parseInt(parts[1], 10);
       if (currentBlock.PlannedEnd.toLowerCase().includes('pm') && h < 12) h += 12;
       if (currentBlock.PlannedEnd.toLowerCase().includes('am') && h === 12) h = 0;
    }

    const d = new Date(nowTick);
    d.setHours(h, m, 0, 0);
    const remainingMs = d.getTime() - nowTick;

    if (status === 'completed' || status === 'done') {
      timeRemainingDisplay = 'Completed';
    } else if (status === 'missed') {
      timeRemainingDisplay = 'Missed';
    } else if (remainingMs <= 0 && status !== 'active') {
      timeRemainingDisplay = 'Time window ended';
    } else {
      timeRemainingDisplay = `${formatCountdown(remainingMs)} remaining`;
    }
  }



  const pyqTotal = currentBlockPyq?.total || 0;
  const canOpenPyq = Boolean(currentBlockPyqNodeId);

  const handleMarkDone = onMarkDone || (onStop ? () => onStop(currentBlock) : undefined);

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
        <div style={{ fontSize: 15, color: "var(--text-secondary)", fontWeight: 500 }}>
          GS-1 <span style={{ margin: "0 6px" }}>·</span> {subtitle}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>⏱</span> {getBlockTimeRange(currentBlock)}
        </span>
        <span>·</span>
        <span style={{ color: "var(--brand-primary)" }}>{timeRemainingDisplay}</span>
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
        <span style={{ color: "var(--text-secondary)" }}>📄</span>
        Required output: 20-page revision + {pyqTotal} PYQs
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ height: 8, borderRadius: 4, background: "var(--brand-primary-soft)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%", borderRadius: 4, width: `${pct}%`, background: "var(--brand-primary)",
            transition: "width 1s linear", minWidth: pct > 0 ? 8 : 0,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          <span>{doneMin} min done <span style={{ margin: "0 4px" }}>·</span> {timeRemainingDisplay.replace(' remaining', ' left')}</span>
          <span style={{ color: "var(--text-primary)" }}>{pct}% of this block</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
        {(isActive || isPlanned) && (
          <button disabled={busy} onClick={isActive ? onOpenFocus : () => onStart?.(currentBlock)} style={{
            ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
            padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
          }}>
            {isActive ? "Open focus mode" : "Start block"}
          </button>
        )}

        {isActive && (
          <>
            <button disabled={busy} onClick={() => onPause?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              ⏸ Pause session
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              ⋮ End block
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button disabled={busy} onClick={() => onResume?.(currentBlock.BlockId)} style={{
              ...btnBase, background: "var(--brand-primary)", color: "#FFFFFF",
              padding: "0 24px", boxShadow: "0 2px 4px rgba(10, 100, 245, 0.15)",
            }}>
              Resume block
            </button>
            <button disabled={busy} onClick={() => onStop?.(currentBlock)} style={{
              ...btnBase, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)"
            }}>
              ⋮ End block
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
              marginLeft: "auto", background: "transparent",
              color: "var(--brand-primary)", textDecoration: "none",
            }}
          >
            View PYQs →
          </a>
        )}
      </div>
    </section>
  );
}

