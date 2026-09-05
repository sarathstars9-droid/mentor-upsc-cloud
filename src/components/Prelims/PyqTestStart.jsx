import React from "react";

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
  availableYears = { gs: [], csat: [] },
  sectionYearMode = "all",
  setSectionYearMode = () => {},
  sectionYear = "",
  setSectionYear = () => {},
  sectionYearFrom = "",
  setSectionYearFrom = () => {},
  sectionYearTo = "",
  setSectionYearTo = () => {},
  topicsHint = "",
  onStart = () => {},
  loading = false,
  error = null,
  disableStart = false,
}) {
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeMicroThemes = Array.isArray(microThemes) ? microThemes : [];
  const safeSelectedMicroThemeIds = Array.isArray(selectedMicroThemeIds) ? selectedMicroThemeIds : [];

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
  const sectionYearOpts = practicePaper === "CSAT"
    ? (csatYearStrs.length ? csatYearStrs : FALLBACK_CSAT_YEARS)
    : (gsYearStrs.length ? gsYearStrs : FALLBACK_GS_YEARS);

  const requiresSubtopics =
    practiceScope === "subtopic" ||
    (practicePaper === "CSAT" && practiceScope === "topic" && safeMicroThemes.length > 0);

  let yearFilterSummary = "";
  if (testMode === "sectional") {
    if (sectionYearMode === "single" && sectionYear) yearFilterSummary = `Year ${sectionYear}`;
    else if (sectionYearMode === "range") {
      if (sectionYearFrom && sectionYearTo) yearFilterSummary = `${sectionYearFrom}–${sectionYearTo}`;
      else if (sectionYearFrom) yearFilterSummary = `From ${sectionYearFrom}`;
      else if (sectionYearTo) yearFilterSummary = `Up to ${sectionYearTo}`;
    }
  }

  const sourceCopy = practiceScope === "subject"
    ? "matching PYQs in this subject"
    : requiresSubtopics
      ? "matching PYQs in the selected subtopics"
      : "matching PYQs in this topic";

  return (
    <div className="mos-pr-builder">
      <div className="mos-pr-builder__modes">
        <Segment active={testMode === "sectional"} onClick={() => setTestMode("sectional")}>Practice</Segment>
        <Segment active={testMode === "full_length"} onClick={() => setTestMode("full_length")}>Full Length</Segment>
      </div>

      {testMode === "sectional" ? (
        <>
          <div className="mos-pr-builder__modes">
            <Segment active={practicePaper === "GS"} onClick={() => setPracticePaper("GS")}>GS</Segment>
            <Segment active={practicePaper === "CSAT"} onClick={() => setPracticePaper("CSAT")}>CSAT</Segment>
          </div>

          <div className="mos-pr-builder__modes">
            <Segment active={practiceScope === "subject"} onClick={() => setPracticeScope("subject")}>Full Subject</Segment>
            <Segment active={practiceScope === "topic"} onClick={() => setPracticeScope("topic")}>Topic-wise</Segment>
            <Segment active={practiceScope === "subtopic"} onClick={() => setPracticeScope("subtopic")}>Subtopic-wise</Segment>
          </div>

          <div className="mos-pr-builder-grid">
            <Field label="Subject">
              <select className="mos-pr-select" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                <option value="">Select subject</option>
                {safeSubjects.map((s) => <option key={s.id} value={s.id}>{`${s.label} (${s.count ?? 0})`}</option>)}
              </select>
            </Field>
            <Field label="Questions">
              <input
                className="mos-pr-input"
                type="number"
                min={1}
                max={Math.max(availableQuestionCount || 1, 1)}
                value={practiceQuestionCount}
                onChange={(e) => setPracticeQuestionCount(Math.min(Number(e.target.value) || 1, Math.max(availableQuestionCount || 1, 1)))}
              />
            </Field>
          </div>

          {practiceScope !== "subject" ? (
            <Field label="Topic">
              <select className="mos-pr-select" value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
                <option value="">Select topic</option>
                {safeTopics.map((t) => <option key={t.id} value={t.id}>{`${t.name} (${t.count ?? 0})`}</option>)}
              </select>
              {topicsHint ? <div className="mos-pr-field__hint">{topicsHint}</div> : null}
            </Field>
          ) : null}

          {requiresSubtopics ? (
            <Field label={practicePaper === "CSAT" && practiceScope === "topic" ? "Subtopics · required for this CSAT topic" : "Subtopics"}>
              <div className="mos-pr-checks">
                {safeMicroThemes.length ? safeMicroThemes.map((item) => {
                  const checked = safeSelectedMicroThemeIds.includes(item.id);
                  return (
                    <label className="mos-pr-check" key={item.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMicroThemeIds([...safeSelectedMicroThemeIds, item.id]);
                          else setSelectedMicroThemeIds(safeSelectedMicroThemeIds.filter((id) => id !== item.id));
                        }}
                      />
                      <span>{`${item.label} (${item.count ?? 0})`}</span>
                    </label>
                  );
                }) : <div className="mos-pr-field__hint" style={{ padding: 8 }}>No subtopics are available for this topic yet.</div>}
              </div>
            </Field>
          ) : null}

          <div className={`mos-pr-year-box${sectionYearMode !== "all" ? " is-filtered" : ""}`}>
            <div className="mos-pr-year-head">
              <div className="mos-pr-field__label">Year filter</div>
              {yearFilterSummary ? <span className="mos-pr-badge mos-pr-badge--primary">{yearFilterSummary}</span> : null}
            </div>
            <div className="mos-pr-builder__modes">
              {[
                ["all", "All Years"],
                ["single", "Single Year"],
                ["range", "Year Range"],
              ].map(([id, label]) => (
                <Segment key={id} active={sectionYearMode === id} onClick={() => setSectionYearMode(id)}>{label}</Segment>
              ))}
            </div>

            {sectionYearMode === "single" ? (
              <div style={{ marginTop: 11, maxWidth: 280 }}>
                <select className="mos-pr-select" value={sectionYear} onChange={(e) => setSectionYear(e.target.value)}>
                  <option value="">Select year</option>
                  {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : null}

            {sectionYearMode === "range" ? (
              <div className="mos-pr-year-range">
                <Field label="From">
                  <select className="mos-pr-select" value={sectionYearFrom} onChange={(e) => setSectionYearFrom(e.target.value)}>
                    <option value="">Any</option>
                    {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
                <div className="mos-pr-year-arrow">→</div>
                <Field label="To">
                  <select className="mos-pr-select" value={sectionYearTo} onChange={(e) => setSectionYearTo(e.target.value)}>
                    <option value="">Any</option>
                    {sectionYearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
            ) : null}
          </div>

          <div className="mos-pr-availability">
            <div className="mos-pr-availability__num">{availableQuestionCount || 0}</div>
            <div>
              <div className="mos-pr-availability__label">Available questions</div>
              <div className="mos-pr-availability__copy">{sourceCopy}{yearFilterSummary ? ` · ${yearFilterSummary}` : ""} · Source: UPSC PYQs</div>
            </div>
          </div>

          <details className="mos-pr-info-box">
            <summary>How this practice builder works</summary>
            <div className="mos-pr-info-box__body">
              <div>Full Subject draws across the selected subject.</div>
              <div>Topic-wise narrows the pool to one syllabus topic.</div>
              <div>Subtopic-wise targets selected micro-themes.</div>
              <div>Year filters can be applied without changing the practice mode.</div>
              <div>For CSAT, some topic tests require a subtopic selection.</div>
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="mos-pr-builder__modes">
            <Segment active={fullLengthType === "gs_yearwise"} onClick={() => setFullLengthType("gs_yearwise")}>GS Year-wise</Segment>
            <Segment active={fullLengthType === "csat_yearwise"} onClick={() => setFullLengthType("csat_yearwise")}>CSAT Year-wise</Segment>
          </div>
          <div className="mos-pr-builder-grid">
            <Field label="Year">
              <select className="mos-pr-select" value={fullLengthYear} onChange={(e) => setFullLengthYear(e.target.value)}>
                {fullLengthYears.map((year) => {
                  const paper = fullLengthPaperOptions.find((item) => String(item.year) === String(year));
                  return <option key={paper?.paperId || year} value={year}>{paper?.questionCount ? `${year} (${paper.questionCount} Q)` : year}</option>;
                })}
              </select>
            </Field>
            <Field label="Questions">
              <input className="mos-pr-input" value={fullLengthType === "gs_yearwise" ? 100 : 80} disabled />
            </Field>
          </div>
          <details className="mos-pr-info-box">
            <summary>Full-length purpose</summary>
            <div className="mos-pr-info-box__body">
              <div>Simulates a complete UPSC paper year-wise.</div>
              <div>Use this for paper temperament, sequencing and time-pressure practice.</div>
            </div>
          </details>
        </>
      )}

      {error ? <div className="mos-pr-alert mos-pr-alert--danger">{error}</div> : null}

      <button
        type="button"
        className="mos-pr-btn mos-pr-btn--primary mos-pr-btn--large mos-pr-btn--block"
        onClick={() => { if (typeof onStart === "function") onStart(); }}
        disabled={loading || disableStart}
      >
        {loading ? "Preparing test…" : "Start Practice Test"}
      </button>
    </div>
  );
}

function Segment({ active, onClick, children }) {
  return <button type="button" className={`mos-pr-segment${active ? " is-active" : ""}`} onClick={onClick}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <label className="mos-pr-field">
      <span className="mos-pr-field__label">{label}</span>
      {children}
    </label>
  );
}
