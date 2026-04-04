import SyllabusRadar from "./SyllabusRadar.jsx";

export default function PlanRightRail({
    syllabusRadar,
    weekly,
    nightReviewRef,
    loopDetectorRef,
    review,
    setReview,
    busy,
    onSaveNightReview,
    loops,
    activeFlags,
    todayTriggered,
    BACKEND_URL,
}) {
    const flags = Array.isArray(loops?.flags) ? loops.flags : [];

    return (
        <section className="plan-right">
            <SyllabusRadar radar={syllabusRadar} />

            <div className="plan-card">
                <h2 className="plan-card-title">Weekly Dashboard</h2>

                {!weekly ? (
                    <div className="footer-note" style={{ fontSize: 14 }}>
                        Click <b>Weekly Rollup</b> to generate the weekly row. (See it in Google Sheet.)
                    </div>
                ) : (
                    <div className="footer-note" style={{ fontSize: 14, color: "#F3F2EE" }}>
                        {weekly.message}
                    </div>
                )}
            </div>

            <div ref={nightReviewRef} className="plan-card">
                <h2 className="plan-card-title">Night Review</h2>

                <div style={{ display: "grid", gap: 12 }}>
                    <label className="field-label">
                        Planned targets completed?
                        <select
                            value={review.planCompleted}
                            onChange={(e) => setReview({ ...review, planCompleted: e.target.value })}
                        >
                            <option value="Yes">Yes</option>
                            <option value="Partial">Partial</option>
                            <option value="No">No</option>
                        </select>
                    </label>

                    <label className="field-label">
                        What went well today?
                        <textarea
                            rows={2}
                            value={review.wentWell}
                            onChange={(e) => setReview({ ...review, wentWell: e.target.value })}
                        />
                    </label>

                    <label className="field-label">
                        What went wrong today?
                        <select
                            value={review.wentWrongReason}
                            onChange={(e) => setReview({ ...review, wentWrongReason: e.target.value })}
                        >
                            <option>Distraction</option>
                            <option>Overplanning</option>
                            <option>Fatigue</option>
                            <option>CSAT avoidance</option>
                            <option>Low focus</option>
                            <option>Phone</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Optional detail (1–2 lines)
                        <textarea
                            rows={2}
                            value={review.wentWrongText}
                            onChange={(e) => setReview({ ...review, wentWrongText: e.target.value })}
                        />
                    </label>

                    <label className="field-label">
                        Did you cover anything extra beyond plan?
                        <select
                            value={review.extraDone}
                            onChange={(e) => setReview({ ...review, extraDone: e.target.value })}
                        >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </label>

                    {review.extraDone === "Yes" && (
                        <>
                            <label className="field-label">
                                What extra did you do?
                                <textarea
                                    rows={2}
                                    value={review.extraText}
                                    onChange={(e) => setReview({ ...review, extraText: e.target.value })}
                                />
                            </label>

                            <label className="field-label">
                                How many extra minutes?
                                <input
                                    type="number"
                                    value={review.extraMinutes}
                                    min={0}
                                    onChange={(e) =>
                                        setReview({ ...review, extraMinutes: Number(e.target.value || 0) })
                                    }
                                />
                            </label>
                        </>
                    )}

                    <button disabled={busy} onClick={onSaveNightReview}>
                        Save Night Review + Loops + Analyze Day
                    </button>
                </div>
            </div>

            <div ref={loopDetectorRef} className="plan-card">
                <h2 className="plan-card-title">Loop Detector</h2>

                {!loops ? (
                    <div className="footer-note" style={{ fontSize: 14 }}>
                        Run Night Review to generate loops.
                    </div>
                ) : (
                    <>
                        <div
                            className="footer-note"
                            style={{ marginBottom: 12, fontSize: 14, color: "#F3F2EE" }}
                        >
                            Active loops: <b>{flags.length}</b> | Window days:{" "}
                            <b>{loops.windowDays ?? "NA"}</b>
                        </div>

                        {String(loops.loopFlagsText || "").trim() && (
                            <div style={{ marginBottom: 10 }}>
                                <b>Loop Flags:</b> {loops.loopFlagsText}
                            </div>
                        )}

                        {String(loops.tomorrowCorrection || "").trim() && (
                            <div style={{ marginBottom: 12 }}>
                                <b>Tomorrow correction:</b> {loops.tomorrowCorrection}
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}