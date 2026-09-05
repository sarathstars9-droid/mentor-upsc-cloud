function groupCounts(items, keyName, mode) {
  const map = new Map();
  for (const item of items || []) {
    const key = item?.[keyName];
    if (!key) continue;
    if (!map.has(key)) map.set(key, { label: key, correct: 0, wrong: 0, unattempted: 0, painScore: 0 });
    const row = map.get(key);
    if (Object.prototype.hasOwnProperty.call(row, item.status)) row[item.status] += 1;
    row.painScore = row.wrong * 2 + row.unattempted;
  }
  const arr = Array.from(map.values());
  if (mode === "weak") return arr.filter((x) => x.wrong > 0 || x.unattempted > 0).sort((a, b) => b.painScore - a.painScore).slice(0, 5);
  return arr.filter((x) => x.correct > 0).sort((a, b) => b.correct - a.correct).slice(0, 5);
}

function prettifyLabel(label) {
  if (!label) return "";
  let clean = label.replace(/^practice_gs_subject_/i, "")
                   .replace(/^practice_gs_topic_/i, "")
                   .replace(/^practice_gs_subtopic_/i, "")
                   .replace(/_na$/i, "");
  return clean.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function prettifyNodeId(id) {
  if (!id) return "";
  let s = id.replace(/^(GS\d+|CSAT)-[A-Z]+-[A-Z]+-/i, "");
  return s.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.toLowerCase().slice(1)).join(" ");
}

function getResultHeading(result) {
  if (result?.mode === "full_length") {
    const paper = result?.paperType || "PYQ";
    const variant = result?.variant === "mixed" ? "Mixed" : result?.year || "Year-wise";
    return `${paper} Full-Length ${variant}`.trim();
  }
  return prettifyLabel(result?.label) || `Practice Test #${result?.testNumber || ""}`.trim();
}

function buildVerdict(summary = {}, submission = null, questionCount = 0) {
  const accuracy = Number(summary.accuracy ?? submission?.summary?.accuracy ?? 0);
  const risky = Number(summary.riskyAttempts || 0);
  const wrong = Number(summary.wrong || 0);
  const skipped = Number(summary.unattempted || 0);

  if (questionCount > 0 && questionCount < 10) {
    if (wrong === 0 && skipped === 0) return "Baseline building. Clean performance on this set. Complete a larger set (10+ questions) to generate behavioural diagnostics.";
    return "Not enough evidence yet to identify a recurring performance pattern. Review the missed concepts from this attempt and continue practicing.";
  }

  if (accuracy >= 80 && risky <= 1) return "Strong conversion. Keep the same control and move to a harder or broader set next.";
  if (accuracy >= 65) return "Good base, but the score is still leaking through a few wrong or uncertain attempts. Fix those before increasing volume.";
  if (risky > Math.max(2, Number(summary.safeAttempts || 0))) return "The main issue is attempt quality, not just knowledge. Reduce low-confidence attempts and use elimination more deliberately.";
  if (wrong > skipped) return "Knowledge is converting inconsistently. Review the wrong-answer clusters first, then reattempt a short targeted set.";
  return "Coverage is incomplete. Close the largest weak area first, then reattempt before moving to a new subject.";
}

