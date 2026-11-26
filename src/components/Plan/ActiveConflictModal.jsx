import React, { useState, useEffect } from "react";

export default function ActiveConflictModal({
  open,
  activeBlock,
  targetBlock,
  onKeepStudying,
  onPauseAndStartNew,
  onFinishCurrentFirst,
  busy = false
}) {
  if (!open || !activeBlock) return null;

  const subject = activeBlock.PlannedSubject || activeBlock.subject || "Current Block";
  const topic = activeBlock.PlannedTopic || activeBlock.topic || activeBlock.custom_topic || "";
  const started = activeBlock.ActualStart || activeBlock.started_at;
  let startedTimeStr = "Recently";
  if (started) {
    try {
      startedTimeStr = new Date(started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {}
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(5px)",
        zIndex: 1350,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onKeepStudying}
    >
      <div
        style={{
          width: "min(500px, 98vw)",
          backgroundColor: "var(--bg-surface)",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-default)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(234, 179, 8, 0.12)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--warning, #eab308)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Active Session Guard
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--warning, #eab308)", margin: "2px 0 0 0" }}>
              Already Studying Another Block
            </h2>
          </div>
          <button onClick={onKeepStudying} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Currently Studying:</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
              {subject}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginTop: 2 }}>
              {topic}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⏱️ Started:</span>
              <strong style={{ color: "var(--text-primary)" }}>{startedTimeStr}</strong>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            MentorOS enforces one active study session at a time. Never auto-completing: choose how you want to handle this session before starting the new block.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              disabled={busy}
              onClick={onKeepStudying}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center"
              }}
            >
              Keep Studying (Dismiss)
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onPauseAndStartNew}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid var(--brand-primary)",
                background: "var(--brand-primary-soft)",
                color: "var(--brand-primary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                textAlign: "center"
              }}
            >
              Pause Current & Start New
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onFinishCurrentFirst}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: "var(--success, #16a34a)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)"
              }}
            >
              Finish Current First
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
