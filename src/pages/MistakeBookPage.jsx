import { useState, useMemo, useCallback, useEffect } from "react";
import { buildMistakeExplanationPrompt } from "../utils/buildMistakeExplanationPrompt";
import { openChatGptForMistake } from "../utils/openChatGptForMistake";
import { MistakeBookReviewDrawer } from "../components/MistakeBookReviewDrawer";
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
import "../styles/mentoros-mistake-book.css";

const DEFAULT_USER_ID = "user_1";

const reviewPriority = {
  retest_due: 0,
  new: 1,
  reviewed: 2,
};

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

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

function getMasteryStatus(mistake) {
  return mistake.masteryStatus || mistake.evidence?.masteryStatus || "unverified";
}

function masteryLabel(value) {
  const labels = {
    mastered: "Mastered",
    verify_again: "Verify Again",
    unverified: "Unverified",
    not_started: "Unverified",
  };
  return labels[String(value || "unverified")] || labels.unverified;
}

function primaryActionLabel(mistake) {
  const masteryStatus = getMasteryStatus(mistake);
  const lifecycle = normalizeReviewStatus(mistake.reviewStatus || mistake.review_status);
  if (masteryStatus === "mastered") return "Verify Again";
  if (masteryStatus === "verify_again") return "Verify Again";
  if (lifecycle === "retest_due") return "Retest Now";
  return "Fix Mistake";
}

function mistakeStatusKind(mistake) {
  const result = normalizeMistakeResult(mistake.latestResult || mistake.result);
  if (result === "unattempted") return "warning";
  if (result === "wrong") return "danger";
  return "success";
}

function MistakeStatusBadge({ mistake }) {
  const result = normalizeMistakeResult(mistake.latestResult || mistake.result);
  const label = result === "unattempted" ? "Unattempted" : result === "wrong" ? "Wrong" : "Correct";
  return <span className={cx("mb-badge", `is-${mistakeStatusKind(mistake)}`)}>{label}</span>;
}

function MentorVerdict({ intelligence, loading }) {
  const totals = intelligence?.totals || {};
  const progress = intelligence?.masteryProgress || {};
  const strongestPattern = intelligence?.patternIntelligence?.strongestPattern;
  return (
    <section className="mb-verdict" aria-labelledby="mentor-verdict-title">
      <div className="mb-verdict-copy">
        <p className="mb-eyebrow">Mentor Verdict</p>
        <h1 id="mentor-verdict-title">
          {intelligence?.verdict?.headline || (loading ? "Building your repair queue" : "Evidence is still forming")}
        </h1>
        <p>{intelligence?.verdict?.detail || "The queue now prioritizes repeated errors, retest due work, and mastery evidence."}</p>
        {strongestPattern && (
          <p className="mb-verdict-pattern">
            Main pattern: <strong>{strongestPattern.label}</strong>
            {strongestPattern.questionCount ? ` across ${strongestPattern.questionCount} active mistake${strongestPattern.questionCount === 1 ? "" : "s"}.` : "."}
          </p>
        )}
      </div>
      <div className="mb-verdict-stats" aria-label="Mistake Book summary">
        <div><strong>{totals.activeMistakes || 0}</strong><span>Active</span></div>
        <div><strong>{totals.repeatedErrors || 0}</strong><span>Repeated</span></div>
        <div><strong>{totals.verifyAgain || 0}</strong><span>Verify Again</span></div>
        <div><strong>{progress.mastered || totals.mastered || 0}</strong><span>Mastered</span></div>
      </div>
    </section>
  );
}

