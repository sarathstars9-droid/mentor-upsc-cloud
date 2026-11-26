import React, { useState, useEffect } from "react";

export default function ActiveCommentModal({
  open,
  block,
  onClose,
  onSaveComment,
  busy = false
}) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open && block) {
      // Show existing active note draft (study_review), leaving plan_comment separate
      setComment(block.study_review || block.StudyReview || "");
    }
  }, [open, block]);

  if (!open || !block) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSaveComment({
      blockId: block.BlockId || block.block_id || block.id,
      dayKey: block.Date || block.day_key,
      studyReview: comment.trim()
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(500px, 98vw)",
          backgroundColor: "var(--bg-surface)",
          borderRadius: 18,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-default)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Notes</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0 0" }}>
              + Active Session Note / Comment
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {block.plan_comment && (
            <div style={{ background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>Pre-Study Intent (Plan Comment):</strong> {block.plan_comment}
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Take quick notes while studying. Autosaved immediately to the Study Block record (study review) so it survives navigation and reloads.
          </div>
          <textarea
            rows={4}
            placeholder='e.g. "Completed first half. Need to revise diagram."'
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box"
            }}
            autoFocus
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "#ffffff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
