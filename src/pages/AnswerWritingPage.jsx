// src/pages/AnswerWritingPage.jsx
// Mains Answer Writing Workspace — v5
// UPSC-accurate timer: 10M=6min · 15M=9min
// Reads route state: { mode, paper, year, topic, syllabusNodeId, questions, currentIndex }
// Prev/Next navigates within the passed questions array.

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainsMistakeTagger from "../components/mains/MainsMistakeTagger";
import MainsReviewPromptCard from "../components/mains/MainsReviewPromptCard";
import MainsPasteReviewCard from "../components/mains/MainsPasteReviewCard";
import MainsReviewResultCard from "../components/mains/MainsReviewResultCard";
import Air1PremiumReport from "../components/mains/air1Review/Air1PremiumReport";
import Air1ReviewMode from "../components/mains/air1Review/Air1ReviewMode";
import { parseAir1ReviewJson } from "../lib/mains/parseAir1ReviewJson.js";
import { downloadAir1ReviewPdf } from "../utils/downloadAir1ReviewPdf";
import {
    saveMainsAttempt,
    saveMainsReview,
    processMainsReview,
    getMainsReviewResult,
    evaluateMainsAnswerApi,
    extractAnswerFromImagesApi,
    extractQuestionAnswerFromImagesApi,
    saveMainsAttemptToDB,
    fetchLatestMainsAttemptForQuestion,
} from "../utils/mainsReviewApi.js";

function extractQuestionText(value) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(extractQuestionText).filter(Boolean).join(" ").trim();
    if (typeof value === "object") {
        return extractQuestionText(
            value.question ||
            value.questionText ||
            value.question_text ||
            value.text ||
            value.title ||
            ""
        );
    }
    return String(value).trim();
}

function normalizeQuestionText(value) {
    return extractQuestionText(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function hashQuestionKey(value) {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

function buildQuestionKey({ paper, year, questionText }) {
    const normalizedQuestion = normalizeQuestionText(questionText);
    const normalizedPaper = String(paper || "GS1").trim().toLowerCase();
    const normalizedYear = String(year || "").trim().toLowerCase();
    const slug = normalizedQuestion.slice(0, 80).replace(/\s+/g, "-") || "unknown-question";
    return [normalizedPaper, normalizedYear || "unknown-year", hashQuestionKey(normalizedQuestion), slug].join(":");
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const darkTokens = {
    // Core palette: Deep navy-charcoal AI workspace
    bg: "#070B14",
    surface: "#111827",
    surfaceHigh: "#131A2B",
    border: "#1E293B",
    borderMid: "#334155",
    muted: "#475569",
    subtle: "#64748B",
    dim: "#94A3B8",
    text: "#E2E8F0",
    textBright: "#F8FAFC",
    // Accent palette
    primaryAccent: "#4F7CFF",
    secondaryAccent: "#5B8CFF",
    tertiaryAccent: "#3B82F6",
    // Existing semantic colors
    amber: "#F59E0B",
    amberDim: "#D97706",
    blue: "#3B82F6",
    green: "#10B981",
    red: "#EF4444",
    purple: "#8B5CF6",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    btnText: "#09090b",
    innerGlow: "rgba(79, 124, 255, 0.04)",
    shadow: "rgba(0, 0, 0, 0.3)",
    primaryGradient: "linear-gradient(135deg, #3B82F6, #4F7CFF)",
    improvedBg: "#0B1020",
    improvedText: "#4F7CFF",
};

const lightTokens = {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceHigh: "#F1F5F9",
    border: "#E2E8F0",
    borderMid: "#CBD5E1",
    muted: "#94A3B8",
    subtle: "#64748B",
    dim: "#475569",
    text: "#0F172A",
    textBright: "#020617",
    primaryAccent: "#2563EB",
    secondaryAccent: "#4F46E5",
    tertiaryAccent: "#3B82F6",
    amber: "#D97706",
    amberDim: "#B45309",
    blue: "#2563EB",
    green: "#059669",
    red: "#DC2626",
    purple: "#7C3AED",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    btnText: "#ffffff",
    innerGlow: "rgba(255,255,255,0.6)",
    shadow: "rgba(37, 99, 235, 0.12)",
    primaryGradient: "linear-gradient(135deg, #2563EB, #4F46E5)",
    improvedBg: "#D1FAE5",
    improvedText: "#065F46",
};

let T = { ...darkTokens };

// ─── UPSC-accurate time limits (10M=6min · 15M=9min) ─────────────────────────
const TIME_LIMITS = { "10": 6 * 60, "15": 9 * 60 };
const WORD_TARGETS = { "10": 150, "15": 200 };

const getPaperAccent = (paper) => ({
    GS1: T.amber,
    GS2: T.blue,
    GS3: T.green,
    GS4: T.purple,
}[paper] || T.amber);

// ─── Fallback when page opened without route state ───────────────────────────
const FALLBACK_QUESTIONS = [
    {
        question:
            "Explain how the women's question was central to the 19th-century Indian renaissance. Discuss the role of social reformers in transforming the condition of women in Indian society.",
        marks: 15,
        year: 2023,
        focus: "Colonial impact on women — social reform context",
        structure: "Intro + 4–5 pts + Concl",
        priority: "UPSC PYQ · High Priority",
        subparts: [],
    },
];

// ─── ChatGPT extraction prompt ────────────────────────────────────────────────
const CHATGPT_EXTRACTION_PROMPT = `I am uploading photos of my handwritten UPSC mains answer sheets, possibly across multiple pages.
Extract the handwritten answer into clean editable text.

Rules:
1. Preserve the original wording as closely as possible.
2. Maintain paragraph breaks, numbering, bullets, headings, and page order.
3. Combine all uploaded pages into one continuous answer in the correct sequence.
4. Do not improve grammar or rewrite sentences.
5. Do not evaluate the answer.
6. Do not summarize.
7. If any word is unreadable, write [unclear].
8. Return only the extracted answer text.

This is for answer review, so accuracy matters more than polish.`;

// ─── Build ChatGPT evaluation prompt ─────────────────────────────────────────
function buildEvalPrompt(question, marks, wordTarget, extractedAnswer) {
    return `You are a strict UPSC Mains evaluator. Evaluate the following answer strictly as per UPSC standards.

QUESTION:
${question}

MARKS: ${marks} | WORD TARGET: ~${wordTarget} words

CANDIDATE'S ANSWER:
${extractedAnswer}

Evaluate on these dimensions:
1. Introduction — Contextual and crisp?
2. Content Coverage — Are all key dimensions addressed?
3. Analytical Depth — Analysis, not just description?
4. Structure — Logical flow with appropriate headings/bullets?
5. Conclusion — Forward-looking and decisive?
6. Word Discipline — Within the expected range?

Provide:
- Score: X / ${marks}
- Strengths (2–3 bullets)
- Weaknesses (2–3 bullets)
- One critical improvement tip
- Verdict: Below Average / Average / Good / Excellent

Be direct and strict. No softening.`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_PAGES = 5;

// ─── Attempt statuses ─────────────────────────────────────────────────────────
const STATUSES = {
    IDLE: "Ready",
    COUNTDOWN: "Starting…",
    RUNNING: "In Progress",
    PAUSED: "Paused",
    DONE: "Time Up",
    UPLOADED: "Pages Uploaded",
    PROMPT_COPIED: "Prompt Copied",
    TEXT_PASTED: "Text Pasted",
    SAVED: "Saved",
};

// ─── Audio bell ───────────────────────────────────────────────────────────────
function ringBell(times = 3) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const ring = (delayMs) => {
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.8);
                gain.gain.setValueAtTime(0.6, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.9);
            }, delayMs);
        };
        for (let i = 0; i < times; i++) ring(i * 950);
    } catch (e) {
        void e;
    }
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
});

const outlineBtn = (accent, disabled = false) => ({
    background: "transparent", color: disabled ? T.muted : accent,
    border: `1px solid ${disabled ? T.border : accent + "44"}`, borderRadius: 8,
    fontWeight: 600, fontSize: 13, padding: "10px 20px",
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: T.font,
    letterSpacing: "0.03em", whiteSpace: "nowrap", opacity: disabled ? 0.45 : 1,
});

const primaryBtn = (accent, disabled = false) => ({
    background: disabled ? T.muted : T.primaryGradient,
    color: "#ffffff", border: "none", borderRadius: 8,
    fontWeight: 900, fontSize: 13, padding: "11px 26px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.font, letterSpacing: "0.04em",
    opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
});

// ─── Micro-components ─────────────────────────────────────────────────────────
function InfoPill({ label, value, accent }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            background: `linear-gradient(145deg, ${T.surfaceHigh}, ${T.bg})`, 
            border: `1px solid ${T.borderMid}`,
            borderRadius: 10, padding: "10px 16px", minWidth: 72,
            boxShadow: `inset 0 1px 0 ${T.innerGlow}`
        }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent || T.textBright, letterSpacing: "0.02em" }}>{value}</span>
        </div>
    );
}

function StatusChip({ status }) {
    const color =
        status === STATUSES.SAVED ? T.green
            : status === STATUSES.TEXT_PASTED ? T.green
                : status === STATUSES.PROMPT_COPIED ? T.purple
                    : status === STATUSES.UPLOADED ? T.blue
                        : status === STATUSES.RUNNING ? T.amber
                            : status === STATUSES.PAUSED ? T.dim
                                : status === STATUSES.DONE ? T.red
                                    : status === STATUSES.COUNTDOWN ? T.amber
                                        : T.subtle;
    return (
        <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "4px 12px", borderRadius: 20,
            border: `1px solid ${color}33`,
            color, background: `${color}11`,
            letterSpacing: "0.07em", textTransform: "uppercase",
        }}>
            {status}
        </span>
    );
}

