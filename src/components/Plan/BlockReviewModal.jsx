export default function BlockReviewModal({
    open,
    block,
    reviewForm,
    setReviewForm,
    onSubmit,
    onCancel,
}) {
    if (!open || !block) return null;

    return (
        <div className="focus-overlay" onClick={onCancel}>
            <div
                className="focus-modal review-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: "82vh", overflowY: "auto" }}
            >
                <div className="focus-kicker">Block Review</div>

                <h2 className="focus-title">{block?.PlannedSubject || "Study Block"}</h2>

                <div className="focus-subtitle">{block?.PlannedTopic || "No topic"}</div>

                <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
                    <label className="field-label">
                        Was this block completed?
                        <select
                            value={reviewForm.completionStatus}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, completionStatus: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="completed">Completed</option>
                            <option value="partial">Partial</option>
                            <option value="missed">Missed</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Did you study the planned topic?
                        <select
                            value={reviewForm.topicMatchStatus}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, topicMatchStatus: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="as_planned">Yes, as planned</option>
                            <option value="partially_changed">Partially changed</option>
                            <option value="different_topic">Completely different topic</option>
                            <option value="not_studied">Did not study</option>
                        </select>
                    </label>

                    <label className="field-label">
                        What was the output?
                        <select
                            value={reviewForm.outputType}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, outputType: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="notes">Notes</option>
                            <option value="revision">Revision</option>
                            <option value="mcqs">MCQs</option>
                            <option value="answer_writing">Answer writing</option>
                            <option value="test">Test</option>
                            <option value="nothing_substantial">Nothing substantial</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Output count
                        <input
                            type="number"
                            min="0"
                            value={reviewForm.outputCount}
                            onChange={(e) =>
                                setReviewForm((f) => ({
                                    ...f,
                                    outputCount: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </label>

                    <label className="field-label">
                        Focus quality?
                        <select
                            value={reviewForm.focusRating}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, focusRating: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="deep">Deep</option>
                            <option value="average">Average</option>
                            <option value="distracted">Distracted</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Reason if partial/missed?
                        <select
                            value={reviewForm.interruptionReason}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, interruptionReason: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="sleep">Sleep</option>
                            <option value="low_energy">Low energy</option>
                            <option value="phone_distraction">Phone distraction</option>
                            <option value="work_teaching">Work/teaching interruption</option>
                            <option value="poor_planning">Poor planning</option>
                            <option value="health">Health</option>
                            <option value="other">Other</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Leftover action
                        <select
                            value={reviewForm.backlogBucket}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, backlogBucket: e.target.value }))
                            }
                        >
                            <option value="">Select</option>
                            <option value="recover_today">Recover today</option>
                            <option value="move_to_tomorrow">Move to tomorrow</option>
                            <option value="weekly_backlog">Weekly backlog</option>
                            <option value="drop">Drop</option>
                        </select>
                    </label>

                    <label className="field-label">
                        Notes
                        <textarea
                            rows={3}
                            value={reviewForm.reviewNotes}
                            onChange={(e) =>
                                setReviewForm((f) => ({ ...f, reviewNotes: e.target.value }))
                            }
                        />
                    </label>
                </div>

                <div className="focus-actions">
                    <button onClick={onSubmit}>Submit Review</button>
                    <button className="focus-close-btn" onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}