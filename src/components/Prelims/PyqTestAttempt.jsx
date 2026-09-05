import { useEffect, useMemo, useRef, useState } from "react";

function sanitizeOption(text) {
  if (!text) return "";
  return String(text).replace(/[\.\s]*(?:Solution|Answer|Ans)\s*[:\-]?\s*[a-dA-D1-4]\s*\)?\.?\s*$/i, "").trim();
}

function normalizeOptions(question) {
  if (!question) return {};
  if (Array.isArray(question.options)) {
    return {
      A: sanitizeOption(question.options[0] ?? ""),
      B: sanitizeOption(question.options[1] ?? ""),
      C: sanitizeOption(question.options[2] ?? ""),
      D: sanitizeOption(question.options[3] ?? ""),
    };
  }
  if (question.options && typeof question.options === "object") {
    return {
      A: sanitizeOption(question.options.A ?? question.options.a ?? ""),
      B: sanitizeOption(question.options.B ?? question.options.b ?? ""),
      C: sanitizeOption(question.options.C ?? question.options.c ?? ""),
      D: sanitizeOption(question.options.D ?? question.options.d ?? ""),
    };
  }
  return {
    A: sanitizeOption(question.optionA ?? question.option_a ?? question.a ?? ""),
    B: sanitizeOption(question.optionB ?? question.option_b ?? question.b ?? ""),
    C: sanitizeOption(question.optionC ?? question.option_c ?? question.c ?? ""),
    D: sanitizeOption(question.optionD ?? question.option_d ?? question.d ?? ""),
  };
}

function getQid(question) {
  return question?.questionId || question?.id || question?.qid || null;
}

