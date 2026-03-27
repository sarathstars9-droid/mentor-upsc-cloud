import {
    formatPercent,
    normalizeArray,
    getWeakItemAccuracy,
    getWeakItemAttempts,
    getWeakItemLabel,
} from "./prelimsDashboardUtils";

const panelStyle = {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
};

const blockStyle = {
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    borderRadius: 14,
    padding: 14,
};

function WeakList({ title, items, accent }) {
    const safeItems = normalizeArray(items);

    return (
        <div style={blockStyle}>
            <div style={{ color: accent, fontWeight: 700, marginBottom: 10 }}>{title}</div>

            {safeItems.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>No weak signals detected yet.</div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {safeItems.slice(0, 6).map((item, index) => {
                        const label = getWeakItemLabel(item);
                        const accuracy = getWeakItemAccuracy(item);
                        const attempts = getWeakItemAttempts(item);

                        return (
                            <div
                                key={`${title}-${index}-${label}`}
                                style={{
                                    padding: 10,
                                    borderRadius: 12,
                                    background: "rgba(2, 6, 23, 0.45)",
                                    border: "1px solid rgba(148, 163, 184, 0.1)",
                                }}
                            >
                                <div style={{ color: "#f8fafc", fontWeight: 600, marginBottom: 6 }}>{label}</div>
                                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#94a3b8" }}>
                                    {accuracy !== null && <span>Accuracy: {formatPercent(accuracy)}</span>}
                                    {attempts !== null && <span>Attempts: {attempts}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function WeakAreasPanel({
    weakSubjects = [],
    weakNodes = [],
    weakTypes = [],
}) {
    return (
        <section style={panelStyle}>
            <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 20 }}>Weak Area Radar</h3>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                    Exact subject, node, and question-pattern weaknesses
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                }}
            >
                <WeakList title="Weak Subjects" items={weakSubjects} accent="#38bdf8" />
                <WeakList title="Weak Nodes" items={weakNodes} accent="#f59e0b" />
                <WeakList title="Weak Types" items={weakTypes} accent="#a78bfa" />
            </div>
        </section>
    );
}