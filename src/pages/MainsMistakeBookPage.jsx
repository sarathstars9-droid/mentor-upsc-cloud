// src/pages/MainsMistakeBookPage.jsx
// Mains Mistake Book — view, filter, and resolve mains writing mistakes.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";
import "../styles/mentorosPremium.css";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    bg: "#0E1117",
    surface: "#171B23",
    surfaceHigh: "#1C2230",
    border: "rgba(255,255,255,0.08)",
    text: "#F5F7FB",
    textMuted: "#7F8897",
    textSec: "#B8C0CC",
    accent: "#D6B56D",
    success: "#2FBF71",
    danger: "#E05252",
    font: "Inter, Manrope, Aptos, system-ui, sans-serif",
};

const PAPER_ACCENT = {
    All: "#8b5cf6",
    GS1: "#D6B56D",
    GS2: "#3b82f6",
    GS3: "#2FBF71",
    Essay: "#8b5cf6",
    Ethics: "#D6B56D",
    "Geography Optional": "#3b82f6",
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

const PATTERN_DRILLS = {
    ethics_example_missing: "Review the model ethics answers database and write down 5 real-life administrator stories.",
    question_demand_mismatch: "Take 3 test questions, underline their directive keywords, and write structure bullet points for each.",
    weak_conclusion: "Practice drafting positive futuristic way forwards for 5 previous years' GS questions.",
    missing_data_or_reports: "Memorize 10 key NITI Aayog/ARC recommendations and practice inserting them into answers.",
    diagram_or_map_missing: "Practice drawing quick schematic value maps and 30-second India outlines.",
    weak_introduction: "Draft current-affairs context definitions for 5 governance questions.",
    content_gap: "Brainstorm political, social, economic, environmental aspects for 5 past topics.",
    weak_structure: "Outline 3 case studies using bold, clear subheadings for each actor involved.",
    weak_analysis: "List pros and cons with supporting data points for 3 major policies.",
    essay_flow_issue: "Write logical paragraph connectors linking themes in a mock essay.",
    optional_concept_gap: "Summarize 3 theoretical optional concepts using technical vocabulary.",
    presentation_issue: "Set a 15-minute timer and practice clean presentation layout on ruled paper.",
    missing_examples: "Build an example bank with 10 case-studies of administrative interventions."
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
  const cName = variant === "amber" ? "premium-badge-paper" : 
                variant === "red" ? "premium-badge-danger" : 
                variant === "green" ? "premium-badge-success" : 
                "premium-badge-neutral";
  return (
    <span className={`premium-badge ${cName}`} style={extra}>
      {label}
    </span>
  );
}

function FilterPill({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`premium-pill-button ${active ? "active" : ""}`}
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

    const rawNotes = mistake.notes || "";
    let whyItMatters = "";
    let fixText = rawNotes;

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

    let leftBorderColor = "transparent";
    let cardBorder = "1px solid rgba(255,255,255,0.08)";
    if (isResolved) {
        leftBorderColor = T.success;
    } else if (mistake.mustRevise) {
        leftBorderColor = T.accent;
    } else if (mistake.severity === "high") {
        leftBorderColor = T.danger;
    }

    return (
        <div 
            className="premium-surface-card" 
            style={{
                border: cardBorder,
                borderLeft: leftBorderColor !== "transparent" ? `4px solid ${leftBorderColor}` : cardBorder,
                opacity: isResolved ? 0.65 : 1,
                padding: "22px 28px",
            }}
        >
            {/* Top Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="premium-metadata" style={{ color: T.textSec, fontWeight: 600 }}>
                    {mistake.paper} • <span style={{ color: T.textMuted }}>{dateStr}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {mistake.score !== null && mistake.score !== undefined && (
                        <span style={{ fontSize: 11, color: T.success, background: "rgba(47, 191, 113, 0.08)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                            {mistake.score}
                        </span>
                    )}
                    <span style={{ fontSize: 11.5, color: T.textMuted }}>Review</span>
                </div>
            </div>

            {/* Question Snippet */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    fontSize: 14.5, fontWeight: 550, color: T.textSec,
                    lineHeight: 1.55, marginBottom: 12,
                    cursor: "pointer",
                }}
            >
                {expanded ? questionText : questionSnippet}
                {questionText.length > 120 && (
                    <span style={{ color: T.accent, fontSize: 13, marginLeft: 6, fontWeight: 600 }}>
                        {expanded ? "Show less" : "Read more"}
                    </span>
                )}
            </div>

            {/* Weakness summary */}
            {cleanMistakeText && (
                <div style={{
                    fontSize: 15.5, color: T.text, fontWeight: 700,
                    lineHeight: 1.45, marginBottom: 12,
                    display: "flex", gap: 8, alignItems: "flex-start"
                }}>
                    <span style={{ color: leftBorderColor !== "transparent" ? leftBorderColor : T.accent }}>⚠️</span>
                    <div>
                        <span style={{ color: T.textMuted, fontWeight: 550 }}>Mistake: </span>
                        {cleanMistakeText}
                    </div>
                </div>
            )}

            {/* Why this improves marks */}
            {whyItMatters && (
                <div style={{
                    fontSize: 14.5, color: T.textSec, lineHeight: 1.6,
                    marginBottom: 12, paddingLeft: 12,
                    borderLeft: `2px solid rgba(214, 181, 109, 0.3)`
                }}>
                    <span style={{ color: T.accent, fontWeight: 600 }}>Why this improves marks: </span>
                    {whyItMatters}
                </div>
            )}

            {/* Do this */}
            {fixText && (
                <div className="premium-surface-card-inner" style={{ padding: "14px 16px", marginBottom: 16 }}>
                    <div className="premium-body" style={{ color: T.text, fontSize: 14.5 }}>
                        <span style={{ color: T.success, fontWeight: 600 }}>Do this: </span>
                        {displayFix}
                        {needsExpand && (
                            <button 
                                onClick={() => setTextExpanded(e => !e)} 
                                className="premium-text-link"
                                style={{ marginLeft: 6, padding: 0, textDecoration: "none", color: T.accent }}
                            >
                                {textExpanded ? "Show less" : "Expand"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Actions Toolbar */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 4 }}>
                {!isResolved && (
                    <button 
                        onClick={() => onMarkResolved?.(mistake.id)}
                        className="premium-button-primary"
                        style={{ fontSize: 13, padding: "8px 16px", height: "auto" }}
                    >
                        Resolve
                    </button>
                )}
                
                <button 
                    onClick={() => onToggleMustRevise?.(mistake.id)}
                    className="premium-button-secondary"
                    style={{ fontSize: 13, padding: "8px 16px", height: "auto" }}
                >
                    {mistake.mustRevise ? "Must revise first" : "Must revise"}
                </button>

                {(mistake.attemptId || mistake.source_ref) && (
                    <button 
                        onClick={handleViewAttempt}
                        className="premium-text-link"
                        style={{ fontSize: 13, border: "none", background: "none" }}
                    >
                        Open answer
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Weak Pattern Cards Grid ───────────────────────────────────────────────────

function WeakPatternCardsGrid({ patterns, mistakes }) {
    if (!patterns.length) return null;
    const top5 = patterns.slice(0, 5);
    
    return (
        <div style={{ marginBottom: 36 }}>
            <h2 className="premium-section-title">Your top weak patterns</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                {top5.map((p) => {
                    const cleanName = p.type === "ethics_example_missing" ? "Missing Ethics Examples" :
                                      p.type === "question_demand_mismatch" ? "Directive Mismatch" :
                                      p.type === "weak_conclusion" ? "Weak Conclusion" :
                                      p.type === "missing_data_or_reports" ? "Missing Reports/Data" :
                                      p.type === "diagram_or_map_missing" ? "Diagram/Map Missing" :
                                      p.type.replace(/_/g, " ").replace(/ \w/g, c => c.toUpperCase());
                    
                    const drill = PATTERN_DRILLS[p.type] || "Practice drafting answers with standard templates.";
                    
                    // Find latest paper for this pattern
                    const patternMistakes = mistakes.filter(m => m.errorType === p.type);
                    const latestMistake = patternMistakes[0];
                    const latestPaper = latestMistake ? latestMistake.paper : "GS1";

                    return (
                        <div key={p.type} className="premium-surface-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <h3 className="premium-card-title" style={{ fontSize: 16.5, margin: 0, color: T.accent }}>
                                        {cleanName}
                                    </h3>
                                    <span className="premium-metadata" style={{ color: T.text, background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                                        {p.count}x
                                    </span>
                                </div>
                                <div className="premium-metadata" style={{ marginBottom: 14, color: T.textMuted }}>
                                    Latest: <span style={{ color: T.textSec }}>{latestPaper}</span>
                                </div>

                                <div className="premium-surface-card-inner" style={{ padding: "14px", marginBottom: 16, background: "rgba(214, 181, 109, 0.03)", borderColor: "rgba(214, 181, 109, 0.12)" }}>
                                    <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                                        Suggested Drill
                                    </div>
                                    <div className="premium-body" style={{ fontSize: 13.5, color: T.text, lineHeight: 1.45 }}>
                                        {drill}
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar indicator */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span className="premium-metadata" style={{ fontSize: 11, color: T.textMuted }}>Impact level</span>
                                    <span className="premium-metadata" style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>{p.pct}%</span>
                                </div>
                                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
                                    <div style={{ height: 5, borderRadius: 999, background: T.accent, width: `${p.pct}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
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

    return (
        <div 
            className="premium-surface-card" 
            style={{
                border: `1px solid rgba(255,255,255,0.08)`,
                borderLeft: `4px solid ${accent}`,
                padding: 0,
                marginBottom: 14,
            }}
        >
            <div 
                onClick={onToggle}
                style={{
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                    background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Badge label={group.paper} variant="neutral" />
                        
                        {!isLegacy && group.score && (
                            <span style={{ fontSize: 11, color: T.success, background: "rgba(47, 191, 113, 0.08)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                                {group.score}
                            </span>
                        )}
                        <span className="premium-metadata" style={{ color: T.accent }}>
                            {group.mistakes.length} mistake{group.mistakes.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>
                        {isLegacy ? "Legacy / Ungrouped Mistakes" : shortTitle}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {!isLegacy && (
                        <button
                            className="premium-button-secondary"
                            style={{ padding: "6px 14px", fontSize: 12.5 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenWorkspace?.(group);
                            }}
                        >
                            Open answer
                        </button>
                    )}
                    <span className="premium-metadata" style={{ color: T.textMuted }}>
                        {!isLegacy ? dateStr : ""}
                    </span>
                    <span style={{ 
                        fontSize: 14, 
                        color: T.textMuted,
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        display: "inline-block"
                    }}>
                        ▼
                    </span>
                </div>
            </div>

            {expanded && (
                <div style={{
                    padding: "22px 24px",
                    background: "rgba(0,0,0,0.1)",
                    borderTop: `1px solid rgba(255,255,255,0.06)`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16
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

    const [filterPaper, setFilterPaper] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterSeverity, setFilterSeverity] = useState("All");
    const [filterMustRevise, setFilterMustRevise] = useState(false);

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

    const handleMarkResolved = async (id) => {
        setMistakes((prev) => prev.map((m) => (m.id === id ? { ...m, status: "resolved" } : m)));
        try {
            await fetch(`${BACKEND_URL}/api/mistakes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "resolved" }),
            });
        } catch (error) {
            console.warn("[MainsMistakeBookPage] PATCH /resolved failed", error);
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
            console.warn("[MainsMistakeBookPage] PATCH /must_revise failed", error);
        }
    };

    const filtered = mistakes.filter((m) => {
        if (filterPaper !== "All" && m.paper !== filterPaper) return false;
        if (filterStatus !== "All" && m.status !== filterStatus) return false;
        if (filterSeverity !== "All" && m.severity !== filterSeverity) return false;
        if (filterMustRevise && !m.mustRevise) return false;
        return true;
    });

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

            {/* Sticky Top Bar */}
            <div style={{
                borderBottom: `1px solid ${T.border}`,
                padding: "14px 32px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: T.bg, position: "sticky", top: 0, zIndex: 20,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="premium-metadata" style={{ color: T.textMuted }}>Mains</span>
                    <span style={{ color: "rgba(255,255,255,0.06)", fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                        Mistake Book
                    </span>
                </div>
                <span className="premium-badge premium-badge-danger">
                    {open} Open Mistakes
                </span>
            </div>

            <div className="premium-container">

                {/* Page Heading */}
                <div style={{ marginBottom: 36 }}>
                    <h1 className="premium-page-title">
                        Mains Mistake Book
                    </h1>
                    <p className="premium-page-subtitle" style={{ margin: 0 }}>
                        Your answer writing mistakes, grouped by attempt — track patterns and improve.
                    </p>
                </div>

                {/* Weak Pattern Cards Grid */}
                {total > 0 && <WeakPatternCardsGrid patterns={patterns} mistakes={mistakes} />}

                {/* Top Priority Must Revise section */}
                {!loading && topMustRevise.length > 0 && (
                    <div style={{
                        background: "rgba(214, 181, 109, 0.02)",
                        border: `1px solid rgba(214, 181, 109, 0.18)`,
                        borderLeft: `4px solid ${T.accent}`,
                        borderRadius: 20,
                        padding: "24px 28px",
                        marginBottom: 36,
                    }}>
                        <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between", 
                            marginBottom: 20,
                        }}>
                            <h2 className="premium-section-title" style={{ margin: 0, color: T.text }}>
                                Must revise first
                            </h2>
                            <span className="premium-badge premium-badge-paper">
                                {topMustRevise.length} Items Pending
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

                {/* Filter Controls Panel */}
                <div className="premium-surface-card" style={{ padding: "24px", marginBottom: "36px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="premium-metadata" style={{ minWidth: 80 }}>Paper</span>
                        <div className="premium-pill-group">
                            {["All", "GS1", "GS2", "GS3", "Essay", "Ethics", "Geography Optional"].map(v => (
                                <FilterPill
                                    key={v}
                                    label={v}
                                    active={filterPaper === v}
                                    onClick={() => setFilterPaper(v)}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="premium-metadata" style={{ minWidth: 80 }}>Status</span>
                        <div className="premium-pill-group">
                            {[
                                { key: "All", label: "All" },
                                { key: "open", label: "Open" },
                                { key: "resolved", label: "Resolved" },
                            ].map(s => (
                                <FilterPill
                                    key={s.key}
                                    label={s.label}
                                    active={filterStatus === s.key}
                                    onClick={() => setFilterStatus(s.key)}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="premium-metadata" style={{ minWidth: 80 }}>Severity</span>
                        <div className="premium-pill-group">
                            {[
                                { key: "All", label: "All" },
                                { key: "low", label: "Low" },
                                { key: "medium", label: "Medium" },
                                { key: "high", label: "High" },
                            ].map(s => (
                                <FilterPill
                                    key={s.key}
                                    label={s.label}
                                    active={filterSeverity === s.key}
                                    onClick={() => setFilterSeverity(s.key)}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="premium-metadata" style={{ minWidth: 80 }}>Show</span>
                        <div className="premium-pill-group">
                            <FilterPill
                                label="All Items"
                                active={!filterMustRevise}
                                onClick={() => setFilterMustRevise(false)}
                            />
                            <FilterPill
                                label="Must revise first"
                                active={filterMustRevise}
                                onClick={() => setFilterMustRevise(true)}
                            />
                        </div>
                    </div>
                </div>

                {/* Count Label */}
                <div className="premium-metadata" style={{ marginBottom: 16, color: T.textMuted }}>
                    {loading ? "Loading..." : `Recent answer attempts (${attemptGroups.length} attempts found)`}
                </div>

                {/* Grouped Attempt Cards List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
