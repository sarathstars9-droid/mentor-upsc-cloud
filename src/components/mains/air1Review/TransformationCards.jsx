// src/components/mains/air1Review/TransformationCards.jsx
// Phase 4: Visual Transformation Cards — Student vs AIR-1 version
// Surgically added — replaces text walls with compact, visual learning cards

import React, { useState } from "react";

// ─── Derive transformation cards from available data ──────────────────────────
function deriveTransformations(data) {
    const cards = [];
    const seen = new Set();

    // From lineCorrections (primary source)
    if (Array.isArray(data.lineCorrections)) {
        data.lineCorrections.forEach((lc, i) => {
            const userLine = lc.userLine || lc.user_line || lc.original || lc.idea || "";
            const correction = lc.correction || lc.improvedLine || lc.betterVersion || "";
            const why = lc.whyItImprovesMarks || lc.reason || lc.improvementReason || "";
            const problem = lc.problem || lc.issue || "";
            const marksImpact = lc.marksImpact || "+0.5";

            if (userLine && correction && !seen.has(userLine.toLowerCase())) {
                seen.add(userLine.toLowerCase());
                cards.push({
                    id: `tc_lc_${i}`,
                    yourLine: userLine,
                    air1Version: correction,
                    whyBetter: why || problem || "More precise, analytical phrasing",
                    impact: marksImpact,
                    category: "line",
                });
            }
        });
    }

    // From structureReview.introduction
    if (data.structureReview?.introduction?.issue && data.structureReview?.introduction?.betterIntro) {
        const intro = data.structureReview.introduction;
        if (!seen.has("intro_transform")) {
            seen.add("intro_transform");
            cards.push({
                id: "tc_intro",
                yourLine: intro.issue,
                air1Version: intro.betterIntro,
                whyBetter: "Strong introduction sets examiner's first impression",
                impact: "+0.5",
                category: "structure",
            });
        }
    }

    // From structureReview.conclusion
    if (data.structureReview?.conclusion?.issue && data.structureReview?.conclusion?.betterConclusion) {
        const concl = data.structureReview.conclusion;
        if (!seen.has("concl_transform")) {
            seen.add("concl_transform");
            cards.push({
                id: "tc_concl",
                yourLine: concl.issue,
                air1Version: concl.betterConclusion,
                whyBetter: "Decisive conclusion reinforces marks retention",
                impact: "+0.5",
                category: "structure",
            });
        }
    }

    // From missingDimensions — create "gap" cards
    if (Array.isArray(data.missingDimensions) && cards.length < 10) {
        data.missingDimensions.slice(0, 3).forEach((dim, i) => {
            const dimText = typeof dim === "string" ? dim : dim?.dimension || JSON.stringify(dim);
            if (!seen.has(dimText.toLowerCase())) {
                seen.add(dimText.toLowerCase());
                cards.push({
                    id: `tc_md_${i}`,
                    yourLine: "Not addressed in answer",
                    air1Version: dimText,
                    whyBetter: "Adding this dimension shows multidimensional thinking",
                    impact: "+1.0",
                    category: "dimension",
                });
            }
        });
    }

    return cards.slice(0, 10); // Cap at 10 cards
}

