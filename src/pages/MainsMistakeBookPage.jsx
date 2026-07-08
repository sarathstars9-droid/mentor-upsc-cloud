// src/pages/MainsMistakeBookPage.jsx
// Mains Mistake Book — view, filter, and resolve mains writing mistakes.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    bg: "#09090b",
    surface: "#111113",
    surfaceHigh: "#18181b",
    border: "#1f1f23",
    borderMid: "#27272a",
    muted: "#3f3f46",
    subtle: "#52525b",
    dim: "#a1a1aa",
    text: "#d4d4d8",
    textBright: "#f4f4f5",
    amber: "#f59e0b",
    blue: "#3b82f6",
    green: "#10b981",
    red: "#ef4444",
    purple: "#8b5cf6",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
};

const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color,
    fontFamily: T.font,
});

const PAPER_ACCENT = {
    All: T.purple,
    GS1: T.amber,
    GS2: T.blue,
    GS3: T.green,
    Essay: T.purple,
    Ethics: T.red,
    "Geography Optional": T.blue,
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

const API_URL = `${BACKEND_URL}/api/mistakes?userId=user_1`;

function inferPaper(mistake) {
    if (mistake.paper) {
        const p = String(mistake.paper).toUpperCase();
        if (p.includes("ESSAY")) return "Essay";
        if (p.includes("ETHICS") || p.includes("GS4") || p.includes("GS PAPER IV") || p.includes("GS 4")) return "Ethics";
        if (p.includes("GEOGRAPHY") || p.includes("OPTIONAL")) return "Geography Optional";
        if (p.includes("GS1") || p.includes("GS 1") || p.includes("GENERAL STUDIES I")) return "GS1";
        if (p.includes("GS2") || p.includes("GS 2") || p.includes("GENERAL STUDIES II")) return "GS2";
        if (p.includes("GS3") || p.includes("GS 3") || p.includes("GENERAL STUDIES III")) return "GS3";
        return mistake.paper;
    }
    if (mistake.paper_type) return String(mistake.paper_type).toUpperCase();
    if (mistake.source_ref) {
        const ref = String(mistake.source_ref).toUpperCase();
        if (ref.includes("GS1")) return "GS1";
        if (ref.includes("GS2")) return "GS2";
        if (ref.includes("GS3")) return "GS3";
        if (ref.includes("GS4")) return "Ethics";
        if (ref.includes("ESSAY")) return "Essay";
        if (ref.includes("ETHICS")) return "Ethics";
    }
    return "GS1";
}

function inferStatus(mistake) {
    if (mistake.status) return mistake.status;
    if (mistake.resolved_at) return "resolved";
    return "open";
}

function inferSeverity(mistake) {
    if (mistake.severity) return mistake.severity;
    const errorType = String(mistake.error_type || "").toLowerCase();
    if (errorType.includes("structure") || errorType.includes("directive") || errorType.includes("core")) return "high";
    if (errorType.includes("example") || errorType.includes("analysis") || errorType.includes("balance")) return "medium";
    return "medium";
}

function normalizeMistake(m) {
    let score = m.score ?? null;
    let reviewSource = m.review_source ?? null;
    let notes = m.notes ?? "";

    if (m.notes) {
        if (m.notes.startsWith("[Source:")) {
            const match = m.notes.match(/^\[Source:\s*([^\]]+)\]\s*\[Score:\s*([^\]]+)\]\n([\s\S]*)$/);
            if (match) {
                reviewSource = match[1];
                score = match[2] === "—" ? null : match[2];
                notes = match[3];
            }
        } else if (m.notes.startsWith("Source:")) {
            const lines = m.notes.split("\n");
            let parsedSource = null;
            let parsedScore = null;
            let startIdx = 0;
            
            if (lines[0] && lines[0].startsWith("Source:")) {
                parsedSource = lines[0].substring(7).trim();
                startIdx = 1;
            }
            if (lines[1] && lines[1].startsWith("Score:")) {
                parsedScore = lines[1].substring(6).trim();
                startIdx = 2;
            }
            
            reviewSource = parsedSource || reviewSource;
            score = (parsedScore === "—" || parsedScore === null) ? null : parsedScore;
            notes = lines.slice(startIdx).join("\n").trim();
        }
    }

    return {
        ...m,
        questionText: m.question_text ?? m.questionText ?? "",
        latestUserAnswer: m.selected_answer ?? m.latestUserAnswer ?? m.userAnswer ?? "",
        userAnswer: m.selected_answer ?? m.userAnswer ?? "",
        correctAnswer: m.correct_answer ?? m.correctAnswer ?? "",
        latestResult: m.answer_status ?? m.latestResult ?? m.result ?? "",
        result: m.answer_status ?? m.result ?? "",
        sourceType: m.source_type ?? m.sourceType ?? "mains",
        nodeId: m.node_id ?? m.nodeId ?? "",
        createdAt: m.created_at ?? m.createdAt ?? null,
        updatedAt: m.updated_at ?? m.updatedAt ?? null,
        questionId: m.question_id ?? m.questionId ?? m.id,
        mustRevise: Boolean(m.must_revise ?? m.mustRevise),
        errorType: m.error_type ?? m.errorType ?? "other",
        notes: notes,
        stage: m.stage ?? "mains",
        paper: inferPaper(m),
        status: inferStatus(m),
        severity: inferSeverity(m),
        // Deserialized fields passed to card
        score: score,
        review_source: reviewSource,
        attemptId: m.attempt_id ?? m.source_ref ?? null,
        topic: m.topic ?? m.subject ?? "",
        mistakeType: m.mistake_type ?? m.error_type ?? "",
        mistakeText: m.mistake_text ?? notes,
    };
}

