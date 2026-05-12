import React from "react";

// Fallback list used only until the API responds
const FALLBACK_GS_YEARS = Array.from({ length: 2025 - 1995 + 1 }, (_, i) => String(2025 - i));
const FALLBACK_CSAT_YEARS = ["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013","2012","2011"];

export default function PyqTestStart({
  testMode = "sectional",
  setTestMode = () => {},

  fullLengthType = "gs_yearwise",
  setFullLengthType = () => {},

  fullLengthYear = "2020",
  setFullLengthYear = () => {},

  practicePaper = "GS",
  setPracticePaper = () => {},

  practiceScope = "subject",
  setPracticeScope = () => {},

  selectedSubjectId = "",
  setSelectedSubjectId = () => {},

  selectedTopicId = "",
  setSelectedTopicId = () => {},

  selectedMicroThemeIds = [],
  setSelectedMicroThemeIds = () => {},

  practiceQuestionCount = 10,
  setPracticeQuestionCount = () => {},

  subjects = [],
  topics = [],
  microThemes = [],

  availableQuestionCount = 0,

  // ── Year filter (sectional mode, all optional) ──────────────────────────
  availableYears = { gs: [], csat: [] },
  sectionYearMode = "all",        // "all" | "single" | "range"
  setSectionYearMode = () => {},
  sectionYear = "",               // exact year when mode="single"
  setSectionYear = () => {},
  sectionYearFrom = "",           // range start when mode="range"
  setSectionYearFrom = () => {},
  sectionYearTo = "",             // range end when mode="range"
  setSectionYearTo = () => {},

  topicsHint = "",

  onStart = () => {},
  loading = false,
  error = null,
  disableStart = false,
}) {
  const safeSubjects              = Array.isArray(subjects)            ? subjects            : [];
  const safeTopics                = Array.isArray(topics)              ? topics              : [];
  const safeMicroThemes           = Array.isArray(microThemes)         ? microThemes         : [];
  const safeSelectedMicroThemeIds = Array.isArray(selectedMicroThemeIds) ? selectedMicroThemeIds : [];

  // ── Dynamic year lists ───────────────────────────────────────────────────
  const sortYearStringsDesc = (years = []) => years
    .map((year) => String(year))
    .filter((year) => /^\d{4}$/.test(year))
    .sort((a, b) => Number(b) - Number(a));
  const fullLengthPaperOptions = Array.isArray(availableYears?.fullLengthPapers)
    ? [...availableYears.fullLengthPapers]
      .filter((paper) => Number.isFinite(Number(paper?.year)))
      .sort((a, b) => Number(b.year) - Number(a.year))
    : [];
  const apiFullLengthYears = sortYearStringsDesc(availableYears?.availableFullLengthYears || []);
  const gsYearStrs = sortYearStringsDesc(availableYears?.gs || []);
  const csatYearStrs = sortYearStringsDesc(availableYears?.csat || []);
  const fullLengthYears = fullLengthType === "csat_yearwise"
    ? (csatYearStrs.length ? csatYearStrs : FALLBACK_CSAT_YEARS)
    : (apiFullLengthYears.length ? apiFullLengthYears : FALLBACK_GS_YEARS);

  console.log("[Prelims FullLength] API years:", apiFullLengthYears);
  console.log("[Prelims FullLength] final dropdown years:", fullLengthYears);

  // Year options for the sectional filter dropdowns (GS years for GS, CSAT for CSAT)
  const sectionYearOpts = practicePaper === "CSAT"
    ? (csatYearStrs.length ? csatYearStrs : FALLBACK_CSAT_YEARS)
    : (gsYearStrs.length   ? gsYearStrs   : FALLBACK_GS_YEARS);

  const requiresSubtopics =
    practiceScope === "subtopic" ||
    (practicePaper === "CSAT" && practiceScope === "topic" && safeMicroThemes.length > 0);

  // ── Year filter label for the info area ─────────────────────────────────
  let yearFilterSummary = "";
  if (testMode === "sectional") {
    if (sectionYearMode === "single" && sectionYear) {
      yearFilterSummary = `Year: ${sectionYear}`;
    } else if (sectionYearMode === "range") {
      if (sectionYearFrom && sectionYearTo) yearFilterSummary = `${sectionYearFrom} – ${sectionYearTo}`;
      else if (sectionYearFrom)             yearFilterSummary = `From ${sectionYearFrom}`;
      else if (sectionYearTo)               yearFilterSummary = `Up to ${sectionYearTo}`;
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Mode tabs ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ModeChip active={testMode === "sectional"}    onClick={() => setTestMode("sectional")}    label="Practice" />
        <ModeChip active={testMode === "full_length"}  onClick={() => setTestMode("full_length")}  label="Full-Length" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTIONAL MODE
      ═══════════════════════════════════════════════════════════════════ */}
      {testMode === "sectional" && (
        <div style={{ display: "grid", gap: 14 }}>

          {/* Paper */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip active={practicePaper === "GS"}   onClick={() => setPracticePaper("GS")}   label="GS" />
            <SubModeChip active={practicePaper === "CSAT"} onClick={() => setPracticePaper("CSAT")} label="CSAT" />
          </div>

          {/* Scope */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip active={practiceScope === "subject"}  onClick={() => setPracticeScope("subject")}  label="Full Subject" />
            <SubModeChip active={practiceScope === "topic"}    onClick={() => setPracticeScope("topic")}    label="Topic-wise" />
            <SubModeChip active={practiceScope === "subtopic"} onClick={() => setPracticeScope("subtopic")} label="Subtopic-wise" />
          </div>

          {/* Subject + count */}
          <div style={grid2}>
            <Field label="Subject">
              <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} style={inputStyle}>
                <option value="">Select Subject</option>
                {safeSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{`${s.label} (${s.count ?? 0})`}</option>
                ))}
              </select>
            </Field>
            <Field label="Question Count">
              <input
                type="number" min={1} max={Math.max(availableQuestionCount || 1, 1)}
                value={practiceQuestionCount}
                onChange={(e) => setPracticeQuestionCount(
                  Math.min(Number(e.target.value) || 1, Math.max(availableQuestionCount || 1, 1))
                )}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Topic */}
          {practiceScope !== "subject" && (
            <Field label="Topic">
              <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} style={inputStyle}>
                <option value="">Select Topic</option>
                {safeTopics.map((t) => (
                  <option key={t.id} value={t.id}>{`${t.name} (${t.count ?? 0})`}</option>
                ))}
              </select>
              {topicsHint && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontStyle: "italic" }}>
                  {topicsHint}
                </div>
              )}
            </Field>
          )}

          {/* Subtopics */}
          {requiresSubtopics && (
            <Field label={practicePaper === "CSAT" && practiceScope === "topic" ? "Subtopics (required for CSAT topic tests)" : "Subtopics"}>
              <div style={checkboxWrapStyle}>
                {safeMicroThemes.length ? (
                  safeMicroThemes.map((item) => {
                    const checked = safeSelectedMicroThemeIds.includes(item.id);
                    return (
                      <label key={item.id} style={checkboxItemStyle(checked)}>
                        <input
                          type="checkbox" checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMicroThemeIds([...safeSelectedMicroThemeIds, item.id]);
                            else setSelectedMicroThemeIds(safeSelectedMicroThemeIds.filter((id) => id !== item.id));
                          }}
                        />
                        <span>{`${item.label} (${item.count ?? 0})`}</span>
                      </label>
                    );
                  })
                ) : (
                  <div style={emptyHintStyle}>No subtopics available for the selected topic yet.</div>
                )}
              </div>
            </Field>
          )}

          {/* ── Year Filter ─────────────────────────────────────────────── */}
          <div style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.025)",
            border: sectionYearMode !== "all"
              ? "1px solid rgba(56,189,248,0.35)"
              : "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#64748b",
              letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              Year Filter
              {yearFilterSummary && (
                <span style={{
                  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: "rgba(56,189,248,0.14)", border: "1px solid rgba(56,189,248,0.3)",
                  color: "#7dd3fc", textTransform: "none", letterSpacing: 0,
                }}>
                  {yearFilterSummary}
                </span>
              )}
            </div>

            {/* Mode buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: sectionYearMode !== "all" ? 12 : 0 }}>
              {[
                { id: "all",    label: "All Years" },
                { id: "single", label: "Single Year" },
                { id: "range",  label: "Year Range" },
              ].map(({ id, label }) => (
                <button
                  key={id} type="button"
                  onClick={() => {
                    setSectionYearMode(id);
                    if (id === "all") { setSectionYear(""); setSectionYearFrom(""); setSectionYearTo(""); }
                    if (id === "single") { setSectionYearFrom(""); setSectionYearTo(""); }
                    if (id === "range")  { setSectionYear(""); }
                  }}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    border: sectionYearMode === id ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.08)",
                    background: sectionYearMode === id ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.03)",
                    color: sectionYearMode === id ? "#7dd3fc" : "rgba(229,231,235,0.55)",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Single year picker */}
            {sectionYearMode === "single" && (
              <select
                value={sectionYear}
                onChange={(e) => setSectionYear(e.target.value)}
                style={{ ...inputStyle, height: 38 }}
              >
                <option value="">Select Year</option>
                {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {/* Range picker */}
            {sectionYearMode === "range" && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>From</div>
                  <select
                    value={sectionYearFrom}
                    onChange={(e) => setSectionYearFrom(e.target.value)}
                    style={{ ...inputStyle, height: 38 }}
                  >
                    <option value="">Any</option>
                    {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ color: "#475569", fontSize: 16, fontWeight: 700, paddingTop: 18 }}>→</div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>To</div>
                  <select
                    value={sectionYearTo}
                    onChange={(e) => setSectionYearTo(e.target.value)}
                    style={{ ...inputStyle, height: 38 }}
                  >
                    <option value="">Any</option>
                    {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Available questions summary */}
          <div style={{
            padding: "16px 18px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(56,189,248,0.06))",
            border: "1px solid rgba(99,102,241,0.28)",
            display: "flex", alignItems: "center", gap: 18,
          }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#a5b4fc", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {availableQuestionCount || 0}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
                Available Questions
              </div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                {practiceScope === "subject" ? "PYQs in the selected subject"
                  : requiresSubtopics ? "PYQs in the selected subtopics"
                  : "PYQs in the selected topic"}
                {yearFilterSummary ? ` · ${yearFilterSummary}` : ""}
              </div>
            </div>
          </div>

          <InfoBox
            title="Practice Engine"
            lines={[
              "Full Subject = all PYQs from the selected subject.",
              "Topic-wise = one syllabus topic.",
              "Subtopic-wise = precision practice on selected micro-themes.",
              "Year Filter narrows to a single year or a date range.",
              "For CSAT, subtopic selection is mandatory unless you choose Full Subject.",
            ]}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FULL-LENGTH MODE
      ═══════════════════════════════════════════════════════════════════ */}
      {testMode === "full_length" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubModeChip active={fullLengthType === "gs_yearwise"}   onClick={() => setFullLengthType("gs_yearwise")}   label="GS Year-wise" />
            <SubModeChip active={fullLengthType === "csat_yearwise"} onClick={() => setFullLengthType("csat_yearwise")} label="CSAT Year-wise" />
          </div>

          <div style={grid2}>
            <Field label="Year">
              <select value={fullLengthYear} onChange={(e) => setFullLengthYear(e.target.value)} style={inputStyle}>
                {fullLengthYears.map((year) => {
                  const paper = fullLengthPaperOptions.find((item) => String(item.year) === String(year));
                  return (
                    <option key={paper?.paperId || year} value={year}>
                      {paper?.questionCount ? `${year} (${paper.questionCount} Q)` : year}
                    </option>
                  );
                })}
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
              "GS: 1995 – 2025 · CSAT: 2011 – 2024.",
              "Good for paper temperament, sequencing, and time-pressure handling.",
            ]}
          />
        </div>
      )}

      {/* Error */}
      {error ? (
        <div style={{
          padding: "10px 12px", borderRadius: 12,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
          color: "#fecaca", fontSize: 13,
        }}>
          {error}
        </div>
      ) : null}

      {/* Start */}
      <button
        onClick={() => { if (typeof onStart === "function") onStart(); }}
        disabled={loading || disableStart}
        style={startBtn(loading || disableStart)}
      >
        {loading ? "Loading Test..." : "Start Test"}
      </button>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function ModeChip({ active, onClick, label }) {
  return <button type="button" onClick={onClick} style={modeChipStyle(active)}>{label}</button>;
}

