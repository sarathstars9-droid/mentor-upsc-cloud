import React, { useEffect, useMemo, useState } from "react";
import { fetchRealPerformanceData } from "../services/performanceService";

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE PAGE
// Performance diagnoses. It does not prescribe or schedule study blocks.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS = {
  strong: "var(--pp-success)",
  stable: "var(--pp-primary)",
  warning: "var(--pp-warning)",
  critical: "var(--pp-danger)",
};

function scoreStatus(value) {
  if (value >= 80) return "strong";
  if (value >= 60) return "stable";
  if (value >= 40) return "warning";
  return "critical";
}

function avg(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function firstLast(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (numeric.length < 2) return { first: null, last: null, delta: null, sampleSize: numeric.length };
  const first = numeric[0];
  const last = numeric[numeric.length - 1];
  return { first, last, delta: Math.round((last - first) * 10) / 10, sampleSize: numeric.length };
}

function trendWord(delta, stableBand = 2) {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return "Not enough evidence";
  if (numeric > stableBand) return "Improving";
  if (numeric < -stableBand) return "Deteriorating";
  return "Stable";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isAvailable(metric) {
  return metric?.status === "available" && metric.value !== null && metric.value !== undefined;
}

function metricHasEvidence(metric) {
  return metric?.status === "available" && Number(metric.sampleSize || 0) > 0;
}

function metricValue(metric) {
  if (!isAvailable(metric)) return null;
  const value = Number(metric.value);
  return Number.isFinite(value) ? value : null;
}

function metricText(metric, suffix = "") {
  if (!isAvailable(metric)) return "Not enough evidence";
  return `${metric.value}${suffix}`;
}

function metricStatus(metric) {
  return isAvailable(metric) ? scoreStatus(Number(metric.value)) : "neutral";
}

function availableSeriesValues(series = []) {
  return safeArray(series)
    .filter(isAvailable)
    .map((point) => Number(point.value))
    .filter(Number.isFinite);
}

function metricTrend(series = []) {
  return firstLast(availableSeriesValues(series));
}

function hasAvailableSeries(series = [], minPoints = 1) {
  return availableSeriesValues(series).length >= minPoints;
}

function buildEvidenceProfile(data, metrics) {
  const execution = data?.execution || {};
  const academic = data?.academic || {};
  const revision = data?.revision || {};
  const csat = data?.csat || {};
  const trends = data?.trends || {};
  const score = data?.score || {};

  const domains = {
    execution: [
      execution.plannedHoursToday,
      execution.actualHoursToday,
      execution.plannedHours7d,
      execution.actualHours7d,
      execution.completionRate,
      execution.completedBlocks,
      execution.streakDays,
      score.execution,
    ].some(metricHasEvidence),
    academic: [
      academic.prelimsAccuracy30d,
      academic.prelimsAccuracy7d,
      academic.prelimsAttempts30d,
      academic.negativeMarksLost,
      score.academic,
    ].some(metricHasEvidence) || safeArray(academic.topicPerformance).some((topic) => metricHasEvidence(topic.accuracy)),
    revision: [
      revision.dueToday,
      revision.overdue,
      revision.completedToday,
      revision.revisionSuccessRate,
      score.revision,
    ].some(metricHasEvidence),
    csat: [
      csat.todayMinutes,
      csat.weeklyMinutes,
      csat.practiceConsistency,
      csat.last2DayTouched,
      csat.score,
    ].some(metricHasEvidence),
  };

  const domainsWithEvidence = Object.values(domains).filter(Boolean).length;
  const requiredScoreComponentsAvailable = domains.execution && domains.academic && domains.revision && isAvailable(score.overall);
  const hasHistoricalTrendEvidence = [
    trends.sevenDay?.completion,
    trends.sevenDay?.prelimsAccuracy,
    trends.sevenDay?.revisionCompletion,
    trends.thirtyDay?.completion,
    trends.thirtyDay?.prelimsAccuracy,
  ].some((series) => hasAvailableSeries(series, 3));

  const state = requiredScoreComponentsAvailable
    ? "PERFORMANCE_ACTIVE"
    : domainsWithEvidence >= 2
      ? "EARLY_SIGNALS"
      : "BASELINE_BUILDING";

  const patternState = state === "PERFORMANCE_ACTIVE" && hasHistoricalTrendEvidence
    ? "PATTERN_READY"
    : "PATTERN_NOT_READY";

  return {
    state,
    patternState,
    domains,
    domainsWithEvidence,
    hasReliableScore: state === "PERFORMANCE_ACTIVE" && metrics?.performanceScore !== null,
    hasHistoricalTrendEvidence,
  };
}

function normalizeSubjects(data) {
  return safeArray(data?.academic?.subjectPerformance || data?.subjects).map((subject) => {
    const scoreMetric = subject.score?.status ? subject.score : subject.accuracy;
    const rawScore = Number(subject.score ?? subject.accuracy);
    const score = metricValue(scoreMetric) ?? (Number.isFinite(rawScore) ? rawScore : null);
    return {
      ...subject,
      id: subject.id || String(subject.name || subject.subject || "").toLowerCase(),
      name: subject.name || subject.subject || "Unknown",
      score,
      accuracy: metricValue(subject.accuracy) ?? score,
      trend: metricValue(subject.trend),
      status: subject.status && subject.status !== "insufficient_evidence"
        ? subject.status
        : (score === null ? "critical" : scoreStatus(score)),
    };
  });
}

function normalizeTopics(data) {
  return safeArray(data?.academic?.topicPerformance || data?.topics).map((topic) => {
    const accuracy = metricValue(topic.accuracy);
    return {
      ...topic,
      id: topic.id || topic.topicName || topic.nodeId,
      topicName: topic.topicName || topic.topic || topic.nodeId || "Unknown topic",
      subject: topic.subject || "Unknown",
      accuracy,
      accuracyMetric: topic.accuracy?.status ? topic.accuracy : (accuracy === null ? null : { value: accuracy, status: "available", sampleSize: topic.attempted || 1 }),
      trend: metricValue(topic.trend),
      status: topic.status && topic.status !== "insufficient_evidence"
        ? topic.status
        : (accuracy === null ? "critical" : scoreStatus(accuracy)),
    };
  });
}

function deriveMetrics(data) {
  const execution = data.execution || {};
  const revision = data.revision || {};
  const csat = data.csat || {};
  const trends = data.trends?.sevenDay || {};
  const thirtyDayTrends = data.trends?.thirtyDay || {};
  const subjects = normalizeSubjects(data);
  const topics = normalizeTopics(data);
  const score = data.score || {};

  const completionPct = metricValue(execution.completionRate);
  const executionScore = metricValue(score.execution);
  const academicScore = metricValue(score.academic);
  const revisionScore = metricValue(score.revision);
  const consistencyScore = metricValue(score.consistency);
  const performanceScore = metricValue(score.overall);

  const weakTopics = topics.filter((topic) => topic.accuracy !== null && topic.accuracy < 55);
  const sortedByAccuracy = [...topics]
    .filter((topic) => topic.accuracy !== null)
    .sort((a, b) => a.accuracy - b.accuracy);
  const sortedSubjects = [...subjects]
    .filter((subject) => Number.isFinite(Number(subject.score)))
    .sort((a, b) => Number(a.score) - Number(b.score));

  const completionTrend = metricTrend(trends.completion);
  const accuracyTrend = metricTrend(trends.prelimsAccuracy);
  const revisionTrend = metricTrend(trends.revisionCompletion);
  const csatSeries = safeArray(trends.csatMinutes);
  const csatTouchedDays = metricValue(csat.practiceConsistency);
  const csatCritical = isAvailable(csat.last2DayTouched) ? csat.last2DayTouched.value === false : false;

  const sevenDayDirection = trendWord(
    avg([
      completionTrend.delta,
      accuracyTrend.delta,
      revisionTrend.delta,
    ]),
    1.5
  );

  const thirtyDayCompletion = metricTrend(thirtyDayTrends.completion);
  const thirtyDayAccuracy = metricTrend(thirtyDayTrends.prelimsAccuracy);
  const thirtyDayDirection = trendWord(avg([thirtyDayCompletion.delta, thirtyDayAccuracy.delta]), 1.5);

  return {
    completionPct,
    executionScore,
    academicScore,
    revisionScore,
    consistencyScore,
    performanceScore,
    perfStatus: performanceScore === null ? "critical" : scoreStatus(performanceScore),
    execStatus: metricStatus(score.execution),
    acadStatus: metricStatus(score.academic),
    revStatus: metricStatus(score.revision),
    consistencyStatus: metricStatus(score.consistency),
    weakTopics,
    weakestTopic: sortedByAccuracy[0] || null,
    weakestSubject: sortedSubjects[0] || null,
    strongestSubject: sortedSubjects[sortedSubjects.length - 1] || null,
    fatigueDetected: null,
    csatCritical,
    completionTrend,
    accuracyTrend,
    revisionTrend,
    csatTouchedDays,
    csatSeries,
    subjectCoverageAvg: null,
    subjectAccuracyAvg: avg(subjects.map((subject) => subject.accuracy)),
    sevenDayDirection,
    thirtyDayDirection,
  };
}

function statusLabel(status) {
  if (status === "strong") return "Strong";
  if (status === "warning") return "Watch";
  if (status === "critical") return "Needs Attention";
  return "Stable";
}

function deltaTone(delta) {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return "neutral";
  if (numeric > 0) return "positive";
  if (numeric < 0) return "negative";
  return "neutral";
}

function Direction({ value, showValue = true }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return <span className="pp-direction neutral">Not enough evidence</span>;
  }
  const tone = deltaTone(value);
  return (
    <span className={`pp-direction ${tone}`}>
      <span aria-hidden="true">{numeric > 0 ? "↑" : numeric < 0 ? "↓" : "→"}</span>
      {showValue && <span>{numeric > 0 ? "+" : ""}{numeric}%</span>}
    </span>
  );
}

function Sparkline({ values = [], tone = "primary", height = 48 }) {
  const data = safeArray(values).map(Number).filter(Number.isFinite);
  if (data.length < 2) {
    return <div className="pp-spark-empty" style={{ height }} />;
  }

  const width = 220;
  const pad = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const points = data
    .map((value, index) => {
      const x = pad + (index / (data.length - 1)) * (width - pad * 2);
      const y =
        pad +
        (1 - (value - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={`pp-spark ${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Performance trend"
    >
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      {data.map((value, index) => {
        const x = pad + (index / (data.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (value - min) / range) * (height - pad * 2);
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="2.2" />;
      })}
    </svg>
  );
}

function Section({ title, period, children, className = "" }) {
  return (
    <section className={`pp-card pp-section ${className}`.trim()}>
      <div className="pp-section-head">
        <h2>{title}</h2>
        {period && <span className="pp-period">{period}</span>}
      </div>
      {children}
    </section>
  );
}

function RiskItem({ level, title, text, tone }) {
  return (
    <article className={`pp-risk ${tone}`}>
      <span className="pp-risk-dot" aria-hidden="true" />
      <div>
        <span className="pp-risk-level">{level}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function TrendItem({ label, start, end, description, positive }) {
  const hasNumbers = Number.isFinite(Number(start)) && Number.isFinite(Number(end));
  const delta = hasNumbers ? Math.round((end - start) * 10) / 10 : 0;
  return (
    <div className="pp-trend-item">
      <span className={`pp-trend-icon ${positive ? "positive" : "negative"}`}>
        {positive ? "↑" : "↓"}
      </span>
      <div className="pp-trend-copy">
        <strong>{label}</strong>
        <span>
          {hasNumbers ? `${start}${typeof start === "number" ? "%" : ""} → ${end}${typeof end === "number" ? "%" : ""}` : description}
        </span>
      </div>
      {hasNumbers && <Direction value={delta} showValue={false} />}
    </div>
  );
}

function Pattern({ icon, title, description, chain }) {
  return (
    <article className="pp-pattern">
      <div className="pp-pattern-icon" aria-hidden="true">{icon}</div>
      <div className="pp-pattern-body">
        <h3>{title}</h3>
        <p>{description}</p>
        {chain && (
          <div className="pp-chain" aria-label={chain.join(" then ")}>
            {chain.map((item, index) => (
              <React.Fragment key={item}>
                <span>{item}</span>
                {index < chain.length - 1 && <b aria-hidden="true">→</b>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function MetricRow({ label, value, tone = "neutral", sub }) {
  return (
    <div className="pp-metric-row">
      <div>
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </div>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Progress({ value, tone = "primary" }) {
  const numeric = Number(value);
  const hasValue = Number.isFinite(numeric);
  const safe = hasValue ? Math.max(0, Math.min(100, numeric)) : 0;
  return (
    <div className="pp-progress" aria-label={hasValue ? `${Math.round(safe)} percent` : "not available yet"}>
      <span className={tone} style={{ width: `${safe}%` }} />
    </div>
  );
}

function evidenceDomainItems(domains = {}) {
  return [
    {
      key: "execution",
      label: "Execution",
      readyText: "Early study evidence detected",
      waitingText: "Waiting for tracked study sessions",
      shortWaitingText: "Waiting",
    },
    {
      key: "academic",
      label: "Academic",
      readyText: "Submitted test/PYQ evidence detected",
      waitingText: "Waiting for first submitted test/PYQ",
      shortWaitingText: "Waiting",
    },
    {
      key: "revision",
      label: "Revision",
      readyText: "Revision activity detected",
      waitingText: "Waiting for revision activity",
      shortWaitingText: "Waiting",
    },
    {
      key: "csat",
      label: "CSAT",
      readyText: "CSAT practice evidence detected",
      waitingText: "Waiting for first practice/test",
      shortWaitingText: "Waiting",
    },
  ].map((item) => ({ ...item, ready: Boolean(domains[item.key]) }));
}

function EvidenceStepper({ domains }) {
  const items = evidenceDomainItems(domains);

  return (
    <div className="pp-evidence-stepper" aria-label="Evidence readiness">
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          <span className={`pp-step ${item.ready ? "ready" : ""}`}>
            <b aria-hidden="true">{item.ready ? "✓" : "○"}</b>
            {item.label}
          </span>
          {index < items.length - 1 && <i aria-hidden="true" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function EvidenceProgress({ domains }) {
  const items = evidenceDomainItems(domains);
  const waiting = items.filter((item) => !item.ready).map((item) => item.label);

  return (
    <div>
      <div className="pp-evidence-progress-grid">
        {items.map((item) => (
          <div className={`pp-evidence-domain ${item.ready ? "ready" : ""}`} key={item.key}>
            <span>{item.label}</span>
            <strong>{item.ready ? "✓ Ready" : item.shortWaitingText}</strong>
            <small>{item.ready ? item.readyText : item.waitingText}</small>
          </div>
        ))}
      </div>
      <p className="pp-progress-note">
        {waiting.length
          ? `${waiting.join(", ")} insights will appear as evidence accumulates.`
          : "All evidence areas have usable samples; MentorOS will switch to the full performance view when the score is reliable."}
      </p>
    </div>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    Promise.resolve(fetchRealPerformanceData())
      .then((result) => {
        if (!mounted) return;
        if (!result) throw new Error("Performance data was empty.");
        setData(result);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error("PerformancePage: failed to load performance data", error);
        setLoadError("Performance data could not be loaded right now.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => (data ? deriveMetrics(data) : null), [data]);

  const academicRows = useMemo(() => {
    if (!data) return [];
    return normalizeTopics(data)
      .sort((a, b) => {
        const statusWeight = { critical: 0, warning: 1, stable: 2, strong: 3 };
        const sa = statusWeight[a.status] ?? 2;
        const sb = statusWeight[b.status] ?? 2;
        if (sa !== sb) return sa - sb;
        return Number(a.accuracy ?? 101) - Number(b.accuracy ?? 101);
      })
      .slice(0, 6);
  }, [data]);

  if (loadError) {
    return (
      <div className="pp-root">
        <style>{THEME_CSS}</style>
        <div className="pp-shell">
          <div className="pp-empty-state">
            <strong>Performance unavailable</strong>
            <span>{loadError}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !metrics) {
    return (
      <div className="pp-root">
        <style>{THEME_CSS}</style>
        <div className="pp-shell">
          <div className="pp-loading">
            <span className="pp-loading-dot" />
            Loading performance diagnosis…
          </div>
        </div>
      </div>
    );
  }

  const execution = data.execution || {};
  const revision = data.revision || {};
  const mistakes = data.mistakes || {};
  const csat = data.csat || {};
  const trends = data.trends?.sevenDay || {};
  const subjects = normalizeSubjects(data);
  const evidenceProfile = buildEvidenceProfile(data, metrics);
  const isPerformanceActive = evidenceProfile.state === "PERFORMANCE_ACTIVE";
  const isBaseline = evidenceProfile.state === "BASELINE_BUILDING";
  const heroTitle = isPerformanceActive
    ? statusLabel(metrics.perfStatus)
    : isBaseline
      ? "BUILDING YOUR BASELINE"
      : "EARLY SIGNALS";
  const contextLabel = "Latest evidence";

  const csatSubject = subjects.find((subject) => subject.id === "csat") || null;
  const optionalSubject = subjects.find((subject) => subject.id === "optional") || metrics.strongestSubject;
  const weakestCsatTopic = normalizeTopics(data)
    .filter((topic) => topic.subject === "CSAT")
    .sort((a, b) => Number(a.accuracy ?? 101) - Number(b.accuracy ?? 101))[0];

  const verdictLead =
    !isPerformanceActive
      ? isBaseline
        ? "MentorOS is learning from your preparation activity so future performance insights are based on real evidence."
        : "MentorOS has started detecting early preparation signals, but more evidence is needed before a reliable performance verdict can be generated."
      : metrics.perfStatus === "strong"
      ? "Performance is strong and broadly balanced."
      : metrics.perfStatus === "stable"
        ? "Performance is holding steady, but the balance underneath the score needs attention."
        : metrics.perfStatus === "warning"
          ? "Performance is under pressure across more than one preparation layer."
          : "Performance has entered a high-risk zone and several signals are weakening together.";

  const verdictDetail = [
    isPerformanceActive && isAvailable(data.academic?.prelimsAccuracy30d)
      ? `Prelims accuracy is ${data.academic.prelimsAccuracy30d.value}% from ${data.academic.prelimsAccuracy30d.sampleSize} attempted questions.`
      : isPerformanceActive
        ? "Prelims accuracy is not yet supported by enough submitted responses."
        : null,
    isPerformanceActive && isAvailable(csat.practiceConsistency)
      ? `CSAT has evidence on ${csat.practiceConsistency.value}/${csat.practiceConsistency.denominator || 7} recent days.`
      : isPerformanceActive
        ? "CSAT readiness needs more practice evidence."
        : null,
    isPerformanceActive && metrics.weakestTopic
      ? `${metrics.weakestTopic.topicName} is the weakest current topic signal.`
      : isPerformanceActive
        ? "No single topic is dominating the risk picture."
        : null,
  ].filter(Boolean).join(" ");

  const improving = [];
  const deteriorating = [];

  if (metrics.completionTrend.sampleSize >= 2 && metrics.completionTrend.delta >= 0) {
    improving.push({
      label: "Plan execution",
      start: metrics.completionTrend.first,
      end: metrics.completionTrend.last,
    });
  } else if (metrics.completionTrend.sampleSize >= 2) {
    deteriorating.push({
      label: "Plan execution",
      start: metrics.completionTrend.first,
      end: metrics.completionTrend.last,
    });
  }

  const improvingSubject = [...subjects]
    .filter((subject) => Number.isFinite(Number(subject.trend)) && Number(subject.trend) > 0 && subject.id !== "csat")
    .sort((a, b) => Number(b.trend) - Number(a.trend))[0];
  if (improvingSubject) {
    improving.push({
      label: improvingSubject.name,
      description: `Trend +${improvingSubject.trend}% · ${statusLabel(improvingSubject.status)}`,
    });
  }

  if (isAvailable(execution.deepWorkHours) && Number(execution.deepWorkHours.value) >= 4) {
    improving.push({ label: "Deep-work capacity", description: `${execution.deepWorkHours.value}h current deep work` });
  }

  if (metrics.accuracyTrend.sampleSize >= 2 && metrics.accuracyTrend.delta < 0) {
    deteriorating.push({
      label: "Prelims accuracy",
      start: metrics.accuracyTrend.first,
      end: metrics.accuracyTrend.last,
    });
  }

  if (metrics.revisionTrend.sampleSize >= 2 && metrics.revisionTrend.delta < 0) {
    deteriorating.push({
      label: "Retention health",
      start: metrics.revisionTrend.first,
      end: metrics.revisionTrend.last,
    });
  }

  if (isAvailable(csat.practiceConsistency) && metrics.csatTouchedDays < (csat.practiceConsistency.denominator || 7)) {
    deteriorating.push({
      label: "CSAT engagement",
      description: isAvailable(csat.practiceConsistency)
        ? `${csat.practiceConsistency.value}/${csat.practiceConsistency.denominator || 7} days touched`
        : "Not enough evidence",
    });
  }

  const attentionItems = [
    {
      level: "High Risk",
      title: "Prelims Readiness Risk",
      text: isAvailable(data.academic?.prelimsAccuracy30d)
        ? metrics.weakTopics.length
          ? "Submitted Prelims responses show weak topic signals that need review."
          : "Submitted Prelims responses do not show a current weak-topic cluster."
        : "Not enough submitted Prelims evidence to assess readiness.",
      tone: "danger",
    },
    {
      level: "Academic Risk",
      title: "Memory Stability Risk",
      text: isAvailable(revision.overdue)
        ? revision.overdue.value > 0
          ? "There are pending revision items overdue in the IST calendar."
          : "No overdue revision items are visible in the current evidence."
        : "Not enough revision evidence to assess memory stability.",
      tone: "warning",
    },
    {
      level: "Watch",
      title: "Execution Sustainability",
      text: isAvailable(execution.completionRate)
        ? "Execution is assessed from real study block completion and logged time."
        : "Not enough execution evidence from study blocks yet.",
      tone: isAvailable(execution.completionRate) ? "calm" : "amber",
    },
  ];

  const activePatterns = [];

  const retentionSeries = availableSeriesValues(trends.revisionCompletion);

  return (
    <div className="pp-root">
      <style>{THEME_CSS}</style>

      <main className="pp-shell">
        <header className="pp-page-head">
          <div>
            <h1>Performance</h1>
            <p>Your preparation diagnosis and performance patterns</p>
          </div>
          {isPerformanceActive && (
            <div className="pp-context-pill" title="Performance reflects the latest synced evidence">
              <span className="pp-context-dot" />
              {contextLabel}
            </div>
          )}
        </header>

        {/* 01 — MENTOR VERDICT */}
        <section className={`pp-card pp-verdict ${isPerformanceActive ? "" : "pp-verdict-baseline"}`.trim()}>
          <div className="pp-verdict-main">
            <div className="pp-verdict-icon" aria-hidden="true">✦</div>
            <div>
              <span className="pp-eyebrow">{isPerformanceActive ? "Mentor Verdict" : "Baseline Status"}</span>
              <div className="pp-verdict-scoreline">
                <strong className={`pp-state ${isPerformanceActive ? metrics.perfStatus : "baseline"}`}>{heroTitle}</strong>
                {isPerformanceActive && (
                  <>
                    <span className="pp-score-separator">•</span>
                    <strong className="pp-score">
                      {metrics.performanceScore}
                      <small>/100</small>
                    </strong>
                  </>
                )}
              </div>
              <p className="pp-verdict-copy">
                <strong>{verdictLead}</strong> {verdictDetail}
              </p>
              {!isPerformanceActive && (
                <div className="pp-hero-evidence">
                  <strong>{evidenceProfile.domainsWithEvidence} of 4 evidence areas ready</strong>
                  <EvidenceStepper domains={evidenceProfile.domains} />
                </div>
              )}
            </div>
          </div>

          {isPerformanceActive ? (
            <div className="pp-verdict-directions">
              <div className="pp-direction-block">
                <span>7-Day Direction</span>
                <strong className={metrics.sevenDayDirection === "Improving" ? "positive" : metrics.sevenDayDirection === "Deteriorating" ? "negative" : "primary"}>
                  {metrics.sevenDayDirection}
                  {metrics.sevenDayDirection !== "Not enough evidence" && (
                    <b aria-hidden="true">{metrics.sevenDayDirection === "Improving" ? "↑" : metrics.sevenDayDirection === "Deteriorating" ? "↓" : "→"}</b>
                  )}
                </strong>
                <Sparkline values={availableSeriesValues(trends.prelimsAccuracy)} tone="primary" height={44} />
              </div>
              <div className="pp-direction-block">
                <span>30-Day Direction</span>
                <strong className={metrics.thirtyDayDirection === "Improving" ? "positive" : metrics.thirtyDayDirection === "Deteriorating" ? "negative" : "primary"}>
                  {metrics.thirtyDayDirection}
                  {metrics.thirtyDayDirection !== "Not enough evidence" && (
                    <b aria-hidden="true">{metrics.thirtyDayDirection === "Improving" ? "↑" : metrics.thirtyDayDirection === "Deteriorating" ? "↓" : "→"}</b>
                  )}
                </strong>
                <Sparkline
                  values={[
                    metrics.executionScore,
                    metrics.academicScore,
                    metrics.revisionScore,
                    metrics.consistencyScore,
                    metrics.performanceScore,
                  ].filter((value) => value !== null && value !== undefined)}
                  tone="success"
                  height={44}
                />
              </div>
            </div>
          ) : null}
        </section>

        {isPerformanceActive ? (
          <div className="pp-intelligence-grid">
            <Section title="What Needs Attention">
              <div className="pp-risk-list">
                {attentionItems.map((item) => <RiskItem key={item.title} {...item} />)}
              </div>
            </Section>

            <Section title="Improving / Deteriorating" period="Last 7 Days">
              <div className="pp-split-trends">
                <div>
                  <span className="pp-column-label positive">Improving ↑</span>
                  <div className="pp-trend-list">
                    {improving.slice(0, 3).map((item) => (
                      <TrendItem key={item.label} positive {...item} />
                    ))}
                    {!improving.length && <p className="pp-muted">No clear improving signal yet.</p>}
                  </div>
                </div>
                <div>
                  <span className="pp-column-label negative">Deteriorating ↓</span>
                  <div className="pp-trend-list">
                    {deteriorating.slice(0, 3).map((item) => (
                      <TrendItem key={item.label} positive={false} {...item} />
                    ))}
                    {!deteriorating.length && <p className="pp-muted">No clear deteriorating signal.</p>}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Pattern Intelligence">
              <div className="pp-pattern-list">
                {evidenceProfile.patternState === "PATTERN_READY" && activePatterns.map((pattern) => <Pattern key={pattern.title} {...pattern} />)}
                {(evidenceProfile.patternState !== "PATTERN_READY" || !activePatterns.length) && (
                  <p className="pp-muted">More historical evidence is required before behavioural patterns can be identified.</p>
                )}
              </div>
            </Section>
          </div>
        ) : (
          <div className="pp-baseline-flow">
            <Section title="Evidence Progress">
              <EvidenceProgress domains={evidenceProfile.domains} />
            </Section>

            <Section title="Pattern Intelligence" className="pp-pattern-strip">
              <p className="pp-lockline"><span aria-hidden="true">🔒</span> More historical evidence is required.</p>
            </Section>
          </div>
        )}

        {/* 05–08 — SUPPORTING EVIDENCE */}
        {isPerformanceActive && (
          <div className="pp-evidence-grid">
              <Section title="Academic Performance" period="Recent" className="pp-academic-card">
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Accuracy</th>
                        <th>Trend</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academicRows.map((topic) => (
                        <tr key={topic.id}>
                          <td>
                            <strong>{topic.topicName}</strong>
                            <small>{topic.subject}</small>
                          </td>
                          <td>{metricText(topic.accuracyMetric, "%")}</td>
                          <td>{topic.trend === null ? "Building trend" : <Direction value={topic.trend} />}</td>
                          <td>
                            <span className={`pp-status-text ${topic.status || (topic.accuracy === null ? "critical" : scoreStatus(topic.accuracy))}`}>
                              {topic.accuracy === null ? "Building baseline" : statusLabel(topic.status || scoreStatus(topic.accuracy))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pp-card-foot">Showing the most relevant current topic signals · {normalizeTopics(data).length} topics tracked</div>
              </Section>

              <Section title="Retention & Revision" period="Last 7 Days">
                <div className="pp-retention-summary">
                  <div className="pp-retention-score">
                    <span>Retention</span>
                    <strong>{isAvailable(revision.retentionScore) ? `${revision.retentionScore.value}%` : "—"}</strong>
                    <Direction value={metrics.revisionTrend.delta} />
                  </div>
                  <Sparkline values={retentionSeries} tone="danger" height={54} />
                </div>
                <div className="pp-legend-list">
                  <MetricRow label="Due today" value={metricText(revision.dueToday)} tone="primary" />
                  <MetricRow label="Overdue" value={metricText(revision.overdue)} tone={isAvailable(revision.overdue) && Number(revision.overdue.value) > 0 ? "negative" : "positive"} />
                  <MetricRow label="Completed today" value={metricText(revision.completedToday)} tone="positive" />
                  <MetricRow label="Revision success" value={metricText(revision.revisionSuccessRate, "%")} />
                </div>
              </Section>

              <Section title="CSAT Readiness" period="Last 7 Days">
                <div className={`pp-readiness ${metrics.csatCritical || !isAvailable(csat.last2DayTouched) ? "at-risk" : "healthy"}`}>
                  <span className="pp-readiness-icon">{metrics.csatCritical || !isAvailable(csat.last2DayTouched) ? "!" : "✓"}</span>
                  <div>
                    <strong>{!isAvailable(csat.last2DayTouched) ? "Building baseline" : metrics.csatCritical ? "At Risk" : "Holding"}</strong>
                    <p>{!isAvailable(csat.last2DayTouched) ? "CSAT needs more logged practice before readiness can be assessed." : metrics.csatCritical ? "Recent engagement is below a safe preparation rhythm." : "Recent engagement is present."}</p>
                  </div>
                </div>
                <div className="pp-legend-list">
                  <MetricRow label="Practice consistency" value={isAvailable(csat.practiceConsistency) ? `${csat.practiceConsistency.value}/${csat.practiceConsistency.denominator || 7} days` : "Building baseline"} tone={isAvailable(csat.practiceConsistency) && Number(csat.practiceConsistency.value) >= 5 ? "positive" : "neutral"} />
                  <MetricRow label="Weekly practice" value={metricText(csat.weeklyMinutes, " min")} />
                  <MetricRow label="CSAT subject score" value={isAvailable(csat.score) ? `${csat.score.value}/100` : "Building baseline"} tone={isAvailable(csat.score) && Number(csat.score.value) < 50 ? "negative" : "neutral"} />
                  <MetricRow label="Weakest area" value={weakestCsatTopic?.topicName?.replace(/^CSAT\s*[–-]\s*/i, "") || "Building baseline"} />
                </div>
              </Section>

              <Section title="Execution Pattern" period="Current + 7 Days">
                <div className="pp-execution-score">
                  <div>
                    <span>Plan vs actual</span>
                    <strong>{metrics.completionPct === null ? "Building baseline" : `${metrics.completionPct}%`}</strong>
                  </div>
                  <Progress value={metrics.completionPct} tone={metrics.completionPct !== null && metrics.completionPct >= 75 ? "success" : "warning"} />
                </div>
                <div className="pp-legend-list">
                  <MetricRow label="Deep work" value={metricText(execution.deepWorkHours, "h")} />
                  <MetricRow label="Focus score" value={metricText(execution.focusScore, "%")} />
                  <MetricRow label="Interruptions" value={metricText(execution.interruptions)} tone={isAvailable(execution.interruptions) && Number(execution.interruptions.value) >= 4 ? "negative" : "positive"} />
                  <MetricRow label="Fatigue signal" value="Building baseline" tone="neutral" />
                  <MetricRow label="Consistency" value={metricText(execution.streakDays, " day streak")} />
                  <MetricRow label="Strongest anchor" value={optionalSubject?.name || "—"} />
                </div>
              </Section>
          </div>
        )}

        {/* 09 — SCORE MODEL */}
        <details className="pp-card pp-score-model">
          <summary>
            <span className="pp-info-icon">i</span>
            <strong>{isPerformanceActive ? "How is my Performance Score calculated?" : "How will MentorOS calculate my Performance Score?"}</strong>
            <span className="pp-score-summary">{isPerformanceActive && metrics.performanceScore !== null ? `Current score ${metrics.performanceScore}/100` : "Available after baseline"}</span>
            <span className="pp-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="pp-score-body">
            {[
              ["Execution", 35, metrics.executionScore, metrics.execStatus],
              ["Academic", 35, metrics.academicScore, metrics.acadStatus],
              ["Retention", 20, metrics.revisionScore, metrics.revStatus],
              ["Consistency", 10, metrics.consistencyScore, metrics.consistencyStatus],
            ].map(([label, weight, value, status]) => (
              <div className="pp-score-row" key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>{weight}% weight</span>
                </div>
                <Progress value={value} tone={status === "strong" ? "success" : status === "critical" ? "danger" : status === "warning" ? "warning" : status === "neutral" ? "neutral" : "primary"} />
                <strong>{value === null ? isPerformanceActive ? "Not enough evidence" : "Waiting" : `${value}/100`}</strong>
              </div>
            ))}
            <p className="pp-score-note">
              The score explains the current diagnosis; it does not replace the underlying academic, retention, CSAT, and execution evidence shown above.
            </p>
          </div>
        </details>
      </main>
    </div>
  );
}

const THEME_CSS = `
  /* -------------------------------------------------------------------------
     PAGE THEME TOKENS
     Light is the default. Dark overrides support common app theme selectors.
     If MentorOS already exposes --mos-* variables, these local tokens can be
     remapped to them later without changing component markup.
     ------------------------------------------------------------------------- */

  .pp-root {
    --pp-bg: #f7f8fb;
    --pp-surface: #ffffff;
    --pp-surface-soft: #f9fafc;
    --pp-surface-hover: #f5f7fb;
    --pp-border: #e5e9f2;
    --pp-border-strong: #d8deea;
    --pp-text: #111827;
    --pp-text-2: #475569;
    --pp-text-3: #8490a3;
    --pp-primary: #1769f4;
    --pp-primary-soft: #edf4ff;
    --pp-success: #0f9f63;
    --pp-success-soft: #ebfaf3;
    --pp-warning: #e98a08;
    --pp-warning-soft: #fff7e8;
    --pp-danger: #e23b3b;
    --pp-danger-soft: #fff0f0;
    --pp-purple: #7557e8;
    --pp-purple-soft: #f2efff;
    --pp-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 24px rgba(15, 23, 42, 0.035);
    min-height: 100%;
    background: var(--pp-bg);
    color: var(--pp-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    transition: background-color .2s ease, color .2s ease;
  }

  /* Common theme hooks. This lets the component follow MentorOS if dark mode
     is expressed as .dark, .theme-dark, data-theme=dark or data-mode=dark. */
  :where(html.dark, body.dark, .theme-dark, [data-theme="dark"], [data-mode="dark"]) .pp-root,
  .pp-root.dark,
  .pp-root[data-theme="dark"] {
    --pp-bg: #080c14;
    --pp-surface: #0e1420;
    --pp-surface-soft: #111925;
    --pp-surface-hover: #151f2d;
    --pp-border: #202b3a;
    --pp-border-strong: #2a3647;
    --pp-text: #f1f5f9;
    --pp-text-2: #aab6c6;
    --pp-text-3: #738095;
    --pp-primary: #5792ff;
    --pp-primary-soft: rgba(87, 146, 255, .12);
    --pp-success: #43c58a;
    --pp-success-soft: rgba(67, 197, 138, .10);
    --pp-warning: #f1a63a;
    --pp-warning-soft: rgba(241, 166, 58, .10);
    --pp-danger: #ff6b6b;
    --pp-danger-soft: rgba(255, 107, 107, .10);
    --pp-purple: #a98dff;
    --pp-purple-soft: rgba(169, 141, 255, .10);
    --pp-shadow: 0 0 0 1px rgba(255,255,255,.01), 0 12px 34px rgba(0, 0, 0, .16);
  }

  .pp-root *, .pp-root *::before, .pp-root *::after { box-sizing: border-box; }
  .pp-root button, .pp-root input, .pp-root select { font: inherit; }

  .pp-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 26px 26px 34px;
  }

  .pp-page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
  }
  .pp-page-head h1 {
    margin: 0 0 3px;
    color: var(--pp-text);
    font-size: clamp(22px, 2vw, 30px);
    line-height: 1.15;
    letter-spacing: -.035em;
    font-weight: 760;
  }
  .pp-page-head p { margin: 0; color: var(--pp-text-2); font-size: 13px; }

  .pp-context-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    padding: 8px 11px;
    border: 1px solid var(--pp-border);
    border-radius: 10px;
    color: var(--pp-text-2);
    background: var(--pp-surface);
    font-size: 12px;
  }
  .pp-context-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pp-success); box-shadow: 0 0 0 3px var(--pp-success-soft); }
  .pp-context-pill.collecting,
  .pp-context-pill.early {
    color: var(--pp-text-2);
    background: var(--pp-primary-soft);
    border-color: color-mix(in srgb, var(--pp-primary) 25%, var(--pp-border));
  }
  .pp-context-pill.collecting .pp-context-dot,
  .pp-context-pill.early .pp-context-dot {
    background: var(--pp-primary);
    box-shadow: 0 0 0 3px var(--pp-primary-soft);
  }

  .pp-card {
    background: var(--pp-surface);
    border: 1px solid var(--pp-border);
    border-radius: 16px;
    box-shadow: var(--pp-shadow);
  }

  /* VERDICT */
  .pp-verdict {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(360px, .85fr);
    gap: 28px;
    padding: 24px 26px;
    margin-bottom: 16px;
  }
  .pp-verdict-baseline { grid-template-columns: 1fr; }
  .pp-verdict-main { display: flex; align-items: flex-start; gap: 16px; min-width: 0; }
  .pp-verdict-icon {
    width: 44px; height: 44px; flex: 0 0 44px;
    display: grid; place-items: center;
    color: #fff; background: var(--pp-primary);
    border-radius: 50%; font-size: 21px;
    box-shadow: 0 7px 18px color-mix(in srgb, var(--pp-primary) 20%, transparent);
  }
  .pp-eyebrow {
    display: block; margin-bottom: 5px;
    color: var(--pp-text-2); font-size: 11px; font-weight: 760;
    text-transform: uppercase; letter-spacing: .07em;
  }
  .pp-verdict-scoreline { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .pp-state { font-size: clamp(25px, 2.3vw, 34px); line-height: 1; letter-spacing: -.045em; text-transform: uppercase; }
  .pp-state.strong { color: var(--pp-success); }
  .pp-state.stable { color: var(--pp-primary); }
  .pp-state.warning { color: var(--pp-warning); }
  .pp-state.critical { color: var(--pp-danger); }
  .pp-state.baseline { color: var(--pp-primary); }
  .pp-score-separator { color: var(--pp-text-3); font-size: 20px; }
  .pp-score { color: var(--pp-text); font-size: 26px; line-height: 1; }
  .pp-score small { margin-left: 4px; color: var(--pp-text-2); font-size: 14px; font-weight: 600; }
  .pp-verdict-copy { max-width: 730px; margin: 0; color: var(--pp-text-2); font-size: 14px; line-height: 1.65; }
  .pp-verdict-copy strong { color: var(--pp-text); font-weight: 650; }
  .pp-hero-evidence {
    display: grid;
    gap: 11px;
    margin-top: 16px;
  }
  .pp-hero-evidence > strong {
    color: var(--pp-text);
    font-size: 13px;
    font-weight: 720;
  }
  .pp-evidence-stepper {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    color: var(--pp-text-3);
    font-size: 11px;
    font-weight: 680;
  }
  .pp-step {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .pp-step.ready { color: var(--pp-primary); }
  .pp-step b {
    color: currentColor;
    font-size: 12px;
    line-height: 1;
  }
  .pp-evidence-stepper i {
    width: 22px;
    height: 1px;
    background: var(--pp-border-strong);
  }

  .pp-verdict-directions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding-left: 28px;
    border-left: 1px solid var(--pp-border);
  }
  .pp-direction-block { min-width: 0; }
  .pp-direction-block > span { display: block; color: var(--pp-text-3); font-size: 10px; font-weight: 700; letter-spacing: .065em; text-transform: uppercase; margin-bottom: 6px; }
  .pp-direction-block > strong { display: inline-flex; gap: 7px; align-items: center; font-size: 16px; margin-bottom: 7px; }
  .pp-direction-block > strong.primary { color: var(--pp-primary); }
  .positive { color: var(--pp-success) !important; }
  .negative { color: var(--pp-danger) !important; }
  .warning { color: var(--pp-warning) !important; }
  .primary { color: var(--pp-primary) !important; }
  .neutral { color: var(--pp-text) !important; }

  .pp-spark { width: 100%; min-width: 120px; overflow: visible; }
  .pp-spark polyline { stroke: var(--pp-primary); stroke-width: 2; }
  .pp-spark circle { fill: var(--pp-primary); }
  .pp-spark.success polyline { stroke: var(--pp-success); }
  .pp-spark.success circle { fill: var(--pp-success); }
  .pp-spark.danger polyline { stroke: var(--pp-danger); }
  .pp-spark.danger circle { fill: var(--pp-danger); }
  .pp-spark-empty { border-bottom: 1px dashed var(--pp-border); }

  /* INTERPRETATION GRID */
  .pp-intelligence-grid {
    display: grid;
    grid-template-columns: 1.02fr 1.12fr 1.16fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  .pp-baseline-flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, .42fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  .pp-section { padding: 18px 18px 16px; min-width: 0; }
  .pp-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
  .pp-section-head h2 { margin: 0; color: var(--pp-text); font-size: 14px; letter-spacing: -.015em; font-weight: 750; }
  .pp-period { color: var(--pp-text-3); font-size: 10px; white-space: nowrap; }

  .pp-risk-list { display: flex; flex-direction: column; gap: 13px; }
  .pp-risk { display: grid; grid-template-columns: 12px 1fr; gap: 10px; align-items: flex-start; }
  .pp-risk-dot { width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: var(--pp-text-3); box-shadow: 0 0 0 4px color-mix(in srgb, var(--pp-text-3) 12%, transparent); }
  .pp-risk.danger .pp-risk-dot { background: var(--pp-danger); box-shadow: 0 0 0 4px var(--pp-danger-soft); }
  .pp-risk.warning .pp-risk-dot, .pp-risk.amber .pp-risk-dot { background: var(--pp-warning); box-shadow: 0 0 0 4px var(--pp-warning-soft); }
  .pp-risk.calm .pp-risk-dot { background: var(--pp-success); box-shadow: 0 0 0 4px var(--pp-success-soft); }
  .pp-risk-level { display: block; margin-bottom: 2px; color: var(--pp-text-3); font-size: 9px; font-weight: 760; text-transform: uppercase; letter-spacing: .07em; }
  .pp-risk.danger .pp-risk-level { color: var(--pp-danger); }
  .pp-risk.warning .pp-risk-level, .pp-risk.amber .pp-risk-level { color: var(--pp-warning); }
  .pp-risk.calm .pp-risk-level { color: var(--pp-success); }
  .pp-risk h3 { margin: 0 0 2px; color: var(--pp-text); font-size: 12.5px; font-weight: 700; }
  .pp-risk p { margin: 0; color: var(--pp-text-2); font-size: 11.5px; line-height: 1.45; }

  .pp-split-trends { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .pp-column-label { display: block; margin-bottom: 9px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 760; }
  .pp-trend-list { display: flex; flex-direction: column; gap: 10px; }
  .pp-trend-item { display: grid; grid-template-columns: 25px 1fr auto; gap: 8px; align-items: center; min-width: 0; }
  .pp-trend-icon { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; font-weight: 800; background: var(--pp-surface-soft); }
  .pp-trend-icon.positive { background: var(--pp-success-soft); }
  .pp-trend-icon.negative { background: var(--pp-danger-soft); }
  .pp-trend-copy { min-width: 0; }
  .pp-trend-copy strong { display: block; color: var(--pp-text); font-size: 11.5px; font-weight: 660; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-trend-copy span { display: block; color: var(--pp-text-3); font-size: 10px; margin-top: 1px; }
  .pp-direction { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 720; }
  .pp-direction.positive { color: var(--pp-success); }
  .pp-direction.negative { color: var(--pp-danger); }
  .pp-direction.neutral { color: var(--pp-text-3); }

  .pp-evidence-progress-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .pp-evidence-domain {
    min-height: 96px;
    padding: 12px;
    border: 1px solid var(--pp-border);
    border-radius: 12px;
    background: var(--pp-surface-soft);
  }
  .pp-evidence-domain.ready {
    border-color: color-mix(in srgb, var(--pp-primary) 34%, var(--pp-border));
    background: var(--pp-primary-soft);
  }
  .pp-evidence-domain > span {
    display: block;
    margin-bottom: 8px;
    color: var(--pp-text-3);
    font-size: 10px;
    font-weight: 720;
  }
  .pp-evidence-domain strong {
    display: block;
    margin-bottom: 5px;
    color: var(--pp-text);
    font-size: 12px;
    font-weight: 700;
  }
  .pp-evidence-domain.ready strong { color: var(--pp-primary); }
  .pp-evidence-domain small {
    display: block;
    color: var(--pp-text-3);
    font-size: 10px;
    line-height: 1.4;
  }
  .pp-progress-note {
    margin: 12px 0 0;
    color: var(--pp-text-3);
    font-size: 11px;
    line-height: 1.45;
  }

  .pp-pattern-list { display: flex; flex-direction: column; gap: 14px; }
  .pp-pattern-strip { align-self: stretch; }
  .pp-lockline {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 96px;
    margin: 0;
    padding: 12px;
    color: var(--pp-text-2);
    background: var(--pp-surface-soft);
    border: 1px dashed var(--pp-border-strong);
    border-radius: 12px;
    font-size: 11.5px;
    line-height: 1.45;
  }
  .pp-pattern { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: flex-start; }
  .pp-pattern-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--pp-purple-soft); color: var(--pp-purple); font-weight: 800; }
  .pp-pattern:nth-child(2) .pp-pattern-icon { color: var(--pp-warning); background: var(--pp-warning-soft); }
  .pp-pattern:nth-child(3) .pp-pattern-icon { color: var(--pp-primary); background: var(--pp-primary-soft); }
  .pp-pattern h3 { margin: 0 0 2px; color: var(--pp-text); font-size: 12px; font-weight: 700; }
  .pp-pattern p { margin: 0; color: var(--pp-text-2); font-size: 11px; line-height: 1.4; }
  .pp-chain { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .pp-chain span { padding: 4px 7px; border: 1px solid var(--pp-border); border-radius: 7px; background: var(--pp-surface-soft); color: var(--pp-text-2); font-size: 9.5px; white-space: nowrap; }
  .pp-chain b { color: var(--pp-text-3); font-size: 10px; }
  .pp-muted { color: var(--pp-text-3); font-size: 11px; margin: 0; }

  /* EVIDENCE */
  .pp-evidence-grid {
    display: grid;
    grid-template-columns: 1.18fr .92fr .92fr .92fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  .pp-academic-card { min-width: 0; }
  .pp-table-wrap { overflow-x: auto; }
  .pp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .pp-table th { padding: 0 6px 8px; color: var(--pp-text-3); text-align: left; font-size: 9px; font-weight: 720; text-transform: uppercase; letter-spacing: .045em; border-bottom: 1px solid var(--pp-border); }
  .pp-table th:first-child { width: 48%; }
  .pp-table th:nth-child(2) { width: 17%; }
  .pp-table th:nth-child(3) { width: 16%; }
  .pp-table th:nth-child(4) { width: 19%; }
  .pp-table td { padding: 9px 6px; border-bottom: 1px solid var(--pp-border); color: var(--pp-text); font-size: 10.5px; vertical-align: middle; }
  .pp-table tbody tr:last-child td { border-bottom: 0; }
  .pp-table td strong { display: block; font-size: 10.5px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-table td small { display: block; margin-top: 2px; color: var(--pp-text-3); font-size: 9px; }
  .pp-status-text { font-size: 9px; font-weight: 700; white-space: nowrap; }
  .pp-status-text.strong { color: var(--pp-success); }
  .pp-status-text.stable { color: var(--pp-success); }
  .pp-status-text.warning { color: var(--pp-warning); }
  .pp-status-text.critical { color: var(--pp-danger); }
  .pp-card-foot { margin-top: 8px; color: var(--pp-text-3); font-size: 9px; }

  .pp-retention-summary { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--pp-border); }
  .pp-retention-score span { display: block; color: var(--pp-text-3); font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  .pp-retention-score > strong { display: block; color: var(--pp-danger); font-size: 23px; line-height: 1.1; margin: 3px 0 2px; }
  .pp-legend-list { display: flex; flex-direction: column; }
  .pp-metric-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--pp-border); }
  .pp-metric-row:last-child { border-bottom: 0; }
  .pp-metric-row > div { min-width: 0; }
  .pp-metric-row span { color: var(--pp-text-2); font-size: 10.5px; }
  .pp-metric-row small { display: block; color: var(--pp-text-3); font-size: 8.5px; }
  .pp-metric-row > strong { max-width: 58%; color: var(--pp-text); font-size: 10.5px; font-weight: 700; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .pp-readiness { display: flex; gap: 9px; align-items: flex-start; padding: 10px 11px; border-radius: 11px; margin-bottom: 7px; }
  .pp-readiness.at-risk { background: var(--pp-danger-soft); }
  .pp-readiness.healthy { background: var(--pp-success-soft); }
  .pp-readiness-icon { width: 25px; height: 25px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; font-size: 12px; font-weight: 800; }
  .pp-readiness.at-risk .pp-readiness-icon, .pp-readiness.at-risk strong { color: var(--pp-danger); }
  .pp-readiness.healthy .pp-readiness-icon, .pp-readiness.healthy strong { color: var(--pp-success); }
  .pp-readiness strong { display: block; font-size: 12px; margin-bottom: 2px; }
  .pp-readiness p { margin: 0; color: var(--pp-text-2); font-size: 9.5px; line-height: 1.35; }

  .pp-execution-score { margin-bottom: 7px; padding-bottom: 8px; border-bottom: 1px solid var(--pp-border); }
  .pp-execution-score > div { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 7px; }
  .pp-execution-score span { color: var(--pp-text-2); font-size: 10.5px; }
  .pp-execution-score strong { color: var(--pp-success); font-size: 17px; }
  .pp-progress { height: 5px; overflow: hidden; border-radius: 999px; background: var(--pp-surface-soft); border: 1px solid var(--pp-border); }
  .pp-progress > span { display: block; height: 100%; border-radius: inherit; background: var(--pp-primary); }
  .pp-progress > span.success { background: var(--pp-success); }
  .pp-progress > span.warning { background: var(--pp-warning); }
  .pp-progress > span.danger { background: var(--pp-danger); }
  .pp-progress > span.primary { background: var(--pp-primary); }
  .pp-progress > span.neutral { background: var(--pp-text-3); }

  /* SCORE MODEL */
  .pp-score-model { overflow: hidden; }
  .pp-score-model summary {
    list-style: none;
    display: grid;
    grid-template-columns: 26px auto 1fr 24px;
    align-items: center;
    gap: 9px;
    min-height: 58px;
    padding: 0 18px;
    cursor: pointer;
    user-select: none;
  }
  .pp-score-model summary::-webkit-details-marker { display: none; }
  .pp-info-icon { width: 22px; height: 22px; display: grid; place-items: center; color: var(--pp-primary); border: 1px solid color-mix(in srgb, var(--pp-primary) 45%, var(--pp-border)); border-radius: 50%; font-size: 11px; font-weight: 800; }
  .pp-score-model summary strong { font-size: 12px; color: var(--pp-text); }
  .pp-score-summary { justify-self: end; color: var(--pp-text-3); font-size: 10px; }
  .pp-chevron { color: var(--pp-text-3); font-size: 17px; transition: transform .2s ease; text-align: center; }
  .pp-score-model[open] .pp-chevron { transform: rotate(180deg); }
  .pp-score-body { border-top: 1px solid var(--pp-border); padding: 14px 18px 16px; }
  .pp-score-row { display: grid; grid-template-columns: 150px 1fr 60px; gap: 14px; align-items: center; padding: 7px 0; }
  .pp-score-row > div:first-child strong { display: block; font-size: 10.5px; color: var(--pp-text); }
  .pp-score-row > div:first-child span { display: block; color: var(--pp-text-3); font-size: 9px; }
  .pp-score-row > strong { color: var(--pp-text-2); font-size: 10px; text-align: right; }
  .pp-score-note { margin: 10px 0 0; padding-top: 10px; border-top: 1px solid var(--pp-border); color: var(--pp-text-3); font-size: 10px; }

  .pp-loading, .pp-empty-state {
    min-height: 280px; display: flex; align-items: center; justify-content: center; gap: 10px;
    color: var(--pp-text-2); background: var(--pp-surface); border: 1px solid var(--pp-border); border-radius: 16px;
  }
  .pp-loading-dot { width: 9px; height: 9px; background: var(--pp-primary); border-radius: 50%; animation: ppPulse 1.1s ease-in-out infinite; }
  .pp-empty-state { flex-direction: column; }
  .pp-empty-state strong { color: var(--pp-text); }
  @keyframes ppPulse { 0%,100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1); } }

  @media (max-width: 1180px) {
    .pp-verdict { grid-template-columns: 1fr; }
    .pp-verdict-directions { padding-left: 60px; border-left: 0; }
    .pp-intelligence-grid { grid-template-columns: 1fr 1fr; }
    .pp-intelligence-grid > :last-child { grid-column: 1 / -1; }
    .pp-baseline-flow { grid-template-columns: 1fr; }
    .pp-evidence-grid { grid-template-columns: 1.25fr 1fr; }
  }

  @media (max-width: 760px) {
    .pp-shell { padding: 18px 14px 26px; }
    .pp-page-head { align-items: flex-start; }
    .pp-context-pill { display: none; }
    .pp-verdict { padding: 19px 17px; gap: 20px; }
    .pp-verdict-icon { width: 38px; height: 38px; flex-basis: 38px; }
    .pp-verdict-directions { padding-left: 0; grid-template-columns: 1fr 1fr; }
    .pp-evidence-progress-grid { grid-template-columns: 1fr 1fr; }
    .pp-intelligence-grid, .pp-evidence-grid { grid-template-columns: 1fr; }
    .pp-intelligence-grid > :last-child { grid-column: auto; }
    .pp-split-trends { grid-template-columns: 1fr; }
    .pp-score-model summary { grid-template-columns: 26px 1fr 24px; }
    .pp-score-summary { display: none; }
    .pp-score-row { grid-template-columns: 105px 1fr 52px; gap: 8px; }
  }

  @media (max-width: 480px) {
    .pp-verdict-directions { grid-template-columns: 1fr; }
    .pp-state { font-size: 24px; }
    .pp-score { font-size: 22px; }
    .pp-evidence-progress-grid { grid-template-columns: 1fr; }
    .pp-table th:nth-child(3), .pp-table td:nth-child(3) { display: none; }
    .pp-table th:first-child { width: 58%; }
    .pp-table th:nth-child(2) { width: 20%; }
    .pp-table th:nth-child(4) { width: 22%; }
  }
`;
