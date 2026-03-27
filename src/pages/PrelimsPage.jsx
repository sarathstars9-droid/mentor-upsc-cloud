import { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";
import { PRELIMS_STRUCTURE } from "../data/prelimsStructure";

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
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
};

const chipRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

function ModeButton({ active, children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(56, 189, 248, 0.45)"
          : "1px solid rgba(148, 163, 184, 0.18)",
        background: active
          ? "rgba(14, 165, 233, 0.16)"
          : "rgba(15, 23, 42, 0.9)",
        color: disabled ? "#64748b" : active ? "#e0f2fe" : "#cbd5e1",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
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
        padding: 14,
      }}
    >
      <div style={{ color: accent, fontWeight: 700, marginBottom: 8 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          No updates available.
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "#e2e8f0",
            lineHeight: 1.7,
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
    const qid = q?.id || q?.questionId || `q_${index + 1}`;
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

export default function PrelimsPage() {
  const [testStage, setTestStage] = useState("start");
  const [testMode, setTestMode] = useState("sectional");
  const [testId, setTestId] = useState("prelims_2020_gs1");

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
      count: item.count || 0,
    }));
  }, [practicePaper]);

  const topics = useMemo(() => {
    const base =
      practicePaper === "GS"
        ? PRELIMS_STRUCTURE?.gs || []
        : PRELIMS_STRUCTURE?.csat || [];

    const subject = base.find((item) => item.id === selectedSubjectId);
    return (subject?.topics || []).map((topic) => ({
      id: topic.id,
      name: topic.name || topic.label || topic.id,
      count: topic.count || 0,
    }));
  }, [practicePaper, selectedSubjectId]);

  const microThemes = useMemo(() => {
    const base =
      practicePaper === "GS"
        ? PRELIMS_STRUCTURE?.gs || []
        : PRELIMS_STRUCTURE?.csat || [];

    const subject = base.find((item) => item.id === selectedSubjectId);
    const topic = (subject?.topics || []).find((item) => item.id === selectedTopicId);

    return (topic?.subtopics || []).map((subtopic) => ({
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
  }, [practicePaper]);

  useEffect(() => {
    setSelectedTopicId("");
    setSelectedMicroThemeIds([]);
    setBuilderError("");
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
          fullLengthType === "csat_yearwise" ? "csat" : "gs1";

        nextTestId = `prelims_${fullLengthYear}_${paperCode}`;

        payload = {
          mode: "full_length",
          fullLengthType,
          fullLengthYear,
          year: fullLengthYear,
          paper: paperCode,
          count: fullLengthType === "csat_yearwise" ? 80 : 100,
        };
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

        const topicMeta = getSelectedTopicMeta(
          subjectMeta,
          selectedTopicId
        );

        const selectedMicroThemeMetas = getSelectedMicroThemeMetas(
          topicMeta,
          selectedMicroThemeIds
        );

        payload = {
          mode: "sectional",
          practicePaper,
          paper: practicePaper,
          practiceScope: safeScope,
          scope: safeScope,

          selectedSubjectId,
          subjectId: selectedSubjectId,
          selectedSubjectLabel: subjectMeta?.label || "",

          selectedTopicId:
            safeScope === "topic" || safeScope === "subtopic"
              ? selectedTopicId
              : null,
          topicId:
            safeScope === "topic" || safeScope === "subtopic"
              ? selectedTopicId
              : null,
          selectedTopicLabel:
            safeScope === "topic" || safeScope === "subtopic"
              ? (topicMeta?.name || topicMeta?.label || "")
              : "",

          selectedMicroThemeIds:
            safeScope === "subtopic" ? selectedMicroThemeIds : [],
          microThemeIds:
            safeScope === "subtopic" ? selectedMicroThemeIds : [],
          selectedMicroThemeLabels:
            safeScope === "subtopic"
              ? selectedMicroThemeMetas.map((item) => item.label)
              : [],

          practiceQuestionCount,
          count: practiceQuestionCount,
        };
      }

      const response = await fetch(
        `${BACKEND_URL}/api/prelims/practice/build`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || `Practice build failed with status ${response.status}`
        );
      }

      const builtQuestions = Array.isArray(json?.questions) ? json.questions : [];

      if (!builtQuestions.length) {
        throw new Error("No questions returned from backend");
      }

      setTestId(nextTestId);
      setQuestions(builtQuestions);
      setCurrentIndex(0);
      setAnswersMap({});
      setConfidenceMap({});
      setTestStage("attempt");
    } catch (error) {
      console.error("Prelims practice build error:", error);
      setBuilderError(
        error.message || "Failed to build prelims practice test"
      );
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
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Test Mode Selector</h2>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
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
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>PYQ Test Flow</h2>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
              Existing flow preserved. Start → Attempt → Result.
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

          {practiceScope === "subtopic" && selectedTopicId && microThemes.length === 0 && (
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
              No subtopics are configured for this topic yet. Choose another topic or switch to Topic-wise mode.
            </div>
          )}

          {testStage === "start" && (
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
          )}

          {testStage === "attempt" && (
            <PyqTestAttempt
              testMeta={{
                mode: testMode === "full_length" ? "full_length" : "practice",
                paperType: practicePaper,
                variant: practiceScope,
                year: fullLengthYear,
                label: testId,
              }}
              questions={questions}
              currentIndex={currentIndex}
              currentQuestion={questions[currentIndex]}
              answersMap={answersMap}
              confidenceMap={confidenceMap}
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
              onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
              onNext={() =>
                setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))
              }
              onJumpTo={(i) => setCurrentIndex(i)}
              onSubmit={async () => {
                try {
                  setBuilderLoading(true);
                  setBuilderError("");

                  const evaluatedQuestions = buildAttemptRows(
                    questions,
                    answersMap,
                    confidenceMap
                  );

                  const analyticsResult = await analyzeAttemptWithBackend({
                    testId,
                    testMode,
                    practicePaper,
                    practiceScope,
                    fullLengthType,
                    fullLengthYear,
                    evaluatedQuestions,
                  });

                  const finalResult =
                    analyticsResult ||
                    buildLocalFallbackResult({
                      evaluatedQuestions,
                      testId,
                      testMode,
                      practicePaper,
                      practiceScope,
                      fullLengthYear,
                    });

                  setResult(finalResult);

                  try {
                    localStorage.setItem(
                      "prelims_test_attempts_v1",
                      JSON.stringify(finalResult)
                    );
                  } catch {
                    // ignore localStorage write failure
                  }

                  setTestStage("result");
                } catch (error) {
                  console.error("Prelims submit/analyze error:", error);

                  const evaluatedQuestions = buildAttemptRows(
                    questions,
                    answersMap,
                    confidenceMap
                  );

                  const fallbackResult = buildLocalFallbackResult({
                    evaluatedQuestions,
                    testId,
                    testMode,
                    practicePaper,
                    practiceScope,
                    fullLengthYear,
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
            <PyqTestResult
              result={result}
              testId={testId}
              testMode={testMode}
              onRestart={() => {
                setTestStage("start");
                setResult(null);
                setQuestions([]);
                setCurrentIndex(0);
                setAnswersMap({});
                setConfidenceMap({});
              }}
              onReattempt={() => {
                setTestStage("attempt");
                setCurrentIndex(0);
                setAnswersMap({});
                setConfidenceMap({});
                setResult(null);
              }}
            />
          )}
        </div>
      </section>

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
          <InfoBlock
            title="Recent History"
            items={recentHistory}
            accent="#38bdf8"
          />
          <InfoBlock
            title="Mistake Book Signals"
            items={mistakeBookSignals}
            accent="#f59e0b"
          />
          <InfoBlock
            title="Next Actions"
            items={nextActions}
            accent="#22c55e"
          />
          <InfoBlock title="Insights" items={insights} accent="#a78bfa" />
        </div>
      </section>
    </div>
  );
}
