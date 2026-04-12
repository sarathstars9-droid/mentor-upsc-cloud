import { useCallback, useState } from "react";
import { buildMistakeExplanationPrompt } from "../utils/buildMistakeExplanationPrompt";
import { openChatGptForMistake } from "../utils/openChatGptForMistake";

const C = {
  bg: "#0f0f14",
  surface: "#16161e",
  surfaceHover: "#1c1c26",
  border: "#2a2a38",
  orange: "#f5a623",
  orangeDim: "#c47e10",
  text: "#e8e8f0",
  textMuted: "#6b6b80",
  textDim: "#9898a8",
  red: "#e05252",
  green: "#4caf7d",
  fontMono: "'Courier New', Courier, monospace",
  fontSans: "'Arial', sans-serif",

  sourcePyq:           "#38bdf8",
  sourcePyqBg:         "rgba(56,189,248,0.1)",
  sourceInstitutional: "#a78bfa",
  sourceInstBg:        "rgba(167,139,250,0.1)",
};

const s = {
  drawer: {
    padding: "24px 18px",
    backgroundColor: "#121218",
    borderTop: `1px solid ${C.border}`,
    marginTop: "12px",
    borderRadius: "8px",
  },

  section: {
    marginBottom: "24px",
  },

  header: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: `1px solid ${C.border}`,
  },

  badge: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "3px 9px",
    borderRadius: "5px",
    border: `1px solid`,
    whiteSpace: "nowrap",
  },

  sectionTitle: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: C.orange,
    marginBottom: "12px",
  },

  fullQuestion: {
    fontSize: "14px",
    lineHeight: "1.7",
    color: C.text,
    margin: 0,
    padding: "12px",
    backgroundColor: "#0e0e16",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
  },

  fallbackText: {
    fontSize: "13px",
    color: C.textMuted,
    fontStyle: "italic",
    margin: 0,
    padding: "12px",
    backgroundColor: "rgba(107,107,128,0.05)",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
  },

  optionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  optionRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid",
    transition: "all 0.2s",
  },

  optionKey: {
    fontFamily: C.fontMono,
    fontSize: "12px",
    fontWeight: "800",
    minWidth: "20px",
    textAlign: "center",
  },

  optionText: {
    fontSize: "13px",
    lineHeight: "1.6",
    flex: 1,
  },

  optionIndicator: {
    marginLeft: "auto",
    fontSize: "11px",
    fontWeight: "700",
    flexShrink: 0,
  },

  answerAnalysisGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "12px",
  },

  answerBlockLarge: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  answerLabel: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: C.textMuted,
  },

  answerValue: {
    fontFamily: C.fontMono,
    fontSize: "16px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },

  resultBadge: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "4px 12px",
    borderRadius: "6px",
    border: "1px solid",
    display: "inline-block",
    width: "fit-content",
  },

  actionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: `1px solid ${C.border}`,
  },

  button: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid",
    cursor: "pointer",
    outline: "none",
    transition: "all 0.2s",
  },

  buttonAsk: {
    background: "rgba(16,163,127,0.12)",
    borderColor: "rgba(16,163,127,0.35)",
    color: "#10a37f",
  },

  buttonAction: {
    background: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.3)",
    color: "#fbbf24",
  },

  buttonRevision: {
    background: "rgba(99,102,241,0.1)",
    borderColor: "rgba(99,102,241,0.3)",
    color: "#6366f1",
  },

  buttonClose: {
    background: "rgba(107,107,128,0.1)",
    borderColor: "rgba(107,107,128,0.3)",
    color: C.textMuted,
    marginLeft: "auto",
  },

  chatMsg: {
    fontSize: "11px",
    color: "#10a37f",
    fontFamily: C.fontMono,
    marginTop: "8px",
    padding: "8px 12px",
    backgroundColor: "rgba(16,163,127,0.05)",
    borderRadius: "4px",
    maxWidth: "100%",
  },
};

function formatMistakeDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MistakeBookReviewDrawer({ mistake, onClose, onRefresh }) {
  const {
    questionText,
    options,
    latestUserAnswer,
    userAnswer,
    correctAnswer,
    subject,
    topic,
    sourceType,
    paperType,
    paper,
    questionNumber,
    latestResult,
    result,
  } = mistake;

  const [chatMsg, setChatMsg] = useState("");
  const [isRevised, setIsRevised] = useState(false);

  const displayAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
  const displayResult = latestResult || result;
  const isUnattempted = displayResult === "unattempted" || (!displayAnswer && !displayResult);
  
  const normalizedSource = (!sourceType || sourceType === "pyq" || sourceType.startsWith("topic") || sourceType.startsWith("sectional") || sourceType === "full_length")
    ? "pyq"
    : "institutional";
  const isPyq = normalizedSource === "pyq";
  const sourceBadgeLabel = isPyq ? "PYQ" : "Institutional";
  const sourceBadgeColor = isPyq ? C.sourcePyq : C.sourceInstitutional;
  const sourceBadgeBg = isPyq ? C.sourcePyqBg : C.sourceInstBg;

  const paperDisplay = paperType || paper || "GS";

  // Options normalization
  const optionRows = (() => {
    if (!options) return [];
    if (Array.isArray(options)) {
      const labels = ["A", "B", "C", "D", "E"];
      return options.map((o, i) => ({ key: labels[i] || String(i + 1), text: String(o) }));
    }
    if (typeof options === "object") {
      return Object.keys(options).sort().map((k) => ({ key: k, text: String(options[k]) }));
    }
    return [];
  })();

  const handleAskChatGpt = useCallback(async () => {
    const prompt = buildMistakeExplanationPrompt(mistake);
    const { message } = await openChatGptForMistake(prompt);
    setChatMsg(message);
    setTimeout(() => setChatMsg(""), 5000);
  }, [mistake]);

  return (
    <div style={s.drawer}>
      {/* ──── HEADER ──── */}
      <div style={s.header}>
        {/* Source badge */}
        <span style={{
          ...s.badge,
          color: sourceBadgeColor,
          backgroundColor: sourceBadgeBg,
          borderColor: sourceBadgeColor + "55",
        }}>
          {sourceBadgeLabel}
        </span>

        {/* Paper badge */}
        <span style={{
          ...s.badge,
          color: paperDisplay === "CSAT" ? "#60a5fa" : "#fbbf24",
          backgroundColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)",
          borderColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.3)" : "rgba(251,191,36,0.3)",
        }}>
          {paperDisplay}
        </span>

        {/* Question number */}
        {questionNumber && (
          <span style={{
            ...s.badge,
            color: C.textDim,
            backgroundColor: "transparent",
            borderColor: C.border,
          }}>
            Q.{questionNumber}
          </span>
        )}

        {/* Result badge */}
        <span style={{
          ...s.badge,
          marginLeft: "auto",
          color: displayResult === "wrong" ? C.red : displayResult === "unattempted" ? "#f59e0b" : C.green,
          backgroundColor:
            displayResult === "wrong" ? "rgba(224,82,82,0.1)" 
            : displayResult === "unattempted" ? "rgba(245,158,11,0.1)" 
            : "rgba(76,175,125,0.1)",
          borderColor:
            displayResult === "wrong" ? "rgba(224,82,82,0.3)" 
            : displayResult === "unattempted" ? "rgba(245,158,11,0.3)" 
            : "rgba(76,175,125,0.3)",
        }}>
          {displayResult === "wrong" ? "✗ Wrong" : displayResult === "unattempted" ? "⊘ Unattempted" : "✓ Correct"}
        </span>
      </div>

      {/* ──── QUESTION TEXT ──── */}
      {questionText ? (
        <div style={s.section}>
          <div style={s.sectionTitle}>Full Question</div>
          <p style={s.fullQuestion}>{questionText}</p>
        </div>
      ) : (
        <div style={s.section}>
          <div style={s.sectionTitle}>Question</div>
          <p style={s.fallbackText}>Question content not available</p>
        </div>
      )}

      {/* ──── OPTIONS ──── */}
      {optionRows.length > 0 ? (
        <div style={s.section}>
          <div style={s.sectionTitle}>Options</div>
          <div style={s.optionsContainer}>
            {optionRows.map(({ key, text }) => {
              const isCorrect = key.toUpperCase() === (correctAnswer || "").trim().toUpperCase();
              const isUserWrong = !isUnattempted &&
                key.toUpperCase() === (displayAnswer || "").trim().toUpperCase() &&
                !isCorrect;

              const bgColor =
                isCorrect ? "rgba(76,175,125,0.1)"
                : isUserWrong ? "rgba(224,82,82,0.08)"
                : "transparent";

              const borderColor =
                isCorrect ? "rgba(76,175,125,0.25)"
                : isUserWrong ? "rgba(224,82,82,0.2)"
                : C.border;

              const textColor =
                isCorrect ? C.green
                : isUserWrong ? C.red
                : C.textDim;

              return (
                <div
                  key={key}
                  style={{
                    ...s.optionRow,
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                  }}
                >
                  <span style={{
                    ...s.optionKey,
                    color: textColor,
                  }}>
                    {key}.
                  </span>
                  <span style={{
                    ...s.optionText,
                    color: textColor,
                  }}>
                    {text}
                  </span>
                  {isCorrect && (
                    <span style={{
                      ...s.optionIndicator,
                      color: C.green,
                    }}>
                      ✓ Correct
                    </span>
                  )}
                  {isUserWrong && (
                    <span style={{
                      ...s.optionIndicator,
                      color: C.red,
                    }}>
                      ✗ Your answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={s.section}>
          <div style={s.sectionTitle}>Options</div>
          <p style={s.fallbackText}>Options not available</p>
        </div>
      )}

      {/* ──── ANSWER ANALYSIS ──── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Answer Analysis</div>
        <div style={s.answerAnalysisGrid}>
          <div style={s.answerBlockLarge}>
            <span style={s.answerLabel}>Your Answer</span>
            <span style={{
              ...s.answerValue,
              color: isUnattempted ? C.textMuted : C.red,
            }}>
              {isUnattempted ? "Unattempted" : (displayAnswer || "—")}
            </span>
          </div>

          <div style={s.answerBlockLarge}>
            <span style={s.answerLabel}>Correct Answer</span>
            <span style={{
              ...s.answerValue,
              color: C.green,
            }}>
              {correctAnswer || "—"}
            </span>
          </div>
        </div>

        {/* Result display */}
        <span style={{
          ...s.resultBadge,
          color: displayResult === "wrong" ? C.red : displayResult === "unattempted" ? "#f59e0b" : C.green,
          backgroundColor:
            displayResult === "wrong" ? "rgba(224,82,82,0.1)" 
            : displayResult === "unattempted" ? "rgba(245,158,11,0.1)" 
            : "rgba(76,175,125,0.1)",
          borderColor:
            displayResult === "wrong" ? "rgba(224,82,82,0.3)" 
            : displayResult === "unattempted" ? "rgba(245,158,11,0.3)" 
            : "rgba(76,175,125,0.3)",
        }}>
          {displayResult === "wrong" ? "Wrong Answer" : displayResult === "unattempted" ? "Not Attempted" : "Correct"}
        </span>

        {/* Metadata */}
        <div style={{
          fontSize: "12px",
          color: C.textMuted,
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: `1px solid ${C.border}`,
        }}>
          Added on {formatMistakeDate(mistake.createdAt || mistake.firstSeenAt)}
          {subject && <span> • {subject}</span>}
          {topic && <span> • {topic}</span>}
        </div>
      </div>

      {/* ──── ACTIONS ──── */}
      <div style={s.actionRow}>
        <button
          type="button"
          onClick={handleAskChatGpt}
          style={{
            ...s.button,
            ...s.buttonAsk,
          }}
        >
          Ask ChatGPT
        </button>

        <button
          type="button"
          style={{
            ...s.button,
            ...s.buttonRevision,
          }}
          onClick={() => alert("Add to Revision — feature coming soon")}
        >
          Add to Revision
        </button>

        <button
          type="button"
          onClick={() => { setIsRevised(true); if (onRefresh) onRefresh(); }}
          style={{
            ...s.button,
            ...s.buttonRevision,
            background: isRevised ? "rgba(76,175,125,0.1)" : "rgba(99,102,241,0.1)",
            borderColor: isRevised ? "rgba(76,175,125,0.3)" : "rgba(99,102,241,0.3)",
            color: isRevised ? C.green : "#6366f1",
          }}
        >
          {isRevised ? "✓ Marked Revised" : "Mark Revised"}
        </button>

        <button
          type="button"
          style={{
            ...s.button,
            ...s.buttonAction,
          }}
          onClick={() => alert("Must Revise — feature coming soon")}
        >
          Must Revise
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            ...s.button,
            ...s.buttonClose,
          }}
        >
          Collapse
        </button>

        {chatMsg && (
          <div style={s.chatMsg}>
            {chatMsg}
          </div>
        )}
      </div>
    </div>
  );
}
