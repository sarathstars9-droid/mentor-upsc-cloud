import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function BlockReviewModal({
    open,
    block,
    reviewForm,
    setReviewForm,
    onSubmit,
    onCancel,
}) {
    const modalRef = useRef(null);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";

            let handleTab;
            const currentModal = modalRef.current;
            
            if (currentModal) {
                const focusableElements = currentModal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length > 0) {
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    handleTab = (e) => {
                        if (e.key === "Tab") {
                            if (e.shiftKey) {
                                if (document.activeElement === firstElement) {
                                    lastElement.focus();
                                    e.preventDefault();
                                }
                            } else {
                                if (document.activeElement === lastElement) {
                                    firstElement.focus();
                                    e.preventDefault();
                                }
                            }
                        }
                    };
                    currentModal.addEventListener("keydown", handleTab);
                }
            }

            return () => {
                if (currentModal && handleTab) {
                    currentModal.removeEventListener("keydown", handleTab);
                }
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    if (!open || !block) return null;

    const overlayStyle = {
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px"
    };

    const modalStyle = {
        position: "relative",
        zIndex: 1000000,
        width: "min(960px, calc(100vw - 48px))",
        maxHeight: "calc(100vh - 72px)",
        background: "linear-gradient(145deg, var(--mo-surface), var(--mo-surface-2))",
        border: "1px solid var(--mo-border-amber)",
        borderRadius: "24px",
        boxShadow: "var(--mo-shadow-premium), var(--mo-shadow-amber)",
        margin: "0",
        color: "var(--mo-text)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
    };

    return createPortal(
        <div style={overlayStyle}>
            <style>{`
                .review-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                @media (max-width: 768px) {
                    .review-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                }
                .dense-field {
                    display: grid;
                    gap: 4px;
                    color: var(--mo-text-soft);
                    font-size: 13px;
                    font-weight: 500;
                }
                .dense-input {
                    height: 36px;
                    background: var(--mo-input);
                    border: 1px solid var(--mo-input-border);
                    border-radius: 12px;
                    color: var(--mo-text);
                    padding: 0 10px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .dense-input:focus {
                    border-color: var(--mo-border-amber);
                    box-shadow: 0 0 0 3px var(--mo-amber-soft);
                }
                .dense-textarea {
                    min-height: 56px;
                    max-height: 56px;
                    background: var(--mo-input);
                    border: 1px solid var(--mo-input-border);
                    border-radius: 12px;
                    color: var(--mo-text);
                    padding: 8px 10px;
                    font-size: 14px;
                    resize: none;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .dense-textarea:focus {
                    border-color: var(--mo-border-amber);
                    box-shadow: 0 0 0 3px var(--mo-amber-soft);
                }
                .review-section {
                    background: var(--mo-surface-3);
                    border: 1px solid var(--mo-border-soft);
                    padding: 12px;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .review-section-title {
                    margin: 0;
                    color: rgba(255,255,255,0.4);
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 700;
                }
            `}</style>

            <div style={modalStyle} ref={modalRef} tabIndex="-1">
                {/* Header */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--mo-border-soft)", flexShrink: 0 }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px 0", lineHeight: 1.2 }}>
                        Review Your Session
                    </h2>
                    <div style={{ fontSize: "14px", color: "var(--mo-text-soft)" }}>
                        {block?.PlannedSubject || "Study Block"} &ndash; {block?.PlannedTopic || "No topic"}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--mo-amber)", fontWeight: 500 }}>
                        Capture the session in 30 seconds.
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
                    <div className="review-grid">
                        {/* LEFT COLUMN */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Completion Section */}
                            <div className="review-section">
                                <h4 className="review-section-title">Completion</h4>
                                <label className="dense-field">
                                    Was this block completed?
                                    <select
                                        className="dense-input"
                                        value={reviewForm.completionStatus}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, completionStatus: e.target.value }))}
                                    >
                                        <option value="">Select</option>
                                        <option value="completed">Completed</option>
                                        <option value="partial">Partial</option>
                                        <option value="missed">Missed</option>
                                    </select>
                                </label>

                                <label className="dense-field">
                                    Did you study the planned topic?
                                    <select
                                        className="dense-input"
                                        value={reviewForm.topicMatchStatus}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, topicMatchStatus: e.target.value }))}
                                    >
                                        <option value="">Select</option>
                                        <option value="as_planned">Yes, as planned</option>
                                        <option value="partially_changed">Partially changed</option>
                                        <option value="different_topic">Completely different topic</option>
                                        <option value="not_studied">Did not study</option>
                                    </select>
                                </label>
                            </div>

                            {/* Output Section */}
                            <div className="review-section">
                                <h4 className="review-section-title">Output</h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "10px" }}>
                                    <label className="dense-field">
                                        What was the output?
                                        <select
                                            className="dense-input"
                                            value={reviewForm.outputType}
                                            onChange={(e) => setReviewForm((f) => ({ ...f, outputType: e.target.value }))}
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

                                    <label className="dense-field">
                                        Count
                                        <input
                                            className="dense-input"
                                            type="number"
                                            min="0"
                                            value={reviewForm.outputCount}
                                            onChange={(e) => setReviewForm((f) => ({ ...f, outputCount: Number(e.target.value || 0) }))}
                                        />
                                    </label>
                                </div>

                                <label className="dense-field">
                                    Notes
                                    <textarea
                                        className="dense-textarea"
                                        value={reviewForm.reviewNotes}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, reviewNotes: e.target.value }))}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Focus Section */}
                            <div className="review-section">
                                <h4 className="review-section-title">Focus</h4>
                                <label className="dense-field">
                                    Focus quality?
                                    <select
                                        className="dense-input"
                                        value={reviewForm.focusRating}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, focusRating: e.target.value }))}
                                    >
                                        <option value="">Select</option>
                                        <option value="deep">Deep</option>
                                        <option value="average">Average</option>
                                        <option value="distracted">Distracted</option>
                                    </select>
                                </label>
                            </div>

                            {/* Gaps Section */}
                            <div className="review-section" style={{ flex: 1 }}>
                                <h4 className="review-section-title">Gaps & Backlog</h4>
                                <label className="dense-field">
                                    Reason if partial/missed?
                                    <select
                                        className="dense-input"
                                        value={reviewForm.interruptionReason}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, interruptionReason: e.target.value }))}
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

                                <label className="dense-field">
                                    Leftover action
                                    <select
                                        className="dense-input"
                                        value={reviewForm.backlogBucket}
                                        onChange={(e) => setReviewForm((f) => ({ ...f, backlogBucket: e.target.value }))}
                                    >
                                        <option value="">Select</option>
                                        <option value="recover_today">Recover today</option>
                                        <option value="move_to_tomorrow">Move to tomorrow</option>
                                        <option value="weekly_backlog">Weekly backlog</option>
                                        <option value="drop">Drop</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--mo-border-soft)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--mo-bg-soft)" }}>
                    <button 
                        style={{ padding: "12px 24px", borderRadius: "14px", background: "rgba(255,255,255,0.06)", color: "var(--mo-text-soft)", border: "1px solid var(--mo-border)", fontWeight: 600, cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }} 
                        onClick={onCancel}
                        onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--mo-text)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--mo-text-soft)"; }}
                    >
                        Skip Review
                    </button>
                    
                    <button 
                        style={{ padding: "12px 24px", borderRadius: "14px", background: "linear-gradient(135deg, var(--mo-amber), var(--mo-amber-2))", color: "#111827", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "14px", boxShadow: "0 12px 35px rgba(245, 158, 11, 0.25)", transition: "transform 0.1s" }} 
                        onClick={onSubmit}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                        onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                    >
                        Save & Continue &rarr;
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}