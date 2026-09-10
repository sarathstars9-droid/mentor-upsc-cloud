import { useCallback, useEffect, useMemo, useState } from "react";
import { buildMistakeExplanationPrompt } from "../utils/buildMistakeExplanationPrompt";
import { openChatGptForMistake } from "../utils/openChatGptForMistake";
import { BACKEND_URL } from "../config";
import {
  MISTAKE_DIAGNOSIS_OPTIONS,
  getMistakeDiagnosisLabel,
  getMistakeSourceGroup,
  getMistakeSourceLabel,
  getReviewStatusLabel,
  normalizeMistakeDiagnosis,
  normalizeMistakeResult,
  normalizeReviewStatus,
} from "../utils/mistakeBookNormalization";
import "../styles/mentoros-mistake-book.css";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function buildOptionRows(options) {
  if (!options) return [];
  if (Array.isArray(options)) {
    const labels = ["A", "B", "C", "D", "E"];
    return options.map((o, i) => ({ key: labels[i] || String(i + 1), text: String(o) }));
  }
  if (typeof options === "object") {
    return Object.keys(options).sort().map((k) => ({ key: k, text: String(options[k]) }));
  }
  return [];
}

function formatAttemptDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function masteryLabel(value) {
  const status = String(value || "not_started");
  const labels = {
    mastered: "Mastered",
    verify_again: "Verify Again",
    unverified: "Unverified",
    not_started: "Unverified",
  };
  return labels[status] || labels.unverified;
}

function historyResultLabel(status) {
  const result = normalizeMistakeResult(status);
  if (result === "correct") return "Correct";
  if (result === "unattempted") return "Skipped";
  return "Wrong";
}

