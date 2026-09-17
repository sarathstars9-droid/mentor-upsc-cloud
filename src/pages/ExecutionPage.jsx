// src/pages/ExecutionPage.jsx
// MentorOS Command Center — premium Apple-inspired execution controller.
// Preserves the existing command-center API, start/pause/resume actions,
// mandatory proof completion flow, PYQ intelligence link, and /focus workflow.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/auth.js";
import { BACKEND_URL } from "../config";

const USER_ID = "moulika";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function detectTheme() {
  const html = document.documentElement;
  const body = document.body;

  const explicit = (
    html.getAttribute("data-theme") ||
    body?.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    localStorage.getItem("mentor-theme") ||
    ""
  ).toLowerCase();

  if (explicit.includes("dark")) return "dark";
  if (explicit.includes("light")) return "light";
  if (html.classList.contains("dark") || body?.classList.contains("dark")) return "dark";

  try {
    const bg = getComputedStyle(body).backgroundColor;
    const nums = bg.match(/\d+/g)?.map(Number);
    if (nums?.length >= 3) {
      const luminance = (nums[0] * 299 + nums[1] * 587 + nums[2] * 114) / 1000;
      return luminance < 120 ? "dark" : "light";
    }
  } catch (_) {}

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useMentorTheme() {
  const [mode, setMode] = useState(() => detectTheme());

  useEffect(() => {
    const update = () => setMode(detectTheme());
    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }

    window.addEventListener("storage", update);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
      media?.removeEventListener?.("change", update);
    };
  }, []);

  return mode;
}

function palette(mode) {
  const dark = mode === "dark";

  return {
    dark,
    bg: dark ? "#05070A" : "#F7F9FC",
    surface: dark ? "#0D1117" : "#FFFFFF",
    surface2: dark ? "#111720" : "#F7F9FC",
    surface3: dark ? "#171E29" : "#EEF3F8",
    border: dark ? "#202A36" : "#E2E8F0",
    borderStrong: dark ? "#2D3949" : "#D5DEE9",
    text: dark ? "#F7F9FC" : "#0F172A",
    text2: dark ? "#D5DCE7" : "#344054",
    muted: dark ? "#8A96A8" : "#667085",
    faint: dark ? "#5E6978" : "#98A2B3",
    blue: "#0A64F5",
    blueSoft: dark ? "rgba(10,100,245,.16)" : "rgba(10,100,245,.075)",
    green: "#16B364",
    greenSoft: dark ? "rgba(22,179,100,.12)" : "#ECFDF3",
    red: "#EF4D56",
    redSoft: dark ? "rgba(239,77,86,.12)" : "#FFF1F2",
    amber: "#D99100",
    amberSoft: dark ? "rgba(217,145,0,.13)" : "#FFF8E8",
    violet: "#8B5CF6",
    violetSoft: dark ? "rgba(139,92,246,.13)" : "#F5F2FF",
    shadow: dark ? "none" : "0 10px 34px rgba(15,23,42,.055)",
    shadowStrong: dark ? "none" : "0 20px 55px rgba(15,23,42,.085)",
  };
}

