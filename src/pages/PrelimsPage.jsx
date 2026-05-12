import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { BACKEND_URL } from "../config";
import {
  fetchUnifiedQuestions,
  normalizeUnifiedQuestion,
  PRELIMS_TO_UNIFIED_SUBJECT,
  fetchUnifiedTopics,
} from "../utils/prelimsUnifiedFetcher";
import { PRELIMS_STRUCTURE } from "../data/prelimsStructure";
import { recordTestAttempt, buildTestId } from "../utils/prelimsMistakeEngine";

const CURRENT_USER_ID = "user_1";

const SUBJECT_LABEL_MAP = {
  ancient_history: "Ancient History",
  ancient: "Ancient History",
  medieval_history: "Medieval History",
  medieval: "Medieval History",
  modern_history: "Modern History",
  modern: "Modern History",
  history: "Modern History",
  art_culture: "Art & Culture",
  art_and_culture: "Art & Culture",
  culture: "Art & Culture",
  art: "Art & Culture",
  polity: "Polity",
  indian_polity: "Polity",
  constitution: "Polity",
  economy: "Economy",
  economics: "Economy",
  indian_economy: "Economy",
  geography: "Geography",
  geo: "Geography",
  physical_geography: "Geography",
  environment: "Environment",
  env: "Environment",
  ecology: "Environment",
  science_tech: "Science & Tech",
  science: "Science & Tech",
  science_and_technology: "Science & Tech",
  technology: "Science & Tech",
  international_relations: "International Relations",
  ir: "International Relations",
  current_affairs: "Current Affairs",
  csat_rc: "CSAT – RC",
  csat_quant: "CSAT – Quant",
  csat_reasoning: "CSAT – Reasoning",
};

function prettyNodeName(nodeId) {
  if (!nodeId) return "";
  return nodeId
    .replace(/^GS\d[-_]/, "")
    .replace(/[-_]MT\d+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

import PyqTestStart from "../components/Prelims/PyqTestStart";
import PyqTestAttempt from "../components/Prelims/PyqTestAttempt";
import PyqTestResult from "../components/Prelims/PyqTestResult";
import RcPassageBlock from "../components/Prelims/RcPassageBlock";

import DashboardSummary from "../components/Prelims/DashboardSummary";
import WeakAreasPanel from "../components/Prelims/WeakAreasPanel";
import TrapPanel from "../components/Prelims/TrapPanel";
import RecommendationsPanel from "../components/Prelims/RecommendationsPanel";
import StatsBreakdownPanel from "../components/Prelims/StatsBreakdownPanel";

const pageStyle = {
  minHeight: "100%",
  padding: 20,
  background: "#06091a",
  color: "#f1f5f9",
};

const heroStyle = {
  background: "#0d1224",
  border: "1px solid #1e2a45",
  borderRadius: 16,
  padding: 22,
  marginBottom: 16,
  boxShadow: "0 1px 0 rgba(99,102,241,0.12) inset",
};

const sectionStyle = {
  marginTop: 16,
};

const cardStyle = {
  background: "#0d1224",
  border: "1px solid #1e2a45",
  borderRadius: 14,
  padding: 18,
};

const chipRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};



function getSubjectBuildHints(selectedSubjectId, practicePaper) {
  if (practicePaper === "CSAT") {
    return {
      subjectId: practicePaper === "CSAT" ? "CSAT" : selectedSubjectId,
      subjectAliases: [],
      debugExpectedSubjects: [],
    };
  }

  const map = {
    history: {
      subjectId: "history",
      subjectAliases: ["Ancient History", "Medieval History", "Modern History"],
      debugExpectedSubjects: ["Ancient History", "Medieval History", "Modern History"],
    },
    culture: {
      subjectId: "culture",
      subjectAliases: ["Art & Culture", "Culture"],
      debugExpectedSubjects: ["Art & Culture"],
    },
    current_affairs_misc: {
      subjectId: "current_affairs_misc",
      subjectAliases: ["Current Affairs & Misc", "Current Affairs", "Miscellaneous"],
      debugExpectedSubjects: ["Current Affairs & Misc"],
    },
    geography: {
      subjectId: "geography",
      subjectAliases: ["Geography"],
      debugExpectedSubjects: ["Geography"],
    },
    economy: {
      subjectId: "economy",
      subjectAliases: ["Economy"],
      debugExpectedSubjects: ["Economy"],
    },
    polity: {
      subjectId: "polity",
      subjectAliases: ["Polity"],
      debugExpectedSubjects: ["Polity"],
    },
    environment: {
      subjectId: "environment",
      subjectAliases: ["Environment"],
      debugExpectedSubjects: ["Environment"],
    },
    science_tech: {
      subjectId: "science_tech",
      subjectAliases: ["Science & Technology", "ScienceTech", "Science and Technology"],
      debugExpectedSubjects: ["Science & Technology", "ScienceTech"],
    },
    ir: {
      subjectId: "ir",
      subjectAliases: ["International Relations", "IR"],
      debugExpectedSubjects: ["International Relations", "IR"],
    },
  };

  return (
    map[selectedSubjectId] || {
      subjectId: selectedSubjectId,
      subjectAliases: [],
      debugExpectedSubjects: [],
    }
  );
}

function dedupeQuestions(arr = []) {
  const seen = new Set();
  return arr.filter((q) => {
    const id = q?.id || q?.questionId || q?.qid;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeQuestion(q) {
  if (!q) return null;
  const ca =
    q.correctAnswer ||
    q.answer?.correct_option ||
    (typeof q.answer === "string" && /^[A-Da-d]$/.test(q.answer) ? q.answer : null);
  return {
    ...q,
    id:            q.id || q.questionId || q.qid || "",
    question:      q.question || q.questionText || q.prompt || q.stem || "",
    options:       q.options || q.choices || null,
    passageText:   q.passageText || q.passage || "",
    correctAnswer: ca ? String(ca).toUpperCase() : (q.correctAnswer || null),
    nodeId:        q.nodeId || q.syllabusNodeId || q.sectionId || "",
    syllabusNodeId: q.syllabusNodeId || q.nodeId || "",
    microTheme:    q.microTheme || "",
    year:          q.year || null,
    questionType:  q.questionType || (q.options ? "MCQ_SINGLE" : ""),
  };
}

function sanitizeQuestions(rawQuestions) {
  return dedupeQuestions((rawQuestions || []).map(normalizeQuestion).filter(Boolean));
}

function groupRcByPassage(items) {
  const map = {};
  const order = [];
  (items || []).forEach((q) => {
    // Use passageId when present; fall back to first-60-chars of passageText as key
    const key = q.passageId ||
      (q.passageText ? q.passageText.slice(0, 60).replace(/\s+/g, " ").trim() : null) ||
      `passage_q_${q.id || q.questionId || Math.random()}`;
    if (!map[key]) {
      map[key] = { passageId: key, passageText: q.passageText || "", questions: [] };
      order.push(key);
    }
    map[key].questions.push(q);
  });
  return order.map((k) => map[k]);
}


function ModeButton({ active, children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(56,189,248,0.6)"
          : "1px solid rgba(148,163,184,0.12)",
        background: active
          ? "linear-gradient(135deg, rgba(14,165,233,0.22), rgba(56,189,248,0.14))"
          : "rgba(15,23,42,0.6)",
        color: disabled ? "#334155" : active ? "#bae6fd" : "rgba(203,213,225,0.6)",
        fontWeight: active ? 800 : 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: active ? "0 0 12px rgba(56,189,248,0.14)" : "none",
        letterSpacing: 0.2,
      }}
    >
      {children}
    </button>
  );
}

function InfoBlock({ title, items, accent }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "16px 18px",
        borderTop: `2px solid ${accent}55`,
        background: "rgba(15,23,42,0.75)",
      }}
    >
      <div style={{
        color: accent,
        fontWeight: 800,
        marginBottom: 10,
        fontSize: 13,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: "#334155", fontSize: 12 }}>
          No updates available.
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            color: "#94a3b8",
            lineHeight: 1.75,
            fontSize: 13,
          }}
        >
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalizeAnswerKey(value) {
  return String(value || "").trim().toUpperCase();
}

function buildAttemptRows(questions, answersMap, confidenceMap) {
  return (Array.isArray(questions) ? questions : []).map((q, index) => {
    const qid =
      q?.questionId ||
      q?.id ||
      q?.qid ||
      `q_${index + 1}`;
    const userAnswer = answersMap?.[qid] || "";
    const correctAnswer = q?.answer || "";
    const confidence = confidenceMap?.[qid] || "sure";

    let status = "unattempted";
    if (!userAnswer) {
      status = "unattempted";
    } else if (normalizeAnswerKey(userAnswer) === normalizeAnswerKey(correctAnswer)) {
      status = "correct";
    } else {
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
      syllabusNodeId:
        q?.syllabusNodeId || q?.nodeId || q?.syllabusNode || "Unknown",
      microThemeLabel:
        q?.microtheme ||
        q?.microTheme ||
        q?.microThemeLabel ||
        q?.subtopic ||
        q?.subTopic ||
        "Unknown",
      questionType: q?.questionType || "MCQ_SINGLE",
      questionText: q?.questionText || q?.question || "",
      options: q?.options || {},
    };
  });
}

function buildLocalFallbackResult({
  evaluatedQuestions,
  testId,
  testMode,
  practicePaper,
  practiceScope,
  fullLengthYear,
}) {
  const safeQuestions = Array.isArray(evaluatedQuestions) ? evaluatedQuestions : [];
  const total = safeQuestions.length;
  const correct = safeQuestions.filter((q) => q.status === "correct").length;
  const wrong = safeQuestions.filter((q) => q.status === "wrong").length;
  const unattempted = safeQuestions.filter((q) => q.status === "unattempted").length;
  const attempted = correct + wrong;

  return {
    mode: testMode === "full_length" ? "full_length" : "practice",
    paperType: practicePaper,
    variant: practiceScope,
    year: fullLengthYear,
    testNumber: 1,
    reattemptNumber: 1,
    label: testId,
    questions: safeQuestions,
    summary: {
      total,
      correct,
      wrong,
      unattempted,
      attempted,
      score: correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      eliminationSuccessRate: 0,
      riskTendency: "medium",
      attemptQuality: "balanced",
      safeAttempts: 0,
      cautiousAttempts: 0,
      riskyAttempts: 0,
      changedAnswers: 0,
      safeAccuracy: 0,
      riskyAccuracy: 0,
      guessRate: 0,
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
      priority: "Real analytics response not connected yet. Showing evaluated fallback result.",
      revise: [],
      practice: [],
      avoid: [],
    },
  };
}

function getSelectedSubjectMeta(structure, practicePaper, selectedSubjectId) {
  if (practicePaper === "CSAT") {
    return (structure?.csat || []).find((s) => s.id === selectedSubjectId) || null;
  }
  return (structure?.gs || []).find((s) => s.id === selectedSubjectId) || null;
}

function getSelectedTopicMeta(subjectMeta, selectedTopicId) {
  if (!subjectMeta) return null;
  return (subjectMeta.topics || []).find((t) => t.id === selectedTopicId) || null;
}

function getSelectedMicroThemeMetas(topicMeta, selectedMicroThemeIds) {
  const ids = Array.isArray(selectedMicroThemeIds) ? selectedMicroThemeIds : [];
  const items = Array.isArray(topicMeta?.subtopics) ? topicMeta.subtopics : [];
  return items.filter((item) => ids.includes(item.id));
}

