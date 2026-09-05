import { useEffect, useRef, useState } from "react";

function normKey(k) {
  return String(k || "").trim().toUpperCase();
}

function sanitizeOptionText(text) {
  if (!text) return "";
  return String(text).replace(/[\.\s]*(?:Solution|Answer|Ans)\s*[:\-]?\s*[a-dA-D1-4]\s*\)?\.?\s*$/i, "").trim();
}

function resolveOptions(q) {
  const raw = q?.options || {};
  if (Array.isArray(raw)) {
    const out = {};
    ["A", "B", "C", "D"].forEach((k, idx) => {
      if (raw[idx] != null) out[k] = sanitizeOptionText(String(raw[idx]));
    });
    return out;
  }
  if (typeof raw !== "object") return {};
  const out = {};
  ["A", "B", "C", "D"].forEach((K) => {
    const v = raw[K] ?? raw[K.toLowerCase()];
    if (v != null) out[K] = sanitizeOptionText(String(v));
  });
  return out;
}

function getQid(q) {
  return q?.id || q?.questionId || q?.qid || null;
}

export default function RcPassageBlock({
  passage,
  questions = [],
  passageIndex,
  totalPassages,
  answersMap = {},
  onSelectOption,
  onClearOption,
  confidenceMap = {},
  onSetConfidence,
  onPrevPassage,
  onNextPassage,
  onSubmit,
  submitting = false,
}) {
  const [passageCollapsed, setPassageCollapsed] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [passageIndex]);

  const answeredCount = questions.filter((q) => {
    const qid = getQid(q);
    return qid && answersMap[qid];
  }).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;
  const isLast = passageIndex >= totalPassages - 1;

  return (
    <div ref={topRef} className="mos-rc">
      <section className="mos-practice-card mos-rc-passage">
        <button
          type="button"
          className={`mos-rc-passage__head${passageCollapsed ? " is-collapsed" : ""}`}
          onClick={() => setPassageCollapsed((v) => !v)}
          style={{ width: "100%", background: "transparent", color: "inherit", borderLeft: 0, borderRight: 0, borderTop: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mos-pr-badge mos-pr-badge--primary">Passage {passageIndex + 1}/{totalPassages}</span>
            <span className="mos-pr-badge">{questions.length} Q</span>
            <span className={`mos-pr-badge ${allAnswered ? "mos-pr-badge--success" : "mos-pr-badge--warning"}`}>{answeredCount}/{questions.length} answered</span>
          </div>
          <span className="mos-practice-small mos-practice-muted">{passageCollapsed ? "Show passage" : "Hide passage"}</span>
        </button>

        {!passageCollapsed ? <div className="mos-rc-passage__text">{passage || "Passage text not available."}</div> : null}
      </section>

      {questions.map((q, qi) => {
        const qid = getQid(q) || `q_${passageIndex}_${qi}`;
        const options = resolveOptions(q);
        const optKeys = ["A", "B", "C", "D"].filter((k) => options[k]);
        const selected = normKey(answersMap[qid] || "");
        const confidence = confidenceMap[qid] || "";

        return (
          <section className="mos-practice-card mos-rc-question" key={qid}>
            <div className="mos-rc-question__meta">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mos-rc-question__num">{qi + 1}</span>
                {q.year ? <span className="mos-pr-badge">UPSC {q.year}</span> : null}
                {["sure", "unsure", "guess"].map((level) => (
                  <button
                    type="button"
                    key={level}
                    className={`mos-confidence mos-confidence--${level}${confidence === level ? " is-active" : ""}`}
                    style={{ minHeight: 28, padding: "0 9px", fontSize: 10.5 }}
                    onClick={() => onSetConfidence?.(qid, confidence === level ? "" : level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
              {selected ? <button type="button" className="mos-pr-btn mos-pr-btn--ghost" style={{ minHeight: 30, padding: "0 8px" }} onClick={() => onClearOption?.(qid)}>Clear</button> : null}
            </div>

            <div className="mos-rc-question__body">
              <div className="mos-rc-question__text">{q.question || q.questionText || q.stem || ""}</div>
              {optKeys.length ? (
                <div className="mos-rc-question__options">
                  {optKeys.map((key) => {
                    const isSelected = selected === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`mos-attempt-option${isSelected ? " is-selected" : ""}`}
                        onClick={() => isSelected ? onClearOption?.(qid) : onSelectOption?.(qid, key)}
                      >
                        <span className="mos-attempt-option__key">{key}</span>
                        <span className="mos-attempt-option__text">{options[key]}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      <div className="mos-rc-footer">
        <button type="button" className="mos-pr-btn" disabled={passageIndex === 0} onClick={onPrevPassage}>← Previous Passage</button>
        <div className="mos-rc-dots" aria-label={`Passage ${passageIndex + 1} of ${totalPassages}`}>
          {Array.from({ length: totalPassages }).map((_, i) => <span key={i} className={`mos-rc-dot${i === passageIndex ? " is-active" : ""}`} />)}
        </div>
        {!isLast ? (
          <button type="button" className="mos-pr-btn mos-pr-btn--primary" onClick={onNextPassage}>Next Passage →</button>
        ) : (
          <button type="button" className="mos-pr-btn mos-pr-btn--success" disabled={submitting} onClick={onSubmit}>{submitting ? "Submitting…" : "Review & Submit"}</button>
        )}
      </div>
    </div>
  );
}