export default function PyqTestResult({ result, submission = null, onRestart, onReattempt, onReviewMistakes }) {
  if (!result) {
    return <div className="mos-pr-alert mos-pr-alert--danger">Result not found. Please submit the test again.</div>;
  }

  const summary = result.summary || {};
  const questions = result.questions || [];
  const prescription = result.prescription || {};
  const grouped = result.grouped || {};
  const weakNodes = grouped?.weakNodes?.length ? grouped.weakNodes : groupCounts(questions, "syllabusNodeId", "weak");
  const weakThemes = grouped?.weakThemes?.length ? grouped.weakThemes : groupCounts(questions, "microThemeLabel", "weak");
  const strongNodes = grouped?.strongNodes?.length ? grouped.strongNodes : groupCounts(questions, "syllabusNodeId", "strong");
  const weakQuestionTypes = grouped?.weakQuestionTypes || groupCounts(questions, "questionType", "weak");

  const questionCount = questions.length;
  const isSmallAttempt = questionCount < 10;
  const hasMistakes = (summary.wrong || 0) > 0 || (summary.unattempted || 0) > 0;

  const riskLabel = isSmallAttempt
    ? "Insufficient data"
    : summary.riskTendency === "high" ? "High risk" : summary.riskTendency === "medium" ? "Medium risk" : "Low risk";

  const attemptLabel = isSmallAttempt
    ? "Baseline attempt"
    : summary.attemptQuality === "over-risky" ? "Over-risky" : summary.attemptQuality === "over-cautious" ? "Over-cautious" : summary.attemptQuality === "controlled" ? "Controlled" : "Balanced";

  const accuracy = Number(summary.accuracy ?? submission?.summary?.accuracy ?? 0);
  const finalScore = submission?.summary?.finalScore ?? summary.score ?? 0;
  const scoreTotal = submission?.summary?.total ?? summary.total ?? 0;

  // Learner-facing system actions mapping
  const wrongCount = summary.wrong ?? 0;
  const unattemptedCount = summary.unattempted ?? 0;
  const totalMistakes = wrongCount + unattemptedCount;

  // Get first missed topic / theme name if present for learner-facing resourcing msg
  const sampleTheme = weakThemes[0]?.label || weakNodes[0]?.label || null;
  const prettySampleTheme = sampleTheme ? prettifyNodeId(sampleTheme) : null;

  return (
    <div className="mos-result">
      <section className="mos-practice-card mos-result-hero">
        <div className="mos-result-hero__head">
          <div>
            <div className="mos-practice-eyebrow">Mentor verdict</div>
            <div className="mos-result-hero__title">{getResultHeading(result)}</div>
            <div className="mos-result-hero__label">
              {result?.mode === "full_length" ? "Full Length" : result?.practiceScope ? `${result.practiceScope.charAt(0).toUpperCase() + result.practiceScope.slice(1)} Practice` : "Practice"} • {questionCount} PYQ{questionCount !== 1 ? 's' : ''} • Attempt #{result?.reattemptNumber || 1}
            </div>
          </div>
          <div className="mos-result-score">
            <strong>{submission?.summary?.upscScore != null ? Number(submission.summary.upscScore).toFixed(2) : finalScore + "/" + scoreTotal}</strong>
            <span>{submission?.summary?.upscScore != null ? "UPSC SCORE" : "CORRECT"}</span>
          </div>
        </div>

        <div className="mos-result-verdict">{buildVerdict(summary, submission, questionCount)}</div>

        <div className="mos-result-badges">
          <span className={`mos-pr-badge ${accuracy >= 75 ? "mos-pr-badge--success" : accuracy >= 50 ? "mos-pr-badge--warning" : "mos-pr-badge--danger"}`}>Accuracy {accuracy}%</span>
          <span className="mos-pr-badge">{attemptLabel}</span>
          <span className={`mos-pr-badge ${isSmallAttempt ? "mos-pr-badge--primary" : summary.riskTendency === "high" ? "mos-pr-badge--danger" : summary.riskTendency === "medium" ? "mos-pr-badge--warning" : "mos-pr-badge--success"}`}>{riskLabel}</span>
          <span className="mos-pr-badge mos-pr-badge--primary">Elimination {summary.eliminationSuccessRate ?? 0}%</span>
          {submission?.summary?.negativeMarks != null ? <span className="mos-pr-badge mos-pr-badge--danger">−{submission.summary.negativeMarks} negative marks</span> : null}
        </div>

        <div className="mos-result-stats">
          <ResultStat label="Accuracy" value={`${accuracy}%`} tone="primary" />
          <ResultStat label="Correct" value={summary.correct ?? 0} tone="success" />
          <ResultStat label="Wrong" value={summary.wrong ?? 0} tone="danger" />
          <ResultStat label="Skipped" value={summary.unattempted ?? 0} />
          <ResultStat label="Safe" value={summary.safeAttempts ?? 0} tone="success" />
          <ResultStat label="Risky" value={summary.riskyAttempts ?? 0} tone="warning" />
        </div>
      </section>

      <div className="mos-result-layout">
        <div style={{ display: "grid", gap: 14 }}>
          <section className="mos-practice-card mos-result-section">
            <div className="mos-result-section__title">What MentorOS learned</div>
            <div className="mos-result-mini-grid">
              <Mini label="Guess rate" value={`${summary.guessRate ?? 0}%`} />
              <Mini label="Safe accuracy" value={`${summary.safeAccuracy ?? 0}%`} />
              <Mini label="Risky accuracy" value={`${summary.riskyAccuracy ?? 0}%`} />
              <Mini label="Changed answers" value={summary.changedAnswers ?? 0} />
            </div>
            <div className="mos-result-verdict" style={{ marginTop: 10 }}>
              {isSmallAttempt
                ? "Not enough evidence yet to identify a recurring performance pattern."
                : summary.topTrapType
                ? `Top trap: ${String(summary.topTrapType).replaceAll("_", " ")}. Review the questions where this pattern appeared before the next test.`
                : "No dominant trap is strong enough yet. More attempts will make the pattern signal more reliable."}
            </div>
          </section>

          <details className="mos-practice-card mos-pr-details" open>
            <summary className="mos-pr-details__summary">
              <span>{isSmallAttempt ? "What to review from this attempt" : "Weak areas to fix"}</span>
              <span className="mos-practice-muted">⌄</span>
            </summary>
            <div className="mos-pr-details__body" style={{ paddingTop: 12 }}>
              <div className="mos-breakdown-grid">
                <Insight title="Weak nodes" items={weakNodes} empty="No weak nodes detected." render={(item) => `${prettifyNodeId(item.label)} · ${item.wrong} wrong · ${item.unattempted} skipped`} />
                <Insight title="Weak themes" items={weakThemes} empty="No weak themes detected." render={(item) => `${prettifyNodeId(item.label)} · ${item.wrong} wrong · ${item.unattempted} skipped`} />
                {!isSmallAttempt && (
                  <>
                    <Insight title="Question-type weakness" items={weakQuestionTypes} empty="No question-type weakness detected." render={(item) => `${prettifyNodeId(item.label)} · ${item.wrong} wrong · ${item.unattempted} skipped`} />
                    <Insight title="Strong zones" items={strongNodes} empty="Strong zones will appear after more correct attempts." render={(item) => `${prettifyNodeId(item.label)} · ${item.correct} correct`} />
                  </>
                )}
              </div>
            </div>
          </details>

          {!isSmallAttempt && (
            <details className="mos-practice-card mos-pr-details">
              <summary className="mos-pr-details__summary"><span>Detailed behaviour & trap diagnostics</span><span className="mos-practice-muted">⌄</span></summary>
              <div className="mos-pr-details__body" style={{ paddingTop: 12 }}>
                <div className="mos-result-mini-grid">
                  <Mini label="Cautious attempts" value={summary.cautiousAttempts ?? 0} />
                  <Mini label="Overconfidence" value={summary.overconfidenceTrapCount ?? 0} />
                  <Mini label="Blind guess" value={summary.blindGuessTrapCount ?? 0} />
                  <Mini label="Elimination failure" value={summary.eliminationFailureCount ?? 0} />
                  <Mini label="Answer switch" value={summary.answerSwitchTrapCount ?? 0} />
                  <Mini label="Knowledge gap" value={summary.knowledgeGapCount ?? 0} />
                  <Mini label="Extreme words" value={summary.extremeWordTrapCount ?? 0} />
                  <Mini label="Partial truth" value={summary.partialTruthTrapCount ?? 0} />
                </div>
              </div>
            </details>
          )}
        </div>

        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <section className="mos-practice-card mos-result-section">
            <div className="mos-result-section__title">Next best actions</div>
            <div className="mos-result-actions">
              {isSmallAttempt ? (
                <>
                  <Action label="Review" items={["Review the missed concept.", "Understand why the selected option was wrong."]} />
                  <Action label="Revise" items={["Revise the relevant micro-theme."]} />
                  <Action label="Practice" items={["Attempt another 5–10 PYQs after review."]} />
                </>
              ) : (
                <>
                  <Action label="Priority" items={[prescription?.priority || "Review the largest weak area before starting a new subject."]} />
                  <Action label="Review" items={prescription?.revise?.length ? prescription.revise : ["Review the wrong-answer clusters from this test."]} />
                  <Action label="Practice" items={prescription?.practice?.length ? prescription.practice : ["Reattempt a 10-question targeted set after revision."]} />
                  <Action label="Avoid" items={prescription?.avoid?.length ? prescription.avoid : ["Avoid increasing volume until accuracy stabilizes."]} />
                </>
              )}
            </div>
          </section>

          <section className="mos-practice-card mos-result-section">
            <div className="mos-result-section__title">System actions</div>
            <div className="mos-list-panel__list">
              <div className="mos-list-row">
                {totalMistakes > 0
                  ? `${totalMistakes} mistake${totalMistakes > 1 ? 's' : ''} added to revision follow-up`
                  : "No mistakes from this set — 0 items added to revision follow-up"}
              </div>
              <div className="mos-list-row">
                {prettySampleTheme
                  ? `${prettySampleTheme} concepts will be resurfaced after review`
                  : "Topic concepts will be resurfaced after review"}
              </div>
              <div className="mos-list-row">Confidence data saved for future pattern analysis</div>
            </div>
          </section>
        </aside>
      </div>

      <div className="mos-result-actions-bar">
        {hasMistakes ? (
          <>
            <button
              type="button"
              className="mos-pr-btn mos-pr-btn--primary mos-pr-btn--large"
              onClick={onReviewMistakes || onReattempt || onRestart}
            >
              {wrongCount > 0 ? "Review Mistakes" : "Review Missed Questions"}
            </button>
            <button type="button" className="mos-pr-btn mos-pr-btn--large" onClick={onRestart}>
              Start New Test
            </button>
            <button type="button" className="mos-pr-btn mos-pr-btn--large" onClick={() => onReattempt?.(result)}>
              Reattempt Same Paper
            </button>
          </>
        ) : (
          <>
            <button type="button" className="mos-pr-btn mos-pr-btn--primary mos-pr-btn--large" onClick={onRestart}>
              Start New Test
            </button>
            <button type="button" className="mos-pr-btn mos-pr-btn--large" onClick={() => onReattempt?.(result)}>
              Reattempt Same Paper
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value, tone = "" }) {
  return (
    <div className={`mos-metric-card${tone ? ` mos-metric-card--${tone}` : ""}`}>
      <div className="mos-metric-card__label">{label}</div>
      <div className="mos-metric-card__value">{value}</div>
    </div>
  );
}

function Mini({ label, value }) {
  return <div className="mos-result-mini"><span>{label}</span><strong>{value}</strong></div>;
}

function Insight({ title, items, empty, render }) {
  return (
    <div className="mos-list-panel" style={{ padding: 0 }}>
      <div className="mos-pr-field__label" style={{ marginBottom: 7 }}>{title}</div>
      <div className="mos-list-panel__list">
        {items?.length ? items.slice(0, 5).map((item, idx) => <div className="mos-list-row" key={`${item.label || idx}_${idx}`}>{render(item)}</div>) : <div className="mos-list-row">{empty}</div>}
      </div>
    </div>
  );
}

function Action({ label, items }) {
  return (
    <div className="mos-result-action">
      <div className="mos-result-action__label">{label}</div>
      <div className="mos-result-action__body">
        {(items || []).map((item, idx) => <div key={`${label}_${idx}`}>{idx > 0 ? "• " : ""}{item}</div>)}
      </div>
    </div>
  );
}
