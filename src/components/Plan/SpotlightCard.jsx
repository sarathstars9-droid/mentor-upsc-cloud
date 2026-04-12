// src/components/Plan/SpotlightCard.jsx
// DROP IN: replace existing SpotlightCard.jsx
// All props are IDENTICAL — no changes needed in PlanPage.jsx.

import { getDisplayStatus } from "../../utils/studyEngine";

export default function SpotlightCard({
    currentBlock,
    currentBlockPyq,
    currentBlockPyqNodeId,
    busy,
    onStart,
    onPause,
    onResume,
    onStop,
    onMarkDone,
}) {
    // ── EMPTY STATE ──────────────────────────────────────────
    if (!currentBlock) {
        return (
            <section className="spotlight-card mos-spotlight-card">
                <div className="spotlight-label-row">⚡ Current Block Spotlight</div>
                <div className="spotlight-layout">
                    <div className="spotlight-left">
                        <div className="sp-subject">No active block yet</div>
                        <div className="sp-topic">Ready when you are</div>
                        <div className="sp-time-row">
                            <span className="time-chip">--:-- → --:--</span>
                            <span className="time-chip dur">0 min</span>
                            <span className="time-chip">planned</span>
                        </div>
                        <div className="sp-motto">
                            Start the next scheduled block to activate the spotlight.
                        </div>
                    </div>
                    <div className="sp-side">
                        <div className="sp-stat">
                            <div className="sp-stat-label">Mapped Node</div>
                            <div className="sp-stat-value">Not mapped</div>
                            <div className="sp-stat-sub">No active node linked yet</div>
                        </div>
                        <div className="sp-stat">
                            <div className="sp-stat-label">Momentum</div>
                            <div className="sp-stat-value">0 min</div>
                            <div className="sp-stat-sub">Actual tracked time today</div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // ── ACTIVE STATE ─────────────────────────────────────────
    const status = getDisplayStatus(currentBlock.Status || "planned").toLowerCase();
    const pyqTotal = currentBlockPyq?.total || 0;
    const prelimsCount = currentBlockPyq?.prelimsCount || 0;
    const mainsCount = currentBlockPyq?.mainsCount || 0;
    const lastAskedYear = currentBlockPyq?.lastAskedYear;
    const mappedNode = currentBlockPyqNodeId || "Not mapped";
    const momentum = currentBlock?.ActualMinutes || 0;
    const canOpenPyq = Boolean(currentBlockPyqNodeId);

    const handleMarkDone =
        onMarkDone || (onStop ? () => onStop(currentBlock) : undefined);

    return (
        <section className="spotlight-card mos-spotlight-card">
            <div className="spotlight-label-row">⚡ Current Block Spotlight</div>

            <div className="spotlight-layout">

                {/* LEFT — subject / topic / time / PYQ row / motto */}
                <div className="spotlight-left">
                    <div className="sp-subject">{currentBlock.finalMapping?.subjectName || currentBlock.PlannedSubject}</div>
                    <div className="sp-topic">{currentBlock.finalMapping?.nodeName || currentBlock.PlannedTopic}</div>

                    <div className="sp-time-row">
                        <span className="time-chip">
                            {currentBlock.PlannedStart} → {currentBlock.PlannedEnd}
                        </span>
                        <span className="time-chip dur">
                            {currentBlock.PlannedMinutes} min
                        </span>
                        <span className={`time-chip${status === "active" ? " active" : ""}`}>
                            {status}
                        </span>
                    </div>

                    {pyqTotal > 0 && (
                        <div className="sp-pyq-row">
                            <span className="badge badge-saf">PYQs: {pyqTotal}</span>
                            <span className="badge-neutral">Prelims: {prelimsCount}</span>
                            <span className="badge-neutral">Mains: {mainsCount}</span>
                            {lastAskedYear && (
                                <span className="badge-neutral">Last asked: {lastAskedYear}</span>
                            )}
                        </div>
                    )}

                    <div className="sp-motto">
                        This is the block that matters now. Protect it. The page
                        should reduce decision load, not compete for attention.
                    </div>
                </div>

                {/* RIGHT — stats + CTA buttons */}
                <div className="sp-side">
                    <div className="sp-stat">
                        <div className="sp-stat-label">Mapped Node</div>
                        <div className="sp-stat-value">{mappedNode}</div>
                        <div className="sp-stat-sub">
                            {currentBlockPyqNodeId
                                ? "Leaf node linked correctly"
                                : "Mapping pending"}
                        </div>
                    </div>

                    <div className="sp-stat">
                        <div className="sp-stat-label">Momentum</div>
                        <div className="sp-stat-value">{momentum} min</div>
                        <div className="sp-stat-sub">Actual tracked time today</div>
                    </div>

                    <div className="sp-cta">
                        {/* Temporary debug info */}
                        <div style={{ padding: "8px", marginBottom: 8, background: "#1e1e1e", borderRadius: 4, fontFamily: "monospace", fontSize: "11px", color: "#a0a0a0", textAlign: "left", lineHeight: 1.4 }}>
                            <div>rawText: {currentBlock.PlannedSubject} {currentBlock.PlannedTopic}</div>
                            <div>subId: {currentBlock.finalMapping?.subjectId || "null"} | nodeId: {currentBlock.finalMapping?.nodeId || "null"}</div>
                            <div>isApproved: {String(currentBlock.finalMapping?.isApproved)}</div>
                            <div>src: {canOpenPyq ? "finalMapping.nodeId" : "none"}</div>
                        </div>

                        {/* View PYQs */}
                        <button
                            type="button"
                            className="btn btn-spotlight btn-spotlight-blue"
                            disabled={!canOpenPyq}
                            onClick={() =>
                                canOpenPyq &&
                                window.open(`/pyq/topic/${currentBlockPyqNodeId}`, "_blank")
                            }
                        >
                            View All PYQs
                        </button>

                        {/* PLANNED */}
                        {status === "planned" && (
                            <button
                                type="button"
                                className="btn btn-spotlight btn-primary"
                                disabled={busy}
                                onClick={() => onStart?.(currentBlock.BlockId)}
                            >
                                ▶ Start
                            </button>
                        )}

                        {/* ACTIVE */}
                        {status === "active" && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-spotlight btn-primary"
                                    disabled={busy}
                                    onClick={handleMarkDone}
                                >
                                    ▶ Mark Done
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-spotlight"
                                    disabled={busy}
                                    onClick={() => onPause?.(currentBlock.BlockId)}
                                >
                                    ⏸ Pause
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-spotlight btn-danger"
                                    disabled={busy}
                                    onClick={() => onStop?.(currentBlock)}
                                >
                                    ■ Stop
                                </button>
                            </>
                        )}

                        {/* PAUSED */}
                        {status === "paused" && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-spotlight btn-primary"
                                    disabled={busy}
                                    onClick={() => onResume?.(currentBlock.BlockId)}
                                >
                                    ▶ Resume
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-spotlight btn-danger"
                                    disabled={busy}
                                    onClick={() => onStop?.(currentBlock)}
                                >
                                    ■ Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