async function analyzeAttemptWithBackend({
  testId,
  testMode,
  practicePaper,
  practiceScope,
  fullLengthType,
  fullLengthYear,
  evaluatedQuestions,
}) {
  const payload = {
    testId,
    userId: "user_1",
    mode: testMode,
    practicePaper,
    practiceScope,
    fullLengthType,
    fullLengthYear,
    questions: evaluatedQuestions,
  };

  const candidateEndpoints = [
    `${BACKEND_URL}/api/prelims/analyze-attempt`,
    `${BACKEND_URL}/api/prelims/attempt/analyze`,
    `${BACKEND_URL}/api/prelims/submit-attempt`,
    `${BACKEND_URL}/api/prelims/run-phase3a`,
  ];

  for (const url of candidateEndpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) continue;

      const json = await response.json();
      if (json && (json.summary || json.result || json.analytics)) {
        return json.result || json.analytics || json;
      }
    } catch {
      // try next endpoint
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPIC PROGRESS PANEL  — enhanced start-flow with mode/count/pool display
// ═══════════════════════════════════════════════════════════════════════════

const PRACTICE_MODES = [
  { id: "continue", label: "Continue Unseen", poolKey: "unseen", color: "#38bdf8" },
  { id: "retry_wrong", label: "Retry Wrong Only", poolKey: "wrongOnly", color: "#f87171" },
  { id: "retry_attempted", label: "Retry Attempted", poolKey: "attempted", color: "#f59e0b" },
  { id: "retry_entire", label: "Retry Entire Subject", poolKey: "entire", color: "#a78bfa" },
];

function TopicProgressPanel({
  progress, loading, error,
  selectedMode, setSelectedMode,
  selectedCount, setSelectedCount,
  onStart,
}) {
  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        <div style={{ color: "#93c5fd", fontWeight: 600, fontSize: 13 }}>Loading subject progress…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ ...cardStyle, padding: 14, marginBottom: 12, borderColor: "rgba(239,68,68,0.22)", background: "rgba(127,29,29,0.1)" }}>
        <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>
      </div>
    );
  }
  if (!progress) return null;

  const pool = progress.poolCounts || {};
  const total = pool.total ?? progress.totalQuestions ?? 0;
  const unseen = pool.unseen ?? progress.remainingCount ?? 0;
  const wrongOnly = pool.wrongOnly ?? progress.wrongCount ?? 0;
  const attempted = pool.attempted ?? progress.servedCount ?? 0;
  const mistakes = pool.mistakes ?? (wrongOnly + (progress.unattemptedCount || 0));

  const coverage = progress.coveragePercent || 0;
  const bestScore = progress.bestScore ?? null;
  const latestScore = progress.latestScore ?? null;
  const avgScore = progress.averageScore ?? null;
  const attempts = progress.attemptsCount || 0;

  const activeMode = PRACTICE_MODES.find(m => m.id === selectedMode) || PRACTICE_MODES[0];
  const poolForMode = pool[activeMode.poolKey] ?? (activeMode.id === "retry_entire" ? total : 0);
  const maxCount = Math.max(poolForMode, 1);
  const safeCount = Math.min(selectedCount, maxCount);

  const COUNT_PRESETS = [10, 25, 50, 100].filter(n => n <= maxCount);
  if (!COUNT_PRESETS.includes(maxCount) && maxCount > 0) COUNT_PRESETS.push(maxCount);

  const canStart = poolForMode > 0;

  return (
    <div style={{
      ...cardStyle,
      padding: 20,
      marginBottom: 18,
      background: "linear-gradient(135deg, rgba(14,165,233,0.06), rgba(168,85,247,0.05))",
      border: "1px solid rgba(56,189,248,0.18)",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: "#e0f2fe", fontSize: 15, letterSpacing: 0.3 }}>Subject Progress</div>
        {attempts > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {bestScore != null && <span style={statPill("#22c55e")}>Best {bestScore}</span>}
            {latestScore != null && <span style={statPill("#38bdf8")}>Last {latestScore}</span>}
            {avgScore != null && <span style={statPill("#a78bfa")}>Avg {avgScore}</span>}
            <span style={statPill("#94a3b8")}>{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Pool counts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Total PYQs", value: total, color: "#94a3b8" },
          { label: "Unseen", value: unseen, color: "#38bdf8" },
          { label: "Wrong", value: wrongOnly, color: "#f87171" },
          { label: "Attempted", value: attempted, color: "#f59e0b" },
          { label: "Mistakes", value: mistakes, color: "#fb923c" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(15,23,42,0.75)", borderRadius: 10,
            padding: "10px 8px", textAlign: "center",
            border: "1px solid rgba(148,163,184,0.1)",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Coverage bar ── */}
      {total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
            <span>Subject coverage</span><span>{coverage}%</span>
          </div>
          <div style={{ background: "rgba(30,41,59,0.8)", borderRadius: 99, height: 7, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${coverage}%`,
              background: coverage >= 100
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : "linear-gradient(90deg, #0ea5e9, #8b5cf6)",
              borderRadius: 99, transition: "width 0.4s",
            }} />
          </div>
        </div>
      )}

      {/* ── Mode selector ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Practice Mode</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {PRACTICE_MODES.map(m => {
            const modePool = pool[m.poolKey] ?? (m.id === "retry_entire" ? total : 0);
            const active = selectedMode === m.id;
            const disabled = modePool === 0 && m.id !== "retry_entire";
            return (
              <button
                key={m.id} type="button"
                disabled={disabled}
                onClick={() => { setSelectedMode(m.id); setSelectedCount(Math.min(selectedCount, modePool || total || 10)); }}
                style={{
                  padding: "10px 12px", borderRadius: 10, textAlign: "left",
                  border: active ? `1px solid ${m.color}55` : "1px solid rgba(148,163,184,0.15)",
                  background: active ? `${m.color}18` : "rgba(15,23,42,0.6)",
                  color: disabled ? "#334155" : active ? m.color : "#94a3b8",
                  fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div>{m.label}</div>
                <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>
                  {modePool} available
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Count selector ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Questions — {canStart ? `${poolForMode} available for this mode` : "None available"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {COUNT_PRESETS.map(n => (
            <button key={n} type="button"
              onClick={() => setSelectedCount(n)}
              style={{
                height: 36, padding: "0 16px", borderRadius: 99,
                border: safeCount === n ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(148,163,184,0.18)",
                background: safeCount === n ? "rgba(14,165,233,0.16)" : "rgba(15,23,42,0.7)",
                color: safeCount === n ? "#e0f2fe" : "#94a3b8",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >{n}</button>
          ))}
          {/* custom input */}
          <input
            type="number" min={1} max={maxCount}
            value={selectedCount}
            onChange={e => {
              const v = Math.max(1, Math.min(Number(e.target.value) || 1, maxCount));
              setSelectedCount(v);
            }}
            style={{
              width: 72, height: 36, borderRadius: 10, textAlign: "center",
              border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.8)",
              color: "#e2e8f0", fontWeight: 700, fontSize: 13, padding: "0 8px",
            }}
          />
        </div>
      </div>

      {/* ── Start button ── */}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => canStart && onStart(selectedMode)}
        style={{
          width: "100%", height: 50, borderRadius: 14,
          border: canStart ? `1px solid ${activeMode.color}44` : "1px solid rgba(148,163,184,0.1)",
          background: canStart
            ? `linear-gradient(135deg, ${activeMode.color}22, ${activeMode.color}10)`
            : "rgba(30,41,59,0.4)",
          color: canStart ? activeMode.color : "#334155",
          fontWeight: 800, fontSize: 15, cursor: canStart ? "pointer" : "not-allowed",
          transition: "all 0.2s", letterSpacing: 0.3,
        }}
      >
        {canStart
          ? `▶  Start — ${activeMode.label} · ${safeCount} Questions`
          : "No questions available for this mode"}
      </button>
    </div>
  );
}

function statPill(color) {
  return {
    padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
    background: `${color}18`, border: `1px solid ${color}33`, color,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PrelimsPage() {
  const [testStage, setTestStage] = useState("start");
  const [testMode, setTestMode] = useState("sectional");
  const [testId, setTestId] = useState("prelims_2020_gs1");

  // Live GS subject counts fetched from backend (authoritative buildable counts)
  const [gsCountsFromAPI, setGsCountsFromAPI] = useState(null);
  // Live CSAT subject counts fetched from backend
  const [csatCountsFromAPI, setCsatCountsFromAPI] = useState(null);
  // Live RC subtopic counts fetched from backend (classifier-based)
  const [rcTopicCounts, setRcTopicCounts] = useState({});

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [smartRec, setSmartRec] = useState(null);

  // ── Adaptive Next Actions state ─────────────────────────────────────────
  const [adaptiveActions, setAdaptiveActions] = useState([]);
  const [adaptiveActionsLoading, setAdaptiveActionsLoading] = useState(false);

  const [practicePaper, setPracticePaper] = useState("GS");
  const [practiceScope, setPracticeScope] = useState("subject");

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedTopicNodeId, setSelectedTopicNodeId] = useState(""); // canonical nodeId for API calls
  const [selectedMicroThemeIds, setSelectedMicroThemeIds] = useState([]);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(10);

  const [fullLengthType, setFullLengthType] = useState("gs_yearwise");
  const [fullLengthYear, setFullLengthYear] = useState("2020");

  // Year-filter state for sectional mode
  const [availableYears, setAvailableYears] = useState({
    gs: [],
    csat: [],
    availableFullLengthYears: [],
    fullLengthPapers: [],
  });
  const [sectionYearMode, setSectionYearMode] = useState("all");
  const [sectionYear, setSectionYear] = useState("");
  const [sectionYearFrom, setSectionYearFrom] = useState("");
  const [sectionYearTo, setSectionYearTo] = useState("");

  const [institutionalForm, setInstitutionalForm] = useState({
    instituteName: "",
    testTitle: "",
    questionPaperFile: null,
    answerKeyFile: null,
    pastedText: "",
  });

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [confidenceMap, setConfidenceMap] = useState({});
  const [result, setResult] = useState(null);

  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderError, setBuilderError] = useState("");
  const [builderWarning, setBuilderWarning] = useState("");

  // ── Cross-device Topic Progress State ─────────────────────────────────────
  const [topicProgress, setTopicProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [activePracticeMode, setActivePracticeMode] = useState("continue");
  // Tracks the topicNodeId used for the currently active progressive test
  const [activeTopicNodeId, setActiveTopicNodeId] = useState("");

  // ── Start-flow selectors ──────────────────────────────────────────────────
  const [selectedPracticeMode, setSelectedPracticeMode] = useState("continue");

  // ── Timer state ───────────────────────────────────────────────────────────
  const [testStartTime, setTestStartTime] = useState(null);
  const [perQuestionTimeMap, setPerQuestionTimeMap] = useState({});
  const [questionEnteredAt, setQuestionEnteredAt] = useState(null);

  // ── Last submit data (UPSC score + subject progress for result screen) ────
  const [lastSubmitData, setLastSubmitData] = useState(null);

  // ── RC grouped attempt: current passage index + timer ───────────────────
  const [currentRcPassageIndex, setCurrentRcPassageIndex] = useState(0);
  const [rcElapsedSeconds, setRcElapsedSeconds] = useState(0);
  const rcTimerRef = useRef(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // ── Unified dynamic topics (GS subjects) ────────────────────────────────
  const [unifiedTopics, setUnifiedTopics] = useState([]);
  const [unifiedTopicsLoading, setUnifiedTopicsLoading] = useState(false);
  const [unifiedTopicsError, setUnifiedTopicsError] = useState("");

  // Fetch actual buildable GS counts from backend once on mount
  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_URL}/api/prelims/gs/counts`)
      .then((r) => r.json())
      .then((json) => { if (active && json?.ok) setGsCountsFromAPI(json.counts); })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  // Fetch available years from backend once on mount
  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_URL}/api/prelims/years`)
      .then((r) => r.json())
      .then((json) => {
        if (active && json?.ok) {
          const years = {
            gs: json.gs || [],
            csat: json.csat || [],
            availableFullLengthYears: json.availableFullLengthYears || [],
            fullLengthPapers: json.fullLengthPapers || [],
          };
          console.log("[Prelims FullLength] API years:", years.availableFullLengthYears);
          console.log("[PrelimsPage] availableYears fetched — GS:", years.gs.length, "years, range:", years.gs[0], "–", years.gs[years.gs.length - 1],
            "| CSAT:", years.csat.length, "years");
          setAvailableYears(years);
        }
      })
      .catch((err) => { console.warn("[PrelimsPage] Failed to fetch available years:", err); });
    return () => { active = false; };
  }, []);

  // Fetch live CSAT subject counts from backend once on mount
  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_URL}/api/prelims/csat/counts`)
      .then((r) => r.json())
      .then((json) => { if (active && json?.ok) setCsatCountsFromAPI(json.counts); })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  // Fetch authoritative subject counts from unified health endpoint
  const [subjectCounts, setSubjectCounts] = useState({});
  useEffect(() => {
    async function loadCounts() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/prelims-unified/health`);
        const data = await res.json();
        setSubjectCounts(data.bySubject || {});
      } catch (e) {
        console.warn("Failed to load subject counts", e);
      }
    }
    loadCounts();
  }, []);

  // Fetch real RC subtopic counts when user selects CSAT → Reading Comprehension
  useEffect(() => {
    if (practicePaper !== "CSAT" || selectedSubjectId !== "csat_rc") return;
    let active = true;
    fetch(`${BACKEND_URL}/api/prelims/csat/rc-subtopics`)
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json?.ok || !Array.isArray(json.subtopics)) return;
        const counts = {};
        json.subtopics.forEach((s) => { counts[s.id] = s.count; });
        setRcTopicCounts(counts);
      })
      .catch(() => { });
    return () => { active = false; };
  }, [practicePaper, selectedSubjectId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!testId.startsWith("prelims_")) {
        if (isMounted) {
          setDashboard(null);
          setDashboardError("");
          setDashboardLoading(false);
        }
        return;
      }

      try {
        setDashboardLoading(true);
        setDashboardError("");

        const response = await fetch(
          `${BACKEND_URL}/api/prelims/dashboard?testId=${encodeURIComponent(
            testId
          )}&userId=${encodeURIComponent("user_1")}`
        );

        if (response.status === 404) {
          if (isMounted) {
            setDashboard(null);
            setDashboardError("");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Dashboard fetch failed with status ${response.status}`
          );
        }

        const json = await response.json();

        if (isMounted) {
          setDashboard(json);
        }
      } catch (error) {
        console.error("Prelims dashboard fetch error:", error);
        if (isMounted) {
          setDashboard(null);
          setDashboardError(
            error.message || "Failed to load prelims dashboard"
          );
        }
      } finally {
        if (isMounted) {
          setDashboardLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [testId]);

  useEffect(() => {
    let alive = true;
    async function fetchSmartRec() {
      try {
        const [weakRes, histRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/weakness/top?userId=${encodeURIComponent(CURRENT_USER_ID)}&limit=3`),
          fetch(`${BACKEND_URL}/api/prelims-tests/history?userId=${encodeURIComponent(CURRENT_USER_ID)}&limit=10`),
        ]);
        const weakJson = weakRes.ok ? await weakRes.json() : {};
        const histJson = histRes.ok ? await histRes.json() : {};
        const nodes = Array.isArray(weakJson?.nodes) ? weakJson.nodes : [];
        const attempts = Array.isArray(histJson?.attempts) ? histJson.attempts : [];

        if (!nodes.length) {
          // Fallback: Compute from available data
          let fallbackComputed = false;
          try {
            const [revRes, mEngine] = await Promise.all([
              fetch(`${BACKEND_URL}/api/revision?userId=${encodeURIComponent(CURRENT_USER_ID)}&stage=prelims`),
              import("../utils/prelimsMistakeEngine").catch(() => null)
            ]);
            const revItems = revRes.ok ? await revRes.json() : [];
            const localMistakes = mEngine ? await mEngine.getAllMistakes() : [];

            const stats = {};
            const addStat = (id, type, val, date) => {
              if (!id || id === 'Unknown') return;
              if (!stats[id]) stats[id] = { mistakes: 0, revCount: 0, accuracySum: 0, testCount: 0, lastRevised: null, isNode: false };
              if (type === 'mistake') stats[id].mistakes += val;
              if (type === 'rev') stats[id].revCount += val;
              if (type === 'acc') {
                stats[id].accuracySum += val;
                stats[id].testCount += 1;
              }
              if (date) {
                const d = new Date(date);
                if (!stats[id].lastRevised || d > stats[id].lastRevised) stats[id].lastRevised = d;
              }
            };

            attempts.forEach(a => {
              if (a.node_id) { addStat(a.node_id, 'acc', Number(a.accuracy || 0), a.created_at || a.started_at); stats[a.node_id].isNode = true; }
              else if (a.subject) addStat(a.subject, 'acc', Number(a.accuracy || 0), a.created_at || a.started_at);
            });

            localMistakes.forEach(m => {
              if (m.nodeId) { addStat(m.nodeId, 'mistake', 1, m.timestamp || m.created_at); stats[m.nodeId].isNode = true; }
              else if (m.subjectId) addStat(m.subjectId, 'mistake', 1, m.timestamp || m.created_at);
            });

            (Array.isArray(revItems) ? revItems : []).forEach(r => {
              if (r.node_id) { addStat(r.node_id, 'rev', 1, r.updated_at || r.created_at); stats[r.node_id].isNode = true; }
              else if (r.subject) addStat(r.subject, 'rev', 1, r.updated_at || r.created_at);
            });

            const sorted = Object.keys(stats).sort((a, b) => {
              const sA = stats[a];
              const sB = stats[b];
              const scoreA = sA.mistakes * 5 + sA.revCount * 3 + (sA.testCount > 0 ? (100 - (sA.accuracySum/sA.testCount)) : 0);
              const scoreB = sB.mistakes * 5 + sB.revCount * 3 + (sB.testCount > 0 ? (100 - (sB.accuracySum/sB.testCount)) : 0);
              return scoreB - scoreA;
            });

            if (sorted.length > 0 && (stats[sorted[0]].mistakes > 0 || stats[sorted[0]].revCount > 0 || stats[sorted[0]].testCount > 0)) {
              const topId = sorted[0];
              const s = stats[topId];
              const isNode = s.isNode || topId.includes("MT");
              const avgAcc = s.testCount > 0 ? Math.round(s.accuracySum / s.testCount) : null;
              const lastRevisedDays = s.lastRevised ? Math.floor((Date.now() - s.lastRevised.getTime()) / 86400000) : null;

              const whyBullets = [];
              if (s.mistakes > 0) whyBullets.push(`You have ${s.mistakes} recorded mistake${s.mistakes > 1 ? "s" : ""} in this area`);
              if (s.revCount > 0) whyBullets.push(`${s.revCount} item${s.revCount > 1 ? "s" : ""} pending for revision`);
              if (lastRevisedDays != null) whyBullets.push(`Last revision was ${lastRevisedDays} day${lastRevisedDays !== 1 ? "s" : ""} ago`);
              if (avgAcc != null && avgAcc < 50) whyBullets.push(`Accuracy is low (${avgAcc}%)`);
              if (whyBullets.length === 0) whyBullets.push("Needs more practice based on recent data");

              if (alive) {
                setSmartRec({
                  hasData: true,
                  subject: isNode ? "Practice" : (SUBJECT_LABEL_MAP[topId] || topId),
                  subjectId: isNode ? "" : topId,
                  topic: isNode ? prettyNodeName(topId) : "General Review",
                  nodeId: isNode ? topId : "",
                  accuracy: avgAcc,
                  previousAccuracy: null,
                  lastRevisedDays,
                  mistakes: s.mistakes,
                  priority: (avgAcc != null && avgAcc < 40) || s.mistakes > 5 ? "Critical" : "High",
                  weaknessScore: null,
                  whyBullets
                });
                fallbackComputed = true;
              }
            }
          } catch (e) {
            console.error("Fallback weak area error:", e);
          }

          if (!fallbackComputed && alive) setSmartRec(null);
          return;
        }

        const top = nodes[0];

        let topicLabel = "";
        try {
          const nResp = await fetch(
            `${BACKEND_URL}/api/prelims-unified/node/${encodeURIComponent(top.node_id)}?limit=1`
          );
          if (nResp.ok) {
            const nJson = await nResp.json();
            const mt = nJson?.questions?.[0]?.microTheme || "";
            topicLabel = (mt && mt.toLowerCase() !== "general") ? mt : "";
          }
        } catch { /* ignore */ }
        if (!topicLabel) topicLabel = prettyNodeName(top.node_id);
        if (topicLabel.toLowerCase() === "general") topicLabel = "";

        const subjectAttempts = attempts.filter(
          (a) => (a.subject === top.subject || a.node_id === top.node_id) && a.accuracy != null
        );
        const accuracy = subjectAttempts[0] != null ? Math.round(Number(subjectAttempts[0].accuracy)) : null;
        const previousAccuracy = subjectAttempts[1] != null ? Math.round(Number(subjectAttempts[1].accuracy)) : null;

        const lastRevisedDays = top.last_activity_at
          ? Math.floor((Date.now() - new Date(top.last_activity_at).getTime()) / 86_400_000)
          : null;

        const priorityMap = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
        const priority = priorityMap[top.risk_level] || "High";

        const whyBullets = [];
        if (top.mistake_count > 0)
          whyBullets.push(`You made ${top.mistake_count} mistake${top.mistake_count > 1 ? "s" : ""} in ${topicLabel || "this topic"}`);
        if (top.repeat_mistake_count > 0)
          whyBullets.push(`${top.repeat_mistake_count} repeated mistake${top.repeat_mistake_count > 1 ? "s" : ""} — patterns need fixing`);
        if (lastRevisedDays != null)
          whyBullets.push(`Last revision was ${lastRevisedDays} day${lastRevisedDays !== 1 ? "s" : ""} ago`);
        if (top.overdue_revision_count > 0)
          whyBullets.push(`${top.overdue_revision_count} overdue revision item${top.overdue_revision_count > 1 ? "s" : ""} need attention`);
        if (whyBullets.length < 3)
          whyBullets.push("High weightage topic in Prelims");

        if (alive) setSmartRec({
          hasData: true,
          subject: SUBJECT_LABEL_MAP[top.subject] || top.subject || "Practice",
          subjectId: top.subject || "",
          topic: topicLabel,
          nodeId: top.node_id || "",
          accuracy,
          previousAccuracy,
          lastRevisedDays,
          mistakes: top.mistake_count || 0,
          priority,
          weaknessScore: top.weakness_score || 0,
          whyBullets,
        });
      } catch {
        if (alive) setSmartRec(null);
      }
    }
    fetchSmartRec();
    return () => { alive = false; };
  }, []);

  // ── Fetch adaptive next actions from backend ────────────────────────────
  useEffect(() => {
    let alive = true;
    async function fetchAdaptiveActions() {
      try {
        setAdaptiveActionsLoading(true);
        const resp = await fetch(
          `${BACKEND_URL}/api/adaptive/next-actions?userId=${encodeURIComponent(CURRENT_USER_ID)}&stage=prelims&limit=3`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (alive && json?.ok && Array.isArray(json.recommendations)) {
          setAdaptiveActions(json.recommendations);
        }
      } catch (e) {
        console.warn("[ADAPTIVE] Failed to fetch next actions:", e.message);
        if (alive) setAdaptiveActions([]);
      } finally {
        if (alive) setAdaptiveActionsLoading(false);
      }
    }
    fetchAdaptiveActions();
    return () => { alive = false; };
  }, []);

  // Normalise a subject id to the key used in the unified bySubject map
  const normalizeSubjectId = (id) =>
    PRELIMS_TO_UNIFIED_SUBJECT[id] || id.toLowerCase().replace(/\s+/g, "_");

  // Proper UPSC GS subject list — replaces merged/incorrect PRELIMS_STRUCTURE GS list
  const GS_SUBJECTS = [
    { id: "ancient_history",       label: "Ancient History" },
    { id: "medieval_history",      label: "Medieval History" },
    { id: "modern_history",        label: "Modern History" },
    { id: "art_culture",           label: "Art & Culture" },
    { id: "polity",                label: "Polity" },
    { id: "economy",               label: "Economy" },
    { id: "geography",             label: "Geography" },
    { id: "environment",           label: "Environment" },
    { id: "science_tech",          label: "Science & Tech" },
    { id: "international_relations", label: "International Relations" },
    { id: "current_affairs",       label: "Current Affairs" },
  ];

  const subjects = useMemo(() => {
    if (practicePaper === "GS") {
      return GS_SUBJECTS.map((item) => {
        const resolvedCount =
          subjectCounts?.[item.id] ??
          subjectCounts?.[item.id === "polity" ? "indian_polity" : item.id] ??
          item.count ??
          0;
        return { id: item.id, label: item.label, count: resolvedCount };
      });
    }

    // CSAT — use csatCountsFromAPI which has per-module counts (quant/reasoning/rc).
    // Do NOT use subjectCounts from unified health: it only tracks a single 'csat' key
    // (total=771) which would make all three CSAT subjects show the same inflated count.
    return (PRELIMS_STRUCTURE?.csat || []).map((item) => {
      const count =
        csatCountsFromAPI?.[item.id] != null
          ? csatCountsFromAPI[item.id]
          : (item.count || 0);
      return { id: item.id, label: item.label || item.name || item.id, count };
    });
  }, [practicePaper, gsCountsFromAPI, csatCountsFromAPI, subjectCounts]);

  const topics = useMemo(() => {
    // For GS subjects: use live unified topics when available
    if (practicePaper !== "CSAT" && unifiedTopics.length > 0) {
      return unifiedTopics.map((t) => {
        const rawNodeId = t.originalNodeId || t.nodeId || "";
        console.log("[TOPIC NODE DEBUG]", {
          topicLabel: t.label,
          nodeId: rawNodeId,
        });
        return {
          id: t.id,
          name: t.label,
          count: t.count,
          nodeId: rawNodeId,   // ← preserve raw dataset nodeId for API calls
        };
      });
    }

    const base =
      practicePaper === "GS"
        ? PRELIMS_STRUCTURE?.gs || []
        : PRELIMS_STRUCTURE?.csat || [];

    const subject = base.find((item) => item.id === selectedSubjectId);
    const isLocalRC = practicePaper === "CSAT" && String(selectedSubjectId).includes("rc");

    return (subject?.topics || [])
      .map((topic) => {
        let countFromApi = undefined;
        if (isLocalRC) {
          const cleanId = topic.id.replace(/^rc_/, "").replace(/^rc-/, "");
          const val = rcTopicCounts[topic.id] ?? rcTopicCounts[cleanId];
          if (val !== undefined) countFromApi = val;
        }
        return {
          id: topic.id,
          name: topic.name || topic.label || topic.id,
          count: countFromApi ?? topic.count ?? 0,
        };
      })
      .filter((topic) => isLocalRC ? true : topic.count > 0);
  }, [practicePaper, selectedSubjectId, rcTopicCounts, unifiedTopics]);

  // ── Fetch topic progress when topicNodeId is known ─────────────────────────
  const fetchTopicProgress = useCallback(async (nodeId) => {
    if (!nodeId) {
      setTopicProgress(null);
      return;
    }
    try {
      setProgressLoading(true);
      setProgressError("");
      const resp = await fetch(
        `${BACKEND_URL}/api/prelims/practice/progress/${encodeURIComponent(nodeId)}?userId=${encodeURIComponent(CURRENT_USER_ID)}`
      );
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json?.error || `Progress fetch failed (${resp.status})`);
      }
      const json = await resp.json();
      setTopicProgress(json);
    } catch (e) {
      setProgressError(e.message || "Failed to load progress");
      setTopicProgress(null);
    } finally {
      setProgressLoading(false);
    }
  }, []);

  // Helper: resolve nodeId for current topic selection
  function resolveCurrentTopicNodeId() {
    const base = practicePaper === "GS" ? PRELIMS_STRUCTURE?.gs || [] : PRELIMS_STRUCTURE?.csat || [];
    const subjectMeta = base.find((s) => s.id === selectedSubjectId);
    // When unified topics are active, PRELIMS_STRUCTURE won't have the topic —
    // use the canonical nodeId synced from the selected topic's nodeId field.
    if (!subjectMeta) return selectedTopicNodeId || "";
    if (practiceScope === "subject") return subjectMeta.nodeId || "";
    const topicMeta = (subjectMeta.topics || []).find((t) => t.id === selectedTopicId);
    if (!topicMeta) return selectedTopicNodeId || subjectMeta.nodeId || "";
    if (practiceScope === "topic") return topicMeta.nodeId || selectedTopicNodeId || subjectMeta.nodeId || "";
    const subtopicMeta = (topicMeta.subtopics || []).find((s) => selectedMicroThemeIds.includes(s.id));
    return subtopicMeta?.nodeId || topicMeta.nodeId || selectedTopicNodeId || subjectMeta.nodeId || "";
  }

  const microThemes = useMemo(() => {
    const base =
      practicePaper === "GS"
        ? PRELIMS_STRUCTURE?.gs || []
        : PRELIMS_STRUCTURE?.csat || [];

    const subject = base.find((item) => item.id === selectedSubjectId);
    const topic = (subject?.topics || []).find((item) => item.id === selectedTopicId);
    const subtopics = topic?.subtopics || [];

    return subtopics.map((subtopic) => ({
      id: subtopic.id,
      label: subtopic.label || subtopic.name || subtopic.id,
      count: subtopic.count || 0,
    }));
  }, [practicePaper, selectedSubjectId, selectedTopicId]);

  const availableQuestionCount = useMemo(() => {
    if (practiceScope === "subject") {
      return subjects.find((s) => s.id === selectedSubjectId)?.count || 0;
    }

    if (practiceScope === "topic") {
      return topics.find((t) => t.id === selectedTopicId)?.count || 0;
    }

    return microThemes
      .filter((m) => selectedMicroThemeIds.includes(m.id))
      .reduce((sum, item) => sum + (item.count || 0), 0);
  }, [
    practiceScope,
    subjects,
    topics,
    microThemes,
    selectedSubjectId,
    selectedTopicId,
    selectedMicroThemeIds,
  ]);

  // RC passage groups — only computed for CSAT RC sectional mode
  const rcPassageGroups = useMemo(() => {
    if (practicePaper !== "CSAT" || selectedSubjectId !== "csat_rc") return [];
    return groupRcByPassage(questions);
  }, [questions, practicePaper, selectedSubjectId]);

  // RC timer — starts when RC attempt begins, stops when stage leaves "attempt"
  const isRcAttempt = testStage === "attempt" && testMode === "sectional" && practicePaper === "CSAT" && selectedSubjectId === "csat_rc";
  useEffect(() => {
    if (isRcAttempt) {
      setRcElapsedSeconds(0);
      rcTimerRef.current = setInterval(() => setRcElapsedSeconds((s) => s + 1), 1000);
    } else {
      if (rcTimerRef.current) { clearInterval(rcTimerRef.current); rcTimerRef.current = null; }
    }
    return () => { if (rcTimerRef.current) { clearInterval(rcTimerRef.current); rcTimerRef.current = null; } };
  }, [isRcAttempt]);

  useEffect(() => {
    setSelectedSubjectId("");
    setSelectedTopicId("");
    setSelectedMicroThemeIds([]);
    setBuilderError("");
    setTopicProgress(null);
    setSectionYearMode("all");
    setSectionYear("");
    setSectionYearFrom("");
    setSectionYearTo("");
  }, [practicePaper]);

  useEffect(() => {
    setSelectedTopicId("");
    setSelectedTopicNodeId("");
    setSelectedMicroThemeIds([]);
    setBuilderError("");
    setTopicProgress(null);
  }, [selectedSubjectId]);

  // Keep selectedTopicNodeId in sync when topic changes
  useEffect(() => {
    if (!selectedTopicId) { setSelectedTopicNodeId(""); return; }
    const found = topics.find((t) => t.id === selectedTopicId);
    setSelectedTopicNodeId(found?.nodeId || "");
  }, [selectedTopicId, topics]);

  // ── Load dynamic topics from unified engine for GS subjects ───────────────
  useEffect(() => {
    let alive = true;
    async function loadUnifiedTopics() {
      if (!selectedSubjectId || practicePaper === "CSAT") {
        if (alive) { setUnifiedTopics([]); setUnifiedTopicsError(""); }
        return;
      }
      setUnifiedTopicsLoading(true);
      setUnifiedTopicsError("");
      try {
        const fetched = await fetchUnifiedTopics({ subject: selectedSubjectId });
        if (!alive) return;
        setUnifiedTopics(fetched || []);
      } catch (err) {
        if (!alive) return;
        console.warn("[PrelimsPage] unified topics fetch failed", err);
        setUnifiedTopics([]);
        setUnifiedTopicsError("Unified topics unavailable; using fallback topics.");
      } finally {
        if (alive) setUnifiedTopicsLoading(false);
      }
    }
    loadUnifiedTopics();
    return () => { alive = false; };
  }, [selectedSubjectId, practicePaper]);

  // ── Fetch authoritative topic counts from the backend engine ──────────────
  useEffect(() => {
    let alive = true;
    if (!selectedSubjectId || practicePaper === "CSAT" || unifiedTopics.length === 0) return;

    // To prevent infinite loop since we update unifiedTopics inside
    const needsCounts = unifiedTopics.some(t => t.countSource !== "topic_count_engine");
    if (!needsCounts) return;

    async function loadTopicCounts() {
      try {
        const payload = {
          subjectId: selectedSubjectId,
          topics: unifiedTopics.map(t => ({
            id: t.id,
            label: t.label,
            nodeId: t.originalNodeId || t.nodeId || ""
          }))
        };

        const res = await fetch(`${BACKEND_URL}/api/prelims/topic-counts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (alive && json.success && Array.isArray(json.topics)) {
          setUnifiedTopics(prev =>
            prev.map(topic => {
              const found = json.topics.find(x => x.id === topic.id);
              return {
                ...topic,
                count: found?.count ?? topic.count ?? 0,
                countSource: found?.source || "topic_count_engine"
              };
            })
          );
        }
      } catch (err) {
        console.warn("[PrelimsPage] Backend topic counts failed, falling back to local counts:", err);
      }
    }

    loadTopicCounts();
    return () => { alive = false; };
  }, [selectedSubjectId, practicePaper, unifiedTopics.length]);

  useEffect(() => {
    setSelectedMicroThemeIds([]);
    setBuilderError("");
  }, [selectedTopicId]);

  // Clear stale error banner whenever user changes scope (Full Subject / Topic-wise / Subtopic-wise)
  useEffect(() => {
    setBuilderError("");
  }, [practiceScope, testMode]);


  useEffect(() => {
    setPracticeQuestionCount((prev) => {
      const max = Math.max(availableQuestionCount || 1, 1);
      return Math.min(prev || 1, max);
    });
  }, [availableQuestionCount]);

  // Reset RC passage index whenever a new question set is loaded
  useEffect(() => {
    setCurrentRcPassageIndex(0);
  }, [questions]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    console.log("🧠 PRELIMS SUBJECT SELECTED:", {
      selectedSubjectId,
      practicePaper,
      practiceScope,
    });
  }, [selectedSubjectId, practicePaper, practiceScope]);

  // Auto-fetch progress when a topic/subtopic is selected and we are in sectional mode
  useEffect(() => {
    if (testMode !== "sectional" || testStage !== "start") return;
    if (!selectedSubjectId) { setTopicProgress(null); return; }
    const nodeId = resolveCurrentTopicNodeId();
    if (nodeId) {
      fetchTopicProgress(nodeId);
    } else {
      setTopicProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, selectedTopicId, selectedMicroThemeIds, practiceScope, testMode, testStage]);

  const recentHistory = useMemo(() => {
    const summary = dashboard?.summary || {};
    const weakSubjects = Array.isArray(dashboard?.weakSubjects)
      ? dashboard.weakSubjects
      : [];
    const weakNodes = Array.isArray(dashboard?.weakNodes)
      ? dashboard.weakNodes
      : [];

    return [
      `Current test: ${testId}`,
      `Attempted: ${summary.attempted ?? 0}, Correct: ${summary.correct ?? 0}, Wrong: ${summary.wrong ?? 0}`,
      weakSubjects.length > 0
        ? `Main weak subject signal: ${typeof weakSubjects[0] === "string"
          ? weakSubjects[0]
          : weakSubjects[0]?.name ||
          weakSubjects[0]?.subject ||
          "Unknown"
        }`
        : "Weak subject signal will appear after analysis",
      weakNodes.length > 0
        ? `Main weak node signal: ${typeof weakNodes[0] === "string"
          ? weakNodes[0]
          : weakNodes[0]?.name ||
          weakNodes[0]?.nodeName ||
          "Unknown"
        }`
        : "Weak node signal will appear after analysis",
    ];
  }, [dashboard, testId]);

  const mistakeBookSignals = useMemo(() => {
    const trapAlerts = Array.isArray(dashboard?.trapAlerts)
      ? dashboard.trapAlerts
      : [];
    const weakTypes = Array.isArray(dashboard?.weakTypes)
      ? dashboard.weakTypes
      : [];

    return [
      trapAlerts.length > 0
        ? `Trap alert detected: ${typeof trapAlerts[0] === "string"
          ? trapAlerts[0]
          : trapAlerts[0]?.message ||
          trapAlerts[0]?.text ||
          "Review trap errors"
        }`
        : "Trap-driven mistakes will surface here",
      weakTypes.length > 0
        ? `Weak pattern: ${typeof weakTypes[0] === "string"
          ? weakTypes[0]
          : weakTypes[0]?.name ||
          weakTypes[0]?.type ||
          "Unknown"
        }`
        : "Weak question patterns will surface here",
      "Use this panel later for mistake book linking",
    ];
  }, [dashboard]);

  const nextActions = useMemo(() => {
    const recommendations = Array.isArray(dashboard?.recommendations)
      ? dashboard.recommendations
      : [];

    if (recommendations.length > 0) {
      return recommendations.slice(0, 3).map((item) =>
        typeof item === "string"
          ? item
          : item?.text ||
          item?.label ||
          item?.message ||
          "Review recommendations"
      );
    }

    return [
      "Take next sectional test after reviewing weak nodes",
      "Revise trap-heavy question patterns",
      "Convert recurring errors into mistake book entries",
    ];
  }, [dashboard]);

  const insights = useMemo(() => {
    const behaviour = dashboard?.behaviour || {};
    return [
      `Guess count: ${behaviour.guessCount ?? 0}`,
      `Safe attempts: ${behaviour.safeAttempts ?? 0}, Risky attempts: ${behaviour.riskyAttempts ?? 0}`,
      `Fast wrong errors: ${behaviour.fastWrong ?? 0}`,
    ];
  }, [dashboard]);

  const weakAreaSuggestion = useMemo(() => {
    if (smartRec?.hasData) return smartRec;
    const weakSubjects = Array.isArray(dashboard?.weakSubjects) ? dashboard.weakSubjects : [];
    const weakNodes = Array.isArray(dashboard?.weakNodes) ? dashboard.weakNodes : [];
    if (weakSubjects.length > 0) {
      const ws = weakSubjects[0];
      const subjectId = typeof ws === "object" ? (ws?.subjectId || ws?.id || "") : "";
      const rawSubject = typeof ws === "string" ? ws : (ws?.name || ws?.subject || "");
      const subject = SUBJECT_LABEL_MAP[subjectId] || SUBJECT_LABEL_MAP[rawSubject] || rawSubject;
      const accuracy = typeof ws === "object" ? (ws?.accuracy ?? ws?.score ?? null) : null;
      const topic = weakNodes.length > 0
        ? (typeof weakNodes[0] === "string" ? weakNodes[0] : (weakNodes[0]?.name || weakNodes[0]?.nodeName || ""))
        : "";
      const nodeId = weakNodes.length > 0 && typeof weakNodes[0] === "object" ? (weakNodes[0]?.nodeId || "") : "";
      return {
        hasData: true, subject, topic, accuracy,
        previousAccuracy: null, lastRevisedDays: null, mistakes: null,
        priority: "High", subjectId, nodeId, whyBullets: [], weaknessScore: null,
      };
    }
    return { hasData: false };
  }, [smartRec, dashboard]);

  const subtopicDisabled =
    practiceScope === "subtopic" &&
    (!selectedTopicId || microThemes.length === 0);

  const disableStart =
    builderLoading ||
    (testMode === "sectional" &&
      (!selectedSubjectId ||
        (practiceScope !== "subject" && !selectedTopicId) ||
        (practiceScope === "subtopic" &&
          (!selectedMicroThemeIds.length || microThemes.length === 0))));

  // ── Timer helpers ─────────────────────────────────────────────────────────
  function recordCurrentQuestionTime() {
    const qid = questions[currentIndex]?.id || questions[currentIndex]?.questionId;
    if (!qid || !questionEnteredAt) return;
    const spent = Date.now() - questionEnteredAt;
    setPerQuestionTimeMap(prev => ({ ...prev, [qid]: (prev[qid] || 0) + spent }));
  }

  // ── Unified API fallback: fetch questions from /api/prelims-unified ──────────
  // Called when the main builder returns 0 questions. Returns sanitized array.
  async function loadFromUnifiedAPI({ subjectId, nodeId: topicNodeId, microThemeId, limit = 50 } = {}) {
    const isUnifiedTopicsActive = unifiedTopics.length > 0 && practicePaper !== "CSAT";

    // ── Resolve nodeId: prefer canonical nodeId over raw selectedTopicId ──────
    // selectedTopicId (from unifiedTopics) = microTheme string, NOT a canonical nodeId.
    // selectedTopicNodeId holds the real canonical nodeId (e.g. GS1-HIS-ANC-IVC-MT04).
    const canonicalNodeId = topicNodeId
      || (practiceScope !== "subject" ? selectedTopicNodeId : undefined)
      || undefined;

    // Fall back to microTheme string only when no canonical nodeId is available
    const rawMicroTheme = microThemeId
      || (isUnifiedTopicsActive && !canonicalNodeId && selectedTopicId ? selectedTopicId : undefined)
      || (practiceScope === "subtopic" && selectedMicroThemeIds[0] ? selectedMicroThemeIds[0] : undefined);

    const effectiveMicroTheme =
      rawMicroTheme && rawMicroTheme !== "Unknown" ? rawMicroTheme : "";

    // ── Build API params — nodeId takes strict priority over microTheme ────────
    const effectiveSubjectId = subjectId || selectedSubjectId;
    const params = { subject: effectiveSubjectId, limit };

    if (canonicalNodeId) {
      // nodeId is available — use ONLY nodeId, never send microTheme
      params.nodeId = canonicalNodeId;
    } else if (effectiveMicroTheme) {
      // No canonical nodeId — fall back to microTheme string
      params.microTheme = effectiveMicroTheme;
    }

    if (!params.nodeId && !params.microTheme && !PRELIMS_TO_UNIFIED_SUBJECT[params.subject]) return [];
    let { questions: raw } = await fetchUnifiedQuestions(params);



    console.log("[FILTER]", { nodeId: params.nodeId, microTheme: params.microTheme, returned: raw.length });
    return sanitizeQuestions(raw.map(normalizeUnifiedQuestion));
  }

  // ── Progressive test builder (Continue / Restart / Retry Mistakes) ─────────
  async function buildProgressiveTest(mode = "continue") {
    setBuilderError("");
    const nodeId = resolveCurrentTopicNodeId();
    if (!nodeId) {
      setBuilderError("Cannot determine topic node ID for progress tracking. Select a subject and topic first.");
      return;
    }

    try {
      setBuilderLoading(true);
      setResult(null);

      const payload = {
        userId: CURRENT_USER_ID,
        topicNodeId: nodeId,
        count: practiceQuestionCount,
        mode,
        stage: "prelims",
      };

      console.log("🚀 PROGRESSIVE BUILD PAYLOAD:", payload);

      const response = await fetch(`${BACKEND_URL}/api/prelims/practice/build-progressive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        // Surface the informative error (e.g. "fully completed")
        throw new Error(json?.error || `Progressive build failed (${response.status})`);
      }

      let builtQuestions = Array.isArray(json?.questions) ? json.questions : [];
      if (!builtQuestions.length) {
        // Fallback: try unified question library before surfacing error
        builtQuestions = await loadFromUnifiedAPI({ limit: practiceQuestionCount || 50 });
        if (!builtQuestions.length) {
          throw new Error(json?.error || "No questions returned from backend or unified library");
        }
        setBuilderWarning("Loaded from unified question library — progress tracking unavailable for this session.");
      }

      const safeScope = practiceScope === "subtopic" && selectedMicroThemeIds.length === 0 ? "topic" : practiceScope;
      const nextTestId = `practice_progressive_${mode}_${selectedSubjectId || "na"}_${selectedTopicId || "na"}`;

      setActiveTopicNodeId(nodeId);
      setActivePracticeMode(mode);
      setTestId(nextTestId);

      const sanitizedQuestions = sanitizeQuestions(builtQuestions);
      console.log("[RAW BUILT QUESTIONS]", builtQuestions.length);
      console.log("[SANITIZED QUESTIONS]", sanitizedQuestions.length);
      console.log("[FIRST 5 IDS]", sanitizedQuestions.slice(0, 5).map(q => q.id));
      setQuestions(sanitizedQuestions);

      setCurrentIndex(0);
      setAnswersMap({});
      setConfidenceMap({});
      setResult(null);
      setLastSubmitData(null);

      // ── Start timer ────────────────────────────────────────────────────────
      const now = Date.now();
      setTestStartTime(now);
      setPerQuestionTimeMap({});
      setQuestionEnteredAt(now);

      setTestStage("attempt");

      // Refresh progress panel after build (restart clears it)
      if (json?.progress) setTopicProgress({ ...json.progress, topicNodeId: nodeId, userId: CURRENT_USER_ID });
    } catch (error) {
      console.error("Progressive build error:", error);
      setBuilderError(error.message || "Failed to build progressive test");
      // Refresh progress so user sees the completion banner
      fetchTopicProgress(resolveCurrentTopicNodeId());
    } finally {
      setBuilderLoading(false);
    }
  }

  // ── Original full-features practice builder (subject/full-length) ──────────
  async function buildPracticeOrFullLengthTest() {
    setBuilderError("");

    if (testMode === "institutional") {
      setBuilderError(
        "Institutional placeholder is kept intact. Real institutional builder is not enabled yet."
      );
      return;
    }

    if (subtopicDisabled && testMode !== "full_length") {
      setBuilderError(
        "Select a topic that has subtopics, then choose at least one subtopic."
      );
      return;
    }

    try {
      setBuilderLoading(true);
      setResult(null);
      setBuilderWarning("");

      let payload;
      let nextTestId;

      if (testMode === "full_length") {
        const paperCode =
          fullLengthType === "csat_yearwise" ? "CSAT" : "GS";
        const selectedFullLengthPaper = paperCode === "GS"
          ? (availableYears?.fullLengthPapers || []).find((paper) => String(paper.year) === String(fullLengthYear))
          : null;

        nextTestId = selectedFullLengthPaper?.paperId || `prelims_${fullLengthYear}_${paperCode.toLowerCase()}`;

        payload = {
          mode: "full_length",
          fullLengthYear: String(fullLengthYear),
          ...(selectedFullLengthPaper?.paperId ? { fullLengthPaperId: selectedFullLengthPaper.paperId } : {}),
          practicePaper: paperCode,
          count: fullLengthType === "csat_yearwise" ? 80 : 100,
        };

        console.log("[Prelims FullLength] selected paper:", selectedFullLengthPaper || {
          year: fullLengthYear,
          paperId: nextTestId,
          questionCount: null,
        });
        console.log("[FULL LENGTH BUILD PAYLOAD]", payload);
      } else {
        const safeScope =
          practiceScope === "subtopic" && selectedMicroThemeIds.length === 0
            ? "topic"
            : practiceScope;

        nextTestId = `practice_${practicePaper.toLowerCase()}_${safeScope}_${selectedSubjectId || "na"}_${selectedTopicId || "na"}`;

        const subjectMeta = getSelectedSubjectMeta(
          PRELIMS_STRUCTURE,
          practicePaper,
          selectedSubjectId
        );

        const topicMeta = getSelectedTopicMeta(subjectMeta, selectedTopicId);

        const selectedMicroThemeMetas = getSelectedMicroThemeMetas(topicMeta, selectedMicroThemeIds);
        const topicHintIds = (topicMeta?.subtopics || []).map((item) => item.id);

        let resolvedNodeId = "";

        if (safeScope === "subject") {
          const sM = getSelectedSubjectMeta(PRELIMS_STRUCTURE, practicePaper, selectedSubjectId);
          resolvedNodeId = sM?.nodeId || "";
        }
        if (safeScope === "topic") {
          const sM = getSelectedSubjectMeta(PRELIMS_STRUCTURE, practicePaper, selectedSubjectId);
          const tM = getSelectedTopicMeta(sM, selectedTopicId);
          resolvedNodeId = tM?.nodeId || "";
        }
        if (safeScope === "subtopic") {
          const sM = getSelectedSubjectMeta(PRELIMS_STRUCTURE, practicePaper, selectedSubjectId);
          const tM = getSelectedTopicMeta(sM, selectedTopicId);
          const sMM = getSelectedMicroThemeMetas(tM, selectedMicroThemeIds);
          resolvedNodeId = sMM?.[0]?.nodeId || "";
        }

        // Final fallback: when unified topics active, PRELIMS_STRUCTURE lookup returns ""
        // because selectedTopicId is a microTheme string. Use canonical nodeId instead.
        if (!resolvedNodeId && unifiedTopics.length > 0 && practicePaper !== "CSAT") {
          resolvedNodeId = selectedTopicNodeId || "";
        }

        console.log("[PYQ START DEBUG]", {
          safeScope,
          practiceScope,
          selectedSubjectId,
          selectedTopicId,
          resolvedNodeId,
          selectedTopicNodeId,
        });

        if (!resolvedNodeId && safeScope !== "subject") {
          console.error("❌ NODE ID MISSING:", {
            selectedSubjectId,
            selectedTopicId,
            selectedTopicNodeId,
            safeScope,
          });
          setBuilderError("Cannot determine topic node ID. Please select a valid topic.");
          return;
        }

        const subjectHints = getSubjectBuildHints(selectedSubjectId, practicePaper);

        console.log("🎯 BUILD PAYLOAD:", {
          topicNodeId: resolvedNodeId,
          label: selectedTopicId,
          selectedTopicNodeId,
          unifiedTopicsActive: unifiedTopics.length > 0,
        });

        payload = {
          topicNodeId: resolvedNodeId,
          count: practiceQuestionCount,
          sort: "latest",
          practicePaper,
          practiceScope: safeScope,
          subjectId: subjectHints.subjectId,
          subjectAliases: subjectHints.subjectAliases,
          debugExpectedSubjects: subjectHints.debugExpectedSubjects,
          selectedSubjectId,
          selectedTopicLabel: topicMeta?.name || topicMeta?.label || selectedTopicId || "",
          ...(sectionYearMode === "single" && sectionYear ? { year: sectionYear } : {}),
          ...(sectionYearMode === "range" && sectionYearFrom ? { yearFrom: sectionYearFrom } : {}),
          ...(sectionYearMode === "range" && sectionYearTo ? { yearTo: sectionYearTo } : {}),
        };
      }

      const response = await fetch(`${BACKEND_URL}/api/prelims/practice/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      console.log("✅ BUILDER RESPONSE META:", {
        ok: response.ok, status: response.status,
        count: Array.isArray(json?.questions) ? json.questions.length : 0,
      });

      if (testMode === "full_length") {
        console.log("[FULL LENGTH BUILD RESPONSE]", {
          total: json?.total,
          questions: json?.questions?.length,
          debug: json?.debug,
        });
      }

      let builtQuestions = Array.isArray(json?.questions) ? json.questions : [];

      // On non-OK response (e.g. 400 "No questions found"), attempt unified fallback
      // before surfacing an error to the user.
      if (!response.ok || !builtQuestions.length) {
        const backendMsg = json?.message || json?.error || "";

        // ── CSAT yearwise fallback ───────────────────────────────────────────
        if (!builtQuestions.length && testMode === "full_length" && fullLengthType === "csat_yearwise" && fullLengthYear) {
          const { questions: unifiedRaw } = await fetchUnifiedQuestions({
            subject: "csat",
            year: fullLengthYear,
            limit: 80,
          });
          builtQuestions = sanitizeQuestions((unifiedRaw || []).map(normalizeUnifiedQuestion));
          if (builtQuestions.length) {
            setBuilderWarning(`Loaded ${builtQuestions.length} CSAT ${fullLengthYear} questions from unified library.`);
          }
        }

        // ── Generic unified fallback ─────────────────────────────────────────
        if (!builtQuestions.length) {
          builtQuestions = await loadFromUnifiedAPI({ limit: practiceQuestionCount || 50 });
          if (builtQuestions.length) {
            setBuilderWarning("Loaded from unified question library.");
          }
        }

        if (!builtQuestions.length) {
          throw new Error(backendMsg || `Practice build failed (${response.status})`);
        }
      }

      if (json?.warning) setBuilderWarning(json.warning);

      setTestId(nextTestId);
      setActiveTopicNodeId(""); // Not a tracked progressive test

      const sanitizedQuestions = sanitizeQuestions(builtQuestions);
      console.log("[RAW BUILT QUESTIONS]", builtQuestions.length);
      console.log("[SANITIZED QUESTIONS]", sanitizedQuestions.length);
      console.log("[FIRST 5 IDS]", sanitizedQuestions.slice(0, 5).map(q => q.id));
      setQuestions(sanitizedQuestions);
      console.log("[FINAL QUESTIONS BEFORE NAV]", sanitizedQuestions.length);

      setCurrentIndex(0);
      setAnswersMap({});
      setConfidenceMap({});
      setResult(null);
      // Start timer for this practice path (mirrors buildProgressiveTest)
      const now = Date.now();
      setTestStartTime(now);
      setPerQuestionTimeMap({});
      setQuestionEnteredAt(now);
      setTestStage("attempt");
    } catch (error) {
      console.error("Prelims practice build error:", error);

      // ── CSAT full-length unified fallback on builder error ────────────────
      if (testMode === "full_length" && fullLengthType === "csat_yearwise" && fullLengthYear) {
        try {
          const { questions: unifiedRaw } = await fetchUnifiedQuestions({
            subject: "csat",
            year: fullLengthYear,
            limit: 80,
          });
          const fallbackQs = sanitizeQuestions((unifiedRaw || []).map(normalizeUnifiedQuestion));
          if (fallbackQs.length) {
            const nextTestId = `prelims_${fullLengthYear}_csat`;
            setTestId(nextTestId);
            setActiveTopicNodeId("");
            setQuestions(fallbackQs);
            setCurrentIndex(0);
            setAnswersMap({});
            setConfidenceMap({});
            setResult(null);
            const now = Date.now();
            setTestStartTime(now);
            setPerQuestionTimeMap({});
            setQuestionEnteredAt(now);
            setBuilderWarning(`Loaded ${fallbackQs.length} CSAT ${fullLengthYear} questions from unified library.`);
            setBuilderError("");
            setTestStage("attempt");
            return;
          }
        } catch (fallbackErr) {
          console.error("CSAT unified fallback also failed:", fallbackErr);
        }
      }

      setQuestions([]);
      setBuilderError(error.message || "Failed to build prelims practice test");
    } finally {
      setBuilderLoading(false);
    }
  }

  // ── Test submit handler — shared by PyqTestAttempt and RC grouped view ───────
  async function handleTestSubmit() {
    try {
      setBuilderLoading(true);
      setBuilderError("");

      const finalQid = questions[currentIndex]?.id || questions[currentIndex]?.questionId;
      const finalTimeMap = { ...perQuestionTimeMap };
      if (finalQid && questionEnteredAt) {
        finalTimeMap[finalQid] = (finalTimeMap[finalQid] || 0) + (Date.now() - questionEnteredAt);
      }
      const totalTimeSpent = testStartTime ? Date.now() - testStartTime : 0;
      const timeValues = Object.values(finalTimeMap);
      const avgTimePerQuestion = timeValues.length
        ? Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length)
        : 0;

      const evaluatedQuestions = buildAttemptRows(questions, answersMap, confidenceMap);

      if (activeTopicNodeId) {
        try {
          const submitPayload = {
            userId: CURRENT_USER_ID,
            topicNodeId: activeTopicNodeId,
            stage: "prelims",
            mode: activePracticeMode,
            paperType: practicePaper === "CSAT" ? "CSAT" : "GS",
            questionIds: questions.map((q) => q?.id || q?.questionId).filter(Boolean),
            questions,
            answers: answersMap,
          };
          const submitResp = await fetch(`${BACKEND_URL}/api/prelims/practice/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitPayload),
          });
          if (submitResp.ok) {
            const submitJson = await submitResp.json();
            setLastSubmitData({ ...submitJson, totalTimeSpent, averageTimePerQuestion: avgTimePerQuestion });
            if (submitJson?.updatedProgress) {
              setTopicProgress(prev => ({
                ...(prev || {}),
                ...submitJson.updatedProgress,
                topicNodeId: activeTopicNodeId,
                userId: CURRENT_USER_ID,
              }));
            }
            if (submitJson?.attemptId && totalTimeSpent > 0) {
              fetch(`${BACKEND_URL}/api/prelims/practice/timing`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  attemptId: submitJson.attemptId,
                  userId: CURRENT_USER_ID,
                  topicNodeId: activeTopicNodeId,
                  totalTimeSpent,
                  averageTimePerQuestion: avgTimePerQuestion,
                  questionTimeMap: finalTimeMap,
                }),
              }).catch(e => console.warn("[Timing] Save failed (non-fatal):", e.message));
            }
          } else {
            console.warn("[Progress Submit] Non-OK status:", submitResp.status);
          }
        } catch (submitErr) {
          console.error("[Progress Submit] Error:", submitErr);
        }
      }

      await analyzeAttemptWithBackend({
        testId, testMode, practicePaper, practiceScope,
        fullLengthType, fullLengthYear, evaluatedQuestions,
      });

      const finalResult = buildLocalFallbackResult({
        evaluatedQuestions, testId, testMode,
        practicePaper, practiceScope, fullLengthYear,
      });
      setResult(finalResult);

      try {
        const sourceType =
          testMode === "full_length" ? "full_length"
            : practiceScope === "topic" ? "topic_test"
              : practiceScope === "subtopic" ? "topic_test"
                : "sectional_test";
        await recordTestAttempt(
          {
            testId, sourceType, paper: practicePaper,
            year: testMode === "full_length" ? fullLengthYear : null,
            subject: selectedSubjectId, topic: selectedTopicId,
            subtopic: selectedMicroThemeIds[0] || "",
          },
          evaluatedQuestions,
          finalResult.summary || {}
        );
      } catch (mistakeErr) {
        console.error("[MistakeEngine] Failed to record attempt:", mistakeErr);
      }

      try {
        await fetch(`${BACKEND_URL}/api/pyq-intelligence/attempts/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "user_1",
            testId,
            attempts: questions.map((q) => {
              const selectedAnswer = answersMap[q.id];
              const correctAnswer = q.correctAnswer || q.answer;

              return {
                questionId: q.id,
                nodeId: q.nodeId || q.syllabusNodeId,
                subjectId: q.subject,
                year: q.year,
                selectedAnswer,
                correctAnswer,
                isCorrect:
                  String(selectedAnswer || "").toUpperCase() ===
                  String(correctAnswer || "").toUpperCase(),
                timeTakenSec: timeSpentByQuestion?.[q.id] || 0,
                sourceType: testMode === "full_length" ? "full_length_pyq" : "topic_pyq",
              };
            }),
          }),
        });
      } catch (pyqIntelErr) {
        console.error("[PyqIntelligence] Failed to record attempts:", pyqIntelErr);
      }

      try {
        // localStorage removed
      } catch { /* ignore */ }

      setTestStage("result");

    } catch (error) {
      console.error("Prelims submit/analyze error:", error);
      const evaluatedQuestions = buildAttemptRows(questions, answersMap, confidenceMap);
      const fallbackResult = buildLocalFallbackResult({
        evaluatedQuestions, testId, testMode,
        practicePaper, practiceScope, fullLengthYear,
      });
      setResult(fallbackResult);
      setTestStage("result");
    } finally {
      setBuilderLoading(false);
    }
  }

  async function startWeakAreaFix(subjectId, nodeId, count = 10) {
    setBuilderError("");
    setBuilderLoading(true);
    setResult(null);
    setBuilderWarning("");
    try {
      const nextTestId = `smart_fix_${subjectId || "general"}_${Date.now()}`;
      setTestId(nextTestId);
      setActiveTopicNodeId(nodeId || "");
      setActivePracticeMode("continue");
      const unifiedSubject = PRELIMS_TO_UNIFIED_SUBJECT[subjectId] || subjectId || undefined;
      const { questions: unifiedRaw } = await fetchUnifiedQuestions({
        subject: unifiedSubject,
        nodeId: nodeId || undefined,
        limit: count,
      });
      const sanitized = sanitizeQuestions(unifiedRaw || []).slice(0, count);
      if (!sanitized.length) {
        setBuilderError("No questions found. Use the builder below to configure a test.");
        return;
      }
      setQuestions(sanitized);
      setCurrentIndex(0);
      setAnswersMap({});
      setConfidenceMap({});
      setTestStartTime(Date.now());
      setQuestionEnteredAt(Date.now());
      setTestStage("attempt");
    } catch (err) {
      setBuilderError("Could not start the test. Use the builder below.");
    } finally {
      setBuilderLoading(false);
    }
  }

  async function startAdaptiveTest() {
    setBuilderError("");
    setBuilderLoading(true);
    setResult(null);
    setBuilderWarning("");
    try {
      const payload = {
        userId: "user_1",
        subjectId: selectedSubjectId || null,
        count: 25
      };

      const resp = await fetch(`${BACKEND_URL}/api/prelims/adaptive-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await resp.json();
      
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed to load adaptive test");
      }
      
      console.log("[ADAPTIVE TEST]", {
        count: data.questions?.length,
        debug: data.debug
      });
      
      if (!data.questions || data.questions.length === 0) {
        setBuilderError("No questions returned for adaptive test.");
        return;
      }

      const nextTestId = `adaptive_test_${selectedSubjectId || "general"}_${Date.now()}`;
      setTestId(nextTestId);
      setActiveTopicNodeId("");
      setActivePracticeMode("adaptive");
      
      const sanitized = sanitizeQuestions(data.questions);
      setQuestions(sanitized);
      setCurrentIndex(0);
      setAnswersMap({});
      setConfidenceMap({});
      setTestStartTime(Date.now());
      setQuestionEnteredAt(Date.now());
      setTestStage("attempt");
    } catch (err) {
      setBuilderError(err.message || "Could not start the adaptive test.");
    } finally {
      setBuilderLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      {testStage === "start" && (
        <>
          {/* ── Intelligence card: Weak Area Recommendation ── */}
          <div style={{
            background: "#0d1224",
            border: "1px solid #2d3a5c",
            borderTop: "1px solid #4338ca",
            borderRadius: 14,
            padding: "20px 22px",
            marginBottom: 16,
            position: "relative",
          }}>

            {weakAreaSuggestion.hasData ? (
              <div>
                {/* Label row */}
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12 }}>◎</span> Your Next Best Test
                </div>

                {/* Subject + target (side by side) */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2, marginBottom: weakAreaSuggestion.topic ? 4 : 0 }}>
                      {weakAreaSuggestion.subject}
                    </div>
                    {weakAreaSuggestion.topic && (
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#818cf8", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {weakAreaSuggestion.topic}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>Target</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>85%+</div>
                  </div>
                </div>

                {/* Stats pills row — compact inline */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {weakAreaSuggestion.accuracy != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#131d38", border: "1px solid #2d3a5c", borderRadius: 8, padding: "6px 10px" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(#818cf8 ${weakAreaSuggestion.accuracy * 3.6}deg, #1e2a45 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0d1224", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#a78bfa" }}>{weakAreaSuggestion.accuracy}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1 }}>Your Accuracy</div>
                        {weakAreaSuggestion.previousAccuracy != null && (
                          <div style={{ fontSize: 10, color: weakAreaSuggestion.accuracy >= weakAreaSuggestion.previousAccuracy ? "#4ade80" : "#f87171", fontWeight: 700, lineHeight: 1, marginTop: 2 }}>
                            {weakAreaSuggestion.accuracy >= weakAreaSuggestion.previousAccuracy ? "↑" : "↓"} from {weakAreaSuggestion.previousAccuracy}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {weakAreaSuggestion.lastRevisedDays != null && (
                    <div style={{ background: "#131d38", border: "1px solid #2d3a5c", borderRadius: 8, padding: "6px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{weakAreaSuggestion.lastRevisedDays} Days</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Last Revised</div>
                    </div>
                  )}
                  {weakAreaSuggestion.priority && (
                    <div style={{
                      background: weakAreaSuggestion.priority === "Critical" ? "#1f1020" : "#1a1608",
                      border: `1px solid ${weakAreaSuggestion.priority === "Critical" ? "#7f1d1d" : "#78350f"}`,
                      borderRadius: 8, padding: "6px 12px", display: "flex", flexDirection: "column", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: weakAreaSuggestion.priority === "Critical" ? "#f87171" : "#fbbf24", lineHeight: 1 }}>{weakAreaSuggestion.priority}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>Priority (AI)</div>
                    </div>
                  )}
                </div>

                {/* Why this test? */}
                {weakAreaSuggestion.whyBullets?.length > 0 && (
                  <div style={{ marginBottom: 16, paddingLeft: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: 0.5, marginBottom: 6 }}>Why this test?</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {weakAreaSuggestion.whyBullets.map((b, i) => (
                        <li key={i} style={{ fontSize: 12, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366f1", marginTop: 4, flexShrink: 0 }} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA row */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button
                    type="button"
                    onClick={() => startWeakAreaFix(weakAreaSuggestion.subjectId, weakAreaSuggestion.nodeId, 10)}
                    disabled={builderLoading}
                    style={{
                      background: builderLoading ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      color: "#fff", border: "none", borderRadius: 10,
                      padding: "11px 28px", fontWeight: 700, fontSize: 14,
                      cursor: builderLoading ? "not-allowed" : "pointer",
                      boxShadow: builderLoading ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
                      letterSpacing: 0.2, fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >
                    {builderLoading ? "Loading…" : "Start Smart Test →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    style={{
                      background: "none", border: "none", color: "#6366f1",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      padding: 0, fontFamily: "inherit",
                      textDecoration: "underline", textUnderlineOffset: 3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ◎ Preview 10 Questions
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 }}>
                  Recommended Next Test
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 6 }}>
                  {selectedSubjectId
                    ? `Start with ${subjects.find(s => s.id === selectedSubjectId)?.label || selectedSubjectId}`
                    : "Take your first test"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 16, lineHeight: 1.5 }}>
                  {selectedSubjectId ? "Continue practising PYQs from this subject." : "Complete a test and your AI weak-area card unlocks here."}
                </div>
                <button
                  type="button"
                  onClick={() => startWeakAreaFix(selectedSubjectId || "ancient_history", "", 10)}
                  disabled={builderLoading}
                  style={{
                    background: builderLoading ? "rgba(14,165,233,0.15)" : "linear-gradient(135deg, #0284c7, #0ea5e9)",
                    color: "#fff", border: "none", borderRadius: 10,
                    padding: "11px 28px", fontWeight: 700, fontSize: 14,
                    cursor: builderLoading ? "not-allowed" : "pointer",
                    boxShadow: builderLoading ? "none" : "0 4px 16px rgba(14,165,233,0.28)",
                    letterSpacing: 0.2, fontFamily: "inherit",
                  }}
                >
                  {builderLoading ? "Loading…" : "Start Smart Test →"}
                </button>
              </div>
            )}
          </div>

          {/* ── Adaptive Weakness Test Card ── */}
          <div style={{
            background: "#0d1224",
            border: "1px solid #2d3a5c",
            borderLeft: "4px solid #ec4899",
            borderRadius: 14,
            padding: "20px 22px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>
                Adaptive Weakness Test
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Take a customized test targeting your weakest areas first.
              </div>
            </div>
            <button
              type="button"
              onClick={startAdaptiveTest}
              disabled={builderLoading}
              style={{
                background: builderLoading ? "rgba(236,72,153,0.2)" : "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 24px", fontWeight: 700, fontSize: 13,
                cursor: builderLoading ? "not-allowed" : "pointer",
                boxShadow: builderLoading ? "none" : "0 4px 12px rgba(236,72,153,0.3)",
                letterSpacing: 0.2, fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              {builderLoading ? "Loading…" : "Start Adaptive Test"}
            </button>
          </div>

          {/* ── Adaptive Next Actions card ── */}
          {adaptiveActions.length > 0 && (
            <div style={{
              background: "#0d1224",
              border: "1px solid #2d3a5c",
              borderTop: "2px solid #10b981",
              borderRadius: 14,
              padding: "20px 22px",
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#10b981",
                letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 13 }}>⚡</span> Adaptive Next Actions
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {adaptiveActions.slice(0, 3).map((action, idx) => {
                  const levelColors = {
                    critical: { bg: "#1f1020", border: "#7f1d1d", text: "#f87171", chipBg: "rgba(248,113,113,0.15)" },
                    weak: { bg: "#1a1608", border: "#78350f", text: "#fbbf24", chipBg: "rgba(251,191,36,0.15)" },
                    needs_revision: { bg: "#0c1a2e", border: "#1e3a5f", text: "#38bdf8", chipBg: "rgba(56,189,248,0.15)" },
                    stable: { bg: "#0d1a12", border: "#14532d", text: "#4ade80", chipBg: "rgba(74,222,128,0.15)" },
                  };
                  const lc = levelColors[action.weaknessLevel] || levelColors.stable;
                  const nodeName = prettyNodeName(action.nodeId);

                  return (
                    <div key={action.nodeId || idx} style={{
                      background: lc.bg,
                      border: `1px solid ${lc.border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 14, fontWeight: 700, color: "#e2e8f0",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220,
                          }}>
                            {nodeName || action.subject || `Node ${idx + 1}`}
                          </span>
                          <span style={{
                            padding: "2px 8px", borderRadius: 99, fontSize: 10,
                            fontWeight: 700, background: lc.chipBg,
                            color: lc.text, border: `1px solid ${lc.border}`,
                            textTransform: "uppercase", letterSpacing: 0.5,
                          }}>
                            {(action.weaknessLevel || "").replace("_", " ")}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                          {action.actionText}
                        </div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                          Score: {action.weaknessScore} · Accuracy: {action.accuracyPercent}% · Wrong: {action.wrongCount}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (action.nodeId) {
                            window.location.href = `/pyq/topic/${encodeURIComponent(action.nodeId)}`;
                          }
                        }}
                        style={{
                          background: `linear-gradient(135deg, ${lc.text}22, ${lc.text}10)`,
                          border: `1px solid ${lc.text}44`,
                          borderRadius: 8,
                          padding: "8px 16px",
                          color: lc.text,
                          fontWeight: 700, fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Practice Now
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {adaptiveActionsLoading && (
            <div style={{
              background: "#0d1224", border: "1px solid #1e2a45", borderRadius: 14,
              padding: "16px 22px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Loading adaptive recommendations…</div>
            </div>
          )}

          {/* ── Quick Start tiles ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              Practice Command Center
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => startWeakAreaFix(
                  weakAreaSuggestion.hasData ? weakAreaSuggestion.subjectId : (selectedSubjectId || "ancient_history"),
                  weakAreaSuggestion.hasData ? weakAreaSuggestion.nodeId : "",
                  10
                )}
                disabled={builderLoading}
                style={{
                  background: "#131d38", border: "1px solid #3d2e10",
                  borderLeft: "3px solid #d97706",
                  borderRadius: 12, padding: "14px 16px", textAlign: "left",
                  cursor: builderLoading ? "not-allowed" : "pointer",
                  color: "#f1f5f9", fontFamily: "inherit",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#f59e0b", marginBottom: 3 }}>AI Weak Area</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Let AI pick weak areas for you automatically</div>
              </button>
              <button
                type="button"
                onClick={() => { setPracticeScope("subject"); setTestMode("sectional"); setCustomizeOpen(true); }}
                style={{
                  background: "#131d38", border: "1px solid #1e2a45",
                  borderLeft: "3px solid #3b82f6",
                  borderRadius: 12, padding: "14px 16px", textAlign: "left",
                  cursor: "pointer", color: "#f1f5f9", fontFamily: "inherit",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#93c5fd", marginBottom: 3 }}>Full Subject</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Practice all topics from the subject</div>
              </button>
              <button
                type="button"
                onClick={() => { setPracticeScope("topic"); setCustomizeOpen(true); }}
                style={{
                  background: "#131d38", border: "1px solid #1e2a45",
                  borderLeft: "3px solid #22c55e",
                  borderRadius: 12, padding: "14px 16px", textAlign: "left",
                  cursor: "pointer", color: "#f1f5f9", fontFamily: "inherit",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#86efac", marginBottom: 3 }}>Topic-wise</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Practice a specific topic in depth</div>
              </button>
              <button
                type="button"
                onClick={() => { setPracticeScope("subtopic"); setCustomizeOpen(true); }}
                style={{
                  background: "#131d38", border: "1px solid #1e2a45",
                  borderLeft: "3px solid #a78bfa",
                  borderRadius: 12, padding: "14px 16px", textAlign: "left",
                  cursor: "pointer", color: "#f1f5f9", fontFamily: "inherit",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#c4b5fd", marginBottom: 3 }}>Subtopic-wise</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Focus on micro topics for better accuracy</div>
              </button>
            </div>
          </div>
        </>
      )}

      <section style={sectionStyle}>
        <div style={{ ...cardStyle }}>
          {testStage !== "start" && (
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: 0.2, color: "#e2e8f0" }}>PYQ Test Flow</h2>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                Start → Attempt → Result
              </div>
            </div>
          )}

          {builderError && testStage === "start" && (() => {
            // Suppress legacy "Unknown subtopic" errors for CSAT —
            // the unified API fallback handles CSAT loading, so the old builder error is noise.
            const isStaleCSATUnknown =
              practicePaper === "CSAT" &&
              (builderError.includes('"Unknown"') || builderError.includes("Unknown"));
            if (isStaleCSATUnknown) return null;
            return (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(239, 68, 68, 0.22)",
                  background: "rgba(127, 29, 29, 0.14)",
                  color: "#fecaca",
                }}
              >
                {builderError}
              </div>
            );
          })()}


          {practiceScope === "subtopic" &&
            selectedTopicId &&
            microThemes.length === 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  background: "rgba(120, 53, 15, 0.18)",
                  color: "#fde68a",
                }}
              >
                No subtopics are configured for this topic yet. Choose another
                topic or switch to Topic-wise mode.
              </div>
            )}

          {testStage === "start" && (
            <div>
              <button
                type="button"
                onClick={() => setCustomizeOpen(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: customizeOpen ? "rgba(15,23,42,0.8)" : "rgba(30,41,59,0.5)",
                  border: "1px solid rgba(148,163,184,0.15)",
                  borderRadius: customizeOpen ? "12px 12px 0 0" : 12,
                  padding: "12px 18px", cursor: "pointer", color: "#94a3b8",
                  fontWeight: 700, fontSize: 13, fontFamily: "inherit", marginBottom: 0,
                }}
              >
                <span>⚙ Customize Test</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{customizeOpen ? "▲ Collapse" : "▼ Expand"}</span>
              </button>
              {customizeOpen && (
                <div style={{ border: "1px solid rgba(148,163,184,0.15)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px 0 4px 0" }}>
                  <PyqTestStart
                testMode={testMode}
                setTestMode={setTestMode}
                fullLengthType={fullLengthType}
                setFullLengthType={setFullLengthType}
                fullLengthYear={fullLengthYear}
                setFullLengthYear={setFullLengthYear}
                institutionalForm={institutionalForm}
                setInstitutionalForm={setInstitutionalForm}
                practicePaper={practicePaper}
                setPracticePaper={setPracticePaper}
                practiceScope={practiceScope}
                setPracticeScope={(nextScope) => {
                  setBuilderError("");
                  setPracticeScope(nextScope);
                }}
                selectedSubjectId={selectedSubjectId}
                setSelectedSubjectId={setSelectedSubjectId}
                selectedTopicId={selectedTopicId}
                setSelectedTopicId={setSelectedTopicId}
                selectedMicroThemeIds={selectedMicroThemeIds}
                setSelectedMicroThemeIds={setSelectedMicroThemeIds}
                practiceQuestionCount={practiceQuestionCount}
                setPracticeQuestionCount={setPracticeQuestionCount}
                subjects={subjects}
                topics={topics}
                topicsHint={
                  unifiedTopicsLoading
                    ? "Loading live topics…"
                    : unifiedTopicsError
                    ? unifiedTopicsError
                    : unifiedTopics.length > 0 && practicePaper !== "CSAT"
                    ? `${unifiedTopics.length} live topics from question library`
                    : ""
                }
                microThemes={microThemes}
                availableQuestionCount={availableQuestionCount}
                onStart={buildPracticeOrFullLengthTest}
                loading={builderLoading}
                error={builderError || null}
                disableStart={disableStart}
                availableYears={availableYears}
                sectionYearMode={sectionYearMode}
                setSectionYearMode={setSectionYearMode}
                sectionYear={sectionYear}
                setSectionYear={setSectionYear}
                sectionYearFrom={sectionYearFrom}
                setSectionYearFrom={setSectionYearFrom}
                sectionYearTo={sectionYearTo}
                setSectionYearTo={setSectionYearTo}
                  />
                </div>
              )}
            </div>
          )}

          {testStage === "attempt" && builderWarning && (
            <div style={{
              padding: "10px 14px", borderRadius: 12, marginBottom: 4,
              background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)",
              color: "#fef08a", fontSize: 13, fontWeight: 600,
            }}>
              ⚠ {builderWarning}
            </div>
          )}

          {testStage === "attempt" && testMode === "sectional" && practicePaper === "CSAT" && selectedSubjectId === "csat_rc" && rcPassageGroups.length > 0 && (() => {
            const totalQ = questions.length;
            const answeredQ = Object.keys(answersMap).length;
            const attemptedPassages = rcPassageGroups.filter(g =>
              g.questions.some(q => answersMap[q.id || q.questionId || q.qid])
            ).length;
            const mm = String(Math.floor(rcElapsedSeconds / 60)).padStart(2, "0");
            const ss = String(rcElapsedSeconds % 60).padStart(2, "0");

            return (
              <div>
                {/* ── RC header: title + stats + timer ─────────────────────── */}
                <div style={{
                  marginBottom: 12, padding: "14px 18px",
                  background: "rgba(15,23,42,0.88)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#e0f2fe" }}>
                        CSAT · Reading Comprehension
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {rcPassageGroups.length} passages · {totalQ} questions
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {/* Timer */}
                      <span style={{
                        fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                        color: "#a78bfa", background: "rgba(167,139,250,0.1)",
                        border: "1px solid rgba(167,139,250,0.25)",
                        borderRadius: 8, padding: "4px 12px", letterSpacing: "0.05em",
                      }}>
                        ⏱ {mm}:{ss}
                      </span>
                      {/* Passage */}
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "#38bdf8",
                        background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                        borderRadius: 8, padding: "4px 12px",
                      }}>
                        P {currentRcPassageIndex + 1}/{rcPassageGroups.length}
                      </span>
                      {/* Questions answered */}
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: answeredQ === totalQ ? "#22c55e" : "#f59e0b",
                        background: answeredQ === totalQ ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                        border: `1px solid ${answeredQ === totalQ ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
                        borderRadius: 8, padding: "4px 12px",
                      }}>
                        {answeredQ}/{totalQ} Q
                      </span>
                      {/* Passages attempted */}
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "#94a3b8",
                        background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: 8, padding: "4px 12px",
                      }}>
                        {attemptedPassages}/{rcPassageGroups.length} passages
                      </span>
                      {builderLoading && (
                        <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Submitting…</span>
                      )}
                    </div>
                  </div>

                  {/* ── Passage palette ──────────────────────────────────── */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {rcPassageGroups.map((grp, idx) => {
                      const grpAnswered = grp.questions.filter(q => answersMap[q.id || q.questionId || q.qid]).length;
                      const grpTotal = grp.questions.length;
                      const isCurrent = idx === currentRcPassageIndex;
                      const isFullyAnswered = grpAnswered === grpTotal && grpTotal > 0;
                      const isPartial = grpAnswered > 0 && !isFullyAnswered;
                      const color = isCurrent ? "#38bdf8" : isFullyAnswered ? "#22c55e" : isPartial ? "#f59e0b" : "#64748b";
                      return (
                        <button
                          key={grp.passageId}
                          type="button"
                          onClick={() => setCurrentRcPassageIndex(idx)}
                          style={{
                            minWidth: 42, height: 32, borderRadius: 8,
                            fontSize: 11, fontWeight: 800,
                            border: `1px solid ${color}${isCurrent ? "88" : "44"}`,
                            background: isCurrent ? `${color}20` : `${color}0a`,
                            color,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s",
                          }}
                        >
                          P{idx + 1}
                          {grpAnswered > 0 && (
                            <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.85 }}>
                              {grpAnswered}/{grpTotal}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── RcPassageBlock ────────────────────────────────────────── */}
                <RcPassageBlock
                  key={rcPassageGroups[currentRcPassageIndex]?.passageId}
                  passage={rcPassageGroups[currentRcPassageIndex]?.passageText}
                  questions={rcPassageGroups[currentRcPassageIndex]?.questions || []}
                  passageIndex={currentRcPassageIndex}
                  totalPassages={rcPassageGroups.length}
                  answersMap={answersMap}
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
                  confidenceMap={confidenceMap}
                  onSetConfidence={(qid, level) =>
                    setConfidenceMap((prev) => ({ ...prev, [qid]: level }))
                  }
                  onPrevPassage={() =>
                    setCurrentRcPassageIndex((i) => Math.max(0, i - 1))
                  }
                  onNextPassage={() =>
                    setCurrentRcPassageIndex((i) => Math.min(rcPassageGroups.length - 1, i + 1))
                  }
                  onSubmit={handleTestSubmit}
                  submitting={builderLoading}
                />
              </div>
            );
          })()}

          {testStage === "attempt" && !(testMode === "sectional" && practicePaper === "CSAT" && selectedSubjectId === "csat_rc" && rcPassageGroups.length > 0) && (
            <PyqTestAttempt
              key={`${testId}_${selectedSubjectId}_${selectedTopicId}_${practiceScope}`}
              testMeta={{
                mode: testMode === "full_length" ? "full_length" : "practice",
                paperType: practicePaper,
                variant: practiceScope,
                year: fullLengthYear,
                label: (() => {
                  if (testMode === "full_length") return `${practicePaper} Full Length${fullLengthYear ? ` · ${fullLengthYear}` : ""}`;
                  const subjLabel = subjects?.find(s => s.id === selectedSubjectId)?.label || selectedSubjectId || "Mixed Practice";
                  const prefix = practicePaper && !String(subjLabel).startsWith(practicePaper) ? `${practicePaper} ` : "";

                  let scopeStr = "";
                  if (practiceScope === "subject") scopeStr = "Full Subject";
                  else if (practiceScope === "topic") scopeStr = "Topic Wise";
                  else if (practiceScope === "subtopic") scopeStr = "Subtopic Wise";
                  else if (practiceScope === "mixed") scopeStr = "Mixed Practice";

                  const yearStr = fullLengthYear && fullLengthYear !== "na" ? String(fullLengthYear) : "Mixed Years";
                  return [`${prefix}${subjLabel}`, scopeStr, yearStr].filter(Boolean).join(" · ");
                })(),
              }}
              questions={questions}
              currentIndex={currentIndex}
              currentQuestion={questions[currentIndex]}
              answersMap={answersMap}
              confidenceMap={confidenceMap}
              testStartTime={testStartTime}
              practiceMode={selectedPracticeMode}
              questionCount={practiceQuestionCount}
              onSetConfidence={(qid, level) => {
                setConfidenceMap((prev) => ({ ...prev, [qid]: level }));
              }}
              onSelectOption={(qid, option) => {
                setAnswersMap((prev) => ({ ...prev, [qid]: option }));
              }}
              onClearOption={(qid) => {
                setAnswersMap((prev) => {
                  const copy = { ...prev };
                  delete copy[qid];
                  return copy;
                });
              }}
              onPrev={() => {
                recordCurrentQuestionTime();
                setQuestionEnteredAt(Date.now());
                setCurrentIndex((i) => Math.max(i - 1, 0));
              }}
              onNext={() => {
                recordCurrentQuestionTime();
                setQuestionEnteredAt(Date.now());
                setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
              }}
              onJumpTo={(i) => {
                recordCurrentQuestionTime();
                setQuestionEnteredAt(Date.now());
                setCurrentIndex(i);
              }}
              onSubmit={handleTestSubmit}
            />
          )}

          {testStage === "result" && (
            <div style={{ display: "grid", gap: 18 }}>

              {/* ── UPSC Score Card (this attempt) ── */}
              {lastSubmitData?.summary && (
                <div style={{
                  ...cardStyle,
                  background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(168,85,247,0.06))",
                  border: "1px solid rgba(56,189,248,0.22)",
                  padding: 20,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#e0f2fe", marginBottom: 14, letterSpacing: 0.3 }}>
                    This Attempt — UPSC Score
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px,1fr))", gap: 10, marginBottom: 14 }}>
                    {[
                      { label: "Total", value: lastSubmitData.summary.total, color: "#94a3b8" },
                      { label: "Correct", value: lastSubmitData.summary.correct, color: "#22c55e" },
                      { label: "Wrong", value: lastSubmitData.summary.wrong, color: "#f87171" },
                      { label: "Unanswered", value: lastSubmitData.summary.unattempted, color: "#f59e0b" },
                      { label: "+Marks", value: `+${lastSubmitData.summary.positiveMarks}`, color: "#4ade80" },
                      { label: "−Marks", value: `−${lastSubmitData.summary.negativeMarks}`, color: "#f87171" },
                      { label: "Score", value: lastSubmitData.summary.finalScore, color: "#38bdf8" },
                      { label: "Accuracy", value: `${lastSubmitData.summary.accuracy}%`, color: "#a78bfa" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: "rgba(15,23,42,0.75)", borderRadius: 10,
                        padding: "10px 8px", textAlign: "center",
                        border: "1px solid rgba(148,163,184,0.1)",
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Timing row */}
                  {lastSubmitData.totalTimeSpent > 0 && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={statPill("#60a5fa")}>
                        ⏱ {Math.round(lastSubmitData.totalTimeSpent / 1000)}s total
                      </span>
                      <span style={statPill("#818cf8")}>
                        ~{Math.round(lastSubmitData.averageTimePerQuestion / 1000)}s avg / question
                      </span>
                      <span style={statPill("#94a3b8")}>
                        Paper: {lastSubmitData.summary.paperType || "GS"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Overall Subject Progress Card ── */}
              {lastSubmitData?.updatedProgress && (() => {
                const p = lastSubmitData.updatedProgress;
                const cov = p.coveragePercent || 0;
                return (
                  <div style={{
                    ...cardStyle,
                    background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(168,85,247,0.04))",
                    border: "1px solid rgba(34,197,94,0.18)",
                    padding: 20,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#d1fae5", marginBottom: 14, letterSpacing: 0.3 }}>
                      Overall Subject Progress
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "Unique Seen", value: p.servedQuestionIds?.length ?? 0, color: "#38bdf8" },
                        { label: "Correct", value: p.correctQuestionIds?.length ?? 0, color: "#22c55e" },
                        { label: "Wrong", value: p.wrongQuestionIds?.length ?? 0, color: "#f87171" },
                        { label: "Coverage", value: `${cov}%`, color: "#a78bfa" },
                        { label: "Attempts", value: p.attemptsCount ?? 0, color: "#94a3b8" },
                        { label: "Best Score", value: p.bestScore ?? "—", color: "#4ade80" },
                        { label: "Last Score", value: p.latestScore ?? "—", color: "#60a5fa" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{
                          background: "rgba(15,23,42,0.75)", borderRadius: 10,
                          padding: "10px 8px", textAlign: "center",
                          border: "1px solid rgba(148,163,184,0.1)",
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "rgba(30,41,59,0.8)", borderRadius: 99, height: 7, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${cov}%`,
                        background: cov >= 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#0ea5e9,#8b5cf6)",
                        borderRadius: 99, transition: "width 0.4s",
                      }} />
                    </div>
                  </div>
                );
              })()}

              {/* ── Action buttons ── */}
              {activeTopicNodeId && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { mode: "continue", label: "▶ Continue Unseen", color: "#38bdf8" },
                    { mode: "retry_wrong", label: "🔁 Retry Wrong", color: "#f87171" },
                    { mode: "retry_attempted", label: "↩ Retry Attempted", color: "#f59e0b" },
                  ].map(({ mode, label, color }) => (
                    <button key={mode} type="button"
                      onClick={() => {
                        setTestStage("start");
                        setResult(null);
                        setLastSubmitData(null);
                        setSelectedPracticeMode(mode);
                        if (activeTopicNodeId) fetchTopicProgress(activeTopicNodeId);
                      }}
                      style={{
                        height: 44, padding: "0 18px", borderRadius: 12,
                        border: `1px solid ${color}44`,
                        background: `${color}14`,
                        color, fontWeight: 700, fontSize: 13, cursor: "pointer",
                      }}
                    >{label}</button>
                  ))}
                  <button type="button"
                    onClick={() => {
                      setTestStage("start");
                      setResult(null);
                      setLastSubmitData(null);
                      if (activeTopicNodeId) fetchTopicProgress(activeTopicNodeId);
                    }}
                    style={{
                      height: 44, padding: "0 18px", borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.2)",
                      background: "rgba(30,41,59,0.6)",
                      color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >← Back to Subject</button>
                </div>
              )}

              {/* ── Existing detailed result ── */}
              <PyqTestResult
                result={result}
                testId={testId}
                testMode={testMode}
                onRestart={() => {
                  setTestStage("start");
                  setResult(null);
                  setLastSubmitData(null);
                  setQuestions([]);
                  setCurrentIndex(0);
                  setAnswersMap({});
                  setConfidenceMap({});
                  if (activeTopicNodeId) fetchTopicProgress(activeTopicNodeId);
                }}
                onReattempt={() => {
                  setTestStage("attempt");
                  setCurrentIndex(0);
                  setAnswersMap({});
                  setConfidenceMap({});
                  setResult(null);
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Dashboard + info panels — hidden during active attempt to keep focus */}
      {testStage !== "attempt" && (
        <>
          <section style={sectionStyle}>
            {dashboardLoading && (
              <div style={cardStyle}>
                <div style={{ color: "#93c5fd", fontWeight: 700 }}>
                  Loading AIR-1 intelligence dashboard...
                </div>
              </div>
            )}

            {dashboardError && !dashboardLoading && (
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(239, 68, 68, 0.22)",
                  background: "rgba(127, 29, 29, 0.14)",
                  color: "#fecaca",
                }}
              >
                {dashboardError}
              </div>
            )}

            {!dashboardLoading && !dashboardError && dashboard && (
              <div style={{ display: "grid", gap: 18 }}>
                <DashboardSummary
                  summary={dashboard.summary}
                  behaviour={dashboard.behaviour}
                />

                <WeakAreasPanel
                  weakSubjects={dashboard.weakSubjects}
                  weakNodes={dashboard.weakNodes}
                  weakTypes={dashboard.weakTypes}
                />

                <TrapPanel
                  trapAlerts={dashboard.trapAlerts}
                  trapStats={dashboard.trapStats}
                />

                <RecommendationsPanel
                  recommendations={dashboard.recommendations}
                />

                <StatsBreakdownPanel
                  subjectStats={dashboard.subjectStats}
                  typeStats={dashboard.typeStats}
                  difficultyStats={dashboard.difficultyStats}
                  nodeStats={dashboard.nodeStats}
                />
              </div>
            )}
          </section>

          {dashboard && (
            <section style={sectionStyle}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 14,
                }}
              >
                <InfoBlock title="Recent History" items={recentHistory} accent="#38bdf8" />
                <InfoBlock title="Mistake Book Signals" items={mistakeBookSignals} accent="#f59e0b" />
                <InfoBlock title="Next Actions" items={nextActions} accent="#22c55e" />
                <InfoBlock title="Insights" items={insights} accent="#a78bfa" />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