function PatternIntelligence({ intelligence }) {
  const weakestSubjects = intelligence?.patternIntelligence?.weakestSubjects || [];
  const strongestPattern = intelligence?.patternIntelligence?.strongestPattern;
  const cards = [];

  if (strongestPattern) {
    cards.push({
      title: strongestPattern.label,
      meta: `${strongestPattern.verifiedFailureCount || 0} verified failures`,
      detail: strongestPattern.questionCount ? `${strongestPattern.questionCount} active mistakes need targeted repair.` : "Pattern confirmed from attempt evidence.",
    });
  }

  weakestSubjects.slice(0, 2).forEach((item) => {
    cards.push({
      title: item.subject || "Subject pattern",
      meta: `${item.questionCount || 0} active mistakes`,
      detail: `${item.failureCount || item.verifiedFailureCount || 0} recorded failures in this cluster.`,
    });
  });

  while (cards.length < 3) {
    cards.push({
      title: cards.length === 0 ? "Diagnosis coverage" : cards.length === 1 ? "Retest evidence" : "Mastery signal",
      meta: cards.length === 0 ? "Awaiting more data" : cards.length === 1 ? "Ledger-backed" : "Two correct retests",
      detail: cards.length === 0
        ? "Patterns appear once more mistakes have classified diagnoses."
        : cards.length === 1
          ? "Retest outcomes update status without changing priority rules."
          : "Mastered items stay out of Today's Fix until evidence changes.",
    });
  }

  return (
    <section className="mb-patterns" aria-label="Pattern intelligence">
      {cards.slice(0, 3).map((card) => (
        <article className="mb-pattern-card" key={`${card.title}-${card.meta}`}>
          <span>{card.meta}</span>
          <h2>{card.title}</h2>
          <p>{card.detail}</p>
        </article>
      ))}
    </section>
  );
}

function QuickViews({ quickView, tabs, onChange }) {
  return (
    <div className="mb-quickviews" role="tablist" aria-label="Mistake quick views">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={quickView === tab.id}
          className={cx("mb-quickview", quickView === tab.id && "is-active")}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          <strong>{tab.count}</strong>
        </button>
      ))}
    </div>
  );
}

