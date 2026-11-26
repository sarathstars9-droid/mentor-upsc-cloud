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
  "Essay",
  "Mains Answer Writing",
  "Revision/Buffer"
];

const FALLBACK_TOPICS = {
  "Geography Optional": [
    "Climatology",
    "Geomorphology",
    "Oceanography",
    "Indian Geography",
    "Models & Theories",
    "Biogeography"
  ],
  "CSAT": [
    "Number System",
    "Reading Comprehension",
    "Logical Reasoning",
    "Data Interpretation",
    "Percentages & Profit",
    "Time & Work"
  ],
  "Current Affairs": [
    "Daily CA",
    "The Hindu Editorial",
    "PIB Summary",
    "Monthly Magazine Revision",
    "Government Schemes"
  ],
  "GS1": [
    "Modern Indian History",
    "Art & Culture",
    "Ancient History",
    "Indian Society",
    "Physical Geography"
  ],
  "GS2": [
    "Polity & Constitution",
    "Governance",
    "Social Justice",
    "International Relations"
  ],
  "GS3": [
    "Economy",
    "Agriculture",
    "Environment & Ecology",
    "Science & Technology",
    "Internal Security"
  ],
  "GS4 Ethics": [
    "Ethics & Human Interface",
    "Attitude & Values",
    "Emotional Intelligence",
    "Case Studies Practice"
  ],
  "Essay": [
    "Philosophical Essay Outline",
    "Society & Culture Themes",
    "Technology & AI Governance"
  ]
};

const DURATION_CHIPS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "1h30m", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "2h30m", minutes: 150 },
  { label: "3h", minutes: 180 },
  { label: "3h30m", minutes: 210 },
  { label: "Custom", minutes: null }
];

