import { BLOCK_STATUS } from "../../blockConstants";
import { formatTimeOnly, getDisplayStatus } from "../../utils/studyEngine";

export default function FocusModeModal({
    open,
    block,
    busy,
    onStart,
    onPause,
    onResume,
    onStop,
    onClose,
}) {
    if (!open || !block) return null;

    const status = getDisplayStatus(block.Status);

    return (
        <div className="focus-overlay" onClick={onClose}>
            <div className="focus-modal" onClick={(e) => e.stopPropagation()}>
                <div className="focus-kicker">
                    {status === BLOCK_STATUS.ACTIVE
                        ? "Focus Mode Active"
                        : status === BLOCK_STATUS.PAUSED
                            ? "Focus Mode Paused"
                            : "Focus Mode"}
                </div>

                <h2 className="focus-title">{block.PlannedSubject || "Study Block"}</h2>

                <div className="focus-subtitle">{block.PlannedTopic || "No topic"}</div>

                <div className="focus-chips">
                    <span className="focus-chip">
                        {block.PlannedStart || "--:--"} → {block.PlannedEnd || "--:--"}
                    </span>
                    <span className="focus-chip">{block.PlannedMinutes || 0} min</span>
                    <span className="focus-chip">{status}</span>

                    {block.ActualStart && (
                        <span className="focus-chip">
                            Started {formatTimeOnly(block.ActualStart)}
                        </span>
                    )}

                    {Number(block.PauseCount || 0) > 0 && (
                        <span className="focus-chip">Pauses {block.PauseCount || 0}</span>
                    )}
                </div>

                <div className="focus-note">
                    {status === BLOCK_STATUS.ACTIVE
                        ? "Stay with this block. Pause only if needed. Stop only when you are ready to review."
                        : status === BLOCK_STATUS.PAUSED
                            ? "Resume this block and recover momentum calmly."
                            : "Start this block with full attention. The rest of the day can wait."}
                </div>

                <div className="focus-actions">
                    {status === BLOCK_STATUS.PLANNED && (
                        <button disabled={busy} onClick={onStart}>
                            {busy ? "Processing..." : "Start Now"}
                        </button>
                    )}

                    {status === BLOCK_STATUS.ACTIVE && (
                        <>
                            <button disabled={busy} onClick={onPause}>
                                {busy ? "Processing..." : "Pause"}
                            </button>
                            <button disabled={busy} onClick={onStop}>
                                Stop
                            </button>
                        </>
                    )}

                    {status === BLOCK_STATUS.PAUSED && (
                        <>
                            <button disabled={busy} onClick={onResume}>
                                {busy ? "Processing..." : "Resume"}
                            </button>
                            <button disabled={busy} onClick={onStop}>
                                Stop
                            </button>
                        </>
                    )}

                    <button className="focus-close-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}