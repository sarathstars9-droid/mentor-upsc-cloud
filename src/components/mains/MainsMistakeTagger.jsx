// src/components/mains/MainsMistakeTagger.jsx
// Self-review mistake tagger — appears after saving an answer attempt.
// Allows the aspirant to tag mistake types, severity, notes, and push to Mistake Book.

import React, { useState } from "react";
import { saveMainsMistake } from "../../utils/mainsMistakeEngine";

// ─── Theme (matches AnswerWritingPage) ────────────────────────────────────────
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

// ─── Mistake type catalogue ───────────────────────────────────────────────────
const MISTAKE_TYPES = [
    { key: "weak_intro",                label: "Weak Intro",              icon: "📝" },
    { key: "weak_body_flow",            label: "Weak Body Flow",          icon: "🔀" },
    { key: "weak_conclusion",           label: "Weak Conclusion",         icon: "🏁" },
    { key: "no_subheadings",            label: "No Subheadings",          icon: "📋" },
    { key: "missing_dimensions",        label: "Missing Dimensions",      icon: "📐" },
    { key: "weak_examples",             label: "Weak Examples",           icon: "💡" },
    { key: "factual_gap",              label: "Factual Gap",             icon: "❌" },
    { key: "poor_question_understanding", label: "Poor Q Understanding", icon: "❓" },
    { key: "too_short",                 label: "Too Short",               icon: "📏" },
    { key: "too_lengthy",               label: "Too Lengthy",             icon: "📜" },
    { key: "time_overrun",              label: "Time Overrun",            icon: "⏰" },
    { key: "incomplete_attempt",        label: "Incomplete Attempt",      icon: "⚠️" },
    { key: "vague_language",            label: "Vague Language",          icon: "🌫️" },
    { key: "repetitive_expression",     label: "Repetitive Expression",   icon: "🔁" },
    { key: "low_clarity",               label: "Low Clarity",             icon: "🔍" },
    { key: "poor_formatting",           label: "Poor Formatting",         icon: "🧱" },
];

