// src/pages/geographyOptional/GeoOptionalAnswerWritingPage.jsx
// Geography Optional Answer Writing Workspace
// Route state: { paper, questions, currentIndex }
// Each question: { id, question, marks, year, paperNumber, theme, directive, syllabusNodeId }

import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#8b5cf6",
  font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

// ─── Time/word targets ────────────────────────────────────────────────────────
const TIME_LIMITS = { "10": 6 * 60, "15": 9 * 60, "20": 12 * 60, "25": 15 * 60 };
const WORD_TARGETS = { "10": 150, "15": 200, "20": 250, "25": 300 };

// ─── Fallback ─────────────────────────────────────────────────────────────────
const FALLBACK_QUESTIONS = [
  {
    id: "fallback_1",
    question: "Discuss the concept of plate tectonics and its role in shaping the landforms of the world.",
    marks: 15,
    year: 2022,
    paperNumber: 1,
    theme: "Geomorphology",
    directive: "Discuss",
    syllabusNodeId: "OPT-P1-GEOM",
  },
];

// ─── Extraction prompt ────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `I am uploading photos of my handwritten UPSC Geography Optional answer sheets, possibly across multiple pages.
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

// ─── Build evaluation prompt ──────────────────────────────────────────────────
function buildEvalPrompt(question, marks, wordTarget, theme, extractedAnswer) {
  return `You are a strict UPSC Geography Optional evaluator. Evaluate the following answer strictly as per UPSC Geography Optional standards.

QUESTION:
${question}

THEME: ${theme || "Geography Optional"}
MARKS: ${marks} | WORD TARGET: ~${wordTarget} words

CANDIDATE'S ANSWER:
${extractedAnswer}

Evaluate on these dimensions:
1. Introduction — Contextual, subject-specific, and crisp?
2. Content Coverage — Are all geographic dimensions addressed (physical, human, regional, applied)?
3. Conceptual Accuracy — Are geographic theories, models, and terminology used correctly?
4. Analytical Depth — Analysis and linkages, not just description?
5. Diagrams/Maps — Were diagrams mentioned or sketched? Were they relevant?
6. Structure — Logical flow with appropriate headings/bullets?
7. Conclusion — Forward-looking and geo-analytically sound?
8. Word Discipline — Within the expected range?

Provide:
- Score: X / ${marks}
- Strengths (2–3 bullets)
- Weaknesses (2–3 bullets)
- One critical improvement tip (specific to geography optional writing)
- Verdict: Below Average / Average / Good / Excellent

Be direct and strict. No softening.`;
}

// ─── Status labels ────────────────────────────────────────────────────────────
const STATUSES = {
  IDLE: "Ready",
  COUNTDOWN: "Starting…",
  RUNNING: "In Progress",
  PAUSED: "Paused",
  DONE: "Time Up",
  UPLOADED: "Pages Uploaded",
  TEXT_PASTED: "Text Pasted",
  SAVED: "Saved",
};

const MAX_PAGES = 5;

// ─── Audio bell ───────────────────────────────────────────────────────────────
function ringBell(times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ring = (delayMs) =>
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
    for (let i = 0; i < times; i++) ring(i * 950);
  } catch (e) {
    void e;
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  color,
});

const primaryBtn = (accent, disabled = false) => ({
  background: disabled ? T.muted : accent,
  color: "#09090b",
  border: "none",
  borderRadius: 8,
  fontWeight: 900,
  fontSize: 13,
  padding: "11px 26px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: T.font,
  letterSpacing: "0.04em",
  opacity: disabled ? 0.45 : 1,
  whiteSpace: "nowrap",
});

const outlineBtn = (accent, disabled = false) => ({
  background: "transparent",
  color: disabled ? T.muted : accent,
  border: `1px solid ${disabled ? T.border : accent + "44"}`,
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  padding: "10px 20px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: T.font,
  letterSpacing: "0.03em",
  whiteSpace: "nowrap",
  opacity: disabled ? 0.45 : 1,
});

// ─── Micro-components ─────────────────────────────────────────────────────────
function InfoPill({ label, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        minWidth: 72,
      }}
    >
      <span style={{ ...label11(T.subtle), fontSize: 9 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent || T.textBright }}>{value}</span>
    </div>
  );
}

