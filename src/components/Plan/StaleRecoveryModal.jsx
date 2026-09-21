import React, { useState } from "react";
import { fetchWithAuth } from "../../utils/auth";

export default function StaleRecoveryModal({ isOpen, staleBlock, onClose, onRecovered }) {
  const [minutes, setMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !staleBlock) return null;

  const plannedMinutes = Number(staleBlock.plannedMinutes || staleBlock.PlannedMinutes || 120);
  const sessionAgeMinutes = Number(
    staleBlock.wallClockOpenMinutes ||
    staleBlock.sessionAgeMinutes ||
    staleBlock.StaleSessionAgeMinutes ||
    0
  );
  const openHours = (sessionAgeMinutes / 60).toFixed(1);
  const maxCeiling = Math.min(staleBlock.thresholdMinutes || staleBlock.StaleThresholdMinutes || 720, 720);
  const blockId = staleBlock.blockId || staleBlock.BlockId || "";
  const dayKey = staleBlock.dayKey || staleBlock.DayKey || (blockId.startsWith("20") ? blockId.slice(0, 10) : undefined);
  const startedAtStr = staleBlock.startedAt || staleBlock.ActualStart;

  const handleRecover = async (resolution) => {
    setIsSubmitting(true);
    setError("");

    let actualMin = 0;
    if (resolution === "user_confirmed") {
      actualMin = parseInt(minutes, 10);
      if (isNaN(actualMin) || actualMin < 0) {
        setError("Please enter a valid non-negative number of minutes.");
        setIsSubmitting(false);
        return;
      }
      if (actualMin > maxCeiling) {
        setError(`Minutes cannot exceed the maximum allowed ceiling of ${maxCeiling} minutes (12 hours).`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetchWithAuth(`/api/plan/blocks/${encodeURIComponent(blockId)}/recover-stale-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualMinutes: actualMin,
          resolution,
          dayKey
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "Failed to recover session");
      } else {
        onRecovered();
      }
    } catch (err) {
      setError(err.message || "Network error while resolving session");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          width: "min(480px, 96vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "24px",
          border: "1px solid #e2e8f0",
          opacity: 1,
          color: "#0f172a",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          Lifecycle Recovery
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
          Session Recovery Required
        </h2>

        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
          MentorOS detected a study session that technically remained open across multiple days. Please confirm your actual focused study time for this block before starting a new session.
        </p>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px", borderRadius: 10, marginBottom: 18, fontSize: 13 }}>
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 500 }}>Block ID:</span>
            <span style={{ fontWeight: 600, color: "#0f172a", wordBreak: "break-all", marginLeft: 8 }}>{blockId}</span>
          </div>
          {startedAtStr && (
            <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontWeight: 500 }}>Started At:</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{new Date(startedAtStr).toLocaleString()}</span>
            </div>
          )}
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 500 }}>Session Open For (Wall Clock):</span>
            <span style={{ fontWeight: 700, color: "#d97706" }}>{openHours} hours</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 500 }}>Planned Duration:</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{plannedMinutes} minutes</span>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Actual Focused Study Time (Minutes)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min="0"
                max={maxCeiling}
                placeholder={`e.g. ${plannedMinutes}`}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  height: 42,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
              <button
                type="button"
                disabled={isSubmitting || minutes === ""}
                onClick={() => handleRecover("user_confirmed")}
                style={{
                  background: "#0A64F5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 18px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isSubmitting || minutes === "" ? "not-allowed" : "pointer",
                  opacity: isSubmitting || minutes === "" ? 0.6 : 1,
                }}
              >
                Confirm
              </button>
            </div>
          </label>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleRecover("abandoned")}
            style={{
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              transition: "background 0.2s",
            }}
          >
            Mark as Abandoned (0 minutes)
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#64748b",
              border: "none",
              padding: "6px",
              fontSize: 13,
              fontWeight: 500,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              textDecoration: "underline",
            }}
          >
            Cancel and resolve later
          </button>
        </div>
      </div>
    </div>
  );
}
