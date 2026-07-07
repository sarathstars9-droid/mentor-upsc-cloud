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

const MISTAKE_TEMPLATES = {
    question_demand_mismatch: {
        why: "Misunderstanding the core directive or demand leads to off-topic arguments, scoring below-average marks.",
        fix: "Read the question twice, underline the directive words (e.g. 'critically analyze'), and align every section directly with what is asked."
    },
    optional_concept_gap: {
        why: "Optional papers require academic depth. Using generic language instead of core concepts or theories loses professional authority.",
        fix: "Use precise terminologies, refer to relevant thinkers/theories, and explain the core concept explicitly."
    },
    content_gap: {
        why: "Missing key dimensions makes the answer shallow and incomplete, leaving scope for the examiner to deduct marks.",
        fix: "Brainstorm 360-degree aspects (social, economic, political, environmental) and write distinct points for each."
    },
    weak_structure: {
        why: "Poorly structured answers make it hard for the examiner to navigate, reducing the overall impression and score.",
        fix: "Divide the answer into clear sections with bold subheadings and use numbered/bullet points for readability."
    },
    weak_analysis: {
        why: "One-sided or superficial arguments without critical analysis fail to demonstrate public servant problem-solving skills.",
        fix: "Provide balanced arguments, state pros and cons, use the 'critically examine' approach, and back each point with reasoning."
    },
    essay_flow_issue: {
        why: "Essays require seamless transition and coherence between paragraphs. Abrupt shifts break the narrative flow.",
        fix: "Use logical connector sentences at the end of each paragraph to introduce the next theme smoothly."
    },
    ethics_example_missing: {
        why: "Ethics answers without real-life examples, case studies, or moral dilemmas read like dry theory and lack personal conviction.",
        fix: "Quote at least one real-life administrator example, historical incident, or case study per sub-part."
    },
    missing_examples: {
        why: "Arguments without concrete illustrations remain theoretical and fail to convince the examiner of your practical understanding.",
        fix: "Back every major argument with a real-world example, scheme, or case study."
    },
    missing_data_or_reports: {
        why: "Lack of authoritative data, committee recommendations, or reports makes arguments look like personal opinions rather than verified facts.",
        fix: "Cite relevant reports (e.g., ARC, NITI Aayog), constitutional articles, Supreme Court cases, or official statistics."
    },
    diagram_or_map_missing: {
        why: "Visual aids like maps, flowcharts, or diagrams break monotony and save the examiner's time, boosting the score by 0.5 to 1 mark.",
        fix: "Draw a neat schematic diagram, India/World map, or flowchart to illustrate spatial distributions or processes."
    },
    weak_introduction: {
        why: "A weak or generic introduction fails to capture the examiner's interest and set a positive tone for the rest of the answer.",
        fix: "Start with a precise definition, recent current affairs context, or relevant statistical data (max 30-40 words)."
    },
    weak_conclusion: {
        why: "An abrupt or repetitive conclusion fails to leave a constructive, forward-looking impression.",
        fix: "End with a positive, futuristic 'Way Forward', linking it to SDGs, national objectives, or constitutional values."
    },
    presentation_issue: {
        why: "Poor handwriting, layout, or lack of highlighting makes reading laborious for the examiner, causing subtle marks deduction.",
        fix: "Improve neatness, leave adequate margins, highlight key terms, and keep spacing uniform."
    }
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

    const rawNotes = mistake.notes || "";
    let whyItMatters = "";
    let fixText = rawNotes;

    // Check if it has "Why it matters:" and "Fix:" structured text
    if (rawNotes.includes("Why it matters:") && rawNotes.includes("Fix:")) {
        const match = rawNotes.match(/Why it matters:\s*([\s\S]*?)\nFix:\s*([\s\S]*)/i);
        if (match) {
            whyItMatters = match[1].trim();
            fixText = match[2].trim();
        }
    } else {
        // Fallback to templates based on mistakeType / errorType
        const mType = mistake.mistakeType || mistake.errorType || "";
        const tpl = MISTAKE_TEMPLATES[mType] || MISTAKE_TEMPLATES.content_gap;
        whyItMatters = tpl.why;
        fixText = rawNotes || tpl.fix;
    }

    // Clean up weakness summary title
    let cleanMistakeText = (mistake.mistakeText || "").trim();
    cleanMistakeText = cleanMistakeText.replace(/^(weakness|missing dimension):\s*/i, "");

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

                {/* Mistake weakness description */}
                {cleanMistakeText && (
                    <div style={{
                        fontSize: 13, color: T.textBright, fontWeight: 700,
                        lineHeight: 1.5, marginBottom: 8,
                        display: "flex", gap: 6, alignItems: "flex-start"
                    }}>
                        <span style={{ color: T.red }}>⚠️</span>
                        <div>
                            <span style={{ color: T.dim, fontWeight: 600 }}>Mistake: </span>
                            {cleanMistakeText}
                        </div>
                    </div>
                )}

                {/* Why it matters */}
                {whyItMatters && (
                    <div style={{
                        fontSize: 12, color: T.dim, lineHeight: 1.6,
                        marginBottom: 10, paddingLeft: 18,
                        borderLeft: `2px solid ${T.amber}44`
                    }}>
                        <span style={{ color: T.amber, fontWeight: 700 }}>Why it matters: </span>
                        {whyItMatters}
                    </div>
                )}

                {/* Fix Action */}
                {fixText && (
                    <div style={{
                        fontSize: 12, color: T.text, lineHeight: 1.6,
                        padding: "10px 14px",
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 8, marginBottom: 12,
                        display: "flex", gap: 6, alignItems: "flex-start"
                    }}>
                        <span style={{ color: T.green }}>✓</span>
                        <div>
                            <span style={{ color: T.green, fontWeight: 700 }}>Fix: </span>
                            {fixText}
                        </div>
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
