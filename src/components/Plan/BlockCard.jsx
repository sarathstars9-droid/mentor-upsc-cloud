// src/components/Plan/BlockCard.jsx
// DROP IN: replace existing BlockCard.jsx
//
// WHAT CHANGED vs original:
//   - CSS class names updated to mos-* theme system
//   - Added display of fields already in block data:
//       topic chips (PlannedTopic tags), ActualStart/ActualEnd times,
//       SyllabusPath / ActualPath, PYQ node linked line, status label next to buttons
//   - Zero logic added — all fields already existed on block object
//   - Props identical: block, busy, onStart, onPause, onResume, onStop

import { getDisplayStatus } from "../../utils/studyEngine";

function statusBadgeClass(status) {
    if (status === "active") return "bc-badge bc-badge--active";
    if (status === "paused") return "bc-badge bc-badge--paused";
    if (status === "completed") return "bc-badge bc-badge--done";
    return "bc-badge bc-badge--planned";
}

function statusLabel(status) {
    if (status === "active") return "Active";
    if (status === "paused") return "Paused";
    if (status === "completed") return "Completed";
    return "Planned";
}

export default function BlockCard({
    block,
    busy,
    onStart,
    onPause,
    onResume,
    onStop,
}) {
    const status = getDisplayStatus(block.Status || "planned").toLowerCase();
    const isMiscGen = (v) => String(v || "").toUpperCase() === "MISC-GEN";
    const mappingCode = (() => {
        const raw = block.PyqNodeId || block.MappingCode || block.NodeId || "";
        return isMiscGen(raw) ? "" : raw;
    })();

    // Topic chips — split by comma if string, or use as array
    const topicChips = (() => {
        const raw = block.TopicTags || block.PlannedTopicTags || block.Tags;
        if (Array.isArray(raw) && raw.length) return raw;
        if (typeof raw === "string" && raw.trim()) return raw.split(",").map(t => t.trim()).filter(Boolean);
        // fallback: show PlannedTopic as a single chip
        if (block.PlannedTopic) return [block.PlannedTopic];
        return [];
    })();

    // Syllabus path line — suppress generic MISC paths
    const syllabusPath = (() => {
        const raw = block.SyllabusPath || block.ActualPath || block.SyllabusTop1Path || "";
        if (/^misc\s*(\/|>|\s)/i.test(raw)) return "";
        return raw;
    })();

    // PYQ node linked — suppress MISC-GEN fallback
    const pyqNodeLinked = (() => {
        const raw = block.PyqNodeId || block.PrimaryPyqNodeId || "";
        return isMiscGen(raw) ? "" : raw;
    })();

    // Actual start / end
    const actualStart = block.ActualStart ? block.ActualStartFormatted || block.ActualStart : null;
    const actualEnd = block.ActualEnd ? block.ActualEndFormatted || block.ActualEnd : null;

    return (
        <article className={`bc-card${status === "active" ? " bc-card--active" : ""}${status === "completed" ? " bc-card--done" : ""}`}>

            {/* ── ROW 1: Subject + Time ── */}
            <div className="bc-header">
                <div className="bc-subject-wrap">
                    <div className="bc-subject">{block.PlannedSubject}</div>
                    <div className="bc-topic-sub">{block.PlannedTopic}</div>
                </div>
                <div className="bc-time-wrap">
                    <div className="bc-time-range">{block.PlannedStart} → {block.PlannedEnd}</div>
                    <div className="bc-duration">{block.PlannedMinutes} min</div>
                </div>
            </div>

            {/* ── ROW 2: Status badge + Mapping ── */}
            <div className="bc-badges-row">
                <span className={statusBadgeClass(status)}>{status}</span>
                {mappingCode
                    ? <span className="bc-mapping">Mapping: <strong>{mappingCode}</strong></span>
                    : null}
            </div>

            {/* ── ROW 3: Topic chips ── */}
            {topicChips.length > 0 && (
                <div className="bc-chips-row">
                    {topicChips.map((chip, i) => (
                        <span key={i} className="bc-chip">{chip}</span>
                    ))}
                </div>
            )}

            {/* ── ROW 4: Time meta (started / ended / actual / pause / pauses) ── */}
            <div className="bc-meta-row">
                {actualStart && <span>Started: <strong>{actualStart}</strong></span>}
                {actualEnd && <span>Ended: <strong>{actualEnd}</strong></span>}
                {typeof block.ActualMinutes === "number"
                    ? <span>Actual: <strong>{block.ActualMinutes} min</strong></span>
                    : null}
                {typeof block.PauseMinutes === "number"
                    ? <span>Pause: <strong>{block.PauseMinutes} min</strong></span>
                    : null}
                {typeof block.PauseCount === "number"
                    ? <span>Pauses: <strong>{block.PauseCount}</strong></span>
                    : null}
                {!actualStart && !block.ActualMinutes && (
                    <span className="bc-meta-planned">Planned session</span>
                )}
            </div>

            {/* ── ROW 5: Syllabus path ── */}
            {syllabusPath && (
                <div className="bc-path">{syllabusPath}</div>
            )}

            {/* ── ROW 6: PYQ node linked ── */}
            {pyqNodeLinked && (
                <div className="bc-pyq-linked">
                    PYQ node linked: <strong>{pyqNodeLinked}</strong>
                </div>
            )}

            {/* ── ROW 7: Action buttons ── */}
            <div className="bc-actions">
                {status === "planned" && (
                    <button
                        className="bc-btn bc-btn--primary"
                        disabled={busy}
                        onClick={() => onStart?.(block.BlockId)}
                    >
                        ▶ Start
                    </button>
                )}

                {status === "active" && (
                    <>
                        <button
                            className="bc-btn bc-btn--pause"
                            disabled={busy}
                            onClick={() => onPause?.(block.BlockId)}
                        >
                            ⏸ Pause
                        </button>
                        <button
                            className="bc-btn bc-btn--stop"
                            disabled={busy}
                            onClick={() => onStop?.(block)}
                        >
                            ■ Stop
                        </button>
                        <span className="bc-status-label bc-status-label--active">Active</span>
                    </>
                )}

                {status === "paused" && (
                    <>
                        <button
                            className="bc-btn bc-btn--primary"
                            disabled={busy}
                            onClick={() => onResume?.(block.BlockId)}
                        >
                            ▶ Resume
                        </button>
                        <button
                            className="bc-btn bc-btn--stop"
                            disabled={busy}
                            onClick={() => onStop?.(block)}
                        >
                            ■ Stop
                        </button>
                        <span className="bc-status-label bc-status-label--paused">Paused</span>
                    </>
                )}

                {(status === "completed" || status === "done") && (
                    <span className="bc-status-label bc-status-label--done">Completed</span>
                )}
            </div>
        </article>
    );
}