function SectionCard({ accentTop, children, style: extraStyle = {} }) {
    return (
        <div style={{
            background: `linear-gradient(180deg, ${T.surface}, ${T.bg})`,
            border: `1px solid ${T.borderMid}`,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: `0 8px 32px ${T.shadow}, inset 0 1px 0 ${T.innerGlow}`,
            transition: "transform 0.2s, box-shadow 0.2s",
            ...extraStyle,
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
        onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
            {accentTop && (
                <div style={{
                    height: 4,
                    background: `linear-gradient(90deg, ${accentTop}, ${accentTop}88, transparent)`,
                    boxShadow: `0 2px 8px ${accentTop}40`
                }} />
            )}
            {children}
        </div>
    );
}

function LockedCard({ title, message }) {
    return (
        <div style={{
            background: `linear-gradient(145deg, ${T.surfaceHigh}, ${T.bg})`, 
            border: `1px solid ${T.borderMid}`, borderRadius: 12, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, opacity: 0.9,
            boxShadow: `inset 0 1px 0 ${T.innerGlow}`
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 18, filter: "grayscale(100%)", opacity: 0.5 }}>🔒</span>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, letterSpacing: "0.02em" }}>{title}</div>
                    <div style={{ fontSize: 12, color: T.dim }}>{message}</div>
                </div>
            </div>
            <div style={{ 
                fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                color: T.dim, background: `${T.dim}15`, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.dim}33`
            }}>
                Locked
            </div>
        </div>
    );
}

// ─── Mains Intelligence Card ──────────────────────────────────────────────────
function MainsIntelligenceCard({ refreshTrigger }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchIntel() {
            setLoading(true);
            try {
                const [sumRes, recRes] = await Promise.all([
                    fetch("http://localhost:8787/api/mains-patterns/weakness-summary?userId=moulika"),
                    fetch("http://localhost:8787/api/mains-patterns/recommendations?userId=moulika")
                ]);
                const sumData = await sumRes.json();
                const recData = await recRes.json();
                
                if (isMounted && sumData.success && recData.success) {
                    setData({
                        summary: sumData,
                        recommendations: recData.recommendations
                    });
                }
            } catch (e) {
                console.error("Failed to fetch Mains Intelligence", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchIntel();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    if (loading && !data) return null;

    if (!data || data.summary.totalEvaluations === 0 || !data.summary.weaknessSummary?.length) {
        return (
            <SectionCard accentTop={T.purple}>
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 24 }}>🧠</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, marginBottom: 4 }}>Mains Intelligence</div>
                        <div style={{ fontSize: 13, color: T.dim }}>Write and evaluate a few answers to unlock Mains Intelligence.</div>
                    </div>
                </div>
            </SectionCard>
        );
    }

    const { summary, recommendations } = data;
    const top3Weaknesses = (summary.weaknessSummary || []).slice(0, 3);
    const top3Drills = (recommendations || []).slice(0, 3);
    const focusThisWeek = top3Drills[0] || null;

    const averageScoreRaw = summary?.averageScore;
    const hasAverageScore = averageScoreRaw !== null && averageScoreRaw !== undefined;
    const averageScoreDisplay = !hasAverageScore ? "—" : (typeof averageScoreRaw === "string" && averageScoreRaw.includes("/")) ? averageScoreRaw : `${averageScoreRaw}/10`;

    const lastEvaluatedTs = (summary.weaknessSummary || []).reduce((latest, item) => {
        const ts = item?.lastSeen ? Date.parse(item.lastSeen) : NaN;
        if (Number.isNaN(ts)) return latest;
        return Math.max(latest, ts);
    }, Number.NEGATIVE_INFINITY);
    const lastEvaluatedDisplay = Number.isFinite(lastEvaluatedTs)
        ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: new Date(lastEvaluatedTs).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(lastEvaluatedTs))
        : "—";

    const severityTone = {
        low: { color: T.blue, bg: `${T.blue}15`, border: `${T.blue}40` },
        medium: { color: T.amber, bg: `${T.amber}1a`, border: `${T.amber}44` },
        high: { color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.35)" },
        critical: { color: T.red, bg: `${T.red}1a`, border: `${T.red}44` },
        default: { color: T.dim, bg: `${T.dim}14`, border: `${T.dim}33` },
    };

    const confidenceTone = {
        emerging: { color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)", border: "rgba(14, 165, 233, 0.34)" },
        probable: { color: T.amber, bg: `${T.amber}1a`, border: `${T.amber}44` },
        confirmed: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.14)", border: "rgba(34, 197, 94, 0.35)" },
        default: { color: T.dim, bg: `${T.dim}14`, border: `${T.dim}33` },
    };

    return (
        <SectionCard accentTop={T.blue}>
            <div 
                style={{ padding: isExpanded ? "24px 28px" : "16px 20px", cursor: isExpanded ? "default" : "pointer", transition: "padding 0.2s" }}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isExpanded ? 24 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{
                            width: isExpanded ? 38 : 32, height: isExpanded ? 38 : 32, borderRadius: 10,
                            background: `linear-gradient(135deg, ${T.primaryAccent}33, #7C3AED33)`,
                            border: `1px solid ${T.primaryAccent}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: isExpanded ? 18 : 16, boxShadow: `0 0 20px ${T.primaryAccent}25`,
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        }}>
                            ✨
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: isExpanded ? 18 : 16, fontWeight: 900, color: T.textBright, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                                AI Mentor Command Center
                            </span>
                            {isExpanded && <span style={{ fontSize: 11, color: T.primaryAccent, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>AIR-1 Intelligence Active</span>}
                        </div>
                    </div>

                    {!isExpanded && focusThisWeek && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flex: 1, minWidth: 0, marginLeft: 20, overflow: "hidden" }}>
                            <span style={{ color: T.textBright, fontWeight: 800, flexShrink: 0, padding: "4px 12px", background: `linear-gradient(145deg, ${T.surfaceHigh}, ${T.bg})`, border: `1px solid ${T.borderMid}`, borderRadius: 12, boxShadow: `inset 0 1px 0 ${T.innerGlow}` }}>
                                ⚡ Focus: {focusThisWeek.focusArea}
                            </span>
                            {top3Weaknesses.slice(0, 2).map((w, i) => (
                                <span key={i} style={{ 
                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120,
                                    color: (severityTone[w.severity] || severityTone.default).color, 
                                    background: (severityTone[w.severity] || severityTone.default).bg, 
                                    border: `1px solid ${(severityTone[w.severity] || severityTone.default).border}`, 
                                    padding: "4px 12px", borderRadius: 12, fontWeight: 700, flexShrink: 0,
                                    boxShadow: `0 2px 8px ${(severityTone[w.severity] || severityTone.default).color}15`
                                }}>
                                    {w.weakness}
                                </span>
                            ))}
                            <span style={{ color: T.dim, fontWeight: 600, flexShrink: 0, borderLeft: `1px solid ${T.borderMid}`, paddingLeft: 8 }}>
                                +{top3Drills.length} Drills
                            </span>
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                        {isExpanded ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 16, background: `linear-gradient(145deg, ${T.surfaceHigh}, ${T.bg})`, padding: "8px 16px", borderRadius: 10, border: `1px solid ${T.borderMid}`, boxShadow: `inset 0 1px 0 ${T.innerGlow}` }}>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: T.subtle, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Score</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: T.primaryAccent }}>{averageScoreDisplay}</div>
                                </div>
                                <div style={{ width: 1, height: 24, background: T.border }} />
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: T.subtle, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Evaluations</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: T.textBright }}>{summary.totalEvaluations}</div>
                                </div>
                                <div style={{ width: 1, height: 24, background: T.border }} />
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: T.subtle, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Last Evaluated</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{lastEvaluatedDisplay}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "right", borderRight: `1px solid ${T.borderMid}`, paddingRight: 12 }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontSize: 9, color: T.subtle, fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>Avg</span>
                                    <span style={{ fontSize: 12, fontWeight: 900, color: T.primaryAccent, lineHeight: 1, marginTop: 2 }}>{averageScoreDisplay}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontSize: 9, color: T.subtle, fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>Evals</span>
                                    <span style={{ fontSize: 12, fontWeight: 900, color: T.textBright, lineHeight: 1, marginTop: 2 }}>{summary.totalEvaluations}</span>
                                </div>
                            </div>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                            style={{ 
                                background: "transparent", border: `1px solid ${T.borderMid}`, color: isExpanded ? T.dim : T.primaryAccent, 
                                fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 10px", borderRadius: 6
                            }}
                        >
                            {isExpanded ? "Collapse ↑" : "Expand ↓"}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        {focusThisWeek && (
                            <div style={{
                                marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 12,
                                background: `linear-gradient(90deg, ${T.primaryAccent}1a, ${T.primaryAccent}08)`, border: `1px solid ${T.primaryAccent}33`,
                                boxShadow: `inset 0 1px 0 ${T.primaryAccent}15`, borderRadius: 12, padding: "14px 16px",
                            }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.surface, border: `1px solid ${T.primaryAccent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>⚡</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.primaryAccent }}>Focus This Week</div>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${T.primaryAccent}15`, color: T.primaryAccent }}>PRIORITY</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}><span style={{ fontWeight: 700, color: T.textBright }}>{focusThisWeek.focusArea}: </span>{focusThisWeek.recommendedExercise}</div>
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                            <div style={{ flex: "1 1 280px" }}>
                                <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Primary Weaknesses</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {top3Weaknesses.map((w, i) => {
                                        const basicEvaluation = w?.sources?.basicEvaluation ?? w?.basicEvaluation ?? w?.count ?? 0;
                                        const air1Review = w?.sources?.air1Review ?? w?.air1Review ?? 0;
                                        const isCritical = w.severity === "high" || w.severity === "critical";
                                        return (
                                            <div key={i} style={{ 
                                                background: `linear-gradient(180deg, ${T.surface}, ${T.bg})`, border: `1px solid ${isCritical ? severityTone[w.severity].border : T.borderMid}`, 
                                                boxShadow: isCritical ? `0 4px 16px ${severityTone[w.severity].color}25` : `inset 0 1px 0 ${T.innerGlow}, 0 2px 8px rgba(0,0,0,0.2)`,
                                                padding: "16px 20px", borderRadius: 12, position: "relative", overflow: "hidden"
                                            }}>
                                                {isCritical && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: severityTone[w.severity].color, boxShadow: `0 0 12px ${severityTone[w.severity].color}` }} />}
                                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                                    <span style={{ fontSize: 14, color: T.textBright, fontWeight: 800, lineHeight: 1.4, letterSpacing: "-0.01em" }}>{w.weakness}</span>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: (severityTone[w.severity] || severityTone.default).color, background: (severityTone[w.severity] || severityTone.default).bg, border: `1px solid ${(severityTone[w.severity] || severityTone.default).border}`, padding: "4px 8px", borderRadius: 6 }}>{w.severity}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                                                    <div style={{ display: "flex", gap: 16 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: T.muted }} /><span style={{ fontSize: 11, color: T.dim, fontWeight: 700 }}>Basic: {basicEvaluation}</span></div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primaryAccent, boxShadow: `0 0 8px ${T.primaryAccent}` }} /><span style={{ fontSize: 11, color: T.text, fontWeight: 800 }}>AIR-1: {air1Review}</span></div>
                                                    </div>
                                                    
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <div style={{ display: "flex", gap: 3 }}>
                                                            <div style={{ width: 4, height: 12, borderRadius: 2, background: (confidenceTone[w.confidenceLevel] || confidenceTone.default).color, opacity: w.confidenceLevel === "emerging" || w.confidenceLevel === "probable" || w.confidenceLevel === "confirmed" ? 1 : 0.2 }} />
                                                            <div style={{ width: 4, height: 12, borderRadius: 2, background: (confidenceTone[w.confidenceLevel] || confidenceTone.default).color, opacity: w.confidenceLevel === "probable" || w.confidenceLevel === "confirmed" ? 1 : 0.2 }} />
                                                            <div style={{ width: 4, height: 12, borderRadius: 2, background: (confidenceTone[w.confidenceLevel] || confidenceTone.default).color, opacity: w.confidenceLevel === "confirmed" ? 1 : 0.2, boxShadow: w.confidenceLevel === "confirmed" ? `0 0 8px ${(confidenceTone[w.confidenceLevel] || confidenceTone.default).color}` : "none" }} />
                                                        </div>
                                                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", color: (confidenceTone[w.confidenceLevel] || confidenceTone.default).color }}>
                                                            {w.confidenceLevel || "emerging"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ flex: "1 1 280px" }}>
                                <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Recommended Drills</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {top3Drills.map((d, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: `linear-gradient(145deg, ${T.primaryAccent}08, transparent)`, border: `1px solid ${T.primaryAccent}22`, padding: "12px 14px", borderRadius: 10 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${T.primaryAccent}11`, border: `1px solid ${T.primaryAccent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>🎯</div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: T.primaryAccent, letterSpacing: "0.02em", marginBottom: 4 }}>{d.focusArea}</div>
                                                <div style={{ fontSize: 13, color: T.textBright, lineHeight: 1.5 }}>{d.recommendedExercise}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </SectionCard>
    );
}

// ─── Timer component ──────────────────────────────────────────────────────────
function Timer({ marks, accent, autoStart = false, onStatusChange, timerRef }) {
    const timeLimit = TIME_LIMITS[marks] || TIME_LIMITS["15"];
    const [phase, setPhase] = useState("idle");
    const [countdown, setCountdown] = useState(5);
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef(null);
    const bellFired = useRef(false);
    const domRef = useRef(null);

    useEffect(() => {
        if (timerRef) timerRef.current = domRef.current;
    }, [timerRef]);

    useEffect(() => {
        if (autoStart && phase === "idle") {
            setCountdown(5);
            setPhase("countdown");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    const remaining = Math.max(timeLimit - elapsed, 0);
    const overTime = elapsed > timeLimit;
    const pct = Math.min((elapsed / timeLimit) * 100, 100);

    const fmt = (s) => {
        const m = Math.floor(Math.abs(s) / 60).toString().padStart(2, "0");
        const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
        return `${m}:${sec}`;
    };

    useEffect(() => {
        if (phase === "running") onStatusChange?.(STATUSES.RUNNING);
        else if (phase === "paused") onStatusChange?.(STATUSES.PAUSED);
        else if (phase === "done") onStatusChange?.(STATUSES.DONE);
        else if (phase === "countdown") onStatusChange?.(STATUSES.COUNTDOWN);
        else if (phase === "idle") onStatusChange?.(STATUSES.IDLE);
    }, [phase]); // eslint-disable-line

    useEffect(() => {
        if (elapsed >= timeLimit && !bellFired.current && phase === "running") {
            bellFired.current = true;
            ringBell(3);
        }
    }, [elapsed, timeLimit, phase]);

    useEffect(() => {
        if (phase !== "countdown") return;
        if (countdown <= 0) { setPhase("running"); return; }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [phase, countdown]);

    useEffect(() => {
        if (phase === "running") {
            intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [phase]);

    const handleStart = () => {
        if (phase === "idle") { setCountdown(5); setPhase("countdown"); }
        else if (phase === "paused") { setPhase("running"); }
        else if (phase === "running") { setPhase("paused"); }
    };

    const handleReset = () => {
        clearInterval(intervalRef.current);
        setPhase("idle"); setElapsed(0); setCountdown(5);
        bellFired.current = false;
    };

    const barColor = phase === "done" || overTime ? T.red
        : pct > 80 ? T.red
            : pct > 60 ? T.amber
                : T.primaryAccent;

    return (
        <div
            ref={domRef}
            style={{
                background: T.surface,
                border: `1px solid ${
                    phase === "done" ? T.red + "55"
                    : phase === "running" || phase === "countdown" ? (phase === "countdown" ? T.amber : barColor) + "55"
                    : T.border
                }`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: (phase === "running" || phase === "countdown")
                    ? `0 0 24px ${(phase === "countdown" ? T.amber : barColor)}22` : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ ...label11(T.subtle), marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Answer Timer</span>
                        <span style={{ color: T.borderMid }}>•</span>
                        <span>{marks}M</span>
                        <span style={{ color: T.borderMid }}>•</span>
                        <span style={{ color: T.primaryAccent }}>Target: {Math.floor(timeLimit / 60)} min</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.muted }}>
                        UPSC standard — {marks === "10" ? "6 min" : "9 min"} per question
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    {phase === "countdown" ? (
                        <div style={{
                            fontSize: 38, fontWeight: 900, color: T.amber,
                            letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        }}>
                            {countdown}
                        </div>
                    ) : (
                        <div style={{
                            fontSize: 38, fontWeight: 900,
                            color: overTime ? T.red : phase === "done" ? T.red : T.textBright,
                            letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        }}>
                            {overTime ? `+${fmt(elapsed - timeLimit)}` : fmt(remaining)}
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: T.subtle, marginTop: 3, textAlign: "right" }}>
                        {phase === "countdown" ? "Get ready…"
                            : overTime ? "Over time"
                                : phase === "done" ? "Time's up!"
                                    : `${fmt(elapsed)} elapsed`}
                    </div>
                </div>
            </div>

            <div style={{ height: 5, background: T.muted, borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${pct}%`,
                    background: barColor, borderRadius: 5,
                    transition: "width 0.8s linear, background 0.4s",
                }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
                {[0, 25, 50, 75, 100].map((p) => (
                    <span key={p} style={{
                        fontSize: 9, color: pct >= p ? T.dim : T.muted,
                        fontWeight: pct >= p ? 700 : 400,
                    }}>
                        {Math.round((timeLimit * p) / 100 / 60)}m
                    </span>
                ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                {phase !== "done" && phase !== "idle" && (
                    <button
                        onClick={handleStart}
                        disabled={phase === "countdown"}
                        style={{
                            flex: 1,
                            background: T.primaryGradient,
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 8, fontWeight: 900, fontSize: 13,
                            padding: "10px 0",
                            cursor: phase === "countdown" ? "not-allowed" : "pointer",
                            fontFamily: T.font, letterSpacing: "0.04em",
                            opacity: phase === "countdown" ? 0.6 : 1,
                        }}
                    >
                        {phase === "countdown" ? `Starting in ${countdown}…`
                                : phase === "running" ? "▐▐  Pause"
                                    : "▶  Resume"}
                    </button>
                )}
                {phase === "done" && (
                    <div style={{
                        flex: 1, background: `${T.red}11`,
                        border: `1px solid ${T.red}33`, borderRadius: 8,
                        padding: "10px 16px", textAlign: "center",
                        fontSize: 13, fontWeight: 700, color: T.red,
                    }}>
                        🔔 Time's up! Wrap up your answer.
                    </div>
                )}
                {phase !== "idle" && (
                    <button onClick={handleReset} style={{
                        background: "transparent", color: T.dim,
                        border: `1px solid ${T.border}`, borderRadius: 8,
                        fontWeight: 600, fontSize: 13, padding: "10px 16px",
                        cursor: "pointer", fontFamily: T.font,
                    }}>
                        ↺ Reset
                    </button>
                )}
            </div>

            {overTime && phase === "running" && (
                <div style={{
                    background: `${T.red}11`, border: `1px solid ${T.red}22`,
                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                    color: T.red, fontWeight: 600, textAlign: "center",
                }}>
                    ⚠ Over time by {fmt(elapsed - timeLimit)} — finish quickly and move on.
                </div>
            )}
            {phase === "running" && (
                <div style={{ fontSize: 11, color: T.amber, marginTop: 2 }}>
                    ⚡ Stick to structure: Intro → Key Points → Conclusion
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnswerWritingPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // Helper to get initial state from route state or sessionStorage
    const getInitialRs = () => {
        let initialRs = location.state;
        if (!initialRs || Object.keys(initialRs).length === 0) {
            try {
                const savedState = sessionStorage.getItem("active_mains_rs");
                if (savedState) {
                    initialRs = JSON.parse(savedState);
                }
            } catch (e) {}
        }
        return initialRs || {};
    };
    const initialRs = getInitialRs();

    // ─── Mode switch & Upload metadata state ──────────────────────────────────
    const [practiceMode, setPracticeMode] = useState(() => initialRs.practiceMode || "typed"); // 'typed' | 'upload'
    const [ocrExtracted, setOcrExtracted] = useState(() => initialRs.ocrExtracted || false);
    const [verifiedQuestionText, setVerifiedQuestionText] = useState(() => initialRs.verifiedQuestionText || "");
    const [attemptId, setAttemptId] = useState(() => initialRs.attemptId || null);

    const resolvedAttemptId =
      attemptId ||
      initialRs?.attemptId ||
      (typeof rs !== "undefined" ? rs?.attemptId : null) ||
      (typeof currentAttempt !== "undefined" ? (currentAttempt?.attemptId || currentAttempt?.id) : null) ||
      (typeof activeAttempt !== "undefined" ? (activeAttempt?.attemptId || activeAttempt?.id) : null) ||
      (typeof latestAttempt !== "undefined" ? (latestAttempt?.attemptId || latestAttempt?.id) : null) ||
      null;
    const [uploadMeta, setUploadMeta] = useState(() => initialRs.uploadMeta || {
        sourceOption: "pyq", // pyq | institute | custom
        paper: "GS1",
        year: "",
        questionNumber: "",
        marks: "15",
        wordLimit: "250",
        instituteName: "",
        testName: "",
        subjectTopic: ""
    });

    const invalidateReviews = () => {
        setEvaluationText("");
        setEvaluationData(null);
        setAir1ReviewText("");
        setParsedAir1Json(null);
        setAir1JsonText("");
        setAir1ParseResult(null);
        setSaved(false);
    };

    const handleUpdateUploadMeta = (updates) => {
        setUploadMeta(prev => {
            const next = { ...prev, ...updates };
            if (updates.marks !== undefined) {
                if (updates.marks === "10") {
                    next.wordLimit = "150";
                } else if (updates.marks === "15" || updates.marks === "20") {
                    next.wordLimit = "250";
                }
            }
            return next;
        });
        invalidateReviews();
    };

    const handleVerifiedQuestionChange = (val) => {
        setVerifiedQuestionText(val);
        invalidateReviews();
    };

    const handleVerifiedAnswerChange = (val) => {
        setPastedText(val);
        invalidateReviews();
    };

    const handleSwitchMode = (m) => {
        setPracticeMode(m);
        if (m === "upload") {
            setPastedText("");
            setEvaluationText("");
            setEvaluationData(null);
            setAir1ReviewText("");
            setParsedAir1Json(null);
            setAir1JsonText("");
            setAir1ParseResult(null);
            const newId = `mains_upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            setAttemptId(newId);
            setUploadedPages([]);
            setOcrExtracted(false);
            setVerifiedQuestionText("");
        } else {
            clearVisibleAttemptState();
        }
    };

    const handleExtractQuestionAnswer = async () => {
        if (uploadedPages.length === 0) return;
        setIsExtracting(true);
        setReviewUiError("");
        try {
            const files = uploadedPages.map(pg => pg.file).filter(Boolean);
            if (files.length === 0) {
                setReviewUiError("No valid files found.");
                setIsExtracting(false);
                return;
            }
            const res = await extractQuestionAnswerFromImagesApi(files);
            if (res.success) {
                setVerifiedQuestionText(res.questionText || "");
                setPastedText(res.answerText || "");
                
                if (res.detectedMetadata) {
                    setUploadMeta(prev => ({
                        ...prev,
                        paper: res.detectedMetadata.paper || prev.paper,
                        marks: res.detectedMetadata.marks || prev.marks,
                        wordLimit: res.detectedMetadata.wordLimit || prev.wordLimit,
                        questionNumber: res.detectedMetadata.questionNumber || prev.questionNumber,
                    }));
                }
                
                if (res.warnings && res.warnings.length > 0) {
                    setReviewUiError(`Extracted with warnings: ${res.warnings.join(", ")}`);
                }
                
                setOcrExtracted(true);
                setSessionStarted(true);
                
                const qKey = buildQuestionKey({
                    paper: res.detectedMetadata?.paper || uploadMeta.paper,
                    year: uploadMeta.year,
                    questionText: res.questionText
                });
                answerQuestionKeyRef.current = qKey;
            } else {
                setReviewUiError(res.error || "Extraction failed.");
            }
        } catch (error) {
            console.error("Extraction error:", error);
            setReviewUiError(error?.message || "Extraction failed. Please try again.");
        } finally {
            setIsExtracting(false);
        }
    };

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ─── Theme state ─────────────────────────────────────────────────────────
    const [theme, setThemeState] = useState(() => localStorage.getItem("mentoros_theme") || "dark");
    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        localStorage.setItem("mentoros_theme", newTheme);
        setThemeState(newTheme);
    };

    Object.assign(T, theme === "light" ? lightTokens : darkTokens);

    // ─── Route state ─────────────────────────────────────────────────────────
    const [rs, setRs] = useState(() => initialRs);

    useEffect(() => {
        if (location.state && Object.keys(location.state).length > 0) {
            setRs(location.state);
            try {
                sessionStorage.setItem("active_mains_rs", JSON.stringify(location.state));
            } catch (e) {
                console.error("Failed to save location.state to sessionStorage", e);
            }
        }
    }, [location.state]);

    useEffect(() => {
        if (rs) {
            if (rs.practiceMode) setPracticeMode(rs.practiceMode);
            if (rs.ocrExtracted !== undefined) setOcrExtracted(rs.ocrExtracted);
            if (rs.verifiedQuestionText !== undefined) setVerifiedQuestionText(rs.verifiedQuestionText);
            if (rs.pastedText !== undefined) setPastedText(rs.pastedText);
            if (rs.attemptId !== undefined) setAttemptId(rs.attemptId);
            if (rs.uploadMeta) setUploadMeta(rs.uploadMeta);
            if (rs.sessionStarted !== undefined) {
                setSessionStarted(rs.sessionStarted);
            } else if (rs.ocrExtracted) {
                setSessionStarted(true);
            }
            if (rs.uploadedPagesMeta) {
                setUploadedPages(rs.uploadedPagesMeta.map(m => ({ preview: null, file: { name: m.fileName } })));
            }
        }
    }, [rs]);
    const paper          = rs.paper          || "GS1";
    const mode           = rs.mode           || "PYQ";
    const year           = rs.year           || null;
    const topic          = rs.topic          || "";
    const syllabusNodeId = rs.syllabusNodeId || "";
    const questions      = (rs.questions && rs.questions.length > 0) ? rs.questions : FALLBACK_QUESTIONS;

    const [currentIndex, setCurrentIndex] = useState(() => {
        return rs.currentIndex || 0;
    });

    useEffect(() => {
        if (rs && Object.keys(rs).length > 0) {
            try {
                const stateToSave = { ...rs, currentIndex };
                sessionStorage.setItem("active_mains_rs", JSON.stringify(stateToSave));
            } catch (e) {
                console.error("Failed to update sessionStorage active_mains_rs", e);
            }
        }
    }, [currentIndex, rs]);
    const safeIndex = Math.min(currentIndex, questions.length - 1);
    const activeQ   = questions[safeIndex] || {};
    const currentQuestion = activeQ;

    // ─── Derived session ──────────────────────────────────────────────────────
    const paperAccent = getPaperAccent(paper);
    const marks       = String(activeQ.marks || "15");
    const timeLimit   = TIME_LIMITS[marks] || TIME_LIMITS["15"];
    const wordTarget  = practiceMode === "upload"
        ? parseInt(uploadMeta.wordLimit || (uploadMeta.marks === "10" ? "150" : "250"))
        : (WORD_TARGETS[marks] || 200);

    const SESSION = {
        paper,
        paperAccent,
        mode,
        marks,
        year:        activeQ.year      || year,
        question:    activeQ.question  || "",
        subparts:    activeQ.subparts  || [],
        focus:       activeQ.focus     || "",
        structure:   activeQ.structure || "Intro + 4–5 pts + Concl",

        priority:    activeQ.priority  || "",
        topicNodeId: activeQ.syllabusNodeId || syllabusNodeId || "",
    };

    const getCurrentQuestionContext = () => {
        if (practiceMode === "upload") {
            const questionText = verifiedQuestionText || "";
            const ctxPaper = uploadMeta.paper || "GS1";
            const ctxYear = uploadMeta.year || "";
            const ctxMarks = uploadMeta.marks || "15";
            const ctxWordLimit = uploadMeta.wordLimit || "250";
            const questionId = resolvedAttemptId;
            const questionKey = buildQuestionKey({
                paper: ctxPaper,
                year: ctxYear,
                questionText
            });
            return {
                raw: null,
                paper: ctxPaper,
                year: ctxYear,
                marks: ctxMarks,
                wordLimit: ctxWordLimit,
                questionId,
                attemptId: resolvedAttemptId,
                mode: uploadMeta.sourceOption,
                focus: uploadMeta.subjectTopic || "",
                topicNodeId: "",
                structure: "",
                priority: "",
                questionText,
                question: questionText,
                questionKey,
                question_key: questionKey,
                workspace: uploadMeta.workspace || "",
                subject: uploadMeta.subject || "",
                answerType: uploadMeta.answerType || ""
            };
        }

        const q = activeQ || currentQuestion || questions?.[currentIndex] || SESSION;

        const questionText = extractQuestionText(
            q?.question ||
            q?.questionText ||
            q?.text ||
            q?.title ||
            SESSION?.question
        );

        const ctxPaper = q?.paper || SESSION?.paper || "GS1";
        const ctxYear = q?.year || q?.questionYear || SESSION?.year || "";
        const ctxMarks = q?.marks || SESSION?.marks;
        const ctxWordLimit = q?.wordLimit || SESSION?.wordLimit || wordTarget;
        const questionId = q?.id || q?.questionId || q?.question_id || null;

        const questionKey = buildQuestionKey({
            paper: ctxPaper,
            year: ctxYear,
            questionText
        });

        return {
            raw: q,
            paper: ctxPaper,
            year: ctxYear,
            marks: ctxMarks,
            wordLimit: ctxWordLimit,
            questionId,
            attemptId: resolvedAttemptId,
            mode: SESSION.mode,
            focus: q?.focus || SESSION.focus || "",
            topicNodeId: q?.syllabusNodeId || q?.topicNodeId || SESSION.topicNodeId || "",
            structure: q?.structure || SESSION.structure || "",
            priority: q?.priority || SESSION.priority || "",
            questionText,
            question: questionText,
            questionKey,
            question_key: questionKey
        };
    };

    const currentCtx = getCurrentQuestionContext();
    const displayedPaper = currentCtx.paper;
    const displayedYear = currentCtx.year;
    const displayedQuestionText = currentCtx.questionText;

    console.log("[DISPLAY QUESTION SOURCE]", {
        currentIndex,
        displayedPaper,
        displayedYear,
        displayedQuestionText,
        activeQ,
        currentQuestion,
        SESSION
    });

    // ─── Per-question state ───────────────────────────────────────────────────
    const [timerStatus, setTimerStatus]   = useState(STATUSES.IDLE);
    const [sessionStarted, setSessionStarted] = useState(() => initialRs.sessionStarted || (initialRs.ocrExtracted ? true : false));
    const timerSectionRef = useRef(null);
    // Phase 2: tracks which question the current answer belongs to
    const answerQuestionKeyRef = useRef(null);

    const [uploadedPages, setUploadedPages] = useState(() => {
        if (initialRs.uploadedPagesMeta) {
            return initialRs.uploadedPagesMeta.map(m => ({ preview: null, file: { name: m.fileName } }));
        }
        return [];
    });
    const [isDragging, setIsDragging]       = useState(false);
    const fileInputRef = useRef();
    const hasPages = uploadedPages.length > 0;

    const [promptCopied, setPromptCopied]         = useState(false);
    const [pastedText, setPastedText]             = useState(() => initialRs.pastedText || "");
    const hasPastedText = pastedText.trim().length > 20;
    const [evaluationText, setEvaluationText]     = useState("");
    const [evaluationData, setEvaluationData]     = useState(null);
    const [evalPromptCopied, setEvalPromptCopied] = useState(false);
    const [isEvaluating, setIsEvaluating]         = useState(false);
    const [isExtracting, setIsExtracting]         = useState(false);

    const [saved, setSaved]                     = useState(false);
    const [savedAttemptData, setSavedAttemptData] = useState(null);
    const [pageStatus, setPageStatus]           = useState(STATUSES.IDLE);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const [dbAttempt, setDbAttempt]   = useState(null);
    const [reviewId, setReviewId]     = useState(null);

    // Finalize state for PostgreSQL persistence
    const [finalizeState, setFinalizeState] = useState("idle"); // idle | saving | saved | error
    const [finalizeError, setFinalizeError] = useState("");

    const [answerSaveState, setAnswerSaveState] = useState("idle");
    const [answerSaveError, setAnswerSaveError] = useState("");

    const [externalReviewText, setExternalReviewText] = useState("");
    const [reviewAgreement, setReviewAgreement]       = useState("not_set");
    const [reviewAgreementNote, setReviewAgreementNote] = useState("");

    // AIR-1 JSON review paste + parse state
    const [air1JsonText, setAir1JsonText] = useState("");
    const [air1ParseResult, setAir1ParseResult] = useState(null);
    const [air1ParseError, setAir1ParseError] = useState("");
    const [analyzingAir1, setAnalyzingAir1] = useState(false);

    // AIR-1 ChatGPT review full-text paste (Step 3)
    const [air1ReviewText, setAir1ReviewText] = useState("");
    const [parsedAir1Json, setParsedAir1Json] = useState(null);
    
    // Also treat a hydrated evaluationData (from DB restore) or parsedAir1Json as having evaluation text
    const hasEvaluationText = evaluationText.trim().length > 20 || evaluationData !== null || parsedAir1Json !== null;
    
    const [air1JsonParseWarning, setAir1JsonParseWarning] = useState("");
    const [showRawReview, setShowRawReview] = useState(false);
    const [isAir1TextareaExpanded, setIsAir1TextareaExpanded] = useState(true);
    const [reviewModeActive, setReviewModeActive] = useState(false);

    // Fix Mode state
    const [fixModeActive, setFixModeActive] = useState(false);
    const [fixDraft, setFixDraft] = useState("");
    const [fixTask, setFixTask] = useState("");
    const [fixSaving, setFixSaving] = useState(false);
    const [isImproved, setIsImproved] = useState(false);
    const [fixOriginalSnippet, setFixOriginalSnippet] = useState("");
    const [lastImprovement, setLastImprovement] = useState(null);

    const [reviewSaveState, setReviewSaveState]       = useState("idle");
    const [reviewSaveError, setReviewSaveError]       = useState("");
    const [reviewProcessState, setReviewProcessState] = useState("idle");
    const [reviewProcessError, setReviewProcessError] = useState("");

    const [processedReviewResult, setProcessedReviewResult] = useState(null);
    const [reviewResultData, setReviewResultData]           = useState(null);

    // eslint-disable-next-line no-unused-vars
    const [reviewUiMessage, setReviewUiMessage] = useState("");
    const [reviewUiError, setReviewUiError]     = useState("");
    const [reviewPromptCopied, setReviewPromptCopied] = useState(false);

    const clearVisibleAttemptState = () => {
        uploadedPages.forEach((p) => URL.revokeObjectURL(p.preview));
        setPastedText("");
        setUploadedPages([]);
        setEvaluationData(null);
        setEvaluationText("");
        setAir1ReviewText("");
        setAir1JsonText("");
        setAir1ParseResult(null);
        setAir1ParseError("");
        setParsedAir1Json(null);
        setAir1JsonParseWarning("");
        setSaved(false);
        setSavedAttemptData(null);
        setSessionStarted(false);
        setAttemptId(null);
        setDbAttempt(null);
        setReviewId(null);
        setPromptCopied(false);
        setEvalPromptCopied(false);
        setReviewPromptCopied(false);
        setAnswerSaveState("idle");
        setAnswerSaveError("");
        setExternalReviewText("");
        setReviewAgreement("not_set");
        setReviewAgreementNote("");
        setReviewSaveState("idle");
        setReviewSaveError("");
        setReviewProcessState("idle");
        setReviewProcessError("");
        setProcessedReviewResult(null);
        setReviewResultData(null);
        setReviewUiMessage("");
        setReviewUiError("");
        setIsEvaluating(false);
        setFixOriginalSnippet("");
        setLastImprovement(null);
        setIsImproved(false);
        setFixModeActive(false);
        setFixDraft("");
        setFixTask("");
        setFinalizeState("idle");
        setFinalizeError("");
        setReviewModeActive(false);
        answerQuestionKeyRef.current = null;
    };

    const isSameQuestion = (attempt, ctx) => {
        if (!attempt || !ctx) return false;
        const dbQuestionKey = attempt.questionKey || attempt.question_key || buildQuestionKey({
            paper: attempt.paper || ctx.paper,
            year: attempt.year || attempt.sourceYear || ctx.year,
            questionText: attempt.questionText || attempt.question || ""
        });
        return dbQuestionKey === ctx.questionKey;
    };

    // ─── Restore exact displayed question from DB ─────────────────────────────
    useLayoutEffect(() => {
        if (practiceMode === "upload") return;
        let cancelled = false;
        const restoreCtx = getCurrentQuestionContext();

        clearVisibleAttemptState();
        console.log("[RESTORE USING DISPLAYED QUESTION]", restoreCtx);

        fetchLatestMainsAttemptForQuestion("user_1", restoreCtx.questionKey)
            .then(res => {
                if (cancelled || !res?.ok || !res?.attempt) return;
                const attempt = res.attempt;
                const sameQuestion = isSameQuestion(attempt, restoreCtx);
                console.log("[RESTORE DB ATTEMPT QUESTION]", {
                    dbQuestionText: attempt.questionText || attempt.question,
                    dbQuestionKey: attempt.questionKey || attempt.question_key,
                    currentQuestionText: restoreCtx.questionText,
                    currentQuestionKey: restoreCtx.questionKey,
                    isSame: sameQuestion
                });

                if (!sameQuestion) return;

                if (attempt.finalAnswerText || attempt.extractedText) {
                    setPastedText(attempt.finalAnswerText || attempt.extractedText || "");
                    setSessionStarted(true);
                    answerQuestionKeyRef.current = restoreCtx.questionKey;
                }
                if (attempt.basicReview) {
                    setEvaluationData(attempt.basicReview);
                    // Rebuild evaluationText so hasEvaluationText becomes true,
                    // which ensures the AIR-1 Review block is visible after hydration.
                    const ev = attempt.basicReview;
                    let restoredEvalText = "";
                    if (ev.strengths || ev.verdict) {
                        restoredEvalText = [
                            `📊 Score: ${ev.score} / ${ev.max_score}`,
                            `\n📌 Verdict: ${ev.verdict}`,
                            ev.strengths && ev.strengths.length > 0 ? `\n✅ Strengths:\n- ${ev.strengths.join('\n- ')}` : '',
                            ev.major_weaknesses && ev.major_weaknesses.length > 0 ? `\n⚠️ Weaknesses:\n- ${ev.major_weaknesses.join('\n- ')}` : '',
                            ev.improvement_tasks && ev.improvement_tasks.length > 0 ? `\n🚀 Improvement Suggestions:\n- ${ev.improvement_tasks.join('\n- ')}` : ''
                        ].filter(Boolean).join('\n');
                    } else if (ev.level === "Format Issue" || ev.level === "Error") {
                        restoredEvalText = ev.rawOutput || ev.finalAdvice || JSON.stringify(ev, null, 2);
                    } else if (Object.keys(ev).length > 0) {
                        restoredEvalText = JSON.stringify(ev, null, 2);
                    }
                    if (restoredEvalText) setEvaluationText(restoredEvalText);
                }
                if (attempt.air1ParsedJson) {
                    setParsedAir1Json(attempt.air1ParsedJson);
                }
                if (attempt.air1RawReview) {
                    setAir1ReviewText(attempt.air1RawReview);
                }
                setDbAttempt(attempt);
                if (attempt.attemptId) {
                    setAttemptId(attempt.attemptId);
                }
                if (attempt.status === "finalized") {
                    setSaved(true);
                    setFinalizeState("saved");
                }
            })
            .catch(err => console.warn("[mains-attempt] restore failed", err));

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, currentCtx.questionKey]);

    // ─── Derived page status ──────────────────────────────────────────────────
    useEffect(() => {
        if (saved) setPageStatus(STATUSES.SAVED);
        else if (hasPastedText) setPageStatus(STATUSES.TEXT_PASTED);
        else if (promptCopied) setPageStatus(STATUSES.PROMPT_COPIED);
        else if (hasPages) setPageStatus(STATUSES.UPLOADED);
        else setPageStatus(timerStatus);
    }, [saved, hasPastedText, promptCopied, hasPages, timerStatus]);

    // ─── Phase 2: sync answerQuestionKeyRef whenever answer text changes ─────
    useEffect(() => {
        if (pastedText && pastedText.trim()) {
            const ctx = getCurrentQuestionContext();
            if (ctx.questionKey && !ctx.questionKey.includes('[object')) {
                answerQuestionKeyRef.current = ctx.questionKey;
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pastedText]);

    // ─── Navigation ──────────────────────────────────────────────────────────
    const canPrev = currentIndex > 0;
    const canNext = currentIndex < questions.length - 1;

    const handlePrev = () => { if (canPrev) setCurrentIndex((i) => i - 1); };
    const handleNext = () => {
        if (canNext) setCurrentIndex((i) => i + 1);
        else navigate(-1);
    };

    // ─── Upload handlers ──────────────────────────────────────────────────────
    const addFiles = (files) => {
        const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
        setUploadedPages((prev) => {
            const remaining = MAX_PAGES - prev.length;
            const toAdd = images.slice(0, remaining).map((file) => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            return [...prev, ...toAdd];
        });
        setSaved(false);
        setPromptCopied(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(e.dataTransfer.files);
    };

    const handleRemovePage = (idx) => {
        setUploadedPages((prev) => {
            URL.revokeObjectURL(prev[idx].preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleClearAll = () => {
        uploadedPages.forEach((p) => URL.revokeObjectURL(p.preview));
        setUploadedPages([]);
        setPastedText("");
        setSaved(false);
        setPromptCopied(false);
    };

    // ─── Extraction prompt guard ──────────────────────────────────────────────
    const EXTRACTION_PROMPT_FINGERPRINTS = [
        "I am uploading photos of my handwritten UPSC mains answer sheets",
        "Extract the handwritten answer into clean editable text",
        "Return only the extracted answer text",
    ];
    const isExtractionPromptAccidentallyPasted = (text) =>
        EXTRACTION_PROMPT_FINGERPRINTS.some((fp) => text.includes(fp));

    // ─── extractMentorOsJson — safely parse <MENTOROS_JSON> block ─────────────
    const extractMentorOsJson = (reviewText) => {
        if (!reviewText) return null;
        const start = reviewText.indexOf("<MENTOROS_JSON>");
        const end   = reviewText.indexOf("</MENTOROS_JSON>");
        if (start === -1 || end === -1 || end <= start) return null;
        const raw = reviewText.slice(start + "<MENTOROS_JSON>".length, end).trim();
        try {
            return JSON.parse(raw);
        } catch (_) {
            return undefined; // distinct: tag found but invalid JSON
        }
    };

    // ─── Phase 2: Save guard helper ────────────────────────────────────────────
    function validateSaveContext(ctx) {
        if (!ctx.questionKey || ctx.questionKey.includes('[object')) {
            return { ok: false, reason: `[SAVE BLOCKED] invalid question key: "${String(ctx.questionKey).slice(0, 80)}"` };
        }
        if (!ctx.questionText || ctx.questionText.includes('[object Object]')) {
            return { ok: false, reason: '[SAVE BLOCKED] invalid question text' };
        }
        if (answerQuestionKeyRef.current && answerQuestionKeyRef.current !== ctx.questionKey) {
            return {
                ok: false,
                reason: `[SAVE BLOCKED] answer belongs to different question — answerKey: "${String(answerQuestionKeyRef.current).slice(0, 60)}", currentKey: "${ctx.questionKey.slice(0, 60)}"`
            };
        }
        return { ok: true };
    }

    // ─── Gemini Basic Review ──────────────────────────────────────────────────
    const handleBasicReview = async () => {
        const ctx = getCurrentQuestionContext();
        // Phase 2 guard: block if question context is invalid
        const ctxGuard = validateSaveContext(ctx);
        if (!ctxGuard.ok) {
            console.warn(ctxGuard.reason, ctx);
            setReviewUiError("Cannot evaluate: question context is invalid. Navigate away and back, then retry.");
            return;
        }
        // Guard: block if user accidentally pasted the extraction prompt
        if (isExtractionPromptAccidentallyPasted(pastedText)) {
            setReviewUiError(
                "Please paste the actual answer text, not the prompt. Go back and paste only the prepared text from your handwriting."
            );
            return;
        }
        setIsEvaluating(true);
        setReviewUiError("");
        const questionKeyAtStart = ctx.questionKey;
        try {
            let payload;
            if (attemptId && dbAttempt) {
                payload = {
                    userId: dbAttempt.userId || "user_1",
                    attemptId: attemptId,
                    paper: dbAttempt.paper || "GS1",
                    subject: dbAttempt.subject || dbAttempt.topic || "",
                    topic: dbAttempt.topic || "",
                    questionText: dbAttempt.questionText || dbAttempt.question || "",
                    candidateAnswer: dbAttempt.finalAnswerText || dbAttempt.answerText || dbAttempt.extractedText || pastedText.trim(),
                    marks: parseInt(dbAttempt.marks || 15),
                    wordLimit: parseInt(dbAttempt.wordLimit || dbAttempt.word_limit || 200),
                    sourceType: dbAttempt.answerSource || "typed",
                    questionSourceType: dbAttempt.mode || "PYQ",
                    answerSourceType: dbAttempt.answerSource || "typed",
                };
            } else {
                payload = {
                    userId: "user_1",
                    attemptId: attemptId || undefined,
                    paper: ctx.paper,
                    subject: practiceMode === "upload" ? (uploadMeta.subjectTopic || "General") : (ctx.topicNodeId || topic || ""),
                    topic: practiceMode === "upload" ? (uploadMeta.detectedTopic || uploadMeta.subjectTopic || "General") : (ctx.topicNodeId || topic || ""),
                    questionText: ctx.questionText,
                    candidateAnswer: pastedText.trim(),
                    marks: parseInt(ctx.marks),
                    wordLimit: parseInt(ctx.wordLimit || wordTarget),
                    sourceType: hasPages ? "uploaded" : "typed",
                    questionSourceType: ctx.mode || "PYQ",
                    answerSourceType: hasPages ? "uploaded" : "typed",
                };
            }

            console.log("[EVALUATE PAYLOAD]", payload);

            const result = await evaluateMainsAnswerApi(payload);
            
            // Phase 3: discard if question changed during async call
            if (getCurrentQuestionContext().questionKey !== questionKeyAtStart) {
                console.warn("[ASYNC RESULT IGNORED] question changed during basic review");
                return;
            }
            if (result && result.success && result.evaluation) {
                const evalData = result.evaluation;
                let formattedReview = "";
                if (evalData.strengths || evalData.verdict) {
                    formattedReview = [
                        `📊 Score: ${evalData.score} / ${evalData.max_score}`,
                        `\n📌 Verdict: ${evalData.verdict}`,
                        evalData.strengths && evalData.strengths.length > 0 ? `\n✅ Strengths:\n- ${evalData.strengths.join('\n- ')}` : '',
                        evalData.major_weaknesses && evalData.major_weaknesses.length > 0 ? `\n⚠️ Weaknesses:\n- ${evalData.major_weaknesses.join('\n- ')}` : '',
                        evalData.improvement_tasks && evalData.improvement_tasks.length > 0 ? `\n🚀 Improvement Suggestions:\n- ${evalData.improvement_tasks.join('\n- ')}` : ''
                    ].filter(Boolean).join('\n');
                } else if (evalData.level === "Format Issue" || evalData.level === "Error") {
                    formattedReview = evalData.rawOutput || evalData.finalAdvice || JSON.stringify(evalData, null, 2);
                } else {
                    formattedReview = JSON.stringify(evalData, null, 2);
                }
                
                setEvaluationText(formattedReview);
                setEvaluationData(evalData);
            } else {
                setReviewUiError("Evaluation failed. Please try again.");
            }
        } catch (error) {
            console.error(error);
            setReviewUiError("Evaluation failed. Please try again.");
        } finally {
            setIsEvaluating(false);
        }
    };

    // ─── Extraction (Gemini Vision) ───────────────────────────────────────────
    const handleExtractAnswer = async () => {
        if (!hasPages) return;
        // Phase 3: capture question key before async operation
        const questionKeyAtStart = getCurrentQuestionContext().questionKey;
        setIsExtracting(true);
        setReviewUiError("");
        try {
            const files = uploadedPages.map(pg => pg.file).filter(Boolean);
            if (files.length === 0) {
                setReviewUiError("No valid image files found.");
                setIsExtracting(false);
                return;
            }
            const res = await extractAnswerFromImagesApi(files);
            // Phase 3: discard result if question changed during async call
            if (getCurrentQuestionContext().questionKey !== questionKeyAtStart) {
                console.warn("[ASYNC RESULT IGNORED] question changed during extract");
                return;
            }
            if (res.ok && res.text) {
                answerQuestionKeyRef.current = questionKeyAtStart;
                setPastedText(res.text);
            } else {
                setReviewUiError(res.error || "Extraction failed.");
            }
        } catch (error) {
            console.error("Extraction error:", error);
            setReviewUiError(error?.message || "Extraction failed. Please try again or use the manual fallback.");
        } finally {
            setIsExtracting(false);
        }
    };

    // ─── Start session ────────────────────────────────────────────────────────
    const handleStartSession = () => {
        setSessionStarted(true);
        setTimeout(() => {
            timerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
    };

    // ─── Save attempt ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        const ctx = getCurrentQuestionContext();
        // Phase 2 guard
        const ctxGuard = validateSaveContext(ctx);
        if (!ctxGuard.ok) {
            console.warn(ctxGuard.reason, ctx);
            return;
        }
        const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
        const attempt = {
            id:          `mains_attempt_${Date.now()}`,
            paper:       ctx.paper,
            mode:        ctx.mode,
            marks:       ctx.marks,
            year:        ctx.year,
            question:    ctx.questionText,
            questionText: ctx.questionText,
            question_text: ctx.questionText,
            questionKey: ctx.questionKey,
            question_key: ctx.questionKey,
            questionId: ctx.questionId,
            question_id: ctx.questionId,
            answerText:  pastedText,
            wordCount,
            targetWords: wordTarget,
            createdAt:   new Date().toISOString(),
            ...(air1ReviewText.trim() ? { air1ReviewText: air1ReviewText.trim() } : {}),
            ...(parsedAir1Json     ? { air1ReviewJson: parsedAir1Json }           : {}),
        };
        try {
            // Local storage fallback removed
        // eslint-disable-next-line no-unused-vars
        } catch (_) {}
        setSavedAttemptData(attempt);
        setSaved(true);
        await handleSaveAttemptWithBackend();
    };

    // ─── Backend review pipeline ──────────────────────────────────────────────
    const handleSaveAttemptWithBackend = async () => {
        const ctx = getCurrentQuestionContext();
        // Phase 2 guard
        const ctxGuard = validateSaveContext(ctx);
        if (!ctxGuard.ok) {
            console.warn(ctxGuard.reason, ctx);
            return null;
        }
        const questionKeyAtStart = ctx.questionKey;
        setAnswerSaveState("saving");
        setAnswerSaveError("");
        try {
            const payload = {
                userId: "user_1",
                questionText: ctx.questionText,
                question_text: ctx.questionText,
                questionKey: ctx.questionKey,
                question_key: ctx.questionKey,
                questionId: ctx.questionId,
                question_id: ctx.questionId,
                paper: ctx.paper,
                year: ctx.year,
                marks: parseInt(ctx.marks),
                wordLimit: ctx.wordLimit,
                workspace: ctx.workspace || "",
                answerType: ctx.answerType || "",
                subject: ctx.subject || "",
                source: {
                    mode: "pyq",
                    paper: ctx.paper,
                    examYear: ctx.year || new Date().getFullYear(),
                    questionId: ctx.questionId || ctx.questionKey,
                    questionKey: ctx.questionKey,
                    questionMarks: parseInt(ctx.marks),
                    targetWords: wordTarget,
                    upscTimeMinutes: Math.floor(timeLimit / 60),
                },
                question: {
                    text: ctx.questionText,
                    questionText: ctx.questionText,
                    question_key: ctx.questionKey,
                    questionKey: ctx.questionKey,
                    id: ctx.questionId,
                    directiveWord: "",
                    focusLabel: ctx.focus || "",
                    topicNodeId: ctx.topicNodeId || "",
                    subjectTag: "general",
                },
                writingSession: {
                    startedAt: new Date().toISOString(),
                    endedAt: new Date().toISOString(),
                    timeTakenSeconds: 0,
                },
                answerUpload: {
                    pageCount: uploadedPages.length,
                    pages: uploadedPages.map((pg, idx) => ({
                        pageNo: idx + 1,
                        fileName: pg.file?.name || `page_${idx + 1}.jpg`,
                        storagePath: pg.preview || "",
                    })),
                },
                extraction: {
                    method: "chatgpt_manual_paste",
                    promptVersion: "mains-answer-extraction-v1",
                    extractedText: pastedText,
                },
                ...(air1ReviewText.trim() ? {
                    air1Review: {
                        rawText: air1ReviewText.trim(),
                        parsedJson: parsedAir1Json || null,
                    },
                } : {}),
                selfReview: {
                    mistakeTypes: [],
                    severity: "medium",
                    mustRevise: false,
                    note: "",
                },
            };
            const response = await saveMainsAttempt(payload);
            // Phase 3: discard if question changed during async save
            if (getCurrentQuestionContext().questionKey !== questionKeyAtStart) {
                console.warn("[ASYNC RESULT IGNORED] question changed during saveAttemptWithBackend");
                return null;
            }
            if (response?.ok && response?.attemptId) {
                setAttemptId(response.attemptId);
                setAnswerSaveState("saved");
                setReviewUiMessage("Attempt saved. Ready for evaluation.");
                return response.attemptId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving attempt:", error);
            setAnswerSaveState("error");
            setAnswerSaveError("Could not save attempt. Please try again.");
            return null;
        }
    };

    const handleSaveReview = async () => {
        if (!attemptId) { setReviewUiError("Save the answer attempt first."); return; }
        if (externalReviewText.trim().length < 200) { setReviewUiError("Review must be at least 200 characters."); return; }
        setReviewSaveState("saving");
        setReviewSaveError("");
        try {
            const payload = {
                attemptId,
                userId: "user_1",
                reviewSource: { type: "chatgpt_pasted", promptVersion: "mains-strict-review-v2" },
                rawReviewText: externalReviewText,
                userAgreement: { value: reviewAgreement, note: reviewAgreementNote },
            };
            const response = await saveMainsReview(payload);
            if (response?.ok && response?.reviewId) {
                setReviewId(response.reviewId);
                setReviewSaveState("saved");
                setReviewUiMessage("External review saved.");
                return response.reviewId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving review:", error);
            setReviewSaveState("error");
            setReviewSaveError("Could not save external review.");
            return null;
        }
    };

    const handleProcessReview = async () => {
        if (!attemptId || !reviewId) { setReviewUiError("Save both attempt and review first."); return; }
        setReviewProcessState("processing");
        setReviewProcessError("");
        try {
            const response = await processMainsReview({ attemptId, reviewId, userId: "user_1" });
            if (response?.ok) {
                setProcessedReviewResult(response);
                setReviewProcessState("processed");
                setReviewUiMessage("Review processed and synced to mistake/revision pipeline.");
                try {
                    const fullResult = await getMainsReviewResult(attemptId, reviewId);
                    if (fullResult?.ok) setReviewResultData(fullResult);
                } catch (e) { console.error("Error fetching full result:", e); }
                return response;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error processing review:", error);
            setReviewProcessState("error");
            setReviewProcessError("Could not process review. Saved review is still safe.");
            return null;
        }
    };

    const handleCopyReviewPrompt = () => {
        setReviewPromptCopied(true);
        setTimeout(() => setReviewPromptCopied(false), 3000);
    };

    const handleOpenChatGPTReview = () => {
        // Guard: block if user accidentally pasted the extraction prompt as the answer
        if (isExtractionPromptAccidentallyPasted(pastedText)) {
            setReviewUiError(
                "Please paste the actual student answer, not the prompt."
            );
            return;
        }
        window.open("https://chatgpt.com/g/g-p-69b58b47f99c8191a602da2b21e83eda-pyq-upsc/project", "_blank", "noopener,noreferrer");
    };

    // ─── Handle AIR-1 review text change: auto-parse MENTOROS_JSON ───────────
    const handleAir1ReviewChange = (text) => {
        setAir1ReviewText(text);
        setAir1JsonParseWarning("");
        setParsedAir1Json(null);
        if (!text.trim()) return;
        const result = extractMentorOsJson(text);
        if (result === null) {
            // No tag present — that's fine
            setIsAir1TextareaExpanded(true);
        } else if (result === undefined) {
            // Tag found but JSON was invalid
            setAir1JsonParseWarning(
                "AIR-1 review pasted, but the structured data block could not be read. The full review can still be saved."
            );
            setIsAir1TextareaExpanded(true);
        } else {
            setParsedAir1Json(result);
            setIsAir1TextareaExpanded(false);
            setReviewModeActive(true);
        }
    };

    const handleAnalyzeAir1Review = () => {
        setAir1ParseError("");
        setAir1ParseResult(null);
        if (!air1JsonText || !air1JsonText.trim()) {
            setAir1ParseError("Paste ChatGPT result first.");
            return;
        }
        setAnalyzingAir1(true);
        try {
            const res = parseAir1ReviewJson(air1JsonText);
            if (res.ok) {
                setAir1ParseResult(res.data);
            } else {
                setAir1ParseError(res.error || "Invalid format or schema");
            }
        } catch (e) {
            setAir1ParseError(e?.message || String(e));
        } finally {
            setAnalyzingAir1(false);
        }
    };

    // ─── Fix Mode handlers ─────────────────────────────────────────────────
    const handleStartFix = (fixNowObj) => {
        // fixNowObj may be the full object { mainTask, replacementLines, nextPracticeTask }
        const mainTaskText = fixNowObj && typeof fixNowObj === "object" && fixNowObj.mainTask ? fixNowObj.mainTask : (typeof fixNowObj === "string" ? fixNowObj : "");
        const replacementLines = fixNowObj && Array.isArray(fixNowObj.replacementLines) ? fixNowObj.replacementLines : [];
        const maxLines = 5;
        let draft = "";
        if (replacementLines && replacementLines.length > 0) {
            draft = replacementLines.slice(0, maxLines).map(r => (r || "").replace(/\r/g, "").replace(/\n/g, " ")).join("\n");
        } else if (pastedText && pastedText.trim()) {
            draft = pastedText.split(/\r?\n/).slice(0, maxLines).join("\n");
        }
        setFixTask(mainTaskText || "");
        setFixDraft(draft);
        setFixOriginalSnippet(draft);
        setFixModeActive(true);
        // Do not render the full review while fixing (UI will hide it when fixModeActive===true)
    };

    const handleCancelFix = () => {
        setFixModeActive(false);
        setFixDraft("");
        setFixTask("");
    };

    const handleSaveImprovedAttempt = async (draftText) => {
        const ctx = getCurrentQuestionContext();
        // Phase 2 guard
        const ctxGuard = validateSaveContext(ctx);
        if (!ctxGuard.ok) {
            console.warn(ctxGuard.reason, ctx);
            setAnswerSaveError("Cannot save: question context is invalid.");
            return null;
        }
        const questionKeyAtStart = ctx.questionKey;
        setAnswerSaveState("saving");
        setAnswerSaveError("");
        try {
            const payload = {
                userId: "user_1",
                questionText: ctx.questionText,
                question_text: ctx.questionText,
                questionKey: ctx.questionKey,
                question_key: ctx.questionKey,
                questionId: ctx.questionId,
                question_id: ctx.questionId,
                paper: ctx.paper,
                year: ctx.year,
                marks: parseInt(ctx.marks),
                wordLimit: ctx.wordLimit,
                source: {
                    mode: "pyq",
                    paper: ctx.paper,
                    examYear: ctx.year || new Date().getFullYear(),
                    questionId: ctx.questionId || ctx.questionKey,
                    questionKey: ctx.questionKey,
                    questionMarks: parseInt(ctx.marks),
                    targetWords: wordTarget,
                    upscTimeMinutes: Math.floor(timeLimit / 60),
                },
                question: {
                    text: ctx.questionText,
                    questionText: ctx.questionText,
                    question_key: ctx.questionKey,
                    questionKey: ctx.questionKey,
                    id: ctx.questionId,
                    directiveWord: "",
                    focusLabel: ctx.focus || "",
                    topicNodeId: ctx.topicNodeId || "",
                    subjectTag: "general",
                },
                writingSession: {
                    startedAt: new Date().toISOString(),
                    endedAt: new Date().toISOString(),
                    timeTakenSeconds: 0,
                },
                answerUpload: {
                    pageCount: uploadedPages.length,
                    pages: uploadedPages.map((pg, idx) => ({
                        pageNo: idx + 1,
                        fileName: pg.file?.name || `page_${idx + 1}.jpg`,
                        storagePath: pg.preview || "",
                    })),
                },
                extraction: {
                    method: "manual_fix",
                    promptVersion: "mains-fix-v1",
                    extractedText: draftText,
                },
                selfReview: {
                    mistakeTypes: [],
                    severity: "medium",
                    mustRevise: false,
                    note: "",
                },
                improved: true,
                improvedAt: new Date().toISOString(),
                originalAttemptId: attemptId || null,
            };
            const response = await saveMainsAttempt(payload);
            // Phase 3: discard if question changed during async save
            if (getCurrentQuestionContext().questionKey !== questionKeyAtStart) {
                console.warn("[ASYNC RESULT IGNORED] question changed during saveImprovedAttempt");
                return null;
            }
            if (response?.ok && response?.attemptId) {
                setAttemptId(response.attemptId);
                setAnswerSaveState("saved");
                setReviewUiMessage("Improved answer saved.");
                return response.attemptId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving improved attempt:", error);
            setAnswerSaveState("error");
            setAnswerSaveError("Could not save improved answer.");
            return null;
        }
    };

    const handleSubmitFix = async () => {
        const ctx = getCurrentQuestionContext();
        if (!fixDraft || !fixDraft.trim()) { setReviewUiError("Improved answer cannot be empty."); return; }
        setFixSaving(true);
        setReviewUiError("");
        try {
            // Update local answer text
            setPastedText(fixDraft);
            const attempt = {
                id: savedAttemptData?.id || `mains_attempt_${Date.now()}`,
                paper: ctx.paper,
                mode: ctx.mode,
                marks: ctx.marks,
                year: ctx.year,
                question: ctx.questionText,
                questionText: ctx.questionText,
                question_text: ctx.questionText,
                questionKey: ctx.questionKey,
                question_key: ctx.questionKey,
                questionId: ctx.questionId,
                question_id: ctx.questionId,
                answerText: fixDraft,
                wordCount: fixDraft.trim().split(/\s+/).length,
                targetWords: wordTarget,
                createdAt: new Date().toISOString(),
                improved: true,
                improvedAt: new Date().toISOString(),
            };
            setSavedAttemptData(attempt);
            setSaved(true);
            setIsImproved(true);

            // Persist to backend
            const savedId = await handleSaveImprovedAttempt(fixDraft);

            if (savedId) {
                // compute small before/after single-line comparison
                const firstNonEmpty = (s) => {
                    if (!s) return "";
                    const lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    return lines.length ? lines[0] : (s.split(/\r?\n/)[0] || "");
                };
                const before = firstNonEmpty(fixOriginalSnippet || "");
                const after = firstNonEmpty(fixDraft || "");
                setLastImprovement({ before, after });

                // Mark improved and scroll to top so user sees badge/comparison
                setIsImproved(true);
                setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} }, 80);
            }

            // Exit fix mode and hide review
            setFixModeActive(false);
            setFixDraft("");
            setFixTask("");
        } catch (e) {
            console.error(e);
            setReviewUiError("Could not save improved answer.");
        } finally {
            setFixSaving(false);
        }
    };

    // ─── Finalize Attempt → save to PostgreSQL ────────────────────────────────
    const handleFinalize = async () => {
        if (finalizeState === "saving") return;
        const ctx = getCurrentQuestionContext();
        // Phase 2 guard: block invalid question context
        const ctxGuard = validateSaveContext(ctx);
        if (!ctxGuard.ok) {
            console.warn(ctxGuard.reason, ctx);
            setFinalizeError("Cannot save: question context is invalid. Navigate away and back, then retry.");
            return;
        }
        const questionKeyAtStart = ctx.questionKey;
        setFinalizeState("saving");
        setFinalizeError("");

        // Derive a stable attemptId (reuse existing or generate new)
        const existingAttemptId = attemptId
            || `mains_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const payload = {
            attemptId:          existingAttemptId,
            userId:             "user_1",
            question:           ctx.questionText,
            questionText:       ctx.questionText,
            question_text:      ctx.questionText,
            questionKey:        ctx.questionKey,
            question_key:       ctx.questionKey,
            questionId:         ctx.questionId,
            question_id:        ctx.questionId,
            paper:              ctx.paper,
            year:               ctx.year,
            subject:            ctx.subject || topic || "",
            topic:              ctx.topicNodeId || ctx.answerType || topic || "",
            marks:              parseInt(ctx.marks),
            wordLimit:          ctx.wordLimit,
            workspace:          ctx.workspace || "",
            answerType:         ctx.answerType || "",
            finalAnswerText:    pastedText.trim(),
            extractedText:      pastedText.trim(),
            answerSource:       hasPages ? "uploaded" : "typed",
            uploadedPagesMeta:  uploadedPages.map((pg, idx) => ({ pageNo: idx + 1, fileName: pg.file?.name || `page_${idx+1}.jpg` })),
            basicReview:        evaluationData || null,
            air1RawReview:      air1ReviewText || "",
            air1ParsedJson:     parsedAir1Json || null,
            currentScore:       String(parsedAir1Json?.score || evaluationData?.score || ""),
            targetScore:        String(parsedAir1Json?.potentialScore || ""),
            status:             "finalized",
        };

        console.log("[mains-attempt] saving", { userId: payload.userId, attemptId: payload.attemptId, status: payload.status });

        try {
            const res = await saveMainsAttemptToDB(payload);
            // Phase 3: discard if question changed during async finalize
            if (getCurrentQuestionContext().questionKey !== questionKeyAtStart) {
                console.warn("[ASYNC RESULT IGNORED] question changed during finalize");
                setFinalizeState("idle");
                return;
            }
            if (res?.ok && res?.attemptId) {
                console.log("[mains-attempt] saved", res);
                setAttemptId(res.attemptId);
                setDbAttempt(payload);
                setSaved(true);
                setFinalizeState("saved");
                
                if (res.loopStatus === "generated") {
                    setReviewUiMessage("Saved to Mistake Book and Revision Queue.");
                } else if (res.loopStatus === "failed") {
                    setReviewUiMessage("Attempt saved. Learning loop sync pending.");
                } else {
                    setReviewUiMessage("Attempt saved successfully.");
                }

                // Also run the old backend pipeline save (for intelligence/patterns)
                handleSaveAttemptWithBackend().catch(() => {});
            } else {
                throw new Error(res?.error || "Unknown error");
            }
        } catch (err) {
            console.error("[mains-attempt] save failed", err);
            setFinalizeState("error");
            setFinalizeError("Save failed. Please retry.");
        }
    };

    const handleOpenMistakeBook    = () => navigate("/mains/mistakes");
    const handleOpenRevisionTasks  = () => navigate("/revision");

    // ─── Derived values ───────────────────────────────────────────────────────
    const wordCount  = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
    const wordPct    = Math.min(Math.round((wordCount / wordTarget) * 100), 100);
    const finalAnswerText   = pastedText.trim();
    const canCopyReviewPrompt = !!currentCtx.questionText && !!finalAnswerText;
    const canSaveReview     = !!attemptId && externalReviewText.trim().length >= 200;
    const canProcessReview  = !!attemptId && !!reviewId && reviewSaveState === "saved";

    const compactSteps = [
        { label: "Attempt",      done: sessionStarted },
        { label: "Write & Verify",   done: hasEvaluationText },
        { label: "Evaluate & Finalize", done: !!attemptId || saved },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    
    if (reviewModeActive && parsedAir1Json) {
        return (
            <Air1ReviewMode 
                data={parsedAir1Json} 
                rawReviewText={air1ReviewText} 
                uploadedPages={uploadedPages} 
                finalAnswerText={finalAnswerText}
                marks={currentCtx.marks}
                questionText={currentCtx.questionText}
                paper={currentCtx.paper}
                year={currentCtx.year}
                wordLimit={currentCtx.wordLimit || currentCtx.word_limit || currentCtx.maxWords || currentCtx.max_words}
                onFinalize={() => { setReviewModeActive(false); handleFinalize(); }}
                onExit={() => setReviewModeActive(false)}
            />
        );
    }


    const isDark = theme === "dark";
    
    const getNextAction = () => {
        if (!sessionStarted) return { text: "Read question and start the attempt timer.", cta: "Start Attempt", action: handleStartSession, primary: true };
        if (!hasPastedText) return { text: "Type your answer in the workspace below (minimum 20 characters).", cta: "Evaluate Answer", action: () => {}, primary: false };
        if (!hasEvaluationText) return { text: "Run basic evaluation to get initial scores.", cta: "Evaluate Answer", action: handleBasicReview, primary: true };
        if (!parsedAir1Json && !air1ReviewText) return { text: "Copy prompt, run in AIR-1 Evaluator, and paste review back.", cta: "Generate AIR-1 Prompt", action: handleCopyReviewPrompt, primary: true };
        if (!saved) return { text: "Finalize this attempt to save intelligence to your profile.", cta: finalizeState === "saving" ? "Saving…" : "Finalize Attempt", action: handleFinalize, primary: true };
        return { text: "Attempt completed successfully. Great job!", cta: "Next Question", action: handleNext, primary: false };
    };

    const nextAction = getNextAction();

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
            
            {/* 1. Premium Header */}
            <div style={{
                borderBottom: `1px solid ${T.borderMid}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(248, 250, 252, 0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 30
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: T.subtle, cursor: "pointer", fontSize: 20 }}>←</button>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>Mains Answer Review</div>
                        <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Write, evaluate, improve, and save intelligence from every answer.</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusChip status={pageStatus} />
                    <button onClick={toggleTheme} style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.textBright, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                        {isDark ? "☀️ Light" : "🌙 Dark"}
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: "100%", margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 24px", overflowX: "hidden", boxSizing: "border-box" }}>
                
                {/* 2. Hero Summary Card */}
                {sessionStarted && (
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 32, display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                        <div style={{ display: "flex", gap: isMobile ? 16 : 32, flexDirection: isMobile ? "column" : "row" }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>{parsedAir1Json?.score ? "Current Score" : evaluationData?.score ? "Quick Score" : "Current Score"}</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: parsedAir1Json?.score ? T.primaryAccent : evaluationData?.score ? T.amber : T.dim }}>{parsedAir1Json?.score || evaluationData?.score || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Target Score</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: T.textBright }}>{parsedAir1Json?.potentialScore || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "16px 0" : "0 24px", borderLeft: isMobile ? "none" : `1px solid ${T.borderMid}`, borderRight: isMobile ? "none" : `1px solid ${T.borderMid}`, borderTop: isMobile ? `1px solid ${T.borderMid}` : "none", borderBottom: isMobile ? `1px solid ${T.borderMid}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, textTransform: "uppercase", marginBottom: 8 }}>Examiner Impression</div>
                            <div style={{ fontSize: 14, color: parsedAir1Json?.examinerImpression ? T.textBright : T.dim, fontStyle: "italic", lineHeight: 1.5 }}>
                                {parsedAir1Json?.examinerImpression ? `"${parsedAir1Json.examinerImpression}"` : "Awaiting detailed AIR-1 evaluation..."}
                            </div>
                        </div>
                        <div style={{ textAlign: isMobile ? "left" : "right", minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Next Action</div>
                            <button onClick={nextAction.action} style={{ background: nextAction.primary ? T.primaryAccent : T.surfaceHigh, color: nextAction.primary ? "#fff" : T.textBright, border: `1px solid ${nextAction.primary ? T.primaryAccent : T.borderMid}`, padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", width: "100%", transition: "all 0.2s", whiteSpace: "normal" }}>
                                {nextAction.cta}
                            </button>
                            <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>{nextAction.text}</div>
                        </div>
                    </div>
                )}

                {/* 3. Two-Column Layout */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: isMobile ? 24 : 32, alignItems: "start", width: "100%", maxWidth: "100%" }}>
                    
                    {/* Left Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0, gridColumn: "1", gridRow: isMobile ? "auto" : "1", maxWidth: "100%" }}>
                        
                        {/* Mission Stepper */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(180deg, ${T.surface}, ${T.bg})`, border: `1px solid ${T.borderMid}`, borderRadius: 16, padding: "20px 24px", boxShadow: `inset 0 1px 0 ${T.innerGlow}, 0 4px 12px ${T.shadow}` }}>
                            {compactSteps.map((step, idx) => {
                                const isActive = !step.done && (idx === 0 || compactSteps[idx-1].done);
                                const isDone = step.done;
                                return (
                                    <React.Fragment key={idx}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 14, fontWeight: 800,
                                                background: isDone ? T.green : isActive ? `linear-gradient(135deg, ${T.primaryAccent}, #7C3AED)` : T.surfaceHigh,
                                                color: isDone || isActive ? "#fff" : T.subtle,
                                                border: `2px solid ${isDone ? T.green : isActive ? "transparent" : T.borderMid}`,
                                                boxShadow: isActive ? `0 0 16px ${T.primaryAccent}40` : "none",
                                                transition: "all 0.3s"
                                            }}>
                                                {isDone ? "✓" : (idx + 1)}
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: isActive || isDone ? 800 : 600, color: isDone ? T.textBright : isActive ? T.primaryAccent : T.dim, letterSpacing: "0.02em" }}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < compactSteps.length - 1 && (
                                            <div style={{ flex: 1, height: 2, background: isDone ? T.green : T.borderMid, opacity: 0.5, margin: "0 16px", borderRadius: 2 }} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {practiceMode === "typed" ? (
                            <>
                                {/* Question Card */}
                                <div style={{ 
                                    background: `linear-gradient(180deg, ${T.surface}, ${T.bg})`,
                                    border: `1px solid ${T.borderMid}`,
                                    borderLeft: `4px solid ${T.primaryAccent}`,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    boxShadow: `0 8px 32px ${T.shadow}, inset 0 1px 0 ${T.innerGlow}`
                                }}>
                                    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: 24 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.borderMid}` }}>{currentCtx.paper}</span>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.borderMid}` }}>{currentCtx.year || "UPSC PYQ"}</span>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.borderMid}` }}>{marks}M / {wordTarget} W</span>
                                            </div>
                                            {currentCtx.priority && (
                                                <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", background: `linear-gradient(135deg, ${T.primaryAccent}, #7C3AED)`, padding: "6px 14px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase", boxShadow: `0 2px 12px ${T.primaryAccent}40` }}>
                                                    ✨ AIR-1 Priority
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ 
                                            fontSize: isMobile ? 18 : 22, 
                                            fontWeight: 700, 
                                            color: T.textBright, 
                                            lineHeight: 1.6, 
                                            whiteSpace: "normal", 
                                            wordBreak: "normal", 
                                            overflowWrap: "break-word", 
                                            minWidth: 0,
                                            maxWidth: "92%",
                                            letterSpacing: "-0.01em",
                                        }}>{currentCtx.questionText}</div>
                                        {!sessionStarted && (
                                            <button onClick={handleStartSession} style={{ background: `linear-gradient(135deg, ${T.primaryAccent}, #4F46E5)`, color: "#fff", padding: "14px 28px", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer", width: "fit-content", marginTop: 8, fontSize: 15, boxShadow: `0 4px 16px ${T.primaryAccent}40`, transition: "all 0.2s", letterSpacing: "0.02em" }}>
                                                Start Attempt Timer
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Candidate Answer Card */}
                                {sessionStarted && (
                                    <SectionCard accentTop={T.blue}>
                                        <div style={{ padding: 32 }}>
                                            <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, marginBottom: 24, letterSpacing: "-0.01em" }}>Your Answer</div>
                                            <textarea
                                                value={pastedText}
                                                onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
                                                rows={8}
                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                                placeholder="Your answer text..."
                                            />
                                            <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Words: {wordCount} / {wordTarget}</div>
                                        </div>
                                    </SectionCard>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Upload Mode Workspace */}
                                {!ocrExtracted ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                                        {/* Source selector & Metadata Fields */}
                                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
                                            <h3 style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, marginTop: 0 }}>Source Type</h3>
                                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                                {["pyq", "institute", "custom"].map((opt) => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => { setUploadMeta(prev => ({ ...prev, sourceOption: opt })); }}
                                                        style={{
                                                            padding: "8px 16px",
                                                            borderRadius: 8,
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            border: "none",
                                                            background: uploadMeta.sourceOption === opt ? T.primaryAccent : T.surfaceHigh,
                                                            color: uploadMeta.sourceOption === opt ? "#fff" : T.text,
                                                            cursor: "pointer",
                                                            textTransform: "capitalize",
                                                            transition: "background 0.2s"
                                                        }}
                                                    >
                                                        {opt === "pyq" ? "UPSC PYQ" : opt === "institute" ? "Institute Test" : "Custom Practice"}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Meta Options Grid */}
                                            <div style={{
                                                display: "grid",
                                                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))",
                                                gap: 16,
                                                marginTop: 20,
                                                borderTop: `1px solid ${T.border}`,
                                                paddingTop: 16
                                            }}>
                                                {uploadMeta.sourceOption === "pyq" && (
                                                    <>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                                                            <select 
                                                                value={uploadMeta.paper} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, paper: e.target.value }))}
                                                                style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            >
                                                                {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Year</label>
                                                            <input 
                                                                type="number" 
                                                                placeholder="e.g. 2023"
                                                                value={uploadMeta.year} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, year: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Question No.</label>
                                                            <input 
                                                                type="text" 
                                                                placeholder="e.g. 3a"
                                                                value={uploadMeta.questionNumber} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, questionNumber: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {uploadMeta.sourceOption === "institute" && (
                                                    <>
                                                        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Institute Name</label>
                                                            <input 
                                                                type="text" 
                                                                placeholder="Vision IAS, Forum IAS..."
                                                                value={uploadMeta.instituteName || ""} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, instituteName: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Test Name / Code</label>
                                                            <input 
                                                                type="text" 
                                                                placeholder="Mains Test 4..."
                                                                value={uploadMeta.testName || ""} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, testName: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                                                            <select 
                                                                value={uploadMeta.paper} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, paper: e.target.value }))}
                                                                style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            >
                                                                {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Question No.</label>
                                                            <input 
                                                                type="text" 
                                                                value={uploadMeta.questionNumber} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, questionNumber: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {uploadMeta.sourceOption === "custom" && (
                                                    <>
                                                        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Subject / Topic</label>
                                                            <input 
                                                                type="text" 
                                                                placeholder="e.g. Art & Culture, Internal Security"
                                                                value={uploadMeta.subjectTopic || ""} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, subjectTopic: e.target.value }))}
                                                                style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                                                            <select 
                                                                value={uploadMeta.paper} 
                                                                onChange={e => setUploadMeta(prev => ({ ...prev, paper: e.target.value }))}
                                                                style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                            >
                                                                {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                    </>
                                                )}

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Marks</label>
                                                    <select 
                                                        value={uploadMeta.marks} 
                                                        onChange={e => setUploadMeta(prev => ({ ...prev, marks: e.target.value }))}
                                                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                    >
                                                        {["10", "15", "20", "250"].map(m => <option key={m} value={m}>{m} Marks</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Word Limit</label>
                                                    <select 
                                                        value={uploadMeta.wordLimit} 
                                                        onChange={e => setUploadMeta(prev => ({ ...prev, wordLimit: e.target.value }))}
                                                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                                                    >
                                                        {["150", "250", "1000", "2000"].map(w => <option key={w} value={w}>{w} Words</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ONE Upload Card */}
                                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
                                            <h3 style={{ fontSize: 14, fontWeight: 800, color: T.textBright, margin: "0 0 16px 0" }}>Upload Question + Answer Sheet</h3>
                                            <div 
                                                onClick={() => fileInputRef.current.click()}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={handleDrop}
                                                style={{
                                                    border: `2px dashed ${isDragging ? T.primaryAccent : T.borderMid}`,
                                                    borderRadius: 8,
                                                    padding: "32px 20px",
                                                    textAlign: "center",
                                                    cursor: "pointer",
                                                    background: isDragging ? `${T.primaryAccent}08` : "transparent",
                                                    transition: "all 0.2s"
                                                }}
                                            >
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    multiple 
                                                    accept="image/*,application/pdf" 
                                                    onChange={(e) => addFiles(e.target.files)} 
                                                    style={{ display: "none" }} 
                                                />
                                                <div style={{ fontSize: 24, marginBottom: 8 }}>📤</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright }}>
                                                    Click or drag files here to upload
                                                </div>
                                                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                                                    Supports images and PDFs (max {MAX_PAGES} pages)
                                                </div>
                                            </div>

                                            {uploadedPages.length > 0 && (
                                                <div style={{ marginTop: 20 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Uploaded Pages ({uploadedPages.length})</div>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                        {uploadedPages.map((pg, idx) => (
                                                            <div key={idx} style={{ position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.borderMid}` }}>
                                                                {pg.file?.type === "application/pdf" ? (
                                                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.surfaceHigh, fontSize: 12, fontWeight: 800, color: T.red }}>PDF</div>
                                                                ) : (
                                                                    <img src={pg.preview} alt={`Page ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                )}
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleRemovePage(idx)}
                                                                    style={{
                                                                        position: "absolute",
                                                                        top: 2,
                                                                        right: 2,
                                                                        background: T.red,
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: "50%",
                                                                        width: 18,
                                                                        height: 18,
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        fontSize: 10,
                                                                        cursor: "pointer",
                                                                        fontWeight: "bold"
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {reviewUiError && (
                                            <div style={{ background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 8, padding: 12, fontSize: 13, color: T.red }}>
                                                ⚠️ {reviewUiError}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            disabled={isExtracting || uploadedPages.length === 0}
                                            onClick={handleExtractQuestionAnswer}
                                            style={{
                                                width: "100%",
                                                background: isExtracting ? T.muted : T.primaryGradient,
                                                color: "#ffffff",
                                                border: "none",
                                                borderRadius: 8,
                                                fontWeight: 950,
                                                fontSize: 14,
                                                padding: "14px 20px",
                                                cursor: isExtracting || uploadedPages.length === 0 ? "not-allowed" : "pointer",
                                                transition: "all 0.2s"
                                            }}
                                        >
                                            {isExtracting ? "🔍 Extracting Question & Answer (Gemini OCR)..." : "🔍 Extract & Verify"}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                                        {/* Verification View */}
                                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
                                            <h3 style={{ fontSize: 16, fontWeight: 900, color: T.textBright, marginBottom: 8, letterSpacing: "-0.01em" }}>Verify Extracted Text</h3>
                                            <p style={{ fontSize: 13, color: T.dim, marginBottom: 20 }}>
                                                Verify and edit the separated question, answer sheet text, and detected metadata below before running reviews.
                                            </p>

                                            {/* Metadata Editor Grid */}
                                            <div style={{
                                                display: "grid",
                                                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                                                gap: 16,
                                                background: T.surfaceHigh,
                                                padding: 20,
                                                borderRadius: 10,
                                                border: `1px solid ${T.borderMid}`,
                                                marginBottom: 24
                                            }}>
                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Paper</label>
                                                    <select
                                                        value={uploadMeta.paper || "GS1"}
                                                        onChange={(e) => handleUpdateUploadMeta({ paper: e.target.value })}
                                                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, outline: "none", fontFamily: T.font, fontSize: 13 }}
                                                    >
                                                        {["GS1", "GS2", "GS3", "GS4", "Essay", "Geography Optional", "Ethics", "Optional"].map(p => (
                                                            <option key={p} value={p}>{p}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject</label>
                                                    <input
                                                        type="text"
                                                        value={uploadMeta.subjectTopic || ""}
                                                        onChange={(e) => handleUpdateUploadMeta({ subjectTopic: e.target.value })}
                                                        placeholder="e.g. History"
                                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, outline: "none", fontFamily: T.font, fontSize: 13 }}
                                                    />
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Topic</label>
                                                    <input
                                                        type="text"
                                                        value={uploadMeta.detectedTopic || ""}
                                                        onChange={(e) => handleUpdateUploadMeta({ detectedTopic: e.target.value })}
                                                        placeholder="e.g. Bhakti Movement"
                                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, outline: "none", fontFamily: T.font, fontSize: 13 }}
                                                    />
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Marks</label>
                                                    <select
                                                        value={uploadMeta.marks || "15"}
                                                        onChange={(e) => handleUpdateUploadMeta({ marks: e.target.value })}
                                                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, outline: "none", fontFamily: T.font, fontSize: 13 }}
                                                    >
                                                        {["10", "15", "20"].map(m => (
                                                            <option key={m} value={m}>{m} Marks</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Word Limit</label>
                                                    <select
                                                        value={uploadMeta.wordLimit || "250"}
                                                        onChange={(e) => handleUpdateUploadMeta({ wordLimit: e.target.value })}
                                                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, outline: "none", fontFamily: T.font, fontSize: 13 }}
                                                    >
                                                        {["150", "250", "1000", "2000"].map(w => (
                                                            <option key={w} value={w}>{w} Words</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6 }}>OCR Confidence</label>
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        height: "34px",
                                                        padding: "0 10px",
                                                        borderRadius: 8,
                                                        background: T.bg,
                                                        border: `1px solid ${T.borderMid}`,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: T.green
                                                    }}>
                                                        {(() => {
                                                            const conf = uploadMeta.confidence || {};
                                                            const avg = Math.round(
                                                                ((conf.questionText || 0.95) +
                                                                 (conf.answerText || 0.9) +
                                                                 (conf.paper || 0.85) +
                                                                 (conf.subject || 0.8)) / 4 * 100
                                                            );
                                                            return `⚡ ${avg}% Accuracy`;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                                <div>
                                                    <label style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>1. Question Text</label>
                                                    <textarea
                                                        value={verifiedQuestionText}
                                                        onChange={(e) => handleVerifiedQuestionChange(e.target.value)}
                                                        rows={4}
                                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 14, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                                        placeholder="Verify extracted question text here..."
                                                    />
                                                </div>

                                                <div>
                                                    <label style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>2. Candidate Answer</label>
                                                    <textarea
                                                        value={pastedText}
                                                        onChange={(e) => handleVerifiedAnswerChange(e.target.value)}
                                                        rows={12}
                                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 14, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                                        placeholder="Verify extracted candidate answer text here..."
                                                    />
                                                </div>
                                            </div>

                                            {reviewUiError && (
                                                <div style={{ background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 8, padding: 12, fontSize: 13, color: T.red, marginTop: 16 }}>
                                                    ⚠️ {reviewUiError}
                                                </div>
                                            )}

                                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        clearVisibleAttemptState();
                                                        navigate("/mains");
                                                    }}
                                                    style={{
                                                        padding: "12px 20px",
                                                        borderRadius: 8,
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        background: "transparent",
                                                        color: T.dim,
                                                        border: `1px solid ${T.borderMid}`,
                                                        cursor: "pointer"
                                                    }}
                                                >
                                                    ← Cancel & Go Back
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isEvaluating || !verifiedQuestionText.trim() || !pastedText.trim()}
                                                    onClick={handleBasicReview}
                                                    style={{
                                                        flex: 1,
                                                        background: T.primaryGradient,
                                                        color: "#ffffff",
                                                        border: "none",
                                                        borderRadius: 8,
                                                        fontWeight: 900,
                                                        fontSize: 13,
                                                        padding: "12px 20px",
                                                        cursor: (isEvaluating || !verifiedQuestionText.trim() || !pastedText.trim()) ? "not-allowed" : "pointer"
                                                    }}
                                                >
                                                    {isEvaluating ? "Evaluating..." : "Run Basic Review"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div> {/* End Left Column */}

                    {/* Full-width container for Reviews */}
                    <div style={{ gridColumn: "1 / -1", width: "100%", maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
                        {/* Basic Review Card */}
                        {hasPastedText && (
                            <SectionCard accentTop={T.amber}>
                                <div style={{ padding: 32 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
                                        <div>
                                            <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, letterSpacing: "-0.01em" }}>Quick Mentor Review</div>
                                            <div style={{ fontSize: 14, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>Understand your score, missing dimensions, and rewrite direction in 30 seconds.</div>
                                        </div>
                                        <button onClick={handleBasicReview} disabled={isEvaluating} style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.textBright, padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                                            {isEvaluating ? "Evaluating..." : "Run Quick Review"}
                                        </button>
                                    </div>
                                    
                                    {evaluationData && evaluationData.level !== "Format Issue" && evaluationData.level !== "Error" && (evaluationData.examinerImpression || evaluationData.topFixes || evaluationData.level) ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                            {/* Top Summary Strip */}
                                            <div style={{ display: "flex", gap: 16, background: T.surfaceHigh, padding: isMobile ? "16px" : "16px 24px", borderRadius: 12, border: `1px solid ${T.borderMid}`, alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap" }}>
                                                <div style={{ flex: isMobile ? "none" : "1 1 120px", width: "100%" }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Score</div>
                                                    <div style={{ fontSize: 24, fontWeight: 900, color: T.amber, lineHeight: 1 }}>{evaluationData.score}</div>
                                                </div>
                                                <div style={{ flex: isMobile ? "none" : "1 1 120px", borderLeft: isMobile ? "none" : `1px solid ${T.borderMid}`, borderTop: isMobile ? `1px solid ${T.borderMid}` : "none", paddingLeft: isMobile ? 0 : 16, paddingTop: isMobile ? 12 : 0, width: "100%" }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Level</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright, background: T.bg, padding: "4px 10px", borderRadius: 12, border: `1px solid ${T.borderMid}`, width: "fit-content" }}>{evaluationData.level || "Beginner"}</div>
                                                </div>
                                                {evaluationData.finalAdvice && (
                                                <div style={{ flex: isMobile ? "none" : "2 1 200px", borderLeft: isMobile ? "none" : `1px solid ${T.borderMid}`, borderTop: isMobile ? `1px solid ${T.borderMid}` : "none", paddingLeft: isMobile ? 0 : 16, paddingTop: isMobile ? 12 : 0, width: "100%" }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Next Action</div>
                                                    <div style={{ fontSize: 14, color: T.textBright, fontWeight: 600, lineHeight: 1.5, overflowWrap: "break-word" }}>{evaluationData.finalAdvice}</div>
                                                </div>
                                                )}
                                            </div>

                                            {/* Examiner Impression */}
                                            {evaluationData.examinerImpression && (
                                                <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>30-Second Examiner Impression</div>
                                                    <div style={{ fontSize: 15, color: T.textBright, lineHeight: 1.65 }}>{evaluationData.examinerImpression}</div>
                                                </div>
                                            )}

                                            {/* Top 3 Fixes */}
                                            {evaluationData.topFixes && evaluationData.topFixes.length > 0 && (
                                                <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.red, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Top 3 Fixes</div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                        {evaluationData.topFixes.map((fix, i) => (
                                                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.bg, padding: 12, borderRadius: 8, border: `1px solid ${T.borderMid}` }}>
                                                                <div style={{ background: T.surfaceHigh, color: T.red, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                                                <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6 }}>{fix}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* UPSC Structure */}
                                            {evaluationData.upscStructure && Array.isArray(evaluationData.upscStructure) && evaluationData.upscStructure.length > 0 && (
                                                <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Suggested Answer Structure</div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                                        {evaluationData.upscStructure.map((struct, i) => (
                                                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                                                <div style={{ background: T.bg, color: T.blue, width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                                                                <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6 }}>{struct}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {evaluationData.upscStructure && typeof evaluationData.upscStructure === 'string' && (
                                                <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Suggested Answer Structure</div>
                                                    <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{evaluationData.upscStructure}</div>
                                                </div>
                                            )}

                                            {/* Rewrite Toolkit Grid */}
                                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                                                {/* Missing Dimensions */}
                                                {evaluationData.missingDimensions && evaluationData.missingDimensions.length > 0 && (
                                                    <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Missing UPSC Dimensions</div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                            {evaluationData.missingDimensions.map((dim, i) => (
                                                                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                                                    <span style={{ color: T.amber, fontSize: 14 }}>•</span>
                                                                    <span style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6 }}>{dim}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Improved Intro */}
                                                {evaluationData.improvedIntro && (
                                                    <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Improved Introduction</div>
                                                        <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6 }}>{evaluationData.improvedIntro}</div>
                                                    </div>
                                                )}
                                                
                                                {/* Improved Conclusion */}
                                                {evaluationData.improvedConclusion && (
                                                    <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Improved Conclusion</div>
                                                        <div style={{ fontSize: 14, color: T.textBright, lineHeight: 1.6 }}>{evaluationData.improvedConclusion}</div>
                                                    </div>
                                                )}


                                            </div>

                                            {/* Final Advice */}
                                            {evaluationData.finalAdvice && (
                                                <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}`, borderLeft: `4px solid ${T.amber}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Before rewriting, do this</div>
                                                    <div style={{ fontSize: 15, color: T.textBright, lineHeight: 1.6, fontWeight: 600 }}>{evaluationData.finalAdvice}</div>
                                                </div>
                                            )}
                                        </div>
                                    ) : evaluationText ? (
                                        <div style={{ background: T.surfaceHigh, padding: 24, borderRadius: 12, border: `1px solid ${T.borderMid}` }}>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, marginBottom: 4 }}>Mentor Notes</div>
                                            <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>Structured review was not available, so showing raw mentor feedback.</div>
                                            <div style={{ 
                                                fontSize: 14, 
                                                color: T.textBright, 
                                                lineHeight: 1.7, 
                                                whiteSpace: "pre-wrap", 
                                                maxHeight: "400px", 
                                                overflowY: "auto",
                                                fontFamily: T.font
                                            }}>
                                                {evaluationText}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: 32, textAlign: "center", color: T.dim, fontSize: 14, background: T.surfaceHigh, borderRadius: 12, border: `1px dashed ${T.borderMid}` }}>
                                            Paste your answer text and click "Run Quick Review" to get a mentor evaluation.
                                        </div>
                                    )}
                                </div>
                            </SectionCard>
                        )}

                        {/* Advanced AIR-1 Review Card */}
                        {hasEvaluationText && (
                            <SectionCard accentTop={T.purple}>
                                <div style={{ padding: 32 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, marginBottom: 24, letterSpacing: "-0.01em" }}>Advanced AIR-1 Review</div>
                                    <MainsReviewPromptCard
                                        currentQuestion={{ text: currentCtx.questionText, marks: parseInt(currentCtx.marks), paper: currentCtx.paper, topic: topic, syllabusNode: syllabusNodeId }}
                                        finalAnswerText={finalAnswerText}
                                        papersAccent={paperAccent}
                                        wordTarget={wordTarget}
                                        onCopyPrompt={handleCopyReviewPrompt}
                                        onOpenChatGPT={handleOpenChatGPTReview}
                                        canCopyReviewPrompt={canCopyReviewPrompt}
                                        promptCopied={reviewPromptCopied}
                                    />
                                    <div style={{ marginTop: 24 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 8, textTransform: "uppercase" }}>Import AIR-1 Output</div>
                                        <textarea
                                            value={air1JsonText || air1ReviewText}
                                            onChange={(e) => handleAir1ReviewChange(e.target.value)}
                                            rows={6}
                                            style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${air1ReviewText.trim() ? T.purple : T.borderMid}`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                            placeholder="Paste AIR-1 Evaluator result..."
                                        />
                                    </div>
                                    {parsedAir1Json && (
                                        <button
                                            className="awp-premium-btn"
                                            onClick={() => setReviewModeActive(true)}
                                            style={{
                                                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                                                color: "#fff",
                                                padding: "14px 24px",
                                                borderRadius: 10,
                                                border: "none",
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                width: "100%",
                                                marginTop: 16,
                                                fontSize: 15,
                                                letterSpacing: "0.01em",
                                                boxShadow: "0 6px 20px rgba(124, 58, 237, 0.40), 0 2px 6px rgba(0,0,0,0.12)",
                                                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                                            }}
                                        >
                                            ✨ View Premium Report
                                        </button>
                                    )}
                                </div>
                            </SectionCard>
                        )}
                        
                    </div> {/* End Full-width container */}

                    {/* Hidden export area for PDF */}
                    <div id="air1-review-export-area" style={{ display: "none" }}>
                        {/* Content for PDF generation */}
                    </div>

                    {/* Right Column: Sticky Panel */}
                    <div style={{ position: isMobile ? "static" : "sticky", top: 100, display: "flex", flexDirection: "column", gap: 24, minWidth: 0, gridColumn: isMobile ? "1" : "2", gridRow: isMobile ? "auto" : "1", maxWidth: "100%" }}>
                        {sessionStarted && practiceMode !== "upload" && (
                            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                                <Timer key={currentIndex} marks={marks} accent={paperAccent} autoStart={sessionStarted} timerRef={timerSectionRef} onStatusChange={setTimerStatus} />
                            </div>
                        )}
                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: saved ? T.green : T.amber }}></span>
                                Attempt Intelligence
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Words</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{wordCount} / {wordTarget}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Pages</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{uploadedPages.length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>State</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{saved ? "Finalized" : "Draft"}</span>
                                </div>
                            </div>
                            
                            {parsedAir1Json?.whyMarksLost && (
                                <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.borderMid}` }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 12, textTransform: "uppercase" }}>Top Weaknesses</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {parsedAir1Json.whyMarksLost.slice(0, 3).map((w, i) => (
                                            <div key={i} style={{ fontSize: 13, color: T.textBright, lineHeight: 1.4, display: "flex", gap: 8 }}>
                                                <span style={{ color: T.red, flexShrink: 0 }}>•</span> <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                                {parsedAir1Json && (
                                    <button
                                        type="button"
                                        disabled={isDownloadingPdf}
                                        onClick={async () => {
                                            setIsDownloadingPdf(true);
                                            await new Promise(resolve => setTimeout(resolve, 100)); // allow render tick for UI & off-screen mount
                                            try {
                                                await downloadAir1ReviewPdf({
                                                    data: parsedAir1Json,
                                                    questionText: currentCtx.questionText,
                                                    marks: currentCtx.marks,
                                                    paper: currentCtx.paper,
                                                    year: currentCtx.year,
                                                    fileName: "MentorOS-AIR1-Review.pdf",
                                                });
                                            } finally {
                                                setIsDownloadingPdf(false);
                                            }
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        style={{
                                            borderRadius: "10px",
                                            border: `1.5px solid ${T.borderMid}`,
                                            background: T.surfaceHigh,
                                            color: T.textBright,
                                            padding: "13px 16px",
                                            fontWeight: 800,
                                            fontSize: "14px",
                                            cursor: isDownloadingPdf ? "not-allowed" : "pointer",
                                            opacity: isDownloadingPdf ? 0.7 : 1,
                                            width: "100%",
                                            textAlign: "center",
                                            boxShadow: "0 4px 14px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.10)",
                                            transition: "all 0.15s ease",
                                        }}
                                    >
                                        {isDownloadingPdf ? "Preparing PDF..." : "⬇ Download AIR-1 Review"}
                                    </button>
                                )}
                                <button
                                    className="awp-finalize-btn"
                                    onClick={handleFinalize}
                                    disabled={!hasPastedText || saved}
                                    style={{
                                        background: saved
                                            ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                                            : hasPastedText
                                                ? "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
                                                : "#e2e8f0",
                                        color: hasPastedText || saved ? "#ffffff" : "#94a3b8",
                                        border: "none",
                                        padding: "13px 16px",
                                        borderRadius: 10,
                                        fontWeight: 800,
                                        cursor: hasPastedText && !saved ? "pointer" : "not-allowed",
                                        width: "100%",
                                        fontSize: 14,
                                        letterSpacing: "0.01em",
                                        boxShadow: hasPastedText && !saved
                                            ? "0 4px 14px rgba(124, 58, 237, 0.35), 0 1px 3px rgba(0,0,0,0.10)"
                                            : "none",
                                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                                    }}
                                >
                                    {saved ? "✓ Finalized" : "💾 Finalize Attempt"}
                                </button>
                                {!saved && <div style={{ fontSize: 11, color: T.dim, marginTop: 8, textAlign: "center" }}>Saves answer to your timeline.</div>}
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>

            {/* Hidden Export Area for PDF generation on normal page */}
            {!reviewModeActive && parsedAir1Json && (
                <div
                    style={{
                        position: "fixed",
                        left: "-10000px",
                        top: "0",
                        width: "980px",
                        background: "#ffffff",
                        pointerEvents: "none",
                        zIndex: -1,
                    }}
                >
                    <Air1ReviewMode 
                        data={parsedAir1Json} 
                        rawReviewText={air1ReviewText} 
                        uploadedPages={uploadedPages} 
                        finalAnswerText={finalAnswerText}
                        marks={currentCtx.marks}
                        questionText={currentCtx.questionText}
                        paper={currentCtx.paper}
                        year={currentCtx.year}
                        wordLimit={currentCtx.wordLimit || currentCtx.word_limit || currentCtx.maxWords || currentCtx.max_words}
                        onFinalize={handleFinalize}
                        onExit={() => {}}
                        appTheme={theme}
                    />
                </div>
            )}

            {/* ── AWP Premium Interaction Styles ── */}
            <style>{`
                .awp-img-card:hover {
                    transform: translateY(-3px) scale(1.02) !important;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08) !important;
                }
                .awp-close-btn:hover {
                    transform: scale(1.18) !important;
                    box-shadow: 0 4px 14px rgba(239,68,68,0.38) !important;
                    background: #fff5f5 !important;
                }
                .awp-upload-slot:hover {
                    border-color: #7c3aed !important;
                    background: #f3e8ff !important;
                }
                .awp-upload-slot:hover span {
                    color: #7c3aed !important;
                }
                .awp-finalize-btn:not(:disabled):hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 8px 22px rgba(124,58,237,0.45), 0 2px 6px rgba(0,0,0,0.12) !important;
                }
                .awp-finalize-btn:not(:disabled):active { transform: translateY(0) !important; }
                .awp-premium-btn:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 12px 32px rgba(124,58,237,0.52), 0 3px 8px rgba(0,0,0,0.14) !important;
                }
                .awp-premium-btn:active { transform: translateY(0) !important; }
            `}</style>
        </div>
    );
}

