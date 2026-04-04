// src/components/mains/MainsReviewResultCard.jsx
// Review Result Summary Card – shows processed review output

import React from "react";

const T = {
    bg:          "#09090b",
    surface:     "#111113",
    surfaceHigh: "#18181b",
    border:      "#1f1f23",
    borderMid:   "#27272a",
    muted:       "#3f3f46",
    subtle:      "#52525b",
    dim:         "#71717a",
    text:        "#e4e4e7",
    textBright:  "#f4f4f5",
    amber:       "#f59e0b",
    amberDim:    "#d97706",
    blue:        "#3b82f6",
    green:       "#22c55e",
    red:         "#ef4444",
    purple:      "#8b5cf6",
    font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
});

const outlineBtn = (accent, size = "md") => ({
    background: "transparent", color: accent,
    border: `1px solid ${accent}44`, borderRadius: 8,
    fontWeight: 600,
    fontSize: size === "sm" ? 11 : 13,
    padding: size === "sm" ? "5px 12px" : "10px 20px",
    cursor: "pointer", fontFamily: T.font,
    letterSpacing: "0.03em", whiteSpace: "nowrap",
});

function getQualityColor(label) {
    switch (label) {
        case "elite_review": return T.green;
        case "strong_review": return T.green;
        case "usable_review": return T.amber;
        case "weak_review": return T.red;
        default: return T.subtle;
    }
}

function getQualityLabel(label) {
    switch (label) {
        case "elite_review": return "Elite Review";
        case "strong_review": return "Strong Review";
        case "usable_review": return "Usable Review";
        case "weak_review": return "Weak Review";
        default: return "Unknown";
    }
}

function MainsReviewResultCard({
    processedReviewResult,
    onOpenMistakes,
    onOpenRevision,
    onNextQuestion,
}) {
    if (!processedReviewResult) {
        return null; // Don't show until review is processed
    }

    const {
        qualityLabel,
        qualityScore,
        marksAwarded,
        marksTotal,
        mistakeFlags,
        revisionTaskCount,
        mistakeBookSynced,
        revisionSynced,
    } = processedReviewResult;

    const qualityColor = getQualityColor(qualityLabel);

    return (
        <div
            style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 14, overflow: "hidden",
            }}
        >
            <div
                style={{
                    height: 2,
                    background: `linear-gradient(90deg, ${qualityColor}, ${qualityColor}44, ${T.border})`,
                }}
            />
            <div style={{ padding: "20px 24px" }}>
                <div style={{ ...label11(T.subtle), marginBottom: 16 }}>Review Quality Assessment</div>

                {/* Top-level metrics grid */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 12,
                    marginBottom: 24,
                }}>
                    {/* Quality label */}
                    <div style={{
                        background: `${qualityColor}11`, border: `1px solid ${qualityColor}33`,
                        borderRadius: 10, padding: "12px 14px",
                    }}>
                        <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 6 }}>Quality</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: qualityColor }}>
                            {getQualityLabel(qualityLabel)}
                        </div>
                        <div style={{ fontSize: 11, color: qualityColor, marginTop: 4, fontWeight: 600 }}>
                            {Math.round(qualityScore * 100)}% complete
                        </div>
                    </div>

                    {/* Marks awarded */}
                    <div style={{
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "12px 14px",
                    }}>
                        <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 6 }}>Marks Awarded</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>
                            {marksAwarded}
                        </div>
                        <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                            / {marksTotal}
                        </div>
                    </div>

                    {/* Revision tasks */}
                    <div style={{
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "12px 14px",
                    }}>
                        <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 6 }}>Revision Tasks</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.blue }}>
                            {revisionTaskCount}
                        </div>
                        <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                            to focus on
                        </div>
                    </div>

                    {/* Sync status */}
                    <div style={{
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "12px 14px",
                    }}>
                        <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 6 }}>Synced</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span style={{ color: mistakeBookSynced ? T.green : T.dim, fontSize: 12, fontWeight: 700 }}>
                                {mistakeBookSynced ? "✓" : "○"} Mistake Book
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ color: revisionSynced ? T.green : T.dim, fontSize: 12, fontWeight: 700 }}>
                                {revisionSynced ? "✓" : "○"} Revision
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mistake flags */}
                {mistakeFlags && mistakeFlags.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ ...label11(T.subtle), marginBottom: 10 }}>Identified Mistakes</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {mistakeFlags.slice(0, 6).map((flag, idx) => (
                                <span
                                    key={idx}
                                    style={{
                                        fontSize: 11, fontWeight: 700,
                                        padding: "4px 12px", borderRadius: 6,
                                        background: `${T.red}15`, color: T.red,
                                        border: `1px solid ${T.red}33`,
                                        letterSpacing: "0.03em", textTransform: "capitalize",
                                    }}
                                >
                                    {flag.replace(/_/g, " ")}
                                </span>
                            ))}
                            {mistakeFlags.length > 6 && (
                                <span
                                    style={{
                                        fontSize: 11, fontWeight: 700,
                                        padding: "4px 12px", borderRadius: 6,
                                        background: T.muted, color: T.dim,
                                    }}
                                >
                                    +{mistakeFlags.length - 6} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                        onClick={onOpenMistakes}
                        style={outlineBtn(T.purple)}
                    >
                        📚 Open Mains Mistake Book
                    </button>
                    <button
                        onClick={onOpenRevision}
                        style={outlineBtn(T.blue)}
                    >
                        🔄 Open Revision Tasks
                    </button>
                    <button
                        onClick={onNextQuestion}
                        style={{
                            ...outlineBtn(T.green),
                            marginLeft: "auto",
                        }}
                    >
                        → Next Question
                    </button>
                </div>

                {/* Summary message */}
                <div style={{
                    marginTop: 16, padding: "12px 14px",
                    background: `${qualityColor}11`, border: `1px solid ${qualityColor}33`,
                    borderRadius: 8, fontSize: 12, color: qualityColor,
                    lineHeight: 1.6,
                }}>
                    <span style={{ fontWeight: 700 }}>Review processed successfully.</span>
                    {" "}Your answer has been analyzed, mistakes identified, and revision tasks created based on the review quality level.
                </div>
            </div>
        </div>
    );
}

export default MainsReviewResultCard;
