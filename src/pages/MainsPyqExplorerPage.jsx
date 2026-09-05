// src/pages/MainsPyqExplorerPage.jsx
// Dedicated Mains PYQ Theme Explorer — paper → subject → theme → subtheme → PYQs.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";

const PAPERS = [
  { id: "GS1", label: "GS1", title: "General Studies I", accent: "#f59e0b" },
  { id: "GS2", label: "GS2", title: "General Studies II", accent: "#3b82f6" },
  { id: "GS3", label: "GS3", title: "General Studies III", accent: "#22c55e" },
  { id: "GS4", label: "GS4", title: "General Studies IV", accent: "#8b5cf6" },
];

function writingGuide(marks) {
  const m = Number(marks) || 15;
  if (m <= 10) return { words: 150, structure: "Intro + 3 points + conclusion" };
  if (m >= 20) return { words: 250, structure: "Intro + 6 points + conclusion" };
  return { words: 200, structure: "Intro + 4–5 points + conclusion" };
}

function matchQuality(summary, total) {
  if (!summary || !total) return null;
  const exact = summary.mappedNodeExact || 0;
  const fallback = (summary.keywordStrong || 0) + (summary.keywordModerate || 0) + (summary.themeNameFallback || 0);
  if (exact === total) return "Exact";
  if (exact > 0) return "Mixed";
  if (fallback === total) return "Fallback";
  return null;
}

