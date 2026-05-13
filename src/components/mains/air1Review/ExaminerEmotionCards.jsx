// src/components/mains/air1Review/ExaminerEmotionCards.jsx
// Phase 5: Compact Examiner Reaction Cards
// Shows the "human evaluator" feel with Concern, Biggest Miss, Best Insight

import React from "react";

// ─── Derive examiner reactions from review data ───────────────────────────────
function deriveReactions(data) {
    const reactions = [];

    // 🟥 Examiner Concern — from whyMarksLost or examinerImpression
    let concern = "";
    if (Array.isArray(data.whyMarksLost) && data.whyMarksLost.length > 0) {
        concern = typeof data.whyMarksLost[0] === "string"
            ? data.whyMarksLost[0]
            : JSON.stringify(data.whyMarksLost[0]);
    } else if (data.examinerImpression) {
        concern = data.examinerImpression;
    }
    if (concern) {
        reactions.push({
            type: "concern",
            icon: "🟥",
            label: "Examiner Concern",
            color: "#ef4444",
            bg: "rgba(239, 68, 68, 0.08)",
            border: "rgba(239, 68, 68, 0.2)",
            content: concern,
        });
    }

    // 🟨 Biggest Miss — from missingDimensions
    let biggestMiss = "";
    if (Array.isArray(data.missingDimensions) && data.missingDimensions.length > 0) {
        const first = data.missingDimensions[0];
        biggestMiss = typeof first === "string" ? first : first?.dimension || JSON.stringify(first);
    } else if (Array.isArray(data.factualErrors) && data.factualErrors.length > 0) {
        const first = data.factualErrors[0];
        biggestMiss = typeof first === "string" ? first : first?.error || JSON.stringify(first);
    }
    if (biggestMiss) {
        reactions.push({
            type: "miss",
            icon: "🟨",
            label: "Biggest Miss",
            color: "#f59e0b",
            bg: "rgba(245, 158, 11, 0.08)",
            border: "rgba(245, 158, 11, 0.2)",
            content: biggestMiss,
        });
    }

    // 🟩 Best Insight — from valueAdditions or strengths
    let bestInsight = "";
    if (Array.isArray(data.valueAdditions) && data.valueAdditions.length > 0) {
        bestInsight = typeof data.valueAdditions[0] === "string"
            ? data.valueAdditions[0]
            : JSON.stringify(data.valueAdditions[0]);
    } else if (Array.isArray(data.strengthSignals) && data.strengthSignals.length > 0) {
        const s = data.strengthSignals[0];
        bestInsight = s.strength || s.evidenceSnippet || JSON.stringify(s);
    }
    if (bestInsight) {
        reactions.push({
            type: "insight",
            icon: "🟩",
            label: "Best Insight",
            color: "#22c55e",
            bg: "rgba(34, 197, 94, 0.08)",
            border: "rgba(34, 197, 94, 0.2)",
            content: bestInsight,
        });
    }

    // 🟦 Demand Check — from didAnswerDemand
    if (data.didAnswerDemand && typeof data.didAnswerDemand === "string" && data.didAnswerDemand.length > 5) {
        reactions.push({
            type: "demand",
            icon: "🟦",
            label: "Demand Assessment",
            color: "#3b82f6",
            bg: "rgba(59, 130, 246, 0.08)",
            border: "rgba(59, 130, 246, 0.2)",
            content: data.didAnswerDemand,
        });
    }

    // 🟪 Level Verdict — from level
    if (data.level && typeof data.level === "string") {
        const levelFormatted = data.level
            .split("_")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        reactions.push({
            type: "level",
            icon: "🟪",
            label: "Performance Level",
            color: "#8b5cf6",
            bg: "rgba(139, 92, 246, 0.08)",
            border: "rgba(139, 92, 246, 0.2)",
            content: levelFormatted,
        });
    }

    return reactions;
}


export default function ExaminerEmotionCards({ data, T }) {
    if (!data) return null;

    const reactions = deriveReactions(data);

    if (reactions.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
                fontSize: 12, fontWeight: 800, color: T.subtle,
                textTransform: "uppercase", letterSpacing: "0.06em",
                display: "flex", gap: 8, alignItems: "center",
                marginBottom: 4
            }}>
                <span style={{ fontSize: 16 }}>👨‍🏫</span>
                Examiner Reactions
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12
            }}>
                {reactions.map((r, i) => (
                    <div key={r.type} style={{
                        background: r.bg,
                        border: `1px solid ${r.border}`,
                        borderRadius: 14,
                        padding: "16px 18px",
                        animation: `emotionCardReveal 0.35s ease ${i * 0.1}s both`,
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = `0 4px 16px ${r.color}15`;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "none";
                    }}
                    >
                        <div style={{
                            display: "flex", gap: 8, alignItems: "center", marginBottom: 8
                        }}>
                            <span style={{ fontSize: 14 }}>{r.icon}</span>
                            <span style={{
                                fontSize: 11, fontWeight: 800, color: r.color,
                                textTransform: "uppercase", letterSpacing: "0.04em"
                            }}>{r.label}</span>
                        </div>
                        <div style={{
                            fontSize: 14, color: T.textBright, lineHeight: 1.5,
                            fontWeight: 500
                        }}>
                            {r.content}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes emotionCardReveal {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
