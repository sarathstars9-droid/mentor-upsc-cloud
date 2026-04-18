/**
 * FocusPyqSession
 * ──────────────────────────────────────────────────────────────────────────────
 * Self-contained PYQ attempt session launched from the Focus Page.
 *
 * Lifecycle:  attempt  →  result
 *
 * Reuses PyqTestAttempt and PyqTestResult exactly as PrelimsPage.jsx does.
 * On submit, calls recordTestAttempt with sourceType:"focus_pyq" so wrong /
 * unattempted questions flow into /api/mistakes → revision auto-link exactly
 * the same way as any other prelims session.
 *
 * Props:
 *   nodeId    — the focus node, used as subject/topic in the mistake payload
 *   questions — pre-filtered prelims questions (max 5, already sliced by caller)
 *   onClose   — called when the user clicks "Back to Focus Node"; caller should
 *               reset pyqSession state and trigger a data refetch
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PyqTestAttempt from "./PyqTestAttempt";
import PyqTestResult from "./PyqTestResult";
import { recordTestAttempt, buildTestId } from "../../utils/prelimsMistakeEngine";

// ── Pure helpers ──────────────────────────────────────────────────────────────
// Copied from PrelimsPage.jsx — kept local to avoid cross-page coupling.
// Both functions are stateless; there is no risk of drift.

function normalizeAnswerKey(value) {
  return String(value || "").trim().toUpperCase();
}

function buildAttemptRows(questions, answersMap, confidenceMap) {
  return (Array.isArray(questions) ? questions : []).map((q, index) => {
    const qid = q?.questionId || q?.id || q?.qid || `q_${index + 1}`;
    const userAnswer = answersMap?.[qid] || "";
    const correctAnswer = q?.answer || "";
    const confidence = confidenceMap?.[qid] || "unknown";

    let status = "unattempted";
    if (userAnswer && normalizeAnswerKey(userAnswer) === normalizeAnswerKey(correctAnswer)) {
      status = "correct";
    } else if (userAnswer) {
      status = "wrong";
    }

    return {
      ...q,
      id: qid,
      questionId: qid,
      userAnswer,
      correctAnswer,
      confidence,
      status,
      selectedOption: userAnswer,
      markedOption: userAnswer,
      syllabusNodeId: q?.syllabusNodeId || q?.nodeId || q?.syllabusNode || "Unknown",
      microThemeLabel:
        q?.microtheme || q?.microTheme || q?.microThemeLabel || q?.subtopic || "Unknown",
      questionType: q?.questionType || "MCQ_SINGLE",
      questionText: q?.questionText || q?.question || "",
      options: q?.options || {},
    };
  });
}

function buildSessionResult(evaluatedQuestions, testId, nodeId) {
  const total = evaluatedQuestions.length;
  const correct = evaluatedQuestions.filter((q) => q.status === "correct").length;
  const wrong = evaluatedQuestions.filter((q) => q.status === "wrong").length;
  const unattempted = evaluatedQuestions.filter((q) => q.status === "unattempted").length;
  const attempted = correct + wrong;
  const guessed = evaluatedQuestions.filter((q) => q.confidence === "guess").length;

  return {
    mode: "practice",
    paperType: "GS",
    variant: "topic",
    label: testId,
    questions: evaluatedQuestions,
    summary: {
      total,
      correct,
      wrong,
      unattempted,
      attempted,
      score: correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      guessed,
      guessRate: attempted > 0 ? Math.round((guessed / attempted) * 100) : 0,
      eliminationSuccessRate: 0,
      riskTendency: "medium",
      attemptQuality: "balanced",
      safeAttempts: 0,
      cautiousAttempts: 0,
      riskyAttempts: 0,
      changedAnswers: 0,
      safeAccuracy: 0,
      riskyAccuracy: 0,
      overconfidenceTrapCount: 0,
      blindGuessTrapCount: 0,
      eliminationFailureCount: 0,
      answerSwitchTrapCount: 0,
      knowledgeGapCount: 0,
      extremeWordTrapCount: 0,
      partialTruthTrapCount: 0,
      staticCurrentConfusionCount: 0,
      topTrapType: null,
    },
    grouped: {},
    prescription: {
      priority: `Review wrong answers on ${nodeId} before moving to new topics.`,
      revise: wrong > 0 ? [`${wrong} question${wrong > 1 ? "s" : ""} marked wrong — add to revision`] : [],
      practice: [],
      avoid: [],
    },
  };
}

// ── Mode label map ────────────────────────────────────────────────────────────
const MODE_LABEL = {
  quick: "QUICK DRILL",
  full:  "FULL TOPIC",
  weak:  "WEAK AREA",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FocusPyqSession({ nodeId, questions, mode = "quick", onClose }) {
  const navigate = useNavigate();

  const [stage, setStage] = useState("attempt");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [confidenceMap, setConfidenceMap] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [testStartTime] = useState(() => Date.now());

  // Stable test ID for the session. Includes mode so different modes don't collide.
  const testId = buildTestId({
    sourceType: "focus_pyq",
    customLabel: `focus_pyq_${mode}_${nodeId}`,
  });

  // ── Reset to attempt stage ────────────────────────────────────────────────────
  function handleRetry() {
    setStage("attempt");
    setCurrentIndex(0);
    setAnswersMap({});
    setConfidenceMap({});
    setResult(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const evaluatedQuestions = buildAttemptRows(questions, answersMap, confidenceMap);
      const finalResult = buildSessionResult(evaluatedQuestions, testId, nodeId);
      setResult(finalResult);

      // Log mistakes through the existing pipeline.
      // sourceType:"focus_pyq" and source_ref:testId are stored in the mistake row
      // so the mistake → revision auto-link fires exactly as in normal prelims flow.
      await recordTestAttempt(
        {
          testId,
          sourceType: "focus_pyq",
          paper: "GS",
          year: null,
          subject: nodeId,
          topic: nodeId,
          subtopic: "",
        },
        evaluatedQuestions,
        finalResult.summary || {}
      );
    } catch (err) {
      console.error("[FocusPyqSession] recordTestAttempt failed (non-fatal):", err);
    } finally {
      setSubmitting(false);
      setStage("result");
    }
  }

  // ── Shared page wrapper styles ────────────────────────────────────────────────
  const pageWrap = {
    background: "#080808",
    minHeight: "100vh",
    padding: "16px 20px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: "#e5e7eb",
  };

  const headerBar = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid #1a1a1a",
  };

  const backBtn = {
    background: "none",
    border: "none",
    color: "#555",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "monospace",
    padding: 0,
  };

  // ── Stage: attempt ────────────────────────────────────────────────────────────
  if (stage === "attempt") {
    return (
      <div style={pageWrap}>
        <div style={headerBar}>
          <button onClick={onClose} style={backBtn}>← Back</button>
          <span style={{
            fontSize: 10, color: "#444", letterSpacing: "0.12em",
            textTransform: "uppercase", fontFamily: "monospace",
          }}>
            {MODE_LABEL[mode] || "FOCUS PYQ SESSION"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#555", fontFamily: "monospace" }}>
            {nodeId} · {questions.length} Q
          </span>
        </div>

        <PyqTestAttempt
          key={testId}
          testMeta={{
            mode: "practice",
            paperType: "GS",
            variant: "topic",
            label: `${MODE_LABEL[mode] || "Focus PYQ"} · ${nodeId}`,
          }}
          questions={questions}
          currentIndex={currentIndex}
          currentQuestion={questions[currentIndex] || null}
          answersMap={answersMap}
          confidenceMap={confidenceMap}
          testStartTime={testStartTime}
          practiceMode="focus_pyq"
          questionCount={questions.length}
          onSetConfidence={(qid, level) =>
            setConfidenceMap((prev) => ({ ...prev, [qid]: level }))
          }
          onSelectOption={(qid, option) =>
            setAnswersMap((prev) => ({ ...prev, [qid]: option }))
          }
          onClearOption={(qid) =>
            setAnswersMap((prev) => {
              const copy = { ...prev };
              delete copy[qid];
              return copy;
            })
          }
          onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          onNext={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
          onJumpTo={(i) => setCurrentIndex(i)}
          onSubmit={handleSubmit}
        />

        {/* Submission overlay */}
        {submitting && (
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
            fontFamily: "monospace", color: "#f59e0b", fontSize: 14,
            letterSpacing: "0.08em",
          }}>
            ⟳ Logging mistakes and updating revision queue…
          </div>
        )}
      </div>
    );
  }

  // ── Stage: result ─────────────────────────────────────────────────────────────
  const summary = result?.summary || {};
  const mistakeCount = (summary.wrong ?? 0) + (summary.unattempted ?? 0);
  const RETRY_LABEL = {
    quick: "Retry 5 More",
    full:  "Retry Full Topic",
    weak:  "Retry Weak Areas",
  };

  return (
    <div style={pageWrap}>
      {/* ── Focus CTA bar — above PyqTestResult ────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap",
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: "1px solid #1a1a1a",
        alignItems: "center",
      }}>
        <button
          onClick={onClose}
          style={{
            background: "#0f0f0f", border: "1px solid #f59e0b55", color: "#f59e0b",
            borderRadius: 8, padding: "8px 16px", fontSize: 11,
            fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          ← Back to {nodeId}
        </button>
        <button
          onClick={() => navigate("/revision")}
          style={{
            background: "#0f0f0f", border: "1px solid #ef444455", color: "#ef4444",
            borderRadius: 8, padding: "8px 16px", fontSize: 11,
            fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          Review Mistakes
        </button>
        <button
          onClick={handleRetry}
          style={{
            background: "#0f0f0f", border: "1px solid #22c55e55", color: "#22c55e",
            borderRadius: 8, padding: "8px 16px", fontSize: 11,
            fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          {RETRY_LABEL[mode] || "Retry"}
        </button>
        <button
          onClick={() => navigate(`/pyq/topic/${encodeURIComponent(nodeId)}`)}
          style={{
            background: "#0f0f0f", border: "1px solid #38bdf855", color: "#38bdf8",
            borderRadius: 8, padding: "8px 16px", fontSize: 11,
            fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          View All Linked PYQs
        </button>
      </div>

      {/* ── Score summary ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "#0c0c0c",
        border: "1px solid #1e1e1e",
        borderRadius: 12, padding: "18px 20px", marginBottom: 20,
      }}>
        <div style={{
          fontSize: 10, color: "#444", letterSpacing: "0.15em",
          textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace",
        }}>
          {MODE_LABEL[mode] || "SESSION"} RESULT · {nodeId}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "TOTAL", value: summary.total ?? 0, color: "#94a3b8" },
            { label: "CORRECT", value: summary.correct ?? 0, color: "#22c55e" },
            { label: "WRONG", value: summary.wrong ?? 0, color: "#ef4444" },
            { label: "SKIPPED", value: summary.unattempted ?? 0, color: "#f59e0b" },
            { label: "GUESSED", value: summary.guessed ?? 0, color: "#a78bfa" },
            {
              label: "ACCURACY",
              value: `${summary.accuracy ?? 0}%`,
              color:
                (summary.accuracy ?? 0) >= 60
                  ? "#22c55e"
                  : (summary.accuracy ?? 0) >= 40
                    ? "#f59e0b"
                    : "#ef4444",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#111",
              border: `1px solid ${color}22`,
              borderRadius: 8, padding: "12px 14px",
              flex: "1 1 80px", textAlign: "center",
            }}>
              <div style={{
                fontSize: 22, fontWeight: 800, color,
                fontFamily: "monospace", lineHeight: 1,
              }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 4, letterSpacing: "0.08em" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {mistakeCount > 0 && (
          <div style={{
            marginTop: 12, fontSize: 11, color: "#f97316",
            fontFamily: "monospace", letterSpacing: "0.04em",
          }}>
            ⚠ {mistakeCount} mistake{mistakeCount !== 1 ? "s" : ""} logged →
            revision queue updated automatically
          </div>
        )}
        {mistakeCount === 0 && (
          <div style={{
            marginTop: 12, fontSize: 11, color: "#22c55e",
            fontFamily: "monospace", letterSpacing: "0.04em",
          }}>
            ✓ Perfect session — no mistakes to log
          </div>
        )}
      </div>

      {/* ── Full behavioral analysis from existing PyqTestResult ─────────────── */}
      {/* onRestart and onReattempt both map to handleRetry in this context      */}
      <PyqTestResult
        result={result}
        onRestart={handleRetry}
        onReattempt={handleRetry}
      />
    </div>
  );
}
