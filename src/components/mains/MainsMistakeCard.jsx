// src/components/mains/MainsMistakeCard.jsx
// Single mistake card used in the Mains Mistake Book page.

import React, { useState } from "react";

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

const PAPER_ACCENT = { GS1: T.amber, GS2: T.blue, GS3: T.green };

const SEVERITY_COLOR = { low: T.green, medium: T.amber, high: T.red };

const MISTAKE_LABELS = {
    weak_intro: "Weak Intro",
    weak_body_flow: "Weak Body Flow",
    weak_conclusion: "Weak Conclusion",
    no_subheadings: "No Subheadings",
    missing_dimensions: "Missing Dimensions",
    weak_examples: "Weak Examples",
    factual_gap: "Factual Gap",
    poor_question_understanding: "Poor Q Understanding",
    too_short: "Too Short",
    too_lengthy: "Too Lengthy",
    time_overrun: "Time Overrun",
    incomplete_attempt: "Incomplete Attempt",
    vague_language: "Vague Language",
    repetitive_expression: "Repetitive Expression",
    low_clarity: "Low Clarity",
    poor_formatting: "Poor Formatting",
};

export default function MainsMistakeCard({ mistake, onMarkResolved, onToggleMustRevise }) {
    const [expanded, setExpanded] = useState(false);
    const accent = PAPER_ACCENT[mistake.paper] || T.amber;
    const sevColor = SEVERITY_COLOR[mistake.severity] || T.amber;
    const isResolved = mistake.status === "resolved";
    const dateStr = new Date(mistake.createdAt).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
    });

    const questionSnippet = (mistake.question || "").length > 120
        ? mistake.question.slice(0, 120) + "…"
        : mistake.question || "—";

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

                {/* Top row: Paper badge + severity + date + must-revise */}
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
                    <span style={{
                        fontSize: 10, fontWeight: 700, color: T.dim,
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 5, padding: "2px 8px",
                    }}>
                        {mistake.marks}M
                    </span>

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

                {/* Question snippet */}
                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        fontSize: 13, fontWeight: 600, color: T.text,
                        lineHeight: 1.65, marginBottom: 12,
                        cursor: "pointer",
                    }}
                >
                    {expanded ? mistake.question : questionSnippet}
                </div>

                {/* Mistake tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {(mistake.mistakeTypes || []).map((key) => (
                        <span
                            key={key}
                            style={{
                                fontSize: 10, fontWeight: 700,
                                padding: "3px 10px", borderRadius: 6,
                                background: `${T.red}12`,
                                border: `1px solid ${T.red}25`,
                                color: T.red,
                                letterSpacing: "0.03em",
                            }}
                        >
                            {MISTAKE_LABELS[key] || key}
                        </span>
                    ))}
                </div>

                {/* Notes */}
                {mistake.notes && (
                    <div style={{
                        fontSize: 11, color: T.dim, lineHeight: 1.6,
                        padding: "10px 12px",
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 8, marginBottom: 12,
                        fontStyle: "italic",
                    }}>
                        {mistake.notes}
                    </div>
                )}

                {/* Expanded details */}
                {expanded && (
                    <div style={{
                        display: "flex", gap: 12, flexWrap: "wrap",
                        marginBottom: 12,
                    }}>
                        {mistake.wordCount > 0 && (
                            <MiniPill label="Words" value={`${mistake.wordCount}/${mistake.targetWords}`} />
                        )}
                        {mistake.mode && <MiniPill label="Mode" value={mistake.mode} />}
                        {mistake.year && <MiniPill label="Year" value={mistake.year} />}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
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
                </div>
            </div>
        </div>
    );
}

// Small detail pill for expanded view
function MiniPill({ label, value }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 2,
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: "5px 10px",
        }}>
            <span style={{
                fontSize: 8, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.subtle,
            }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{value}</span>
        </div>
    );
}
