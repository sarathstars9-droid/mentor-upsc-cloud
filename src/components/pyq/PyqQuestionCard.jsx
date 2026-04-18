import { useMemo, useState, useEffect } from "react";
import { BACKEND_URL } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get user ID (currently hardcoded, TODO: replace with auth context)
// ─────────────────────────────────────────────────────────────────────────────
function getUserId() {
  return "user_1";
}

function getPaperLabel(paper) {
  if (paper === "prelims") return "Prelims";
  if (paper === "mains") return "Mains";
  if (paper === "essay") return "Essay";
  if (paper === "ethics") return "Ethics";
  if (paper === "optional") return "Optional";
  if (paper === "csat") return "CSAT";
  return paper || "Paper";
}

function normalizeOptions(question) {
  const rawOptions = question?.options;

  if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
    const orderedKeys = ["a", "b", "c", "d", "e"];
    return orderedKeys
      .filter((key) => rawOptions[key] != null && rawOptions[key] !== "")
      .map((key) => ({
        key,
        label: key.toUpperCase(),
        value: rawOptions[key],
      }));
  }

  const possible = [
    { key: "a", value: question?.optionA || question?.option_a || question?.a },
    { key: "b", value: question?.optionB || question?.option_b || question?.b },
    { key: "c", value: question?.optionC || question?.option_c || question?.c },
    { key: "d", value: question?.optionD || question?.option_d || question?.d },
    { key: "e", value: question?.optionE || question?.option_e || question?.e },
  ];

  return possible
    .filter((item) => item.value != null && String(item.value).trim() !== "")
    .map((item) => ({
      ...item,
      label: item.key.toUpperCase(),
    }));
}

function getAnswerLabel(answerRaw) {
  if (answerRaw == null || answerRaw === "") return "Not available";

  const answer = String(answerRaw).trim();

  if (["a", "b", "c", "d", "e"].includes(answer.toLowerCase())) {
    return answer.toUpperCase();
  }

  return answer;
}