function buildWeakPatterns(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const counts = items.reduce((acc, item) => {
        const key = item.errorType || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const total = items.length;
    return Object.entries(counts)
        .map(([type, count]) => ({
            type,
            count,
            pct: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count);
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function Badge({ label, variant = "neutral", style: extra }) {
  const styles = {
    amber: { background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", color: "#f59e0b" },
    red:   { background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171" },
    green: { background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" },
    blue:  { background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#60a5fa" },
    neutral: { background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "#a1a1aa" },
  };
  const activeStyle = styles[variant] || styles.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      borderRadius: 6, padding: "2px 8px",
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.02em",
      fontFamily: T.font,
      ...activeStyle,
      ...extra,
    }}>{label}</span>
  );
}

function ActionButton({ onClick, disabled, variant = "ghost", children, style: extra }) {
  const [hover, setHover] = useState(false);

  const variantStyles = {
    primary: { background: "#f59e0b", color: "#09090b", border: "1px solid #f59e0b" },
    green:   { background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" },
    blue:    { background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#60a5fa" },
    red:     { background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" },
    ghost:   { background: "transparent", border: "1px solid #27272a", color: "#a1a1aa" },
  };

  const hoverStyles = {
    primary: { background: "#d97706", border: "1px solid #d97706" },
    green:   { background: "rgba(16, 185, 129, 0.16)", border: "1px solid rgba(16, 185, 129, 0.45)" },
    blue:    { background: "rgba(59, 130, 246, 0.16)", border: "1px solid rgba(59, 130, 246, 0.45)" },
    red:     { background: "rgba(239, 68, 68, 0.14)", border: "1px solid rgba(239, 68, 68, 0.3)" },
    ghost:   { background: "rgba(255, 255, 255, 0.04)", border: "1px solid #3f3f46", color: "#f4f4f5" },
  };

  const activeStyle = hover ? { ...variantStyles[variant], ...hoverStyles[variant] } : variantStyles[variant];

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 32, padding: "0 14px",
        borderRadius: 8, fontSize: 12, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: T.font,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        ...activeStyle,
        ...extra,
      }}>{children}</button>
  );
}

function FilterPill({ label, active, accent = T.purple, onClick }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                border: `1px solid ${active ? accent + "66" : hover ? "#3f3f46" : T.borderMid}`,
                background: active ? `${accent}18` : hover ? "rgba(255, 255, 255, 0.02)" : T.bg,
                color: active ? accent : T.dim,
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
    );
}

// ─── Local MainsMistakeCard Component ─────────────────────────────────────────

function LocalMainsMistakeCard({ mistake, onMarkResolved, onToggleMustRevise }) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const [textExpanded, setTextExpanded] = useState(false);
    
    const accent = PAPER_ACCENT[mistake.paper] || T.amber;
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

    const sourceLabel = mistake.review_source === "chatgpt_air1" || mistake.review_source === "chatgpt-air1" || mistake.review_source === "AIR-1"
        ? "AIR-1 Review" 
        : mistake.review_source === "gemini_basic" || mistake.review_source === "basic"
        ? "Basic Review"
        : "Basic Evaluation";

    const rawNotes = mistake.notes || "";
    let whyItMatters = "";
    let fixText = rawNotes;

    // Parse Why it matters and Fix notes
    if (rawNotes.includes("Why it matters:") && rawNotes.includes("Fix:")) {
        const match = rawNotes.match(/Why it matters:\s*([\s\S]*?)\nFix:\s*([\s\S]*)/i);
        if (match) {
            whyItMatters = match[1].trim();
            fixText = match[2].trim();
        }
    } else {
        const mType = mistake.mistakeType || mistake.errorType || "";
        const tpl = MISTAKE_TEMPLATES[mType] || MISTAKE_TEMPLATES.content_gap;
        whyItMatters = tpl.why;
        fixText = rawNotes || tpl.fix;
    }

    // Clean up weakness title
    let cleanMistakeText = (mistake.mistakeText || "").trim();
    cleanMistakeText = cleanMistakeText.replace(/^(weakness|missing dimension):\s*/i, "");

    const CLAMP = 180;
    const needsExpand = fixText.length > CLAMP;
    const displayFix  = textExpanded || !needsExpand ? fixText : fixText.slice(0, CLAMP) + "…";

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

    // Styling based on rules:
    // Must Revise = amber/gold accent
    // High Severity = red badge
    // Resolved = green
    let cardLeftBorder = `1px solid #27272a`;
    if (isResolved) {
        cardLeftBorder = `4px solid ${T.green}`;
    } else if (mistake.mustRevise) {
        cardLeftBorder = `4px solid ${T.amber}`;
    } else if (mistake.severity === "high") {
        // Red left accent for open high-severity mistakes
        cardLeftBorder = `4px solid ${T.red}`;
    }

    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${isResolved ? T.border : "rgba(255, 255, 255, 0.05)"}`,
            borderLeft: cardLeftBorder,
            borderRadius: 12,
            overflow: "hidden",
            opacity: isResolved ? 0.65 : 1,
            transition: "opacity 0.2s ease",
            padding: "16px 20px",
            fontFamily: T.font,
        }}>
            {/* Top Row: Meta badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge label={mistake.paper} variant="amber" />
                
                {mistake.marks && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, background: T.bg, padding: "2px 8px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                        {mistake.marks} Marks
                    </span>
                )}

                {mistake.score !== null && mistake.score !== undefined && (
                    <Badge label={`Score: ${mistake.score}`} variant="green" />
                )}

                {mistake.severity === "high" && (
                    <Badge label="High Severity" variant="red" />
                )}

                {mistake.mustRevise && (
                    <Badge label="Must Revise" variant="amber" />
                )}

                <span style={{ fontSize: 11, color: T.subtle, fontWeight: 600 }}>{sourceLabel}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.subtle, fontWeight: 600 }}>{dateStr}</span>
            </div>

            {/* Question Snippet */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    fontSize: 14, fontWeight: 500, color: T.text,
                    lineHeight: 1.6, marginBottom: 12,
                    cursor: "pointer",
                }}
            >
                {expanded ? questionText : questionSnippet}
                {questionText.length > 120 && (
                    <span style={{ color: T.amber, fontSize: 12, cursor: "pointer", marginLeft: 6, fontWeight: 600 }}>
                        {expanded ? "Show less" : "Read more"}
                    </span>
                )}
            </div>

            {/* Topic & Metadata */}
            {mistake.topic && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.subtle }}>
                        Topic: <span style={{ color: T.text }}>{mistake.topic}</span>
                    </span>
                </div>
            )}

            {/* Weakness summary */}
            {cleanMistakeText && (
                <div style={{
                    fontSize: 14, color: T.textBright, fontWeight: 700,
                    lineHeight: 1.5, marginBottom: 10,
                    display: "flex", gap: 8, alignItems: "flex-start"
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
                    fontSize: 13, color: T.dim, lineHeight: 1.6,
                    marginBottom: 12, paddingLeft: 14,
                    borderLeft: `2px solid rgba(245, 158, 11, 0.3)`
                }}>
                    <span style={{ color: T.amber, fontWeight: 700 }}>Why it matters: </span>
                    {whyItMatters}
                </div>
            )}

            {/* Fix Action */}
            {fixText && (
                <div style={{
                    fontSize: 13, color: T.textBright, lineHeight: 1.6,
                    padding: "10px 14px",
                    background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 8, marginBottom: 14,
                }}>
                    <span style={{ color: T.green, fontWeight: 700 }}>Fix: </span>
                    {displayFix}
                    {needsExpand && (
                        <button onClick={() => setTextExpanded(e => !e)} style={{
                            background: "none", border: "none", color: T.amber,
                            fontSize: 12, cursor: "pointer", marginLeft: 6, padding: 0,
                            fontFamily: T.font, fontWeight: 600,
                        }}>
                            {textExpanded ? "Show less" : "Expand"}
                        </button>
                    )}
                </div>
            )}

            {/* Actions Toolbar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                {!isResolved && (
                    <ActionButton variant="green" onClick={() => onMarkResolved?.(mistake.id)}>
                        ✓ Mark Resolved
                    </ActionButton>
                )}
                <ActionButton 
                    variant={mistake.mustRevise ? "primary" : "ghost"} 
                    onClick={() => onToggleMustRevise?.(mistake.id)}
                >
                    🔁 {mistake.mustRevise ? "Must Revise Selected" : "Must Revise"}
                </ActionButton>

                {(mistake.attemptId || mistake.source_ref) && (
                    <ActionButton variant="blue" onClick={handleViewAttempt}>
                        📝 Open Workspace
                    </ActionButton>
                )}
            </div>
        </div>
    );
}

// ─── Weak pattern bar ─────────────────────────────────────────────────────────

function WeakPatternBar({ patterns }) {
    if (!patterns.length) return null;
    const top5 = patterns.slice(0, 5);
    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "18px 20px",
            marginBottom: 24,
            fontFamily: T.font,
        }}>
            <div style={{ ...label11(T.dim), marginBottom: 12 }}>Top Weak Patterns</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {top5.map((p) => (
                    <div key={p.type}>
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            marginBottom: 6,
                        }}>
                            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                                {p.type.replace(/_/g, " ").replace(/ \w/g, c => c.toUpperCase())}
                            </span>
                            <span style={{ fontSize: 12, color: T.dim }}>
                                {p.count} times · {p.pct}%
                            </span>
                        </div>
                        <div style={{ height: 6, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                                height: "100%",
                                width: `${p.pct}%`,
                                background: p.pct > 60 ? T.red : p.pct > 30 ? T.amber : T.blue,
                                borderRadius: 4,
                                transition: "width 0.5s ease",
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Stats KPI card ───────────────────────────────────────────────────────────

function StatPill({ label, value, accent }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderTop: `3px solid ${accent || T.amber}`,
            borderRadius: 12, padding: "14px 18px",
            minWidth: 100, flex: "1 1 100px",
            fontFamily: T.font,
        }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: accent || T.textBright, lineHeight: 1 }}>
                {value}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.dim }}>
                {label}
            </span>
        </div>
    );
}

// ─── Attempt Group Card Component ──────────────────────────────────────────

function AttemptGroupCard({ group, expanded, onToggle, onMarkResolved, onToggleMustRevise, onOpenWorkspace }) {
    const accent = PAPER_ACCENT[group.paper] || T.purple;
    const isLegacy = !group.attemptId;
    const dateStr = group.createdAt
        ? new Date(group.createdAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })
        : "—";

    const cleanTitle = group.questionText.replace(/[\n\r]+/g, " ").trim();
    const shortTitle = cleanTitle.length > 70 ? cleanTitle.slice(0, 70) + "…" : cleanTitle;

    const sourceLabel = group.reviewSource === "chatgpt_air1" || group.reviewSource === "chatgpt-air1" || group.reviewSource === "AIR-1"
        ? "AIR-1 Review"
        : group.reviewSource === "gemini_basic" || group.reviewSource === "basic"
        ? "Basic Review"
        : "Evaluation";

    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `4px solid ${accent}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 14,
            transition: "all 0.2s ease",
            fontFamily: T.font,
        }}>
            {/* Header section (click to toggle) */}
            <div 
                onClick={onToggle}
                style={{
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                    flexWrap: "wrap",
                    gap: 12,
                    background: expanded ? T.surfaceHigh : "transparent",
                    transition: "background 0.2s",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Badge label={group.paper} variant="amber" />
                        
                        {!isLegacy && group.score && (
                            <Badge label={`Score: ${group.score}`} variant="green" />
                        )}
                        {!isLegacy && (
                            <span style={{
                                fontSize: 11, fontWeight: 600,
                                padding: "2px 8px", borderRadius: 6,
                                background: T.bg, border: `1px solid ${T.border}`,
                                color: T.dim,
                            }}>
                                {sourceLabel}
                            </span>
                        )}
                        <span style={{
                            fontSize: 11, fontWeight: 600,
                            padding: "2px 8px", borderRadius: 6,
                            background: `rgba(59, 130, 246, 0.08)`, border: `1px solid rgba(59, 130, 246, 0.25)`,
                            color: T.blue,
                        }}>
                            {group.mistakes.length} mistake{group.mistakes.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textBright, lineHeight: 1.4 }}>
                        {isLegacy ? "Legacy / Ungrouped Mistakes" : shortTitle}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {!isLegacy && (
                        <ActionButton
                            variant="blue"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenWorkspace?.(group);
                            }}
                        >
                            📝 Open Workspace
                        </ActionButton>
                    )}
                    <span style={{ fontSize: 12, color: T.subtle, fontWeight: 600 }}>
                        {!isLegacy ? dateStr : ""}
                    </span>
                    <span style={{ 
                        fontSize: 14, 
                        color: T.dim,
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        display: "inline-block"
                    }}>
                        ▼
                    </span>
                </div>
            </div>

            {/* Mistakes List Section */}
            {expanded && (
                <div style={{
                    padding: "20px",
                    background: T.bg,
                    borderTop: `1px solid ${T.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14
                }}>
                    {group.mistakes.map((m) => (
                        <LocalMainsMistakeCard
                            key={m.id}
                            mistake={m}
                            onMarkResolved={onMarkResolved}
                            onToggleMustRevise={onToggleMustRevise}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function MainsMistakeBookPage() {
    const navigate = useNavigate();
    const [mistakes, setMistakes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterPaper, setFilterPaper] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterSeverity, setFilterSeverity] = useState("All");
    const [filterMustRevise, setFilterMustRevise] = useState(false);

    // Expanded groups
    const [expandedAttempts, setExpandedAttempts] = useState({});

    const handleOpenWorkspace = useCallback((group) => {
        if (!group.attemptId) return;
        const firstMistake = group.mistakes[0] || {};
        navigate("/mains/answer-writing", {
            state: {
                attemptId: group.attemptId,
                isRestored: true,
                practiceMode: "typed",
                paper: group.paper,
                mode: "Custom",
                questions: [
                    {
                        question: group.questionText,
                        marks: firstMistake.marks || 15,
                        wordLimit: firstMistake.wordLimit || 200,
                        paper: group.paper,
                        year: firstMistake.year || null,
                        hint: group.topic || ""
                    }
                ],
                currentIndex: 0
            }
        });
    }, [navigate]);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(API_URL);
            const payload = await res.json();
            const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];

            const normalized = items
                .map(normalizeMistake)
                .filter((m) => (m.stage || "").toLowerCase() === "mains");

            setMistakes(normalized);
        } catch (error) {
            console.error("[MainsMistakeBookPage] fetch failed", error);
            setMistakes([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const patterns = useMemo(() => buildWeakPatterns(mistakes), [mistakes]);

    // Actions
    const handleMarkResolved = async (id) => {
        setMistakes((prev) => prev.map((m) => (m.id === id ? { ...m, status: "resolved" } : m)));
        try {
            await fetch(`${BACKEND_URL}/api/mistakes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "resolved" }),
            });
        } catch (error) {
            console.warn("[MainsMistakeBookPage] PATCH /resolved not available yet", error);
        }
    };

    const handleToggleMustRevise = async (id) => {
        let nextValue = false;
        setMistakes((prev) => prev.map((m) => {
            if (m.id !== id) return m;
            nextValue = !m.mustRevise;
            return { ...m, mustRevise: nextValue };
        }));
        try {
            await fetch(`${BACKEND_URL}/api/mistakes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ must_revise: nextValue }),
            });
        } catch (error) {
            console.warn("[MainsMistakeBookPage] PATCH /must_revise not available yet", error);
        }
    };

    // ── Filtering ──────────────────────────────────────────────────────────────
    const filtered = mistakes.filter((m) => {
        if (filterPaper !== "All" && m.paper !== filterPaper) return false;
        if (filterStatus !== "All" && m.status !== filterStatus) return false;
        if (filterSeverity !== "All" && m.severity !== filterSeverity) return false;
        if (filterMustRevise && !m.mustRevise) return false;
        return true;
    });

    // ── Grouping ───────────────────────────────────────────────────────────────
    const attemptGroups = useMemo(() => {
        const groups = {};
        filtered.forEach((m) => {
            const key = m.attemptId || m.source_ref || "legacy_ungrouped";
            if (!groups[key]) {
                groups[key] = {
                    attemptId: (m.attemptId || m.source_ref) ? (m.attemptId || m.source_ref) : null,
                    paper: m.paper || "GS1",
                    questionText: (m.attemptId || m.source_ref) ? (m.questionText || "Untitled Question") : "Legacy / Ungrouped Mistakes",
                    score: m.score || null,
                    createdAt: m.createdAt || null,
                    reviewSource: m.review_source || null,
                    mistakes: []
                };
            }
            if (groups[key].mistakes.length < 3) {
                groups[key].mistakes.push(m);
            }
        });

        return Object.values(groups).sort((a, b) => {
            if (a.attemptId === null) return 1;
            if (b.attemptId === null) return -1;
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [filtered]);

    // ── Top Must Revise ────────────────────────────────────────────────────────
    const topMustRevise = useMemo(() => {
        let list = mistakes.filter(m => m.status === "open");
        if (filterPaper !== "All") {
            list = list.filter(m => m.paper === filterPaper);
        }

        const typeCounts = {};
        list.forEach(m => {
            const t = m.mistakeType || m.errorType || "";
            if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
        });

        const scored = list.map(m => {
            let score = 0;
            if (m.severity === "high") score += 50;
            if (m.mustRevise) score += 30;

            if (m.score !== null && m.score !== undefined) {
                const sStr = String(m.score);
                const match = sStr.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
                if (match) {
                    const num = parseFloat(match[1]);
                    const den = parseFloat(match[2]);
                    if (den > 0 && (num / den) < 0.45) score += 20;
                } else {
                    const num = parseFloat(sStr);
                    if (!isNaN(num) && num < 5) score += 20;
                }
            }

            const t = m.mistakeType || m.errorType || "";
            const count = typeCounts[t] || 0;
            if (count > 1) {
                score += Math.min(count * 5, 20);
            }

            return { mistake: m, priorityScore: score };
        });

        return scored
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .map(x => x.mistake)
            .slice(0, 5);
    }, [mistakes, filterPaper]);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const total = mistakes.length;
    const open = mistakes.filter(m => m.status === "open").length;
    const resolved = mistakes.filter(m => m.status === "resolved").length;
    const mustReviseCount = mistakes.filter(m => m.mustRevise).length;
    const highSev = mistakes.filter(m => m.severity === "high").length;

    const toggleAttemptExpand = (key) => {
        setExpandedAttempts(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

            {/* ── Sticky Top Bar ────────────────────────────────────────────── */}
            <div style={{
                borderBottom: `1px solid ${T.border}`,
                padding: "14px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: T.bg, position: "sticky", top: 0, zIndex: 20,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={label11(T.dim)}>Mains</span>
                    <span style={{ color: T.borderMid, fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright }}>
                        Mistake Book
                    </span>
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: "4px 12px", borderRadius: 20,
                    border: `1px solid ${T.red}33`,
                    color: T.red, background: "rgba(239, 68, 68, 0.08)",
                    letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                    {open} Open Mistakes
                </span>
            </div>

            <div style={{ padding: "32px 24px 60px", maxWidth: 900, margin: "0 auto" }}>

                {/* ── Page Heading ─────────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{
                        fontSize: 28, fontWeight: 800, color: T.textBright,
                        margin: "0 0 8px 0", letterSpacing: "-0.02em",
                    }}>
                        Mains Mistake Book
                    </h1>
                    <p style={{ fontSize: 14, color: T.dim, margin: 0, lineHeight: 1.6 }}>
                        Your answer writing mistakes, grouped by attempt — track patterns and improve.
                    </p>
                </div>

                {/* ── KPI Stats Cards Grid ──────────────────────────────────────── */}
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24,
                }}>
                    <StatPill label="Total Recorded" value={total} accent={T.textBright} />
                    <StatPill label="Open Mistakes" value={open} accent={T.amber} />
                    <StatPill label="Resolved" value={resolved} accent={T.green} />
                    <StatPill label="Must Revise" value={mustReviseCount} accent={T.purple} />
                    <StatPill label="High Severity" value={highSev} accent={T.red} />
                </div>

                {/* ── Weak pattern bar chart ─────────────────────────────────────── */}
                {total > 0 && <WeakPatternBar patterns={patterns} />}

                {/* ── Top Priority Must Revise section ─────────────────────────── */}
                {!loading && topMustRevise.length > 0 && (
                    <div style={{
                        background: "rgba(245, 158, 11, 0.02)",
                        border: `1px solid rgba(245, 158, 11, 0.15)`,
                        borderLeft: `4px solid ${T.amber}`,
                        borderRadius: 12,
                        padding: "20px",
                        marginBottom: 28,
                    }}>
                        <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between", 
                            marginBottom: 16,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <h2 style={{
                                    fontSize: 15, fontWeight: 700, color: T.textBright,
                                    margin: 0, letterSpacing: "-0.01em"
                                }}>
                                    ⚑ Top Priority to Revise
                                </h2>
                            </div>
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                padding: "3px 10px", borderRadius: 12,
                                background: "rgba(245, 158, 11, 0.08)", color: T.amber,
                                border: `1px solid rgba(245, 158, 11, 0.2)`,
                            }}>
                                {topMustRevise.length} Items Pending
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {topMustRevise.map((m) => (
                                <LocalMainsMistakeCard
                                    key={`top-${m.id}`}
                                    mistake={m}
                                    onMarkResolved={handleMarkResolved}
                                    onToggleMustRevise={handleToggleMustRevise}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Filter Controls Panel ─────────────────────────────────────── */}
                <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: "18px 20px", marginBottom: 24,
                    display: "flex", flexDirection: "column", gap: 12,
                }}>
                    {/* Paper filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.05em" }}>Paper</span>
                        {["All", "GS1", "GS2", "GS3", "Essay", "Ethics", "Geography Optional"].map(p => (
                            <FilterPill
                                key={p}
                                label={p}
                                active={filterPaper === p}
                                accent={PAPER_ACCENT[p] || T.purple}
                                onClick={() => setFilterPaper(p)}
                            />
                        ))}
                    </div>

                    {/* Status filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
                        {[
                            { key: "All", label: "All", accent: T.purple },
                            { key: "open", label: "Open", accent: T.amber },
                            { key: "resolved", label: "Resolved", accent: T.green },
                        ].map(s => (
                            <FilterPill
                                key={s.key}
                                label={s.label}
                                active={filterStatus === s.key}
                                accent={s.accent}
                                onClick={() => setFilterStatus(s.key)}
                            />
                        ))}
                    </div>

                    {/* Severity filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.05em" }}>Severity</span>
                        {[
                            { key: "All", label: "All", accent: T.purple },
                            { key: "low", label: "Low", accent: T.green },
                            { key: "medium", label: "Medium", accent: T.amber },
                            { key: "high", label: "High", accent: T.red },
                        ].map(s => (
                            <FilterPill
                                key={s.key}
                                label={s.label}
                                active={filterSeverity === s.key}
                                accent={s.accent}
                                onClick={() => setFilterSeverity(s.key)}
                            />
                        ))}
                    </div>

                    {/* Must revise toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.05em" }}>Show</span>
                        <FilterPill
                            label="Must Revise Only"
                            active={filterMustRevise}
                            accent={T.amber}
                            onClick={() => setFilterMustRevise(!filterMustRevise)}
                        />
                    </div>
                </div>

                {/* ── Count Label ─────────────────────────────────────────────── */}
                <div style={{
                    fontSize: 12, color: T.subtle, marginBottom: 16,
                    fontWeight: 600, letterSpacing: "0.02em",
                }}>
                    {loading ? "Loading..." : `${attemptGroups.length} attempt group${attemptGroups.length !== 1 ? "s" : ""}${filtered.length !== total ? ` (filtered from ${total} mistakes)` : ""}`}
                </div>

                {/* ── Empty State Indicator ────────────────────────────────────── */}
                {!loading && attemptGroups.length === 0 && (
                    <div style={{
                        background: T.surface,
                        border: `1px dashed ${T.borderMid}`,
                        borderRadius: 14,
                        padding: "48px 24px",
                        textAlign: "center",
                    }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T.textBright, marginBottom: 6 }}>
                            {total === 0 ? "No mistakes logged yet" : "No results match your filters"}
                        </div>
                        <div style={{ fontSize: 13, color: T.dim, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
                            {total === 0
                                ? "Write and review answers in the Mains workspace to build your mistake book."
                                : "Try adjusting the filters above."}
                        </div>
                    </div>
                )}

                {/* ── Grouped Attempt Cards List ────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {attemptGroups.map((group) => {
                        const key = group.attemptId || "legacy_ungrouped";
                        return (
                            <AttemptGroupCard
                                key={key}
                                group={group}
                                expanded={Boolean(expandedAttempts[key])}
                                onToggle={() => toggleAttemptExpand(key)}
                                onMarkResolved={handleMarkResolved}
                                onToggleMustRevise={handleToggleMustRevise}
                                onOpenWorkspace={handleOpenWorkspace}
                            />
                        );
                    })}
                </div>

            </div>
        </div>
    );
}
