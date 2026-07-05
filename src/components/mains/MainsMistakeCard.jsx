// src/components/mains/MainsMistakeCard.jsx
// Single mistake card used in the Mains Mistake Book page.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    bg: "#09090b",
    surface: "#111113",
    surfaceHigh: "#18181b",
    border: "#1f1f23",
    borderMid: "#27272a",
    muted: "#3f3f46",
    subtle: "#52525b",
    dim: "#71717a",
    text: "#e4e4e7",
    textBright: "#f4f4f5",
    amber: "#f59e0b",
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#8b5cf6",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const PAPER_ACCENT = {
    GS1: T.amber,
    GS2: T.blue,
    GS3: T.green,
    Ethics: T.red,
    Essay: T.purple,
    "Geography Optional": T.blue
};

const SEVERITY_COLOR = { low: T.green, medium: T.amber, high: T.red };

export default function MainsMistakeCard({ mistake, onMarkResolved, onToggleMustRevise }) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const accent = PAPER_ACCENT[mistake.paper] || T.amber;
    const sevColor = SEVERITY_COLOR[mistake.severity] || T.amber;
    const isResolved = mistake.status === "resolved";
    const dateStr = mistake.createdAt 
        ? new Date(mistake.createdAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })
        : "—";

    const questionText = mistake.questionText || mistake.question || "—";
    const questionSnippet = questionText.length > 120
        ? questionText.slice(0, 120) + "…"
        : questionText;

    const sourceLabel = mistake.review_source === "chatgpt_air1" 
        ? "ChatGPT AIR-1 Review" 
        : mistake.review_source === "gemini_basic" 
        ? "Gemini Basic Review"
        : "Basic Evaluation";

    const handleViewAttempt = () => {
        if (!mistake.attemptId && !mistake.source_ref) return;
        navigate("/mains/answer-writing", {
            state: {
                attemptId: mistake.attemptId || mistake.source_ref,
                isRestored: true,
                practiceMode: "typed",
                paper: mistake.paper,
                mode: "Custom",
                questions: [
                    {
                        question: questionText,
                        marks: mistake.marks || 15,
                        wordLimit: mistake.wordLimit || 200,
                        paper: mistake.paper,
                        year: mistake.year || null,
                        hint: mistake.topic || ""
                    }
                ],
                currentIndex: 0
            }
        });
    };

    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${isResolved ? T.border : accent + "33"}`,
            borderRadius: 12,
            overflow: "hidden",
            opacity: isResolved ? 0.65 : 1,
            transition: "opacity 0.2s",
        }}>
            {/* Accent top bar */}
            <div style={{
                height: 2,
                background: `linear-gradient(90deg, ${accent}, ${accent}44, ${T.border})`,
            }} />

            <div style={{ padding: "16px 20px" }}>

                {/* Top row: Paper badge + severity + status + score + must-revise */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    flexWrap: "wrap", marginBottom: 10,
                }}>
                    {/* Paper badge */}
                    <span style={{
                        fontSize: 10, fontWeight: 900, color: accent,
                        background: `${accent}15`, border: `1px solid ${accent}33`,
                        borderRadius: 5, padding: "2px 8px",
                        letterSpacing: "0.06em",
                    }}>
                        {mistake.paper}
                    </span>

                    {/* Marks */}
                    {mistake.marks && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, color: T.dim,
                            background: T.bg, border: `1px solid ${T.border}`,
                            borderRadius: 5, padding: "2px 8px",
                        }}>
                            {mistake.marks}M
                        </span>
                    )}

                    {/* Score badge */}
                    {mistake.score !== null && mistake.score !== undefined && (
                        <span style={{
                            fontSize: 10, fontWeight: 800, color: T.green,
                            background: `${T.green}15`, border: `1px solid ${T.green}33`,
                            borderRadius: 5, padding: "2px 8px",
                        }}>
                            Score: {mistake.score}
                        </span>
                    )}

                    {/* Severity */}
                    <span style={{
                        fontSize: 9, fontWeight: 800, color: sevColor,
                        background: `${sevColor}15`, border: `1px solid ${sevColor}33`,
                        borderRadius: 5, padding: "2px 8px",
                        letterSpacing: "0.07em", textTransform: "uppercase",
                    }}>
                        {mistake.severity}
                    </span>

                    {/* Status */}
                    <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: isResolved ? T.green : T.amber,
                        background: isResolved ? `${T.green}12` : `${T.amber}12`,
                        border: `1px solid ${isResolved ? T.green + "33" : T.amber + "33"}`,
                        borderRadius: 5, padding: "2px 8px",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                        {isResolved ? "Resolved" : "Open"}
                    </span>

                    {/* Must Revise */}
                    {mistake.mustRevise && (
                        <span style={{
                            fontSize: 9, fontWeight: 800, color: T.amber,
                            background: `${T.amber}15`, border: `1px solid ${T.amber}33`,
                            borderRadius: 5, padding: "2px 8px",
                            letterSpacing: "0.06em",
                        }}>
                            🔁 MUST REVISE
                        </span>
                    )}

                    {/* Spacer + date */}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: T.subtle, fontWeight: 600 }}>
                        {dateStr}
                    </span>
                </div>

                {/* Question title / snippet */}
                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        fontSize: 13, fontWeight: 600, color: T.text,
                        lineHeight: 1.65, marginBottom: 12,
                        cursor: "pointer",
                    }}
                >
                    {expanded ? questionText : questionSnippet}
                </div>

                {/* Source tag & Topic */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700,
                        padding: "2px 8px", borderRadius: 4,
                        background: T.bg, border: `1px solid ${T.border}`,
                        color: T.dim,
                    }}>
                        Source: {sourceLabel}
                    </span>
                    {mistake.topic && (
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "2px 8px", borderRadius: 4,
                            background: T.bg, border: `1px solid ${T.border}`,
                            color: T.dim,
                        }}>
                            Topic: {mistake.topic}
                        </span>
                    )}
                </div>

                {/* Mistake Summary */}
                {mistake.mistakeText && (
                    <div style={{
                        fontSize: 12, color: T.textBright, fontWeight: 700,
                        lineHeight: 1.5, marginBottom: 8
                    }}>
                        ⚠️ {mistake.mistakeText}
                    </div>
                )}

                {/* Recommended Fix */}
                {mistake.notes && (
                    <div style={{
                        fontSize: 11, color: T.dim, lineHeight: 1.6,
                        padding: "10px 12px",
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 8, marginBottom: 12,
                        fontStyle: "italic",
                    }}>
                        <strong>Fix suggestion:</strong> {mistake.notes}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {!isResolved && (
                        <button
                            onClick={() => onMarkResolved?.(mistake.id)}
                            style={{
                                background: "transparent",
                                border: `1px solid ${T.green}44`,
                                borderRadius: 7, padding: "5px 14px",
                                fontSize: 11, fontWeight: 700,
                                color: T.green, cursor: "pointer",
                                fontFamily: T.font,
                            }}
                        >
                            ✓ Mark Resolved
                        </button>
                    )}
                    <button
                        onClick={() => onToggleMustRevise?.(mistake.id)}
                        style={{
                            background: "transparent",
                            border: `1px solid ${mistake.mustRevise ? T.amber + "44" : T.borderMid}`,
                            borderRadius: 7, padding: "5px 14px",
                            fontSize: 11, fontWeight: 700,
                            color: mistake.mustRevise ? T.amber : T.dim,
                            cursor: "pointer",
                            fontFamily: T.font,
                        }}
                    >
                        {mistake.mustRevise ? "🔁 Unmark Revise" : "🔁 Must Revise"}
                    </button>

                    {(mistake.attemptId || mistake.source_ref) && (
                        <button
                            onClick={handleViewAttempt}
                            style={{
                                background: `${accent}18`,
                                border: `1px solid ${accent}44`,
                                borderRadius: 7, padding: "5px 14px",
                                fontSize: 11, fontWeight: 700,
                                color: accent, cursor: "pointer",
                                fontFamily: T.font,
                            }}
                        >
                            📝 Open Attempt Workspace
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
