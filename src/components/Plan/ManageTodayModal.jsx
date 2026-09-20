import { useState } from "react";
import { getBlockTimeRange, getEffectiveBlockStatus } from "../../utils/studyEngine";

export default function ManageTodayModal({
  open,
  onClose,
  todayBlocks = [],
  onOpenAddBlock,
  onEditBlock,
  onDeleteBlock,
  onResetExecution,
  onClearTimetable,
  busy = false,
}) {
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'reset' | 'clear' | 'delete', block?: block }

  if (!open) return null;

  const totalPlannedMinutes = todayBlocks.reduce((sum, b) => sum + Number(b.PlannedMinutes || 0), 0);

  function handleConfirmExecution() {
    if (!confirmAction) return;
    if (confirmAction.type === "reset") {
      onResetExecution?.();
    } else if (confirmAction.type === "clear") {
      onClearTimetable?.();
    } else if (confirmAction.type === "delete" && confirmAction.block) {
      onDeleteBlock?.(confirmAction.block);
    }
    setConfirmAction(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(640px, 98vw)",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          opacity: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Timetable Management
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "2px 0 0 0" }}>
              Manage Today's Schedule
            </h2>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              {todayBlocks.length} block{todayBlocks.length === 1 ? "" : "s"} scheduled · {totalPlannedMinutes} min total planned
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              fontWeight: 700,
              color: "#64748b",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Action Bar */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenAddBlock?.()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "#0A64F5",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(10, 100, 245, 0.2)",
            }}
          >
            <span>+</span> Add Study Block
          </button>

          <button
            type="button"
            disabled={busy || todayBlocks.length === 0}
            onClick={() => setConfirmAction({ type: "reset" })}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "#fffbe6",
              color: "#d97706",
              fontWeight: 700,
              fontSize: 13,
              border: "1px solid #fef08a",
              cursor: "pointer",
            }}
          >
            ↺ Reset execution
          </button>

          <button
            type="button"
            disabled={busy || todayBlocks.length === 0}
            onClick={() => setConfirmAction({ type: "clear" })}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "#fef2f2",
              color: "#dc2626",
              fontWeight: 700,
              fontSize: 13,
              border: "1px solid #fecaca",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            🗑 Clear timetable
          </button>
        </div>

        {/* Blocks List Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {todayBlocks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#64748b",
                border: "2px dashed #e2e8f0",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#334155", marginBottom: 4 }}>No Study Blocks Scheduled</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Your timetable for today is currently empty.</div>
              <button
                type="button"
                onClick={() => onOpenAddBlock?.()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#0A64F5",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + Add First Block
              </button>
            </div>
          ) : (
            todayBlocks.map((block, index) => {
              const status = getEffectiveBlockStatus(block).toLowerCase();
              const timeRange = getBlockTimeRange(block);
              const subject = block.PlannedSubject || block.subject || "Study Block";
              const topic = block.PlannedTopic || block.topic || "";

              return (
                <div
                  key={block.BlockId || index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: status === "active" ? "#f0f6ff" : "#ffffff",
                    borderLeft: status === "active" ? "4px solid #0A64F5" : "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{subject}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                          background:
                            status === "active"
                              ? "#dbeafe"
                              : status === "completed" || status === "done"
                              ? "#dcfce7"
                              : "#f1f5f9",
                          color:
                            status === "active"
                              ? "#1e40af"
                              : status === "completed" || status === "done"
                              ? "#166534"
                              : "#475569",
                        }}
                      >
                        {status}
                      </span>
                    </div>

                    {topic && <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>{topic}</div>}

                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", fontFamily: "var(--mono, monospace)" }}>
                      {timeRange} · {block.PlannedMinutes || 0} min
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onEditBlock?.(block)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "#f1f5f9",
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: 12,
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmAction({ type: "delete", block })}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontWeight: 700,
                        fontSize: 12,
                        border: "1px solid #fecaca",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            background: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 13,
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal */}
      {confirmAction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            style={{
              width: "min(440px, 94vw)",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 0, marginBottom: 8 }}>
              {confirmAction.type === "reset"
                ? "Confirm Reset Execution?"
                : confirmAction.type === "clear"
                ? "Confirm Clear Timetable?"
                : "Confirm Delete Block?"}
            </h3>

            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 20 }}>
              {confirmAction.type === "reset"
                ? "Reset execution will preserve your planned blocks, but clear today's recorded timer progress and status back to 'planned'."
                : confirmAction.type === "clear"
                ? "Clear timetable will remove all planned study blocks for today and return your plan to the empty state."
                : `Are you sure you want to remove "${confirmAction.block?.PlannedSubject || "this block"}" from today's timetable?`}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#ffffff",
                  color: "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmExecution}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: confirmAction.type === "reset" ? "#d97706" : "#dc2626",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {confirmAction.type === "reset" ? "Yes, Reset Execution" : confirmAction.type === "clear" ? "Yes, Clear Timetable" : "Yes, Delete Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
