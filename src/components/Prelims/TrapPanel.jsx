import {
    normalizeArray,
    getTrapLabel,
    getTrapCount,
} from "./prelimsDashboardUtils";

const panelStyle = {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
};

const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: "#fecaca",
    background: "rgba(127, 29, 29, 0.35)",
    border: "1px solid rgba(239, 68, 68, 0.24)",
};

export default function TrapPanel({ trapAlerts = [], trapStats = {} }) {
    const alerts = normalizeArray(trapAlerts);
    const trapRows = Array.isArray(trapStats)
        ? trapStats
        : Object.entries(trapStats || {}).map(([key, value]) => ({
            trapType: key,
            ...(typeof value === "object" && value !== null ? value : { count: value }),
        }));

    return (
        <section style={panelStyle}>
            <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 20 }}>Trap Intelligence</h3>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                    Detects UPSC-style elimination and wording traps
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(280px, 1.1fr) minmax(280px, 0.9fr)",
                    gap: 14,
                }}
            >
                <div
                    style={{
                        background: "rgba(15, 23, 42, 0.72)",
                        border: "1px solid rgba(148, 163, 184, 0.12)",
                        borderRadius: 14,
                        padding: 14,
                    }}
                >
                    <div style={{ color: "#f8fafc", fontWeight: 700, marginBottom: 10 }}>Trap Alerts</div>
                    {alerts.length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>No trap alerts detected.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {alerts.map((alert, index) => (
                                <div
                                    key={`trap-alert-${index}`}
                                    style={{
                                        background: "rgba(127, 29, 29, 0.18)",
                                        border: "1px solid rgba(239, 68, 68, 0.18)",
                                        borderRadius: 12,
                                        padding: 12,
                                        color: "#fee2e2",
                                        fontSize: 14,
                                    }}
                                >
                                    {typeof alert === "string"
                                        ? alert
                                        : alert.message || alert.text || JSON.stringify(alert)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        background: "rgba(15, 23, 42, 0.72)",
                        border: "1px solid rgba(148, 163, 184, 0.12)",
                        borderRadius: 14,
                        padding: 14,
                    }}
                >
                    <div style={{ color: "#f8fafc", fontWeight: 700, marginBottom: 10 }}>Trap Breakdown</div>
                    {trapRows.length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>No trap statistics available.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {trapRows.map((item, index) => {
                                const label = getTrapLabel(item);
                                const count = getTrapCount(item);

                                return (
                                    <div
                                        key={`trap-row-${index}-${label}`}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            background: "rgba(2, 6, 23, 0.45)",
                                            border: "1px solid rgba(148, 163, 184, 0.1)",
                                            borderRadius: 12,
                                            padding: 10,
                                        }}
                                    >
                                        <div style={{ color: "#f8fafc", fontWeight: 600 }}>{label}</div>
                                        <div style={pillStyle}>{count ?? 0}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}