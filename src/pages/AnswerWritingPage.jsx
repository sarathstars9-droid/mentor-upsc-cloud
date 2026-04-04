// src/pages/AnswerWritingPage.jsx
// Mains Answer Writing Workspace — v4
// UPSC-accurate timer: 10M=7min · 15M=11min · 20M=13min
// 5-second countdown before timer starts · audio bell on completion
// ChatGPT-assisted manual extraction — no OCR, no backend, no APIs.
// Multi-page answer upload (up to 5 pages).

import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainsMistakeTagger from "../components/mains/MainsMistakeTagger";
import MainsReviewPromptCard from "../components/mains/MainsReviewPromptCard";
import MainsPasteReviewCard from "../components/mains/MainsPasteReviewCard";
import MainsReviewResultCard from "../components/mains/MainsReviewResultCard";
import {
    saveMainsAttempt,
    saveMainsReview,
    processMainsReview,
    getMainsReviewResult,
} from "../utils/mainsReviewApi.js";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
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
    amberDim: "#d97706",
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#8b5cf6",
    font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

// ─── UPSC-accurate time limits ────────────────────────────────────────────────
const TIME_LIMITS = { "10": 7 * 60, "15": 11 * 60, "20": 13 * 60 };
const WORD_TARGETS = { "10": 150, "15": 200, "20": 250 };

// ─── Session context assembled from route state with safe fallback ────────────
const FALLBACK_SESSION = {
    paper: "GS1",
    paperAccent: T.amber,
    mode: "PYQ",
    marks: "15",
    year: 2023,
    structure: "Intro + 4–5 pts + Concl",
    focus: "Colonial impact on women — social reform context",
    priority: "UPSC PYQ · High Priority",
    question:
        "Explain how the women's question was central to the 19th-century Indian renaissance. Discuss the role of social reformers in transforming the condition of women in Indian society.",
};

const PAPER_ACCENT = {
    GS1: T.amber,
    GS2: T.blue,
    GS3: T.green,
};

function buildSession(routeState) {
    if (!routeState) return FALLBACK_SESSION;
    const q = routeState;
    const accent = PAPER_ACCENT[q.paper] || T.amber;
    return {
        paper:       q.paper      || "GS1",
        paperAccent: accent,
        mode:        q.mode       || "PYQ",
        marks:       String(q.marks || "15"),
        year:        q.year       || null,
        structure:   q.structure  || "Intro + 4–5 pts + Concl",
        focus:       q.focus      || "",
        priority:    q.priority   || "",
        question:    q.question   || "",
    };
}

// ─── ChatGPT extraction prompt — multi-page version ───────────────────────────
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

// ─── Audio bell (Web Audio API — no library needed) ──────────────────────────
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
    } catch (error) {
        // audio not available — silent fallback
        void error; // intentionally unused
    }
}

// ─── Shared style helpers ─────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
    fontSize: 11, fontWeight: 700,
    letterSpacing: "0.11em", textTransform: "uppercase", color,
});

const outlineBtn = (accent, size = "md") => ({
    background: "transparent", color: accent,
    border: `1px solid ${accent}44`, borderRadius: 8,
    fontWeight: 600,
    fontSize: size === "sm" ? 11 : 13,
    padding: size === "sm" ? "5px 12px" : "10px 20px",
    cursor: "pointer", fontFamily: T.font,
    letterSpacing: "0.03em", whiteSpace: "nowrap",
});

const primaryBtn = (accent, disabled = false) => ({
    background: disabled ? T.muted : accent,
    color: "#09090b", border: "none", borderRadius: 8,
    fontWeight: 900, fontSize: 13,
    padding: "11px 26px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.font, letterSpacing: "0.04em",
    opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
});

