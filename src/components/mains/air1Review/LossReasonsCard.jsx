import React from "react";

const T = { border: "#1f1f23", dim: "#71717a", text: "#e4e4e7" };

function LossReasonsCard({ lossReasons = [] }) {
    if (!lossReasons || lossReasons.length === 0) return null;
    return (
        <div style={{ background: "#0b0b0d", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>Why marks were lost</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.dim }}>
                {lossReasons.map((r, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>{r}</li>
                ))}
            </ul>
        </div>
    );
}

export default LossReasonsCard;
