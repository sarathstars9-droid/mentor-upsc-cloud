import {
    getStatRows,
    getRowAccuracy,
    getRowAttempted,
    getRowCorrect,
    getRowLabel,
    getRowWrong,
    formatPercent,
} from "./prelimsDashboardUtils";

const panelStyle = {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
};

function MiniTable({ title, rows }) {
    const safeRows = getStatRows(rows).slice(0, 8);

    return (
        <div
            style={{
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
                borderRadius: 14,
                padding: 14,
                overflowX: "auto",
            }}
        >
            <div style={{ color: "#f8fafc", fontWeight: 700, marginBottom: 10 }}>{title}</div>

            {safeRows.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>No data available.</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                            <th style={{ padding: "8px 6px" }}>Label</th>
                            <th style={{ padding: "8px 6px" }}>Attempted</th>
                            <th style={{ padding: "8px 6px" }}>Correct</th>
                            <th style={{ padding: "8px 6px" }}>Wrong</th>
                            <th style={{ padding: "8px 6px" }}>Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {safeRows.map((row, index) => (
                            <tr
                                key={`${title}-${index}-${getRowLabel(row)}`}
                                style={{ borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}
                            >
                                <td style={{ padding: "10px 6px", color: "#e2e8f0", fontWeight: 600 }}>
                                    {getRowLabel(row)}
                                </td>
                                <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>{getRowAttempted(row)}</td>
                                <td style={{ padding: "10px 6px", color: "#86efac" }}>{getRowCorrect(row)}</td>
                                <td style={{ padding: "10px 6px", color: "#fca5a5" }}>{getRowWrong(row)}</td>
                                <td style={{ padding: "10px 6px", color: "#f8fafc" }}>
                                    {formatPercent(getRowAccuracy(row))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default function StatsBreakdownPanel({
    subjectStats = {},
    typeStats = {},
    difficultyStats = {},
    nodeStats = {},
}) {
    return (
        <section style={panelStyle}>
            <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 20 }}>Breakdown Tables</h3>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                    Detailed statistics by subject, type, difficulty, and node
                </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
                <MiniTable title="Subject Stats" rows={subjectStats} />
                <MiniTable title="Question Type Stats" rows={typeStats} />
                <MiniTable title="Difficulty Stats" rows={difficultyStats} />
                <MiniTable title="Node Stats" rows={nodeStats} />
            </div>
        </section>
    );
}