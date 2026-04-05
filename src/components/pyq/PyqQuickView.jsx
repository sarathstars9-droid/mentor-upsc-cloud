import { useMemo, useState } from "react";

function paperLabel(paper = "") {
  const p = String(paper || "").toLowerCase();
  if (p === "prelims") return "Prelims";
  if (p === "mains") return "Mains";
  if (p === "essay") return "Essay";
  if (p === "ethics") return "Ethics";
  if (p === "optional") return "Optional";
  if (p === "csat") return "CSAT";
  return p || "Paper";
}

function yearLabel(year) {
  return year ? String(year) : "Unknown Year";
}

function buildTimelineGroups(questions) {
  const map = new Map();

  for (const q of questions) {
    const year = Number(q.year) || 0;
    if (!map.has(year)) {
      map.set(year, []);
    }
    map.get(year).push(q);
  }

  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      label: year > 0 ? String(year) : "Unknown Year",
      items,
    }));
}

const GENERIC_LABELS = new Set([
  "", "general", "general topic", "theme_general",
  "unmapped", "unmapped_topic", "unmapped topic",
  "unknown", "unknown topic", "misc", "miscellaneous",
  "other", "others",
]);

function cleanLabel(v) {
  const s = String(v || "").trim();
  return GENERIC_LABELS.has(s.toLowerCase()) ? "" : s;
}

function buildTopicGroups(questions) {
  const map = new Map();
  const UNGROUPED = "__ungrouped__";

  for (const q of questions) {
    const key =
      cleanLabel(q.microTheme) ||
      cleanLabel(q.subtopic) ||
      cleanLabel(q.themeLabel) ||
      UNGROUPED;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  }

  const groups = [...map.entries()]
    .filter(([key]) => key !== UNGROUPED)
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => b.items.length - a.items.length);

  // Append ungrouped questions at the end without a misleading label
  const ungrouped = map.get(UNGROUPED) || [];
  if (ungrouped.length) {
    groups.push({ topic: "Other Questions", items: ungrouped });
  }

  return groups;
}

function ActionButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active
          ? "1px solid rgba(96,165,250,0.50)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
        color: active ? "#dbeafe" : "#cbd5e1",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ModePill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 12,
        border: active
          ? "1px solid rgba(96,165,250,0.45)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(180deg, rgba(37,99,235,0.22) 0%, rgba(30,64,175,0.22) 100%)"
          : "rgba(255,255,255,0.04)",
        color: active ? "#eff6ff" : "#cbd5e1",
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: active ? "0 6px 18px rgba(37,99,235,0.16)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active
          ? "1px solid rgba(125,211,252,0.38)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active
          ? "rgba(14,165,233,0.16)"
          : "rgba(255,255,255,0.03)",
        color: active ? "#e0f2fe" : "#cbd5e1",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function renderOptionText(opt) {
  if (typeof opt === "string") return opt;
  if (opt == null) return "";
  return opt.text || opt.label || opt.value || String(opt);
}

function normalizeAnswerKey(answer) {
  if (answer == null) return "";
  const raw = String(answer).trim().toLowerCase();

  if (["a", "b", "c", "d"].includes(raw)) return raw;
  if (["1", "2", "3", "4"].includes(raw)) {
    return ["a", "b", "c", "d"][Number(raw) - 1] || "";
  }

  return raw;
}

function matchesReviewFilter(q, reviewFilter, answerVisibilityMap) {
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasAnswer = !!normalizeAnswerKey(q.answer);
  const isAnswerShown = !!answerVisibilityMap[q.id];

  switch (reviewFilter) {
    case "unread":
      return !q.isRead;
    case "read":
      return !!q.isRead;
    case "important":
      return !!q.isImportant;
    case "weak":
      return !!q.isWeak;
    case "with_options":
      return hasOptions;
    case "without_options":
      return !hasOptions;
    case "with_answer":
      return hasAnswer;
    case "without_answer":
      return !hasAnswer;
    case "answer_shown":
      return isAnswerShown;
    case "flagged":
      return !!q.isImportant || !!q.isWeak;
    default:
      return true;
  }
}

