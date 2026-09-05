import { useState, useMemo, useCallback, useEffect } from "react";
import { buildMistakeExplanationPrompt } from "../utils/buildMistakeExplanationPrompt";
import { openChatGptForMistake } from "../utils/openChatGptForMistake";
import { MistakeBookReviewDrawer } from "../components/MistakeBookReviewDrawer";
import { BACKEND_URL } from "../config";
import {
  getMistakeDiagnosisLabel,
  getMistakeSourceGroup,
  getMistakeSourceLabel,
  getReviewStatusLabel,
  normalizeMistakeDiagnosis,
  normalizeMistakeResult,
  normalizeReviewStatus,
} from "../utils/mistakeBookNormalization";

const DEFAULT_USER_ID = "user_1";

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
  sourcePyq: "#38bdf8",  // sky blue
  sourcePyqBg: "rgba(56,189,248,0.1)",
  sourceInstitutional: "#a78bfa",  // violet
  sourceInstBg: "rgba(167,139,250,0.1)",
  blue: "#60a5fa",
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
  intelligence: {
    padding: "0 20px 18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  intelligencePanel: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "14px",
    minWidth: 0,
  },
  panelTitle: {
    margin: "0 0 6px",
    fontSize: "13px",
    fontWeight: 800,
    color: C.text,
  },
  panelText: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.5,
    color: C.textDim,
  },
  statRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  statPill: {
    border: `1px solid ${C.border}`,
    borderRadius: "6px",
    padding: "6px 8px",
    fontFamily: C.fontMono,
    fontSize: "10px",
    color: C.textDim,
    backgroundColor: "#121218",
  },
  fixList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
  },
  fixButton: {
    width: "100%",
    textAlign: "left",
    background: "#121218",
    border: `1px solid ${C.border}`,
    borderRadius: "6px",
    padding: "8px 10px",
    color: C.text,
    cursor: "pointer",
  },
  fixMeta: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "5px",
    fontFamily: C.fontMono,
    fontSize: "10px",
    color: C.textMuted,
  },
  quickTabs: {
    padding: "0 20px 14px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  quickTab: {
    border: `1px solid ${C.border}`,
    borderRadius: "7px",
    padding: "7px 10px",
    fontFamily: C.fontMono,
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    background: C.surface,
    color: C.textDim,
    cursor: "pointer",
  },
  quickTabActive: {
    color: C.orange,
    borderColor: C.orangeDim,
    background: "#1e180a",
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
  compactEvidence: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
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

const reviewPriority = {
  retest_due: 0,
  new: 1,
  reviewed: 2,
};

function MistakeCard({ mistake, isExpanded, onExpand, onCollapse, onRefresh }) {
  const {
    questionText,
    latestUserAnswer,
    userAnswer,
    correctAnswer,
    subject,
    sourceType,
    paperType,
    paper,
    questionNumber,
    createdAt,
    firstSeenAt,
    latestResult,
    result,
    errorType,
    reviewStatus,
  } = mistake;

  const displayAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
  const displayResult = normalizeMistakeResult(latestResult || result);
  // Primary: trust the result field from the engine.
  // Fallback: if no result field at all AND no answer → treat as unattempted.
  const isUnattempted =
    displayResult === "unattempted" ||
    (!displayResult && displayAnswer == null);
  const displayDate = createdAt || firstSeenAt;

  const sourceGroup = getMistakeSourceGroup(sourceType);
  const sourceBadgeLabel = getMistakeSourceLabel(sourceType);
  const sourceBadgeColor =
    sourceGroup === "pyq" ? C.sourcePyq
      : sourceGroup === "institutional" ? C.sourceInstitutional
        : C.textDim;
  const sourceBadgeBg =
    sourceGroup === "pyq" ? C.sourcePyqBg
      : sourceGroup === "institutional" ? C.sourceInstBg
        : "rgba(152,152,168,0.1)";

  const paperDisplay = paperType || paper || "GS";
  const diagnosis = normalizeMistakeDiagnosis(errorType || mistake.error_type);
  const diagnosisLabel = getMistakeDiagnosisLabel(diagnosis);
  const lifecycle = normalizeReviewStatus(reviewStatus || mistake.review_status);
  const lifecycleLabel = getReviewStatusLabel(lifecycle);
  const evidence = mistake.evidence || {};
  const masteryStatus = mistake.masteryStatus || evidence.masteryStatus || "unverified";
  const masteryLabel =
    masteryStatus === "mastered" ? "Mastered"
      : masteryStatus === "verify_again" ? "Verify Again"
        : "Needs Evidence";

  const [chatMsg, setChatMsg] = useState("");

  const handleAskChatGpt = useCallback(async () => {
    const prompt = buildMistakeExplanationPrompt({ ...mistake, errorType: diagnosis });
    const { message } = await openChatGptForMistake(prompt);
    setChatMsg(message);
    setTimeout(() => setChatMsg(""), 5000);
  }, [mistake, diagnosis]);

  if (isExpanded) {
    return (
      <div style={s.card}>
        <div style={s.cardAccent} />
        <MistakeBookReviewDrawer
          mistake={mistake}
          onClose={onCollapse}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  // COMPACT STATE: Minimal card
  return (
    <div style={s.card}>
      <div style={s.cardAccent} />
      <div style={s.cardCompactBody}>
        <div style={s.compactHeader}>
          {subject && <span style={s.tag}>{subject}</span>}
          <span style={{
            ...s.tag,
            color: paperDisplay === "CSAT" ? C.blue : "#fbbf24",
            backgroundColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)",
            borderColor: paperDisplay === "CSAT" ? "rgba(96,165,250,0.3)" : "rgba(251,191,36,0.3)",
          }}>
            {paperDisplay}
          </span>
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

        <div style={s.tagRow}>
          <span style={{
            ...s.tag,
            color: C.orange,
            backgroundColor: "rgba(245,166,35,0.08)",
            borderColor: "rgba(245,166,35,0.25)",
          }}>
            {diagnosisLabel}
          </span>
          <span style={{
            ...s.tag,
            color: lifecycle === "retest_due" ? "#60a5fa" : lifecycle === "reviewed" ? C.green : C.textDim,
            backgroundColor:
              lifecycle === "retest_due" ? "rgba(96,165,250,0.1)"
                : lifecycle === "reviewed" ? "rgba(76,175,125,0.1)"
                  : "rgba(152,152,168,0.08)",
            borderColor:
              lifecycle === "retest_due" ? "rgba(96,165,250,0.3)"
                : lifecycle === "reviewed" ? "rgba(76,175,125,0.3)"
                  : "rgba(152,152,168,0.2)",
          }}>
            {lifecycleLabel}
          </span>
          {evidence.isRepeatedError && (
            <span style={{
              ...s.tag,
              color: C.red,
              backgroundColor: "rgba(224,82,82,0.1)",
              borderColor: "rgba(224,82,82,0.3)",
            }}>
              Repeated
            </span>
          )}
          {masteryStatus !== "unverified" && (
            <span style={{
              ...s.tag,
              color: masteryStatus === "mastered" ? C.green : "#60a5fa",
              backgroundColor: masteryStatus === "mastered" ? "rgba(76,175,125,0.1)" : "rgba(96,165,250,0.1)",
              borderColor: masteryStatus === "mastered" ? "rgba(76,175,125,0.3)" : "rgba(96,165,250,0.3)",
            }}>
              {masteryLabel}
            </span>
          )}
        </div>

        <div style={s.compactEvidence}>
          <span style={s.statPill}>{evidence.recordedAttempts || 0} RECORDED</span>
          <span style={s.statPill}>{evidence.failureCount || 0} FAILURES</span>
          <span style={s.statPill}>{evidence.retestCount || 0} RETESTS</span>
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
          Fix Mistake
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
  const [sourceFilter, setSourceFilter] = useState("all");  // "all" | "pyq" | "institutional"
  const [paperFilter, setPaperFilter] = useState("all");  // "all" | "GS" | "CSAT"
  const [resultFilter, setResultFilter] = useState("all");  // "all" | "wrong" | "unattempted"
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openMistakeId, setOpenMistakeId] = useState(null);  // Track which card is expanded
  const [quickView, setQuickView] = useState("priority");

  const [allMistakes, setAllMistakes] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMistakes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userId = encodeURIComponent(DEFAULT_USER_ID);
      const [res, intelligenceRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/mistakes?userId=${userId}&stage=prelims`, {
          cache: "no-store",
        }),
        fetch(`${BACKEND_URL}/api/mistakes/intelligence?userId=${userId}&stage=prelims`, {
          cache: "no-store",
        }),
      ]);
      const data = await res.json();
      const intelligenceData = await intelligenceRes.json();

      if (!Array.isArray(data)) {
        console.warn("[MistakeBook] Unexpected response", data);
        setAllMistakes([]);
        return;
      }

      const intelligenceByMistakeId = new Map(
        (intelligenceData?.mistakes || []).map((m) => [String(m.id), m])
      );

      const normalized = data.map((m) => ({
        ...m,
        ...(intelligenceByMistakeId.get(String(m.id)) || {}),
        questionText: m.question_text,
        latestUserAnswer: m.selected_answer,
        correctAnswer: m.correct_answer,
        latestResult: normalizeMistakeResult(m.answer_status),
        errorType: normalizeMistakeDiagnosis(m.error_type),
        reviewStatus: normalizeReviewStatus(m.review_status),
        reviewedAt: m.reviewed_at,
        sourceType: m.source_type,
        nodeId: m.node_id,
        createdAt: m.created_at,
        subject: m.subject || "",
        topic: m.topic || "",
        questionId: m.question_id || m.id,
        paper: m.paper || "GS",
      }));

      setIntelligence(intelligenceData?.success ? intelligenceData : null);
      setAllMistakes(normalized);
    } catch (err) {
      console.error("[MistakeBook] Fetch failed", err);
      setIntelligence(null);
      setAllMistakes([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

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

  const priorityIds = useMemo(() => {
    return new Set((intelligence?.todaysFix?.mistakes || []).map((m) => String(m.id)));
  }, [intelligence]);

  const quickTabs = useMemo(() => {
    const totals = intelligence?.totals || {};
    return [
      { id: "priority", label: "Priority", count: intelligence?.todaysFix?.mistakes?.length || 0 },
      { id: "retest_due", label: "Retest Due", count: totals.retestDue || 0 },
      { id: "repeated", label: "Repeated", count: totals.repeatedErrors || 0 },
      { id: "verify_again", label: "Verify Again", count: totals.verifyAgain || 0 },
      { id: "new", label: "New", count: totals.newMistakes || 0 },
      { id: "mastered", label: "Mastered", count: totals.mastered || 0 },
      { id: "all", label: "All", count: allMistakes.length },
    ];
  }, [allMistakes.length, intelligence]);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    const searchLower = searchText.toLowerCase();

    return allMistakes
      .filter((m) => {
        const evidence = m.evidence || {};
        const masteryStatus = m.masteryStatus || evidence.masteryStatus || "unverified";
        const lifecycle = normalizeReviewStatus(m.reviewStatus || m.review_status);

        if (quickView === "priority" && !priorityIds.has(String(m.id))) return false;
        if (quickView === "retest_due" && lifecycle !== "retest_due") return false;
        if (quickView === "repeated" && !evidence.isRepeatedError) return false;
        if (quickView === "verify_again" && masteryStatus !== "verify_again") return false;
        if (quickView === "new" && lifecycle !== "new") return false;
        if (quickView === "mastered" && masteryStatus !== "mastered") return false;
        if (quickView !== "mastered" && quickView !== "all" && masteryStatus === "mastered") return false;

        // Subject filter
        if (subjectFilter !== "all") {
          const mSubject = (m.subject || "").toLowerCase();
          if (mSubject !== subjectFilter.toLowerCase()) return false;
        }

        // Source filter
        if (sourceFilter !== "all") {
          const sourceGroup = getMistakeSourceGroup(m.sourceType);
          if (sourceGroup !== sourceFilter) return false;
        }

        // Paper filter
        if (paperFilter !== "all") {
          const paperType = (m.paperType || m.paper || "GS").toUpperCase();
          if (paperType !== paperFilter.toUpperCase()) return false;
        }

        // Result filter
        if (resultFilter !== "all") {
          const mResult = normalizeMistakeResult(m.latestResult || m.result);
          const isUnattempted = mResult === "unattempted" || (!m.latestUserAnswer && !m.userAnswer && !mResult);

          if (resultFilter === "wrong" && (mResult !== "wrong" || isUnattempted)) return false;
          if (resultFilter === "unattempted" && !isUnattempted) return false;
        }

        if (lifecycleFilter !== "all") {
          const lifecycle = normalizeReviewStatus(m.reviewStatus || m.review_status);
          if (lifecycle !== lifecycleFilter) return false;
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
          if (toTs && ts > toTs) return false;
        }

        return true;
      })
      .slice()
      .sort((a, b) => {
        if (quickView === "priority") {
          const aPriority = a.priorityGroup || 99;
          const bPriority = b.priorityGroup || 99;
          if (aPriority !== bPriority) return aPriority - bPriority;
          const aFailures = a.evidence?.failureCount || 0;
          const bFailures = b.evidence?.failureCount || 0;
          if (aFailures !== bFailures) return bFailures - aFailures;
        }
        const aLifecycle = normalizeReviewStatus(a.reviewStatus || a.review_status);
        const bLifecycle = normalizeReviewStatus(b.reviewStatus || b.review_status);
        const byLifecycle = reviewPriority[aLifecycle] - reviewPriority[bLifecycle];
        if (byLifecycle !== 0) return byLifecycle;
        const aTs = a.createdAt || a.firstSeenAt || 0;
        const bTs = b.createdAt || b.firstSeenAt || 0;
        return new Date(bTs) - new Date(aTs);
      });
  }, [allMistakes, subjectFilter, sourceFilter, paperFilter, resultFilter, lifecycleFilter, searchText, fromDate, toDate, priorityIds, quickView]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.eyebrow}>
          REVIEW<span style={s.dot}>•</span>MISTAKE BOOK
        </div>
        <h1 style={s.title}>Mistake Book</h1>
        <p style={s.subtitle}>Track wrong answers. Spot patterns. Fix weak spots.</p>
      </div>

      <div style={s.intelligence}>
        <div style={s.intelligencePanel}>
          <p style={s.panelTitle}>Mentor Verdict</p>
          <p style={s.panelText}>
            {intelligence?.verdict?.headline || (loading ? "Building your repair queue..." : "Evidence is unavailable")}
          </p>
          {intelligence?.verdict?.detail && (
            <p style={{ ...s.panelText, marginTop: 4 }}>{intelligence.verdict.detail}</p>
          )}
          <div style={s.statRow}>
            <span style={s.statPill}>{intelligence?.totals?.activeMistakes || 0} ACTIVE</span>
            <span style={s.statPill}>{intelligence?.totals?.repeatedErrors || 0} REPEATED</span>
            <span style={s.statPill}>{intelligence?.totals?.verifyAgain || 0} VERIFY AGAIN</span>
            <span style={s.statPill}>{intelligence?.masteryProgress?.mastered || 0} MASTERED</span>
          </div>
          {intelligence?.patternIntelligence?.strongestPattern && (
            <p style={{ ...s.panelText, marginTop: 10 }}>
              Pattern: {intelligence.patternIntelligence.strongestPattern.label}
              {intelligence.patternIntelligence.strongestPattern.questionCount
                ? ` across ${intelligence.patternIntelligence.strongestPattern.questionCount} active mistake${intelligence.patternIntelligence.strongestPattern.questionCount === 1 ? "" : "s"}.`
                : "."}
            </p>
          )}
        </div>

        <div style={s.intelligencePanel}>
          <p style={s.panelTitle}>Today’s Fix</p>
          <p style={s.panelText}>
            {intelligence?.todaysFix?.empty
              ? "No active priority items. Mastered questions stay out of this queue."
              : `${intelligence?.todaysFix?.mistakes?.length || 0} item${(intelligence?.todaysFix?.mistakes?.length || 0) === 1 ? "" : "s"} · about ${intelligence?.todaysFix?.estimatedMinutes || 0} min`}
          </p>
          <div style={s.fixList}>
            {(intelligence?.todaysFix?.mistakes || []).slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                style={s.fixButton}
                onClick={() => {
                  setQuickView("priority");
                  setOpenMistakeId(item.id);
                }}
              >
                <span style={{ display: "block", fontSize: 12, lineHeight: 1.4 }}>
                  {item.questionText || "Untitled mistake"}
                </span>
                <span style={s.fixMeta}>
                  <span>{item.priorityLabel}</span>
                  <span>{item.evidence?.failureCount || 0} failures</span>
                  <span>{item.estimatedMinutes} min</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={s.intelligencePanel}>
          <p style={s.panelTitle}>Pattern Intelligence</p>
          <p style={s.panelText}>
            {intelligence?.patternIntelligence?.strongestPattern
              ? `${intelligence.patternIntelligence.strongestPattern.label}: ${intelligence.patternIntelligence.strongestPattern.verifiedFailureCount || 0} verified failure${(intelligence.patternIntelligence.strongestPattern.verifiedFailureCount || 0) === 1 ? "" : "s"}`
              : "Patterns will appear once Prelims mistakes have verified evidence."}
          </p>
          <div style={s.statRow}>
            {(intelligence?.patternIntelligence?.weakestSubjects || []).slice(0, 3).map((item) => (
              <span key={item.subject} style={s.statPill}>
                {item.subject}: {item.questionCount} ACTIVE
              </span>
            ))}
            {!(intelligence?.patternIntelligence?.weakestSubjects || []).length && (
              <span style={s.statPill}>DIAGNOSIS NEEDED</span>
            )}
          </div>
        </div>
      </div>

      <div style={s.quickTabs}>
        {quickTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            style={{
              ...s.quickTab,
              ...(quickView === tab.id ? s.quickTabActive : {}),
            }}
            onClick={() => setQuickView(tab.id)}
          >
            {tab.label} · {tab.count}
          </button>
        ))}
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
              <option value="other">Other</option>
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

          <div style={s.controlGroup}>
            <span style={s.controlLabel}>Lifecycle</span>
            <select style={s.select} value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="retest_due">Retest Due</option>
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

          {(fromDate || toDate || searchText || lifecycleFilter !== "all" || quickView !== "priority") && (
            <button
              type="button"
              onClick={() => { setFromDate(""); setToDate(""); setSearchText(""); setLifecycleFilter("all"); setQuickView("priority"); }}
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
          <p style={s.emptyTitle}>{loading && allMistakes.length === 0 ? "Loading…" : "No Mistakes Found"}</p>
          <p style={s.emptyText}>
            {subjectFilter !== "all" || sourceFilter !== "all" || paperFilter !== "all" || resultFilter !== "all" || lifecycleFilter !== "all" || searchText
              ? "Try adjusting your filters"
              : "Attempt questions to start building your mistake log"}
          </p>
        </div>
      ) : (
        <div style={s.list}>
          {filtered.map((mistake, i) => (
            <MistakeCard
              key={mistake.id || mistake.questionId || i}
              mistake={mistake}
              isExpanded={openMistakeId === mistake.id}
              onExpand={() => setOpenMistakeId(mistake.id)}
              onCollapse={() => setOpenMistakeId(null)}
              onRefresh={() => setTimeout(() => fetchMistakes(true), 150)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
