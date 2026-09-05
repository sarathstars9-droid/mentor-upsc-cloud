import { formatNumber, formatPercent } from "./prelimsDashboardUtils";

export default function DashboardSummary({ summary = {}, behaviour = {} }) {
  const accuracy = Number(summary.accuracy ?? 0);
  const guessRate = Number(summary.guessRate ?? behaviour.guessRate ?? 0);
  const primary = [
    ["Accuracy", formatPercent(accuracy), "primary", "Overall conversion"],
    ["Correct", formatNumber(summary.correct), "success", "Correct attempts"],
    ["Wrong", formatNumber(summary.wrong), "danger", "Penalty-causing attempts"],
    ["Guess Rate", formatPercent(guessRate), guessRate > 40 ? "warning" : "purple", "Risk behaviour"],
  ];
  const attemptedCount = summary.attempted ?? ((summary.correct || 0) + (summary.wrong || 0));
  const totalCount = summary.totalQuestions ?? summary.total ?? (attemptedCount + (summary.unattempted || 0));
  const secondary = [
    ["Attempted", `${formatNumber(attemptedCount)} / ${formatNumber(totalCount)}`, "", "Coverage in this test"],
    ["Fast Wrong", formatNumber(behaviour.fastWrong ?? summary.fastWrong), "warning", "Impulse errors"],
    ["Safe Attempts", formatNumber(behaviour.safeAttempts ?? summary.safeAttempts), "success", "Controlled attempts"],
    ["Risky Attempts", formatNumber(behaviour.riskyAttempts ?? summary.riskyAttempts), "danger", "Low-confidence attempts"],
  ];

  return (
    <section className="mos-practice-card mos-list-panel">
      <div className="mos-practice-section-head">
        <div>
          <h2>Performance Snapshot</h2>
          <div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>The four signals that matter most, plus supporting behaviour metrics.</div>
        </div>
      </div>
      <div className="mos-metric-grid">
        {[...primary, ...secondary].map(([label, value, tone, sub]) => (
          <div className={`mos-metric-card${tone ? ` mos-metric-card--${tone}` : ""}`} key={label}>
            <div className="mos-metric-card__label">{label}</div>
            <div className="mos-metric-card__value">{value}</div>
            <div className="mos-metric-card__sub">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