function QuestionCard({
  q,
  isAnswerShown = false,
  onSetAnswerShown,
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
}) {
  const answerKey = normalizeAnswerKey(q.answer);
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasAnswer = !!answerKey;

  function handleToggleAnswer() {
    onSetAnswerShown?.(q.id, !isAnswerShown);
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 18,
        padding: "18px 18px 16px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
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
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.14)",
            border: "1px solid rgba(96,165,250,0.24)",
            color: "#dbeafe",
          }}
        >
          {yearLabel(q.year)}
        </span>

        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
          }}
        >
          {paperLabel(q.paper)}
        </span>

        {q.questionNumber ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0",
            }}
          >
            Q{q.questionNumber}
          </span>
        ) : null}

        {cleanLabel(q.microTheme) ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(168,85,247,0.14)",
              border: "1px solid rgba(192,132,252,0.24)",
              color: "#f3e8ff",
              maxWidth: "100%",
            }}
          >
            {cleanLabel(q.microTheme).toUpperCase()}
          </span>
        ) : null}

        {!!q.isImportant ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(250,204,21,0.14)",
              border: "1px solid rgba(250,204,21,0.25)",
              color: "#fde68a",
            }}
          >
            IMPORTANT
          </span>
        ) : null}

        {!!q.isWeak ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.22)",
              color: "#fecaca",
            }}
          >
            REVISE
          </span>
        ) : null}

        {!!q.isRead ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.22)",
              color: "#bbf7d0",
            }}
          >
            READ
          </span>
        ) : null}
      </div>

      <div
        style={{
          fontSize: 16,
          lineHeight: 1.7,
          color: "#f8fafc",
          marginBottom: 14,
          whiteSpace: "pre-wrap",
        }}
      >
        {q.questionText}
      </div>

      {hasOptions ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {q.options.map((opt, idx) => {
            const optionLetter = String.fromCharCode(97 + idx);
            const isCorrect = isAnswerShown && answerKey === optionLetter;

            return (
              <div
                key={`${q.id}-opt-${idx}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: isCorrect
                    ? "rgba(16,185,129,0.14)"
                    : "rgba(255,255,255,0.03)",
                  border: isCorrect
                    ? "1px solid rgba(52,211,153,0.35)"
                    : "1px solid rgba(255,255,255,0.07)",
                  color: isCorrect ? "#ecfdf5" : "#dbe4f0",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                <span style={{ fontWeight: 700, color: "#ffffff" }}>
                  {String.fromCharCode(65 + idx)}.
                </span>{" "}
                {renderOptionText(opt)}
                {isCorrect ? (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#86efac",
                    }}
                  >
                    ✓ Correct
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {isAnswerShown && hasAnswer ? (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(52,211,153,0.22)",
            color: "#d1fae5",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Correct Answer: {answerKey.toUpperCase()}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <ActionButton
          active={q.isRead}
          onClick={() => onToggleRead(q.id)}
        >
          {q.isRead ? "Read ✓" : "Mark Read"}
        </ActionButton>

        <ActionButton
          active={q.isImportant}
          onClick={() => onToggleImportant(q.id)}
        >
          {q.isImportant ? "Important ★" : "Important"}
        </ActionButton>

        <ActionButton
          active={q.isWeak}
          onClick={() => onToggleWeak(q.id)}
        >
          {q.isWeak ? "Revise Later ↺" : "Revise Later"}
        </ActionButton>

        {hasAnswer ? (
          <ActionButton
            active={isAnswerShown}
            onClick={handleToggleAnswer}
          >
            {isAnswerShown ? "Hide Answer" : "Show Answer"}
          </ActionButton>
        ) : null}
      </div>

      {/* Ask ChatGPT — full-width prominent button, separate from action pills */}
      <button
        type="button"
        onClick={() => {
          const year = q.year ? String(q.year) : "";
          const paperRaw = String(q.paper || "").toLowerCase();
          const paperLabel = q.paper ? q.paper.charAt(0).toUpperCase() + q.paper.slice(1) : "";
          const subject = q.themeLabel || q.subtopic || q.microTheme || "";

          const optionLines = Array.isArray(q.options) && q.options.length
            ? q.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const val = typeof opt === "object" ? (opt.value ?? opt.text ?? "") : opt;
                return `  ${letter}. ${val}`;
              }).join("\n")
            : "";

          const answerLine = q.answer ? `Correct Answer: ${String(q.answer).toUpperCase()}` : "";

          const header = [
            `UPSC PYQ | ${paperLabel}${year ? ` | ${year}` : ""}${subject ? ` | ${subject}` : ""}`,
            "",
            "Question:",
            q.questionText || "",
            ...(optionLines ? ["", "Options:", optionLines] : []),
            ...(answerLine ? ["", answerLine] : []),
            "",
            "---",
            "",
          ].join("\n");

          const isMains = paperRaw === "mains" || paperRaw === "essay" || paperRaw === "ethics";

          const body = isMains
            ? [
                "You are an AIR-1 level UPSC CSE Mentor, Mains answer writing expert, and evaluator.",
                "",
                "Your role is NOT to just explain — but to TRAIN the aspirant to THINK, STRUCTURE, and WRITE like a UPSC topper under exam pressure.",
                "",
                "You must strictly follow UPSC standards (Laxmikanth, DD Basu, ARC, NCERT clarity, current affairs integration).",
                "",
                "---",
                "",
                "### 1. 🧠 CORE DEMAND BREAKDOWN",
                "- Subject + Micro-topic (exact syllabus node)",
                "- Static vs Dynamic components",
                "- Directive decoding (what exactly UPSC wants)",
                "- Hidden dimensions (what average aspirant misses)",
                "- Convert to: \"What exactly should I write to get 8+ marks?\"",
                "",
                "### 2. ⚙️ THINK LIKE A TOPPER (MENTAL FLOW)",
                "Simulate topper's brain in exam hall (30–40 seconds):",
                "- Step-by-step thinking flow",
                "- How they break the question and decide structure quickly",
                "- What they prioritize / ignore",
                "",
                "### 3. 🧱 PERFECT ANSWER STRUCTURE",
                "Give a ready-to-write framework:",
                "- Intro (2–3 variations: definition / data / committee / current affairs hook)",
                "- Body: dimension-wise structure (minimum 4–6 dimensions) with crisp 1-line UPSC sub-points",
                "- Conclusion: forward-looking + constitutional + balanced",
                "",
                "### 4. ✍️ MODEL ANSWER (150–250 WORDS)",
                "- UPSC-ready, structured, crisp, no fluff",
                "- Use keywords, committees, reports, examples",
                "",
                "### 5. 🧠 VALUE ADDITION",
                "- 5 must-use keywords",
                "- 2 committee / report references",
                "- 1 case study / example",
                "- 1 data point (if possible)",
                "- Diagram / flowchart suggestion (if applicable)",
                "",
                "### 6. ❌ COMMON MISTAKES",
                "- What NOT to write",
                "- Where aspirants go wrong",
                "- Typical traps in this question",
                "",
                "### 7. ⚡ MEMORY HOOK",
                "- Shortcut / mnemonic / structure to recall in exam",
                "",
                "### 8. 🔁 PYQ PATTERN LINKING",
                "- Similar PYQs asked before",
                "- How UPSC is repeating this theme",
                "- Probability of repetition",
                "",
                "---",
                "RULES: Be precise, not philosophical. Avoid generic content. Focus on marks maximization. Think like evaluator + mentor + topper combined.",
              ].join("\n")
            : [
                "You are a UPSC CSE Prelims expert mentor. Analyze this question and teach me how to solve it in the exam.",
                "",
                "1. What core concept is being tested?",
                "2. Why is the correct answer right?",
                "3. Eliminate each wrong option using UPSC prelims logic.",
                "4. How would a UPSC topper think through this under time pressure?",
                "5. Give one memory trick or exam shortcut for this concept.",
                "6. Does this pattern appear frequently in UPSC Prelims?",
                "",
                "Be accurate, concise, and exam-focused.",
              ].join("\n");

          const url = `https://chatgpt.com/?q=${encodeURIComponent(header + body)}`;
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "13px 20px",
          marginBottom: 10,
          borderRadius: 14,
          border: "1px solid rgba(16,185,129,0.40)",
          background: "linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(5,150,105,0.10) 100%)",
          color: "#6ee7b7",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.02em",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        Ask ChatGPT
      </button>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#cbd5e1",
          }}
        >
          {hasOptions ? `${q.options.length} options` : "No options"}
        </span>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: hasAnswer ? "#bbf7d0" : "#cbd5e1",
          }}
        >
          {hasAnswer ? "Answer available" : "Answer not available"}
        </span>
      </div>
    </div>
  );
}

