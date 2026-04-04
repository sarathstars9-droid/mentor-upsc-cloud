// src/pages/MainsMistakeBookPage.jsx
// Mains Mistake Book — view, filter, and resolve mains writing mistakes.

import React, { useState, useEffect, useCallback } from "react";
import {
    getAllMainsMistakes,
    markMainsMistakeResolved,
    toggleMustRevise,
    getMainsWeakPatterns,
} from "../utils/mainsMistakeEngine";
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
                                {p.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
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
    const [patterns, setPatterns] = useState([]);

    // Filters
    const [filterPaper, setFilterPaper] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterSeverity, setFilterSeverity] = useState("All");
    const [filterMustRevise, setFilterMustRevise] = useState(false);

    const reload = useCallback(() => {
        setMistakes(getAllMainsMistakes());
        setPatterns(getMainsWeakPatterns());
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // Actions
    const handleMarkResolved = (id) => {
        markMainsMistakeResolved(id);
        reload();
    };

    const handleToggleMustRevise = (id) => {
        toggleMustRevise(id);
        reload();
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
    const total     = mistakes.length;
    const open      = mistakes.filter(m => m.status === "open").length;
    const resolved  = mistakes.filter(m => m.status === "resolved").length;
    const mustReviseCount = mistakes.filter(m => m.mustRevise).length;
    const highSev   = mistakes.filter(m => m.severity === "high").length;

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
                    <StatPill label="Total"       value={total}          accent={T.textBright} />
                    <StatPill label="Open"         value={open}           accent={T.amber}      />
                    <StatPill label="Resolved"     value={resolved}       accent={T.green}      />
                    <StatPill label="Must Revise"  value={mustReviseCount} accent={T.purple}     />
                    <StatPill label="High Severity" value={highSev}       accent={T.red}        />
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
                            { key: "All",      label: "All",      accent: T.purple },
                            { key: "open",     label: "Open",     accent: T.amber  },
                            { key: "resolved", label: "Resolved", accent: T.green  },
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
                            { key: "All",    label: "All",    accent: T.purple },
                            { key: "low",    label: "Low",    accent: T.green  },
                            { key: "medium", label: "Medium", accent: T.amber  },
                            { key: "high",   label: "High",   accent: T.red    },
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
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    {filtered.length !== total ? ` (filtered from ${total})` : ""}
                </div>

                {/* ── Empty state ──────────────────────────────────────────────── */}
                {filtered.length === 0 && (
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
