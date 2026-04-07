import React from "react";

const YEAR_OPTIONS = [
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
  "2014",
  "2013",
];

export default function PyqTestStart({
  testMode = "sectional",
  setTestMode = () => { },

  fullLengthType = "gs_yearwise",
  setFullLengthType = () => { },

  fullLengthYear = "2020",
  setFullLengthYear = () => { },

  institutionalForm = {},
  setInstitutionalForm = () => { },

  practicePaper = "GS",
  setPracticePaper = () => { },

  practiceScope = "subject",
  setPracticeScope = () => { },

  selectedSubjectId = "",
  setSelectedSubjectId = () => { },

  selectedTopicId = "",
  setSelectedTopicId = () => { },

  selectedMicroThemeIds = [],
  setSelectedMicroThemeIds = () => { },

  practiceQuestionCount = 10,
  setPracticeQuestionCount = () => { },

  subjects = [],
  topics = [],
  microThemes = [],

  availableQuestionCount = 0,

  onStart = () => { },
  loading = false,
  error = null,
  disableStart = false,
}) {
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeMicroThemes = Array.isArray(microThemes) ? microThemes : [];
  const safeSelectedMicroThemeIds = Array.isArray(selectedMicroThemeIds)
    ? selectedMicroThemeIds
    : [];

  const requiresSubtopics =
    practiceScope === "subtopic" ||
    (practicePaper === "CSAT" && practiceScope === "topic" && safeMicroThemes.length > 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ModeChip
          active={testMode === "sectional"}
          onClick={() => setTestMode("sectional")}
          label="Practice"
        />
        <ModeChip
          active={testMode === "full_length"}
          onClick={() => setTestMode("full_length")}
          label="Full-Length"
        />
        <ModeChip
          active={testMode === "institutional"}
          onClick={() => setTestMode("institutional")}
          label="Institutional"
        />
      </div>

      {testMode === "sectional" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip
              active={practicePaper === "GS"}
              onClick={() => setPracticePaper("GS")}
              label="GS"
            />
            <SubModeChip
              active={practicePaper === "CSAT"}
              onClick={() => setPracticePaper("CSAT")}
              label="CSAT"
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip
              active={practiceScope === "subject"}
              onClick={() => setPracticeScope("subject")}
              label="Full Subject"
            />
            <SubModeChip
              active={practiceScope === "topic"}
              onClick={() => setPracticeScope("topic")}
              label="Topic-wise"
            />
            <SubModeChip
              active={practiceScope === "subtopic"}
              onClick={() => setPracticeScope("subtopic")}
              label="Subtopic-wise"
            />
          </div>

          <div style={grid2}>
            <Field label="Subject">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select Subject</option>
                {safeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {`${subject.label} (${subject.count ?? 0})`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Question Count">
              <input
                type="number"
                min={1}
                max={Math.max(availableQuestionCount || 1, 1)}
                value={practiceQuestionCount}
                onChange={(e) =>
                  setPracticeQuestionCount(
                    Math.min(
                      Number(e.target.value) || 1,
                      Math.max(availableQuestionCount || 1, 1)
                    )
                  )
                }
                style={inputStyle}
              />
            </Field>
          </div>

          {practiceScope !== "subject" && (
            <Field label="Topic">
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select Topic</option>
                {safeTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {`${topic.name} (${topic.count ?? 0})`}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {requiresSubtopics && (
            <Field
              label={
                practicePaper === "CSAT" && practiceScope === "topic"
                  ? "Subtopics (required for CSAT topic tests)"
                  : "Subtopics"
              }
            >
              <div style={checkboxWrapStyle}>
                {safeMicroThemes.length ? (
                  safeMicroThemes.map((item) => {
                    const checked = safeSelectedMicroThemeIds.includes(item.id);
                    return (
                      <label key={item.id} style={checkboxItemStyle(checked)}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMicroThemeIds([
                                ...safeSelectedMicroThemeIds,
                                item.id,
                              ]);
                            } else {
                              setSelectedMicroThemeIds(
                                safeSelectedMicroThemeIds.filter(
                                  (id) => id !== item.id
                                )
                              );
                            }
                          }}
                        />
                        <span>{`${item.label} (${item.count ?? 0})`}</span>
                      </label>
                    );
                  })
                ) : (
                  <div style={emptyHintStyle}>
                    No subtopics available for the selected topic yet.
                  </div>
                )}
              </div>
            </Field>
          )}

          <div
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(56,189,248,0.06))",
              border: "1px solid rgba(99,102,241,0.28)",
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div style={{
              fontSize: 34,
              fontWeight: 900,
              color: "#a5b4fc",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              {availableQuestionCount || 0}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
                Available Questions
              </div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                {practiceScope === "subject"
                  ? "PYQs in the selected subject"
                  : requiresSubtopics
                    ? "PYQs in the selected subtopics"
                    : "PYQs in the selected topic"}
              </div>
            </div>
          </div>

          <InfoBox
            title="Practice Engine"
            lines={[
              "Full Subject = all PYQs from the selected subject.",
              "Topic-wise = one syllabus topic.",
              "Subtopic-wise = precision practice on selected micro-themes.",
              "For CSAT, subtopic selection is mandatory unless you choose Full Subject.",
            ]}
          />
        </div>
      )}

      {testMode === "full_length" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip
              active={fullLengthType === "gs_yearwise"}
              onClick={() => setFullLengthType("gs_yearwise")}
              label="GS Year-wise"
            />
            <SubModeChip
              active={fullLengthType === "csat_yearwise"}
              onClick={() => setFullLengthType("csat_yearwise")}
              label="CSAT Year-wise"
            />
          </div>

          <div style={grid2}>
            <Field label="Year">
              <select
                value={fullLengthYear}
                onChange={(e) => setFullLengthYear(e.target.value)}
                style={inputStyle}
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Question Count">
              <input
                value={fullLengthType === "gs_yearwise" ? 100 : 80}
                disabled
                style={{ ...inputStyle, opacity: 0.75, cursor: "not-allowed" }}
              />
            </Field>
          </div>

          <InfoBox
            title="Full-Length Purpose"
            lines={[
              "Simulates the actual UPSC paper year-wise.",
              "Good for paper temperament, sequencing, and time-pressure handling.",
            ]}
          />
        </div>
      )}

      {testMode === "institutional" && (
        <div
          style={{
            display: "grid",
            gap: 14,
            padding: 16,
            borderRadius: 18,
            border: "1px dashed rgba(250,204,21,0.35)",
            background: "rgba(250,204,21,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Institutional Test Upload
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                UI ready now. Parser can be enabled next without redesign.
              </div>
            </div>
            <span style={comingBadge}>Coming next</span>
          </div>

          <div style={grid2}>
            <Field label="Institute Name">
              <input
                value={institutionalForm?.instituteName || ""}
                onChange={(e) =>
                  setInstitutionalForm((prev) => ({
                    ...(prev || {}),
                    instituteName: e.target.value,
                  }))
                }
                placeholder="e.g. Vision IAS"
                style={inputStyle}
              />
            </Field>

            <Field label="Test Title">
              <input
                value={institutionalForm?.testTitle || ""}
                onChange={(e) =>
                  setInstitutionalForm((prev) => ({
                    ...(prev || {}),
                    testTitle: e.target.value,
                  }))
                }
                placeholder="e.g. FLT-03"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={grid2}>
            <Field label="Question Paper">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) =>
                  setInstitutionalForm((prev) => ({
                    ...(prev || {}),
                    questionPaperFile: e.target.files?.[0] || null,
                  }))
                }
                style={fileInputStyle}
              />
            </Field>

            <Field label="Answer Key">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) =>
                  setInstitutionalForm((prev) => ({
                    ...(prev || {}),
                    answerKeyFile: e.target.files?.[0] || null,
                  }))
                }
                style={fileInputStyle}
              />
            </Field>
          </div>

          <Field label="Optional Pasted Text">
            <textarea
              rows={5}
              value={institutionalForm?.pastedText || ""}
              onChange={(e) =>
                setInstitutionalForm((prev) => ({
                  ...(prev || {}),
                  pastedText: e.target.value,
                }))
              }
              placeholder="Paste readable institutional test text here..."
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 120,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            />
          </Field>

          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.7 }}>
            Supported later: text-based readable PDF, DOC, DOCX, TXT, and pasted
            text. No OCR-first workflow. No image uploads.
          </div>
        </div>
      )}

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fecaca",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        onClick={() => {
          if (typeof onStart === "function") {
            onStart();
          }
        }}
        disabled={loading || testMode === "institutional" || disableStart}
        style={startBtn(loading || testMode === "institutional" || disableStart)}
      >
        {loading
          ? "Loading Test..."
          : testMode === "institutional"
            ? "Institutional Parser Coming Next"
            : "Start Test"}
      </button>
    </div>
  );
}

