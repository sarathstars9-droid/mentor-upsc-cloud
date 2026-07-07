// src/pages/MainsMistakeBookPage.jsx
// Mains Mistake Book — view, filter, and resolve mains writing mistakes.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MainsMistakeCard from "../components/mains/MainsMistakeCard";
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
    dim: "#71717a",
    text: "#d4d4d8",
    textBright: "#f4f4f5",
    amber: "#f59e0b",
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#8b5cf6",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
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

// ─── Filter pill button ───────────────────────────────────────────────────────
function FilterPill({ label, active, accent = T.purple, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 11, fontWeight: 700,
                fontFamily: T.font,
                cursor: "pointer",
                border: `1px solid ${active ? accent + "55" : T.borderMid}`,
                background: active ? `${accent}18` : T.bg,
                color: active ? accent : T.dim,
                transition: "all 0.15s",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
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
            padding: "16px 20px",
            marginBottom: 24,
        }}>
            <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Top Weak Patterns</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {top5.map((p) => (
                    <div key={p.type}>
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            marginBottom: 4,
                        }}>
                            <span style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>
                                {p.type.replace(/_/g, " ").replace(/\w/g, c => c.toUpperCase())}
                            </span>
                            <span style={{ fontSize: 11, color: T.dim }}>
                                {p.count} times · {p.pct}%
                            </span>
                        </div>
                        <div style={{ height: 4, background: T.muted, borderRadius: 4, overflow: "hidden" }}>
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

// ─── Stats row ────────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderTop: `3px solid ${accent || T.amber}`,
            borderRadius: 10, padding: "12px 18px",
            minWidth: 90, flex: "1 1 80px",
        }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: accent || T.textBright, lineHeight: 1 }}>
                {value}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.dim }}>
                {label}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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
    const shortTitle = cleanTitle.length > 60 ? cleanTitle.slice(0, 60) + "…" : cleanTitle;

    const sourceLabel = group.reviewSource === "chatgpt_air1"
        ? "AIR-1 Review"
        : group.reviewSource === "gemini_basic"
        ? "Gemini Basic"
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
        }}>
            {/* Header section (click to toggle) */}
            <div 
                onClick={onToggle}
                style={{
                    padding: "16px 20px",
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
                        <span style={{
                            fontSize: 10, fontWeight: 900, color: accent,
                            background: `${accent}15`, border: `1px solid ${accent}33`,
                            borderRadius: 5, padding: "2px 8px",
                            letterSpacing: "0.06em",
                        }}>
                            {group.paper}
                        </span>
                        {!isLegacy && group.score && (
                            <span style={{
                                fontSize: 10, fontWeight: 800, color: T.green,
                                background: `${T.green}15`, border: `1px solid ${T.green}33`,
                                borderRadius: 5, padding: "2px 8px",
                            }}>
                                Score: {group.score}
                            </span>
                        )}
                        {!isLegacy && (
                            <span style={{
                                fontSize: 10, fontWeight: 700,
                                padding: "2px 8px", borderRadius: 4,
                                background: T.bg, border: `1px solid ${T.border}`,
                                color: T.dim,
                            }}>
                                Source: {sourceLabel}
                            </span>
                        )}
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "2px 8px", borderRadius: 4,
                            background: `${T.blue}11`, border: `1px solid ${T.blue}33`,
                            color: T.blue,
                        }}>
                            {group.mistakes.length} mistake{group.mistakes.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright }}>
                        {isLegacy ? "Legacy / Ungrouped Mistakes" : shortTitle}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {!isLegacy && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenWorkspace?.(group);
                            }}
                            style={{
                                background: `${accent}18`,
                                border: `1px solid ${accent}44`,
                                borderRadius: 7,
                                padding: "4px 12px",
                                fontSize: 10,
                                fontWeight: 700,
                                color: accent,
                                cursor: "pointer",
                                fontFamily: T.font,
                            }}
                        >
                            📝 Open Workspace
                        </button>
                    )}
                    <span style={{ fontSize: 11, color: T.subtle, fontWeight: 600 }}>
                        {!isLegacy ? dateStr : ""}
                    </span>
                    <span style={{ 
                        fontSize: 16, 
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
                        <MainsMistakeCard
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

// ─── Main Page ────────────────────────────────────────────────────────────────
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

    // ── Grouping (Main correction 5: Group mistakes by answer attempt) ──────────
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
            // limit to max 3 mistakes per group
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

    // ── Top Must Revise (Main correction 5: Top Must Revise section) ───────────
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

            {/* ── Top bar ──────────────────────────────────────────────────────── */}
            <div style={{
                borderBottom: `1px solid ${T.border}`,
                padding: "14px 28px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: T.bg, position: "sticky", top: 0, zIndex: 20,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={label11(T.subtle)}>Mains</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright }}>
                        Mistake Book
                    </span>
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: "4px 12px", borderRadius: 20,
                    border: `1px solid ${T.red}33`,
                    color: T.red, background: `${T.red}11`,
                    letterSpacing: "0.07em", textTransform: "uppercase",
                }}>
                    {open} Open
                </span>
            </div>

            <div style={{ padding: "24px 28px 48px", maxWidth: 900, margin: "0 auto" }}>

                {/* ── Page heading ─────────────────────────────────────────────── */}
                <div style={{ marginBottom: 26 }}>
                    <h1 style={{
                        fontSize: 26, fontWeight: 800, color: T.textBright,
                        margin: "0 0 6px 0", letterSpacing: "-0.02em",
                    }}>
                        Mains Mistake Book
                    </h1>
                    <p style={{ fontSize: 14, color: T.dim, margin: 0, lineHeight: 1.6 }}>
                        Your answer writing mistakes, grouped by attempt — track patterns and improve.
                    </p>
                </div>

                {/* ── Stats row ────────────────────────────────────────────────── */}
                <div style={{
                    display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24,
                }}>
                    <StatPill label="Total" value={total} accent={T.textBright} />
                    <StatPill label="Open" value={open} accent={T.amber} />
                    <StatPill label="Resolved" value={resolved} accent={T.green} />
                    <StatPill label="Must Revise" value={mustReviseCount} accent={T.purple} />
                    <StatPill label="High Severity" value={highSev} accent={T.red} />
                </div>

                {/* ── Weak pattern bar ─────────────────────────────────────────── */}
                {total > 0 && <WeakPatternBar patterns={patterns} />}

                {/* ── Top Must Revise Section ─────────────────────────────────── */}
                {!loading && topMustRevise.length > 0 && (
                    <div style={{
                        background: `${T.amber}06`,
                        border: `1px solid ${T.amber}22`,
                        borderLeft: `4px solid ${T.amber}`,
                        borderRadius: 12,
                        padding: "20px 24px",
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
                                fontSize: 10, fontWeight: 700,
                                padding: "3px 10px", borderRadius: 12,
                                background: `${T.amber}18`, color: T.amber,
                                border: `1px solid ${T.amber}44`,
                                letterSpacing: "0.04em",
                            }}>
                                {topMustRevise.length} items
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {topMustRevise.map((m) => (
                                <MainsMistakeCard
                                    key={`top-${m.id}`}
                                    mistake={m}
                                    onMarkResolved={handleMarkResolved}
                                    onToggleMustRevise={handleToggleMustRevise}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Filters ──────────────────────────────────────────────────── */}
                <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: "16px 20px", marginBottom: 24,
                    display: "flex", flexDirection: "column", gap: 10,
                }}>
                    {/* Paper filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, textTransform: "uppercase", letterSpacing: "0.04em" }}>Paper</span>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</span>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, textTransform: "uppercase", letterSpacing: "0.04em" }}>Severity</span>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, textTransform: "uppercase", letterSpacing: "0.04em" }}>Show</span>
                        <FilterPill
                            label="Must Revise Only"
                            active={filterMustRevise}
                            accent={T.amber}
                            onClick={() => setFilterMustRevise(!filterMustRevise)}
                        />
                    </div>
                </div>

                {/* ── Result count ─────────────────────────────────────────────── */}
                <div style={{
                    fontSize: 11, color: T.subtle, marginBottom: 16,
                    fontWeight: 600, letterSpacing: "0.04em",
                }}>
                    {loading ? "Loading..." : `${attemptGroups.length} attempt group${attemptGroups.length !== 1 ? "s" : ""}${filtered.length !== total ? ` (filtered from ${total} mistakes)` : ""}`}
                </div>

                {/* ── Empty state ──────────────────────────────────────────────── */}
                {!loading && attemptGroups.length === 0 && (
                    <div style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        padding: "48px 24px",
                        textAlign: "center",
                    }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.textBright, marginBottom: 6 }}>
                            {total === 0 ? "No mistakes logged yet" : "No results match your filters"}
                        </div>
                        <div style={{ fontSize: 12, color: T.dim }}>
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
