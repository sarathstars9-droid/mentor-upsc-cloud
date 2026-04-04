export default function QuickActions({
    onStudyBlocks,
    onNightReview,
    onLoopDetector,
}) {
    return (
        <div className="quick-nav-bar">
            <button onClick={onStudyBlocks}>Today’s Study Blocks</button>
            <button onClick={onNightReview}>Night Review</button>
            <button onClick={onLoopDetector}>Loop Detector</button>
        </div>
    );
}