export function MistakeBookReviewDrawer({ mistake, onClose, onRefresh }) {
  const {
    id,
    questionText,
    options,
    latestUserAnswer,
    userAnswer,
    correctAnswer,
    subject,
    sourceType,
    paperType,
    paper,
    latestResult,
    result,
    notes,
  } = mistake;

  const [chatMsg, setChatMsg] = useState("");
  const [diagnosis, setDiagnosis] = useState(normalizeMistakeDiagnosis(mistake.errorType || mistake.error_type));
  const [reviewStatus, setReviewStatus] = useState(normalizeReviewStatus(mistake.reviewStatus || mistake.review_status));
  const [feedback, setFeedback] = useState("");
  const [savingField, setSavingField] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const [attemptHistory, setAttemptHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retestAnswer, setRetestAnswer] = useState("");

  useEffect(() => {
    setDiagnosis(normalizeMistakeDiagnosis(mistake.errorType || mistake.error_type));
    setReviewStatus(normalizeReviewStatus(mistake.reviewStatus || mistake.review_status));
    setFeedback("");
    setShowOptions(false);
    setShowAllAttempts(false);
    setRetestAnswer("");
  }, [mistake]);

  const displayAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
  const displayResult = normalizeMistakeResult(latestResult || result);
  const isUnattempted = displayResult === "unattempted" || (!displayAnswer && !displayResult);
  const paperDisplay = paperType || paper || "GS";
  const optionRows = useMemo(() => buildOptionRows(options), [options]);
  const sourceGroup = getMistakeSourceGroup(sourceType);

  const fetchAttemptHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mistakes/${id}/attempt-history?userId=${encodeURIComponent(mistake.user_id || "user_1")}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error || `HTTP ${res.status}`);
      setAttemptHistory(data);
    } catch (error) {
      setAttemptHistory({ attempts: [], evidence: { masteryStatus: "not_started", totalAttempts: 0 }, error: error.message });
    } finally {
      setHistoryLoading(false);
    }
  }, [id, mistake.user_id]);

  useEffect(() => {
    fetchAttemptHistory();
  }, [fetchAttemptHistory]);

  const persistPatch = useCallback(async (changes, successMessage) => {
    if (!id) {
      setFeedback("Could not save: missing mistake ID.");
      return null;
    }

    setSavingField(Object.keys(changes)[0] || "saving");
    setFeedback("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error || `HTTP ${res.status}`);
      setFeedback(successMessage);
      onRefresh?.();
      return data.item || null;
    } catch (error) {
      setFeedback(`Save failed: ${error.message}`);
      return null;
    } finally {
      setSavingField("");
    }
  }, [id, onRefresh]);

  const handleDiagnosisChange = useCallback(async (event) => {
    const nextDiagnosis = normalizeMistakeDiagnosis(event.target.value);
    const previousDiagnosis = diagnosis;
    setDiagnosis(nextDiagnosis);
    const updated = await persistPatch({ error_type: nextDiagnosis }, "Diagnosis saved.");
    if (!updated) setDiagnosis(previousDiagnosis);
  }, [diagnosis, persistPatch]);

  const handleMarkReviewed = useCallback(async () => {
    const previousStatus = reviewStatus;
    setReviewStatus("reviewed");
    const updated = await persistPatch({ review_status: "reviewed", reviewed_at: new Date().toISOString() }, "Marked reviewed.");
    if (!updated) setReviewStatus(previousStatus);
  }, [persistPatch, reviewStatus]);

  const handleScheduleRetest = useCallback(async () => {
    const previousStatus = reviewStatus;
    setReviewStatus("retest_due");
    const updated = await persistPatch({ review_status: "retest_due" }, "Retest scheduled.");
    if (!updated) setReviewStatus(previousStatus);
  }, [persistPatch, reviewStatus]);

  const handleSubmitRetest = useCallback(async () => {
    if (!retestAnswer) {
      setFeedback("Choose an answer for the retest.");
      return;
    }

    setSavingField("retest");
    setFeedback("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/mistakes/${id}/retest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedAnswer: retestAnswer, correctAnswer, userId: mistake.user_id || "user_1" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error || `HTTP ${res.status}`);

      setAttemptHistory(data);
      setReviewStatus(normalizeReviewStatus(data?.mistake?.review_status));
      setFeedback(data?.attempt?.answer_status === "correct" ? "Retest correct. Mastery updated." : "Retest saved. Try once more.");
      setRetestAnswer("");
      onRefresh?.();
    } catch (error) {
      setFeedback(`Retest failed: ${error.message}`);
    } finally {
      setSavingField("");
    }
  }, [correctAnswer, id, mistake.user_id, onRefresh, retestAnswer]);

  const handleAskChatGpt = useCallback(async () => {
    const prompt = buildMistakeExplanationPrompt({ ...mistake, errorType: diagnosis });
    const { message } = await openChatGptForMistake(prompt);
    setChatMsg(message);
    setTimeout(() => setChatMsg(""), 5000);
  }, [mistake, diagnosis]);

  const correctConcept = notes?.trim() ? notes.trim() : "Use Ask ChatGPT for a detailed concept explanation.";
  const evidence = attemptHistory?.evidence || {};
  const attempts = Array.isArray(attemptHistory?.attempts) ? attemptHistory.attempts : [];
  const visibleAttempts = showAllAttempts ? attempts : attempts.slice(0, 3);
  const repeatedEvidence = Array.isArray(evidence.repeatedErrorEvidence) ? evidence.repeatedErrorEvidence : [];

  return (
    <div className="mb-drawer">
      <header className="mb-drawer-header">
        <div>
          <p className="mb-eyebrow">Focused Review</p>
          <h2>Question</h2>
        </div>
        <div className="mb-drawer-badges">
          {subject && <span className="mb-badge">{subject}</span>}
          <span className={cx("mb-badge", `source-${sourceGroup}`)}>{getMistakeSourceLabel(sourceType)}</span>
          <span className="mb-badge">{paperDisplay}</span>
          <span className={cx("mb-badge", displayResult === "wrong" ? "is-danger" : displayResult === "unattempted" ? "is-warning" : "is-success")}>{historyResultLabel(displayResult)}</span>
        </div>
      </header>

      <p className="mb-drawer-question">{questionText || "Question content not available"}</p>

      <section className="mb-answer-grid" aria-label="Answer summary">
        <div><span>Your answer</span><strong className={cx(!isUnattempted && "is-wrong")}>{isUnattempted ? "Unattempted" : displayAnswer || "-"}</strong></div>
        <div><span>Correct answer</span><strong className="is-correct">{correctAnswer || "-"}</strong></div>
        <div><span>Review status</span><strong>{getReviewStatusLabel(reviewStatus)}</strong></div>
        <div><span>Mastery</span><strong className={cx(evidence.masteryStatus === "mastered" && "is-success", evidence.masteryStatus === "verify_again" && "is-info")}>{masteryLabel(evidence.masteryStatus)}</strong></div>
      </section>

      <section className="mb-drawer-section compact">
        <label className="mb-diagnosis-select">
          <span>Diagnosis</span>
          <select value={diagnosis} onChange={handleDiagnosisChange} disabled={savingField === "error_type"}>
            {MISTAKE_DIAGNOSIS_OPTIONS.map((option) => <option key={option} value={option}>{getMistakeDiagnosisLabel(option)}</option>)}
          </select>
        </label>
      </section>

      <section className="mb-drawer-section">
        <div className="mb-section-head"><h3>Fix this mistake</h3></div>
        <div className="mb-fix-grid">
          <article><span>1</span><h4>Correct concept</h4><p>{correctConcept}</p></article>
          <article><span>2</span><h4>Trap to remember</h4><p>Not recorded yet.</p></article>
          <article><span>3</span><h4>Memory rule</h4><p>Not recorded yet.</p></article>
        </div>
      </section>

      {optionRows.length > 0 && (
        <section className="mb-drawer-section">
          <div className="mb-section-head">
            <h3>Options</h3>
            <button type="button" onClick={() => setShowOptions((value) => !value)}>{showOptions ? "Hide" : "Show"}</button>
          </div>
          {showOptions && (
            <div className="mb-option-list">
              {optionRows.map(({ key, text }) => {
                const normalizedKey = key.toUpperCase();
                const isCorrect = normalizedKey === String(correctAnswer || "").trim().toUpperCase();
                const isUserWrong = !isUnattempted && normalizedKey === String(displayAnswer || "").trim().toUpperCase() && !isCorrect;
                return (
                  <div key={key} className={cx("mb-option-row", isCorrect && "is-correct", isUserWrong && "is-wrong")}>
                    <strong>{key}.</strong>
                    <span>{text}</span>
                    {isCorrect && <em>Correct</em>}
                    {isUserWrong && <em>Your answer</em>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mb-drawer-section">
        <div className="mb-section-head"><h3>Attempt History</h3></div>
        <div className="mb-attempt-summary">
          <div><strong>{historyLoading ? "-" : evidence.totalAttempts || 0}</strong><span>Attempts</span></div>
          <div><strong>{historyLoading ? "-" : evidence.repeatedWrongCount || 0}</strong><span>Failures</span></div>
          <div><strong>{historyLoading ? "-" : evidence.retestCount || 0}</strong><span>Retests</span></div>
        </div>

        {attemptHistory?.error && <p className="mb-error-text">{attemptHistory.error}</p>}

        {!historyLoading && repeatedEvidence.length > 0 && (
          <div className="mb-repeat-evidence">
            {repeatedEvidence.slice(0, 2).map((row) => (
              <div key={row.id || `${row.attemptId}-${row.attemptedAt}`}>
                <strong>Repeated wrong</strong>
                <span>You: {row.selectedAnswer || "-"} / Correct: {row.correctAnswer || "-"}</span>
                <em>{formatAttemptDate(row.attemptedAt)}</em>
              </div>
            ))}
          </div>
        )}

        {!historyLoading && visibleAttempts.length > 0 && (
          <div className="mb-history-list">
            {visibleAttempts.map((row) => {
              const resultKind = normalizeMistakeResult(row.answer_status);
              return (
                <div key={row.id} className="mb-history-row">
                  <strong className={cx(resultKind === "correct" && "is-success", resultKind === "wrong" && "is-danger", resultKind === "unattempted" && "is-warning")}>{historyResultLabel(row.answer_status)}</strong>
                  <span>You: {row.selected_answer || "-"}</span>
                  <span>{row.source_type}{row.is_retest ? " / Retest" : ""}</span>
                  <time>{formatAttemptDate(row.attempted_at)}</time>
                </div>
              );
            })}
            {attempts.length > 3 && (
              <button type="button" className="mb-link-button" onClick={() => setShowAllAttempts((value) => !value)}>
                {showAllAttempts ? "Show latest 3" : `View all ${attempts.length}`}
              </button>
            )}
          </div>
        )}

        {!historyLoading && attempts.length === 0 && !attemptHistory?.error && <p className="mb-muted-text">No attempt history has been recorded for this question yet.</p>}
      </section>

      <section className="mb-drawer-section mb-retest-box">
        <div className="mb-section-head"><h3>Retest</h3></div>
        <div className="mb-retest-options" role="radiogroup" aria-label="Retest answer">
          {["A", "B", "C", "D", "E"].map((key) => (
            <button key={key} type="button" className={cx(retestAnswer === key && "is-selected")} onClick={() => setRetestAnswer(key)} aria-pressed={retestAnswer === key}>{key}</button>
          ))}
          <button type="button" className="mb-primary-action" disabled={savingField === "retest"} onClick={handleSubmitRetest}>Retest Now</button>
        </div>
      </section>

      <footer className="mb-drawer-footer">
        <button type="button" className="mb-primary-action" disabled={reviewStatus !== "new" || savingField === "review_status"} onClick={handleMarkReviewed}>{reviewStatus === "new" ? "Mark Reviewed" : "Reviewed"}</button>
        <button type="button" className="mb-ghost-action" disabled={reviewStatus !== "reviewed" || savingField === "review_status"} onClick={handleScheduleRetest}>{reviewStatus === "retest_due" ? "Retest Due" : "Schedule Retest"}</button>
        <button type="button" className="mb-ghost-action" onClick={handleAskChatGpt}>Ask ChatGPT</button>
        <button type="button" className="mb-ghost-action" onClick={onClose}>Collapse</button>
        {(feedback || chatMsg) && <span className={cx("mb-inline-note", feedback.startsWith("Save failed") && "is-danger")}>{feedback || chatMsg}</span>}
      </footer>
    </div>
  );
}