function FiltersPanel({
  subjects,
  papers,
  subjectFilter,
  setSubjectFilter,
  sourceFilter,
  setSourceFilter,
  paperFilter,
  setPaperFilter,
  resultFilter,
  setResultFilter,
  lifecycleFilter,
  setLifecycleFilter,
  diagnosisFilter,
  setDiagnosisFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}) {
  return (
    <div className="mb-filter-panel">
      <label>
        <span>Subject</span>
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          {subjects.map((sub) => <option key={sub} value={sub}>{sub === "all" ? "All Subjects" : sub}</option>)}
        </select>
      </label>
      <label>
        <span>Source</span>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All Sources</option>
          <option value="pyq">PYQ</option>
          <option value="institutional">Institutional</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        <span>Paper</span>
        <select value={paperFilter} onChange={(e) => setPaperFilter(e.target.value)}>
          {papers.map((paper) => <option key={paper} value={paper}>{paper === "all" ? "All Papers" : paper}</option>)}
        </select>
      </label>
      <label>
        <span>Result</span>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="all">All Results</option>
          <option value="wrong">Wrong</option>
          <option value="unattempted">Unattempted</option>
        </select>
      </label>
      <label>
        <span>Diagnosis</span>
        <select value={diagnosisFilter} onChange={(e) => setDiagnosisFilter(e.target.value)}>
          <option value="all">All Diagnoses</option>
          {MISTAKE_DIAGNOSIS_OPTIONS.map((option) => (
            <option key={option} value={option}>{getMistakeDiagnosisLabel(option)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="retest_due">Retest Due</option>
        </select>
      </label>
      <label>
        <span>From</span>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </label>
      <label>
        <span>To</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </label>
    </div>
  );
}

function MistakeCard({ mistake, isExpanded, onExpand, onCollapse, onRefresh }) {
  const [chatMsg, setChatMsg] = useState("");
  const displayAnswer = mistake.latestUserAnswer !== undefined ? mistake.latestUserAnswer : mistake.userAnswer;
  const displayResult = normalizeMistakeResult(mistake.latestResult || mistake.result);
  const isUnattempted = displayResult === "unattempted" || (!displayResult && displayAnswer == null);
  const sourceGroup = getMistakeSourceGroup(mistake.sourceType);
  const lifecycle = normalizeReviewStatus(mistake.reviewStatus || mistake.review_status);
  const diagnosis = normalizeMistakeDiagnosis(mistake.errorType || mistake.error_type);
  const evidence = mistake.evidence || {};
  const masteryStatus = getMasteryStatus(mistake);
  const paperDisplay = mistake.paperType || mistake.paper || "GS";

  const handleAskChatGpt = useCallback(async () => {
    const prompt = buildMistakeExplanationPrompt({ ...mistake, errorType: diagnosis });
    const { message } = await openChatGptForMistake(prompt);
    setChatMsg(message);
    setTimeout(() => setChatMsg(""), 5000);
  }, [mistake, diagnosis]);

  if (isExpanded) {
    return (
      <article className="mb-card is-expanded">
        <MistakeBookReviewDrawer mistake={mistake} onClose={onCollapse} onRefresh={onRefresh} />
      </article>
    );
  }

  return (
    <article className={cx("mb-card", evidence.isRepeatedError && "has-repeat", masteryStatus === "mastered" && "is-mastered")}>
      <div className="mb-card-main">
        <div className="mb-card-meta">
          {mistake.subject && <span>{mistake.subject}</span>}
          {mistake.topic && <span>{mistake.topic}</span>}
          <span>{paperDisplay}</span>
          <span className={cx("mb-source", `is-${sourceGroup}`)}>{getMistakeSourceLabel(mistake.sourceType)}</span>
          <span>{formatMistakeDate(mistake.createdAt || mistake.firstSeenAt)}</span>
        </div>
        <div className="mb-card-title-row">
          <h2>{mistake.questionText || "Question content not available"}</h2>
          <MistakeStatusBadge mistake={mistake} />
        </div>
        <div className="mb-card-facts" aria-label="Answer summary">
          <span>Your: <strong className={cx(!isUnattempted && "is-wrong")}>{isUnattempted ? "Unattempted" : displayAnswer || "-"}</strong></span>
          <span>Correct: <strong className="is-correct">{mistake.correctAnswer || "-"}</strong></span>
          <span>Diagnosis: <strong>{getMistakeDiagnosisLabel(diagnosis)}</strong></span>
          <span>Status: <strong>{getReviewStatusLabel(lifecycle)}</strong></span>
        </div>
        <div className="mb-evidence-row">
          <span>{evidence.recordedAttempts || evidence.totalAttempts || 0} attempts</span>
          <span>{evidence.failureCount || evidence.repeatedWrongCount || 0} failures</span>
          <span>{evidence.retestCount || 0} retests</span>
          {evidence.isRepeatedError && <span className="is-danger">Repeated-error state</span>}
          <span className={cx(masteryStatus === "mastered" && "is-success", masteryStatus === "verify_again" && "is-info")}>{masteryLabel(masteryStatus)}</span>
        </div>
      </div>
      <div className="mb-card-actions">
        <button type="button" className="mb-primary-action" onClick={onExpand}>{primaryActionLabel(mistake)}</button>
        <button type="button" className="mb-ghost-action" onClick={handleAskChatGpt}>Ask ChatGPT</button>
        {chatMsg && <span className="mb-inline-note">{chatMsg}</span>}
      </div>
    </article>
  );
}

export default function MistakeBookPage() {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paperFilter, setPaperFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [openMistakeId, setOpenMistakeId] = useState(null);
  const [quickView, setQuickView] = useState("priority");
  const [allMistakes, setAllMistakes] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMistakes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userId = encodeURIComponent(DEFAULT_USER_ID);
      const [res, intelligenceRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/mistakes?userId=${userId}&stage=prelims`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/api/mistakes/intelligence?userId=${userId}&stage=prelims`, { cache: "no-store" }),
      ]);
      const data = await res.json();
      const intelligenceData = await intelligenceRes.json();

      if (!Array.isArray(data)) {
        console.warn("[MistakeBook] Unexpected response", data);
        setAllMistakes([]);
        return;
      }

      const intelligenceByMistakeId = new Map((intelligenceData?.mistakes || []).map((m) => [String(m.id), m]));
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
        sourceRef: m.source_ref,
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
      if (!map.has(key)) map.set(key, m.subject);
    });
    return ["all", ...Array.from(map.values()).sort()];
  }, [allMistakes]);

  const papers = useMemo(() => {
    const set = new Set();
    allMistakes.forEach((m) => set.add(m.paperType || m.paper || "GS"));
    return ["all", ...Array.from(set).sort()];
  }, [allMistakes]);

  const priorityIds = useMemo(() => new Set((intelligence?.todaysFix?.mistakes || []).map((m) => String(m.id))), [intelligence]);

  const quickTabs = useMemo(() => {
    const totals = intelligence?.totals || {};
    return [
      { id: "priority", label: "Priority", count: intelligence?.todaysFix?.mistakes?.length || 0 },
      { id: "retest_due", label: "Retest Due", count: totals.retestDue || 0 },
      { id: "repeated", label: "Repeated", count: totals.repeatedErrors || 0 },
      { id: "verify_again", label: "Verify Again", count: totals.verifyAgain || 0 },
      { id: "mastered", label: "Mastered", count: totals.mastered || 0 },
      { id: "all", label: "All", count: allMistakes.length },
    ];
  }, [allMistakes.length, intelligence]);

  const activeFilterCount = [subjectFilter, sourceFilter, paperFilter, resultFilter, lifecycleFilter, diagnosisFilter]
    .filter((value) => value !== "all").length + (fromDate ? 1 : 0) + (toDate ? 1 : 0);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    const searchLower = searchText.toLowerCase();

    return allMistakes
      .filter((m) => {
        const evidence = m.evidence || {};
        const masteryStatus = getMasteryStatus(m);
        const lifecycle = normalizeReviewStatus(m.reviewStatus || m.review_status);
        const diagnosis = normalizeMistakeDiagnosis(m.errorType || m.error_type);

        if (quickView === "priority" && !priorityIds.has(String(m.id))) return false;
        if (quickView === "retest_due" && lifecycle !== "retest_due") return false;
        if (quickView === "repeated" && !evidence.isRepeatedError) return false;
        if (quickView === "verify_again" && masteryStatus !== "verify_again") return false;
        if (quickView === "mastered" && masteryStatus !== "mastered") return false;
        if (quickView !== "mastered" && quickView !== "all" && masteryStatus === "mastered") return false;

        if (subjectFilter !== "all" && (m.subject || "").toLowerCase() !== subjectFilter.toLowerCase()) return false;
        if (sourceFilter !== "all" && getMistakeSourceGroup(m.sourceType) !== sourceFilter) return false;
        if (paperFilter !== "all" && (m.paperType || m.paper || "GS").toUpperCase() !== paperFilter.toUpperCase()) return false;
        if (diagnosisFilter !== "all" && diagnosis !== diagnosisFilter) return false;
        if (lifecycleFilter !== "all" && lifecycle !== lifecycleFilter) return false;

        if (resultFilter !== "all") {
          const mResult = normalizeMistakeResult(m.latestResult || m.result);
          const displayAnswer = m.latestUserAnswer !== undefined ? m.latestUserAnswer : m.userAnswer;
          const isUnattempted = mResult === "unattempted" || (!displayAnswer && !mResult);
          if (resultFilter === "wrong" && (mResult !== "wrong" || isUnattempted)) return false;
          if (resultFilter === "unattempted" && !isUnattempted) return false;
        }

        if (searchLower) {
          const haystack = [m.questionText, m.subject, m.topic, m.questionNumber, m.sourceRef, m.questionId].join(" ").toLowerCase();
          if (!haystack.includes(searchLower)) return false;
        }

        if (fromTs || toTs) {
          const ts = m.createdAt ? new Date(m.createdAt).getTime() : (m.firstSeenAt ? new Date(m.firstSeenAt).getTime() : null);
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
        const byLifecycle = (reviewPriority[aLifecycle] ?? 9) - (reviewPriority[bLifecycle] ?? 9);
        if (byLifecycle !== 0) return byLifecycle;
        return new Date(b.createdAt || b.firstSeenAt || 0) - new Date(a.createdAt || a.firstSeenAt || 0);
      });
  }, [allMistakes, subjectFilter, sourceFilter, paperFilter, resultFilter, lifecycleFilter, diagnosisFilter, searchText, fromDate, toDate, priorityIds, quickView]);

  const resetFilters = () => {
    setSubjectFilter("all");
    setSourceFilter("all");
    setPaperFilter("all");
    setResultFilter("all");
    setLifecycleFilter("all");
    setDiagnosisFilter("all");
    setFromDate("");
    setToDate("");
    setSearchText("");
    setQuickView("priority");
  };

  return (
    <main className="mb-page">
      <div className="mb-wrap">
        <header className="mb-page-header">
          <div>
            <p className="mb-eyebrow">Prelims Mistake Book</p>
            <h1>Mistake repair room</h1>
            <p>Evidence-first review for repeated errors, retests, and mastery checks.</p>
          </div>
          <div className="mb-count-pill" aria-live="polite">{filtered.length} {filtered.length === 1 ? "mistake" : "mistakes"}</div>
        </header>

        <MentorVerdict intelligence={intelligence} loading={loading} />

        <section className="mb-todays-fix" aria-labelledby="todays-fix-title">
          <div>
            <p className="mb-eyebrow">Today's Fix</p>
            <h2 id="todays-fix-title">
              {intelligence?.todaysFix?.empty ? "No active priority items" : `${intelligence?.todaysFix?.mistakes?.length || 0} priority item${(intelligence?.todaysFix?.mistakes?.length || 0) === 1 ? "" : "s"}`}
            </h2>
            <p>Mastered items stay out unless new evidence puts them back in the active queue.</p>
          </div>
          <div className="mb-fix-strip">
            {(intelligence?.todaysFix?.mistakes || []).slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setQuickView("priority"); setOpenMistakeId(item.id); }}
              >
                <strong>{item.priorityLabel || "Priority"}</strong>
                <span>{item.questionText || "Untitled mistake"}</span>
                <em>{item.evidence?.failureCount || 0} failures - {item.estimatedMinutes || 0} min</em>
              </button>
            ))}
            {!(intelligence?.todaysFix?.mistakes || []).length && <span className="mb-empty-chip">Clear for now</span>}
          </div>
        </section>

        <PatternIntelligence intelligence={intelligence} />

        <section className="mb-toolbar" aria-label="Mistake controls">
          <QuickViews quickView={quickView} tabs={quickTabs} onChange={setQuickView} />
          <div className="mb-search-row">
            <label className="mb-search">
              <span>Search</span>
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Question, topic, source, ID" />
            </label>
            <button type="button" className="mb-filter-toggle" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}>
              Filters {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
            </button>
            {(activeFilterCount > 0 || searchText || quickView !== "priority") && (
              <button type="button" className="mb-reset" onClick={resetFilters}>Clear</button>
            )}
          </div>
          {showFilters && (
            <FiltersPanel
              subjects={subjects}
              papers={papers}
              subjectFilter={subjectFilter}
              setSubjectFilter={setSubjectFilter}
              sourceFilter={sourceFilter}
              setSourceFilter={setSourceFilter}
              paperFilter={paperFilter}
              setPaperFilter={setPaperFilter}
              resultFilter={resultFilter}
              setResultFilter={setResultFilter}
              lifecycleFilter={lifecycleFilter}
              setLifecycleFilter={setLifecycleFilter}
              diagnosisFilter={diagnosisFilter}
              setDiagnosisFilter={setDiagnosisFilter}
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
            />
          )}
        </section>

        {filtered.length === 0 ? (
          <section className="mb-empty-state">
            <h2>{loading && allMistakes.length === 0 ? "Loading mistakes" : "No mistakes found"}</h2>
            <p>{searchText || activeFilterCount ? "Try adjusting your search or filters." : "Attempt questions to start building your repair queue."}</p>
          </section>
        ) : (
          <section className="mb-list" aria-label="Mistake list">
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
          </section>
        )}
      </div>
    </main>
  );
}
