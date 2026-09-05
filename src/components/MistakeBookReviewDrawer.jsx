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

const C = {
  surface: "#16161e",
  border: "#2a2a38",
  orange: "#f5a623",
  text: "#e8e8f0",
  textMuted: "#6b6b80",
  textDim: "#9898a8",
  red: "#e05252",
  green: "#4caf7d",
  blue: "#60a5fa",
  fontMono: "'Courier New', Courier, monospace",

  sourcePyq: "#38bdf8",
  sourcePyqBg: "rgba(56,189,248,0.1)",
  sourceInstitutional: "#a78bfa",
  sourceInstBg: "rgba(167,139,250,0.1)",
};

const s = {
  drawer: {
    padding: "18px",
    backgroundColor: "#121218",
    borderTop: `1px solid ${C.border}`,
    borderRadius: "0 0 8px 8px",
  },
  header: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  badge: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "3px 9px",
    borderRadius: "5px",
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  question: {
    fontSize: "14px",
    lineHeight: "1.65",
    color: C.text,
    margin: "0 0 12px",
  },
  answerLine: {
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
    paddingBottom: "14px",
    borderBottom: `1px solid ${C.border}`,
    marginBottom: "16px",
  },
  answerItem: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    fontSize: "13px",
  },
  label: {
    color: C.textMuted,
    fontWeight: 700,
  },
  monoValue: {
    fontFamily: C.fontMono,
    fontWeight: 800,
  },
  section: {
    marginBottom: "18px",
  },
  sectionTitle: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: C.orange,
    marginBottom: "10px",
  },
  diagnosisGrid: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  diagnosisButton: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid",
    cursor: "pointer",
  },
  fixGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
  },
  fixBox: {
    background: "#0f0f15",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "10px 12px",
  },
  fixTitle: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: C.textDim,
    marginBottom: "6px",
  },
  fixText: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: C.text,
    margin: 0,
  },
  optionsToggle: {
    border: "none",
    background: "transparent",
    color: C.orange,
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: 0,
    cursor: "pointer",
  },
  optionList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "10px",
  },
  optionRow: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid",
  },
  optionKey: {
    fontFamily: C.fontMono,
    fontSize: "12px",
    fontWeight: "800",
    minWidth: "20px",
  },
  optionText: {
    fontSize: "13px",
    lineHeight: "1.5",
    flex: 1,
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    paddingTop: "14px",
    borderTop: `1px solid ${C.border}`,
  },
  button: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "7px 14px",
    borderRadius: "6px",
    border: "1px solid",
    cursor: "pointer",
  },
  feedback: {
    fontSize: "11px",
    fontFamily: C.fontMono,
    color: C.textDim,
    marginLeft: "auto",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: "8px",
    marginBottom: "10px",
  },
  summaryBox: {
    background: "#0f0f15",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "9px 10px",
  },
  summaryValue: {
    fontFamily: C.fontMono,
    fontSize: "17px",
    fontWeight: "900",
    lineHeight: 1,
    color: C.text,
  },
  summaryLabel: {
    fontFamily: C.fontMono,
    fontSize: "9px",
    fontWeight: "800",
    color: C.textMuted,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginTop: "5px",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  historyRow: {
    display: "grid",
    gridTemplateColumns: "90px 80px 1fr 120px",
    gap: "8px",
    alignItems: "center",
    background: "#0f0f15",
    border: `1px solid ${C.border}`,
    borderRadius: "7px",
    padding: "8px 10px",
    fontSize: "11px",
    color: C.textDim,
  },
  retestOptions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "10px",
  },
  retestOption: {
    width: "34px",
    height: "34px",
    borderRadius: "7px",
    border: "1px solid",
    fontFamily: C.fontMono,
    fontWeight: "900",
    cursor: "pointer",
  },
};

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

function resultStyles(result) {
  if (result === "unattempted") {
    return {
      color: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.1)",
      borderColor: "rgba(245,158,11,0.3)",
      label: "Unattempted",
    };
  }
  if (result === "wrong") {
    return {
      color: C.red,
      backgroundColor: "rgba(224,82,82,0.1)",
      borderColor: "rgba(224,82,82,0.3)",
      label: "Wrong",
    };
  }
  return {
    color: C.green,
    backgroundColor: "rgba(76,175,125,0.1)",
    borderColor: "rgba(76,175,125,0.3)",
    label: "Correct",
  };
}

function lifecycleStyles(status) {
  if (status === "retest_due") {
    return {
      color: C.blue,
      backgroundColor: "rgba(96,165,250,0.1)",
      borderColor: "rgba(96,165,250,0.3)",
    };
  }
  if (status === "reviewed") {
    return {
      color: C.green,
      backgroundColor: "rgba(76,175,125,0.1)",
      borderColor: "rgba(76,175,125,0.3)",
    };
  }
  return {
    color: C.textDim,
    backgroundColor: "rgba(152,152,168,0.08)",
    borderColor: "rgba(152,152,168,0.2)",
  };
}