export default function AddStudyBlockModal({ open, onClose, onAddBlock, onAdd, busy = false }) {
  const [recentSubjects, setRecentSubjects] = useState([]);
  const [recentTopicsMap, setRecentTopicsMap] = useState({});
  const [selectedSubject, setSelectedSubject] = useState("Geography Optional");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectText, setCustomSubjectText] = useState("");

  const [selectedTopic, setSelectedTopic] = useState("");
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopicText, setCustomTopicText] = useState("");
  const [subtopicText, setSubtopicText] = useState("");

  const [durationMinutes, setDurationMinutes] = useState(120);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMins, setCustomMins] = useState(0);

  const [planComment, setPlanComment] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      // Fetch dynamic user recent subjects and topics
      fetchWithAuth("/api/plan/blocks/recents")
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok) {
            if (Array.isArray(data.recentSubjects) && data.recentSubjects.length > 0) {
              setRecentSubjects(data.recentSubjects);
              setSelectedSubject(data.recentSubjects[0]);
            } else {
              setRecentSubjects([]);
              setSelectedSubject(STANDARD_SUBJECTS[0]);
            }
            if (data.recentTopicsBySubject) {
              setRecentTopicsMap(data.recentTopicsBySubject);
            }
          }
        })
        .catch((err) => {
          console.warn("Could not load recents:", err);
          setSelectedSubject(STANDARD_SUBJECTS[0]);
        });
    }
  }, [open]);

  if (!open) return null;

  const currentSubject = isCustomSubject ? customSubjectText.trim() : selectedSubject;
  const suggestedList = (recentTopicsMap[selectedSubject] && recentTopicsMap[selectedSubject].length > 0)
    ? recentTopicsMap[selectedSubject]
    : (FALLBACK_TOPICS[selectedSubject] || []);

  function handleSelectSubject(subj) {
    if (subj === "__other__") {
      setIsCustomSubject(true);
    } else {
      setIsCustomSubject(false);
      setSelectedSubject(subj);
      setSelectedTopic("");
      setIsCustomTopic(false);
    }
  }

  function handleSelectDurationChip(chip) {
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
    const total = hours * 60 + mins;
    setDurationMinutes(total);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setValidationError("");

    const finalSubject = (isCustomSubject ? customSubjectText : selectedSubject).trim();
    if (!finalSubject) {
      setValidationError("Please select or enter a subject.");
      return;
    }

    const finalTopic = (isCustomTopic ? customTopicText : (selectedTopic || customTopicText)).trim();
    if (!finalTopic) {
      setValidationError("Please select or enter a topic.");
      return;
    }

    let finalMins = durationMinutes;
    if (isCustomDuration) {
      finalMins = (Number(customHours) || 0) * 60 + (Number(customMins) || 0);
    }

    if (!finalMins || finalMins <= 0) {
      setValidationError("Planned study duration must be greater than 0 minutes.");
      return;
    }

    const addFn = onAddBlock || onAdd;
    if (addFn) {
      addFn({
        subject: finalSubject,
        topic: finalTopic,
        subtopic: subtopicText.trim(),
        customTopic: isCustomTopic ? finalTopic : (customTopicText.trim() || ""),
        plannedMinutes: Math.round(finalMins),
        planComment: planComment.trim(),
        source: "manual",
        status: "planned"
      });
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
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
          width: "min(620px, 98vw)",
          maxHeight: "90vh",
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
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Study Block Planner
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>
              + Add Study Block
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {validationError && (
            <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid var(--error, #dc2626)", borderRadius: 10, color: "var(--error, #dc2626)", fontSize: 13, fontWeight: 600 }}>
              {validationError}
            </div>
          )}

          {/* 1. SUBJECT */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
              SUBJECT
            </label>
            {recentSubjects.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 6 }}>Recent Subjects:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {recentSubjects.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => handleSelectSubject(s)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: !isCustomSubject && selectedSubject === s ? "2px solid var(--brand-primary)" : "1px solid var(--border-default)",
                        background: !isCustomSubject && selectedSubject === s ? "var(--brand-primary-soft)" : "var(--bg-subtle)",
                        color: !isCustomSubject && selectedSubject === s ? "var(--brand-primary)" : "var(--text-secondary)"
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={isCustomSubject ? "__other__" : selectedSubject}
                onChange={(e) => handleSelectSubject(e.target.value)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  padding: "0 10px",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  background: "var(--bg-subtle)"
                }}
              >
                {STANDARD_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__other__">+ Other Subject...</option>
              </select>
            </div>

            {isCustomSubject && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Type custom subject name..."
                  value={customSubjectText}
                  onChange={(e) => setCustomSubjectText(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid var(--brand-primary)",
                    background: "var(--bg-subtle)",
                    color: "var(--text-primary)",
                    padding: "0 12px",
                    fontSize: 13,
                    boxSizing: "border-box"
                  }}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 2. TOPIC & SUBTOPIC */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                TOPIC
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomTopic(!isCustomTopic);
                  if (!isCustomTopic) setSelectedTopic("");
                }}
                style={{ background: "none", border: "none", color: "var(--brand-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {isCustomTopic ? "← Pick from Suggested" : "+ Other / Custom Topic"}
              </button>
            </div>

            {!isCustomTopic && suggestedList.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 6 }}>Suggested for {selectedSubject}:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestedList.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        setSelectedTopic(t);
                        setIsCustomTopic(false);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        border: selectedTopic === t ? "1px solid var(--brand-primary)" : "1px solid var(--border-subtle)",
                        background: selectedTopic === t ? "var(--brand-primary-soft)" : "var(--bg-subtle)",
                        color: selectedTopic === t ? "var(--brand-primary)" : "var(--text-secondary)"
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder={isCustomTopic ? 'e.g. "Urban morphology revision"' : "Or type specific topic..."}
                value={isCustomTopic ? customTopicText : (selectedTopic || customTopicText)}
                onChange={(e) => {
                  if (isCustomTopic) {
                    setCustomTopicText(e.target.value);
                  } else {
                    setSelectedTopic(e.target.value);
                  }
                }}
                style={{
                  height: 38,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-subtle)",
                  color: "var(--text-primary)",
                  padding: "0 12px",
                  fontSize: 13,
                  boxSizing: "border-box"
                }}
              />
              <input
                type="text"
                placeholder="Optional subtopic (e.g. Jet Streams, Remainders)..."
                value={subtopicText}
                onChange={(e) => setSubtopicText(e.target.value)}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-subtle)",
                  color: "var(--text-secondary)",
                  padding: "0 12px",
                  fontSize: 12,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          {/* 3. PLANNED DURATION CHIPS */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                PLANNED DURATION
              </label>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)" }}>
                {isCustomDuration
                  ? `${(Number(customHours) || 0)}h ${(Number(customMins) || 0)}m (${(Number(customHours) || 0) * 60 + (Number(customMins) || 0)} mins)`
                  : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ""} (${durationMinutes} mins)`}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DURATION_CHIPS.map((chip) => {
                const isSelected = (!isCustomDuration && chip.minutes === durationMinutes) || (isCustomDuration && chip.label === "Custom");
                return (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => handleSelectDurationChip(chip)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--brand-primary)" : "1px solid var(--border-default)",
                      background: isSelected ? "var(--brand-primary-soft)" : "var(--bg-subtle)",
                      color: isSelected ? "var(--brand-primary)" : "var(--text-secondary)"
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {isCustomDuration && (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={customHours}
                    onChange={(e) => handleCustomTimeChange(e.target.value, customMins)}
                    style={{ width: 55, height: 34, textAlign: "center", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Hours</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={customMins}
                    onChange={(e) => handleCustomTimeChange(customHours, e.target.value)}
                    style={{ width: 55, height: 34, textAlign: "center", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Minutes</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  = {(Number(customHours) || 0) * 60 + (Number(customMins) || 0)} integer minutes
                </span>
              </div>
            )}
          </div>

          {/* 4. PLAN COMMENT (Pre-Study Intent) */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
              PLAN COMMENT (Intent / Goals)
            </label>
            <textarea
              rows={3}
              placeholder='e.g. "Target: complete 20 PYQ questions from 2021-2023 papers"'
              value={planComment}
              onChange={(e) => setPlanComment(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
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
                background: "var(--brand-primary)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(10, 100, 245, 0.3)"
              }}
            >
              {busy ? "Creating…" : "Save Study Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