function formatClock(value) {
  if (!value) return "—";
  const text = String(value);
  if (/^\d{1,2}:\d{2}/.test(text)) return text.slice(0, 5);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text;

  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDurationMinutes(minutes) {
  const n = Number(minutes || 0);
  if (!n) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function blockId(block) {
  return block?.blockId || block?.block_id || block?.id || null;
}

function blockStatus(block) {
  return String(
    block?.status ||
      block?.block_status ||
      block?.execution_status ||
      block?.state ||
      ""
  ).toLowerCase();
}

function blockMinutes(block) {
  return Number(
    block?.planned_minutes ||
      block?.plannedMinutes ||
      block?.duration_minutes ||
      block?.durationMinutes ||
      block?.minutes ||
      block?.planned_duration ||
      0
  );
}

function blockStart(block) {
  return (
    block?.planned_start ||
    block?.plannedStart ||
    block?.start_time ||
    block?.startTime ||
    block?.start ||
    ""
  );
}

function blockEnd(block) {
  return (
    block?.planned_end ||
    block?.plannedEnd ||
    block?.end_time ||
    block?.endTime ||
    block?.end ||
    ""
  );
}

function blockSubject(block) {
  return block?.subject || block?.title || block?.paper || "Study Block";
}

function blockTopic(block) {
  return block?.topic || block?.subtopic || block?.target || block?.description || "";
}

function planBlocksFromData(data) {
  const candidates = [
    data?.todayBlocks,
    data?.blocks,
    data?.planBlocks,
    data?.executionBlocks,
    data?.todayPlan?.blocks,
    data?.plan?.blocks,
    data?.schedule?.blocks,
  ];

  return candidates.find(Array.isArray) || [];
}

function completedLike(block) {
  return ["completed", "complete", "done", "reviewed"].includes(blockStatus(block));
}

function activeLike(block) {
  return ["active", "in_progress", "in-progress", "running", "started", "focus"].includes(
    blockStatus(block)
  );
}

function pausedLike(block) {
  return ["paused", "pause"].includes(blockStatus(block));
}

function missedLike(block) {
  return ["missed", "skipped", "overdue"].includes(blockStatus(block));
}

function upcomingLike(block) {
  const s = blockStatus(block);
  return !completedLike(block) && !activeLike(block) && !pausedLike(block) && !missedLike(block) &&
    ["", "planned", "upcoming", "pending", "scheduled", "not_started"].includes(s);
}

function Card({ P, children, style = {} }) {
  return (
    <div
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 16,
        boxShadow: P.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ P, children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: P.surface3, color: P.muted, border: P.border },
    blue: { bg: P.blueSoft, color: P.blue, border: `${P.blue}2B` },
    green: { bg: P.greenSoft, color: P.green, border: `${P.green}2B` },
    red: { bg: P.redSoft, color: P.red, border: `${P.red}2B` },
    amber: { bg: P.amberSoft, color: P.amber, border: `${P.amber}2B` },
    violet: { bg: P.violetSoft, color: P.violet, border: `${P.violet}2B` },
  };

  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 8px",
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        fontSize: 10,
        fontWeight: 760,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function Button({
  P,
  children,
  onClick,
  primary = false,
  danger = false,
  subtle = false,
  disabled = false,
  style = {},
}) {
  const bg = primary ? P.blue : danger ? P.redSoft : subtle ? "transparent" : P.surface2;
  const color = primary ? "#fff" : danger ? P.red : P.text2;
  const border = primary ? P.blue : danger ? `${P.red}50` : P.borderStrong;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${border}`,
        background: bg,
        color,
        borderRadius: 10,
        padding: "9px 13px",
        fontFamily: FONT_STACK,
        fontSize: 11.5,
        fontWeight: 780,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: primary && !P.dark ? "0 8px 20px rgba(10,100,245,.18)" : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ P, value, color = null }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: P.surface3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${safe}%`,
          height: "100%",
          borderRadius: 999,
          background: color || P.blue,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
}

function Metric({ P, label, value, tone = "neutral" }) {
  const color =
    tone === "green"
      ? P.green
      : tone === "red"
        ? P.red
        : tone === "amber"
          ? P.amber
          : tone === "blue"
            ? P.blue
            : P.text;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: P.faint, fontSize: 9.5, marginBottom: 3 }}>{label}</div>
      <div style={{ color, fontSize: 12.5, fontWeight: 830 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ P, icon, children, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {icon ? (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: P.blueSoft,
              color: P.blue,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {icon}
          </div>
        ) : null}
        <div style={{ color: P.text, fontSize: 14, fontWeight: 850 }}>{children}</div>
      </div>

      {action}
    </div>
  );
}

export default function ExecutionPage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => palette(mode), [mode]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [proofNotes, setProofNotes] = useState("");
  const [noProofRequired, setNoProofRequired] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [outputType, setOutputType] = useState("notes");
  const [outputCount, setOutputCount] = useState(1);
  const [showProof, setShowProof] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/daily-execution/command-center?date=${todayKey}&userId=${USER_ID}`
      );
      const json = await res.json();

      if (json.ok) {
        setData(json);
        setError("");
      } else {
        setError(json.message || "Error fetching command center data");
      }
    } catch (err) {
      setError(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "startBlock",
          userId: USER_ID,
          payload: { blockId: id, dayKey: todayKey },
        }),
      });

      const json = await res.json();
      if (json.ok) fetchData();
      else alert(json.message || "Failed to start block");
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePause = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pauseBlock",
          userId: USER_ID,
          payload: { blockId: id, dayKey: todayKey },
        }),
      });

      const json = await res.json();
      if (json.ok) fetchData();
      else alert(json.message || "Failed to pause block");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResume = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resumeBlock",
          userId: USER_ID,
          payload: { blockId: id, dayKey: todayKey },
        }),
      });

      const json = await res.json();
      if (json.ok) fetchData();
      else alert(json.message || "Failed to resume block");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteWithProof = async (id) => {
    if (!noProofRequired && !selectedFile && !proofNotes.trim()) {
      alert(
        'Proof validation required. Upload a file/photo, add proof notes, or select "No proof required".'
      );
      return;
    }

    try {
      setSubmittingProof(true);

      let proofUrl = null;
      const proofStatus = noProofRequired ? "waived" : "verified";
      const proofType = noProofRequired
        ? "none"
        : selectedFile
          ? "image"
          : "notes_text";

      if (selectedFile && !noProofRequired) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("blockId", id);
        formData.append("dayKey", todayKey);
        formData.append("userId", USER_ID);
        formData.append("proofType", proofType);
        formData.append("proofNotes", proofNotes);

        const uploadRes = await fetchWithAuth("/api/plan/blocks/upload-proof", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadData.ok) {
          alert(`Failed to upload proof file: ${uploadData.message}`);
          return;
        }

        proofUrl = uploadData.proofUrl;
      }

      const completeRes = await fetch(`${BACKEND_URL}/api/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "completeBlock",
          userId: USER_ID,
          payload: {
            blockId: id,
            dayKey: todayKey,
            reason: "completed",
            outputType,
            outputCount: Number(outputCount) || 1,
            proofUrl,
            proofType,
            proofStatus,
            proofNotes,
          },
        }),
      });

      const completeData = await completeRes.json();

      if (completeData.ok) {
        setSelectedFile(null);
        setProofNotes("");
        setNoProofRequired(false);
        setShowProof(false);
        fetchData();
      } else {
        alert(completeData.message || "Failed to complete block");
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmittingProof(false);
    }
  };

  const executePrimary = async () => {
    if (!data?.command) return;

    const cmd = data.command;
    const task = data.nowTask;
    const id = blockId(task);

    if (cmd.actionRoute) {
      navigate(cmd.actionRoute);
      return;
    }

    if (cmd.primaryAction === "Start Block") {
      if (id) await handleStart(id);
      navigate("/focus");
      return;
    }

    if (cmd.primaryAction === "Resume Block") {
      if (id) await handleResume(id);
      navigate("/focus");
      return;
    }

    if (cmd.primaryAction === "Continue Focus") {
      navigate("/focus");
      return;
    }

    if (cmd.primaryAction === "Pause Block") {
      if (id) await handlePause(id);
    }
  };

  const blocks = useMemo(() => planBlocksFromData(data), [data]);

  const guardian = data?.guardianSnapshot || {};
  const completedCount =
    Number(guardian.blocksCompleted ?? blocks.filter(completedLike).length) || 0;
  const missedCount =
    Number(guardian.blocksMissed ?? blocks.filter(missedLike).length) || 0;
  const totalBlocks = blocks.length || Math.max(completedCount + missedCount, completedCount);
  const planUploaded =
    Boolean(guardian.planUploaded) || totalBlocks > 0 || Boolean(data?.nowTask);

  const progressPct = totalBlocks ? Math.round((completedCount / totalBlocks) * 100) : 0;

  const currentBlock =
    data?.nowTask ||
    blocks.find(activeLike) ||
    blocks.find(pausedLike) ||
    null;

  const nextBlock =
    blocks.find((b) => upcomingLike(b) && blockId(b) !== blockId(currentBlock)) || null;

  const overdueBlocks = data?.overdue?.blocks || [];
  const overdueMistakes = data?.overdue?.mistakes || [];
  const revisionsDue = data?.revisionsDue || [];

  const attentionItems = [
    ...overdueBlocks.slice(0, 2).map((b) => ({
      type: "block",
      label: `${blockSubject(b)}${blockStart(b) ? ` · ${formatClock(blockStart(b))}` : ""}`,
      tone: "red",
    })),
    ...overdueMistakes.slice(0, 2).map((m) => ({
      type: "mistake",
      label: `${m.subject || m.paper || "Must-revise answer"} · unresolved`,
      tone: "amber",
    })),
    ...revisionsDue.slice(0, 2).map((r) => ({
      type: "revision",
      label: r.title || r.subject || "Revision due",
      tone: "red",
    })),
  ].slice(0, 3);

  const activeId = blockId(currentBlock);

  const plannedMinutes = blockMinutes(currentBlock);
  const elapsedSeconds = Number(
    currentBlock?.elapsed_seconds ||
      currentBlock?.elapsedSeconds ||
      currentBlock?.actual_seconds ||
      currentBlock?.actualSeconds ||
      0
  );
  const elapsedMinutes = Math.max(0, Math.round(elapsedSeconds / 60));
  const blockProgress = plannedMinutes
    ? Math.min(100, Math.round((elapsedMinutes / plannedMinutes) * 100))
    : 0;

  const riskLevel = String(guardian.riskLevel || "Low");
  const isRisk = ["high", "medium"].includes(riskLevel.toLowerCase());

  const mentorMessage = isRisk
    ? riskLevel.toLowerCase() === "high"
      ? "Execution risk is high. Protect the current block and clear the highest-priority overdue item before adding new work."
      : "Execution needs attention. Finish the current block before shifting the rest of today’s schedule."
    : attentionItems.length
      ? "Keep the current study block protected. Clear one overdue revision before the day closes."
      : "Execution is on track. Stay with the current block and avoid unnecessary switching.";

  const todayDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (loading && !data) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 420,
          display: "grid",
          placeItems: "center",
          background: P.bg,
          color: P.muted,
          fontFamily: FONT_STACK,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `3px solid ${P.border}`,
              borderTopColor: P.blue,
              margin: "0 auto 10px",
              animation: "mentorExecSpin .8s linear infinite",
            }}
          />
          Synchronizing Command Center…
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        background: P.bg,
        color: P.text,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "22px 24px 36px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                color: P.blue,
                fontSize: 9.5,
                fontWeight: 820,
                letterSpacing: ".11em",
                textTransform: "uppercase",
              }}
            >
              Execution · Live Session Control
            </div>

            <h1
              style={{
                margin: "5px 0 0",
                fontSize: 31,
                lineHeight: 1.04,
                fontWeight: 880,
                letterSpacing: "-.045em",
                color: P.text,
              }}
            >
              Command Center
            </h1>

            <div style={{ color: P.muted, fontSize: 11.5, marginTop: 6 }}>
              Daily Execution & Focus Workspace
            </div>
          </div>

          <Badge P={P}>{todayDate}</Badge>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 14,
              background: P.redSoft,
              border: `1px solid ${P.red}35`,
              color: P.red,
              borderRadius: 12,
              padding: "11px 13px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {error}
            <button
              onClick={fetchData}
              style={{
                border: "none",
                background: "transparent",
                color: P.blue,
                fontWeight: 800,
                marginLeft: 8,
                cursor: "pointer",
                fontFamily: FONT_STACK,
              }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Today's progress */}
        <Card
          P={P}
          style={{
            padding: "11px 14px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(160px,1fr) auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 11, color: P.text2 }}>
              <strong style={{ color: P.blue }}>{completedCount}</strong>
              {totalBlocks ? ` / ${totalBlocks}` : ""} blocks completed
            </div>

            <ProgressBar P={P} value={progressPct} />

            <div style={{ color: P.text, fontSize: 11, fontWeight: 800 }}>
              {progressPct}%
            </div>
          </div>
        </Card>

        {/* HERO / DO THIS NOW */}
        <Card
          P={P}
          style={{
            padding: 18,
            marginBottom: 14,
            borderColor: planUploaded ? `${P.blue}40` : `${P.amber}45`,
            boxShadow: P.shadowStrong,
          }}
        >
          {!planUploaded ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    color: P.amber,
                    fontSize: 9.5,
                    fontWeight: 850,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                  }}
                >
                  Do this now
                </div>

                <div
                  style={{
                    color: P.text,
                    fontSize: 23,
                    fontWeight: 870,
                    letterSpacing: "-.03em",
                    marginTop: 7,
                  }}
                >
                  No plan for today
                </div>

                <div
                  style={{
                    color: P.muted,
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    marginTop: 5,
                    maxWidth: 620,
                  }}
                >
                  Execution starts when today’s study blocks are available. Upload or build the plan first.
                </div>

                {(overdueBlocks.length || revisionsDue.length) ? (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                    {overdueBlocks.length ? (
                      <Badge P={P} tone="red">{overdueBlocks.length} carry-over block(s)</Badge>
                    ) : null}
                    {revisionsDue.length ? (
                      <Badge P={P} tone="amber">{revisionsDue.length} revision(s) due</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Button
                P={P}
                primary
                onClick={() => {
                  if (data?.command?.actionRoute) navigate(data.command.actionRoute);
                  else navigate("/plan");
                }}
                style={{ padding: "11px 18px" }}
              >
                Upload Today’s Plan →
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.15fr) minmax(300px,.85fr)",
                gap: 18,
                alignItems: "center",
              }}
              className="mentor-exec-hero-grid"
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      color: P.amber,
                      fontSize: 9.5,
                      fontWeight: 850,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Do this now
                  </div>

                  {currentBlock ? <Badge P={P} tone="green">● Live Now</Badge> : null}
                </div>

                <div
                  style={{
                    color: P.text,
                    fontSize: 22,
                    lineHeight: 1.25,
                    fontWeight: 870,
                    letterSpacing: "-.025em",
                  }}
                >
                  {currentBlock
                    ? `${blockSubject(currentBlock)}${blockTopic(currentBlock) ? ` → ${blockTopic(currentBlock)}` : ""}`
                    : data?.command?.primaryAction || "Ready to execute"}
                </div>

                <div
                  style={{
                    color: P.muted,
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    marginTop: 5,
                    maxWidth: 650,
                  }}
                >
                  {currentBlock?.target ||
                    currentBlock?.description ||
                    data?.command?.message ||
                    "Start the next planned block."}
                </div>

                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 13 }}>
                  {plannedMinutes ? (
                    <span style={{ color: P.muted, fontSize: 10.5 }}>
                      ◷ {formatDurationMinutes(plannedMinutes)} planned
                    </span>
                  ) : null}

                  {blockStart(currentBlock) || blockEnd(currentBlock) ? (
                    <span style={{ color: P.muted, fontSize: 10.5 }}>
                      ◫ {formatClock(blockStart(currentBlock))} – {formatClock(blockEnd(currentBlock))}
                    </span>
                  ) : null}

                  {currentBlock?.pyqIntelligence?.count ? (
                    <button
                      onClick={() =>
                        navigate(`/pyq/topic/${currentBlock.pyqIntelligence.topicId}`)
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        color: P.blue,
                        fontFamily: FONT_STACK,
                        fontSize: 10.5,
                        fontWeight: 780,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {currentBlock.pyqIntelligence.count} relevant PYQs →
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  borderLeft: `1px solid ${P.border}`,
                  paddingLeft: 18,
                }}
                className="mentor-exec-live-panel"
              >
                {currentBlock ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        color: P.text2,
                        fontSize: 10.5,
                        marginBottom: 8,
                      }}
                    >
                      <span>
                        {elapsedMinutes ? `${elapsedMinutes} min elapsed` : "Block ready"}
                      </span>
                      <span>
                        {plannedMinutes && elapsedMinutes
                          ? `${Math.max(0, plannedMinutes - elapsedMinutes)} min remaining`
                          : ""}
                      </span>
                    </div>

                    <ProgressBar
                      P={P}
                      value={blockProgress}
                      color={blockProgress >= 100 ? P.green : P.blue}
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr .8fr .8fr",
                        gap: 8,
                        marginTop: 12,
                      }}
                      className="mentor-exec-actions"
                    >
                      <Button P={P} primary onClick={executePrimary}>
                        {data?.command?.primaryAction === "Continue Focus"
                          ? "Continue Focus →"
                          : data?.command?.primaryAction === "Resume Block"
                            ? "Resume Block →"
                            : data?.command?.primaryAction === "Start Block"
                              ? "Start Block →"
                              : data?.command?.primaryAction || "Open Focus →"}
                      </Button>

                      <Button
                        P={P}
                        onClick={() => activeId && handlePause(activeId)}
                        disabled={!activeId}
                      >
                        Pause
                      </Button>

                      <Button
                        P={P}
                        onClick={() => setShowProof(true)}
                        disabled={!activeId}
                      >
                        Finish Block
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button P={P} primary onClick={executePrimary}>
                    {data?.command?.primaryAction || "Start Next Block →"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Proof completion */}
        {showProof && currentBlock ? (
          <Card
            P={P}
            style={{
              padding: 16,
              marginBottom: 14,
              borderColor: `${P.amber}40`,
            }}
          >
            <SectionTitle
              P={P}
              icon="✓"
              action={
                <button
                  onClick={() => setShowProof(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: P.muted,
                    cursor: "pointer",
                    fontFamily: FONT_STACK,
                    fontSize: 10.5,
                  }}
                >
                  Cancel
                </button>
              }
            >
              Complete Block
            </SectionTitle>

            <div style={{ color: P.muted, fontSize: 10.5, marginBottom: 13 }}>
              Verify the output before closing this study block.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 150px",
                gap: 10,
                marginBottom: 10,
              }}
              className="mentor-proof-grid"
            >
              <div>
                <label style={{ color: P.muted, fontSize: 9.5, display: "block", marginBottom: 5 }}>
                  Output Type
                </label>
                <select
                  value={outputType}
                  onChange={(e) => setOutputType(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: `1px solid ${P.border}`,
                    background: P.surface2,
                    color: P.text,
                    fontFamily: FONT_STACK,
                    outline: "none",
                  }}
                >
                  <option value="notes">Handwritten / Digital Notes</option>
                  <option value="pyq_practice">PYQ Questions Solved</option>
                  <option value="answer_written">Mains Answer Written</option>
                  <option value="revision_sheet">Revision Summary Sheet</option>
                </select>
              </div>

              <div>
                <label style={{ color: P.muted, fontSize: 9.5, display: "block", marginBottom: 5 }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={outputCount}
                  onChange={(e) => setOutputCount(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: `1px solid ${P.border}`,
                    background: P.surface2,
                    color: P.text,
                    fontFamily: FONT_STACK,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mentor-proof-grid">
              <div>
                <label style={{ color: P.muted, fontSize: 9.5, display: "block", marginBottom: 5 }}>
                  Proof File / Photo
                </label>
                <input
                  type="file"
                  disabled={noProofRequired}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px",
                    borderRadius: 9,
                    border: `1px solid ${P.border}`,
                    background: P.surface2,
                    color: P.muted,
                    fontFamily: FONT_STACK,
                  }}
                />
              </div>

              <div>
                <label style={{ color: P.muted, fontSize: 9.5, display: "block", marginBottom: 5 }}>
                  Study Notes
                </label>
                <input
                  placeholder="Key takeaways / proof notes"
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: `1px solid ${P.border}`,
                    background: P.surface2,
                    color: P.text,
                    fontFamily: FONT_STACK,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <label style={{ color: P.muted, fontSize: 10.5, display: "flex", gap: 7, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={noProofRequired}
                  onChange={(e) => setNoProofRequired(e.target.checked)}
                  style={{ accentColor: P.blue }}
                />
                No proof required for this block
              </label>

              <Button
                P={P}
                primary
                onClick={() => handleCompleteWithProof(activeId)}
                disabled={submittingProof}
              >
                {submittingProof ? "Verifying…" : "Complete Block →"}
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Next / Attention / Mentor */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 12,
            marginBottom: 14,
          }}
          className="mentor-exec-three"
        >
          <Card P={P} style={{ padding: 14 }}>
            <SectionTitle
              P={P}
              icon="□"
              action={
                nextBlock ? (
                  <button
                    onClick={() => navigate("/plan")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: P.blue,
                      fontFamily: FONT_STACK,
                      fontSize: 10,
                      fontWeight: 780,
                      cursor: "pointer",
                    }}
                  >
                    View →
                  </button>
                ) : null
              }
            >
              Next Block
            </SectionTitle>

            {nextBlock ? (
              <>
                <div style={{ color: P.text, fontSize: 13, fontWeight: 830 }}>
                  {blockSubject(nextBlock)}
                </div>
                <div style={{ color: P.muted, fontSize: 10.5, marginTop: 4, lineHeight: 1.45 }}>
                  {blockTopic(nextBlock) || "Scheduled study block"}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 11, color: P.faint, fontSize: 9.5 }}>
                  {blockMinutes(nextBlock) ? <span>◷ {formatDurationMinutes(blockMinutes(nextBlock))}</span> : null}
                  {blockStart(nextBlock) ? <span>◫ {formatClock(blockStart(nextBlock))}</span> : null}
                </div>
              </>
            ) : (
              <div style={{ color: P.muted, fontSize: 10.5 }}>No upcoming block detected.</div>
            )}
          </Card>

          <Card P={P} style={{ padding: 14 }}>
            <SectionTitle
              P={P}
              icon="!"
              action={
                attentionItems.length ? (
                  <button
                    onClick={() => navigate("/revision")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: P.blue,
                      fontFamily: FONT_STACK,
                      fontSize: 10,
                      fontWeight: 780,
                      cursor: "pointer",
                    }}
                  >
                    Review now →
                  </button>
                ) : null
              }
            >
              Needs Attention
            </SectionTitle>

            {attentionItems.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {attentionItems.map((item, index) => (
                  <div
                    key={`${item.type}-${index}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      color: P.text2,
                      fontSize: 10.5,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: item.tone === "red" ? P.red : P.amber, fontWeight: 900 }}>
                      ●
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: P.muted, fontSize: 10.5, lineHeight: 1.5 }}>
                No intervention is needed right now. Continue with today’s execution.
              </div>
            )}
          </Card>

          <Card P={P} style={{ padding: 14, background: P.dark ? "#101721" : "#F7FBFF" }}>
            <SectionTitle P={P} icon="●">Mentor Intervention</SectionTitle>
            <div style={{ color: P.text2, fontSize: 10.5, lineHeight: 1.6 }}>{mentorMessage}</div>

            {data?.answerSuggestion?.reason && !attentionItems.length ? (
              <button
                onClick={() => navigate(data.answerSuggestion.route || "/mains")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: P.blue,
                  fontFamily: FONT_STACK,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "10px 0 0",
                  cursor: "pointer",
                }}
              >
                Open recommended practice →
              </button>
            ) : null}
          </Card>
        </div>

        {/* Today's plan */}
        {blocks.length ? (
          <Card P={P} style={{ padding: 14, marginBottom: 14 }}>
            <SectionTitle
              P={P}
              icon="▣"
              action={
                <button
                  onClick={() => navigate("/plan")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: P.blue,
                    fontFamily: FONT_STACK,
                    fontSize: 10,
                    fontWeight: 780,
                    cursor: "pointer",
                  }}
                >
                  View full plan →
                </button>
              }
            >
              Today’s Execution Plan
            </SectionTitle>

            <div style={{ display: "grid", gap: 2 }}>
              {blocks.map((block, index) => {
                const active = activeLike(block) || blockId(block) === activeId;
                const done = completedLike(block);
                const missed = missedLike(block);

                return (
                  <div
                    key={blockId(block) || index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 70px 170px minmax(0,1fr) 70px 84px",
                      gap: 8,
                      alignItems: "center",
                      minHeight: 34,
                      padding: "4px 8px",
                      borderRadius: 9,
                      background: active ? P.blueSoft : "transparent",
                      border: active ? `1px solid ${P.blue}36` : "1px solid transparent",
                    }}
                    className="mentor-plan-row"
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        border: `1px solid ${
                          done ? P.green : active ? P.blue : missed ? P.red : P.borderStrong
                        }`,
                        color: done ? "#fff" : active ? P.blue : missed ? P.red : P.faint,
                        background: done ? P.green : active ? P.blueSoft : "transparent",
                        fontSize: 9,
                        fontWeight: 900,
                      }}
                    >
                      {done ? "✓" : active ? "▶" : missed ? "!" : ""}
                    </div>

                    <div style={{ color: active ? P.text : P.muted, fontSize: 9.5 }}>
                      {formatClock(blockStart(block))}
                    </div>

                    <div style={{ color: active ? P.text : P.text2, fontSize: 10.5, fontWeight: active ? 820 : 700 }}>
                      {blockSubject(block)}
                    </div>

                    <div
                      style={{
                        color: P.muted,
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {blockTopic(block)}
                    </div>

                    <div style={{ color: P.muted, fontSize: 9.5, textAlign: "right" }}>
                      {blockMinutes(block) ? `${blockMinutes(block)} min` : ""}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <Badge
                        P={P}
                        tone={done ? "green" : active ? "blue" : missed ? "red" : "neutral"}
                      >
                        {done ? "Completed" : active ? "In Progress" : missed ? "Missed" : "Upcoming"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {/* Compact execution status */}
        <Card P={P} style={{ padding: "12px 14px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px repeat(4,minmax(0,1fr))",
              gap: 14,
              alignItems: "center",
            }}
            className="mentor-exec-status"
          >
            <div>
              <div style={{ color: P.text, fontSize: 12.5, fontWeight: 850 }}>Today’s Execution</div>
              <div style={{ color: P.faint, fontSize: 9, marginTop: 2 }}>
                Live execution health
              </div>
            </div>

            <Metric
              P={P}
              label="Blocks Completed"
              value={`${completedCount}${totalBlocks ? ` / ${totalBlocks}` : ""}`}
              tone="blue"
            />

            <Metric
              P={P}
              label="Blocks Missed"
              value={`${missedCount}`}
              tone={missedCount ? "red" : "green"}
            />

            <Metric
              P={P}
              label="Revisions Due"
              value={`${revisionsDue.length}`}
              tone={revisionsDue.length ? "amber" : "green"}
            />

            <Metric
              P={P}
              label="Current Risk"
              value={riskLevel}
              tone={riskLevel.toLowerCase() === "high" ? "red" : riskLevel.toLowerCase() === "medium" ? "amber" : "green"}
            />
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes mentorExecSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1080px) {
          .mentor-exec-three {
            grid-template-columns: 1fr !important;
          }

          .mentor-exec-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .mentor-exec-live-panel {
            border-left: none !important;
            border-top: 1px solid ${P.border} !important;
            padding-left: 0 !important;
            padding-top: 16px !important;
          }

          .mentor-plan-row {
            grid-template-columns: 24px 62px 140px minmax(0,1fr) 70px !important;
          }

          .mentor-plan-row > :last-child {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .mentor-exec-actions {
            grid-template-columns: 1fr !important;
          }

          .mentor-proof-grid {
            grid-template-columns: 1fr !important;
          }

          .mentor-exec-status {
            grid-template-columns: 1fr 1fr !important;
          }

          .mentor-plan-row {
            grid-template-columns: 24px 62px minmax(0,1fr) !important;
          }

          .mentor-plan-row > :nth-child(4),
          .mentor-plan-row > :nth-child(5),
          .mentor-plan-row > :nth-child(6) {
            display: none;
          }
        }

        input::placeholder,
        textarea::placeholder {
          color: ${P.faint};
          opacity: 1;
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 2px solid ${P.blue};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