export default function PyqQuestionCard({
  question,
  index,
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Explanation feature state
  const [showExplanation, setShowExplanation] = useState(false);
  const [savedExplanation, setSavedExplanation] = useState(null);
  const [explanationInput, setExplanationInput] = useState("");
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [savingExplanation, setSavingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");
  const [showInputForm, setShowInputForm] = useState(false);

  const options = useMemo(() => normalizeOptions(question), [question]);
  const paperLabel = getPaperLabel(question?.paper);
  const answerLabel = getAnswerLabel(question?.answer);

  if (!question) return null;

  const repeatedSignal = (question.linkedQuestionIds?.length || 0) >= 2;
  const highlightBorder = question.isImportant || repeatedSignal;

  // Fetch saved explanation on mount
  useEffect(() => {
    if (!question.id) return;
    
    const userId = getUserId();
    const fetchExplanation = async () => {
      try {
        setLoadingExplanation(true);
        const res = await fetch(
          `${BACKEND_URL}/api/pyq/explanations/${encodeURIComponent(question.id)}?userId=${encodeURIComponent(userId)}`
        );
        const data = await res.json();
        
        if (data.success && data.explanation) {
          setSavedExplanation(data.explanation);
        }
      } catch (err) {
        console.error("Failed to fetch explanation:", err);
      } finally {
        setLoadingExplanation(false);
      }
    };

    fetchExplanation();
  }, [question.id]);

  // Save explanation to backend
  const handleSaveExplanation = async () => {
    if (!explanationInput.trim()) {
      setExplanationError("Explanation text cannot be empty");
      return;
    }

    try {
      setSavingExplanation(true);
      setExplanationError("");
      
      const userId = getUserId();
      const res = await fetch(`${BACKEND_URL}/api/pyq/explanations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: question.id,
          explanationText: explanationInput,
          source: "manual",
        }),
      });

      const data = await res.json();
      
      if (data.success && data.explanation) {
        setSavedExplanation(data.explanation);
        setExplanationInput("");
        setShowInputForm(false);
        setShowExplanation(true);
      } else {
        setExplanationError(data.error || "Failed to save explanation");
      }
    } catch (err) {
      console.error("Failed to save explanation:", err);
      setExplanationError("Failed to save explanation. Please try again.");
    } finally {
      setSavingExplanation(false);
    }
  };

  // Handle asking ChatGPT (open in new tab with prompt)
  const handleAskChatGpt = () => {
    const year = question.year ? `${question.year} ` : "";
    const paper = paperLabel ? `(${paperLabel}) ` : "";
    const prompt = `UPSC PYQ ${year}${paper}\n\n${question.questionText || ""}\n\nExplain the correct answer and key concepts for this UPSC question.`;
    
    // Copy prompt to clipboard for easy paste
    navigator.clipboard?.writeText(prompt).catch(() => {});
    
    // Open ChatGPT in new tab
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        border: highlightBorder
          ? "1px solid rgba(255, 159, 67, 0.36)"
          : "1px solid rgba(255,255,255,0.08)",
        background: question.isWeak
          ? "linear-gradient(180deg, rgba(60,26,26,0.34) 0%, rgba(255,255,255,0.04) 100%)"
          : "rgba(255,255,255,0.04)",
        borderRadius: 18,
        padding: "18px 18px 16px",
        boxShadow: highlightBorder
          ? "0 10px 24px rgba(255,159,67,0.10)"
          : "0 10px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.16)",
            border: "1px solid rgba(96,165,250,0.28)",
            color: "#dbeafe",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          {question.year || "—"}
        </span>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.14)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {paperLabel}
        </span>

        {question.isRead ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(74,222,128,0.24)",
              color: "#dcfce7",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Read
          </span>
        ) : null}

        {question.isWeak ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(248,113,113,0.24)",
              color: "#fecaca",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Weak
          </span>
        ) : null}

        {question.isImportant ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(251,191,36,0.24)",
              color: "#fde68a",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Important
          </span>
        ) : null}

        {repeatedSignal ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,80,80,0.10)",
              border: "1px solid rgba(255,80,80,0.22)",
              color: "#fecaca",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🔥 Repeated Topic
          </span>
        ) : null}

        {savedExplanation && (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(147,51,234,0.12)",
              border: "1px solid rgba(168,85,247,0.28)",
              color: "#ddd6fe",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            💡 Explanation saved
          </span>
        )}

        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          Q{index + 1}
        </span>
      </div>

      {question.microTheme ? (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(168,85,247,0.24)",
            background: "rgba(168,85,247,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(221,214,254,0.80)",
              marginBottom: 4,
              fontWeight: 800,
            }}
          >
            Micro Theme
          </div>

          <div
            style={{
              color: "#f5f3ff",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            {question.microTheme}
          </div>
        </div>
      ) : null}

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.6,
          color: "#f8fafc",
          whiteSpace: "pre-wrap",
          marginBottom: 16,
        }}
      >
        {question.questionText}
      </div>

      {options.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.key}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(59,130,246,0.16)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "#dbeafe",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {opt.label}
              </div>

              <div
                style={{
                  color: "#e5e7eb",
                  lineHeight: 1.55,
                  fontSize: 15,
                  whiteSpace: "pre-wrap",
                }}
              >
                {opt.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: showAnswer || showExplanation ? 12 : 0,
        }}
      >
        <button
          type="button"
          onClick={() => onToggleRead?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isRead
              ? "1px solid rgba(74,222,128,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isRead
              ? "rgba(34,197,94,0.16)"
              : "rgba(255,255,255,0.04)",
            color: question.isRead ? "#dcfce7" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isRead ? "✓ Read" : "Mark as Read"}
        </button>

        <button
          type="button"
          onClick={() => onToggleWeak?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isWeak
              ? "1px solid rgba(248,113,113,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isWeak
              ? "rgba(239,68,68,0.14)"
              : "rgba(255,255,255,0.04)",
            color: question.isWeak ? "#fecaca" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isWeak ? "⚠ Weak" : "Mark Weak"}
        </button>

        <button
          type="button"
          onClick={() => onToggleImportant?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isImportant
              ? "1px solid rgba(251,191,36,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isImportant
              ? "rgba(245,158,11,0.14)"
              : "rgba(255,255,255,0.04)",
            color: question.isImportant ? "#fde68a" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isImportant ? "⭐ Important" : "Mark Important"}
        </button>

        <button
          type="button"
          onClick={() => setShowAnswer((prev) => !prev)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(96,165,250,0.28)",
            background: "rgba(59,130,246,0.12)",
            color: "#dbeafe",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showAnswer ? "Hide Answer" : "Show Answer"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
        }}
      >
        <button
          type="button"
          onClick={handleAskChatGpt}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(16,185,129,0.28)",
            background: "rgba(16,185,129,0.10)",
            color: "#d1fae5",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ask ChatGPT
        </button>

        <button
          type="button"
          onClick={() => setShowInputForm((prev) => !prev)}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(147,51,234,0.28)",
            background: "rgba(147,51,234,0.10)",
            color: "#ddd6fe",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showInputForm ? "Cancel" : "Paste Explanation"}
        </button>

        {savedExplanation ? (
          <button
            type="button"
            onClick={() => setShowExplanation((prev) => !prev)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(147,51,234,0.40)",
              background: "rgba(147,51,234,0.12)",
              color: "#ddd6fe",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {showExplanation ? "Hide Explanation" : "View Explanation"}
          </button>
        ) : null}
      </div>

      {showAnswer ? (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.24)",
            background: "rgba(34,197,94,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(187,247,208,0.82)",
              marginBottom: 6,
              fontWeight: 800,
            }}
          >
            Answer
          </div>

          <div
            style={{
              color: "#ecfdf5",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {answerLabel}
          </div>
        </div>
      ) : null}

      {showExplanation && savedExplanation ? (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(147,51,234,0.24)",
            background: "rgba(147,51,234,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(196,181,253,0.82)",
              marginBottom: 6,
              fontWeight: 800,
            }}
          >
            AI Explanation
          </div>

          <div
            style={{
              color: "#ede9fe",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {savedExplanation.explanation_text}
          </div>

          <div
            style={{
              fontSize: 10,
              color: "rgba(196,181,253,0.60)",
              marginTop: 8,
              fontStyle: "italic",
            }}
          >
            Saved on {new Date(savedExplanation.updated_at).toLocaleDateString()}
          </div>
        </div>
      ) : null}

      {showInputForm && !savedExplanation ? (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(147,51,234,0.24)",
            background: "rgba(147,51,234,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(196,181,253,0.82)",
              marginBottom: 8,
              fontWeight: 800,
            }}
          >
            Paste Explanation from ChatGPT
          </div>

          <textarea
            value={explanationInput}
            onChange={(e) => setExplanationInput(e.target.value)}
            placeholder="Paste the explanation you got from ChatGPT here..."
            style={{
              width: "100%",
              minHeight: "120px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(147,51,234,0.24)",
              background: "rgba(147,51,234,0.05)",
              color: "#f3e8ff",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              marginBottom: 10,
            }}
          />

          {explanationError && (
            <div
              style={{
                fontSize: 12,
                color: "#fecaca",
                marginBottom: 8,
              }}
            >
              {explanationError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleSaveExplanation}
              disabled={savingExplanation || !explanationInput.trim()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(34,197,94,0.40)",
                background: "rgba(34,197,94,0.12)",
                color: savingExplanation || !explanationInput.trim() ? "#9ca3af" : "#dcfce7",
                fontWeight: 600,
                fontSize: 12,
                cursor: savingExplanation || !explanationInput.trim() ? "not-allowed" : "pointer",
                opacity: savingExplanation || !explanationInput.trim() ? 0.6 : 1,
              }}
            >
              {savingExplanation ? "Saving..." : "✓ Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                setExplanationInput("");
                setExplanationError("");
                setShowInputForm(false);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(248,113,113,0.28)",
                background: "rgba(248,113,113,0.10)",
                color: "#fecaca",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕ Clear
            </button>
          </div>
        </div>
      ) : null}

      {loadingExplanation ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(96,165,250,0.20)",
            background: "rgba(96,165,250,0.06)",
            color: "#9ca3af",
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          Loading explanation...
        </div>
      ) : null}
    </div>
  );
}

function getPaperLabel(paper) {
  if (paper === "prelims") return "Prelims";
  if (paper === "mains") return "Mains";
  if (paper === "essay") return "Essay";
  if (paper === "ethics") return "Ethics";
  if (paper === "optional") return "Optional";
  if (paper === "csat") return "CSAT";
  return paper || "Paper";
}

function normalizeOptions(question) {
  const rawOptions = question?.options;

  if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
    const orderedKeys = ["a", "b", "c", "d", "e"];
    return orderedKeys
      .filter((key) => rawOptions[key] != null && rawOptions[key] !== "")
      .map((key) => ({
        key,
        label: key.toUpperCase(),
        value: rawOptions[key],
      }));
  }

  const possible = [
    { key: "a", value: question?.optionA || question?.option_a || question?.a },
    { key: "b", value: question?.optionB || question?.option_b || question?.b },
    { key: "c", value: question?.optionC || question?.option_c || question?.c },
    { key: "d", value: question?.optionD || question?.option_d || question?.d },
    { key: "e", value: question?.optionE || question?.option_e || question?.e },
  ];

  return possible
    .filter((item) => item.value != null && String(item.value).trim() !== "")
    .map((item) => ({
      ...item,
      label: item.key.toUpperCase(),
    }));
}

function getAnswerLabel(answerRaw) {
  if (answerRaw == null || answerRaw === "") return "Not available";

  const answer = String(answerRaw).trim();

  if (["a", "b", "c", "d", "e"].includes(answer.toLowerCase())) {
    return answer.toUpperCase();
  }

  return answer;
}

export default function PyqQuestionCard({
  question,
  index,
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
}) {
  const [showAnswer, setShowAnswer] = useState(false);

  const options = useMemo(() => normalizeOptions(question), [question]);
  const paperLabel = getPaperLabel(question?.paper);
  const answerLabel = getAnswerLabel(question?.answer);

  if (!question) return null;

  const repeatedSignal = (question.linkedQuestionIds?.length || 0) >= 2;
  const highlightBorder = question.isImportant || repeatedSignal;

  return (
    <div
      style={{
        border: highlightBorder
          ? "1px solid rgba(255, 159, 67, 0.36)"
          : "1px solid rgba(255,255,255,0.08)",
        background: question.isWeak
          ? "linear-gradient(180deg, rgba(60,26,26,0.34) 0%, rgba(255,255,255,0.04) 100%)"
          : "rgba(255,255,255,0.04)",
        borderRadius: 18,
        padding: "18px 18px 16px",
        boxShadow: highlightBorder
          ? "0 10px 24px rgba(255,159,67,0.10)"
          : "0 10px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.16)",
            border: "1px solid rgba(96,165,250,0.28)",
            color: "#dbeafe",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          {question.year || "—"}
        </span>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.14)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {paperLabel}
        </span>

        {question.isRead ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(74,222,128,0.24)",
              color: "#dcfce7",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Read
          </span>
        ) : null}

        {question.isWeak ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(248,113,113,0.24)",
              color: "#fecaca",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Weak
          </span>
        ) : null}

        {question.isImportant ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(251,191,36,0.24)",
              color: "#fde68a",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Important
          </span>
        ) : null}

        {repeatedSignal ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,80,80,0.10)",
              border: "1px solid rgba(255,80,80,0.22)",
              color: "#fecaca",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🔥 Repeated Topic
          </span>
        ) : null}

        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          Q{index + 1}
        </span>
      </div>

      {question.microTheme ? (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(168,85,247,0.24)",
            background: "rgba(168,85,247,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(221,214,254,0.80)",
              marginBottom: 4,
              fontWeight: 800,
            }}
          >
            Micro Theme
          </div>

          <div
            style={{
              color: "#f5f3ff",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            {question.microTheme}
          </div>
        </div>
      ) : null}

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.6,
          color: "#f8fafc",
          whiteSpace: "pre-wrap",
          marginBottom: 16,
        }}
      >
        {question.questionText}
      </div>

      {options.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.key}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(59,130,246,0.16)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "#dbeafe",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {opt.label}
              </div>

              <div
                style={{
                  color: "#e5e7eb",
                  lineHeight: 1.55,
                  fontSize: 15,
                  whiteSpace: "pre-wrap",
                }}
              >
                {opt.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: showAnswer ? 12 : 0,
        }}
      >
        <button
          type="button"
          onClick={() => onToggleRead?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isRead
              ? "1px solid rgba(74,222,128,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isRead
              ? "rgba(34,197,94,0.16)"
              : "rgba(255,255,255,0.04)",
            color: question.isRead ? "#dcfce7" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isRead ? "✓ Read" : "Mark as Read"}
        </button>

        <button
          type="button"
          onClick={() => onToggleWeak?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isWeak
              ? "1px solid rgba(248,113,113,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isWeak
              ? "rgba(239,68,68,0.14)"
              : "rgba(255,255,255,0.04)",
            color: question.isWeak ? "#fecaca" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isWeak ? "⚠ Weak" : "Mark Weak"}
        </button>

        <button
          type="button"
          onClick={() => onToggleImportant?.(question.id)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: question.isImportant
              ? "1px solid rgba(251,191,36,0.34)"
              : "1px solid rgba(255,255,255,0.10)",
            background: question.isImportant
              ? "rgba(245,158,11,0.14)"
              : "rgba(255,255,255,0.04)",
            color: question.isImportant ? "#fde68a" : "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {question.isImportant ? "⭐ Important" : "Mark Important"}
        </button>

        <button
          type="button"
          onClick={() => setShowAnswer((prev) => !prev)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(96,165,250,0.28)",
            background: "rgba(59,130,246,0.12)",
            color: "#dbeafe",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showAnswer ? "Hide Answer" : "Show Answer"}
        </button>

        <button
          type="button"
          onClick={() => {
            const year = question.year ? `${question.year} ` : "";
            const paper = paperLabel ? `(${paperLabel}) ` : "";
            const prompt = `UPSC PYQ ${year}${paper}\n\n${question.questionText || ""}\n\nExplain the correct answer and key concepts for this UPSC question.`;
            navigator.clipboard?.writeText(prompt).catch(() => {});
            window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(16,185,129,0.28)",
            background: "rgba(16,185,129,0.10)",
            color: "#d1fae5",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ask ChatGPT
        </button>
      </div>

      {showAnswer ? (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.24)",
            background: "rgba(34,197,94,0.10)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(187,247,208,0.82)",
              marginBottom: 6,
              fontWeight: 800,
            }}
          >
            Answer
          </div>

          <div
            style={{
              color: "#ecfdf5",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {answerLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}