function getTestHeading(testMeta) {
  if (!testMeta) return "Practice Test";
  if (testMeta.mode === "full_length") {
    const paper = testMeta.paperType || "PYQ";
    return `${paper} Full-Length ${testMeta.year || ""}`.trim();
  }
  return testMeta.label || "Practice Test";
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PyqTestAttempt({
  testMeta,
  questions = [],
  currentIndex = 0,
  currentQuestion,
  answersMap = {},
  confidenceMap = {},
  onSetConfidence = () => {},
  onSelectOption = () => {},
  onClearOption = () => {},
  onPrev = () => {},
  onNext = () => {},
  onJumpTo = () => {},
  onSubmit = () => {},
  testStartTime = null,
  practiceMode = "",
  questionCount = 0,
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (showSubmitConfirm && confirmRef.current) {
      confirmRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showSubmitConfirm]);

  useEffect(() => {
    if (!testStartTime) return undefined;
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - testStartTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [testStartTime]);

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const current = currentQuestion || safeQuestions[currentIndex] || null;
  const currentQid = getQid(current);
  const total = safeQuestions.length;
  const selectedOption = currentQid ? answersMap[currentQid] || "" : "";
  const selectedConfidence = currentQid ? confidenceMap[currentQid] || "" : "";
  const normalizedOptions = normalizeOptions(current);
  const optionKeys = ["A", "B", "C", "D"].filter((key) => normalizedOptions[key]);

  const answeredCount = useMemo(() => safeQuestions.filter((q) => {
    const qid = getQid(q);
    return qid && answersMap[qid];
  }).length, [safeQuestions, answersMap]);

  const sureCount = Object.values(confidenceMap || {}).filter((c) => c === "sure").length;
  const unsureCount = Object.values(confidenceMap || {}).filter((c) => c === "unsure").length;
  const guessCount = Object.values(confidenceMap || {}).filter((c) => c === "guess").length;
  const unansweredCount = Math.max(0, total - answeredCount);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= total - 1;

  const visibleQuestionText = current?.question || current?.questionText || current?.prompt || current?.stem || "Question text not available.";
  const attemptLabel = practiceMode ? `${String(practiceMode).replaceAll("_", " ")} · ${questionCount || total} Q` : "";

  if (!current) {
    return <div className="mos-practice-card mos-attempt__card mos-practice-muted">Loading question…</div>;
  }

  function navClassFor(q, idx) {
    const qid = getQid(q);
    const picked = qid ? answersMap[qid] : "";
    const conf = qid ? confidenceMap[qid] : "";
    const classes = ["mos-nav-q"];
    if (picked && conf === "sure") classes.push("is-sure");
    else if (picked && conf === "unsure") classes.push("is-unsure");
    else if (picked) classes.push("is-guess");
    if (idx === currentIndex) classes.push("is-active");
    return classes.join(" ");
  }

  return (
    <div className="mos-attempt">
      {isNavigatorOpen ? (
        <div
          className="mos-navigator-overlay"
          onClick={() => { setIsNavigatorOpen(false); setShowSubmitConfirm(false); }}
        />
      ) : null}

      <aside className={`mos-navigator${isNavigatorOpen ? " is-open" : ""}`}>
        <div className="mos-navigator__head">
          <div>
            <div className="mos-navigator__title">{getTestHeading(testMeta)}</div>
            <div className="mos-navigator__copy">Jump to any question or review your completion before submission.</div>
          </div>
          <button type="button" className="mos-pr-btn mos-pr-btn--ghost" onClick={() => setIsNavigatorOpen(false)}>✕</button>
        </div>

        <div className="mos-navigator__stats">
          <NavStat value={answeredCount} label="Answered" />
          <NavStat value={unansweredCount} label="Unanswered" />
          <NavStat value={sureCount} label="Sure" />
          <NavStat value={guessCount} label="Guess" />
        </div>

        <div className="mos-pr-field__label">Question navigator</div>
        <div className="mos-navigator__grid">
          {safeQuestions.map((q, idx) => (
            <button
              key={getQid(q) || idx}
              type="button"
              className={navClassFor(q, idx)}
              onClick={() => { onJumpTo(idx); setIsNavigatorOpen(false); setShowSubmitConfirm(false); }}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mos-pr-btn mos-pr-btn--primary mos-pr-btn--block"
          onClick={() => { setIsNavigatorOpen(false); setShowSubmitConfirm(true); }}
        >
          Review & Submit
        </button>
      </aside>

      <section className="mos-practice-card mos-attempt__card">
        <div className="mos-attempt__toolbar">
          <button type="button" className="mos-pr-btn" onClick={() => setIsNavigatorOpen(true)}>☰ Navigator</button>
          <span className="mos-pr-badge mos-pr-badge--primary">Q {currentIndex + 1} / {total}</span>
          {current?.year ? <span className="mos-pr-badge">UPSC {current.year}</span> : null}
          {current?.paper ? <span className="mos-pr-badge">{current.paper}</span> : null}
          {attemptLabel ? <span className="mos-pr-badge">{attemptLabel}</span> : null}
          <div className="mos-attempt__toolbar-right">
            <span className="mos-pr-badge mos-attempt__timer">⏱ {formatElapsed(elapsedSeconds)}</span>
            <span className={`mos-pr-badge ${answeredCount === total ? "mos-pr-badge--success" : ""}`}>{answeredCount}/{total} answered</span>
          </div>
        </div>

        <div className="mos-attempt__question-label">Question {currentIndex + 1}</div>
        <div className="mos-attempt__question">{visibleQuestionText}</div>

        {optionKeys.length ? (
          <div className="mos-attempt__options">
            {optionKeys.map((key) => {
              const isSelected = selectedOption === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`mos-attempt-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => isSelected ? onClearOption(currentQid) : onSelectOption(currentQid, key)}
                >
                  <span className="mos-attempt-option__key">{key}</span>
                  <span className="mos-attempt-option__text">{normalizedOptions[key]}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mos-attempt__footer">
          <div>
            <div className="mos-pr-field__label" style={{ marginBottom: 8 }}>Confidence</div>
            <div className="mos-attempt__confidence">
              {[
                ["sure", "Sure"],
                ["unsure", "Unsure"],
                ["guess", "Guess"],
              ].map(([level, label]) => (
                <button
                  key={level}
                  type="button"
                  className={`mos-confidence mos-confidence--${level}${selectedConfidence === level ? " is-active" : ""}`}
                  onClick={() => currentQid && onSetConfidence(currentQid, level)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mos-confidence-note" style={{ marginTop: 7 }}>
              {selectedConfidence === "sure" ? "High confidence — verify statement traps before moving on." : null}
              {selectedConfidence === "unsure" ? "Use elimination once more before locking the answer." : null}
              {selectedConfidence === "guess" ? "Risky attempt — MentorOS will track this separately." : null}
              {!selectedConfidence ? "Optional: mark your confidence so MentorOS can distinguish knowledge gaps from risky attempts." : null}
            </div>
          </div>

          <div className="mos-attempt__footer-row">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="mos-pr-btn" onClick={onPrev} disabled={isFirst}>← Previous</button>
              {!isLast ? <button type="button" className="mos-pr-btn mos-pr-btn--primary" onClick={onNext}>Next →</button> : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="mos-pr-btn mos-pr-btn--ghost" style={{ color: "var(--pr-danger)" }} onClick={() => currentQid && onClearOption(currentQid)} disabled={!selectedOption}>Clear</button>
              <button type="button" className="mos-pr-btn mos-pr-btn--primary" onClick={() => setShowSubmitConfirm(true)}>
                {isLast ? "Review & Submit Test" : "Review & Submit"}
              </button>
            </div>
          </div>
        </div>

        {showSubmitConfirm ? (
          <div ref={confirmRef} className="mos-submit-confirm">
            <div className="mos-submit-confirm__title">Ready to submit?</div>
            <div className="mos-submit-confirm__copy">Check unanswered and confidence signals before final submission. You can continue the test without losing anything.</div>
            <div className="mos-submit-confirm__stats">
              <SubmitStat value={answeredCount} label="Answered" />
              <SubmitStat value={unansweredCount} label="Unanswered" />
              <SubmitStat value={sureCount} label="Sure" />
              <SubmitStat value={unsureCount} label="Unsure" />
              <SubmitStat value={guessCount} label="Guess" />
            </div>
            <div className="mos-submit-confirm__actions">
              <button type="button" className="mos-pr-btn" onClick={() => setShowSubmitConfirm(false)}>Continue Test</button>
              <button type="button" className="mos-pr-btn mos-pr-btn--success" onClick={onSubmit}>Final Submit</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NavStat({ value, label }) {
  return <div className="mos-nav-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function SubmitStat({ value, label }) {
  return <div className="mos-submit-confirm__stat"><strong>{value}</strong><span>{label}</span></div>;
}
