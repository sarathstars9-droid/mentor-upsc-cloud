import React from "react";

const T = {
    bg: "#09090b",
    surface: "#111113",
    border: "#1f1f23",
    subtle: "#52525b",
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#ef4444",
    purple: "#8b5cf6",
    text: "#e4e4e7",
};

function colorForStatus(status) {
    if (!status) return T.subtle;
    const s = status.toLowerCase();
    if (s.includes("dangerous")) return T.red;
    if (s.includes("below")) return T.amber;
    if (s.includes("average")) return T.amber;
    if (s.includes("good")) return T.green;
    if (s.includes("ranker")) return T.purple;
    return T.subtle;
}

function ScoreHeader({ score = {} }) {
    const { awarded = 0, total = 0, status = "", oneLineVerdict = "" } = score;
    const accent = colorForStatus(status);

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#0b1220", border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{awarded} / {total}</div>
                    <div style={{ fontSize: 12, color: T.subtle, marginTop: 4 }}>Score</div>
                </div>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>{status}</div>
                    <div style={{ fontSize: 13, color: T.text, marginTop: 6 }}>{oneLineVerdict}</div>
                </div>
            </div>
            <div style={{ fontSize: 12, color: T.subtle }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Quick Actions</div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ padding: "6px 10px", borderRadius: 8, background: accent, color: "#09090b", border: "none", fontWeight: 800 }}>Use Advice</button>
                    <button style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", color: T.subtle, border: `1px solid ${T.border}` }}>Save Snapshot</button>
                </div>
            </div>
        </div>
    );
}

export default ScoreHeader;
