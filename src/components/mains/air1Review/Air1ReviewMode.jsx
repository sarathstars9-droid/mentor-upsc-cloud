import React, { useState } from "react";

export default function Air1ReviewMode({ data, rawReviewText, uploadedPages, finalAnswerText, marks, onFinalize, onExit, appTheme }) {
    const [theme, setTheme] = useState(appTheme || "light");
    const [showDetailedReview, setShowDetailedReview] = useState(false);

    if (!data) return null;
    const totalMarks = Number(marks || data?.marks || data?.totalMarks || 10) || 10;
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
        examinerImpression,
        missingDimensionsChecklist,
        idealStructure,
        themeFlowchart,
        diagramSuggestions,
        mnemonic,
        topImprovements,
        air1Upgrades,
        modelAnswer,
        whyThisScoresHigh,
        detailedMentorReview
    } = data;

    // Backward Compatibility Mapping
    const isOldSchema = score && typeof score === 'object';
    
    const displayScore = isOldSchema ? score.awarded : score;
    const displayPotential = isOldSchema ? score.total : potentialScore;
    
    let displayModelAnswer = modelAnswer;
    if (isOldSchema && data.air1Answer) {
        displayModelAnswer = `**Introduction**\n${data.air1Answer.intro || ''}\n\n**Body**\n${(data.air1Answer.body || []).map(b => `- ${b}`).join('\n')}\n\n**Conclusion**\n${data.air1Answer.conclusion || ''}`;
    }

    let displayUpgrades = air1Upgrades;
    if (isOldSchema && data.mistakes && data.mistakes.length > 0) {
        displayUpgrades = data.mistakes.map(m => ({
            section: m.tag || 'Improvement',
            yourLine: m.userLine || m.problem,
            air1Upgrade: m.fix,
            whyBetter: `Resolves: ${m.problem}`
        }));
    }

    let displayImprovements = topImprovements;
    if (isOldSchema && data.lossReasons && data.lossReasons.length > 0) {
        displayImprovements = data.lossReasons;
    }

    const getScoreColor = (s, p) => {
        if (!s || !p) return T.amber;
        const ratio = parseFloat(s) / parseFloat(p);
        if (ratio >= 0.8) return T.green;
        if (ratio >= 0.6) return T.blue;
        if (ratio >= 0.4) return T.amber;
        return T.red;
    };

    const hasData = (arr) => Array.isArray(arr) && arr.length > 0;

    const Card = ({ children, style }) => (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)", ...style }}>
            {children}
        </div>
    );

    return (
        <div style={{ background: T.bg, color: T.text, minHeight: "100vh", padding: "0 0 100px 0", fontFamily: T.font, wordBreak: "normal", overflowWrap: "break-word", whiteSpace: "normal" }}>
            
            {/* Header */}
            <div style={{ position: "sticky", top: 0, background: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(248, 250, 252, 0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.border}`, zIndex: 110, padding: "16px 24px" }}>
                <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button onClick={onExit} style={{ background: "transparent", border: `1px solid ${T.borderMid}`, color: T.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                        ← Workspace
                    </button>
                    
                    <div style={{ textAlign: "center", flex: 1, padding: "0 16px", overflow: "hidden" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>UPSC Answer Improvement System</div>
                        <div style={{ fontSize: 12, color: T.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>AIR-1 Mentorship Output</div>
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
            </div>

            <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 32 }}>
                
                {/* CARD 1 — QUICK EVALUATION */}
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24 }}>Card 1 • Quick Evaluation</div>
                    
                    <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 24 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Current Score</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 42, fontWeight: 900, color: getScoreColor(displayScore, totalMarks) }}>{displayScore ?? "—"}</span>
                                <span style={{ fontSize: 24, fontWeight: 800, color: T.dim }}>/ {totalMarks}</span>
                            </div>
                        </div>
                        <div style={{ borderLeft: `1px solid ${T.borderMid}`, paddingLeft: 32 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, textTransform: "uppercase", marginBottom: 8 }}>Target Score</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 42, fontWeight: 900, color: T.textBright }}>{displayPotential ?? (totalMarks === 15 ? 11 : 7.5)}</span>
                                <span style={{ fontSize: 24, fontWeight: 800, color: T.dim }}>/ {totalMarks}</span>
                            </div>
                        </div>
                    </div>

                    {examinerImpression && (
                        <div style={{ background: T.purpleBg, borderLeft: `4px solid ${T.purple}`, padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: 16, color: T.textBright, fontStyle: "italic", lineHeight: 1.6, marginBottom: 24 }}>
                            "{examinerImpression}"
                        </div>
                    )}

                    {hasData(missingDimensionsChecklist) && (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 12 }}>Missing Dimensions Checklist</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                                {missingDimensionsChecklist.map((dim, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: T.redBg, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.red}30` }}>
                                        <span style={{ color: T.red, fontSize: 16 }}>❌</span>
                                        <span style={{ fontSize: 14, color: T.textBright, fontWeight: 600 }}>{dim.dimension || dim}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* CARD 2 — HOW TO IMPROVE THIS ANSWER */}
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.blue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24 }}>Card 2 • How to Improve This Answer</div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        <div>
                            {hasData(idealStructure) && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, marginBottom: 12 }}>Ideal UPSC Structure</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {idealStructure.map((item, i) => (
                                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 12, background: T.blueBg, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                                <div style={{ fontSize: 14, color: T.dim }}>{item}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasData(themeFlowchart) && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, marginBottom: 12 }}>Theme-Based Flowchart</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: T.surfaceHigh, padding: 16, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                        {themeFlowchart.map((step, i) => (
                                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                <div style={{ fontSize: 13, color: T.blue, fontWeight: 800, textAlign: "center" }}>{step}</div>
                                                {i < themeFlowchart.length - 1 && <div style={{ color: T.dim, fontSize: 14, margin: "4px 0" }}>↓</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            {hasData(displayImprovements) && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, marginBottom: 12 }}>Top Improvements</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {displayImprovements.map((imp, i) => (
                                            <div key={i} style={{ fontSize: 14, color: T.textBright, display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                <span style={{ color: T.amber, marginTop: 2 }}>⚡</span>
                                                <span style={{ lineHeight: 1.5 }}>{imp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasData(diagramSuggestions) && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, marginBottom: 12 }}>Diagram Suggestion</div>
                                    {diagramSuggestions.map((ds, i) => (
                                        <div key={i} style={{ fontSize: 13, background: T.amberBg, padding: 16, borderRadius: 12, border: `1px solid ${T.amber}30`, marginBottom: 8 }}>
                                            <div style={{ marginBottom: 8 }}><strong style={{ color: T.amber, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>📍 Placement</strong><div style={{ color: T.textBright, marginTop: 4, fontSize: 14 }}>{ds.placement}</div></div>
                                            <div style={{ marginBottom: 8 }}><strong style={{ color: T.purple, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>✏ Draw</strong><div style={{ color: T.textBright, marginTop: 4, fontSize: 14 }}>{ds.type}</div></div>
                                            <div style={{ marginBottom: 8 }}><strong style={{ color: T.green, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>🏷 Labels</strong><div style={{ color: T.textBright, marginTop: 4, fontSize: 14 }}>{ds.labels}</div></div>
                                            <div><strong style={{ color: T.blue, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>🎯 Why it helps</strong><div style={{ color: T.textBright, marginTop: 4, fontSize: 14 }}>{ds.whyItHelps}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {mnemonic && mnemonic.word && (
                                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 24 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Final Memory Hook</div>
                                    <div style={{ background: T.purpleBg, padding: 24, borderRadius: 16, border: `1px solid ${T.purple}40`, boxShadow: "0 4px 12px rgba(124, 58, 237, 0.1)" }}>
                                        <div style={{ 
                                            fontSize: 32, 
                                            fontWeight: 900, 
                                            color: T.purple, 
                                            marginBottom: 20, 
                                            letterSpacing: "0.15em", 
                                            textAlign: "center",
                                            background: T.bg,
                                            padding: "12px 24px",
                                            borderRadius: 12,
                                            border: `1px solid ${T.purple}30`,
                                            display: "inline-block",
                                            minWidth: "120px"
                                        }}>
                                            {mnemonic.word.toUpperCase()}
                                        </div>
                                        
                                        {Array.isArray(mnemonic.meaning) && mnemonic.meaning.length > 0 && (
                                            <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                                                {mnemonic.meaning.map((line, i) => (
                                                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 12px", background: `${T.bg}80`, borderRadius: 8 }}>
                                                        <div style={{ color: T.purple, fontWeight: 800, fontSize: 14 }}>•</div>
                                                        <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.5, fontWeight: 500 }}>{line}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {mnemonic.whyItFits && (
                                            <div style={{ borderTop: `1px solid ${T.purple}20`, paddingTop: 16 }}>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, textTransform: "uppercase", marginBottom: 8, opacity: 0.8 }}>Why it fits this question</div>
                                                <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6, fontStyle: "italic", fontWeight: 500 }}>{mnemonic.whyItFits}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* CARD 3 — AIR-1 UPGRADES */}
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24 }}>Card 3 • AIR-1 Upgrades</div>
                    {hasData(displayUpgrades) ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            {displayUpgrades.map((u, i) => (
                                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, paddingBottom: 24, borderBottom: i !== displayUpgrades.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 4, background: T.amber }}></span> Your {u.section || "Line"}
                                        </div>
                                        <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic", background: T.amberBg, padding: 16, borderRadius: 12, border: `1px solid ${T.amber}40`, lineHeight: 1.6 }}>
                                            "{u.yourLine}"
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: T.green, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 4, background: T.green }}></span> AIR-1 Upgrade
                                        </div>
                                        <div style={{ fontSize: 14, color: T.textBright, background: T.greenBg, padding: 16, borderRadius: 12, border: `1px solid ${T.green}40`, lineHeight: 1.6 }}>
                                            {u.air1Upgrade}
                                        </div>
                                        {u.whyBetter && (
                                            <div style={{ fontSize: 13, color: T.green, marginTop: 12, fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                                <span style={{ marginTop: 2 }}>✅</span> <span style={{ lineHeight: 1.5 }}>{u.whyBetter}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 14, color: T.dim }}>No specific upgrades generated.</div>
                    )}
                </Card>

                {/* CARD 4 & 5 — MODEL ANSWER & WHY IT SCORES HIGH */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 32 }}>
                    <Card style={{ border: `1px solid ${T.purple}40`, background: `linear-gradient(to bottom right, ${T.purpleBg}, transparent)` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Card 4</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright }}>AIR-1 Model Answer</div>
                            </div>
                            {displayModelAnswer && (
                                <button 
                                    onClick={() => navigator.clipboard.writeText(displayModelAnswer)}
                                    style={{ background: T.surface, border: `1px solid ${T.purple}40`, color: T.purple, fontSize: 12, fontWeight: 800, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
                                >
                                    Copy Answer
                                </button>
                            )}
                        </div>
                        {displayModelAnswer ? (
                            <div style={{ fontSize: 15, color: T.textBright, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "Georgia, 'Times New Roman', serif" }}>
                                {displayModelAnswer.split('\n').map((paragraph, i) => {
                                    const trimmed = paragraph.trim();
                                    if (!trimmed) return <div key={i} style={{ height: 16 }} />;
                                    
                                    const headingMatch = trimmed.match(/^(?:###|##|#|\*\*|\d+\.)\s*(.+?)(?:\*\*|:)?$/);
                                    if (headingMatch || (trimmed.length < 50 && trimmed === trimmed.toUpperCase())) {
                                        let title = headingMatch ? headingMatch[1].replace(/\*\*/g, '').trim() : trimmed;
                                        return (
                                            <div key={i} style={{ marginTop: 24, marginBottom: 12, fontSize: 14, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: T.font }}>
                                                {title}
                                            </div>
                                        );
                                    }

                                    const formattedText = trimmed.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={j} style={{ fontWeight: 700, color: T.purple }}>{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    });

                                    return (
                                        <div key={i} style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                                            {trimmed.startsWith('-') || trimmed.startsWith('•') ? (
                                                <>
                                                    <span style={{ color: T.subtle, userSelect: "none" }}>•</span>
                                                    <span>{formattedText.map(t => typeof t === 'string' ? t.replace(/^[-•]\s*/, '') : t)}</span>
                                                </>
                                            ) : (
                                                <span>{formattedText}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ fontSize: 14, color: T.dim, fontStyle: "italic" }}>Model answer not generated.</div>
                        )}
                    </Card>

                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24 }}>Card 5</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Why This Scores High</div>
                        {hasData(whyThisScoresHigh) ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {whyThisScoresHigh.map((reason, i) => (
                                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surfaceHigh, padding: "12px 16px", borderRadius: 10, border: `1px solid ${T.borderMid}` }}>
                                        <span style={{ color: T.green, fontSize: 16, marginTop: -2 }}>✓</span>
                                        <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.5, fontWeight: 500 }}>{reason}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: 14, color: T.dim }}>No specific reasons cited.</div>
                        )}
                    </Card>
                </div>

                {/* CARD 6 — DETAILED MENTOR REVIEW */}
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div 
                        onClick={() => setShowDetailedReview(!showDetailedReview)}
                        style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: showDetailedReview ? T.surfaceHigh : "transparent" }}
                    >
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Card 6</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>Detailed Mentor Review</div>
                        </div>
                        <div style={{ fontSize: 12, color: T.dim, fontWeight: 800, background: T.surface, border: `1px solid ${T.borderMid}`, padding: "6px 12px", borderRadius: 20 }}>
                            {showDetailedReview ? "Hide Details" : "View Details"}
                        </div>
                    </div>
                    
                    {showDetailedReview && (
                        <div style={{ padding: "0 24px 24px 24px", borderTop: `1px solid ${T.border}` }}>
                            {detailedMentorReview ? (
                                <pre style={{ marginTop: 24, padding: "24px", borderRadius: 12, fontSize: 14, color: T.dim, whiteSpace: "pre-wrap", overflowX: "auto", background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, margin: 0, fontFamily: T.font, lineHeight: 1.7 }}>
                                    {detailedMentorReview}
                                </pre>
                            ) : (
                                <div style={{ fontSize: 14, color: T.dim, marginTop: 24 }}>No detailed review available.</div>
                            )}
                            {rawReviewText && (
                                <div style={{ marginTop: 24 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 12 }}>Raw AI Output</div>
                                    <pre style={{ padding: "16px", borderRadius: 8, fontSize: 12, color: T.dim, whiteSpace: "pre-wrap", overflowX: "auto", border: `1px solid ${T.borderMid}`, margin: 0, background: T.bg }}>
                                        {rawReviewText}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
