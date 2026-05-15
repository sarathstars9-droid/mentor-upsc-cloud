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
    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: isDark ? "none" : "0 2px 6px rgba(0,0,0,0.02)",
            animation: `transformCardReveal 0.3s ease ${index * 0.05}s both`,
            display: "flex", flexDirection: "column", gap: 12
        }}>
            {/* Header: Category & Impact */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Transformation #{index + 1}
                </span>
                {card.impact && (
                    <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: card.impact.includes("+") ? T.green : T.red,
                        background: card.impact.includes("+") ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        padding: "2px 8px", borderRadius: 6
                    }}>
                        {card.impact} marks impact
                    </span>
                )}
            </div>

            {/* Your Version */}
            <div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>❌</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: T.red || "#ef4444", textTransform: "uppercase" }}>Your version</span>
                </div>
                <div style={{ fontSize: 14, color: T.textBright, paddingLeft: 20 }}>
                    "{card.yourLine}"
                </div>
            </div>

            {/* AIR-1 Improvement */}
            <div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>✅</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: T.green || "#22c55e", textTransform: "uppercase" }}>AIR-1 improvement</span>
                </div>
                <div style={{ fontSize: 14, color: T.textBright, paddingLeft: 20, fontWeight: 500 }}>
                    "{card.air1Version}"
                </div>
            </div>

            {/* Why Better */}
            {card.whyBetter && (
                <div style={{
                    display: "flex", gap: 8, alignItems: "flex-start",
                    marginTop: 4, padding: "10px 14px",
                    background: T.surfaceHigh, borderRadius: 8,
                    border: `1px solid ${T.border}`
                }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 2 }}>Why better</div>
                        <div style={{ fontSize: 13, color: T.textBright, lineHeight: 1.4 }}>{card.whyBetter}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Insight Banner ───────────────────────────────────────────────────────────
function InsightBanner({ index, T }) {
    const banners = [
        { icon: "🧠", title: "AIR-1 Insight", text: "Balanced historical nuance prevents factual penalties.", color: T.purple },
        { icon: "⚡", title: "Examiner Trigger", text: "Absolute statements reduce credibility.", color: T.amber },
        { icon: "📈", title: "Score Opportunity", text: "Fixing chronology alone could improve +1.5 marks.", color: T.blue }
    ];
    const banner = banners[(Math.floor(index / 3)) % banners.length];
    return (
        <div style={{
            gridColumn: "1 / -1",
            display: "flex", gap: 12, alignItems: "center",
            padding: "12px 16px", background: `linear-gradient(to right, ${banner.color}15, transparent)`,
            borderLeft: `3px solid ${banner.color}`, borderRadius: 8, margin: "4px 0"
        }}>
            <span style={{ fontSize: 18 }}>{banner.icon}</span>
            <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: banner.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{banner.title}</div>
                <div style={{ fontSize: 13, color: T.textBright, fontWeight: 500, marginTop: 2 }}>"{banner.text}"</div>
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
                gridTemplateColumns: "1fr", // Changed from auto-fill to 1fr for single-column linear layout
                gap: 12,
            }}>
                {visibleCards.map((card, i) => (
                    <React.Fragment key={card.id}>
                        <TransformCard card={card} index={i} T={T} isDark={isDark} />
                        {(i + 1) % 3 === 0 && i !== visibleCards.length - 1 && (
                            <InsightBanner index={i} T={T} />
                        )}
                    </React.Fragment>
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
                /* FIX 5: Gentle pulse on the transformation arrow */
                @keyframes arrowPulse {
                    0%, 100% { transform: translateY(0); opacity: 0.75; }
                    50% { transform: translateY(3px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
