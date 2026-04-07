import { useEffect, useMemo, useState, useCallback } from "react";
import { BACKEND_URL } from "../config";
import { PRELIMS_STRUCTURE } from "../data/prelimsStructure";
import { recordTestAttempt, buildTestId } from "../utils/prelimsMistakeEngine";

const CURRENT_USER_ID = "user_1";


import PyqTestStart from "../components/Prelims/PyqTestStart";
import PyqTestAttempt from "../components/Prelims/PyqTestAttempt";
import PyqTestResult from "../components/Prelims/PyqTestResult";

import DashboardSummary from "../components/Prelims/DashboardSummary";
import WeakAreasPanel from "../components/Prelims/WeakAreasPanel";
import TrapPanel from "../components/Prelims/TrapPanel";
import RecommendationsPanel from "../components/Prelims/RecommendationsPanel";
import StatsBreakdownPanel from "../components/Prelims/StatsBreakdownPanel";

const pageStyle = {
  minHeight: "100%",
  padding: 20,
  background:
    "radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 22%), radial-gradient(circle at top left, rgba(168, 85, 247, 0.08), transparent 24%), #020617",
  color: "#f8fafc",
};

const heroStyle = {
  background:
    "linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.92))",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: 24,
  padding: 22,
  marginBottom: 18,
  boxShadow: "0 20px 50px rgba(2, 6, 23, 0.32)",
};

const sectionStyle = {
  marginTop: 18,
};

const cardStyle = {
  background: "rgba(15, 23, 42, 0.88)",
  border: "1px solid rgba(148, 163, 184, 0.10)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.28)",
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
  return {
    ...q,
    id: q.id || q.questionId || q.qid || "",
    question: q.question || q.questionText || q.prompt || q.stem || "",
    options: q.options || q.choices || null,
    passageText: q.passageText || q.passage || "",
  };
}