function sourceStyles(sourceType) {
  const group = getMistakeSourceGroup(sourceType);
  if (group === "institutional") {
    return { color: C.sourceInstitutional, backgroundColor: C.sourceInstBg };
  }
  if (group === "pyq") {
    return { color: C.sourcePyq, backgroundColor: C.sourcePyqBg };
  }
  return { color: C.textDim, backgroundColor: "rgba(152,152,168,0.1)" };
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
  const [attemptHistory, setAttemptHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retestAnswer, setRetestAnswer] = useState("");

  useEffect(() => {
    setDiagnosis(normalizeMistakeDiagnosis(mistake.errorType || mistake.error_type));
    setReviewStatus(normalizeReviewStatus(mistake.reviewStatus || mistake.review_status));
    setFeedback("");
    setShowOptions(false);
    setRetestAnswer("");
  }, [mistake]);

  const displayAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
  const displayResult = normalizeMistakeResult(latestResult || result);
  const isUnattempted = displayResult === "unattempted" || (!displayAnswer && !displayResult);
  const paperDisplay = paperType || paper || "GS";
  const optionRows = useMemo(() => buildOptionRows(options), [options]);
  const sourceStyle = sourceStyles(sourceType);
  const resultStyle = resultStyles(displayResult);
  const lifecycleStyle = lifecycleStyles(reviewStatus);

  const fetchAttemptHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mistakes/${id}/attempt-history?userId=${encodeURIComponent(mistake.user_id || "user_1")}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setAttemptHistory(data);
    } catch (error) {
      setAttemptHistory({
        attempts: [],
        evidence: { masteryStatus: "not_started", totalAttempts: 0 },
        error: error.message,
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

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
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
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

  const handleDiagnosisChange = useCallback(async (nextValue) => {
    const nextDiagnosis = normalizeMistakeDiagnosis(nextValue);
    const previousDiagnosis = diagnosis;
    setDiagnosis(nextDiagnosis);
    const updated = await persistPatch({ error_type: nextDiagnosis }, "Diagnosis saved.");
    if (!updated) setDiagnosis(previousDiagnosis);
  }, [diagnosis, persistPatch]);

  const handleMarkReviewed = useCallback(async () => {
    const previousStatus = reviewStatus;
    setReviewStatus("reviewed");
    const updated = await persistPatch(
      { review_status: "reviewed", reviewed_at: new Date().toISOString() },
      "Marked reviewed."
    );
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
        body: JSON.stringify({
          selectedAnswer: retestAnswer,
          correctAnswer,
          userId: mistake.user_id || "user_1",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

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

  const correctConcept = notes?.trim()
    ? notes.trim()
    : "Use Ask ChatGPT for a detailed concept explanation.";
  const evidence = attemptHistory?.evidence || {};
  const attempts = Array.isArray(attemptHistory?.attempts) ? attemptHistory.attempts : [];
  const repeatedEvidence = Array.isArray(evidence.repeatedErrorEvidence)
    ? evidence.repeatedErrorEvidence
    : [];

  return (
    <div style={s.drawer}>
      <div style={s.header}>
        {subject && (
          <span style={{ ...s.badge, color: C.textDim, backgroundColor: "transparent", borderColor: C.border }}>
            {subject}
          </span>
        )}
        <span style={{ ...s.badge, color: sourceStyle.color, backgroundColor: sourceStyle.backgroundColor, borderColor: sourceStyle.color + "55" }}>
          {getMistakeSourceLabel(sourceType)}
        </span>
        <span style={{ ...s.badge, color: paperDisplay === "CSAT" ? C.blue : "#fbbf24", backgroundColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)", borderColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.3)" : "rgba(251,191,36,0.3)" }}>
          {paperDisplay}
        </span>
        <span style={{ ...s.badge, marginLeft: "auto", color: resultStyle.color, backgroundColor: resultStyle.backgroundColor, borderColor: resultStyle.borderColor }}>
          {resultStyle.label}
        </span>
      </div>

      <p style={s.question}>{questionText || "Question content not available"}</p>

      <div style={s.answerLine}>
        <div style={s.answerItem}>
          <span style={s.label}>Your answer:</span>
          <span style={{ ...s.monoValue, color: isUnattempted ? C.textMuted : C.red }}>
            {isUnattempted ? "Unattempted" : (displayAnswer || "-")}
          </span>
        </div>
        <div style={s.answerItem}>
          <span style={s.label}>Correct answer:</span>
          <span style={{ ...s.monoValue, color: C.green }}>{correctAnswer || "-"}</span>
        </div>
      </div>

      {optionRows.length > 0 && (
        <div style={s.section}>
          <button type="button" style={s.optionsToggle} onClick={() => setShowOptions((v) => !v)}>
            {showOptions ? "Hide options ▴" : "View options ▾"}
          </button>
          {showOptions && (
            <div style={s.optionList}>
              {optionRows.map(({ key, text }) => {
                const normalizedKey = key.toUpperCase();
                const isCorrect = normalizedKey === String(correctAnswer || "").trim().toUpperCase();
                const isUserWrong = !isUnattempted &&
                  normalizedKey === String(displayAnswer || "").trim().toUpperCase() &&
                  !isCorrect;
                const color = isCorrect ? C.green : isUserWrong ? C.red : C.textDim;
                const backgroundColor = isCorrect
                  ? "rgba(76,175,125,0.1)"
                  : isUserWrong ? "rgba(224,82,82,0.08)" : "transparent";

                return (
                  <div key={key} style={{ ...s.optionRow, color, backgroundColor, borderColor: isCorrect || isUserWrong ? color + "55" : C.border }}>
                    <span style={{ ...s.optionKey, color }}>{key}.</span>
                    <span style={{ ...s.optionText, color }}>{text}</span>
                    {isCorrect && <span style={{ ...s.optionKey, color }}>Correct</span>}
                    {isUserWrong && <span style={{ ...s.optionKey, color }}>Your answer</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Why did you miss this?</div>
        <div style={s.diagnosisGrid}>
          {MISTAKE_DIAGNOSIS_OPTIONS.map((option) => {
            const selected = option === diagnosis;
            return (
              <button
                key={option}
                type="button"
                disabled={savingField === "error_type"}
                onClick={() => handleDiagnosisChange(option)}
                style={{
                  ...s.diagnosisButton,
                  color: selected ? C.orange : C.textDim,
                  backgroundColor: selected ? "rgba(245,166,35,0.1)" : "rgba(152,152,168,0.06)",
                  borderColor: selected ? "rgba(245,166,35,0.35)" : "rgba(152,152,168,0.16)",
                  opacity: savingField === "error_type" ? 0.7 : 1,
                }}
              >
                {getMistakeDiagnosisLabel(option)}
              </button>
            );
          })}
        </div>
        <div style={{ ...s.answerItem, marginTop: "10px" }}>
          <span style={s.label}>Selected:</span>
          <span style={{ ...s.monoValue, color: C.orange }}>{getMistakeDiagnosisLabel(diagnosis)}</span>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Fix this mistake</div>
        <div style={s.fixGrid}>
          <div style={s.fixBox}>
            <div style={s.fixTitle}>1. Correct Concept</div>
            <p style={s.fixText}>{correctConcept}</p>
          </div>
          <div style={s.fixBox}>
            <div style={s.fixTitle}>2. Trap to Remember</div>
            <p style={s.fixText}>Not recorded yet.</p>
          </div>
          <div style={s.fixBox}>
            <div style={s.fixTitle}>3. Memory Rule</div>
            <p style={s.fixText}>Not recorded yet.</p>
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Attempt Evidence</div>
        <div style={s.summaryGrid}>
          <div style={s.summaryBox}>
            <div style={s.summaryValue}>{historyLoading ? "-" : evidence.totalAttempts || 0}</div>
            <div style={s.summaryLabel}>Recorded Attempts</div>
          </div>
          <div style={s.summaryBox}>
            <div style={{ ...s.summaryValue, color: C.red }}>{historyLoading ? "-" : evidence.repeatedWrongCount || 0}</div>
            <div style={s.summaryLabel}>Recorded Failures</div>
          </div>
          <div style={s.summaryBox}>
            <div style={{ ...s.summaryValue, color: C.blue }}>{historyLoading ? "-" : evidence.retestCount || 0}</div>
            <div style={s.summaryLabel}>Verified Retests</div>
          </div>
          <div style={s.summaryBox}>
            <div style={{ ...s.summaryValue, color: evidence.masteryStatus === "mastered" ? C.green : C.orange }}>
              {historyLoading ? "-" : masteryLabel(evidence.masteryStatus)}
            </div>
            <div style={s.summaryLabel}>Mastery</div>
          </div>
        </div>

        {attemptHistory?.error && (
          <p style={{ ...s.fixText, color: C.red }}>{attemptHistory.error}</p>
        )}

        {!historyLoading && repeatedEvidence.length > 0 && (
          <div style={{ ...s.historyList, marginBottom: "10px" }}>
            {repeatedEvidence.map((row) => (
              <div key={row.id || `${row.attemptId}-${row.attemptedAt}`} style={s.historyRow}>
                <span style={{ color: C.red, fontFamily: C.fontMono, fontWeight: 800 }}>Wrong</span>
                <span style={{ fontFamily: C.fontMono }}>You: {row.selectedAnswer || "-"}</span>
                <span style={{ fontFamily: C.fontMono }}>Correct: {row.correctAnswer || "-"}</span>
                <span>{formatAttemptDate(row.attemptedAt)}</span>
              </div>
            ))}
          </div>
        )}

        {!historyLoading && attempts.length > 0 && (
          <div style={s.historyList}>
            {attempts.slice(0, 5).map((row) => {
              const isCorrect = row.answer_status === "correct";
              const isSkipped = row.answer_status === "unattempted";
              return (
                <div key={row.id} style={s.historyRow}>
                  <span style={{ color: isCorrect ? C.green : isSkipped ? "#f59e0b" : C.red, fontFamily: C.fontMono, fontWeight: 800 }}>
                    {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Wrong"}
                  </span>
                  <span style={{ fontFamily: C.fontMono }}>You: {row.selected_answer || "-"}</span>
                  <span>{row.source_type}{row.is_retest ? " · Retest" : ""}</span>
                  <span>{formatAttemptDate(row.attempted_at)}</span>
                </div>
              );
            })}
          </div>
        )}

        {!historyLoading && attempts.length === 0 && !attemptHistory?.error && (
          <p style={s.fixText}>No attempt history has been recorded for this question yet.</p>
        )}
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Retest</div>
        <div style={s.retestOptions}>
          {["A", "B", "C", "D", "E"].map((key) => {
            const selected = retestAnswer === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRetestAnswer(key)}
                style={{
                  ...s.retestOption,
                  color: selected ? C.blue : C.textDim,
                  background: selected ? "rgba(96,165,250,0.14)" : "rgba(152,152,168,0.06)",
                  borderColor: selected ? "rgba(96,165,250,0.45)" : "rgba(152,152,168,0.18)",
                }}
              >
                {key}
              </button>
            );
          })}
          <button
            type="button"
            disabled={savingField === "retest"}
            onClick={handleSubmitRetest}
            style={{
              ...s.button,
              color: "#10a37f",
              background: "rgba(16,163,127,0.12)",
              borderColor: "rgba(16,163,127,0.35)",
              opacity: savingField === "retest" ? 0.65 : 1,
            }}
          >
            Retest Now
          </button>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Status</div>
        <span style={{ ...s.badge, ...lifecycleStyle }}>
          {getReviewStatusLabel(reviewStatus)}
        </span>
      </div>

      <div style={s.actionRow}>
        <button
          type="button"
          disabled={reviewStatus !== "new" || savingField === "review_status"}
          onClick={handleMarkReviewed}
          style={{
            ...s.button,
            color: reviewStatus === "new" ? C.orange : C.green,
            background: reviewStatus === "new" ? "rgba(245,166,35,0.1)" : "rgba(76,175,125,0.1)",
            borderColor: reviewStatus === "new" ? "rgba(245,166,35,0.3)" : "rgba(76,175,125,0.3)",
            opacity: reviewStatus === "new" ? 1 : 0.75,
            cursor: reviewStatus === "new" ? "pointer" : "default",
          }}
        >
          {reviewStatus === "new" ? "Mark Reviewed" : "✓ Reviewed"}
        </button>

        <button
          type="button"
          disabled={reviewStatus !== "reviewed" || savingField === "review_status"}
          onClick={handleScheduleRetest}
          style={{
            ...s.button,
            color: reviewStatus === "retest_due" ? C.blue : C.textDim,
            background: reviewStatus === "retest_due" ? "rgba(96,165,250,0.1)" : "rgba(152,152,168,0.06)",
            borderColor: reviewStatus === "retest_due" ? "rgba(96,165,250,0.3)" : "rgba(152,152,168,0.2)",
            opacity: reviewStatus === "reviewed" || reviewStatus === "retest_due" ? 1 : 0.55,
            cursor: reviewStatus === "reviewed" ? "pointer" : "default",
          }}
        >
          {reviewStatus === "retest_due" ? "Retest Due" : "Schedule Retest"}
        </button>

        <button
          type="button"
          onClick={handleAskChatGpt}
          style={{
            ...s.button,
            color: "#10a37f",
            background: "rgba(16,163,127,0.12)",
            borderColor: "rgba(16,163,127,0.35)",
          }}
        >
          Ask ChatGPT
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            ...s.button,
            color: C.textMuted,
            background: "rgba(107,107,128,0.1)",
            borderColor: "rgba(107,107,128,0.3)",
          }}
        >
          Collapse
        </button>

        {(feedback || chatMsg) && (
          <span style={{ ...s.feedback, color: feedback.startsWith("Save failed") ? C.red : "#10a37f" }}>
            {feedback || chatMsg}
          </span>
        )}
      </div>
    </div>
  );
}