export default function MainsPyqExplorerPage() {
  const navigate = useNavigate();
  const [paper, setPaper] = useState("GS1");
  const [tree, setTree] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubtheme, setSelectedSubtheme] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [questionsError, setQuestionsError] = useState("");

  const activePaper = PAPERS.find((item) => item.id === paper) || PAPERS[0];

  useEffect(() => {
    let alive = true;
    setLoadingTree(true);
    setTreeError("");
    setQuestionsError("");
    setQuestions([]);
    setSelectedSubject(null);
    setSelectedTheme(null);
    setSelectedSubtheme(null);

    fetch(`${BACKEND_URL}/api/mains/themes/${paper}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (!data?.ok) throw new Error(data?.error || "Failed to load Mains themes");
        const nextTree = Array.isArray(data.tree) ? data.tree : [];
        setTree(nextTree);
        const firstSubject = nextTree[0] || null;
        setSelectedSubject(firstSubject?.subject || null);
        const firstTheme = firstSubject?.themes?.[0] || null;
        setSelectedTheme(firstTheme?.name || null);
      })
      .catch((err) => alive && setTreeError(err?.message || "Failed to load Mains themes"))
      .finally(() => alive && setLoadingTree(false));

    return () => { alive = false; };
  }, [paper]);

  const subjectNode = useMemo(
    () => tree.find((item) => item.subject === selectedSubject) || null,
    [tree, selectedSubject]
  );

  const themeNode = useMemo(
    () => subjectNode?.themes?.find((item) => item.name === selectedTheme) || null,
    [subjectNode, selectedTheme]
  );

  const totalPyqs = useMemo(
    () => tree.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    [tree]
  );

  function chooseSubject(subject) {
    setSelectedSubject(subject.subject);
    const firstTheme = subject.themes?.[0] || null;
    setSelectedTheme(firstTheme?.name || null);
    setSelectedSubtheme(null);
    setQuestions([]);
    setQuestionsError("");
  }

  function chooseTheme(theme) {
    setSelectedTheme(theme.name);
    setSelectedSubtheme(null);
    setQuestions([]);
    setQuestionsError("");
  }

  function chooseSubtheme(subtheme) {
    if (!selectedSubject || !selectedTheme || !subtheme?.name) return;
    setSelectedSubtheme(subtheme.name);
    setQuestions([]);
    setQuestionsError("");
    setLoadingQuestions(true);

    const url = `${BACKEND_URL}/api/mains/pyqs/by-subtheme`
      + `?paper=${encodeURIComponent(paper)}`
      + `&subject=${encodeURIComponent(selectedSubject)}`
      + `&theme=${encodeURIComponent(selectedTheme)}`
      + `&subtheme=${encodeURIComponent(subtheme.name)}`;

    fetch(url, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) throw new Error(data?.error || "Failed to load PYQs");
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      })
      .catch((err) => setQuestionsError(err?.message || "Failed to load PYQs"))
      .finally(() => setLoadingQuestions(false));
  }

  function startWriting(question) {
    const marks = String(question?.marks || 15);
    const guide = writingGuide(marks);
    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper: paper === "GS4" ? "GS4 Ethics" : paper,
          mode: "PYQ",
          marks,
          year: question?.year || null,
          structure: guide.structure,
          focus: selectedSubtheme || selectedTheme || selectedSubject || "",
          priority: "UPSC PYQ · Theme Explorer",
          question: question?.question || question?.q || "",
        },
      },
    });
  }

  return (
    <div className="mos-pyq-explorer">
      <style>{PYQ_EXPLORER_CSS}</style>

      <div className="mos-pyq-explorer__inner">
        <header className="mos-pyq-explorer__header">
          <div className="mos-pyq-explorer__title-row">
            <button type="button" className="mos-pyq-back" onClick={() => navigate("/mains")} aria-label="Back to Mains Answer Writing">
              ←
            </button>
            <div>
              <span className="mos-pyq-kicker">Mains · PYQ Intelligence</span>
              <h1>Explore PYQs by Theme</h1>
              <p>Move from paper to subject, theme and subtheme without cluttering your answer-writing dashboard.</p>
            </div>
          </div>

          <div className="mos-pyq-paper-tabs" aria-label="Select paper">
            {PAPERS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={paper === item.id ? "is-active" : ""}
                onClick={() => setPaper(item.id)}
                style={paper === item.id ? { "--paper-accent": item.accent } : undefined}
              >
                <span>{item.label}</span>
                <small>{item.title}</small>
              </button>
            ))}
          </div>
        </header>

        <div className="mos-pyq-summary">
          <div>
            <span>Selected paper</span>
            <strong>{activePaper.title}</strong>
          </div>
          <div>
            <span>Mapped PYQs</span>
            <strong>{loadingTree ? "—" : totalPyqs}</strong>
          </div>
          <div>
            <span>Subjects</span>
            <strong>{loadingTree ? "—" : tree.length}</strong>
          </div>
          <div className="mos-pyq-summary__hint">
            <span>Path</span>
            <strong>{selectedSubject || "Choose subject"}{selectedTheme ? ` → ${selectedTheme}` : ""}{selectedSubtheme ? ` → ${selectedSubtheme}` : ""}</strong>
          </div>
        </div>

        {treeError ? (
          <div className="mos-pyq-state mos-pyq-state--error">{treeError}</div>
        ) : (
          <main className="mos-pyq-workspace">
            <aside className="mos-pyq-panel mos-pyq-subject-panel">
              <div className="mos-pyq-panel__head">
                <div>
                  <span className="mos-pyq-kicker">01 · Subject</span>
                  <h2>Choose an area</h2>
                </div>
              </div>

              {loadingTree ? (
                <div className="mos-pyq-state">Loading subjects…</div>
              ) : (
                <div className="mos-pyq-subject-list">
                  {tree.map((subject) => (
                    <button
                      type="button"
                      key={subject.subject}
                      className={selectedSubject === subject.subject ? "is-active" : ""}
                      onClick={() => chooseSubject(subject)}
                    >
                      <span>{subject.subject}</span>
                      <span className="mos-pyq-count">{subject.count || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="mos-pyq-panel mos-pyq-theme-panel">
              <div className="mos-pyq-panel__head">
                <div>
                  <span className="mos-pyq-kicker">02 · Theme</span>
                  <h2>{selectedSubject || "Select a subject"}</h2>
                </div>
                {subjectNode && <span className="mos-pyq-panel__count">{subjectNode.count || 0} PYQs</span>}
              </div>

              {!subjectNode ? (
                <div className="mos-pyq-state">Choose a subject to continue.</div>
              ) : (
                <div className="mos-pyq-theme-list">
                  {(subjectNode.themes || []).map((theme) => (
                    <div key={theme.name} className={selectedTheme === theme.name ? "mos-pyq-theme is-active" : "mos-pyq-theme"}>
                      <button type="button" className="mos-pyq-theme__button" onClick={() => chooseTheme(theme)}>
                        <span>
                          <strong>{theme.name}</strong>
                          <small>{theme.count || 0} questions</small>
                        </span>
                        <span aria-hidden="true">›</span>
                      </button>

                      {selectedTheme === theme.name && (
                        <div className="mos-pyq-subtheme-list">
                          {(theme.subthemes || []).length > 0 ? (
                            theme.subthemes.map((subtheme) => {
                              const quality = matchQuality(subtheme.matchModeSummary, subtheme.count);
                              return (
                                <button
                                  type="button"
                                  key={subtheme.name}
                                  className={selectedSubtheme === subtheme.name ? "is-active" : ""}
                                  onClick={() => chooseSubtheme(subtheme)}
                                >
                                  <span className="mos-pyq-subtheme-copy">
                                    <strong>{subtheme.name}</strong>
                                    <small>
                                      {subtheme.count || 0} PYQs
                                      {subtheme.lastAskedYear ? ` · Last ${subtheme.lastAskedYear}` : ""}
                                      {subtheme.topDirective ? ` · ${subtheme.topDirective}` : ""}
                                    </small>
                                  </span>
                                  {quality && <span className={`mos-pyq-quality mos-pyq-quality--${quality.toLowerCase()}`}>{quality}</span>}
                                </button>
                              );
                            })
                          ) : (
                            <div className="mos-pyq-state mos-pyq-state--compact">No mapped subthemes in this theme.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mos-pyq-panel mos-pyq-question-panel">
              <div className="mos-pyq-panel__head">
                <div>
                  <span className="mos-pyq-kicker">03 · Questions</span>
                  <h2>{selectedSubtheme || "Select a subtheme"}</h2>
                </div>
                {selectedSubtheme && <span className="mos-pyq-panel__count">{questions.length} loaded</span>}
              </div>

              {!selectedSubtheme ? (
                <div className="mos-pyq-empty-stage">
                  <div className="mos-pyq-empty-stage__icon">⌕</div>
                  <strong>Choose a subtheme</strong>
                  <span>Mapped UPSC questions will appear here with year, marks and a direct writing action.</span>
                </div>
              ) : loadingQuestions ? (
                <div className="mos-pyq-state">Loading PYQs…</div>
              ) : questionsError ? (
                <div className="mos-pyq-state mos-pyq-state--error">{questionsError}</div>
              ) : questions.length === 0 ? (
                <div className="mos-pyq-state">No PYQs found for this subtheme.</div>
              ) : (
                <div className="mos-pyq-question-list">
                  {questions.map((question, index) => (
                    <article className="mos-pyq-question" key={question.id || `${question.year || "q"}-${index}`}>
                      <div className="mos-pyq-question__meta">
                        {question.year && <span>UPSC {question.year}</span>}
                        {question.marks && <span>{question.marks} Marks</span>}
                        {question.wordLimit && <span>{question.wordLimit} words</span>}
                      </div>
                      <p>{question.question || question.q}</p>
                      <div className="mos-pyq-question__actions">
                        <button type="button" className="mos-pyq-start" onClick={() => startWriting(question)}>Start Writing</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

const PYQ_EXPLORER_CSS = `
.mos-pyq-explorer {
  min-height: 100vh;
  padding: 26px 30px 54px;
  background: var(--bg-page, #f8fafc);
  color: var(--text-primary, #0f172a);
}
.mos-pyq-explorer__inner { width: min(1380px, 100%); margin: 0 auto; }
.mos-pyq-explorer__header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: end; }
.mos-pyq-explorer__title-row { display: flex; align-items: flex-start; gap: 14px; }
.mos-pyq-back {
  width: 38px; height: 38px; flex: 0 0 auto; border-radius: 11px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary);
  font: inherit; font-size: 18px; cursor: pointer; transition: .16s ease;
}
.mos-pyq-back:hover { background: var(--bg-subtle); border-color: var(--border-default); }
.mos-pyq-kicker { display: block; color: var(--text-tertiary); font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.mos-pyq-explorer__header h1 { margin: 5px 0 0; font-size: clamp(25px, 2.4vw, 34px); line-height: 1.12; letter-spacing: -.035em; font-weight: 760; }
.mos-pyq-explorer__header p { margin: 8px 0 0; max-width: 720px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.mos-pyq-paper-tabs { display: grid; grid-template-columns: repeat(4, minmax(88px, 1fr)); gap: 8px; }
.mos-pyq-paper-tabs button {
  min-width: 96px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: 13px;
  background: var(--bg-surface); color: var(--text-secondary); font: inherit; text-align: left; cursor: pointer; transition: .16s ease;
}
.mos-pyq-paper-tabs button:hover { border-color: var(--border-default); transform: translateY(-1px); }
.mos-pyq-paper-tabs button span { display: block; font-size: 12px; font-weight: 750; }
.mos-pyq-paper-tabs button small { display: block; margin-top: 2px; color: var(--text-tertiary); font-size: 9px; white-space: nowrap; }
.mos-pyq-paper-tabs button.is-active { border-color: color-mix(in srgb, var(--paper-accent) 48%, var(--border-default)); background: color-mix(in srgb, var(--paper-accent) 7%, var(--bg-surface)); color: var(--paper-accent); }
.mos-pyq-summary {
  display: grid; grid-template-columns: 1.1fr .55fr .45fr 2fr; gap: 1px; overflow: hidden;
  margin-top: 24px; border: 1px solid var(--border-subtle); border-radius: 16px; background: var(--border-subtle);
}
.mos-pyq-summary > div { min-width: 0; padding: 14px 16px; background: var(--bg-surface); }
.mos-pyq-summary span { display: block; color: var(--text-tertiary); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.mos-pyq-summary strong { display: block; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 680; }
.mos-pyq-workspace { display: grid; grid-template-columns: 250px 370px minmax(0, 1fr); gap: 14px; margin-top: 16px; align-items: start; }
.mos-pyq-panel {
  min-width: 0; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 17px;
  box-shadow: 0 1px 2px rgba(16,24,40,.025); overflow: hidden;
}
html[data-theme="dark"] .mos-pyq-panel { box-shadow: none; }
.mos-pyq-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 18px 15px; border-bottom: 1px solid var(--border-subtle); }
.mos-pyq-panel__head h2 { margin: 4px 0 0; font-size: 15px; line-height: 1.3; font-weight: 720; letter-spacing: -.014em; }
.mos-pyq-panel__count { flex: 0 0 auto; color: var(--text-tertiary); font-size: 10px; font-weight: 650; }
.mos-pyq-subject-list { padding: 8px; display: grid; gap: 4px; }
.mos-pyq-subject-list button {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 42px;
  padding: 0 11px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text-secondary);
  font: inherit; font-size: 12px; font-weight: 620; text-align: left; cursor: pointer; transition: .14s ease;
}
.mos-pyq-subject-list button:hover { background: var(--bg-subtle); }
.mos-pyq-subject-list button.is-active { background: var(--brand-primary-soft); border-color: color-mix(in srgb, var(--brand-primary) 24%, var(--border-subtle)); color: var(--brand-primary); }
.mos-pyq-count { min-width: 28px; text-align: right; color: var(--text-tertiary); font-size: 10px; font-variant-numeric: tabular-nums; }
.mos-pyq-theme-list { padding: 8px; display: grid; gap: 6px; }
.mos-pyq-theme { border: 1px solid var(--border-subtle); border-radius: 11px; overflow: hidden; background: var(--bg-surface); }
.mos-pyq-theme.is-active { border-color: color-mix(in srgb, var(--brand-primary) 24%, var(--border-subtle)); }
.mos-pyq-theme__button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 50px; padding: 9px 11px; border: 0; background: transparent; color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; }
.mos-pyq-theme__button:hover { background: var(--bg-subtle); }
.mos-pyq-theme__button > span:first-child { display: grid; gap: 2px; }
.mos-pyq-theme__button strong { font-size: 12px; font-weight: 680; }
.mos-pyq-theme__button small { color: var(--text-tertiary); font-size: 10px; }
.mos-pyq-subtheme-list { border-top: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-subtle) 54%, var(--bg-surface)); padding: 5px; display: grid; gap: 3px; }
.mos-pyq-subtheme-list button { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 46px; padding: 7px 9px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; }
.mos-pyq-subtheme-list button:hover { background: var(--bg-surface); }
.mos-pyq-subtheme-list button.is-active { background: var(--bg-surface); border-color: color-mix(in srgb, var(--brand-primary) 30%, var(--border-subtle)); }
.mos-pyq-subtheme-copy { display: grid; gap: 2px; min-width: 0; }
.mos-pyq-subtheme-copy strong { overflow: hidden; text-overflow: ellipsis; font-size: 11px; font-weight: 650; }
.mos-pyq-subtheme-copy small { color: var(--text-tertiary); font-size: 9.5px; line-height: 1.35; }
.mos-pyq-quality { padding: 2px 6px; border-radius: 999px; font-size: 8.5px; font-weight: 750; text-transform: uppercase; }
.mos-pyq-quality--exact { color: #15803d; background: rgba(34,197,94,.1); }
.mos-pyq-quality--mixed { color: #b45309; background: rgba(245,158,11,.1); }
.mos-pyq-quality--fallback { color: #b91c1c; background: rgba(239,68,68,.08); }
.mos-pyq-question-panel { min-height: 560px; }
.mos-pyq-question-list { padding: 10px; display: grid; gap: 8px; max-height: calc(100vh - 255px); overflow-y: auto; }
.mos-pyq-question { padding: 15px 15px 13px; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-surface); }
.mos-pyq-question:hover { border-color: var(--border-default); }
.mos-pyq-question__meta { display: flex; flex-wrap: wrap; gap: 7px; color: var(--text-tertiary); font-size: 9.5px; font-weight: 650; }
.mos-pyq-question__meta span + span::before { content: "·"; margin-right: 7px; }
.mos-pyq-question p { margin: 8px 0 0; color: var(--text-primary); font-size: 12px; line-height: 1.6; }
.mos-pyq-question__actions { display: flex; justify-content: flex-end; margin-top: 11px; }
.mos-pyq-start { min-height: 31px; padding: 0 11px; border: 0; border-radius: 8px; background: var(--brand-primary); color: white; font: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer; }
.mos-pyq-start:hover { background: var(--brand-primary-hover); }
.mos-pyq-empty-stage { min-height: 470px; display: grid; place-items: center; align-content: center; gap: 7px; padding: 30px; text-align: center; }
.mos-pyq-empty-stage__icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 13px; background: var(--brand-primary-soft); color: var(--brand-primary); font-size: 20px; }
.mos-pyq-empty-stage strong { font-size: 13px; }
.mos-pyq-empty-stage span { max-width: 330px; color: var(--text-tertiary); font-size: 11px; line-height: 1.5; }
.mos-pyq-state { padding: 20px; color: var(--text-tertiary); font-size: 11.5px; }
.mos-pyq-state--compact { padding: 10px; }
.mos-pyq-state--error { color: var(--error, #ef4444); }
.mos-pyq-back:focus-visible, .mos-pyq-paper-tabs button:focus-visible, .mos-pyq-subject-list button:focus-visible, .mos-pyq-theme__button:focus-visible, .mos-pyq-subtheme-list button:focus-visible, .mos-pyq-start:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 2px; }
@media (max-width: 1120px) {
  .mos-pyq-explorer__header { grid-template-columns: 1fr; align-items: start; }
  .mos-pyq-paper-tabs { grid-template-columns: repeat(4, 1fr); }
  .mos-pyq-workspace { grid-template-columns: 220px minmax(0, .9fr) minmax(0, 1.3fr); }
}
@media (max-width: 860px) {
  .mos-pyq-explorer { padding: 20px 16px 42px; }
  .mos-pyq-summary { grid-template-columns: repeat(3, 1fr); }
  .mos-pyq-summary__hint { grid-column: 1 / -1; }
  .mos-pyq-workspace { grid-template-columns: 1fr; }
  .mos-pyq-question-panel { min-height: 380px; }
  .mos-pyq-question-list { max-height: none; overflow: visible; }
  .mos-pyq-empty-stage { min-height: 250px; }
}
@media (max-width: 560px) {
  .mos-pyq-explorer { padding-inline: 12px; }
  .mos-pyq-paper-tabs { display: flex; overflow-x: auto; padding-bottom: 2px; }
  .mos-pyq-paper-tabs button { flex: 0 0 112px; }
  .mos-pyq-summary { grid-template-columns: 1fr 1fr; }
  .mos-pyq-summary__hint { grid-column: 1 / -1; }
  .mos-pyq-explorer__title-row { gap: 10px; }
  .mos-pyq-explorer__header h1 { font-size: 25px; }
}
`;
