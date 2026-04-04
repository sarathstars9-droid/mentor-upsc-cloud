import { useState, useMemo, useCallback } from "react";
import { buildMistakeExplanationPrompt } from "../utils/buildMistakeExplanationPrompt";
import { openChatGptForMistake } from "../utils/openChatGptForMistake";
import { MistakeBookReviewDrawer } from "../components/MistakeBookReviewDrawer";

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

  // source badge colors
  sourcePyq:           "#38bdf8",  // sky blue
  sourcePyqBg:         "rgba(56,189,248,0.1)",
  sourceInstitutional: "#a78bfa",  // violet
  sourceInstBg:        "rgba(167,139,250,0.1)",
};

const s = {
  page: {
    minHeight: "100vh",
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: C.fontSans,
    paddingBottom: "48px",
  },

  /* ── Header ── */
  header: {
    padding: "28px 20px 24px",
    borderBottom: `1px solid ${C.border}`,
    marginBottom: "20px",
  },
  eyebrow: {
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: C.orange,
    marginBottom: "8px",
  },
  dot: {
    color: C.textMuted,
    margin: "0 6px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "800",
    color: C.text,
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  subtitle: {
    fontSize: "14px",
    color: C.textDim,
    margin: 0,
  },

  /* ── Controls ── */
  controls: {
    padding: "0 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  controlRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  controlLabel: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: C.textMuted,
  },
  select: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: C.text,
    fontFamily: C.fontMono,
    cursor: "pointer",
    outline: "none",
    letterSpacing: "0.5px",
  },
  searchInput: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: C.text,
    fontFamily: C.fontSans,
    outline: "none",
    letterSpacing: "0.5px",
    minWidth: "220px",
    flex: 1,
  },
  countPill: {
    marginLeft: "auto",
    alignSelf: "flex-end",
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "20px",
    padding: "5px 14px",
    fontFamily: C.fontMono,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: C.orange,
  },

  /* ── List ── */
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "0 20px",
  },

  /* ── Card ── */
  card: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "12px",
    overflow: "hidden",
  },
  cardAccent: {
    height: "2px",
    backgroundColor: C.orange,
    opacity: 0.6,
  },
  cardBody: {
    padding: "16px 18px 12px",
  },
  cardCompactBody: {
    padding: "14px 18px",
  },
  questionText: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: C.text,
    margin: "0 0 12px",
  },
  questionPreview: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: C.textDim,
    margin: "6px 0 8px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  compactHeader: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  compactMeta: {
    display: "flex",
    gap: "16px",
    fontSize: "12px",
    color: C.textMuted,
    marginBottom: "8px",
  },
  compactAnswers: {
    display: "flex",
    gap: "16px",
    fontSize: "12px",
    marginBottom: "10px",
  },
  compactAnswerItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  metaText: {
    fontSize: "12px",
    color: C.textMuted,
    margin: "0 0 10px",
    opacity: 0.8,
  },
  tagRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  tag: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    backgroundColor: "#1e1e2a",
    border: `1px solid ${C.border}`,
    color: C.textDim,
    padding: "3px 9px",
    borderRadius: "5px",
  },
  tagSource: {
    color: C.orange,
    borderColor: C.orangeDim,
    backgroundColor: "#1e180a",
  },
  cardFooter: {
    borderTop: `1px solid ${C.border}`,
    padding: "10px 18px",
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
    backgroundColor: "#121218",
  },
  cardCompactFooter: {
    borderTop: `1px solid ${C.border}`,
    padding: "10px 18px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    backgroundColor: "#121218",
  },
  answerBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  answerLabel: {
    fontFamily: C.fontMono,
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: C.textMuted,
  },
  answerValue: {
    fontFamily: C.fontMono,
    fontSize: "15px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  compactButton: {
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "5px 12px",
    borderRadius: "6px",
    border: "1px solid",
    cursor: "pointer",
    outline: "none",
    transition: "all 0.2s",
  },
  compactButtonReview: {
    background: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.3)",
    color: "#fbbf24",
  },
  compactButtonAsk: {
    background: "rgba(16,163,127,0.12)",
    borderColor: "rgba(16,163,127,0.35)",
    color: "#10a37f",
  },

  /* ── Empty ── */
  empty: {
    textAlign: "center",
    padding: "72px 24px",
  },
  emptyIcon: {
    fontSize: "36px",
    marginBottom: "14px",
  },
  emptyTitle: {
    fontFamily: C.fontMono,
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: C.textDim,
    margin: "0 0 8px",
  },
  emptyText: {
    fontSize: "13px",
    color: C.textMuted,
    margin: 0,
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
function MistakeCard({ mistake, isExpanded, onExpand, onCollapse }) {
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
    createdAt,
    firstSeenAt,
    latestResult,
    result,
  } = mistake;

  const displayAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
  const displayResult = latestResult || result;
  // Primary: trust the result field from the engine.
  // Fallback: if no result field at all AND no answer → treat as unattempted.
  const isUnattempted =
    displayResult === "unattempted" ||
    (!displayResult && displayAnswer == null);
  const displayDate = createdAt || firstSeenAt;

  const normalizedSource = (!sourceType || sourceType === "pyq" || sourceType.startsWith("topic") || sourceType.startsWith("sectional") || sourceType === "full_length")
    ? "pyq"
    : "institutional";
  const isPyq = normalizedSource === "pyq";
  const sourceBadgeLabel = isPyq ? "PYQ" : "Institutional";
  const sourceBadgeColor = isPyq ? C.sourcePyq : C.sourceInstitutional;
  const sourceBadgeBg = isPyq ? C.sourcePyqBg : C.sourceInstBg;

  const paperDisplay = paperType || paper || "GS";

  const [chatMsg, setChatMsg] = useState("");

  const handleAskChatGpt = useCallback(async () => {
    const prompt = buildMistakeExplanationPrompt(mistake);
    const { message } = await openChatGptForMistake(prompt);
    setChatMsg(message);
    setTimeout(() => setChatMsg(""), 5000);
  }, [mistake]);

  if (isExpanded) {
    // EXPANDED STATE: Show rich review
    return (
      <div style={s.card}>
        <div style={s.cardAccent} />
        <div style={s.cardBody}>
          <p style={s.questionText}>{questionText || "Question content not available"}</p>
          <p style={s.metaText}>
            Added on {formatMistakeDate(displayDate)}
          </p>
          <div style={s.tagRow}>
            {subject && <span style={s.tag}>{subject}</span>}
            {topic && <span style={s.tag}>{topic}</span>}
            <span style={{
              ...s.tag,
              color: sourceBadgeColor,
              backgroundColor: sourceBadgeBg,
              borderColor: sourceBadgeColor + "55",
            }}>
              {sourceBadgeLabel}
            </span>
            <span style={{
              ...s.tag,
              color: paperDisplay === "CSAT" ? "#60a5fa" : "#fbbf24",
              backgroundColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)",
              borderColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.3)" : "rgba(251,191,36,0.3)",
            }}>
              {paperDisplay}
            </span>
          </div>
        </div>

        {/* Rich Review Drawer */}
        <MistakeBookReviewDrawer 
          mistake={mistake} 
          onClose={onCollapse}
        />
      </div>
    );
  }

  // COMPACT STATE: Minimal card
  return (
    <div style={s.card}>
      <div style={s.cardAccent} />
      <div style={s.cardCompactBody}>
        {/* Header: badges */}
        <div style={s.compactHeader}>
          <span style={{
            ...s.tag,
            color: sourceBadgeColor,
            backgroundColor: sourceBadgeBg,
            borderColor: sourceBadgeColor + "55",
          }}>
            {sourceBadgeLabel}
          </span>
          <span style={{
            ...s.tag,
            color: paperDisplay === "CSAT" ? "#60a5fa" : "#fbbf24",
            backgroundColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)",
            borderColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.3)" : "rgba(251,191,36,0.3)",
          }}>
            {paperDisplay}
          </span>
          {subject && <span style={s.tag}>{subject}</span>}
          
          {/* Result badge on the right */}
          <span style={{
            ...s.tag,
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
            {displayResult === "wrong" ? "✗" : displayResult === "unattempted" ? "⊘" : "✓"}
          </span>
        </div>

        {/* Question preview + metadata */}
        <div style={s.compactMeta}>
          {questionNumber && <span>Q.{questionNumber}</span>}
          <span>{formatMistakeDate(displayDate)}</span>
        </div>

        {/* Question preview (2 lines max) */}
        {questionText && (
          <p style={s.questionPreview}>{questionText}</p>
        )}

        {/* Answers */}
        <div style={s.compactAnswers}>
          <div style={s.compactAnswerItem}>
            <span style={{ fontWeight: 700, color: C.textMuted }}>Your:</span>
            <span style={{
              color: isUnattempted ? C.textMuted : C.red,
              fontWeight: 700,
              fontFamily: C.fontMono,
            }}>
              {isUnattempted
                ? "Unattempted"
                : displayAnswer != null && displayAnswer !== ""
                  ? displayAnswer
                  : "—"}
            </span>
          </div>
          <div style={s.compactAnswerItem}>
            <span style={{ fontWeight: 700, color: C.textMuted }}>Correct:</span>
            <span style={{
              color: C.green,
              fontWeight: 700,
              fontFamily: C.fontMono,
            }}>
              {correctAnswer || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Compact footer: buttons only */}
      <div style={s.cardCompactFooter}>
        <button
          type="button"
          onClick={onExpand}
          style={{
            ...s.compactButton,
            ...s.compactButtonReview,
          }}
        >
          Review
        </button>

        <button
          type="button"
          onClick={handleAskChatGpt}
          style={{
            ...s.compactButton,
            ...s.compactButtonAsk,
          }}
        >
          Ask ChatGPT
        </button>

        {chatMsg && (
          <span style={{
            fontSize: "10px",
            color: "#10a37f",
            fontFamily: C.fontMono,
            marginLeft: "auto",
            whiteSpace: "nowrap",
          }}>
            {chatMsg}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MistakeBookPage() {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sourceFilter, setSourceFilter]  = useState("all");  // "all" | "pyq" | "institutional"
  const [paperFilter, setPaperFilter]    = useState("all");  // "all" | "GS" | "CSAT"
  const [resultFilter, setResultFilter]  = useState("all");  // "all" | "wrong" | "unattempted"
  const [searchText, setSearchText]      = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [openMistakeId, setOpenMistakeId] = useState(null);  // Track which card is expanded

  const allMistakes = useMemo(() => {
    try {
      const raw = localStorage.getItem("prelims_mistakes");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const subjects = useMemo(() => {
    const map = new Map();

    allMistakes.forEach((m) => {
      if (!m.subject) return;
      const key = m.subject.toLowerCase();
      if (!map.has(key)) {
        map.set(key, m.subject);
      }
    });

    return ["all", ...Array.from(map.values()).sort()];
  }, [allMistakes]);

  const papers = useMemo(() => {
    const set = new Set();
    allMistakes.forEach((m) => {
      const paperType = m.paperType || m.paper || "GS";
      set.add(paperType);
    });
    return ["all", ...Array.from(set).sort()];
  }, [allMistakes]);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs   = toDate   ? new Date(toDate + "T23:59:59").getTime() : null;
    const searchLower = searchText.toLowerCase();

    return allMistakes
      .filter((m) => {
        // Subject filter
        if (subjectFilter !== "all") {
          const mSubject = (m.subject || "").toLowerCase();
          if (mSubject !== subjectFilter.toLowerCase()) return false;
        }

        // Source filter
        if (sourceFilter !== "all") {
          const raw = (m.sourceType || "").toLowerCase();
          const isInstitutional = raw === "institutional";
          const isPyq = !isInstitutional;
          if (sourceFilter === "pyq"           && !isPyq)           return false;
          if (sourceFilter === "institutional" && !isInstitutional) return false;
        }

        // Paper filter
        if (paperFilter !== "all") {
          const paperType = (m.paperType || m.paper || "GS").toUpperCase();
          if (paperType !== paperFilter.toUpperCase()) return false;
        }

        // Result filter
        if (resultFilter !== "all") {
          const mResult = (m.latestResult || m.result || "").toLowerCase();
          const isUnattempted = mResult === "unattempted" || (!m.latestUserAnswer && !m.userAnswer && !mResult);
          
          if (resultFilter === "wrong" && (mResult !== "wrong" || isUnattempted)) return false;
          if (resultFilter === "unattempted" && !isUnattempted) return false;
        }

        // Search filter — search against questionText, subject, topic, questionNumber
        if (searchLower) {
          const questionText = (m.questionText || "").toLowerCase();
          const subject = (m.subject || "").toLowerCase();
          const topic = (m.topic || "").toLowerCase();
          const qNum = String(m.questionNumber || "").toLowerCase();
          
          const matches = questionText.includes(searchLower) ||
                         subject.includes(searchLower) ||
                         topic.includes(searchLower) ||
                         qNum.includes(searchLower);
          
          if (!matches) return false;
        }

        // Date range filter
        if (fromTs || toTs) {
          const ts = m.createdAt
            ? new Date(m.createdAt).getTime()
            : (m.firstSeenAt ? new Date(m.firstSeenAt).getTime() : null);
          if (!ts) return !fromTs;
          if (fromTs && ts < fromTs) return false;
          if (toTs   && ts > toTs)   return false;
        }

        return true;
      })
      .slice()
      .sort((a, b) => {
        const aTs = a.createdAt || a.firstSeenAt || 0;
        const bTs = b.createdAt || b.firstSeenAt || 0;
        return new Date(bTs) - new Date(aTs);
      });
  }, [allMistakes, subjectFilter, sourceFilter, paperFilter, resultFilter, searchText, fromDate, toDate]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.eyebrow}>
          REVIEW<span style={s.dot}>•</span>MISTAKE BOOK
        </div>
        <h1 style={s.title}>Mistake Book</h1>
        <p style={s.subtitle}>Track wrong answers. Spot patterns. Fix weak spots.</p>
      </div>

      <div style={s.controls}>
        {/* Row 1: dropdowns + count pill */}
        <div style={s.controlRow}>
          <div style={s.controlGroup}>
            <span style={s.controlLabel}>Subject</span>
            <select style={s.select} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>{sub === "all" ? "All Subjects" : sub}</option>
              ))}
            </select>
          </div>

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>Source</span>
            <select style={s.select} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All Sources</option>
              <option value="pyq">PYQ</option>
              <option value="institutional">Institutional</option>
            </select>
          </div>

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>Paper</span>
            <select style={s.select} value={paperFilter} onChange={(e) => setPaperFilter(e.target.value)}>
              {papers.map((paper) => (
                <option key={paper} value={paper}>{paper === "all" ? "All Papers" : paper}</option>
              ))}
            </select>
          </div>

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>Result</span>
            <select style={s.select} value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
              <option value="all">All Results</option>
              <option value="wrong">Wrong</option>
              <option value="unattempted">Unattempted</option>
            </select>
          </div>

          <span style={s.countPill}>
            {filtered.length} {filtered.length === 1 ? "MISTAKE" : "MISTAKES"}
          </span>
        </div>

        {/* Row 2: search + date range + clear */}
        <div style={s.controlRow}>
          <div style={{ ...s.controlGroup, flex: 1, minWidth: 200 }}>
            <span style={s.controlLabel}>Search</span>
            <input
              type="text"
              style={s.searchInput}
              placeholder="Search questions..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>From</span>
            <input type="date" style={s.select} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>To</span>
            <input type="date" style={s.select} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          {(fromDate || toDate || searchText) && (
            <button
              type="button"
              onClick={() => { setFromDate(""); setToDate(""); setSearchText(""); }}
              style={{
                ...s.select,
                alignSelf: "flex-end",
                cursor: "pointer",
                color: C.orange,
                border: `1px solid ${C.orangeDim}`,
                background: "#1e180a",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📘</div>
          <p style={s.emptyTitle}>No Mistakes Found</p>
          <p style={s.emptyText}>
            {subjectFilter !== "all" || sourceFilter !== "all" || paperFilter !== "all" || resultFilter !== "all" || searchText
              ? "Try adjusting your filters"
              : "Attempt questions to start building your mistake log"}
          </p>
        </div>
      ) : (
        <div style={s.list}>
          {filtered.map((mistake, i) => (
            <MistakeCard
              key={mistake.questionId || i}
              mistake={mistake}
              isExpanded={openMistakeId === mistake.questionId}
              onExpand={() => setOpenMistakeId(mistake.questionId)}
              onCollapse={() => setOpenMistakeId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
