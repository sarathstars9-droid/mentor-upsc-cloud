// src/components/mains/air1Review/ExaminerMarkupOverlay.jsx
// Phase 1-3: Examiner Markup Overlay with inline annotations and correction popups
// Surgically added — does NOT replace any existing component

import React, { useState, useEffect, useRef } from "react";

// ─── Severity config ──────────────────────────────────────────────────────────
const SEVERITY_MAP = {
    critical:    { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)",  label: "Critical",    icon: "🔴" },
    high:        { color: "#ef4444", bg: "rgba(239, 68, 68, 0.10)", border: "rgba(239, 68, 68, 0.25)", label: "Critical",    icon: "🔴" },
    medium:      { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)", label: "Moderate",   icon: "🟠" },
    moderate:    { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)", label: "Moderate",   icon: "🟠" },
    low:         { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.10)", border: "rgba(59, 130, 246, 0.25)", label: "Improvement", icon: "🔵" },
    improvement: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.10)", border: "rgba(59, 130, 246, 0.25)", label: "Improvement", icon: "🔵" },
    good:        { color: "#22c55e", bg: "rgba(34, 197, 94, 0.10)",  border: "rgba(34, 197, 94, 0.25)",  label: "Good Point", icon: "🟢" },
    strength:    { color: "#22c55e", bg: "rgba(34, 197, 94, 0.10)",  border: "rgba(34, 197, 94, 0.25)",  label: "Good Point", icon: "🟢" },
};

const getSeverityStyle = (severity) => {
    const key = (severity || "medium").toLowerCase();
    return SEVERITY_MAP[key] || SEVERITY_MAP.medium;
};

// ─── Heuristic derivation of line corrections ─────────────────────────────────
function deriveCorrections(data, answerText) {
    const corrections = [];
    const seen = new Set();

    // From explicit lineCorrections
    if (Array.isArray(data.lineCorrections)) {
        data.lineCorrections.forEach((lc, i) => {
            const userLine = lc.userLine || lc.user_line || lc.original || lc.idea || "";
            const problem = lc.problem || lc.issue || lc.weakness || "";
            const correction = lc.correction || lc.improvedLine || lc.betterVersion || "";
            const why = lc.whyItImprovesMarks || lc.reason || lc.improvementReason || "";
            const marksImpact = lc.marksImpact || "";
            if (userLine || correction) {
                const key = (userLine + correction).toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    corrections.push({
                        id: `lc_${i}`,
                        originalText: userLine,
                        issueType: problem || "weakness",
                        severity: lc.severity || (problem?.toLowerCase().includes("factual") ? "critical" : "medium"),
                        examinerComment: problem,
                        improvedVersion: correction,
                        air1Thinking: why,
                        marksImpact: marksImpact || (lc.severity === "high" ? "-1.0" : "-0.5"),
                    });
                }
            }
        });
    }

    // From genericLines 
    if (Array.isArray(data.genericLines) && corrections.length < 8) {
        data.genericLines.forEach((gl, i) => {
            const line = typeof gl === "string" ? gl : gl?.line || gl?.text || "";
            if (line && line.length > 10 && !seen.has(line.toLowerCase())) {
                seen.add(line.toLowerCase());
                corrections.push({
                    id: `gl_${i}`,
                    originalText: line,
                    issueType: "generic_phrasing",
                    severity: "medium",
                    examinerComment: "Generic phrasing — lacks analytical specificity",
                    improvedVersion: "",
                    air1Thinking: "UPSC examiners discount vague or textbook-like statements that lack specificity.",
                    marksImpact: "-0.5",
                });
            }
        });
    }

    // From factualErrors
    if (Array.isArray(data.factualErrors) && corrections.length < 10) {
        data.factualErrors.forEach((fe, i) => {
            const text = typeof fe === "string" ? fe : fe?.error || fe?.text || "";
            if (text && text.length > 10 && !seen.has(text.toLowerCase())) {
                seen.add(text.toLowerCase());
                corrections.push({
                    id: `fe_${i}`,
                    originalText: text,
                    issueType: "factual_error",
                    severity: "critical",
                    examinerComment: "Factual inaccuracy detected",
                    improvedVersion: "",
                    air1Thinking: "Factual errors cause immediate mark deductions in UPSC evaluation.",
                    marksImpact: "-1.0",
                });
            }
        });
    }

    // From whyMarksLost — derive if we still need more corrections
    if (Array.isArray(data.whyMarksLost) && corrections.length < 5) {
        data.whyMarksLost.forEach((reason, i) => {
            if (typeof reason === "string" && reason.length > 15 && !seen.has(reason.toLowerCase())) {
                // Try to find a matching phrase in the answer text
                const answerLower = (answerText || "").toLowerCase();
                const words = reason.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                let matchedPhrase = "";
                for (const word of words) {
                    const idx = answerLower.indexOf(word);
                    if (idx !== -1) {
                        // Extract surrounding context
                        const start = Math.max(0, idx - 20);
                        const end = Math.min(answerLower.length, idx + word.length + 30);
                        matchedPhrase = (answerText || "").substring(start, end).trim();
                        break;
                    }
                }
                if (matchedPhrase || reason) {
                    seen.add(reason.toLowerCase());
                    corrections.push({
                        id: `wml_${i}`,
                        originalText: matchedPhrase || "",
                        issueType: "marks_lost",
                        severity: "high",
                        examinerComment: reason,
                        improvedVersion: "",
                        air1Thinking: "This weakness directly contributed to marks deduction.",
                        marksImpact: "-0.5",
                    });
                }
            }
        });
    }

    return corrections;
}

