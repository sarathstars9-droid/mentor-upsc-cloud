export default function QuickActions({
    onStudyBlocks,
    onNightReview,
    onLoopDetector,
}) {
    return (
        <div className="quick-nav-bar mos-quick-actions">
            <button
                className="mos-pill-btn mos-pill-btn--primary"
                onClick={onStudyBlocks}
            >
                Today's Study Blocks
            </button>
            <button
                className="mos-pill-btn"
                onClick={onNightReview}
            >
                Night Review
            </button>
            <button
                className="mos-pill-btn"
                onClick={onLoopDetector}
            >
                Loop Detector
            </button>
        </div>
    );
}
