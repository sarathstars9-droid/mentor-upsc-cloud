import React, { useState, useEffect } from "react";
import ExaminerMarkupOverlay from "./ExaminerMarkupOverlay";
import TransformationCards from "./TransformationCards";
import ExaminerEmotionCards from "./ExaminerEmotionCards";

export default function Air1ReviewMode({ data, rawReviewText, uploadedPages, finalAnswerText, onFinalize, onExit, appTheme }) {
    const [theme, setTheme] = useState(appTheme || "light");
    const [activeTab, setActiveTab] = useState("verdict");
    const [showIntelligence, setShowIntelligence] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState(null);

    if (!data) return null;

    const isDark = theme === "dark";
    
    const T = isDark ? {
        bg:          "#0f172a",
        surface:     "rgba(255, 255, 255, 0.03)",
        surfaceHigh: "rgba(255, 255, 255, 0.08)",
        border:      "rgba(255, 255, 255, 0.1)",
        borderMid:   "rgba(255, 255, 255, 0.2)",
        subtle:      "#94a3b8",
        dim:         "#cbd5e1",
        text:        "#f8fafc",
        textBright:  "#ffffff",
        amber:       "#fbbf24",
        amberBg:     "rgba(251, 191, 36, 0.1)",
        blue:        "#60a5fa",
        blueBg:      "rgba(96, 165, 250, 0.1)",
        green:       "#34d399",
        greenBg:     "rgba(52, 211, 153, 0.1)",
        red:         "#f87171",
        redBg:       "rgba(248, 113, 113, 0.1)",
        purple:      "#a78bfa",
        purpleBg:    "rgba(167, 139, 250, 0.1)",
        font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    } : {
        bg:          "#f8fafc",
        surface:     "#ffffff",
        surfaceHigh: "#f1f5f9",
        border:      "#e2e8f0",
        borderMid:   "#cbd5e1",
        subtle:      "#64748b",
        dim:         "#334155",
        text:        "#1e293b",
        textBright:  "#0f172a",
        amber:       "#d97706",
        amberBg:     "#fef3c7",
        blue:        "#2563eb",
        blueBg:      "#eff6ff",
        green:       "#059669",
        greenBg:     "#ecfdf5",
        red:         "#dc2626",
        redBg:       "#fee2e2",
        purple:      "#7c3aed",
        purpleBg:    "#f3e8ff",
        font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    };

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
        diagramSuggestions,
        structureReview,
        subheadingSuggestions,
        question
    } = data;

    const getScoreColor = (s, p) => {
        if (!s || !p) return T.amber;
        const ratio = parseFloat(s) / parseFloat(p);
        if (ratio >= 0.8) return T.green;
        if (ratio >= 0.6) return T.blue;
        if (ratio >= 0.4) return T.amber;
        return T.red;
    };

    const hasData = (arr) => Array.isArray(arr) && arr.length > 0;

    const formatLevel = (lvl) => {
        if (!lvl) return "—";
        return lvl
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
            .replace("Average Structure Below Average Factual", "Average — Structure okay, factual depth weak")
            .replace("Good Not Ranker Level", "Good, but not ranker level");
    };

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
        whyItImprovesMarks: c.whyItImprovesMarks || c.reason || c.improvementReason || "",
        marksImpact: c.marksImpact || "+0.5"
    })).filter(c => c.userLine || c.correction);

    const SectionTitle = ({ children, subtitle }) => (
        <div style={{ marginBottom: 24, paddingTop: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.textBright, letterSpacing: "-0.01em" }}>{children}</div>
            {subtitle && <div style={{ fontSize: 14, color: T.subtle, marginTop: 4 }}>{subtitle}</div>}
        </div>
    );

    const Card = ({ children, style }) => (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)", ...style }}>
            {children}
        </div>
    );

    // Legacy renderExaminerMarkup kept as fallback — new overlay component used instead

    // Transformation Row Component
    const TransformRow = ({ type, student, improved, reason }) => {
        if (!student && !improved) return null;
        return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, borderBottom: `1px solid ${T.border}`, paddingBottom: 24, marginBottom: 24 }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: T.amber }}></span> Your {type}
                    </div>
                    <div style={{ fontSize: 15, color: T.dim, fontStyle: "italic", background: T.amberBg, padding: 16, borderRadius: 12, border: `1px solid ${T.amber}40` }}>
                        {student || "Missing or vague"}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.green, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: T.green }}></span> AIR-1 {type}
                    </div>
                    <div style={{ fontSize: 15, color: T.textBright, background: T.greenBg, padding: 16, borderRadius: 12, border: `1px solid ${T.green}40` }}>
                        {improved || "Enhanced version"}
                    </div>
                    {reason && (
                        <div style={{ fontSize: 13, color: T.green, marginTop: 12, fontWeight: 600, display: "flex", gap: 6 }}>
                            <span>↳</span> {reason}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ background: T.bg, color: T.text, minHeight: "100vh", padding: "0 0 100px 0", fontFamily: T.font }}>
            
            {/* Header */}
            <div style={{ position: "sticky", top: 0, background: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(248, 250, 252, 0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.border}`, zIndex: 110, padding: "16px 24px" }}>
                <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button onClick={onExit} style={{ background: "transparent", border: `1px solid ${T.borderMid}`, color: T.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                        ← Workspace
                    </button>
                    
                    <div style={{ textAlign: "center", flex: 1, padding: "0 16px", overflow: "hidden" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>AIR-1 Review Report</div>
                        {question && <div style={{ fontSize: 12, color: T.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{typeof question === 'string' ? question : "Mains Answer"}</div>}
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <button 
                            onClick={() => setTheme(isDark ? "light" : "dark")} 
                            style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.text, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                        >
                            {isDark ? "☀️ Light" : "🌙 Dark"}
                        </button>
                        <button onClick={onFinalize} style={{ background: T.purple, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, boxShadow: "0 2px 4px rgba(124, 58, 237, 0.2)" }}>
                            Finalize Attempt
                        </button>
                    </div>
                </div>
                
                {/* Tabs */}
                <div style={{ maxWidth: 1000, margin: "20px auto 0", display: "flex", gap: 32, borderBottom: `1px solid ${T.borderMid}`, overflowX: "auto", paddingBottom: 0 }}>
                    {[
                        { id: "verdict", label: "1. Examiner Verdict" },
                        { id: "corrections", label: "2. Line Corrections" },
                        { id: "transformation", label: "3. Transformation" },
                        { id: "revision", label: "4. Revision Intelligence" }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ 
                                background: "transparent", border: "none", padding: "0 0 12px 0", cursor: "pointer", 
                                fontSize: 14, fontWeight: activeTab === tab.id ? 800 : 600, 
                                color: activeTab === tab.id ? T.purple : T.subtle,
                                borderBottom: activeTab === tab.id ? `3px solid ${T.purple}` : "3px solid transparent",
                                whiteSpace: "nowrap", transition: "all 0.2s"
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
                
                {/* TAB 1: EXAMINER VERDICT */}
                {activeTab === "verdict" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.3s ease" }}>
                        <Card style={{ padding: 0, overflow: "hidden", border: `2px solid ${getScoreColor(score, potentialScore)}40` }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", borderBottom: `1px solid ${T.border}` }}>
                                <div style={{ padding: "32px", borderRight: `1px solid ${T.border}`, textAlign: "center", background: isDark ? "rgba(255,255,255,0.02)" : "#fafafa" }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Total Score</div>
                                    <div style={{ fontSize: 48, fontWeight: 900, color: getScoreColor(score, potentialScore) }}>{score ?? "—"}</div>
                                </div>
                                <div style={{ padding: "32px", borderRight: `1px solid ${T.border}`, textAlign: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Potential</div>
                                    <div style={{ fontSize: 32, fontWeight: 800, color: T.blue, marginTop: 12 }}>{potentialScore ?? "—"}</div>
                                </div>
                                <div style={{ padding: "32px", textAlign: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Level</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: T.textBright, marginTop: 16 }}>{formatLevel(level)}</div>
                                </div>
                            </div>
                            {examinerImpression && (
                                <div style={{ padding: "32px", background: T.purpleBg }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>30-Second Examiner Impression</div>
                                    <div style={{ fontSize: 20, color: T.textBright, fontWeight: 500, lineHeight: 1.5 }}>
                                        "{examinerImpression}"
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Visual Knowledge Map */}
                        {(hasData(missingDimensions) || hasData(valueAdditions)) && (
                            <Card>
                                <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright, marginBottom: 24 }}>Knowledge Map Coverage</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: T.green, textTransform: "uppercase", marginBottom: 16, display: "flex", gap: 8 }}><span style={{background: T.green, color: "#fff", padding: "2px 6px", borderRadius: 4}}>✓</span> Covered Points</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {valueAdditions?.slice(0, 5).map((v, i) => (
                                                <div key={i} style={{ fontSize: 14, color: T.textBright, display: "flex", gap: 8 }}><span style={{color: T.green}}>✅</span> {v}</div>
                                            )) || <div style={{ color: T.dim, fontSize: 14 }}>No specific points tracked.</div>}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 16, display: "flex", gap: 8 }}><span style={{background: T.red, color: "#fff", padding: "2px 6px", borderRadius: 4}}>✗</span> Missed Dimensions</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {missingDimensions?.map((d, i) => (
                                                <div key={i} style={{ fontSize: 14, color: T.textBright, display: "flex", gap: 8 }}><span style={{color: T.red}}>❌</span> {d}</div>
                                            )) || <div style={{ color: T.dim, fontSize: 14 }}>No missed dimensions detected.</div>}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )}

                        <Card>
                            <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright, marginBottom: 24 }}>Top Reasons Marks Were Lost</div>
                            {hasData(whyMarksLost) ? (
                                <div style={{ display: "grid", gap: 16 }}>
                                    {whyMarksLost.map((reason, i) => (
                                        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", background: T.surfaceHigh, padding: 16, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                            <div style={{ background: T.redBg, color: T.red, width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>✗</div>
                                            <div style={{ fontSize: 15, color: T.textBright, fontWeight: 500 }}>{reason}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 15, color: T.dim }}>No specific mark-loss reasons were cited.</div>
                            )}
                        </Card>

                        {/* Examiner Emotion Cards */}
                        <ExaminerEmotionCards data={data} T={T} />
                    </div>
                )}

                {/* TAB 2: LINE CORRECTIONS — Examiner Markup Overlay */}
                {activeTab === "corrections" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.3s ease" }}>
                        <div style={{ fontSize: 16, color: T.subtle, lineHeight: 1.6 }}>
                            Your answer has been marked like a real UPSC evaluator's copy check. Click any highlighted phrase to see the examiner's note.
                        </div>
                        
                        {/* Real Examiner Markup Overlay */}
                        <div>
                            <div style={{ 
                                fontSize: 13, fontWeight: 800, color: T.subtle, 
                                textTransform: "uppercase", marginBottom: 12,
                                display: "flex", gap: 8, alignItems: "center"
                            }}>
                                <span style={{ fontSize: 16 }}>✍️</span>
                                Examiner Copy Check
                            </div>
                            <ExaminerMarkupOverlay 
                                answerText={finalAnswerText} 
                                data={data} 
                                T={T} 
                            />
                        </div>

                        {/* Detailed Correction Cards (kept for reference) */}
                        {hasData(normalizedCorrections) && (
                            <div>
                                <div style={{ 
                                    fontSize: 13, fontWeight: 800, color: T.subtle, 
                                    textTransform: "uppercase", marginBottom: 16,
                                    display: "flex", gap: 8, alignItems: "center"
                                }}>
                                    <span style={{ fontSize: 16 }}>📋</span>
                                    Detailed Correction Reference
                                </div>
                                <div style={{ display: "grid", gap: 16 }}>
                                    {normalizedCorrections.map((c, i) => (
                                        <div key={i} style={{ 
                                            background: T.surface, 
                                            border: `1px solid ${T.borderMid}`, 
                                            borderRadius: 14, overflow: "hidden", 
                                            boxShadow: isDark ? "none" : "0 2px 6px rgba(0,0,0,0.04)",
                                            animation: `fadeIn 0.3s ease ${i * 0.05}s both`
                                        }}>
                                            <div style={{ 
                                                display: "flex", justifyContent: "space-between", 
                                                alignItems: "center", padding: "12px 20px", 
                                                background: T.surfaceHigh, 
                                                borderBottom: `1px solid ${T.border}` 
                                            }}>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    <span style={{ 
                                                        background: T.redBg, color: T.red, 
                                                        padding: "3px 8px", borderRadius: 5, 
                                                        fontSize: 11, fontWeight: 800, textTransform: "uppercase" 
                                                    }}>{c.problem || "Weakness"}</span>
                                                </div>
                                                {c.marksImpact && (
                                                    <span style={{ 
                                                        background: T.greenBg, color: T.green, 
                                                        padding: "3px 8px", borderRadius: 5, 
                                                        fontSize: 12, fontWeight: 800 
                                                    }}>{c.marksImpact} Marks</span>
                                                )}
                                            </div>
                                            <div style={{ 
                                                display: "grid", 
                                                gridTemplateColumns: "1fr 1fr", 
                                                gap: 16, padding: "16px 20px" 
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.04em" }}>Your Line</div>
                                                    <div style={{ 
                                                        fontSize: 14, color: T.textBright, fontStyle: "italic",
                                                        background: T.redBg, padding: "10px 14px", 
                                                        borderRadius: 8, border: `1px solid ${T.red}30`,
                                                        lineHeight: 1.5
                                                    }}>"{c.userLine}"</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 800, color: T.green, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.04em" }}>AIR-1 Rewrite</div>
                                                    <div style={{ 
                                                        fontSize: 14, color: T.textBright, fontWeight: 500,
                                                        background: T.greenBg, padding: "10px 14px", 
                                                        borderRadius: 8, border: `1px solid ${T.green}30`,
                                                        lineHeight: 1.5
                                                    }}>{c.correction}</div>
                                                    {c.whyItImprovesMarks && (
                                                        <div style={{ 
                                                            fontSize: 12, color: T.green, marginTop: 8, 
                                                            fontWeight: 600, display: "flex", gap: 6 
                                                        }}>
                                                            <span>↳</span> {c.whyItImprovesMarks}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: TRANSFORMATION */}
                {activeTab === "transformation" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.3s ease" }}>
                        <div style={{ fontSize: 16, color: T.subtle, lineHeight: 1.6 }}>
                            Each card shows exactly how to upgrade one element of your answer to AIR-1 standard.
                        </div>

                        {/* Visual Transformation Cards */}
                        <TransformationCards data={data} T={T} isDark={isDark} />

                        {/* Model Answer (collapsed by default) */}
                        <Card>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: finalModelAnswer ? 16 : 0 }}>
                                <div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>Complete Model Answer</div>
                                    <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>Full AIR-1 standard reference answer</div>
                                </div>
                                {finalModelAnswer && (
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(finalModelAnswer)}
                                        style={{ background: T.purpleBg, border: `1px solid ${T.purple}40`, color: T.purple, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}
                                    >
                                        Copy
                                    </button>
                                )}
                            </div>
                            {finalModelAnswer ? (
                                <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.8, whiteSpace: "pre-wrap", background: T.surfaceHigh, padding: 20, borderRadius: 12, border: `1px solid ${T.borderMid}`, maxHeight: 400, overflowY: "auto" }}>
                                    {finalModelAnswer}
                                </div>
                            ) : (
                                <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic" }}>Model answer not found in this review.</div>
                            )}
                        </Card>
                    </div>
                )}

                {/* TAB 4: REVISION INTELLIGENCE */}
                {activeTab === "revision" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.3s ease" }}>
                        <Card>
                            <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright, marginBottom: 24 }}>Next Attempt Strategy</div>
                            {nextAttemptStrategy ? (
                                <div style={{ fontSize: 16, color: T.textBright, lineHeight: 1.6, background: T.purpleBg, padding: 24, borderRadius: 12, border: `1px solid ${T.purple}40` }}>
                                    <span style={{color: T.purple, marginRight: 12, fontWeight: 800}}>✦</span>
                                    {nextAttemptStrategy}
                                </div>
                            ) : (
                                <div style={{ color: T.dim }}>No strategy provided.</div>
                            )}
                        </Card>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                            <Card>
                                <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ background: T.blue, color: "#fff", width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>+</span>
                                    Revision Tasks
                                </div>
                                {hasData(revisionTasks) ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {revisionTasks.map((task, i) => (
                                            <div key={i} style={{ fontSize: 14, color: T.textBright, background: T.surfaceHigh, padding: "12px 16px", borderRadius: 8, borderLeft: `3px solid ${T.blue}` }}>
                                                {typeof task === 'string' ? task : task.task || JSON.stringify(task)}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: T.dim, fontSize: 14 }}>No specific tasks.</div>
                                )}
                            </Card>

                            <Card>
                                <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ background: T.amber, color: "#fff", width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>!</span>
                                    Mistake Book Entries
                                </div>
                                {hasData(mistakeBookEntries) ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {mistakeBookEntries.map((entry, i) => (
                                            <div key={i} style={{ fontSize: 14, color: T.textBright, background: T.surfaceHigh, padding: "12px 16px", borderRadius: 8, borderLeft: `3px solid ${T.amber}` }}>
                                                {typeof entry === 'string' ? entry : JSON.stringify(entry)}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: T.dim, fontSize: 14 }}>No mistakes recorded.</div>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
                
                {/* Advanced Intelligence Accordion (Always available at bottom) */}
                <div style={{ marginTop: 48 }}>
                    <div 
                        onClick={() => setShowIntelligence(!showIntelligence)}
                        style={{ background: showIntelligence ? T.surfaceHigh : T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}
                    >
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>Advanced Data</div>
                            <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>Raw imported review text</div>
                        </div>
                        <div style={{ color: T.dim, fontWeight: 800 }}>{showIntelligence ? "▼" : "▶"}</div>
                    </div>
                    {showIntelligence && (
                        <div style={{ padding: "24px 0", animation: "fadeIn 0.2s ease" }}>
                            {rawReviewText ? (
                                <pre style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, padding: 24, borderRadius: 12, fontSize: 13, color: T.dim, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowX: "auto", margin: 0 }}>
                                    {rawReviewText}
                                </pre>
                            ) : (
                                <div style={{ fontSize: 14, color: T.dim }}>No raw text available.</div>
                            )}
                        </div>
                    )}
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </div>
    );
}