function SubModeChip({ active, onClick, label }) {
  return <button type="button" onClick={onClick} style={subModeChipStyle(active)}>{label}</button>;
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
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: "3px solid rgba(99,102,241,0.45)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {Array.isArray(lines) && lines.map((line, idx) => (
          <div key={`${title}_${idx}`} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65 }}>
            · {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

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
    display: "flex", gap: 10, alignItems: "center",
    padding: "8px 10px", borderRadius: 10,
    background: active ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.02)",
    border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.04)",
    fontSize: 13, cursor: "pointer",
  };
}

const emptyHintStyle = { fontSize: 12, opacity: 0.75, padding: "8px 4px" };

function modeChipStyle(active) {
  return {
    height: 40, borderRadius: 999, padding: "0 18px",
    border: active ? "1px solid rgba(99,102,241,0.85)" : "1px solid rgba(255,255,255,0.09)",
    background: active ? "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(129,140,248,0.18))" : "rgba(255,255,255,0.04)",
    color: active ? "#c7d2fe" : "rgba(229,231,235,0.65)",
    fontWeight: active ? 800 : 600, fontSize: 14, cursor: "pointer",
    boxShadow: active ? "0 0 14px rgba(99,102,241,0.18)" : "none", letterSpacing: 0.2,
  };
}

function subModeChipStyle(active) {
  return {
    height: 36, borderRadius: 999, padding: "0 14px",
    border: active ? "1px solid rgba(56,189,248,0.7)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "linear-gradient(135deg, rgba(14,165,233,0.22), rgba(56,189,248,0.14))" : "rgba(255,255,255,0.03)",
    color: active ? "#7dd3fc" : "rgba(229,231,235,0.55)",
    fontWeight: active ? 800 : 600, fontSize: 13, cursor: "pointer",
    boxShadow: active ? "0 0 10px rgba(56,189,248,0.12)" : "none",
  };
}

function startBtn(disabled) {
  return {
    height: 52, borderRadius: 14,
    border: disabled ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(99,102,241,0.5)",
    background: disabled ? "rgba(99,102,241,0.18)" : "linear-gradient(135deg, #6366f1, #818cf8)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#ffffff",
    fontWeight: 800, fontSize: 16, letterSpacing: 0.3,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 24px rgba(99,102,241,0.30)",
  };
}
