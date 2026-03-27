import {
    formatNumber,
    formatPercent,
    getMetricTone,
} from "./prelimsDashboardUtils";

const shellStyle = {
    background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 16px 40px rgba(2, 6, 23, 0.28)",
};

const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
};

const cardStyle = {
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: 16,
    padding: 14,
    minHeight: 108,
};

function MetricCard({ title, value, subtitle, tone }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: tone || "#f8fafc", lineHeight: 1.1 }}>
                {value}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>{subtitle}</div>
        </div>
    );
}

export default function DashboardSummary({ summary = {}, behaviour = {} }) {
    const accuracy = Number(summary.accuracy ?? 0);
    const guessRate = Number(summary.guessRate ?? behaviour.guessRate ?? 0);

    return (
        <section style={shellStyle}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#38bdf8", fontWeight: 700, letterSpacing: 0.4 }}>
                    AIR-1 TEST INTELLIGENCE
                </div>
                <h3 style={{ margin: "6px 0 4px 0", color: "#f8fafc", fontSize: 24 }}>
                    Performance Snapshot
                </h3>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                    Live synthesis from Phase 3A analytics API
                </div>
            </div>

            <div style={gridStyle}>
                <MetricCard
                    title="Accuracy"
                    value={formatPercent(accuracy)}
                    subtitle="Overall conversion quality"
                    tone={getMetricTone(accuracy)}
                />
                <MetricCard
                    title="Attempted"
                    value={formatNumber(summary.attempted)}
                    subtitle={`Out of ${formatNumber(summary.totalQuestions || summary.total)}`}
                    tone="#f8fafc"
                />
                <MetricCard
                    title="Correct"
                    value={formatNumber(summary.correct)}
                    subtitle="High-confidence right answers"
                    tone="#22c55e"
                />
                <MetricCard
                    title="Wrong"
                    value={formatNumber(summary.wrong)}
                    subtitle="Penalty-causing attempts"
                    tone="#ef4444"
                />
                <MetricCard
                    title="Guess Rate"
                    value={formatPercent(guessRate)}
                    subtitle="Risk behaviour indicator"
                    tone={getMetricTone(guessRate, true)}
                />
                <MetricCard
                    title="Fast Wrong"
                    value={formatNumber(behaviour.fastWrong)}
                    subtitle="Impulse / speed errors"
                    tone="#f59e0b"
                />
                <MetricCard
                    title="Safe Attempts"
                    value={formatNumber(behaviour.safeAttempts)}
                    subtitle="Controlled attempts"
                    tone="#22c55e"
                />
                <MetricCard
                    title="Risky Attempts"
                    value={formatNumber(behaviour.riskyAttempts)}
                    subtitle="High uncertainty attempts"
                    tone="#ef4444"
                />
            </div>
        </section>
    );
}