function ModeChip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} style={modeChipStyle(active)}>
      {label}
    </button>
  );
}

function SubModeChip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} style={subModeChipStyle(active)}>
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      {children}
    </label>
  );
}

function InfoBox({ title, lines = [] }) {
  const safeLines = Array.isArray(lines) ? lines : [];

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: "3px solid rgba(99,102,241,0.45)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {safeLines.map((line, idx) => (
          <div
            key={`${title}_${idx}`}
            style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65 }}
          >
            · {line}
          </div>
        ))}
      </div>
    </div>
  );
}

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const inputStyle = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.65)",
  color: "#e2e8f0",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const fileInputStyle = {
  ...inputStyle,
  height: "auto",
  padding: "10px 12px",
};

const comingBadge = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.25)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 700,
};

const checkboxWrapStyle = {
  display: "grid",
  gap: 8,
  maxHeight: 220,
  overflowY: "auto",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

function checkboxItemStyle(active) {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    background: active ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.02)",
    border: active
      ? "1px solid rgba(99,102,241,0.3)"
      : "1px solid rgba(255,255,255,0.04)",
    fontSize: 13,
    cursor: "pointer",
  };
}

const emptyHintStyle = {
  fontSize: 12,
  opacity: 0.75,
  padding: "8px 4px",
};