const SEVERITY_OPTIONS = [
    { key: "low",    label: "Low",    color: T.green },
    { key: "medium", label: "Medium", color: T.amber },
    { key: "high",   label: "High",   color: T.red },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function MainsMistakeTagger({ attemptData, onMistakeSaved }) {
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [severity, setSeverity] = useState("medium");
    const [notes, setNotes] = useState("");
    const [mustRevise, setMustRevise] = useState(false);
    const [savedOk, setSavedOk] = useState(false);

    const toggleType = (key) => {
        setSelectedTypes((prev) =>
            prev.includes(key)
                ? prev.filter((k) => k !== key)
                : [...prev, key]
        );
    };

    const handleSave = () => {
        if (!selectedTypes.length) return;
        const entry = saveMainsMistake({
            attemptId:     attemptData?.id        || null,
            paper:         attemptData?.paper      || "GS1",
            mode:          attemptData?.mode       || "PYQ",
            marks:         attemptData?.marks      || "15",
            year:          attemptData?.year       || null,
            question:      attemptData?.question   || "",
            answerText:    attemptData?.answerText  || "",
            wordCount:     attemptData?.wordCount  || 0,
            targetWords:   attemptData?.targetWords || 200,
            timeSpentSec:  attemptData?.timeSpentSec || 0,
            mistakeTypes:  selectedTypes,
            severity,
            notes,
            mustRevise,
            source:        "self_review",
        });
        setSavedOk(true);
        onMistakeSaved?.(entry);
    };

    if (savedOk) {
        return (
            <div style={{
                background: T.surface,
                border: `1px solid ${T.green}33`,
                borderRadius: 14,
                padding: "24px",
                textAlign: "center",
            }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.green, marginBottom: 4 }}>
                    Mistake logged to Mistake Book
                </div>
                <div style={{ fontSize: 12, color: T.dim }}>
                    {selectedTypes.length} tag{selectedTypes.length > 1 ? "s" : ""} · {severity} severity
                    {mustRevise && " · Must Revise"}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            overflow: "hidden",
        }}>
            {/* Accent bar */}
            <div style={{
                height: 2,
                background: `linear-gradient(90deg, ${T.red}, ${T.amber}44, ${T.border})`,
            }} />

            <div style={{ padding: "20px 24px" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>🔍</span>
                    <span style={{
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.11em", textTransform: "uppercase",
                        color: T.red,
                    }}>
                        Self-Review · Mistake Tagger
                    </span>
                </div>
                <div style={{ fontSize: 12, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>
                    Tag the areas you think were weak in this attempt. This builds your personal Mains Mistake Pattern Book.
                </div>

                {/* ── Mistake type chips ─────────────────────────────────────────────── */}
                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: T.subtle, marginBottom: 10,
                }}>
                    Mistake Types
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {MISTAKE_TYPES.map((mt) => {
                        const active = selectedTypes.includes(mt.key);
                        return (
                            <button
                                key={mt.key}
                                onClick={() => toggleType(mt.key)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    fontSize: 11, fontWeight: 700,
                                    fontFamily: T.font,
                                    cursor: "pointer",
                                    border: `1px solid ${active ? T.red + "66" : T.borderMid}`,
                                    background: active ? `${T.red}18` : T.bg,
                                    color: active ? T.red : T.dim,
                                    transition: "all 0.15s",
                                    letterSpacing: "0.02em",
                                }}
                            >
                                <span style={{ fontSize: 13 }}>{mt.icon}</span>
                                {mt.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Severity selector ──────────────────────────────────────────────── */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    marginBottom: 20,
                }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: T.subtle,
                    }}>
                        Severity
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                        {SEVERITY_OPTIONS.map((s) => {
                            const active = severity === s.key;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => setSeverity(s.key)}
                                    style={{
                                        padding: "5px 16px",
                                        borderRadius: 8,
                                        fontSize: 11, fontWeight: 800,
                                        fontFamily: T.font,
                                        cursor: "pointer",
                                        border: `1px solid ${active ? s.color + "66" : T.borderMid}`,
                                        background: active ? `${s.color}18` : T.bg,
                                        color: active ? s.color : T.dim,
                                        transition: "all 0.15s",
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Must revise toggle ─────────────────────────────────────────────── */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    marginBottom: 20,
                }}>
                    <button
                        onClick={() => setMustRevise(!mustRevise)}
                        style={{
                            width: 40, height: 22, borderRadius: 11,
                            border: "none",
                            background: mustRevise ? T.amber : T.muted,
                            position: "relative",
                            cursor: "pointer",
                            transition: "background 0.2s",
                        }}
                    >
                        <div style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: "#fff",
                            position: "absolute",
                            top: 3,
                            left: mustRevise ? 21 : 3,
                            transition: "left 0.2s",
                        }} />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: mustRevise ? T.amber : T.dim }}>
                        🔁 Must Revise
                    </span>
                </div>

                {/* ── Notes ──────────────────────────────────────────────────────────── */}
                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: T.subtle, marginBottom: 8,
                }}>
                    Notes (optional)
                </div>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="What specifically went wrong? What will you improve next time?"
                    style={{
                        width: "100%", boxSizing: "border-box",
                        background: T.bg,
                        border: `1px solid ${T.borderMid}`,
                        borderRadius: 10,
                        color: T.text, fontSize: 12,
                        lineHeight: 1.7, padding: "12px 14px",
                        fontFamily: T.font, resize: "vertical",
                        outline: "none",
                        marginBottom: 20,
                    }}
                />

                {/* ── Action row ─────────────────────────────────────────────────────── */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        onClick={handleSave}
                        disabled={!selectedTypes.length}
                        style={{
                            background: selectedTypes.length ? T.red : T.muted,
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 900, fontSize: 13,
                            padding: "11px 26px",
                            cursor: selectedTypes.length ? "pointer" : "not-allowed",
                            fontFamily: T.font,
                            letterSpacing: "0.04em",
                            opacity: selectedTypes.length ? 1 : 0.45,
                        }}
                    >
                        📌 Add to Mistake Book
                    </button>
                    <span style={{ fontSize: 11, color: T.subtle }}>
                        {selectedTypes.length
                            ? `${selectedTypes.length} tag${selectedTypes.length > 1 ? "s" : ""} selected`
                            : "Select at least one mistake type"}
                    </span>
                </div>
            </div>
        </div>
    );
}
