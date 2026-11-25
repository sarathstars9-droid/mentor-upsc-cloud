import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "../../utils/auth";

const STANDARD_SUBJECTS = [
  "Geography Optional",
  "CSAT",
  "Current Affairs",
  "GS1",
  "GS2",
  "GS3",
  "GS4 Ethics",
  "Essay"
];

const DURATION_CHIPS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "1h30m", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "2h30m", minutes: 150 },
  { label: "3h", minutes: 180 },
  { label: "Custom", minutes: null }
];

export default function QuickStartModal({ open, onClose, onQuickStart, busy = false }) {
  const [subjectsList, setSubjectsList] = useState(STANDARD_SUBJECTS);
  const [subject, setSubject] = useState(STANDARD_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMins, setCustomMins] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetchWithAuth("/api/plan/blocks/recents")
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && Array.isArray(data.recentSubjects) && data.recentSubjects.length > 0) {
            setSubjectsList(data.recentSubjects);
            setSubject(data.recentSubjects[0]);
          } else {
            setSubjectsList(STANDARD_SUBJECTS);
            setSubject(STANDARD_SUBJECTS[0]);
          }
        })
        .catch(() => {
          setSubjectsList(STANDARD_SUBJECTS);
          setSubject(STANDARD_SUBJECTS[0]);
        });
    }
  }, [open]);

  if (!open) return null;

  function handleSelectDuration(chip) {
    if (chip.label === "Custom") {
      setIsCustomDuration(true);
      const computed = (Number(customHours) || 0) * 60 + (Number(customMins) || 0);
      setDurationMinutes(computed > 0 ? computed : 60);
    } else {
      setIsCustomDuration(false);
      setDurationMinutes(chip.minutes);
    }
  }

  function handleCustomTimeChange(h, m) {
    const hours = Math.max(0, parseInt(h, 10) || 0);
    const mins = Math.max(0, Math.min(59, parseInt(m, 10) || 0));
    setCustomHours(hours);
    setCustomMins(mins);
    setDurationMinutes(hours * 60 + mins);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!subject.trim()) {
      setError("Please choose a subject.");
      return;
    }

    if (!topic.trim()) {
      setError("Please specify the study topic.");
      return;
    }

    let finalMins = durationMinutes;
    if (isCustomDuration) {
      finalMins = (Number(customHours) || 0) * 60 + (Number(customMins) || 0);
    }

    if (!finalMins || finalMins <= 0) {
      setError("Planned duration must be greater than 0 minutes.");
      return;
    }

    onQuickStart({
      subject: subject.trim(),
      topic: topic.trim(),
      plannedMinutes: Math.round(finalMins),
      source: "quick_start",
      status: "active"
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 98vw)",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Fast Track
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "2px 0 0 0" }}>
              ⚡ Quick Start Study Block
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Subject
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {subjectsList.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSubject(s)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: subject === s ? "2px solid #0A64F5" : "1px solid #cbd5e1",
                    background: subject === s ? "rgba(10, 100, 245, 0.08)" : "#ffffff",
                    color: subject === s ? "#0A64F5" : "#334155"
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Topic
            </label>
            <input
              type="text"
              placeholder="e.g. Climatology - Jet Streams, CSAT Number System..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontSize: 14,
                boxSizing: "border-box"
              }}
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                Target Duration
              </label>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0A64F5" }}>
                {isCustomDuration ? `${(Number(customHours) || 0) * 60 + (Number(customMins) || 0)} mins` : `${durationMinutes} mins`}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DURATION_CHIPS.map((chip) => {
                const isSelected = (!isCustomDuration && chip.minutes === durationMinutes) || (isCustomDuration && chip.label === "Custom");
                return (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => handleSelectDuration(chip)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isSelected ? "2px solid #0A64F5" : "1px solid #cbd5e1",
                      background: isSelected ? "rgba(10, 100, 245, 0.08)" : "#ffffff",
                      color: isSelected ? "#0A64F5" : "#334155"
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {isCustomDuration && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  max="16"
                  value={customHours}
                  onChange={(e) => handleCustomTimeChange(e.target.value, customMins)}
                  style={{ width: 45, height: 30, textAlign: "center", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  value={customMins}
                  onChange={(e) => handleCustomTimeChange(customHours, e.target.value)}
                  style={{ width: 45, height: 30, textAlign: "center", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>m</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                border: "none",
                background: "#0A64F5",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(10, 100, 245, 0.3)"
              }}
            >
              {busy ? "Starting…" : "Start Studying Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