// ─── Single Transformation Card ───────────────────────────────────────────────
function TransformCard({ card, index, T, isDark }) {
    const [isHovered, setIsHovered] = useState(false);
    const categoryColors = {
        line:       { color: T.amber,  bg: "rgba(245, 158, 11, 0.1)",  label: "Line Fix" },
        structure:  { color: T.purple, bg: "rgba(139, 92, 246, 0.1)",  label: "Structure" },
        dimension:  { color: T.blue,   bg: "rgba(59, 130, 246, 0.1)",  label: "Missing Dimension" },
    };
    const cat = categoryColors[card.category] || categoryColors.line;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: T.surface,
                border: `1px solid ${isHovered ? cat.color + "60" : T.border}`,
                borderRadius: 16,
                overflow: "hidden",
                transition: "all 0.25s ease",
                transform: isHovered ? "translateY(-2px)" : "none",
                boxShadow: isHovered
                    ? `0 8px 24px ${cat.color}15`
                    : isDark ? "none" : "0 2px 8px rgba(0,0,0,0.04)",
                animation: `transformCardReveal 0.4s ease ${index * 0.08}s both`,
            }}
        >
            {/* Card Header */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 20px",
                background: cat.bg,
                borderBottom: `1px solid ${T.border}`
            }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                        fontSize: 11, fontWeight: 800, color: cat.color,
                        background: cat.color + "20", padding: "2px 8px",
                        borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em"
                    }}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: T.dim }}>#{index + 1}</span>
                </div>
                {card.impact && (
                    <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: card.impact.includes("+") ? T.green : T.red,
                        background: card.impact.includes("+")
                            ? "rgba(34, 197, 94, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                        padding: "3px 10px", borderRadius: 6
                    }}>{card.impact}</span>
                )}
            </div>

            {/* Card Body */}
            <div style={{ padding: "20px" }}>
                {/* Your Line */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{
                        fontSize: 10, fontWeight: 800, color: T.red || "#ef4444",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        marginBottom: 6, display: "flex", gap: 6, alignItems: "center"
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: T.red || "#ef4444" }} />
                        YOUR LINE
                    </div>
                    <div style={{
                        fontSize: 14, color: T.dim, fontStyle: "italic", lineHeight: 1.5,
                        padding: "10px 14px",
                        background: "rgba(239, 68, 68, 0.05)",
                        borderRadius: 10, borderLeft: `3px solid ${T.red || "#ef4444"}40`
                    }}>
                        "{card.yourLine}"
                    </div>
                </div>

                {/* Arrow */}
                <div style={{
                    display: "flex", justifyContent: "center", padding: "4px 0",
                    color: T.dim, fontSize: 16
                }}>
                    ↓
                </div>

                {/* AIR-1 Version */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{
                        fontSize: 10, fontWeight: 800, color: T.green || "#22c55e",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        marginBottom: 6, display: "flex", gap: 6, alignItems: "center"
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: T.green || "#22c55e" }} />
                        AIR-1 VERSION
                    </div>
                    <div style={{
                        fontSize: 14, color: T.textBright, fontWeight: 500, lineHeight: 1.5,
                        padding: "10px 14px",
                        background: "rgba(34, 197, 94, 0.06)",
                        borderRadius: 10, borderLeft: `3px solid ${T.green || "#22c55e"}40`
                    }}>
                        "{card.air1Version}"
                    </div>
                </div>

                {/* Why Better */}
                {card.whyBetter && (
                    <div style={{
                        display: "flex", gap: 8, alignItems: "flex-start",
                        padding: "10px 14px",
                        background: T.surfaceHigh, borderRadius: 10,
                        border: `1px solid ${T.border}`
                    }}>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 2 }}>WHY BETTER</div>
                            <div style={{ fontSize: 13, color: T.textBright, lineHeight: 1.4 }}>{card.whyBetter}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ─── Main TransformationCards component ───────────────────────────────────────
export default function TransformationCards({ data, T, isDark }) {
    const [showAll, setShowAll] = useState(false);

    if (!data) return null;

    const cards = deriveTransformations(data);

    if (cards.length === 0) {
        return (
            <div style={{ color: T.dim, padding: 24, textAlign: "center", fontSize: 14, fontStyle: "italic" }}>
                No transformation data available from this review.
            </div>
        );
    }

    const visibleCards = showAll ? cards : cards.slice(0, 5);

    return (
        <div>
            {/* Stats strip */}
            <div style={{
                display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
                padding: "12px 16px", marginBottom: 20,
                background: T.surfaceHigh, borderRadius: 12,
                border: `1px solid ${T.border}`
            }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 15 }}>🔄</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright }}>
                        {cards.length} Transformation{cards.length !== 1 ? "s" : ""}
                    </span>
                </div>
                <div style={{ height: 16, width: 1, background: T.border }} />
                <span style={{ fontSize: 12, color: T.dim }}>
                    Each card shows exactly how to upgrade one element
                </span>
            </div>

            {/* Cards Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 20,
            }}>
                {visibleCards.map((card, i) => (
                    <TransformCard key={card.id} card={card} index={i} T={T} isDark={isDark} />
                ))}
            </div>

            {/* Show More */}
            {cards.length > 5 && (
                <div style={{ textAlign: "center", marginTop: 20 }}>
                    <button
                        onClick={() => setShowAll(!showAll)}
                        style={{
                            background: "transparent",
                            border: `1px solid ${T.borderMid}`,
                            color: T.textBright, fontSize: 13, fontWeight: 700,
                            padding: "10px 24px", borderRadius: 10,
                            cursor: "pointer", transition: "all 0.2s"
                        }}
                    >
                        {showAll ? "Show Less" : `View All ${cards.length} Transformations`}
                    </button>
                </div>
            )}

            <style>{`
                @keyframes transformCardReveal {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