// ─── Text matching utility ────────────────────────────────────────────────────
function findBestMatch(text, phrase) {
    if (!text || !phrase || phrase.length < 8) return -1;
    const textLower = text.toLowerCase();
    const phraseLower = phrase.toLowerCase().trim();
    
    // Direct match
    const directIdx = textLower.indexOf(phraseLower);
    if (directIdx !== -1) return directIdx;
    
    // Partial match — first 25 chars
    const partial = phraseLower.substring(0, Math.min(25, phraseLower.length));
    const partialIdx = textLower.indexOf(partial);
    if (partialIdx !== -1) return partialIdx;
    
    // Word overlap match
    const phraseWords = phraseLower.split(/\s+/).filter(w => w.length > 4);
    if (phraseWords.length === 0) return -1;
    
    // Find the position where most words cluster
    let bestPos = -1;
    let bestScore = 0;
    for (let i = 0; i < textLower.length - 20; i += 10) {
        const window = textLower.substring(i, i + 80);
        let score = 0;
        for (const w of phraseWords) {
            if (window.includes(w)) score++;
        }
        if (score > bestScore && score >= Math.min(2, phraseWords.length)) {
            bestScore = score;
            bestPos = i;
        }
    }
    return bestPos;
}

// ─── Correction Popup Card ────────────────────────────────────────────────────
function CorrectionPopup({ correction, onClose, T }) {
    const sev = getSeverityStyle(correction.severity);
    const popupRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [onClose]);

    return (
        <>
            <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998,
                animation: "examinerFadeIn 0.15s ease"
            }} onClick={onClose} />
            <div ref={popupRef} style={{
                position: "fixed", bottom: "5vh", left: "50%", transform: "translateX(-50%)",
                background: T.surface, border: `1.5px solid ${sev.border}`,
                borderRadius: 20, padding: 0, width: "92%", maxWidth: 480, zIndex: 9999,
                boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${sev.border}`,
                animation: "examinerSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                overflow: "hidden"
            }}>
                {/* Header strip */}
                <div style={{
                    background: sev.bg, padding: "14px 20px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: `1px solid ${sev.border}`
                }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{
                            background: sev.color, color: "#fff", padding: "3px 10px",
                            borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                            letterSpacing: "0.04em"
                        }}>{sev.label}</span>
                        <span style={{ fontSize: 12, color: T.subtle, fontWeight: 600 }}>
                            {correction.issueType?.replace(/_/g, " ") || "Issue"}
                        </span>
                    </div>
                    <button onClick={onClose} style={{
                        background: "none", border: "none", color: T.subtle,
                        cursor: "pointer", fontSize: 18, padding: "4px 8px", borderRadius: 6
                    }}>✕</button>
                </div>

                <div style={{ padding: "20px" }}>
                    {/* Problem */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 15 }}>❌</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: T.red || "#ef4444", textTransform: "uppercase", letterSpacing: "0.04em" }}>Problem</span>
                        </div>
                        <div style={{
                            fontSize: 14, color: T.textBright, lineHeight: 1.5,
                            padding: "10px 14px", background: sev.bg, borderRadius: 10,
                            borderLeft: `3px solid ${sev.color}`
                        }}>
                            {correction.examinerComment || "Issue detected"}
                        </div>
                    </div>

                    {/* AIR-1 Thinking */}
                    {correction.air1Thinking && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 15 }}>🧠</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: T.purple || "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.04em" }}>AIR-1 Thinking</span>
                            </div>
                            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, fontStyle: "italic" }}>
                                {correction.air1Thinking}
                            </div>
                        </div>
                    )}

                    {/* AIR-1 Rewrite */}
                    {correction.improvedVersion && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 15 }}>✅</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: T.green || "#22c55e", textTransform: "uppercase", letterSpacing: "0.04em" }}>AIR-1 Rewrite</span>
                            </div>
                            <div style={{
                                fontSize: 14, color: T.textBright, lineHeight: 1.5, fontWeight: 500,
                                padding: "10px 14px",
                                background: "rgba(34, 197, 94, 0.08)",
                                borderRadius: 10,
                                borderLeft: `3px solid ${T.green || "#22c55e"}`
                            }}>
                                {correction.improvedVersion}
                            </div>
                        </div>
                    )}

                    {/* Marks Impact */}
                    {correction.marksImpact && (
                        <div style={{
                            display: "flex", gap: 8, alignItems: "center",
                            padding: "10px 14px", background: T.surfaceHigh || "rgba(255,255,255,0.05)",
                            borderRadius: 10, border: `1px solid ${T.border}`
                        }}>
                            <span style={{ fontSize: 15 }}>🎯</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Marks Impact</span>
                            <span style={{
                                fontSize: 14, fontWeight: 800,
                                color: correction.marksImpact.includes("-") ? (T.red || "#ef4444") : (T.green || "#22c55e"),
                                marginLeft: "auto"
                            }}>
                                {correction.marksImpact}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}


// ─── Main ExaminerMarkupOverlay component ─────────────────────────────────────
export default function ExaminerMarkupOverlay({ answerText, data, T }) {
    const [corrections, setCorrections] = useState([]);
    const [selectedCorrection, setSelectedCorrection] = useState(null);
    const [revealedCount, setRevealedCount] = useState(0);
    const [isRevealing, setIsRevealing] = useState(true);

    useEffect(() => {
        if (!data) return;
        const derived = deriveCorrections(data, answerText);
        setCorrections(derived);
        setRevealedCount(0);
        setIsRevealing(true);
    }, [data, answerText]);

    // Progressive reveal animation
    useEffect(() => {
        if (!isRevealing || corrections.length === 0) return;
        if (revealedCount >= corrections.length) {
            setIsRevealing(false);
            return;
        }
        const timer = setTimeout(() => {
            setRevealedCount(prev => prev + 1);
        }, 300);
        return () => clearTimeout(timer);
    }, [revealedCount, corrections.length, isRevealing]);

    if (!answerText) {
        return (
            <div style={{ color: T.dim, padding: 24, textAlign: "center", fontSize: 14, fontStyle: "italic" }}>
                No answer text available for examiner markup. Upload and extract your answer first.
            </div>
        );
    }

    if (corrections.length === 0) {
        return (
            <div style={{ color: T.dim, padding: 24, textAlign: "center", fontSize: 14, fontStyle: "italic" }}>
                No corrections could be derived from the review data.
            </div>
        );
    }

    // Build annotated text segments
    const buildAnnotatedSegments = () => {
        const visibleCorrections = corrections.slice(0, revealedCount);
        const segments = [];
        let processedText = answerText;
        
        // Find all match positions
        const matches = [];
        for (const corr of visibleCorrections) {
            if (!corr.originalText || corr.originalText.length < 8) continue;
            const pos = findBestMatch(processedText, corr.originalText);
            if (pos !== -1) {
                // Determine the actual matched length
                const matchLen = Math.min(corr.originalText.length, processedText.length - pos);
                matches.push({ pos, len: matchLen, correction: corr });
            }
        }

        // Sort by position and remove overlaps
        matches.sort((a, b) => a.pos - b.pos);
        const deduped = [];
        let lastEnd = 0;
        for (const m of matches) {
            if (m.pos >= lastEnd) {
                deduped.push(m);
                lastEnd = m.pos + m.len;
            }
        }

        // Build segments
        let cursor = 0;
        for (const m of deduped) {
            // Text before this match
            if (m.pos > cursor) {
                segments.push({ type: "text", content: processedText.substring(cursor, m.pos) });
            }
            // The matched/annotated text
            segments.push({
                type: "annotation",
                content: processedText.substring(m.pos, m.pos + m.len),
                correction: m.correction,
            });
            cursor = m.pos + m.len;
        }
        // Remaining text
        if (cursor < processedText.length) {
            segments.push({ type: "text", content: processedText.substring(cursor) });
        }

        return segments;
    };

    const segments = buildAnnotatedSegments();
    const issueCount = corrections.length;
    const criticalCount = corrections.filter(c => ["critical", "high"].includes((c.severity || "").toLowerCase())).length;
    const moderateCount = corrections.filter(c => ["medium", "moderate"].includes((c.severity || "").toLowerCase())).length;

    return (
        <div style={{ position: "relative" }}>
            {/* Issue Summary Bar */}
            <div style={{
                display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                padding: "12px 16px", marginBottom: 16,
                background: T.surfaceHigh, borderRadius: 12,
                border: `1px solid ${T.border}`
            }}>
                <div style={{
                    fontSize: 12, fontWeight: 800, color: T.textBright,
                    display: "flex", gap: 6, alignItems: "center"
                }}>
                    <span style={{ fontSize: 16 }}>📝</span>
                    {issueCount} Issue{issueCount !== 1 ? "s" : ""} Found
                </div>
                <div style={{ height: 16, width: 1, background: T.border }} />
                {criticalCount > 0 && (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: "#ef4444",
                        background: "rgba(239, 68, 68, 0.1)", padding: "3px 10px",
                        borderRadius: 6
                    }}>🔴 {criticalCount} Critical</span>
                )}
                {moderateCount > 0 && (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: "#f59e0b",
                        background: "rgba(245, 158, 11, 0.1)", padding: "3px 10px",
                        borderRadius: 6
                    }}>🟠 {moderateCount} Moderate</span>
                )}
                {(issueCount - criticalCount - moderateCount) > 0 && (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: "#3b82f6",
                        background: "rgba(59, 130, 246, 0.1)", padding: "3px 10px",
                        borderRadius: 6
                    }}>🔵 {issueCount - criticalCount - moderateCount} Other</span>
                )}
                <div style={{ marginLeft: "auto", fontSize: 11, color: T.dim }}>
                    Click highlighted text to see examiner notes
                </div>
            </div>

            {/* Annotated Answer Text */}
            <div style={{
                position: "relative",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 15, lineHeight: 2.0,
                color: T.textBright,
                padding: "28px 32px",
                background: T.surfaceHigh,
                borderRadius: 14,
                border: `1px solid ${T.borderMid}`,
                // Paper-like background effect
                backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${T.border} 31px, ${T.border} 32px)`,
                backgroundPosition: "0 28px",
            }}>
                {/* Red margin line */}
                <div style={{
                    position: "absolute", top: 0, bottom: 0, left: 50,
                    width: 1.5, background: "rgba(239, 68, 68, 0.25)",
                    pointerEvents: "none"
                }} />

                <div style={{ paddingLeft: 24 }}>
                    {segments.map((seg, i) => {
                        if (seg.type === "text") {
                            return <span key={i}>{seg.content}</span>;
                        }
                        const sev = getSeverityStyle(seg.correction.severity);
                        return (
                            <span key={i} style={{ position: "relative", display: "inline" }}>
                                <span
                                    onClick={() => setSelectedCorrection(seg.correction)}
                                    style={{
                                        background: sev.bg,
                                        borderBottom: `2.5px solid ${sev.color}`,
                                        padding: "1px 2px",
                                        borderRadius: 3,
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        textDecoration: "none",
                                        animation: `examinerHighlightPulse 2s ease-in-out`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = sev.border;
                                        e.target.style.boxShadow = `0 0 8px ${sev.color}40`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = sev.bg;
                                        e.target.style.boxShadow = "none";
                                    }}
                                    title={`${sev.label}: ${seg.correction.examinerComment || "Click for details"}`}
                                >
                                    {seg.content}
                                </span>
                                <span
                                    onClick={() => setSelectedCorrection(seg.correction)}
                                    style={{
                                        display: "inline-flex", alignItems: "center",
                                        justifyContent: "center", verticalAlign: "middle",
                                        background: sev.color, color: "#fff",
                                        fontSize: 9, fontWeight: 800,
                                        width: 18, height: 18, borderRadius: 9,
                                        marginLeft: 4, cursor: "pointer",
                                        fontFamily: T.font,
                                        boxShadow: `0 2px 6px ${sev.color}40`,
                                        animation: "examinerBubblePop 0.3s ease",
                                    }}
                                    title="Click for correction details"
                                >
                                    {corrections.indexOf(seg.correction) + 1}
                                </span>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Correction Popup */}
            {selectedCorrection && (
                <CorrectionPopup
                    correction={selectedCorrection}
                    onClose={() => setSelectedCorrection(null)}
                    T={T}
                />
            )}

            {/* CSS animations */}
            <style>{`
                @keyframes examinerHighlightPulse {
                    0% { opacity: 0; transform: scale(0.97); }
                    50% { opacity: 1; transform: scale(1.01); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes examinerBubblePop {
                    0% { transform: scale(0); opacity: 0; }
                    60% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes examinerFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes examinerSlideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(40px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}
