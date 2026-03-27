import { normalizeArray, getRecommendationLabel } from "./prelimsDashboardUtils";

const panelStyle = {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
};

export default function RecommendationsPanel({ recommendations = [] }) {
    const items = normalizeArray(recommendations);

    return (
        <section style={panelStyle}>
            <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 20 }}>Next Best Actions</h3>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                    System-generated action path after this test
                </div>
            </div>

            {items.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>No recommendations available yet.</div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {items.map((item, index) => (
                        <div
                            key={`recommendation-${index}`}
                            style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "flex-start",
                                background: "rgba(15, 23, 42, 0.72)",
                                border: "1px solid rgba(148, 163, 184, 0.12)",
                                borderRadius: 14,
                                padding: 12,
                            }}
                        >
                            <div
                                style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 999,
                                    background: "rgba(34, 197, 94, 0.18)",
                                    border: "1px solid rgba(34, 197, 94, 0.24)",
                                    color: "#86efac",
                                    display: "grid",
                                    placeItems: "center",
                                    fontWeight: 800,
                                    flexShrink: 0,
                                }}
                            >
                                {index + 1}
                            </div>
                            <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.55 }}>
                                {getRecommendationLabel(item)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}