function sanitizeQuestions(rawQuestions) {
  return dedupeQuestions((rawQuestions || []).map(normalizeQuestion).filter(Boolean));
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
  // Live RC subtopic counts fetched from backend (classifier-based)
  const [rcTopicCounts, setRcTopicCounts] = useState({});

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [practicePaper, setPracticePaper] = useState("GS");
  const [practiceScope, setPracticeScope] = useState("subject");

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedMicroThemeIds, setSelectedMicroThemeIds] = useState([]);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(10);

  const [fullLengthType, setFullLengthType] = useState("gs_yearwise");
  const [fullLengthYear, setFullLengthYear] = useState("2020");

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

  // Fetch actual buildable GS counts from backend once on mount
  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_URL}/api/prelims/gs/counts`)
      .then((r) => r.json())
      .then((json) => { if (active && json?.ok) setGsCountsFromAPI(json.counts); })
      .catch(() => { });
    return () => { active = false; };
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

  const subjects = useMemo(() => {
    const base =
      practicePaper === "GS"
        ? PRELIMS_STRUCTURE?.gs || []
        : PRELIMS_STRUCTURE?.csat || [];

    return base.map((item) => ({
      id: item.id,
      label: item.label || item.name || item.id,
      // Use live API count for GS subjects when available; fall back to static
      count: (practicePaper === "GS" && gsCountsFromAPI?.[item.id] != null)
        ? gsCountsFromAPI[item.id]
        : (item.count || 0),
    }));
  }, [practicePaper, gsCountsFromAPI]);

  const topics = useMemo(() => {
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
  }, [practicePaper, selectedSubjectId, rcTopicCounts]);

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
    if (!subjectMeta) return "";
    if (practiceScope === "subject") return subjectMeta.nodeId || "";
    const topicMeta = (subjectMeta.topics || []).find((t) => t.id === selectedTopicId);
    if (!topicMeta) return subjectMeta.nodeId || "";
    if (practiceScope === "topic") return topicMeta.nodeId || subjectMeta.nodeId || "";
    const subtopicMeta = (topicMeta.subtopics || []).find((s) => selectedMicroThemeIds.includes(s.id));
    return subtopicMeta?.nodeId || topicMeta.nodeId || subjectMeta.nodeId || "";
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

  useEffect(() => {
    setSelectedSubjectId("");
    setSelectedTopicId("");
    setSelectedMicroThemeIds([]);
    setBuilderError("");
    setTopicProgress(null);
  }, [practicePaper]);

  useEffect(() => {
    setSelectedTopicId("");
    setSelectedMicroThemeIds([]);
    setBuilderError("");
    setTopicProgress(null);
  }, [selectedSubjectId]);

  useEffect(() => {
    setSelectedMicroThemeIds([]);
    setBuilderError("");
  }, [selectedTopicId]);

  useEffect(() => {
    setPracticeQuestionCount((prev) => {
      const max = Math.max(availableQuestionCount || 1, 1);
      return Math.min(prev || 1, max);
    });
  }, [availableQuestionCount]);

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

  const subtopicDisabled =
    practiceScope === "subtopic" &&
    (!selectedTopicId || microThemes.length === 0);

  const disableStart =
    builderLoading ||
    (testMode !== "institutional" &&
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

      const builtQuestions = Array.isArray(json?.questions) ? json.questions : [];
      if (!builtQuestions.length) {
        throw new Error(json?.error || "No questions returned from backend");
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

    if (subtopicDisabled) {
      setBuilderError(
        "Select a topic that has subtopics, then choose at least one subtopic."
      );
      return;
    }

    try {
      setBuilderLoading(true);
      setResult(null);

      let payload;
      let nextTestId;

      if (testMode === "full_length") {
        const paperCode =
          fullLengthType === "csat_yearwise" ? "CSAT" : "GS";

        nextTestId = `prelims_${fullLengthYear}_${paperCode.toLowerCase()}`;

        payload = {
          mode: "full_length",
          fullLengthYear: String(fullLengthYear),
          practicePaper: paperCode,
          count: fullLengthType === "csat_yearwise" ? 80 : 100,
        };

        console.log("🚀 FULL LENGTH BUILD PAYLOAD:", payload);
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

        const subjectHints = getSubjectBuildHints(selectedSubjectId, practicePaper);

        console.log("🚀 PRACTICE BUILD CONTEXT:", {
          practicePaper, practiceScope, safeScope, selectedSubjectId,
          selectedTopicId, selectedMicroThemeIds, practiceQuestionCount,
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
          selectedTopicId,
          selectedTopicLabel: topicMeta?.name || topicMeta?.label || "",
          selectedMicroThemeIds:
            safeScope === "topic" ? topicHintIds : selectedMicroThemeIds,
          selectedMicroThemeLabels:
            safeScope === "topic"
              ? (topicMeta?.subtopics || []).map((item) => item.label || item.name || item.id)
              : selectedMicroThemeMetas.map((item) => item.label || item.name || item.id),
        };

        console.log("🎯 FINAL NODE ID:", resolvedNodeId);
        console.log("📦 BUILD PAYLOAD:", payload);
        if (!resolvedNodeId) {
          console.error("❌ NODE ID MISSING:", { subjectId: selectedSubjectId, topicId: selectedTopicId, microThemeId: selectedMicroThemeIds[0] });
        }
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

      if (!response.ok) {
        throw new Error(json?.message || json?.error || `Practice build failed with status ${response.status}`);
      }

      const builtQuestions = Array.isArray(json?.questions) ? json.questions : [];
      if (!builtQuestions.length) throw new Error("No questions returned from backend");

      setTestId(nextTestId);
      setActiveTopicNodeId(""); // Not a tracked progressive test

      const sanitizedQuestions = sanitizeQuestions(builtQuestions);
      console.log("[RAW BUILT QUESTIONS]", builtQuestions.length);
      console.log("[SANITIZED QUESTIONS]", sanitizedQuestions.length);
      console.log("[FIRST 5 IDS]", sanitizedQuestions.slice(0, 5).map(q => q.id));
      setQuestions(sanitizedQuestions);

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
      setQuestions([]);
      setBuilderError(error.message || "Failed to build prelims practice test");
    } finally {
      setBuilderLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#38bdf8",
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.4,
              }}
            >
              UPSC MENTOR OS · PHASE 3A
            </div>
            <h1
              style={{
                margin: "8px 0 6px 0",
                fontSize: 30,
                lineHeight: 1.1,
              }}
            >
              Prelims Test Intelligence
            </h1>
            <div
              style={{
                color: "#94a3b8",
                maxWidth: 760,
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              End-to-end intelligence layer for prelims test analysis:
              accuracy, behavioural risk, weak nodes, trap alerts, and
              next-best revision actions.
            </div>
          </div>

          <div
            style={{
              minWidth: 260,
              ...cardStyle,
              padding: 14,
              background: "rgba(2, 6, 23, 0.55)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Active Test</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#f8fafc",
                marginTop: 6,
              }}
            >
              {testId}
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
              Dashboard source: {BACKEND_URL}/api/prelims/dashboard
            </div>
          </div>
        </div>
      </div>

      <section style={sectionStyle}>
        <div style={{ ...cardStyle }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: 0.2, color: "#e2e8f0" }}>Test Mode Selector</h2>
            <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
              Keeps sectional, full-length, and institutional blocks intact
            </div>
          </div>

          <div style={chipRowStyle}>
            <ModeButton
              active={testMode === "sectional"}
              onClick={() => {
                setTestMode("sectional");
                setTestStage("start");
                setBuilderError("");
              }}
            >
              Sectional
            </ModeButton>

            <ModeButton
              active={testMode === "full_length"}
              onClick={() => {
                setTestMode("full_length");
                setTestStage("start");
                setBuilderError("");
              }}
            >
              Full-Length
            </ModeButton>

            <ModeButton
              active={testMode === "institutional"}
              onClick={() => {
                setTestMode("institutional");
                setTestStage("start");
                setBuilderError("");
              }}
            >
              Institutional
            </ModeButton>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...cardStyle }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: 0.2, color: "#e2e8f0" }}>PYQ Test Flow</h2>
            <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
              Start → Attempt → Result
            </div>
          </div>

          {builderError && testStage === "start" && (
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
          )}

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
            <>
              {/* ── Topic Progress Panel (sectional mode only) disabled upon request ── */}
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
                microThemes={microThemes}
                availableQuestionCount={availableQuestionCount}
                onStart={buildPracticeOrFullLengthTest}
                loading={builderLoading}
                error={builderError || null}
                disableStart={disableStart}
              />
            </>
          )}

          {testStage === "attempt" && (
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
              onSubmit={async () => {
                try {
                  setBuilderLoading(true);
                  setBuilderError("");

                  // ── Finalise timing for last question ──────────────────────
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

                  // ── BACKEND PROGRESS SUBMIT (locked core — no timing fields) ──
                  if (activeTopicNodeId) {
                    try {
                      // Core submit: only answers + scoring fields (timing stripped out)
                      const submitPayload = {
                        userId: CURRENT_USER_ID,
                        topicNodeId: activeTopicNodeId,
                        stage: "prelims",
                        mode: activePracticeMode,
                        paperType: practicePaper === "CSAT" ? "CSAT" : "GS",
                        questionIds: questions.map((q) => q?.id || q?.questionId).filter(Boolean),
                        questions: questions,
                        answers: answersMap,
                      };
                      const submitResp = await fetch(`${BACKEND_URL}/api/prelims/practice/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(submitPayload),
                      });
                      if (submitResp.ok) {
                        const submitJson = await submitResp.json();
                        // Attach client-side timing to lastSubmitData for result display
                        setLastSubmitData({ ...submitJson, totalTimeSpent, averageTimePerQuestion: avgTimePerQuestion });
                        if (submitJson?.updatedProgress) {
                          setTopicProgress(prev => ({
                            ...(prev || {}),
                            ...submitJson.updatedProgress,
                            topicNodeId: activeTopicNodeId,
                            userId: CURRENT_USER_ID,
                          }));
                        }

                        // ── TIMING EXTENSION (fire-and-forget, separate endpoint) ──
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
                      // Non-fatal: continue to show result
                    }
                  }
                  // ── END BACKEND PROGRESS SUBMIT ────────────────────────────

                  await analyzeAttemptWithBackend({
                    testId, testMode, practicePaper, practiceScope,
                    fullLengthType, fullLengthYear, evaluatedQuestions,
                  });

                  const finalResult = buildLocalFallbackResult({
                    evaluatedQuestions, testId, testMode,
                    practicePaper, practiceScope, fullLengthYear,
                  });
                  setResult(finalResult);

                  // ── MISTAKE ENGINE ─────────────────────────────────────────
                  try {
                    const sourceType =
                      testMode === "full_length" ? "full_length"
                        : practiceScope === "topic" ? "topic_test"
                          : practiceScope === "subtopic" ? "topic_test"
                            : "sectional_test";
                    recordTestAttempt(
                      {
                        testId, sourceType, paper: practicePaper,
                        year: testMode === "full_length" ? fullLengthYear : null,
                        subject: selectedSubjectId, topic: selectedTopicId,
                        subtopic: selectedMicroThemeIds[0] || ""
                      },
                      evaluatedQuestions,
                      finalResult.summary || {}
                    );
                  } catch (mistakeErr) {
                    console.error("[MistakeEngine] Failed to record attempt:", mistakeErr);
                  }

                  try {
                    localStorage.setItem("prelims_test_attempts_v1", JSON.stringify(finalResult));
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
              }}
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
        </>
      )}
    </div>
  );
}