function modeChipStyle(active) {
  return {
    height: 40,
    borderRadius: 999,
    border: active
      ? "1px solid rgba(99,102,241,0.85)"
      : "1px solid rgba(255,255,255,0.09)",
    background: active
      ? "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(129,140,248,0.18))"
      : "rgba(255,255,255,0.04)",
    color: active ? "#c7d2fe" : "rgba(229,231,235,0.65)",
    fontWeight: active ? 800 : 600,
    fontSize: 14,
    padding: "0 18px",
    cursor: "pointer",
    boxShadow: active ? "0 0 14px rgba(99,102,241,0.18)" : "none",
    letterSpacing: 0.2,
  };
}

function subModeChipStyle(active) {
  return {
    height: 36,
    borderRadius: 999,
    border: active
      ? "1px solid rgba(56,189,248,0.7)"
      : "1px solid rgba(255,255,255,0.08)",
    background: active
      ? "linear-gradient(135deg, rgba(14,165,233,0.22), rgba(56,189,248,0.14))"
      : "rgba(255,255,255,0.03)",
    color: active ? "#7dd3fc" : "rgba(229,231,235,0.55)",
    fontWeight: active ? 800 : 600,
    fontSize: 13,
    padding: "0 14px",
    cursor: "pointer",
    boxShadow: active ? "0 0 10px rgba(56,189,248,0.12)" : "none",
  };
}

function startBtn(disabled) {
  return {
    height: 52,
    borderRadius: 14,
    border: disabled ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(99,102,241,0.5)",
    background: disabled
      ? "rgba(99,102,241,0.18)"
      : "linear-gradient(135deg, #6366f1, #818cf8)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: 0.3,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 24px rgba(99,102,241,0.30)",
  };
}