// ─── Micro-components ─────────────────────────────────────────────────────────
function InfoPill({ label, value, accent }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: 3,
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: "8px 14px", minWidth: 72,
        }}>
            <span style={{ ...label11(T.subtle), fontSize: 9 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent || T.textBright }}>
                {value}
            </span>
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
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, overflow: "hidden", ...extraStyle,
        }}>
            {accentTop && (
                <div style={{
                    height: 2,
                    background: `linear-gradient(90deg, ${accentTop}, ${accentTop}44, ${T.border})`,
                }} />
            )}
            {children}
        </div>
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

    // expose the DOM node to parent via timerRef so parent can scroll to it
    useEffect(() => {
        if (timerRef) timerRef.current = domRef.current;
    }, [timerRef]);

    // auto-start countdown when autoStart flips true
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
                : T.green;

    return (
        <div
            ref={domRef}
            style={{
                background: T.surface,
                border: `1px solid ${
                    phase === "done" ? T.red + "55"
                    : phase === "running" || phase === "countdown" ? accent + "55"
                    : T.border
                }`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: (phase === "running" || phase === "countdown")
                    ? `0 0 24px ${accent}22`
                    : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ ...label11(T.subtle), marginBottom: 4 }}>
                        Answer Timer · {marks}M ({Math.floor(timeLimit / 60)} min)
                    </div>
                    <div style={{ fontSize: 10, color: T.muted }}>
                        UPSC standard — {marks === "10" ? "7 min" : marks === "15" ? "11 min" : "13 min"} per question
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    {phase === "countdown" ? (
                        <div style={{
                            fontSize: 38, fontWeight: 900,
                            color: T.amber, letterSpacing: "-0.02em",
                            lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        }}>
                            {countdown}
                        </div>
                    ) : (
                        <div style={{
                            fontSize: 38, fontWeight: 900,
                            color: overTime ? T.red : phase === "done" ? T.red : T.textBright,
                            letterSpacing: "-0.02em", lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
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
                {phase !== "done" && (
                    <button
                        onClick={handleStart}
                        disabled={phase === "countdown"}
                        style={{
                            flex: 1,
                            background: phase === "idle" ? accent : T.surface,
                            color: phase === "idle" ? "#09090b" : T.text,
                            border: phase === "idle" ? "none" : `1px solid ${T.borderMid}`,
                            borderRadius: 8, fontWeight: 900, fontSize: 13,
                            padding: "10px 0",
                            cursor: phase === "countdown" ? "not-allowed" : "pointer",
                            fontFamily: T.font, letterSpacing: "0.04em",
                            opacity: phase === "countdown" ? 0.6 : 1,
                        }}
                    >
                        {phase === "idle" ? "▶  Start (5s countdown)"
                            : phase === "countdown" ? `Starting in ${countdown}…`
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
                    <button onClick={handleReset} style={{ ...outlineBtn(T.dim), padding: "10px 16px" }}>
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
    const SESSION = buildSession(location.state?.question);

    const marks = SESSION.marks;
    const timeLimit = TIME_LIMITS[marks] || TIME_LIMITS["15"];
    const wordTarget = WORD_TARGETS[marks] || 200;

    const [timerStatus, setTimerStatus] = useState(STATUSES.IDLE);
    const [sessionStarted, setSessionStarted] = useState(false);
    const timerSectionRef = useRef(null);

    // Multi-page upload — array of { file, preview } objects, max 5
    const [uploadedPages, setUploadedPages] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef();
    const hasPages = uploadedPages.length > 0;

    // ChatGPT handoff state
    const [promptCopied, setPromptCopied] = useState(false);
    const [pastedText, setPastedText] = useState("");
    const hasPastedText = pastedText.trim().length > 20;

    const navigate = useNavigate();

    // Attempt
    const [saved, setSaved] = useState(false);
    const [savedAttemptData, setSavedAttemptData] = useState(null);
    const [pageStatus, setPageStatus] = useState(STATUSES.IDLE);

    // ─── NEW: Mains review pipeline states ──────────────────────────────────
    const [attemptId, setAttemptId] = useState(null);
    const [reviewId, setReviewId] = useState(null);

    const [answerSaveState, setAnswerSaveState] = useState("idle"); // idle|saving|saved|error
    const [answerSaveError, setAnswerSaveError] = useState("");

    const [externalReviewText, setExternalReviewText] = useState("");
    const [reviewAgreement, setReviewAgreement] = useState("not_set"); // not_set|fully_agree|partly_agree|disagree
    const [reviewAgreementNote, setReviewAgreementNote] = useState("");

    const [reviewSaveState, setReviewSaveState] = useState("idle"); // idle|saving|saved|error
    const [reviewSaveError, setReviewSaveError] = useState("");

    const [reviewProcessState, setReviewProcessState] = useState("idle"); // idle|processing|processed|error
    const [reviewProcessError, setReviewProcessError] = useState("");

    const [processedReviewResult, setProcessedReviewResult] = useState(null);
    const [reviewResultData, setReviewResultData] = useState(null);

    // eslint-disable-next-line no-unused-vars
    const [reviewUiMessage, setReviewUiMessage] = useState("");
    const [reviewUiError, setReviewUiError] = useState("");
    
    const [reviewPromptCopied, setReviewPromptCopied] = useState(false);

    // Derived page status
    useEffect(() => {
        if (saved) setPageStatus(STATUSES.SAVED);
        else if (hasPastedText) setPageStatus(STATUSES.TEXT_PASTED);
        else if (promptCopied) setPageStatus(STATUSES.PROMPT_COPIED);
        else if (hasPages) setPageStatus(STATUSES.UPLOADED);
        else setPageStatus(timerStatus);
    }, [saved, hasPastedText, promptCopied, hasPages, timerStatus]);

    // Open ChatGPT and copy prompt
    const handleOpenChatGPT = async () => {
        try {
            await navigator.clipboard.writeText(CHATGPT_EXTRACTION_PROMPT);
        // eslint-disable-next-line no-unused-vars
        } catch (_) {
            // clipboard blocked — silent
        }
        setPromptCopied(true);
        window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
    };

    // Add image files (up to MAX_PAGES total)
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

    const handleSave = async () => {
        const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
        const attempt = {
            id:          `mains_attempt_${Date.now()}`,
            paper:       SESSION.paper,
            mode:        SESSION.mode,
            marks:       SESSION.marks,
            year:        SESSION.year,
            question:    SESSION.question,
            answerText:  pastedText,
            wordCount,
            targetWords: WORD_TARGETS[SESSION.marks] || 200,
            createdAt:   new Date().toISOString(),
        };
        // Persist to localStorage (always — safe fallback even if backend fails)
        try {
            const existing = JSON.parse(localStorage.getItem("mains_answer_attempts_v1") || "[]");
            localStorage.setItem("mains_answer_attempts_v1", JSON.stringify([attempt, ...existing]));
        // eslint-disable-next-line no-unused-vars
        } catch (_) { /* storage unavailable */ }
        setSavedAttemptData(attempt);
        setSaved(true);
        // Also save to backend to get a real attemptId for the review pipeline
        await handleSaveAttemptWithBackend();
    };

    // ─── NEW: Mains review pipeline handlers ──────────────────────────────────

    const handleSaveAttemptWithBackend = async () => {
        setAnswerSaveState("saving");
        setAnswerSaveError("");
        try {
            const payload = {
                userId: "user_1", // TODO: replace with actual userId from auth context
                source: {
                    mode: "pyq",
                    paper: SESSION.paper,
                    examYear: SESSION.year || new Date().getFullYear(),
                    questionId: SESSION.question?.replace(/\s+/g, "_").substring(0, 10) || "unknown",
                    questionMarks: parseInt(SESSION.marks),
                    targetWords: wordTarget,
                    upscTimeMinutes: Math.floor(TIME_LIMITS[SESSION.marks] / 60),
                },
                question: {
                    text: SESSION.question,
                    directiveWord: "", // TODO: extract directive word
                    focusLabel: SESSION.focus || "",
                    topicNodeId: SESSION.topicNodeId || "",
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
                selfReview: {
                    mistakeTypes: [],
                    severity: "medium",
                    mustRevise: false,
                    note: "",
                },
            };
            const response = await saveMainsAttempt(payload);
            if (response?.ok && response?.attemptId) {
                setAttemptId(response.attemptId);
                setAnswerSaveState("saved");
                setReviewUiMessage("Attempt saved successfully. Ready for evaluation.");
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
        if (!attemptId) {
            setReviewUiError("Save the answer attempt first.");
            return;
        }
        if (externalReviewText.trim().length < 200) {
            setReviewUiError("Review must be at least 200 characters.");
            return;
        }

        setReviewSaveState("saving");
        setReviewSaveError("");
        try {
            const payload = {
                attemptId,
                userId: "user_1", // TODO: replace with actual userId
                reviewSource: {
                    type: "chatgpt_pasted",
                    promptVersion: "mains-strict-review-v2",
                },
                rawReviewText: externalReviewText,
                userAgreement: {
                    value: reviewAgreement,
                    note: reviewAgreementNote,
                },
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
        if (!attemptId || !reviewId) {
            setReviewUiError("Save both attempt and review first.");
            return;
        }

        setReviewProcessState("processing");
        setReviewProcessError("");
        try {
            const payload = {
                attemptId,
                reviewId,
                userId: "user_1", // TODO: replace with actual userId
            };
            const response = await processMainsReview(payload);
            if (response?.ok) {
                setProcessedReviewResult(response);
                setReviewProcessState("processed");
                setReviewUiMessage("Review processed and synced to mistake/revision pipeline.");
                
                // Also fetch full result data
                try {
                    const fullResult = await getMainsReviewResult(attemptId, reviewId);
                    if (fullResult?.ok) {
                        setReviewResultData(fullResult);
                    }
                } catch (e) {
                    console.error("Error fetching full result:", e);
                }
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

    const handleOpenMistakeBook = () => {
        navigate("/mains/mistakes");
    };

    const handleOpenRevisionTasks = () => {
        // Navigate to revision page or show revision tasks modal
        navigate("/revision");
    };

    const handleCopyReviewPrompt = () => {
        setReviewPromptCopied(true);
        setTimeout(() => setReviewPromptCopied(false), 3000);
    };

    const handleOpenChatGPTReview = () => {
        window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
    };

    const nextQuestion = () => {
        navigate("/mains", { state: { loadNext: true } });
    };

    const handleStartSession = () => {
        setSessionStarted(true);
        // smooth scroll to timer after a brief tick so autoStart effect fires first
        setTimeout(() => {
            timerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
    };

    const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
    const wordPct = Math.min(Math.round((wordCount / wordTarget) * 100), 100);

    // ─── NEW: Review pipeline validation helpers ────────────────────────────
    const finalAnswerText = pastedText.trim();
    const canCopyReviewPrompt = !!SESSION.question && !!finalAnswerText;
    const canSaveReview = !!attemptId && externalReviewText.trim().length >= 200;
    const canProcessReview = !!attemptId && !!reviewId && reviewSaveState === "saved";

    // Journey step states
    const steps = [
        { label: "Read question", done: true },
        { label: "Write on paper", done: timerStatus === STATUSES.RUNNING || timerStatus === STATUSES.DONE },
        { label: "Upload pages", done: hasPages },
        { label: "Open ChatGPT", done: promptCopied },
        { label: "Paste text", done: hasPastedText },
        { label: "Save attempt", done: saved },
        { label: "Copy AIR-1 prompt", done: reviewPromptCopied },
        { label: "Paste review", done: reviewSaveState === "saved" },
        { label: "Process review", done: reviewProcessState === "processed" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

            {/* ── Breadcrumb / topbar ─────────────────────────────────────────────── */}
            <div style={{
                borderBottom: `1px solid ${T.border}`,
                padding: "13px 28px",
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                background: T.bg, position: "sticky", top: 0, zIndex: 20,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={label11(T.subtle)}>Mains</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                    <span style={label11(T.dim)}>Answer Writing</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: SESSION.paperAccent, letterSpacing: "0.06em" }}>
                        {SESSION.paper}
                    </span>
                </div>
                <StatusChip status={pageStatus} />
            </div>

            <div style={{
                padding: "24px 28px 48px",
                maxWidth: 960, margin: "0 auto",
                display: "flex", flexDirection: "column", gap: 20,
            }}>

                {/* ═══ 1. CONTEXT PILLS ════════════════════════════════════════════════ */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <InfoPill label="Paper" value={SESSION.paper} accent={SESSION.paperAccent} />
                    <InfoPill label="Mode" value={SESSION.mode} accent={T.purple} />
                    <InfoPill label="Marker" value={`${marks}M`} accent={T.textBright} />
                    <InfoPill label="Year" value={SESSION.year} accent={T.dim} />
                    <InfoPill label="Target" value={`${wordTarget} words`} accent={T.blue} />
                    <InfoPill label="UPSC time" value={`${Math.floor(timeLimit / 60)} min`} accent={T.amber} />
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 8, padding: "8px 14px", flex: 1, minWidth: 200,
                    }}>
                        <span style={{ ...label11(T.subtle), fontSize: 9 }}>Structure</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{SESSION.structure}</span>
                    </div>
                </div>

                {/* ═══ 2. QUESTION CARD ════════════════════════════════════════════════ */}
                <SectionCard accentTop={SESSION.paperAccent}>
                    <div style={{ padding: "22px 24px" }}>
                        {/* badges row */}
                        <div style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between", marginBottom: 16,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                    fontSize: 12, fontWeight: 900, color: SESSION.paperAccent,
                                    background: `${SESSION.paperAccent}15`,
                                    border: `1px solid ${SESSION.paperAccent}33`,
                                    borderRadius: 6, padding: "3px 10px", letterSpacing: "0.06em",
                                }}>{SESSION.paper}</span>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: T.purple,
                                    background: `${T.purple}15`, border: `1px solid ${T.purple}33`,
                                    borderRadius: 6, padding: "3px 9px", letterSpacing: "0.06em", textTransform: "uppercase",
                                }}>{SESSION.mode}</span>
                                <span style={{
                                    fontSize: 11, fontWeight: 800, color: T.textBright,
                                    background: T.surfaceHigh, border: `1px solid ${T.borderMid}`,
                                    borderRadius: 6, padding: "3px 10px",
                                }}>{marks} Marks</span>
                            </div>
                            <span style={{ fontSize: 11, color: T.dim, fontWeight: 600 }}>
                                {SESSION.year ? `UPSC ${SESSION.year}` : ""}
                            </span>
                        </div>

                        {/* question */}
                        <div style={{
                            fontSize: 17, fontWeight: 700, color: T.textBright,
                            lineHeight: 1.75, letterSpacing: "0.01em", marginBottom: 20,
                        }}>
                            {SESSION.question}
                        </div>

                        {/* focus + priority */}
                        <div style={{
                            display: "flex", flexDirection: "column", gap: 8,
                            paddingTop: 16, borderTop: `1px solid ${T.border}`,
                        }}>
                            {SESSION.focus && (
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color: T.amber,
                                        letterSpacing: "0.08em", textTransform: "uppercase",
                                        marginTop: 1, flexShrink: 0,
                                    }}>Focus:</span>
                                    <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{SESSION.focus}</span>
                                </div>
                            )}
                            {SESSION.priority && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, color: T.dim, fontWeight: 600 }}>{SESSION.priority}</span>
                                </div>
                            )}
                        </div>

                        {/* Start Writing Session button */}
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                            <button
                                onClick={handleStartSession}
                                disabled={sessionStarted}
                                style={{
                                    ...primaryBtn(SESSION.paperAccent, sessionStarted),
                                    boxShadow: !sessionStarted ? `0 0 16px ${SESSION.paperAccent}30` : "none",
                                }}
                            >
                                {sessionStarted ? "✓ Session Running" : "✍ Start Writing Session"}
                            </button>
                            <span style={{ fontSize: 11, color: T.subtle, marginLeft: 14 }}>
                                {sessionStarted
                                    ? "Timer started — write your answer on paper."
                                    : "Start the timer and begin writing your answer on paper."}
                            </span>
                        </div>
                    </div>
                </SectionCard>

                {/* ═══ 3. TIMER CARD ═════════════════════════════════════════════════════════ */}
                <Timer
                    marks={marks}
                    accent={SESSION.paperAccent}
                    autoStart={sessionStarted}
                    timerRef={timerSectionRef}
                    onStatusChange={setTimerStatus}
                />

                {/* ═══ 4. UPLOAD WORKSPACE ═════════════════════════════════════════════ */}
                <SectionCard accentTop={T.blue}>
                    <div style={{ padding: "20px 24px" }}>

                        {/* Section header row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={label11(T.subtle)}>Answer Pages Upload</div>
                            {hasPages && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 11, color: T.dim }}>
                                        {uploadedPages.length} / {MAX_PAGES} pages
                                    </span>
                                    <button onClick={handleClearAll} style={{ ...outlineBtn(T.red, "sm") }}>
                                        ✕ Clear All
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>
                            Upload clear photos of all answer pages below, in order.
                        </div>

                        {/* Page preview grid */}
                        {hasPages && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                gap: 12,
                                marginBottom: 16,
                            }}>
                                {uploadedPages.map((pg, idx) => (
                                    <div key={idx} style={{
                                        background: T.bg,
                                        border: `1px solid ${T.borderMid}`,
                                        borderRadius: 10,
                                        overflow: "hidden",
                                    }}>
                                        {/* Page label bar */}
                                        <div style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "6px 10px",
                                            background: `${T.blue}10`,
                                            borderBottom: `1px solid ${T.border}`,
                                        }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 800, color: T.blue,
                                                letterSpacing: "0.07em", textTransform: "uppercase",
                                            }}>
                                                Page {idx + 1}
                                            </span>
                                            <button
                                                onClick={() => handleRemovePage(idx)}
                                                style={{
                                                    background: "transparent", border: "none",
                                                    color: T.dim, cursor: "pointer",
                                                    fontSize: 13, lineHeight: 1, padding: "0 2px",
                                                    fontFamily: T.font,
                                                }}
                                                title="Remove this page"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {/* Thumbnail */}
                                        <div style={{ padding: "10px", background: T.bg, textAlign: "center" }}>
                                            <img
                                                src={pg.preview}
                                                alt={`Page ${idx + 1}`}
                                                style={{
                                                    maxWidth: "100%", maxHeight: 180,
                                                    borderRadius: 6, objectFit: "contain",
                                                    border: `1px solid ${T.border}`,
                                                }}
                                            />
                                        </div>
                                        {/* File name */}
                                        <div style={{
                                            padding: "5px 10px 8px",
                                            fontSize: 10, color: T.subtle,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                            {pg.file.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Drop zone — always shown when under max */}
                        {uploadedPages.length < MAX_PAGES && (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    border: `2px dashed ${isDragging ? T.blue : T.borderMid}`,
                                    borderRadius: 12,
                                    background: isDragging ? `${T.blue}08` : T.bg,
                                    padding: hasPages ? "22px 24px" : "48px 24px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    marginBottom: 16,
                                }}
                            >
                                <div style={{ fontSize: hasPages ? 24 : 36, marginBottom: 8 }}>📷</div>
                                <div style={{ fontSize: hasPages ? 13 : 15, fontWeight: 700, color: T.textBright, marginBottom: 5 }}>
                                    {hasPages
                                        ? `Add more pages (${uploadedPages.length}/${MAX_PAGES})`
                                        : "Upload answer pages"}
                                </div>
                                <div style={{ fontSize: 12, color: T.dim, marginBottom: hasPages ? 10 : 16, lineHeight: 1.6 }}>
                                    Drag &amp; drop or click · JPG, PNG, HEIC, WebP · Up to {MAX_PAGES} pages
                                </div>
                                {!hasPages && (
                                    <div style={{
                                        display: "inline-block", background: T.surface,
                                        border: `1px solid ${T.borderMid}`,
                                        borderRadius: 8, padding: "8px 20px",
                                        fontSize: 13, fontWeight: 700, color: T.text,
                                    }}>
                                        Choose Files
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    style={{ display: "none" }}
                                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                                />
                            </div>
                        )}

                        {/* ChatGPT handoff — shown once pages are uploaded */}
                        {hasPages && (
                            <div style={{
                                padding: "16px 18px 18px",
                                borderRadius: 10,
                                border: `1px solid ${T.border}`,
                                background: `${T.purple}07`,
                                marginBottom: 12,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                                    <button onClick={handleOpenChatGPT} style={primaryBtn(T.purple)}>
                                        🤖 Open ChatGPT for Extraction
                                    </button>
                                    {promptCopied && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 700, color: T.green,
                                            display: "flex", alignItems: "center", gap: 5,
                                        }}>
                                            <span style={{
                                                width: 16, height: 16, borderRadius: "50%",
                                                background: `${T.green}22`, border: `1px solid ${T.green}44`,
                                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 10,
                                            }}>✓</span>
                                            Prompt copied
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}>
                                    Prompt is copied automatically. Paste it in ChatGPT, then upload all answer page images there in the correct order.
                                </div>
                                {promptCopied && (
                                    <div style={{
                                        marginTop: 10, padding: "10px 14px",
                                        background: T.bg, border: `1px solid ${T.border}`,
                                        borderRadius: 8, fontSize: 12, color: T.dim, lineHeight: 1.7,
                                    }}>
                                        <span style={{ color: T.textBright, fontWeight: 700 }}>Next steps:</span>
                                        {" "}Paste the prompt in ChatGPT → upload all {uploadedPages.length} answer page image{uploadedPages.length > 1 ? "s" : ""} in order → copy the combined extracted text → paste it in the section below.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tip */}
                        <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>
                            💡 Tip: Use clear lighting, avoid shadows, keep text straight — upload all answer page images in ChatGPT in the same order.
                        </div>
                    </div>
                </SectionCard>

                {/* ═══ 5. PASTE & REVIEW PANEL ═════════════════════════════════════════ */}
                <SectionCard accentTop={T.purple}>
                    <div style={{ padding: "20px 24px" }}>
                        <div style={{
                            display: "flex", alignItems: "flex-start",
                            justifyContent: "space-between", marginBottom: 18,
                        }}>
                            <div>
                                <div style={{ ...label11(T.subtle), marginBottom: 4 }}>Paste Extracted Text</div>
                                <div style={{ fontSize: 13, color: T.dim }}>
                                    Copy the combined text from ChatGPT and paste it below. Review and correct before saving.
                                </div>
                            </div>

                            {wordCount > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                        <span style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>
                                            {wordCount}
                                        </span>
                                        <span style={{ fontSize: 11, color: T.subtle, fontWeight: 600 }}>
                                            / {wordTarget} words
                                        </span>
                                    </div>
                                    {wordCount > 0 && wordCount < wordTarget * 0.7 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>
                                            ✗ Too short — expand your points
                                        </span>
                                    )}
                                    {wordCount >= wordTarget * 0.7 && wordCount <= wordTarget * 1.1 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
                                            ✓ Optimal length
                                        </span>
                                    )}
                                    {wordCount > wordTarget * 1.2 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>
                                            ⚠ Too lengthy — trim for exam conditions
                                        </span>
                                    )}
                                    <div style={{ width: 140, height: 3, background: T.muted, borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", width: `${wordPct}%`,
                                            background: wordCount < wordTarget * 0.7 ? T.red
                                                : wordCount > wordTarget * 1.2 ? T.amber
                                                    : T.green,
                                            borderRadius: 3,
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Instruction strip */}
                        {!hasPastedText && (
                            <div style={{
                                display: "flex", alignItems: "flex-start", gap: 14,
                                padding: "14px 16px", marginBottom: 16,
                                background: T.bg, border: `1px solid ${T.border}`,
                                borderRadius: 10,
                            }}>
                                <div style={{
                                    flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                                    background: `${T.purple}15`, border: `1px solid ${T.purple}33`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 16,
                                }}>
                                    🤖
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright, marginBottom: 4 }}>
                                        Waiting for ChatGPT extraction
                                    </div>
                                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.65 }}>
                                        Upload your answer page images in the panel above → click{" "}
                                        <span style={{ color: T.purple, fontWeight: 700 }}>Open ChatGPT for Extraction</span>
                                        {" "}→ paste the prompt → upload all answer page images in ChatGPT in order → copy the combined extracted text → paste below.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Ready-to-review label */}
                        {hasPastedText && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: T.green,
                                    background: `${T.green}15`, border: `1px solid ${T.green}33`,
                                    borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em",
                                }}>Ready for Review</span>
                                <span style={{ fontSize: 12, color: T.dim }}>
                                    Edit any errors directly in the text area below.
                                </span>
                            </div>
                        )}

                        {/* Paste textarea */}
                        <textarea
                            value={pastedText}
                            onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
                            rows={14}
                            style={{
                                width: "100%", boxSizing: "border-box",
                                background: T.bg,
                                border: `1px solid ${hasPastedText ? T.green + "55" : T.borderMid}`,
                                borderRadius: 10, color: T.text, fontSize: 13.5,
                                lineHeight: 1.8, padding: "16px 18px",
                                fontFamily: T.font, resize: "vertical", outline: "none",
                                letterSpacing: "0.01em",
                                transition: "border-color 0.2s",
                            }}
                            placeholder="Paste extracted text from ChatGPT here…"
                        />
                        <div style={{ fontSize: 11, color: T.subtle, marginTop: 8 }}>
                            ✎ You can edit freely — fix spacing, missed words, or formatting before saving.
                        </div>
                    </div>
                </SectionCard>

                {/* ═══ 6. ACTION ROW ═══════════════════════════════════════════════════ */}
                <SectionCard>
                    <div style={{ padding: "18px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <button
                                disabled={!hasPastedText || saved}
                                onClick={handleSave}
                                style={primaryBtn(SESSION.paperAccent, !hasPastedText || saved)}
                            >
                                {saved ? "✓ Saved" : "💾  Save Attempt"}
                            </button>
                            <button
                                disabled={!hasPastedText}
                                style={{
                                    ...outlineBtn(T.blue),
                                    opacity: !hasPastedText ? 0.4 : 1,
                                    cursor: !hasPastedText ? "not-allowed" : "pointer",
                                }}
                            >
                                ✉  Submit for Review
                            </button>
                            <button onClick={nextQuestion} style={outlineBtn(T.amber)}>
                                → Next Question
                            </button>
                            {hasPages && (
                                <button onClick={handleClearAll} style={outlineBtn(T.dim)}>
                                    ✕  Clear Pages
                                </button>
                            )}
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 2 }}>Pages</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                                        {uploadedPages.length} / {MAX_PAGES}
                                    </div>
                                </div>
                                <StatusChip status={pageStatus} />
                            </div>
                        </div>

                        {/* ── API success / error banners ── */}
                        {answerSaveState === "saving" && (
                            <div style={{
                                marginTop: 12, padding: "10px 14px",
                                background: `${T.amber}11`, border: `1px solid ${T.amber}33`,
                                borderRadius: 8, fontSize: 12, color: T.amber, fontWeight: 600,
                            }}>
                                ⏳ Saving to backend…
                            </div>
                        )}
                        {answerSaveState === "error" && answerSaveError && (
                            <div style={{
                                marginTop: 12, padding: "10px 14px",
                                background: `${T.red}11`, border: `1px solid ${T.red}33`,
                                borderRadius: 8, fontSize: 12, color: T.red, fontWeight: 600,
                            }}>
                                ⚠ {answerSaveError}
                            </div>
                        )}

                        {saved && (
                            <div style={{
                                background: `${T.green}11`,
                                border: `1px solid ${T.green}33`,
                                padding: "14px",
                                borderRadius: 10,
                                fontWeight: 700,
                                color: T.green,
                                marginTop: 16,
                                fontSize: 12,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                flexWrap: "wrap", gap: 6,
                            }}>
                                <span>
                                    ✅ Attempt saved.
                                    {attemptId
                                        ? ` Backend ID: ${attemptId}`
                                        : " (localStorage only — backend save pending)"}
                                </span>
                                {attemptId && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: T.green, opacity: 0.75 }}>
                                        Ready for evaluation ✓
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ── Mistake Tagger — shown after save ── */}
                        {saved && savedAttemptData && (
                            <div style={{ marginTop: 20 }}>
                                <MainsMistakeTagger
                                    attemptData={savedAttemptData}
                                    onMistakeSaved={() => {}}
                                />
                            </div>
                        )}
                    </div>
                </SectionCard>

                {/* ═══ 7. AIR-1 REVIEW PROMPT SECTION ══════════════════════════════════ */}
                {saved && finalAnswerText && (
                    <MainsReviewPromptCard
                        currentQuestion={{
                            text: SESSION.question,
                            marks: parseInt(SESSION.marks),
                        }}
                        finalAnswerText={finalAnswerText}
                        papersAccent={SESSION.paperAccent}
                        wordTarget={wordTarget}
                        onCopyPrompt={handleCopyReviewPrompt}
                        onOpenChatGPT={handleOpenChatGPTReview}
                        canCopyReviewPrompt={canCopyReviewPrompt}
                        promptCopied={reviewPromptCopied}
                    />
                )}

                {/* ═══ 8. PASTE EXTERNAL REVIEW SECTION ════════════════════════════════ */}
                {saved && finalAnswerText && (
                    <MainsPasteReviewCard
                        externalReviewText={externalReviewText}
                        setExternalReviewText={setExternalReviewText}
                        reviewAgreement={reviewAgreement}
                        setReviewAgreement={setReviewAgreement}
                        reviewAgreementNote={reviewAgreementNote}
                        setReviewAgreementNote={setReviewAgreementNote}
                        onSaveReview={handleSaveReview}
                        onProcessReview={handleProcessReview}
                        canSaveReview={canSaveReview}
                        canProcessReview={canProcessReview}
                        reviewSaveState={reviewSaveState}
                        reviewProcessState={reviewProcessState}
                    />
                )}

                {/* ── Review pipeline inline banners ────────────────────────── */}
                {saved && finalAnswerText && !attemptId && answerSaveState !== "saving" && (
                    <div style={{
                        padding: "10px 16px", borderRadius: 8,
                        background: `${T.amber}11`, border: `1px solid ${T.amber}33`,
                        fontSize: 12, color: T.amber, fontWeight: 600,
                    }}>
                        ⚠ Backend attempt ID not received — review pipeline unavailable. Try saving again.
                    </div>
                )}
                {reviewUiError && (
                    <div style={{
                        padding: "10px 16px", borderRadius: 8,
                        background: `${T.red}11`, border: `1px solid ${T.red}33`,
                        fontSize: 12, color: T.red, fontWeight: 600,
                    }}>
                        ✗ {reviewUiError}
                    </div>
                )}
                {reviewSaveState === "error" && reviewSaveError && (
                    <div style={{
                        padding: "10px 16px", borderRadius: 8,
                        background: `${T.red}11`, border: `1px solid ${T.red}33`,
                        fontSize: 12, color: T.red, fontWeight: 600,
                    }}>
                        ✗ Review save error: {reviewSaveError}
                    </div>
                )}
                {reviewProcessState === "error" && reviewProcessError && (
                    <div style={{
                        padding: "10px 16px", borderRadius: 8,
                        background: `${T.red}11`, border: `1px solid ${T.red}33`,
                        fontSize: 12, color: T.red, fontWeight: 600,
                    }}>
                        ✗ Process error: {reviewProcessError}
                    </div>
                )}
                {reviewProcessState === "processing" && (
                    <div style={{
                        padding: "10px 16px", borderRadius: 8,
                        background: `${T.amber}11`, border: `1px solid ${T.amber}33`,
                        fontSize: 12, color: T.amber, fontWeight: 600,
                    }}>
                        ⏳ Running review pipeline — this usually takes 1–2 seconds…
                    </div>
                )}

                {/* ═══ 9. REVIEW RESULT SUMMARY SECTION ════════════════════════════════ */}
                {processedReviewResult?.result && (
                    <MainsReviewResultCard
                        processedReviewResult={processedReviewResult.result}
                        reviewResultData={reviewResultData}
                        onOpenMistakes={handleOpenMistakeBook}
                        onOpenRevision={handleOpenRevisionTasks}
                        onNextQuestion={nextQuestion}
                    />
                )}

                {/* ═══ 10. JOURNEY TRACKER ═════════════════════════════════════════════ */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
                    {steps.map((s, i) => {
                        const isActive = !s.done && (i === 0 || steps[i - 1].done);
                        return (
                            <React.Fragment key={s.label}>
                                <div style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", gap: 5, minWidth: 90,
                                }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontWeight: 900, fontSize: 12,
                                        background: s.done ? T.green : isActive ? SESSION.paperAccent : T.surface,
                                        color: s.done || isActive ? "#09090b" : T.muted,
                                        border: `2px solid ${s.done ? T.green : isActive ? SESSION.paperAccent : T.border}`,
                                    }}>
                                        {s.done ? "✓" : i + 1}
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, textAlign: "center",
                                        whiteSpace: "nowrap", letterSpacing: "0.02em",
                                        color: s.done ? T.green : isActive ? SESSION.paperAccent : T.subtle,
                                    }}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2, minWidth: 20,
                                        background: steps[i].done ? T.green : T.border,
                                        marginBottom: 18,
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

            </div>
        </div>
    );
}

/*
 ─── WIRE-UP NOTES ─────────────────────────────────────────────────────────────
 1.  SESSION object          → built from location.state?.question; falls back to FALLBACK_SESSION
 2.  TIME_LIMITS             → driven by SESSION.marks; correct per UPSC standard
 3.  ringBell()              → Web Audio API; works in all modern browsers without libs
 4.  handleOpenChatGPT()     → copies CHATGPT_EXTRACTION_PROMPT to clipboard + opens ChatGPT tab
 5.  uploadedPages           → array of { file, preview }; max MAX_PAGES (5)
 6.  pastedText              → user pastes ChatGPT output; wire to POST /api/attempts
 7.  handleSave()            → POST attempt { question, pastedText, marks, paper }
 8.  "Submit for Review"     → PUT /api/attempts/:id/submit or push to Mistake Book
 9.  → Next Question         → useNavigate() back to MainsPage / next question in queue
10.  Timer reset on marks    → Timer remounts via key={marks} if SESSION.marks changes
 ──────────────────────────────────────────────────────────────────────────────
*/
