import React from "react";

const T = { border: "#1f1f23", text: "#e4e4e7", subtle: "#9ca3af" };

function FixNowCard({ fixNow = {}, onStartFix }) {
    const { mainTask = "", replacementLines = [], nextPracticeTask = "" } = fixNow;
    return (
        <div style={{ background: "#0b0b0d", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: T.text, marginBottom: 8 }}>Fix Now</div>
            <div style={{ fontSize: 13, color: T.text, marginBottom: 10 }}>{mainTask}</div>

            {replacementLines && replacementLines.length > 0 && (
                <div style={{ fontSize: 12, color: T.subtle, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Replacement lines</div>
                    <ol style={{ margin: 0, paddingLeft: 16 }}>
                        {replacementLines.map((r, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>{r}</li>
                        ))}
                    </ol>
                </div>
            )}

            {nextPracticeTask && (
                <div style={{ fontSize: 12, color: T.subtle }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Next practice task</div>
                    <div>{nextPracticeTask}</div>
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button
                    onClick={() => onStartFix && onStartFix(fixNow)}
                    style={{
                        background: "#8b5cf6", color: "#09090b", border: "none",
                        borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 800,
                    }}
                >
                    Start Fixing
                </button>
            </div>
        </div>
    );
}

export default FixNowCard;