function StatusChip({ status }) {
  const color =
    status === STATUSES.SAVED
      ? T.green
      : status === STATUSES.TEXT_PASTED
      ? T.green
      : status === STATUSES.UPLOADED
      ? T.blue
      : status === STATUSES.RUNNING
      ? T.amber
      : status === STATUSES.PAUSED
      ? T.dim
      : status === STATUSES.DONE
      ? T.red
      : status === STATUSES.COUNTDOWN
      ? T.amber
      : T.subtle;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 12px",
        borderRadius: 20,
        border: `1px solid ${color}33`,
        color,
        background: `${color}11`,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

function SectionCard({ accentTop, children, style: extra = {} }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: "hidden",
        ...extra,
      }}
    >
      {accentTop && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, ${accentTop}, ${accentTop}44, ${T.border})`,
          }}
        />
      )}
      {children}
    </div>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function Timer({ marks, accent, autoStart, onStatusChange, timerRef }) {
  const timeLimit = TIME_LIMITS[String(marks)] || TIME_LIMITS["15"];
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
  }, [autoStart]); // eslint-disable-line

  const remaining = Math.max(timeLimit - elapsed, 0);
  const overTime = elapsed > timeLimit;
  const pct = Math.min((elapsed / timeLimit) * 100, 100);

  const fmt = (s) => {
    const m = Math.floor(Math.abs(s) / 60)
      .toString()
      .padStart(2, "0");
    const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  useEffect(() => {
    const map = {
      running: STATUSES.RUNNING,
      paused: STATUSES.PAUSED,
      done: STATUSES.DONE,
      countdown: STATUSES.COUNTDOWN,
      idle: STATUSES.IDLE,
    };
    onStatusChange?.(map[phase] || STATUSES.IDLE);
  }, [phase]); // eslint-disable-line

  useEffect(() => {
    if (elapsed >= timeLimit && !bellFired.current && phase === "running") {
      bellFired.current = true;
      ringBell(3);
    }
  }, [elapsed, timeLimit, phase]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("running");
      return;
    }
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
    if (phase === "idle") {
      setCountdown(5);
      setPhase("countdown");
    } else if (phase === "paused") {
      setPhase("running");
    } else if (phase === "running") {
      setPhase("paused");
    }
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setPhase("idle");
    setElapsed(0);
    setCountdown(5);
    bellFired.current = false;
  };

  const barColor =
    phase === "done" || overTime ? T.red : pct > 80 ? T.red : pct > 60 ? T.amber : T.green;
  const minLabel = Math.floor(timeLimit / 60);

  return (
    <div
      ref={domRef}
      style={{
        background: T.surface,
        border: `1px solid ${
          phase === "done"
            ? T.red + "55"
            : phase === "running" || phase === "countdown"
            ? accent + "55"
            : T.border
        }`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow:
          phase === "running" || phase === "countdown"
            ? `0 0 24px ${accent}22`
            : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...label11(T.subtle), marginBottom: 4 }}>
            Answer Timer · {marks}M ({minLabel} min)
          </div>
          <div style={{ fontSize: 10, color: T.muted }}>
            UPSC standard — {minLabel} min per question
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {phase === "countdown" ? (
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: T.amber,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {countdown}
            </div>
          ) : (
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: overTime ? T.red : phase === "done" ? T.red : T.textBright,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {overTime ? `+${fmt(elapsed - timeLimit)}` : fmt(remaining)}
            </div>
          )}
          <div style={{ fontSize: 10, color: T.subtle, marginTop: 3, textAlign: "right" }}>
            {phase === "countdown"
              ? "Get ready…"
              : overTime
              ? "Over time"
              : phase === "done"
              ? "Time's up!"
              : `${fmt(elapsed)} elapsed`}
          </div>
        </div>
      </div>

      <div style={{ height: 5, background: T.muted, borderRadius: 5, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            borderRadius: 5,
            transition: "width 0.8s linear, background 0.4s",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {[0, 25, 50, 75, 100].map((p) => (
          <span
            key={p}
            style={{
              fontSize: 9,
              color: pct >= p ? T.dim : T.muted,
              fontWeight: pct >= p ? 700 : 400,
            }}
          >
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
              borderRadius: 8,
              fontWeight: 900,
              fontSize: 13,
              padding: "10px 0",
              cursor: phase === "countdown" ? "not-allowed" : "pointer",
              fontFamily: T.font,
              letterSpacing: "0.04em",
              opacity: phase === "countdown" ? 0.6 : 1,
            }}
          >
            {phase === "idle"
              ? "▶  Start (5s countdown)"
              : phase === "countdown"
              ? `Starting in ${countdown}…`
              : phase === "running"
              ? "▐▐  Pause"
              : "▶  Resume"}
          </button>
        )}
        {phase === "done" && (
          <div
            style={{
              flex: 1,
              background: `${T.red}11`,
              border: `1px solid ${T.red}33`,
              borderRadius: 8,
              padding: "10px 16px",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              color: T.red,
            }}
          >
            🔔 Time's up! Wrap up your answer.
          </div>
        )}
        {phase !== "idle" && (
          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              color: T.dim,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            ↺ Reset
          </button>
        )}
      </div>

      {overTime && phase === "running" && (
        <div
          style={{
            background: `${T.red}11`,
            border: `1px solid ${T.red}22`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: T.red,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          ⚠ Over time by {fmt(elapsed - timeLimit)} — finish and move on.
        </div>
      )}
      {phase === "running" && (
        <div style={{ fontSize: 11, color: T.amber, marginTop: 2 }}>
          ⚡ Structure: Introduction → Key geographic concepts → Case studies → Conclusion
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GeoOptionalAnswerWritingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const rs = location.state || {};
  const questions =
    rs.questions && rs.questions.length > 0 ? rs.questions : FALLBACK_QUESTIONS;

  const [currentIndex, setCurrentIndex] = useState(rs.currentIndex || 0);
  const safeIndex = Math.min(currentIndex, questions.length - 1);
  const activeQ = questions[safeIndex] || {};

  const marks = String(activeQ.marks || "15");
  const timeLimit = TIME_LIMITS[marks] || TIME_LIMITS["15"];
  const wordTarget = WORD_TARGETS[marks] || 200;
  const paperAccent = activeQ.paperNumber === 1 ? T.blue : T.amber;

  // ── Per-question state ──────────────────────────────────────────────────────
  const [timerStatus, setTimerStatus] = useState(STATUSES.IDLE);
  const [sessionStarted, setSessionStarted] = useState(false);
  const timerSectionRef = useRef(null);

  const [uploadedPages, setUploadedPages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();
  const hasPages = uploadedPages.length > 0;

  const [promptCopied, setPromptCopied] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const hasPastedText = pastedText.trim().length > 20;

  const [evaluationText, setEvaluationText] = useState("");
  const [evalPromptCopied, setEvalPromptCopied] = useState(false);
  const hasEvaluationText = evaluationText.trim().length > 20;

  const [saved, setSaved] = useState(false);
  const [pageStatus, setPageStatus] = useState(STATUSES.IDLE);

  // Reset on question change
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    uploadedPages.forEach((p) => URL.revokeObjectURL(p.preview));
    setSessionStarted(false);
    setUploadedPages([]);
    setPastedText("");
    setSaved(false);
    setPromptCopied(false);
    setEvaluationText("");
    setEvalPromptCopied(false);
    setTimerStatus(STATUSES.IDLE);
  }, [currentIndex]); // eslint-disable-line

  useEffect(() => {
    if (saved) setPageStatus(STATUSES.SAVED);
    else if (hasPastedText) setPageStatus(STATUSES.TEXT_PASTED);
    else if (promptCopied) setPageStatus("Prompt Copied");
    else if (hasPages) setPageStatus(STATUSES.UPLOADED);
    else setPageStatus(timerStatus);
  }, [saved, hasPastedText, promptCopied, hasPages, timerStatus]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < questions.length - 1;
  const handlePrev = () => { if (canPrev) setCurrentIndex((i) => i - 1); };
  const handleNext = () => {
    if (canNext) setCurrentIndex((i) => i + 1);
    else navigate(-1);
  };

  // ── Upload handlers ─────────────────────────────────────────────────────────
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

  // ── ChatGPT handlers ────────────────────────────────────────────────────────
  const handleOpenChatGPT = async () => {
    try { await navigator.clipboard.writeText(EXTRACTION_PROMPT); } catch (_) {}
    setPromptCopied(true);
    window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
  };

  const handleEvaluate = async () => {
    const prompt = buildEvalPrompt(
      activeQ.question || "",
      marks,
      wordTarget,
      activeQ.theme || "",
      pastedText.trim()
    );
    try { await navigator.clipboard.writeText(prompt); } catch (_) {}
    setEvalPromptCopied(true);
    setTimeout(() => setEvalPromptCopied(false), 3000);
    window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
  };

  const handleStartSession = () => {
    setSessionStarted(true);
    setTimeout(() => {
      timerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
    const attempt = {
      id: `geo_opt_attempt_${Date.now()}`,
      subject: "geography_optional",
      paperNumber: activeQ.paperNumber,
      marks,
      year: activeQ.year,
      question: activeQ.question,
      theme: activeQ.theme,
      syllabusNodeId: activeQ.syllabusNodeId,
      answerText: pastedText,
      evaluationText,
      wordCount,
      targetWords: wordTarget,
      createdAt: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(
        localStorage.getItem("geo_optional_answer_attempts_v1") || "[]"
      );
      localStorage.setItem(
        "geo_optional_answer_attempts_v1",
        JSON.stringify([attempt, ...existing])
      );
    } catch (_) {}
    setSaved(true);
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
  const wordPct = Math.min(Math.round((wordCount / wordTarget) * 100), 100);

  const steps = [
    { label: "Read question", done: true },
    { label: "Write on paper", done: timerStatus === STATUSES.RUNNING || timerStatus === STATUSES.DONE },
    { label: "Upload pages", done: hasPages },
    { label: "Extract text", done: promptCopied },
    { label: "Paste text", done: hasPastedText },
    { label: "Evaluate answer", done: hasEvaluationText },
    { label: "Save attempt", done: saved },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: `1px solid ${T.border}`,
          padding: "13px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: T.bg,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "transparent",
              border: "none",
              color: T.dim,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: T.font,
              padding: "2px 6px 2px 0",
              marginRight: 4,
            }}
          >
            ←
          </button>
          <span style={label11(T.subtle)}>Optional (Geo)</span>
          <span style={{ color: T.muted, fontSize: 11 }}>·</span>
          <span style={label11(T.dim)}>Answer Writing</span>
          <span style={{ color: T.muted, fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: paperAccent, letterSpacing: "0.06em" }}>
            Paper {activeQ.paperNumber || "—"}
          </span>
          {questions.length > 1 && (
            <>
              <span style={{ color: T.muted, fontSize: 11 }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.dim }}>
                Q{currentIndex + 1} / {questions.length}
              </span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {canPrev && (
            <button
              onClick={handlePrev}
              style={{
                background: "transparent",
                color: T.dim,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              ← Prev
            </button>
          )}
          {canNext && (
            <button
              onClick={handleNext}
              disabled={!hasPastedText}
              style={{
                background: "transparent",
                color: hasPastedText ? paperAccent : T.muted,
                border: `1px solid ${hasPastedText ? paperAccent + "44" : T.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                cursor: hasPastedText ? "pointer" : "not-allowed",
                fontFamily: T.font,
                opacity: hasPastedText ? 1 : 0.45,
              }}
            >
              Next →
            </button>
          )}
          <StatusChip status={pageStatus} />
        </div>
      </div>

      <div
        style={{
          padding: "24px 28px 60px",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* ═══ 1. CONTEXT PILLS ════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <InfoPill label="Subject" value="Geo Optional" accent={T.green} />
          <InfoPill label="Paper" value={`Paper ${activeQ.paperNumber || "—"}`} accent={paperAccent} />
          <InfoPill label="Marks" value={`${marks}M`} accent={T.textBright} />
          <InfoPill label="Year" value={activeQ.year || "—"} accent={T.dim} />
          <InfoPill label="Target" value={`${wordTarget} words`} accent={T.blue} />
          <InfoPill label="Time" value={`${Math.floor(timeLimit / 60)} min`} accent={T.amber} />
          {activeQ.theme && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "8px 14px",
                flex: 1,
                minWidth: 160,
              }}
            >
              <span style={{ ...label11(T.subtle), fontSize: 9 }}>Theme</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{activeQ.theme}</span>
            </div>
          )}
        </div>

        {/* ═══ 2. QUESTION CARD ════════════════════════════════════════════════ */}
        <SectionCard accentTop={paperAccent}>
          <div style={{ padding: "22px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: paperAccent,
                    background: `${paperAccent}15`,
                    border: `1px solid ${paperAccent}33`,
                    borderRadius: 6,
                    padding: "3px 10px",
                    letterSpacing: "0.06em",
                  }}
                >
                  Paper {activeQ.paperNumber}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.green,
                    background: `${T.green}15`,
                    border: `1px solid ${T.green}33`,
                    borderRadius: 6,
                    padding: "3px 9px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  PYQ
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: T.textBright,
                    background: T.surfaceHigh,
                    border: `1px solid ${T.borderMid}`,
                    borderRadius: 6,
                    padding: "3px 10px",
                  }}
                >
                  {marks} Marks
                </span>
                {activeQ.directive && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: T.dim,
                      border: `1px solid ${T.border}`,
                      borderRadius: 5,
                      padding: "2px 8px",
                    }}
                  >
                    {activeQ.directive}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {activeQ.year && (
                  <span style={{ fontSize: 11, color: T.dim, fontWeight: 600 }}>
                    UPSC {activeQ.year}
                  </span>
                )}
                {questions.length > 1 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.subtle,
                      background: T.surfaceHigh,
                      border: `1px solid ${T.border}`,
                      borderRadius: 5,
                      padding: "2px 8px",
                    }}
                  >
                    {currentIndex + 1} / {questions.length}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textBright,
                lineHeight: 1.75,
                letterSpacing: "0.01em",
                marginBottom: 20,
              }}
            >
              {activeQ.question}
            </div>

            {activeQ.theme && (
              <div
                style={{
                  paddingTop: 14,
                  borderTop: `1px solid ${T.border}`,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: paperAccent,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Theme:
                </span>
                <span style={{ fontSize: 12, color: T.text }}>{activeQ.theme}</span>
                {activeQ.syllabusNodeId && (
                  <span
                    style={{
                      fontSize: 10,
                      color: T.muted,
                      background: T.surfaceHigh,
                      border: `1px solid ${T.border}`,
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontFamily: "monospace",
                    }}
                  >
                    {activeQ.syllabusNodeId}
                  </span>
                )}
              </div>
            )}

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={handleStartSession}
                disabled={sessionStarted}
                style={{
                  ...primaryBtn(paperAccent, sessionStarted),
                  boxShadow: !sessionStarted ? `0 0 16px ${paperAccent}30` : "none",
                }}
              >
                {sessionStarted ? "✓ Session Running" : "✍ Start Writing Session"}
              </button>
              <span style={{ fontSize: 11, color: T.subtle, marginLeft: 14 }}>
                {sessionStarted
                  ? "Timer started — write your answer on paper."
                  : "Start the timer and begin writing on paper."}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ═══ 3. TIMER ════════════════════════════════════════════════════════ */}
        <Timer
          key={currentIndex}
          marks={marks}
          accent={paperAccent}
          autoStart={sessionStarted}
          timerRef={timerSectionRef}
          onStatusChange={setTimerStatus}
        />

        {/* ═══ 4. UPLOAD WORKSPACE ═════════════════════════════════════════════ */}
        <SectionCard accentTop={T.blue}>
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div style={label11(T.subtle)}>Answer Pages Upload</div>
              {hasPages && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: T.dim }}>
                    {uploadedPages.length} / {MAX_PAGES} pages
                  </span>
                  <button
                    onClick={handleClearAll}
                    style={{
                      background: "transparent",
                      color: T.red,
                      border: `1px solid ${T.red}44`,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontFamily: T.font,
                    }}
                  >
                    ✕ Clear All
                  </button>
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>
              Upload clear photos of all answer pages in order.
            </div>

            {hasPages && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {uploadedPages.map((pg, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: T.bg,
                      border: `1px solid ${T.borderMid}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        background: `${T.blue}10`,
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: T.blue,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                        }}
                      >
                        Page {idx + 1}
                      </span>
                      <button
                        onClick={() => handleRemovePage(idx)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: T.dim,
                          cursor: "pointer",
                          fontSize: 13,
                          lineHeight: 1,
                          padding: "0 2px",
                          fontFamily: T.font,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ padding: 10, background: T.bg, textAlign: "center" }}>
                      <img
                        src={pg.preview}
                        alt={`Page ${idx + 1}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 180,
                          borderRadius: 6,
                          objectFit: "contain",
                          border: `1px solid ${T.border}`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        padding: "5px 10px 8px",
                        fontSize: 10,
                        color: T.subtle,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pg.file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                <div
                  style={{
                    fontSize: hasPages ? 13 : 15,
                    fontWeight: 700,
                    color: T.textBright,
                    marginBottom: 5,
                  }}
                >
                  {hasPages
                    ? `Add more pages (${uploadedPages.length}/${MAX_PAGES})`
                    : "Upload answer pages"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: T.dim,
                    marginBottom: hasPages ? 10 : 16,
                    lineHeight: 1.6,
                  }}
                >
                  Drag &amp; drop or click · JPG, PNG, HEIC, WebP · Up to {MAX_PAGES} pages
                </div>
                {!hasPages && (
                  <div
                    style={{
                      display: "inline-block",
                      background: T.surface,
                      border: `1px solid ${T.borderMid}`,
                      borderRadius: 8,
                      padding: "8px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.text,
                    }}
                  >
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

            {hasPages && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: `${T.purple}07`,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <button onClick={handleOpenChatGPT} style={primaryBtn(T.purple)}>
                    🤖 Open ChatGPT for Extraction
                  </button>
                  {promptCopied && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.green,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      ✓ Prompt copied
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}>
                  Prompt is copied automatically. Paste it in ChatGPT, then upload all answer
                  pages in order.
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>
              💡 Use clear lighting, avoid shadows, keep pages in order.
            </div>
          </div>
        </SectionCard>

        {/* ═══ 5. PASTE EXTRACTED TEXT ══════════════════════════════════════════ */}
        <SectionCard accentTop={T.purple}>
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ ...label11(T.subtle), marginBottom: 4 }}>Paste Extracted Text</div>
                <div style={{ fontSize: 13, color: T.dim }}>
                  Copy combined text from ChatGPT, paste and correct before saving.
                </div>
              </div>
              {wordCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>
                      {wordCount}
                    </span>
                    <span style={{ fontSize: 11, color: T.subtle, fontWeight: 600 }}>
                      / {wordTarget} words
                    </span>
                  </div>
                  {wordCount < wordTarget * 0.7 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>✗ Too short</span>
                  )}
                  {wordCount >= wordTarget * 0.7 && wordCount <= wordTarget * 1.1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
                      ✓ Optimal length
                    </span>
                  )}
                  {wordCount > wordTarget * 1.2 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>
                      ⚠ Too lengthy
                    </span>
                  )}
                  <div
                    style={{
                      width: 140,
                      height: 3,
                      background: T.muted,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${wordPct}%`,
                        background:
                          wordCount < wordTarget * 0.7
                            ? T.red
                            : wordCount > wordTarget * 1.2
                            ? T.amber
                            : T.green,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                padding: "14px 16px",
                marginBottom: 16,
                background: promptCopied ? `${T.green}08` : `${T.purple}08`,
                border: `1px solid ${promptCopied ? T.green + "33" : T.purple + "33"}`,
                borderRadius: 10,
              }}
            >
              <button
                onClick={handleOpenChatGPT}
                disabled={!hasPages}
                style={primaryBtn(T.purple, !hasPages)}
              >
                🤖 Open ChatGPT for Extraction
              </button>
              {promptCopied ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.green }}>
                  ✓ Prompt copied — paste in ChatGPT, upload images, copy extracted text.
                </span>
              ) : (
                <span style={{ fontSize: 12, color: hasPages ? T.dim : T.muted }}>
                  {hasPages
                    ? "Copies extraction prompt automatically."
                    : "Upload your answer pages above first."}
                </span>
              )}
            </div>

            <textarea
              value={pastedText}
              onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
              rows={14}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: T.bg,
                border: `1px solid ${hasPastedText ? T.green + "55" : T.borderMid}`,
                borderRadius: 10,
                color: T.text,
                fontSize: 13.5,
                lineHeight: 1.8,
                padding: "16px 18px",
                fontFamily: T.font,
                resize: "vertical",
                outline: "none",
                letterSpacing: "0.01em",
                transition: "border-color 0.2s",
              }}
              placeholder="Paste extracted text from ChatGPT here…"
            />
            <div style={{ fontSize: 11, color: T.subtle, marginTop: 8 }}>
              ✎ Fix spacing, missed words, or formatting before saving.
            </div>
          </div>
        </SectionCard>

        {/* ═══ 6. EVALUATE ANSWER ═══════════════════════════════════════════════ */}
        <SectionCard accentTop={T.amber}>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...label11(T.subtle), marginBottom: 4 }}>Evaluate Answer</div>
              <div style={{ fontSize: 13, color: T.dim }}>
                Send your answer to ChatGPT for Geography Optional UPSC-standard evaluation.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <button
                onClick={handleEvaluate}
                disabled={!hasPastedText}
                style={primaryBtn(T.amber, !hasPastedText)}
              >
                ✦ Evaluate with ChatGPT
              </button>
              {evalPromptCopied && (
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
                  ✓ Evaluation prompt copied
                </span>
              )}
              {!hasPastedText && (
                <span style={{ fontSize: 12, color: T.muted }}>
                  Paste extracted text above to enable evaluation.
                </span>
              )}
            </div>

            {hasPastedText && (
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: 14,
                  background: `${T.amber}08`,
                  border: `1px solid ${T.amber}22`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: T.dim,
                  lineHeight: 1.65,
                }}
              >
                <span style={{ color: T.textBright, fontWeight: 700 }}>How it works:</span>{" "}
                Your question + theme + extracted answer are packaged into a Geography Optional
                UPSC evaluation prompt. Click, paste in ChatGPT, then paste the evaluation
                report below.
              </div>
            )}

            <textarea
              value={evaluationText}
              onChange={(e) => setEvaluationText(e.target.value)}
              disabled={!hasPastedText}
              rows={10}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: T.bg,
                border: `1px solid ${hasEvaluationText ? T.amber + "55" : T.borderMid}`,
                borderRadius: 10,
                color: hasPastedText ? T.text : T.subtle,
                fontSize: 13.5,
                lineHeight: 1.8,
                padding: "16px 18px",
                fontFamily: T.font,
                resize: "vertical",
                outline: "none",
                letterSpacing: "0.01em",
                transition: "border-color 0.2s",
                opacity: hasPastedText ? 1 : 0.45,
                cursor: hasPastedText ? "text" : "not-allowed",
              }}
              placeholder={
                hasPastedText
                  ? "Paste ChatGPT evaluation report here…"
                  : "Extract your answer first to enable evaluation…"
              }
            />
          </div>
        </SectionCard>

        {/* ═══ 7. ACTION ROW ════════════════════════════════════════════════════ */}
        <SectionCard>
          <div style={{ padding: "18px 24px" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              <button
                disabled={!hasPastedText || saved}
                onClick={handleSave}
                style={primaryBtn(paperAccent, !hasPastedText || saved)}
              >
                {saved ? "✓ Saved" : "💾  Save Attempt"}
              </button>

              {canPrev && (
                <button onClick={handlePrev} style={outlineBtn(T.dim)}>
                  ← Previous
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={canNext && !hasPastedText}
                style={outlineBtn(T.amber, canNext && !hasPastedText)}
              >
                {canNext ? "→ Next Question" : "✓ Done"}
              </button>

              {hasPages && (
                <button onClick={handleClearAll} style={outlineBtn(T.dim)}>
                  ✕ Clear Pages
                </button>
              )}

              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 2 }}>Pages</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                    {uploadedPages.length} / {MAX_PAGES}
                  </div>
                </div>
                <StatusChip status={pageStatus} />
              </div>
            </div>

            {saved && (
              <div
                style={{
                  background: `${T.green}11`,
                  border: `1px solid ${T.green}33`,
                  padding: "14px",
                  borderRadius: 10,
                  fontWeight: 700,
                  color: T.green,
                  marginTop: 16,
                  fontSize: 12,
                }}
              >
                ✅ Attempt saved to local storage. Continue to the next question or go back to
                the PYQ bank.
              </div>
            )}
          </div>
        </SectionCard>

        {/* ═══ 8. JOURNEY TRACKER ══════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
          {steps.map((s, i) => {
            const isActive = !s.done && (i === 0 || steps[i - 1].done);
            return (
              <React.Fragment key={s.label}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    minWidth: 90,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 12,
                      background: s.done ? T.green : isActive ? paperAccent : T.surface,
                      color: s.done || isActive ? "#09090b" : T.muted,
                      border: `2px solid ${s.done ? T.green : isActive ? paperAccent : T.border}`,
                    }}
                  >
                    {s.done ? "✓" : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.02em",
                      color: s.done ? T.green : isActive ? paperAccent : T.subtle,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      minWidth: 20,
                      background: steps[i].done ? T.green : T.border,
                      marginBottom: 18,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
