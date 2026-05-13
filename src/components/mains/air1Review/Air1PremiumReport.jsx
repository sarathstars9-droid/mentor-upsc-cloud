import React, { useState } from "react";

const T = {
    bg:          "transparent",
    surface:     "rgba(255, 255, 255, 0.015)", // Very soft/light card background
    surfaceHigh: "rgba(255, 255, 255, 0.04)",
    border:      "rgba(255, 255, 255, 0.08)",
    borderMid:   "rgba(255, 255, 255, 0.12)",
    muted:       "#3f3f46",
    subtle:      "#71717a",
    dim:         "#a1a1aa",
    text:        "#e4e4e7",
    textBright:  "#f4f4f5",
    amber:       "#f59e0b",
    blue:        "#3b82f6",
    green:       "#22c55e",
    red:         "#ef4444",
    purple:      "#8b5cf6",
    font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

export default function Air1PremiumReport({ data, rawReviewText, onFinalize }) {
    const [expandedCorrections, setExpandedCorrections] = useState(false);
    const [showMoreDetails, setShowMoreDetails] = useState(false);

    if (!data) return null;

    const {
        score,
        potentialScore,
        level,
        examinerImpression,
        didAnswerDemand,
        whyMarksLost,
        lineCorrections,
        improvedAnswer,
        modelAnswer,
        nextAttemptStrategy,
        revisionTasks,
        mistakeBookEntries,
        missingDimensions,
        valueAdditions,
        diagramSuggestions
    } = data;

    const getScoreColor = (score, potential) => {
        if (!score || !potential) return T.amber;
        const ratio = parseFloat(score) / parseFloat(potential);
        if (ratio >= 0.8) return T.green;
        if (ratio >= 0.6) return T.blue;
        if (ratio >= 0.4) return T.amber;
        return T.red;
    };

    const hasData = (arr) => Array.isArray(arr) && arr.length > 0;

    // Fallback extraction for missing Improved / Model answers
    const extractFallback = (text, headings) => {
        if (!text) return null;
        for (const heading of headings) {
            const idx = text.toLowerCase().indexOf(heading.toLowerCase());
            if (idx !== -1) {
                const start = idx + heading.length;
                let end = text.indexOf("\n#", start);
                if (end === -1) end = text.indexOf("\n\n*", start);
                if (end === -1) end = text.length;
                let extracted = text.substring(start, end).trim();
                extracted = extracted.replace(/^[:\*\-]+/, "").trim();
                if (extracted.length > 30) return extracted;
            }
        }
        return null;
    };

    const finalImprovedAnswer = improvedAnswer || extractFallback(rawReviewText, ["Improved User Answer", "Improved Answer", "Rewritten Answer"]);
    const finalModelAnswer = modelAnswer || extractFallback(rawReviewText, ["AIR-1 Model Answer", "Model Answer", "Ideal Answer"]);

    const normalizedCorrections = (lineCorrections || []).map(c => ({
        userLine: c.userLine || c.user_line || c.original || c.idea || "",
        problem: c.problem || c.issue || c.weakness || "",
        correction: c.correction || c.improvedLine || c.betterVersion || "",
        whyItImprovesMarks: c.whyItImprovesMarks || c.reason || c.improvementReason || ""
    })).filter(c => c.userLine || c.correction);

    const Card = ({ children, style }) => (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px", ...style }}>
            {children}
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: T.font, marginTop: 16 }}>

            {/* Card 1: Examiner Verdict */}
            <Card>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Examiner Verdict</div>
                
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                    <div style={{ flex: "1 1 120px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", marginBottom: 4 }}>Score</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: getScoreColor(score, potentialScore) }}>{score ?? "—"}</div>
                    </div>
                    <div style={{ flex: "1 1 120px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", marginBottom: 4 }}>Potential</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: T.textBright }}>{potentialScore ?? "—"}</div>
                    </div>
                    <div style={{ flex: "1 1 140px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", marginBottom: 4 }}>Level</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.purple, marginTop: 6 }}>{level || "—"}</div>
                    </div>
                    <div style={{ flex: "1 1 140px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", marginBottom: 4 }}>Demand Answered?</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T.textBright, marginTop: 8 }}>{didAnswerDemand || "—"}</div>
                    </div>
                </div>

                {examinerImpression && (
                    <div style={{ borderLeft: `3px solid ${T.purple}`, paddingLeft: 16, fontSize: 14, color: T.textBright, fontStyle: "italic", lineHeight: 1.6 }}>
                        "{examinerImpression}"
                    </div>
                )}
            </Card>

            {/* Card 2: Marks Lost */}
            <Card>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.red, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Why Marks Were Lost</div>
                {hasData(whyMarksLost) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {whyMarksLost.slice(0, 5).map((reason, i) => (
                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, color: T.textBright, lineHeight: 1.5 }}>
                                <span style={{ color: T.red, fontWeight: 800, marginTop: 1 }}>✗</span> {reason}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: 14, color: T.dim }}>No specific mark-loss reasons were cited.</div>
                )}
            </Card>

            {/* Card 3: Line-by-Line Improvement */}
            <Card>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.blue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Line-by-Line Improvement</div>
                {hasData(normalizedCorrections) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {(expandedCorrections ? normalizedCorrections : normalizedCorrections.slice(0, 3)).map((c, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, borderBottom: i !== (expandedCorrections ? normalizedCorrections.length - 1 : Math.min(2, normalizedCorrections.length - 1)) ? `1px solid ${T.border}` : "none", paddingBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", marginBottom: 4 }}>Your idea</div>
                                    <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic", lineHeight: 1.5 }}>"{c.userLine}"</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <div style={{ color: T.red, marginTop: 2 }}>↳</div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: T.red, textTransform: "uppercase", marginBottom: 2 }}>Issue</div>
                                        <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.5 }}>{c.problem}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <div style={{ color: T.green, marginTop: 2 }}>↳</div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", marginBottom: 2 }}>Better version</div>
                                        <div style={{ fontSize: 14, color: T.textBright, fontWeight: 500, lineHeight: 1.5 }}>{c.correction}</div>
                                        {c.whyItImprovesMarks && <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>{c.whyItImprovesMarks}</div>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {normalizedCorrections.length > 3 && (
                            <button 
                                onClick={() => setExpandedCorrections(!expandedCorrections)}
                                style={{ marginTop: 4, width: "fit-content", padding: "8px 16px", background: "transparent", border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.textBright, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                            >
                                {expandedCorrections ? "Show less" : `View all ${normalizedCorrections.length} corrections`}
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ fontSize: 14, color: T.dim }}>Line-by-line correction was not found. Use the model answer below for comparison.</div>
                )}
            </Card>

            {/* Card 4: Improved Version of Your Answer */}
            <Card>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright }}>Improved Version of Your Answer</div>
                <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>Your answer upgraded while keeping your base structure.</div>
                {finalImprovedAnswer ? (
                    <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {finalImprovedAnswer}
                    </div>
                ) : (
                    <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic" }}>Improved answer was not found in this imported review.</div>
                )}
            </Card>

            {/* Card 5: AIR-1 Model Answer */}
            <Card style={{ border: `1px solid ${T.purple}40`, background: `linear-gradient(to bottom right, rgba(139, 92, 246, 0.05), transparent)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.purple }}>AIR-1 Model Answer</div>
                        <div style={{ fontSize: 12, color: T.dim }}>Compare your answer with this standard.</div>
                    </div>
                    {finalModelAnswer && (
                        <button 
                            onClick={() => navigator.clipboard.writeText(finalModelAnswer)}
                            style={{ background: "transparent", border: `1px solid ${T.purple}40`, color: T.purple, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}
                        >
                            Copy Model Answer
                        </button>
                    )}
                </div>
                {finalModelAnswer ? (
                    <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {finalModelAnswer}
                    </div>
                ) : (
                    <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic" }}>Model answer was not found in this imported review. Generate AIR-1 Review again using the latest prompt.</div>
                )}
            </Card>

            {/* Card 6: Next Attempt Plan */}
            <Card>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Next Attempt Plan</div>
                
                {nextAttemptStrategy && (
                    <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6, marginBottom: 16 }}>
                        {nextAttemptStrategy}
                    </div>
                )}

                {(hasData(revisionTasks) || hasData(mistakeBookEntries)) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {revisionTasks?.map((task, i) => (
                            <div key={`rt-${i}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 13, color: T.textBright, lineHeight: 1.5 }}>
                                <div style={{ color: T.purple, fontWeight: 800, marginTop: 1 }}>•</div>
                                <div>{typeof task === 'string' ? task : task.task || JSON.stringify(task)}</div>
                            </div>
                        ))}
                        {mistakeBookEntries?.map((entry, i) => (
                            <div key={`mb-${i}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 13, color: T.textBright, lineHeight: 1.5 }}>
                                <div style={{ color: T.amber, fontWeight: 800, marginTop: 1 }}>•</div>
                                <div>Mistake Book: {typeof entry === 'string' ? entry : JSON.stringify(entry)}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !nextAttemptStrategy && <div style={{ fontSize: 14, color: T.dim }}>No specific tasks provided.</div>
                )}
            </Card>

            {/* Card 7: More Review Details */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div 
                    onClick={() => setShowMoreDetails(!showMoreDetails)}
                    style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: showMoreDetails ? T.surfaceHigh : "transparent" }}
                >
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright }}>More Review Details</div>
                    <div style={{ fontSize: 12, color: T.dim, fontWeight: 600 }}>{showMoreDetails ? "Hide" : "Expand"}</div>
                </div>
                
                {showMoreDetails && (
                    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24, borderTop: `1px solid ${T.border}` }}>
                        {hasData(missingDimensions) && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Missing Dimensions</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: T.textBright, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {missingDimensions.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            </div>
                        )}
                        {hasData(valueAdditions) && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Value Additions</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: T.textBright, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {valueAdditions.map((v, i) => <li key={i}>{v}</li>)}
                                </ul>
                            </div>
                        )}
                        {hasData(diagramSuggestions) && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Diagram Suggestions</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: T.textBright, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {diagramSuggestions.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            </div>
                        )}
                        {rawReviewText && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Full Imported Review</div>
                                <pre style={{ padding: "16px", borderRadius: 8, fontSize: 12, color: T.dim, whiteSpace: "pre-wrap", overflowX: "auto", border: `1px solid ${T.borderMid}`, margin: 0 }}>
                                    {rawReviewText}
                                </pre>
                            </div>
                        )}
                        {!hasData(missingDimensions) && !hasData(valueAdditions) && !hasData(diagramSuggestions) && !rawReviewText && (
                            <div style={{ fontSize: 13, color: T.dim }}>No extra details available.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Strip: Finalize Attempt */}
            {onFinalize && (
                <div style={{ background: `linear-gradient(to right, ${T.surfaceHigh}, ${T.surface})`, border: `1px solid ${T.borderMid}`, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 14, color: T.textBright, fontWeight: 600 }}>Review complete</div>
                    <button 
                        onClick={onFinalize}
                        style={{ background: T.textBright, color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                        Finalize Attempt
                    </button>
                </div>
            )}
        </div>
    );
}
