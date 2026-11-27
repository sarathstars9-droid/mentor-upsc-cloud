import React from "react";

export default function QuickActionsRail({
  onUploadPlan,
  onAddBlock,
  onNavigateRevision,
  onNavigateLogBook,
  busy = false
}) {
  return (
    <div
      className="mos-quick-actions-rail"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: "var(--shadow-card)"
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12 }}>
        QUICK ACTIONS
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={onUploadPlan}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            transition: "border-color 0.15s ease"
          }}
        >
          <span>📷</span>
          <span>Upload Daily Plan</span>
        </button>

        <button
          type="button"
          onClick={onAddBlock}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            transition: "border-color 0.15s ease"
          }}
        >
          <span>➕</span>
          <span>Add Study Block</span>
        </button>

        <button
          type="button"
          onClick={onNavigateRevision}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            transition: "border-color 0.15s ease"
          }}
        >
          <span>🔄</span>
          <span>Revision Hub</span>
        </button>

        <button
          type="button"
          onClick={onNavigateLogBook}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            transition: "border-color 0.15s ease"
          }}
        >
          <span>📖</span>
          <span>Study Log Book</span>
        </button>
      </div>
    </div>
  );
}
