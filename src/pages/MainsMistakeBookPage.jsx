// src/pages/MainsMistakeBookPage.jsx
// Mains Mistake Book — view, filter, and resolve mains writing mistakes.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import MainsMistakeCard from "../components/mains/MainsMistakeCard";

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

const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
});

const PAPER_ACCENT = { GS1: T.amber, GS2: T.blue, GS3: T.green, All: T.purple };
const API_URL = "http://localhost:8787/api/mistakes?userId=user_1";

function inferPaper(mistake) {
    if (mistake.paper) return String(mistake.paper).toUpperCase();
    if (mistake.paper_type) return String(mistake.paper_type).toUpperCase();
    if (mistake.source_ref) {
        const ref = String(mistake.source_ref).toUpperCase();
        if (ref.includes("GS1")) return "GS1";
        if (ref.includes("GS2")) return "GS2";
        if (ref.includes("GS3")) return "GS3";
        if (ref.includes("GS4")) return "GS4";
        if (ref.includes("ESSAY")) return "ESSAY";
        if (ref.includes("ETHICS")) return "GS4";
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
        notes: m.notes ?? "",
        stage: m.stage ?? "mains",
        paper: inferPaper(m),
        status: inferStatus(m),
        severity: inferSeverity(m),
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
            display: "flex", flexDirection: "column", gap: 3,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10, padding: "10px 18px",
            minWidth: 90,
        }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.subtle }}>
                {label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: accent || T.textBright }}>
                {value}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsMistakeBookPage() {
    const [mistakes, setMistakes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterPaper, setFilterPaper] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterSeverity, setFilterSeverity] = useState("All");
    const [filterMustRevise, setFilterMustRevise] = useState(false);

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
            await fetch(`http://localhost:8787/api/mistakes/${id}`, {
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
            await fetch(`http://localhost:8787/api/mistakes/${id}`, {
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

    // ── Stats ──────────────────────────────────────────────────────────────────
    const total = mistakes.length;
    const open = mistakes.filter(m => m.status === "open").length;
    const resolved = mistakes.filter(m => m.status === "resolved").length;
    const mustReviseCount = mistakes.filter(m => m.mustRevise).length;
    const highSev = mistakes.filter(m => m.severity === "high").length;

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
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{
                        fontSize: 24, fontWeight: 900, color: T.textBright,
                        margin: "0 0 6px 0", letterSpacing: "-0.02em",
                    }}>
                        Mains Mistake Book
                    </h1>
                    <p style={{ fontSize: 13, color: T.dim, margin: 0 }}>
                        Self-tagged answer writing mistakes · personal weak-pattern tracker
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

                {/* ── Filters ──────────────────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>

                    {/* Paper filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ ...label11(T.subtle), fontSize: 9, width: 52 }}>Paper</span>
                        {["All", "GS1", "GS2", "GS3"].map(p => (
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
                        <span style={{ ...label11(T.subtle), fontSize: 9, width: 52 }}>Status</span>
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
                        <span style={{ ...label11(T.subtle), fontSize: 9, width: 52 }}>Severity</span>
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
                        <span style={{ ...label11(T.subtle), fontSize: 9, width: 52 }}>Filter</span>
                        <FilterPill
                            label="🔁 Must Revise Only"
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
                    {loading ? "Loading..." : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}${filtered.length !== total ? ` (filtered from ${total})` : ""}`}
                </div>

                {/* ── Empty state ──────────────────────────────────────────────── */}
                {!loading && filtered.length === 0 && (
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

                {/* ── Mistake card list ─────────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {filtered.map((m) => (
                        <MainsMistakeCard
                            key={m.id}
                            mistake={m}
                            onMarkResolved={handleMarkResolved}
                            onToggleMustRevise={handleToggleMustRevise}
                        />
                    ))}
                </div>

            </div>
        </div>
    );
}