export default function PyqQuickView({
  questions = [],
  total = 0,
  viewedCount = 0,
  timelineMode = "normal",
  setTimelineMode,
  selectedYear = "all",
  setSelectedYear,
  onToggleRead,
  onToggleWeak,
  onToggleImportant,
}) {
  const [reviewFilter, setReviewFilter] = useState("all");
  const [showMarkedOnly, setShowMarkedOnly] = useState(false);
  const [answerVisibilityMap, setAnswerVisibilityMap] = useState({});

  const timelineGroups = useMemo(() => buildTimelineGroups(questions), [questions]);
  const topicGroups = useMemo(() => buildTopicGroups(questions), [questions]);

  const stats = useMemo(() => {
    const totalVisible = questions.length;
    const read = questions.filter((q) => q.isRead).length;
    const unread = questions.filter((q) => !q.isRead).length;
    const important = questions.filter((q) => q.isImportant).length;
    const weak = questions.filter((q) => q.isWeak).length;
    const withOptions = questions.filter((q) => Array.isArray(q.options) && q.options.length > 0).length;
    const withAnswer = questions.filter((q) => !!normalizeAnswerKey(q.answer)).length;
    const answersShown = questions.filter((q) => !!answerVisibilityMap[q.id]).length;

    return {
      totalVisible,
      read,
      unread,
      important,
      weak,
      withOptions,
      withAnswer,
      answersShown,
      flagged: questions.filter((q) => q.isImportant || q.isWeak).length,
    };
  }, [questions, answerVisibilityMap]);

  const reviewFilteredQuestions = useMemo(() => {
    let items = [...questions];

    if (showMarkedOnly) {
      items = items.filter((q) => q.isImportant || q.isWeak);
    }

    items = items.filter((q) => matchesReviewFilter(q, reviewFilter, answerVisibilityMap));

    return items;
  }, [questions, reviewFilter, showMarkedOnly, answerVisibilityMap]);

  const filteredTimelineGroups = useMemo(
    () => buildTimelineGroups(reviewFilteredQuestions),
    [reviewFilteredQuestions]
  );

  const filteredTopicGroups = useMemo(
    () => buildTopicGroups(reviewFilteredQuestions),
    [reviewFilteredQuestions]
  );

  function handleSetAnswerShown(questionId, nextValue) {
    setAnswerVisibilityMap((prev) => ({
      ...prev,
      [questionId]: nextValue,
    }));
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 20,
          padding: "18px 18px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(180,205,255,0.72)",
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              Quick View
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              {reviewFilteredQuestions.length} visible questions
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 4,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ModePill
                active={timelineMode === "normal"}
                onClick={() => setTimelineMode?.("normal")}
              >
                Flat
              </ModePill>

              <ModePill
                active={timelineMode === "timeline"}
                onClick={() => setTimelineMode?.("timeline")}
              >
                Timeline
              </ModePill>

              <ModePill
                active={timelineMode === "topic"}
                onClick={() => setTimelineMode?.("topic")}
              >
                By Topic
              </ModePill>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                fontSize: 14,
                color: "#cbd5e1",
              }}
            >
              Viewed <strong style={{ color: "#fff" }}>{viewedCount}</strong> / {questions.length}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#cbd5e1",
              }}
            >
              Total in topic: <strong style={{ color: "#fff" }}>{total}</strong>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Visible now</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {reviewFilteredQuestions.length}
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Read</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.read}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Unread</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.unread}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Important</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.important}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Revise later</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.weak}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>With answers</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{stats.withAnswer}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <FilterPill active={reviewFilter === "all"} onClick={() => setReviewFilter("all")}>
            All
          </FilterPill>
          <FilterPill active={reviewFilter === "unread"} onClick={() => setReviewFilter("unread")}>
            Unread
          </FilterPill>
          <FilterPill active={reviewFilter === "read"} onClick={() => setReviewFilter("read")}>
            Read
          </FilterPill>
          <FilterPill active={reviewFilter === "important"} onClick={() => setReviewFilter("important")}>
            Important
          </FilterPill>
          <FilterPill active={reviewFilter === "weak"} onClick={() => setReviewFilter("weak")}>
            Revise Later
          </FilterPill>
          <FilterPill active={reviewFilter === "flagged"} onClick={() => setReviewFilter("flagged")}>
            Flagged
          </FilterPill>
          <FilterPill active={reviewFilter === "with_options"} onClick={() => setReviewFilter("with_options")}>
            With Options
          </FilterPill>
          <FilterPill active={reviewFilter === "with_answer"} onClick={() => setReviewFilter("with_answer")}>
            With Answers
          </FilterPill>
          <FilterPill active={reviewFilter === "without_answer"} onClick={() => setReviewFilter("without_answer")}>
            No Answers
          </FilterPill>
          <FilterPill active={reviewFilter === "answer_shown"} onClick={() => setReviewFilter("answer_shown")}>
            Answer Shown
          </FilterPill>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <FilterPill
            active={showMarkedOnly}
            onClick={() => setShowMarkedOnly((prev) => !prev)}
          >
            {showMarkedOnly ? "Review Marked Only ✓" : "Review Marked Only"}
          </FilterPill>

          {timelineMode === "timeline" ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedYear?.("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background:
                    selectedYear === "all"
                      ? "rgba(59,130,246,0.18)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    selectedYear === "all"
                      ? "1px solid rgba(96,165,250,0.35)"
                      : "1px solid rgba(255,255,255,0.10)",
                  fontSize: 12,
                  color: selectedYear === "all" ? "#eff6ff" : "#cbd5e1",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                All Years
              </button>

              {timelineGroups.map((group) => (
                <button
                  type="button"
                  key={group.label}
                  onClick={() => setSelectedYear?.(group.year)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background:
                      Number(selectedYear) === Number(group.year)
                        ? "rgba(59,130,246,0.18)"
                        : "rgba(59,130,246,0.08)",
                    border:
                      Number(selectedYear) === Number(group.year)
                        ? "1px solid rgba(96,165,250,0.35)"
                        : "1px solid rgba(96,165,250,0.18)",
                    fontSize: 12,
                    color: "#dbeafe",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {group.label} ({group.items.length})
                </button>
              ))}
            </>
          ) : timelineMode === "topic" ? (
            <>
              {topicGroups.map((group) => (
                <div
                  key={group.topic}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(168,85,247,0.10)",
                    border: "1px solid rgba(192,132,252,0.20)",
                    fontSize: 12,
                    color: "#f3e8ff",
                    fontWeight: 700,
                  }}
                >
                  {group.topic} ({group.items.length})
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>

      {reviewFilteredQuestions.length === 0 ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 18,
            padding: "24px",
            color: "#cbd5e1",
            fontSize: 16,
          }}
        >
          No questions match the current review filters.
        </div>
      ) : timelineMode === "timeline" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredTimelineGroups.map((group) => (
            <section
              key={group.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(18,30,60,0.92) 0%, rgba(11,20,40,0.92) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {group.label}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                  }}
                >
                  {group.items.length} question{group.items.length > 1 ? "s" : ""}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {group.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    isAnswerShown={!!answerVisibilityMap[q.id]}
                    onSetAnswerShown={handleSetAnswerShown}
                    onToggleRead={onToggleRead}
                    onToggleWeak={onToggleWeak}
                    onToggleImportant={onToggleImportant}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : timelineMode === "topic" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredTopicGroups.map((group) => (
            <section
              key={group.topic}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(18,30,60,0.92) 0%, rgba(11,20,40,0.92) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {group.topic}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                  }}
                >
                  {group.items.length} question{group.items.length > 1 ? "s" : ""}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {group.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    isAnswerShown={!!answerVisibilityMap[q.id]}
                    onSetAnswerShown={handleSetAnswerShown}
                    onToggleRead={onToggleRead}
                    onToggleWeak={onToggleWeak}
                    onToggleImportant={onToggleImportant}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {reviewFilteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              isAnswerShown={!!answerVisibilityMap[q.id]}
              onSetAnswerShown={handleSetAnswerShown}
              onToggleRead={onToggleRead}
              onToggleWeak={onToggleWeak}
              onToggleImportant={onToggleImportant}
            />
          ))}
        </div>
      )}
    </div>
  );
}