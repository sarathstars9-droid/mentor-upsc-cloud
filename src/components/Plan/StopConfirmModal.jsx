export default function StopConfirmModal({
  open,
  block,
  onConfirm,
  onCancel,
}) {
  if (!open || !block) return null;

  return (
    <div className="focus-overlay" onClick={onCancel}>
      <div className="focus-modal" onClick={(e) => e.stopPropagation()}>
        <div className="focus-kicker">Confirm Stop</div>

        <h2 className="focus-title">End this block?</h2>

        <div className="focus-subtitle">
          {block?.PlannedSubject || "Study Block"} — {block?.PlannedTopic || "No topic"}
        </div>

        <div className="focus-note">
          This will close the active block and open the review form.
        </div>

        <div className="focus-actions">
          <button onClick={onConfirm}>Yes, End Block</button>

          <button className="focus-close-btn" onClick={onCancel}>
            Continue Block
          </button>
        </div>
      </div>
    </div>
  );
}