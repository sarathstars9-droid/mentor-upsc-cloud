import React from "react";

const T = { border: "#1f1f23", subtle: "#52525b", text: "#e4e4e7", red: "#ef4444", amber: "#f59e0b", green: "#22c55e" };

function MistakeCard({ mistake = {} }) {
    const { userLine = "", problem = "", fix = "", tag = "", severity = "" } = mistake;
    const sevColor = severity === "High" ? T.red : severity === "Medium" ? T.amber : T.green;

    return (
        <div style={{ background: "#0b0b0d", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{tag}</div>
                <div style={{ fontSize: 12, color: sevColor, fontWeight: 800 }}>{severity}</div>
            </div>

            <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>{problem}</div>

            <div style={{ fontSize: 12, color: T.subtle, marginBottom: 8 }}>
                <div><strong>User line:</strong> {userLine}</div>
            </div>

            {fix && (
                <div style={{ fontSize: 12, color: T.text }}><strong>Fix:</strong> {fix}</div>
            )}
        </div>
    );
}

export default MistakeCard;
