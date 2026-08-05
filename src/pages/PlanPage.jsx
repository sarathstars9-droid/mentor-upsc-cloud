import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { BACKEND_URL } from "../config";
import { ACTIVE_EXAM } from "../config/examCalendar";
import { BLOCK_STATUS } from "../blockConstants";
import { getRealStreakFromBlocks } from "../utils/dashboard";
import SyllabusRadar from "../components/Plan/SyllabusRadar.jsx";
import FocusModeModal from "../components/Plan/FocusModeModal.jsx";
import { theme } from "../theme/theme";
import StopConfirmModal from "../components/Plan/StopConfirmModal.jsx";
import BehaviourSignalModal from "../components/Plan/BehaviourSignalModal.jsx";
import PyqSummaryPanel from "../components/PyqSummaryPanel.jsx";
import BlockReviewModal from "../components/Plan/BlockReviewModal.jsx";
import StaleRecoveryModal from "../components/Plan/StaleRecoveryModal.jsx";
import { humanizeMappingCode } from "../utils/mappingUtils";
import { fetchWithAuth } from "../utils/auth";
import HeroSection from "../components/Plan/HeroSection.jsx";
import SpotlightCard from "../components/Plan/SpotlightCard.jsx";
import PlanRightRail from "../components/Plan/PlanRightRail.jsx";
import "../styles/mentoros-plan.css";

import {
  daysLeft,
  getCompletionPercent,
  getDailyMotivation,
  buildTodayBlocksFromParsed,
  formatTimeOnly,
  hhmmToMinutes,
  sumActualMinutes,
  nowMinutesOfDay,
  getDisplayStatus,
  getStatusBadgeColor,
  getEffectiveBlockStatus,
  plannedMinFromParsed,
  sumCsatMinutesFromParsed,
  buildApprovedOcrBlocks,
  buildScheduleBlocksPayload,
  getBlockTimeRange,
} from "../utils/studyEngine";

function getPyqQuestionText(q) {
  if (!q) return "";

  if (q.question) return q.question;
  if (q.prompt) return q.prompt;

  if (q.passageText) {
    return q.passageText.slice(0, 120) + "...";
  }

  return "";
}

function getPyqQuestionLabel(q) {
  if (!q) return "";

  const year = q.year || "";
  const qn = q.questionNumber || "";

  return year && qn ? `${year} Q${qn}` : year ? `${year}` : "";
}

function safePyq(item) {
  return (
    item?.linkedPyqs || {
      syllabusNodeId: "",
      total: 0,
      lastAskedYear: null,
      frequency: 0,
      prelimsCount: 0,
      mainsCount: 0,
      essayCount: 0,
      ethicsCount: 0,
      optionalCount: 0,
      csatCount: 0,
      questions: [],
      mappedNodes: [],
    }
  );
}

function safeMappedNodes(item) {
  const fromLinked = Array.isArray(item?.linkedPyqs?.mappedNodes)
    ? item.linkedPyqs.mappedNodes
    : [];
  const fromItem = Array.isArray(item?.mappedNodes) ? item.mappedNodes : [];

  if (fromLinked.length) return fromLinked;
  if (fromItem.length) return fromItem;

  return [];
}

function hasPyqs(item) {
  return Number(item?.linkedPyqs?.total || 0) > 0;
}

function getPrimaryPyqNodeId(item) {
  return normalizeMappingCode(item?.finalMapping?.nodeId || "");
}

function getCandidatePyqNodeIds(item) {
  const nodeId = getPrimaryPyqNodeId(item);
  return nodeId ? [nodeId] : [];
}
function extractQuestionsFromPyqResponse(data) {
  if (Array.isArray(data?.questions)) return data.questions;
  if (Array.isArray(data?.data?.questions)) return data.data.questions;
  if (Array.isArray(data?.pyq?.questions)) return data.pyq.questions;
  if (Array.isArray(data?.result?.questions)) return data.result.questions;
  if (Array.isArray(data)) return data;
  return [];
}
function getYieldLabel(total) {
  if (total >= 50) return { label: "High Yield", color: "#22c55e" };
  if (total >= 15) return { label: "Medium Yield", color: "#f59e0b" };
  if (total > 0) return { label: "Low Yield", color: "#ef4444" };
  return { label: "No PYQs", color: "#6b7280" };
}

function renderPyqPanel(block) {
  return <PyqSummaryPanel pyq={block?.linkedPyqs} />;
}

/* =========================================================
   UPSC Mentor OS (Production UI)
   - Frontend -> Backend proxy (/api/sheets) -> Apps Script (NO CORS)
   - OCR + mapping + analyze-day + loop-detect via backend

   Phase 2 UX rules enforced here:
   1. Focus Mode stays open after Start and shows active Pause/Stop
   2. Stop requires confirmation before Block Review opens
   3. OCR approval happens before save/calendar/downstream actions
   ========================================================= */

/* ---------------- Google Sheets POST (via Backend Proxy) ---------------- */
async function post(action, payload = {}) {
  const res = await fetchWithAuth(`/api/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend proxy did not return JSON", raw: text };
  }
}

async function loadSyllabusRadar(blocks) {
  const res = await fetchWithAuth(`/api/syllabus-progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ blocks }),
    cache: "no-store",
  });

  const data = await res.json();
  return null;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

/* ---------------- Local Backend: Text → Syllabus Map ---------------- */
async function mapTextToSyllabus(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const res = await fetchWithAuth(`/api/map-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: t }),
    cache: "no-store",
  });

  const outText = await res.text();
  try {
    return JSON.parse(outText);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: outText };
  }
}

/* ---------------- Local Backend: Plan Photo Parse ---------------- */
async function parsePlanPhoto(file, date) {
  const form = new FormData();
  form.append("photo", file);
  form.append("date", date);

  const res = await fetchWithAuth(`/api/plan-photo`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Local Backend: Analyze Day ---------------- */
async function analyzeDay(payload) {
  const res = await fetchWithAuth(`/api/analyze-day`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Local Backend: Loop Detect ---------------- */
async function loopDetect(payload) {
  const res = await fetchWithAuth(`/api/loop-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend did not return JSON", raw: text };
  }
}

/* ---------------- Local Backend: Block Resolver ---------------- */
async function resolveBlock(inputText, minutes) {
  const t = String(inputText || "").trim();
  if (!t) return null;
  try {
    const body = { input: t };
    if (typeof minutes === "number" && minutes > 0) body.minutes = minutes;
    const res = await fetchWithAuth(`/api/blocks/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.warn("resolveBlock failed:", e);
    return null;
  }
}

/* ---------------- Dates ---------------- */
const DEFAULT_PRELIMS = ACTIVE_EXAM.prelims.date.slice(0, 10);
const DEFAULT_MAINS = ACTIVE_EXAM.mains.startDate.slice(0, 10);

function getTodayLocalDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

/* ---------------- Mapping fields for Sheets ---------------- */
function buildMappingFields(mapOut) {
  const mappingCode = mapOut?.mapping?.code ? String(mapOut.mapping.code) : "";
  const mappingPath = mapOut?.mapping?.path ? String(mapOut.mapping.path) : "";

  const matches = Array.isArray(mapOut?.matches) ? mapOut.matches : [];
  const codes = matches
    .map((m) => m?.code)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const paths = matches
    .map((m) => m?.path)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const names = matches
    .map((m) => m?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  return {
    mappingCode,
    mappingPath,
    matchesCodes: codes,
    matchesPaths: paths,
    matchesNames: names,
  };
}

function playReminderBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 350);
  } catch (err) {
    console.warn("Reminder beep failed:", err);
  }
}

function speakReminder(text) {
  try {
    if (!("speechSynthesis" in window)) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("Speech reminder failed:", err);
  }
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return await Notification.requestPermission();
}

function showBrowserNotification(title, body) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      silent: false,
    });
  }
}

async function updateBlockAction(action, payload) {
  return post(action, { payload });
}

function isFinishedStatus(status) {
  return (
    status === BLOCK_STATUS.COMPLETED ||
    status === BLOCK_STATUS.PARTIAL ||
    status === BLOCK_STATUS.MISSED ||
    status === BLOCK_STATUS.SKIPPED ||
    status === BLOCK_STATUS.STOPPED ||
    status === "stopped"
  );
}
function normalizeMappingCode(code = "") {
  const raw = String(code || "").trim();
  if (!raw) return "";

  const upper = raw.replace(/\./g, "-").toUpperCase();

  const exactMap = {
    "GS3.SNT": "GS3-ST",
    "GS1.HIS.ANC": "GS1-HIS-ANC",
    "GS1.HIS.MED": "GS1-HIS-MED",
    "GS1.HIS.ANC.MAURYA": "GS1-HIS-ANC-MAURYA",
    "GS1.HIS": "GS1-HIS",
    "CSAT-CORE": "CSAT-BN",
    "CSAT.CORE": "CSAT-BN",
    "CSAT-APTITUDE": "CSAT-BN",
    "CSAT.NUMERACY": "CSAT-BN",
    "CSAT-BASIC-NUMERACY": "CSAT-BN",
    // NOTE: MISC-GEN removed — fake fallback to GS3-ENV caused false Environment labels
    "GEN": "GS3-ST",
  };

  if (exactMap[raw]) return exactMap[raw];
  if (exactMap[upper]) return exactMap[upper];

  // Suppress MISC-* entirely — never let it reach UI or navigation
  if (upper === "MISC-GEN" || upper.startsWith("MISC")) return "";

  if (upper === "CSAT") return "CSAT-BN";
  if (upper.startsWith("CSAT-BN")) return "CSAT-BN";
  if (upper.startsWith("CSAT-RC")) return "CSAT-RC";
  if (upper.startsWith("CSAT-LR")) return "CSAT-LR";

  if (upper.startsWith("GS3-ENV") || upper === "ENV") return "GS3-ENV";
  if (upper.startsWith("GS3-ECO") || upper === "ECO") return "GS3-ECO";
  if (upper.startsWith("GS2-POL") || upper === "POL") return "GS2-POL";
  if (upper.includes("MAURYA") || upper.includes("MAURYAN")) return "GS1-HIS-ANC-MAURYA";
  if (upper.startsWith("GS1-HIS-ANC") || upper === "ANCIENT") return "GS1-HIS-ANC";
  if (upper.startsWith("GS1-HIS-MED") || upper === "MEDIEVAL") return "GS1-HIS-MED";
  if (upper.startsWith("GS1-HIS-MOD") || upper === "MODERN") return "GS1-HIS-MOD";
  if (upper.startsWith("GS1-HIS") || upper === "HISTORY") return "GS1-HIS";
  return upper;
}

function MappedNodesChips({ nodes = [] }) {
  if (!Array.isArray(nodes) || !nodes.length) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
      }}
    >
      {nodes.map((node) => (
        <span
          key={
            node?.syllabusNodeId || node?.path || node?.code || node?.label || node?.microTheme || String(node?.id || "node")
          }
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(96,165,250,0.28)",
            color: "#dbeafe",
            fontSize: 12,
            fontWeight: 600,
          }}
          title={humanizeMappingCode(node?.path || node?.syllabusNodeId || "")}
        >
          {node?.microTheme || node?.label || node?.syllabusNodeId || "Mapped"}
        </span>
      ))}
    </div>
  );
}
function getQuestionStage(q = {}) {
  const id = String(q?.id || "").trim().toUpperCase();
  const exam = String(q?.exam || "").trim().toLowerCase();
  const paper = String(q?.paper || "").trim().toLowerCase();
  const subject = String(q?.subject || "").trim().toLowerCase();

  if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) return "csat";
  if (id.startsWith("PRE_")) return "prelims";
  if (id.startsWith("ESSAY_")) return "essay";
  if (id.startsWith("ETH_")) return "ethics";
  if (id.startsWith("OPT_")) return "optional";
  if (id.startsWith("MAINS_") || id.startsWith("MAIN_")) return "mains";

  if (/^GS[1-4]_/.test(id)) {
    if (id.startsWith("GS4_")) return "ethics";
    return "mains";
  }

  if (
    exam === "prelims" ||
    exam === "mains" ||
    exam === "essay" ||
    exam === "ethics" ||
    exam === "optional" ||
    exam === "csat"
  ) {
    return exam;
  }

  if (paper === "prelims") return "prelims";
  if (paper === "mains") return "mains";
  if (paper === "essay") return "essay";
  if (paper === "ethics") return "ethics";
  if (paper === "optional") return "optional";
  if (paper === "csat") return "csat";

  if (paper.includes("optional")) return "optional";
  if (paper === "gs4") return "ethics";

  if (
    (paper === "gs1" || paper === "gs2" || paper === "gs3") &&
    subject.includes("csat")
  ) {
    return "csat";
  }

  return "";
}


function formatBlockClock(value) {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}$/.test(String(value).trim())) {
    return String(value).trim();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getBlockPrimaryTopic(block) {
  return (
    block?.finalMapping?.nodeName ||
    block?.ActualTopic ||
    block?.PlannedTopic ||
    "No topic"
  );
}

function getBlockMappingLabel(block) {
  const rawCode = block?.finalMapping?.nodeId || "";
  const name = block?.finalMapping?.nodeName || "";

  if (name) return name;
  const humanized = humanizeMappingCode(rawCode);
  if (humanized && humanized !== rawCode) return humanized;
  if (humanized) return humanized;

  const subject = block?.finalMapping?.subjectName || block?.PlannedSubject || block?.ActualSubject || "";
  const topic = block?.PlannedTopic || block?.ActualTopic || "";
  if (subject && topic) return `${subject} → ${topic}`;
  return subject || "Not mapped";
}

function getBlockChipItems(block) {
  const items = [];
  const pushItem = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    if (!items.includes(cleaned)) items.push(cleaned);
  };

  pushItem(block?.finalMapping?.nodeName || block?.ActualTopic || block?.PlannedTopic);

  const primaryCode = block?.finalMapping?.nodeId || "";
  const coded = humanizeMappingCode(primaryCode);
  if (coded) pushItem(coded);

  return items.slice(0, 2);
}

function getBlockBreadcrumb(block) {
  const mappedNodes = safeMappedNodes(block);
  const primaryPath =
    block?.SyllabusTop1Path ||
    mappedNodes?.[0]?.path ||
    "";

  if (primaryPath) {
    const normalized = primaryPath.replace(/\s*\/\s*/g, " > ");
    // Suppress generic MISC/GEN paths — fall through to subject/topic instead
    if (/^misc\s*(>|\/)/i.test(normalized)) {
      const subject = block?.PlannedSubject || block?.ActualSubject || "";
      const topic = block?.PlannedTopic || block?.ActualTopic || "";
      return [subject, topic].filter(Boolean).join(" > ");
    }
    return normalized;
  }

  const subject = block?.PlannedSubject || block?.ActualSubject || "";
  const topic = block?.PlannedTopic || block?.ActualTopic || "";
  return [subject, topic].filter(Boolean).join(" > ");
}

function getBlockPyqNodeLabel(block) {
  const direct = getPrimaryPyqNodeId(block);
  if (!direct || direct.toUpperCase() === "MISC-GEN") return "—";
  const humanized = humanizeMappingCode(direct);
  return humanized || direct;
}

/* Dynamic CTA label based on block activity type */
function getBlockCtaLabel(block) {
  const activity = String(
    block?._resolverData?.activityType ||
    block?.finalMapping?.nodeName ||
    block?.PlannedTopic ||
    ""
  ).toLowerCase();
  const subject = String(
    block?._resolverData?.subjectLabel ||
    block?.finalMapping?.subjectName ||
    block?.PlannedSubject ||
    ""
  ).toLowerCase();

  if (activity.includes("pyq") || activity.includes("question") || subject.includes("pyq"))
    return "▶ Solve PYQs";
  if (activity.includes("revis")) return "▶ Start Revision";
  if (activity.includes("mapp")) return "▶ Start Mapping";
  if (activity.includes("writ") || activity.includes("answer")) return "▶ Start Writing";
  if (activity.includes("test") || activity.includes("mock")) return "▶ Start Test";
  return "▶ Start";
}

/* Derive a clean View-All-PYQs path from a block */
function minutesToHHMM(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Infer the best PYQ syllabus node from a plain-text subject/topic label.
 * Used when finalMapping.nodeId is empty or suppressed (MISC/GEN).
 */
const SUBJECT_KEYWORD_NODE_MAP = [
  // Environment / Ecology
  ["ecology",      "GS3-ENV"],
  ["environment",  "GS3-ENV"],
  ["biodiversity", "GS3-ENV"],
  ["gs3-env",      "GS3-ENV"],
  // Economy
  ["economy",      "GS3-ECO"],
  ["economics",    "GS3-ECO"],
  ["inflation",    "GS3-ECO"],
  ["gs3-eco",      "GS3-ECO"],
  // Polity / Governance
  ["polity",       "GS2-POL"],
  ["governance",   "GS2-POL"],
  ["constitution", "GS2-POL"],
  ["gs2-pol",      "GS2-POL"],
  ["gs-2",         "GS2-POL"],
  ["gs2",          "GS2-POL"],
  // History
  ["history",      "GS1-HIS"],
  ["ancient",      "GS1-HIS"],
  ["medieval",     "GS1-HIS"],
  ["modern",       "GS1-HIS"],
  ["gs1-his",      "GS1-HIS"],
  // Geography
  ["geography",    "GS1-GEO"],
  ["gs1-geo",      "GS1-GEO"],
  // Science & Technology
  ["science",      "GS3-ST"],
  ["technology",   "GS3-ST"],
  ["gs3-st",       "GS3-ST"],
  // Ethics
  ["ethics",       "GS4-ETH"],
  ["gs4",          "GS4-ETH"],
  // CSAT
  ["csat",         "CSAT-BN"],
  // Essay
  ["essay",        "ESSAY"],
  // GS1 broad fallback (must come after specific gs1 checks)
  ["gs-1",         "GS1-HIS"],
  ["gs1",          "GS1-HIS"],
  // GS3 broad fallback
  ["gs-3",         "GS3-ECO"],
  ["gs3",          "GS3-ECO"],
  // GS4 broad fallback
  ["gs-4",         "GS4-ETH"],
];

function inferNodeFromKeyword(text = "") {
  const lower = text.toLowerCase().trim();
  if (!lower) return "";
  for (const [kw, node] of SUBJECT_KEYWORD_NODE_MAP) {
    if (lower.includes(kw)) return node;
  }
  return "";
}

/**
 * Build "View All PYQs" navigation path.
 *
 * Priority:
 *   1.   Direct nodeId route  →  /pyq/topic/:nodeId  (always works, best UX)
 *   1.5. Infer node from PlannedSubject/ActualSubject keywords
 *   2.   Stage + paper params →  /pyq/topic?stage=...&paper=...&topic=...
 *   3.   Return null if nothing useful
 */
function getBlockPyqNavPath(block) {
  // ── Priority 1: Use the resolved nodeId for a direct, reliable link ──────
  const rawNodeId = block?.finalMapping?.nodeId || "";
  const nodeId = normalizeMappingCode(rawNodeId);

  if (nodeId && nodeId !== "MISC-GEN" && !nodeId.startsWith("MISC") && nodeId !== "GEN") {
    const topic = (block?.PlannedTopic || block?.ActualTopic || "").trim();
    const params = new URLSearchParams();
    if (topic) params.set("topic", topic);
    const qs = params.toString();
    return `/pyq/topic/${encodeURIComponent(nodeId)}${qs ? `?${qs}` : ""}`;
  }

  // ── Priority 1.5: Infer node from subject/topic label keywords ────────────
  const subjectText = [
    block?._resolverData?.subjectLabel || "",
    block?.finalMapping?.subjectName || "",
    block?.PlannedSubject || "",
    block?.ActualSubject || "",
  ].join(" ").trim();

  const inferredNode = inferNodeFromKeyword(subjectText);
  if (inferredNode) {
    const topic = (block?.PlannedTopic || block?.ActualTopic || "").trim();
    const params = new URLSearchParams();
    if (topic) params.set("topic", topic);
    const qs = params.toString();
    return `/pyq/topic/${encodeURIComponent(inferredNode)}${qs ? `?${qs}` : ""}`;
  }

  // ── Priority 2: Fall back to stage + paper + topic query params ───────────
  const stage = (
    block?._resolverData?.stage ||
    block?.StageLock ||
    ""
  ).toLowerCase().trim();

  const paper = (
    block?._resolverData?.gsPaper ||
    block?.GsPaper ||
    ""
  ).toUpperCase().trim();

  const topic = (block?.PlannedTopic || block?.ActualTopic || "").trim();

  if (!stage && !paper && !topic) return null;

  const params = new URLSearchParams();
  if (stage && stage !== "general") params.set("stage", stage);
  if (paper)                        params.set("paper", paper);
  if (topic)                        params.set("topic", topic);

  return `/pyq/topic?${params.toString()}`;
}

/* ─── Add Block Modal ───────────────────────────────────────────────────────
   Lets the user manually add a study block by typing free text.
   Calls /api/blocks/resolve to classify, then appends to todayBlocks.
   ─────────────────────────────────────────────────────────────────────────── */
function AddBlockModal({ open, busy, onClose, onAdd }) {
  const [text, setText] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setResolving(true);
    setResolveError("");
    try {
      // Compute minutes so the resolver can split accurately
      const sm = hhmmToMinutes(startTime);
      const em = hhmmToMinutes(endTime);
      const blockMinutes = (sm != null && em != null && em > sm) ? em - sm : 0;
      const resolved = await resolveBlock(text.trim(), blockMinutes || undefined);
      onAdd({ text: text.trim(), startTime, endTime, resolved });
      setText(""); setStartTime(""); setEndTime("");
    } catch (err) {
      setResolveError("Block resolver unavailable. Block will be added with basic info.");
      onAdd({ text: text.trim(), startTime, endTime, resolved: null });
      setText(""); setStartTime(""); setEndTime("");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="mos-focus-overlay" onClick={onClose}>
      <div
        className="focus-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 96vw)", maxHeight: "88vh", overflow: "auto" }}
      >
        <div className="mos-focus-kicker">Manual Entry</div>
        <h2 className="mos-focus-title" style={{ marginBottom: 4 }}>Add Study Block</h2>
        <div className="mos-focus-subtitle" style={{ marginBottom: 20 }}>
          Type a block description — the resolver will classify it automatically.
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field-label" style={{ marginBottom: 14, display: "block" }}>
            Block Description *
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Polity revision, Economy PYQs, World mapping"
              style={{ marginTop: 6, fontSize: 15, fontWeight: 600 }}
              required
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <label className="field-label">
              Start Time
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
            <label className="field-label">
              End Time
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
          </div>

          {resolveError && (
            <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{resolveError}</div>
          )}

          <div className="mos-focus-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={resolving || busy || !text.trim()}
              style={{ opacity: resolving ? 0.6 : 1 }}
            >
              {resolving ? "Classifying…" : "Add Block"}
            </button>
            <button type="button" className="btn mos-btn-close" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudyBlockCard({
  block,
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
}) {
  const statusValue = getEffectiveBlockStatus(block);

  const isActive    = statusValue === BLOCK_STATUS.ACTIVE;
  const isPaused    = statusValue === BLOCK_STATUS.PAUSED;
  const isDone      = isFinishedStatus(statusValue);
  const isPlanned   = ["planned", "ready_to_start", "overdue"].includes(statusValue);

  const SC_MAP = {
    active:    { bg: "rgba(10, 100, 245, 0.15)",  border: "rgba(10, 100, 245, 0.3)",  color: "#0A64F5", dot: "#0A64F5", label: "ACTIVE"   },
    paused:    { bg: "rgba(234, 179, 8, 0.12)",   border: "rgba(234, 179, 8, 0.24)",   color: "#D97706", dot: "#D97706", label: "PAUSED"   },
    completed: { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)", color: "#059669", dot: "#059669", label: "DONE"     },
    stopped:   { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)", color: "#059669", dot: "#059669", label: "DONE"     },
    partial:   { bg: "rgba(10, 100, 245, 0.05)", border: "rgba(10, 100, 245, 0.15)", color: "#095BE0", dot: "#095BE0", label: "PARTIAL"  },
    missed:    { bg: "rgba(239, 68, 68, 0.06)",   border: "rgba(239, 68, 68, 0.15)",   color: "#DC2626", dot: "#DC2626", label: "MISSED"   },
    skipped:   { bg: "rgba(107, 114, 128, 0.06)", border: "rgba(107, 114, 128, 0.15)", color: "#4B5563", dot: "#4B5563", label: "SKIPPED"  },
    ready_to_start: { bg: "rgba(10, 100, 245, 0.1)",  border: "rgba(10, 100, 245, 0.2)",  color: "#0A64F5", dot: "#0A64F5", label: "READY TO START" },
    overdue:   { bg: "rgba(239, 68, 68, 0.1)",   border: "rgba(239, 68, 68, 0.2)",   color: "#EF4444", dot: "#EF4444", label: "OVERDUE" },
    planned:   { bg: "var(--mos-bg-soft)", border: "var(--mos-border)", color: "var(--mos-text-soft)", dot: "var(--mos-text-soft)", label: "PLANNED"  },
  };
  const sc = SC_MAP[statusValue] || SC_MAP.planned;

  // Title: most specific non-subject candidate wins
  const subjectStr = String(block?.finalMapping?.subjectName || block?.PlannedSubject || block?.ActualSubject || "").trim();
  const topicStr   = String(block?.PlannedTopic || block?.ActualTopic || "").trim();
  const mappedStr  = String(block?.finalMapping?.nodeName || "").trim();
  const cardTitle = (() => {
    for (const c of [topicStr, mappedStr]) {
      if (c && c.toLowerCase() !== subjectStr.toLowerCase()) return c;
    }
    return subjectStr || "Study Block";
  })();

  // Paper label from node id
  const nodeId = String(block?.finalMapping?.nodeId || block?.SyllabusNodeId || block?.SyllabusTop1Code || "").trim();
  const paper = (() => {
    const e = String(block?.GsPaper || "").trim().toUpperCase();
    if (e) return e;
    const m = nodeId.match(/^(GS\d)/i);
    return m ? m[1].toUpperCase() : "";
  })();

  const subtitle = (() => {
    const base = paper && subjectStr ? `${paper} · ${subjectStr}` : subjectStr;
    return base.toLowerCase() === cardTitle.toLowerCase() ? "" : base;
  })();

  const nodeTag = (() => {
    if (!nodeId || /^misc/i.test(nodeId)) return null;
    const parts = nodeId.split("-");
    return parts.length > 2 ? parts.slice(1).join("-") : null;
  })();

  const ctaLabel = getBlockCtaLabel(block);
  const pyqNavPath = getBlockPyqNavPath(block);

  const totalMin = Number(block?.PlannedMinutes || 0);
  const doneMin  = Math.floor(Number(block?.ActualMinutes || 0));
  const leftMin  = Math.max(0, totalMin - doneMin);
  const pct      = totalMin > 0 ? Math.min(100, Math.round((doneMin / totalMin) * 100)) : 0;
  const pyqCount = Number(block?.linkedPyqs?.total || block?.PyqCount || 0);
  const pyqLabel = pyqCount > 0 ? `${pyqCount} PYQs →` : "PYQs →";

  const B = {
    base: {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 30, padding: "0 12px", borderRadius: 7,
      fontWeight: 700, fontSize: 11, cursor: "pointer",
      border: "none", letterSpacing: "-0.01em", whiteSpace: "nowrap",
      transition: "all 0.15s ease",
    },
    primary: { background: "var(--mos-accent)", color: "#fff", boxShadow: "0 2px 6px rgba(10, 100, 245, 0.15)" },
    muted:   {
      background: isActive ? "rgba(10, 100, 245, 0.08)" : "var(--mos-bg-soft)",
      color: isActive ? "#0A64F5" : "var(--mos-text)",
      border: `1px solid ${isActive ? "rgba(10, 100, 245, 0.12)" : "var(--mos-border)"}`
    },
    stop:    { background: "rgba(239, 68, 68, 0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" },
    pyq:     {
      background: isActive ? "rgba(10, 100, 245, 0.04)" : "var(--mos-bg-soft)",
      color: isActive ? "#0A64F5" : "var(--mos-text-soft)",
      border: `1px solid ${isActive ? "rgba(10, 100, 245, 0.08)" : "var(--mos-border)"}`,
      textDecoration: "none"
    },
  };

  return (
    <article style={{
      background: isActive ? "#EAF2FF" : "var(--mos-surface)",
      border: `1px solid ${isActive ? "#CFE0FF" : "var(--mos-border)"}`,
      borderTop: `2px solid ${isActive ? "#0A64F5" : isDone ? "var(--mos-border)" : "var(--mos-border-strong)"}`,
      borderRadius: 16,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      overflow: "hidden",
      boxShadow: isActive ? "0 4px 12px rgba(10, 100, 245, 0.08)" : "var(--mos-shadow-soft)",
      opacity: isDone ? 0.75 : 1,
    }}>
      {/* ROW 1: title + time range */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: isActive ? '#FFFFFF' : 'var(--mos-text)',
          letterSpacing: '-0.025em', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {cardTitle}
        </div>
        <div style={{
          fontFamily: 'var(--mono,monospace)', fontSize: 11, fontWeight: 600,
          color: isActive ? '#9CA3AF' : 'var(--mos-text-soft)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {block?.PlannedStart} {"→"} {block?.PlannedEnd}
        </div>
      </div>

      {/* ROW 2: subtitle + duration */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: isActive ? '#9CA3AF' : 'var(--mos-text-soft)', fontWeight: 500 }}>
          {subtitle || ' '}
        </div>
        <div style={{ fontFamily: 'var(--mono,monospace)', fontSize: 11, color: isActive ? '#E5E7EB' : 'var(--mos-text)' }}>
          {totalMin > 0 ? `${totalMin} min` : ''}
        </div>
      </div>

      {/* ROW 3: status chip + node tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 9px', borderRadius: 20,
          background: sc.bg, border: `1px solid ${sc.border}`,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: sc.dot,
            boxShadow: isActive ? `0 0 4px ${sc.dot}` : 'none', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            color: sc.color, fontFamily: 'var(--mono,monospace)',
          }}>
            {sc.label}
          </span>
        </div>
        {nodeTag && (
          <span style={{ fontSize: 10, color: isActive ? '#9CA3AF' : 'var(--mos-text-soft)', fontFamily: 'var(--mono,monospace)', fontWeight: 600 }}>
            {nodeTag}
          </span>
        )}
      </div>

      {/* ROW 4: progress bar OR starts-at */}
      {(isActive || isPaused || isDone) && totalMin > 0 ? (
        <div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--mos-bg-soft)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{
              height: '100%', borderRadius: 2, width: `${pct}%`,
              background: isActive ? '#0A64F5' : isPaused ? 'var(--mos-warning)' : 'var(--mos-text-soft)',
              transition: 'width 1s linear', minWidth: pct > 0 ? 2 : 0,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--mos-text-soft)', fontFamily: 'var(--mono,monospace)' }}>
              {doneMin > 0 ? `${doneMin} min done · ${leftMin} min left` : `${totalMin} min left`}
            </span>
            {pct > 0 && (
              <span style={{ fontSize: 10, color: 'var(--mos-text)', fontFamily: 'var(--mono,monospace)' }}>{pct}%</span>
            )}
          </div>
        </div>
      ) : isPlanned && block?.PlannedStart ? (
        <div style={{ fontSize: 10, color: 'var(--mos-text-soft)', fontFamily: 'var(--mono,monospace)' }}>
          Starts at {block.PlannedStart}
        </div>
      ) : null}

      {/* ROW 5: action buttons + PYQ link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
        {isPlanned && (
          <button disabled={busy} onClick={() => onStart?.(block.BlockId, { openFocus: true })}
            style={{ ...B.base, ...B.primary }}>
            {ctaLabel}
          </button>
        )}
        {isActive && (
          <>
            <button disabled={busy} onClick={() => onPause?.(block.BlockId)}
              style={{ ...B.base, ...B.muted }}>
              Pause
            </button>
            <button disabled={busy} onClick={() => onStop?.(block)}
              style={{ ...B.base, ...B.stop }}>
              Stop
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button disabled={busy} onClick={() => onResume?.(block.BlockId)}
              style={{ ...B.base, ...B.primary }}>
              Resume
            </button>
            <button disabled={busy} onClick={() => onStop?.(block)}
              style={{ ...B.base, ...B.stop }}>
              Stop
            </button>
          </>
        )}
        {pyqNavPath && (
          <a href={pyqNavPath} target='_blank' rel='noopener noreferrer'
            style={{ ...B.base, ...B.pyq, marginLeft: 'auto' }}>
            {pyqLabel}
          </a>
        )}
      </div>
    </article>
  );
}

function normalizeCanonicalBlockStatus(block) {
  return String(
    block?.Status ??
    block?.status ??
    ""
  )
    .toLowerCase()
    .trim();
}

export default function PlanPage() {
  const [prelimsDate] = useState(DEFAULT_PRELIMS);
  const [mainsDate] = useState(DEFAULT_MAINS);
  const [healthData, setHealthData] = useState(null);

  const studyBlocksRef = useRef(null);
  const nightReviewRef = useRef(null);
  const loopDetectorRef = useRef(null);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [pendingStopBlock, setPendingStopBlock] = useState(null);
  const [switchBlockConfirmOpen, setSwitchBlockConfirmOpen] = useState(false);
  const [pendingStartRequest, setPendingStartRequest] = useState(null);

  const [staleRecoveryModalOpen, setStaleRecoveryModalOpen] = useState(false);
  const [staleBlockData, setStaleBlockData] = useState(null);

  const [date, setDate] = useState(getTodayLocalDate());
  const [planMin, setPlanMin] = useState(360);
  const [doneMin, setDoneMin] = useState(0);
  const [csatMin, setCsatMin] = useState(60);
  const [reflection, setReflection] = useState("");
  const [syllabusRadar, setSyllabusRadar] = useState(null);

  const [review, setReview] = useState({
    planCompleted: "Partial",
    wentWell: "",
    wentWrongReason: "Distraction",
    wentWrongText: "",
    extraDone: "No",
    extraText: "",
    extraMinutes: 0,
  });

  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sequence");
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [weekly, setWeekly] = useState(null);
  const [alertPermission, setAlertPermission] = useState("unknown");
  const [reminderState, setReminderState] = useState({});

  const [planPhoto, setPlanPhoto] = useState(null);
  const [parsedPlan, setParsedPlan] = useState(null);

  const [mappingResult, setMappingResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loops, setLoops] = useState(null);

  const [todayBlocks, setTodayBlocks] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const todayBlocksRef = useRef([]);
  useEffect(() => { todayBlocksRef.current = todayBlocks; }, [todayBlocks]);
  // Tracks blocks that handleStartBlock has been called on, synchronously — used by the
  // reminder interval to suppress "Please begin" notifications even before todayBlocksRef
  // is updated (which only happens after the next React commit via useEffect).
  const startedBlocksRef = useRef(new Set());
  const [currentBlockPyqLive, setCurrentBlockPyqLive] = useState(null);
  const [currentBlockPyqLoading, setCurrentBlockPyqLoading] = useState(false);
  const [currentBlockPyqError, setCurrentBlockPyqError] = useState("");
  const [ocrApprovalOpen, setOcrApprovalOpen] = useState(false);
  const [ocrDraftBlocks, setOcrDraftBlocks] = useState([]);
  const [ocrPreviewReminderBlocks, setOcrPreviewReminderBlocks] = useState([]);

  // Phase 8: Knowledge Linkage — PYQ recommendation after block completion
  const [pyqRecommendation, setPyqRecommendation] = useState(null);

  const [activeReviewBlock, setActiveReviewBlock] = useState(null);
  const streakToday = getRealStreakFromBlocks(todayBlocks, doneMin);

  const [reviewForm, setReviewForm] = useState({
    completionStatus: "",
    topicMatchStatus: "",
    outputType: "",
    outputCount: 0,
    focusRating: "",
    interruptionReason: "",
    reviewNotes: "",
    backlogBucket: "",
  });

  const currentBlock = useMemo(() => {
    const active = todayBlocks.find(
      (block) =>
        normalizeCanonicalBlockStatus(block) ===
        "active"
    );

    if (active) return active;

    return (
      todayBlocks.find(
        (block) =>
          normalizeCanonicalBlockStatus(block) ===
          "paused"
      ) ?? null
    );
  }, [todayBlocks]);

  const nextBlock = useMemo(() => {
    const currentIndex = currentBlock
      ? todayBlocks.findIndex(
          (block) =>
            block.BlockId === currentBlock.BlockId
        )
      : -1;

    const candidates = todayBlocks.slice(
      currentIndex + 1
    );

    return (
      candidates.find((block) => {
        const status =
          normalizeCanonicalBlockStatus(block);

        return (
          status === "planned" ||
          status === "upcoming"
        );
      }) ?? null
    );
  }, [todayBlocks, currentBlock]);

  // Live elapsed timer.
  // Seeds from ActualSeconds (backend-derived, returned by the PostgreSQL merge layer)
  // then ticks forward every second locally — display only, never becomes state truth.
  // On each 10-second poll the backend value re-anchors the seed, correcting any drift.
  const [liveElapsedSec, setLiveElapsedSec] = useState(0);
  useEffect(() => {
    function computeElapsed() {
      if (!currentBlock?.ActualStart) { setLiveElapsedSec(0); return; }
      const status = getEffectiveBlockStatus(currentBlock);
      if (status !== BLOCK_STATUS.ACTIVE && status !== BLOCK_STATUS.PAUSED) {
        return;
      }

      // Prefer backend-computed ActualSeconds (set by PostgreSQL merge layer).
      // Fall back to local timestamp arithmetic for the 1-second ticks between polls.
      const backendSec = Number(currentBlock.ActualSeconds || 0);
      if (backendSec > 0 && status === BLOCK_STATUS.PAUSED) {
        // Paused: timer is frozen — use backend value directly
        setLiveElapsedSec(backendSec);
        return;
      }

      const startMs = new Date(currentBlock.ActualStart).getTime();
      if (isNaN(startMs)) { setLiveElapsedSec(0); return; }
      // TotalPauseSeconds from PostgreSQL merge (accurate); fall back to minutes * 60
      const totalPauseSec = Number(currentBlock.TotalPauseSeconds || 0)
        || Number(currentBlock.TotalPauseMinutes || 0) * 60;

      if (status === BLOCK_STATUS.PAUSED) {
        const pausedAtMs = currentBlock.LastPauseAt
          ? new Date(currentBlock.LastPauseAt).getTime()
          : Date.now();
        setLiveElapsedSec(Math.max(0, Math.floor((pausedAtMs - startMs) / 1000) - totalPauseSec));
      } else {
        setLiveElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000) - totalPauseSec));
      }
    }
    computeElapsed();
    let id = setInterval(computeElapsed, 1000);
    // ✅ CLEANUP: Clear interval when currentBlock changes or component unmounts
    // If not cleared → timer will tick in background even after STOP
    return () => {
      clearInterval(id);
      id = null;
    };
  }, [currentBlock]);

  const currentBlockPyqNodeId = useMemo(() => {
    return getPrimaryPyqNodeId(currentBlock);
  }, [currentBlock]);

  const currentBlockPyq = useMemo(() => {
    const linked = safePyq(currentBlock);

    if (linked?.total > 0) {
      return linked;
    }

    const liveQuestions = Array.isArray(currentBlockPyqLive) ? currentBlockPyqLive : [];

    if (liveQuestions.length) {
      const prelimsCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "prelims"
      ).length;

      const mainsCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "mains"
      ).length;

      const essayCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "essay"
      ).length;

      const ethicsCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "ethics"
      ).length;

      const optionalCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "optional"
      ).length;

      const csatCount = liveQuestions.filter(
        (q) => getQuestionStage(q) === "csat"
      ).length;

      const years = liveQuestions
        .map((q) => Number(q.year))
        .filter((y) => !Number.isNaN(y) && y > 0);

      const lastAskedYear = years.length ? Math.max(...years) : null;

      return {
        syllabusNodeId: currentBlockPyqNodeId || "",
        total: liveQuestions.length,
        lastAskedYear,
        frequency: 0,
        prelimsCount,
        mainsCount,
        essayCount,
        ethicsCount,
        optionalCount,
        csatCount,
        questions: liveQuestions,
        mappedNodes: [],
      };
    }

    return safePyq();
  }, [currentBlock, currentBlockPyqLive, currentBlockPyqNodeId]);

  useEffect(() => {
    const candidateNodeIds = getCandidatePyqNodeIds(currentBlock);

    if (!candidateNodeIds.length) {
      setCurrentBlockPyqLive(null);
      setCurrentBlockPyqLoading(false);
      setCurrentBlockPyqError("");
      return;
    }

    let ignore = false;
    setCurrentBlockPyqLoading(true);
    setCurrentBlockPyqError("");

    (async () => {
      try {
        for (const nodeId of candidateNodeIds) {
          const res = await fetchWithAuth(`/api/pyq/node/${encodeURIComponent(nodeId)}`, { cache: "no-store" });
          const data = await res.json();
          if (ignore) return;

          const questions = extractQuestionsFromPyqResponse(data);
          if ((data?.success || Array.isArray(questions)) && questions.length > 0) {
            setCurrentBlockPyqLive(questions);
            setCurrentBlockPyqError("");
            setCurrentBlockPyqLoading(false);
            return;
          }
        }

        if (!ignore) {
          setCurrentBlockPyqLive([]);
          setCurrentBlockPyqError("No PYQs found for the mapped node.");
          setCurrentBlockPyqLoading(false);
        }
      } catch (err) {
        console.warn("Failed to load live PYQ data:", err);
        if (!ignore) {
          setCurrentBlockPyqLive([]);
          setCurrentBlockPyqError("Failed to load live PYQs.");
          setCurrentBlockPyqLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [currentBlock]);

  useEffect(() => {
    if (!("Notification" in window)) {
      setAlertPermission("unsupported");
      return;
    }
    setAlertPermission(Notification.permission);
  }, []);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/system/health`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setHealthData(data);
        }
      } catch (err) {
        console.warn("Failed to fetch system health status:", err);
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 15 * 1000);
    return () => clearInterval(interval);
  }, []);

  const blockLoadSequenceRef = useRef(0);

  const loadBlocksForDate = useCallback(
    async (targetDate = date) => {
      const sequence = ++blockLoadSequenceRef.current;
      setLoadError(null);
      try {
        let pgRes = null;
        let pgErr = null;
        const startTime = Date.now();

        try {
          const rawPg = await fetchWithAuth(`/api/plan/blocks?dayKey=${targetDate}`);
          pgRes = await rawPg.json();
        } catch (err) {
          pgErr = err.message;
        }

        if (sequence !== blockLoadSequenceRef.current) return;

        let res = null;

        if (pgRes && pgRes.ok && pgRes.blocks && pgRes.blocks.length > 0) {
          res = pgRes;
          console.log(JSON.stringify({ operation: 'load_plan', user_id: pgRes.userId || 'unknown', requested_date: targetDate, source: 'postgres', block_count: pgRes.blocks.length, elapsed_ms: Date.now() - startTime }));
        } else if (pgRes && pgRes.ok && pgRes.blocks && pgRes.blocks.length === 0) {
          res = pgRes;
          console.log(JSON.stringify({ operation: 'load_plan', user_id: pgRes.userId || 'unknown', requested_date: targetDate, source: 'postgres', block_count: 0, elapsed_ms: Date.now() - startTime }));
        } else {
          // Postgres failed
          res = { ok: false, source: 'postgres_error', error: 'Unable to load the current plan.' };
          console.error(JSON.stringify({ operation: 'load_plan', requested_date: targetDate, source: 'postgres_error', error: pgErr || pgRes?.message }));
        }

        if (!res?.ok) {
          console.warn("loadBlocksForDate failed:", res);
          setTodayBlocks([]);
          setLoadError(res?.error || "Failed to load plan blocks");
          return;
        }

        const blocks = Array.isArray(res?.blocks) ? res.blocks : [];

        const mapped = blocks.map((b) => {
          const rawStatus = String(b.Status || "").trim().toLowerCase();

          let derivedStatus = BLOCK_STATUS.PLANNED;

          const pausedAfterResume =
            b.LastPauseAt &&
            (!b.LastResumeAt ||
              new Date(b.LastPauseAt).getTime() > new Date(b.LastResumeAt).getTime());

          if (b.ActualEnd) {
            if (
              rawStatus === BLOCK_STATUS.PARTIAL ||
              rawStatus === BLOCK_STATUS.MISSED ||
              rawStatus === BLOCK_STATUS.SKIPPED
            ) {
              derivedStatus = rawStatus;
            } else {
              derivedStatus = BLOCK_STATUS.COMPLETED;
            }
          } else if (rawStatus === "review_pending") {
            derivedStatus = "review_pending";
          } else if (rawStatus === BLOCK_STATUS.PAUSED || pausedAfterResume) {
            derivedStatus = BLOCK_STATUS.PAUSED;
          } else if (b.ActualStart) {
            derivedStatus = BLOCK_STATUS.ACTIVE;
          }

          let mappedNodes = [];
          const rawMappedNodes = String(b.MappedNodesRaw || "").trim();

          if (rawMappedNodes) {
            try {
              const parsed = JSON.parse(rawMappedNodes);
              if (Array.isArray(parsed)) {
                mappedNodes = parsed;
              }
            } catch (err) {
              console.warn("Failed parsing MappedNodesRaw for block:", b.BlockId, err);
            }
          }

          const normalizedMappedNodes = Array.isArray(mappedNodes)
            ? mappedNodes
              .map((node) => {
                if (!node) return null;

                return {
                  topic: node.topic || "",
                  syllabusNodeId: node.syllabusNodeId || node.code || "",
                  code: normalizeMappingCode(node.code || node.syllabusNodeId || ""),
                  label: node.label || node.microTheme || node.topic || "",
                  microTheme: node.microTheme || node.label || node.topic || "",
                  path: node.path || "",
                  confidence: Number(node.confidence || 0),
                };
              })
              .filter((node) => node && node.syllabusNodeId)
            : [];

          return {
            BlockId: b.BlockId,
            PlannedSubject: b.Subject || "Unknown",
            PlannedTopic: b.Topic || "",
            PlannedStart: b.Start || "",
            PlannedEnd: b.End || "",
            PlannedMinutes: Number(b.Minutes || 0),

            ActualStart: b.ActualStart || "",
            ActualEnd: b.ActualEnd || "",
            ActualMinutes: Number(b.ActualMinutes || 0),

            PauseCount: Number(b.PauseCount || 0),
            TotalPauseMinutes: Number(b.TotalPauseMinutes || 0),
            LastPauseAt: b.LastPauseAt || "",
            LastResumeAt: b.LastResumeAt || "",

            Status: derivedStatus,
            CompletionStatus: b.CompletionStatus || "",
            TopicMatchStatus: b.TopicMatchStatus || "",

            OutputType: b.OutputType || "",
            OutputCount: Number(b.OutputCount || 0),
            FocusRating: b.FocusRating || "",
            InterruptionReason: b.InterruptionReason || "",
            ReviewNotes: b.ReviewNotes || "",
            BacklogBucket: b.BacklogBucket || "",

            ActualSubject: b.ActualSubject || "",
            ActualTopic: b.ActualTopic || "",

            SyllabusTop1Code: normalizeMappingCode(b.MappingCode || ""),
            SyllabusTop1Path: b.MappingPath || "",

            MappedNodesRaw: rawMappedNodes,
            MappedNodeIds: b.MappedNodeIds || "",
            MappedNodeLabels: b.MappedNodeLabels || "",
            mappedNodes: normalizedMappedNodes,

            finalMapping: {
              subjectId: b.SubjectId || "",
              subjectName: b.MappingSubject || b.Subject || "Unknown",
              nodeId: normalizeMappingCode(b.SyllabusNodeId || b.MappingCode || ""),
              nodeName: b.MappingMicroTheme || b.Topic || "",
              mappingSource: b.MappingSource || "UNKNOWN",
              resolverConfidence: Number(b.Confidence || 0),
              isApproved: String(b.ApprovalRequired).toLowerCase() === "no",
            },
          };
        });

        const dedupedMapped = Array.from(
          new Map(
            mapped.map((block) => [block.BlockId || `${block.PlannedStart}_${block.PlannedSubject}_${block.PlannedTopic}`, block])
          ).values()
        );

        // Safety guard: if multiple ACTIVE blocks exist (legacy/race condition), keep only
        // the one with the latest ActualStart and mark the rest back to PLANNED.
        const activeBlocks = dedupedMapped.filter((b) => b.Status === BLOCK_STATUS.ACTIVE);
        let safeBlocks = dedupedMapped;
        if (activeBlocks.length > 1) {
          const latestActive = activeBlocks.reduce((latest, b) => {
            const bMs = b.ActualStart ? new Date(b.ActualStart).getTime() : 0;
            const lMs = latest.ActualStart ? new Date(latest.ActualStart).getTime() : 0;
            return bMs > lMs ? b : latest;
          });
          safeBlocks = dedupedMapped.map((b) =>
            b.Status === BLOCK_STATUS.ACTIVE && b.BlockId !== latestActive.BlockId
              ? { ...b, Status: BLOCK_STATUS.PLANNED }
              : b
          );
          console.warn("[PlanPage] Multiple ACTIVE blocks detected — kept latest, reset others to PLANNED", {
            kept: latestActive.BlockId,
            reset: activeBlocks.filter((b) => b.BlockId !== latestActive.BlockId).map((b) => b.BlockId),
          });
        }

        setTodayBlocks(safeBlocks);

        setReminderState((prev) => {
          const next = {};

          for (const block of mapped) {
            const blockId = block.BlockId;
            if (!blockId) continue;

            const blockStatus = getEffectiveBlockStatus(block);
            const old = prev[blockId] || {};

            if (
              blockStatus === BLOCK_STATUS.COMPLETED ||
              blockStatus === BLOCK_STATUS.PARTIAL ||
              blockStatus === BLOCK_STATUS.MISSED ||
              blockStatus === BLOCK_STATUS.SKIPPED
            ) {
              // Backend confirmed terminal status — remove from startedBlocksRef
              startedBlocksRef.current.delete(blockId);
              next[blockId] = {
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: true,
              };
              continue;
            }

            if (blockStatus === BLOCK_STATUS.ACTIVE) {
              // Backend confirmed block is active — remove from startedBlocksRef
              // (todayBlocksRef.current will now have ActualStart, so the ref is no longer needed)
              startedBlocksRef.current.delete(blockId);
              next[blockId] = {
                ...old,
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: false,
              };
              continue;
            }

            if (blockStatus === BLOCK_STATUS.PAUSED) {
              startedBlocksRef.current.delete(blockId);
              next[blockId] = {
                ...old,
                start_now: true,
                not_started_3: true,
                please_begin_5: true,
                paused_too_long: old.paused_too_long || false,
              };
              continue;
            }

            next[blockId] = {
              start_now: old.start_now || false,
              not_started_3: old.not_started_3 || false,
              please_begin_5: old.please_begin_5 || false,
              paused_too_long: false,
            };
          }

          return next;
        });

        if (mapped.length > 0) {
          const totalPlanned = mapped.reduce(
            (sum, block) => sum + Number(block.PlannedMinutes || 0),
            0
          );
          if (totalPlanned > 0) {
            setPlanMin(totalPlanned);
          }
        }

        try {
          const radarData = await loadSyllabusRadar(mapped);
          if (radarData?.radar) {
            setSyllabusRadar(radarData.radar);
          }
        } catch (err) {
          console.warn("Radar load failed", err);
        }
      } catch (err) {
        if (sequence === blockLoadSequenceRef.current) {
          console.error("loadBlocksForDate failed", err);
        }
      }
    },
    [date]
  );

  useEffect(() => {
    setReminderState({});
  }, [date]);

  useEffect(() => {
    if (!date) return;
    loadBlocksForDate(date);
  }, [date, loadBlocksForDate]);

  useEffect(() => {
    function handleWindowFocus() {
      loadBlocksForDate(date);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadBlocksForDate(date);
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [date, loadBlocksForDate]);

  useEffect(() => {
    if (!date) return;

    // 10-second poll keeps lifecycle state (status, timer, pauses) accurate across
    // refresh, multiple tabs, and mobile. Backend /api/sheets now enriches each
    // getBlocksForDate response with PostgreSQL-derived actualSeconds / status.
    const id = setInterval(() => {
      loadBlocksForDate(date);
    }, 10000);

    return () => clearInterval(id);
  }, [date, loadBlocksForDate]);

  useEffect(() => {
    setDoneMin(sumActualMinutes(todayBlocks));
  }, [todayBlocks]);

  useEffect(() => {
    if (!todayBlocks.length) return;

    const timerId = setInterval(() => {
      setReminderState((prev) => {
        const next = { ...prev };
        const nowMin = nowMinutesOfDay();
        let changed = false;

        function fireStartReminder(block, stage) {
          // Final guard: re-check the block's latest status right before firing.
          // This catches the case where handleStartBlock ran AFTER isAlreadyHandled was
          // evaluated but BEFORE the updater reached this point (stale todayBlocksRef window).
          // startedBlocksRef is a synchronous ref updated before any awaits in handleStartBlock.
          const bid = block.BlockId;
          if (startedBlocksRef.current.has(bid)) {
            console.log("[ReminderGuard] startedBlocksRef hit", block.id);
            return;
          }
          const latestBlock = todayBlocksRef.current.find((b) => b.BlockId === bid);
          if (latestBlock) {
            const latestStatus = getEffectiveBlockStatus(latestBlock);
            if (
              latestBlock.ActualStart ||
              ["active", "paused", "completed", "partial", "done", "missed", "skipped"].includes(latestStatus)
            ) return;
          }

          const subject = block.PlannedSubject || "Study";
          const topic = block.PlannedTopic || "No topic";

          let speechText = "";
          let bodyText = "";

          if (stage === "start_now") {
            speechText = `${subject} block should start now`;
            bodyText = `${subject}: ${topic}`;
          } else if (stage === "not_started_3") {
            speechText = `${subject} block not started yet`;
            bodyText = `${subject} still not started.`;
          } else if (stage === "please_begin_5") {
            speechText = `Please begin ${subject} practice`;
            bodyText = `Please begin ${subject} now.`;
          } else if (stage === "paused_too_long") {
            speechText = `${subject} block is paused too long. Please resume now`;
            bodyText = `${subject} has been paused too long.`;
          } else {
            return;
          }

          showBrowserNotification("UPSC Mentor OS", bodyText);
          playReminderBeep();
          speakReminder(speechText);
          setStatus(`⏰ ${speechText}`);
        }

        for (const block of todayBlocksRef.current) {
          if (!block?.BlockId) continue;

          const blockId = block.BlockId;
          const plannedStartMin = hhmmToMinutes(block.PlannedStart);
          if (plannedStartMin === null) continue;

          const delta = nowMin - plannedStartMin;
          const current = next[blockId] || {
            start_now: false,
            not_started_3: false,
            please_begin_5: false,
            paused_too_long: false,
          };

          const blockStatus = getEffectiveBlockStatus(block);

          // startedBlocksRef is updated synchronously in handleStartBlock before any await,
          // so it's reliable even when todayBlocksRef.current still shows the old PLANNED status.
          const isAlreadyHandled =
            startedBlocksRef.current.has(blockId) ||
            ["active", "paused", "completed", "done", "partial", "missed", "skipped"].includes(String(block.Status || blockStatus || "").toLowerCase()) ||
            block.started_at ||
            block.startedAt ||
            block.ActualStart ||
            block.actual_start_time;

          if (!isAlreadyHandled) {
            if (delta >= 0 && !current.start_now) {
              fireStartReminder(block, "start_now");
              current.start_now = true;
              changed = true;
            }

            if (delta >= 3 && !current.not_started_3) {
              fireStartReminder(block, "not_started_3");
              current.not_started_3 = true;
              changed = true;
            }

            if (delta >= 5 && !current.please_begin_5) {
              fireStartReminder(block, "please_begin_5");
              current.please_begin_5 = true;
              changed = true;
            }
          }

          if (blockStatus === BLOCK_STATUS.PAUSED && block.LastPauseAt && !current.paused_too_long) {
            const pausedAt = new Date(block.LastPauseAt);
            if (!Number.isNaN(pausedAt.getTime())) {
              const minsPaused = Math.max(0, Math.round((Date.now() - pausedAt.getTime()) / 60000));
              if (minsPaused >= 10) {
                fireStartReminder(block, "paused_too_long");
                current.paused_too_long = true;
                changed = true;
              }
            }
          }

          next[blockId] = current;
        }

        return changed ? next : prev;
      });
    }, 30000);

    return () => clearInterval(timerId);
  }, [todayBlocks]);

  const dPre = daysLeft(prelimsDate);
  const dMains = daysLeft(mainsDate);

  const completionToday = useMemo(() => {
    return getCompletionPercent(planMin, doneMin);
  }, [planMin, doneMin]);

  const dailyMotivation = useMemo(() => {
    return getDailyMotivation(completionToday);
  }, [completionToday]);

  const spotlightMessage = useMemo(() => {
    if (!currentBlock) {
      return "Upload a plan photo or create today's blocks to begin execution.";
    }

    const statusValue = getEffectiveBlockStatus(currentBlock);

    if (statusValue === BLOCK_STATUS.ACTIVE) {
      return "This is the block that matters now. Protect it.";
    }

    if (statusValue === BLOCK_STATUS.PAUSED) {
      return "Resume calmly. Momentum returns faster than you think.";
    }

    if (statusValue === BLOCK_STATUS.PLANNED) {
      return "Start the next meaningful block. One clean start changes the day.";
    }

    return "Stay steady. Execution is built one block at a time.";
  }, [currentBlock]);

  function autoFillFromParsed(out) {
    if (out?.date) setDate(out.date);

    const total = Number(out?.totalMinutes ?? 0);
    if (total > 0) setPlanMin(total);

    const csat = sumCsatMinutesFromParsed(out);
    if (csat > 0) setCsatMin(csat);

    setDoneMin(0);
    setReflection("Plan auto-filled from photo. Edit if needed.");
    setAnalysis(null);
    setMappingResult(null);
    setLoops(null);
  }

  async function handleSwitchBlockConfirm() {
    if (!pendingStartRequest) return;
    setSwitchBlockConfirmOpen(false);

    const activeBlock = todayBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.ACTIVE
    );

    if (activeBlock) {
      setTodayBlocks((prev) =>
        prev.map((b) =>
          b.BlockId === activeBlock.BlockId
            ? { ...b, Status: "review_pending" }
            : b
        )
      );
      setSpotlightOpen(false);
      // activeReviewBlock intentionally NOT set — no review popup during switch
    }

    const { blockId, options } = pendingStartRequest;
    setPendingStartRequest(null);
    await handleStartBlock(blockId, options);
  }

  async function handleStartBlock(blockId, options = {}) {
    const { openFocus = true } = options;

    // Single-active enforcement: auto-stop any running block before starting a new one.
    // Marks it as review_pending (no review popup) so the user can review it later.
    const existingActive = todayBlocks.find(
      (b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.ACTIVE && b.BlockId !== blockId
    );
    if (existingActive) {
      setTodayBlocks((prev) =>
        prev.map((b) =>
          b.BlockId === existingActive.BlockId ? { ...b, Status: "review_pending" } : b
        )
      );
      setSpotlightOpen(false);
      // Best-effort backend pause for the stopped block (fire-and-forget)
      updateBlockAction("pauseBlock", {
        blockId: existingActive.BlockId,
        pausedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const nowIso = new Date().toISOString();

    // Mark this block as started SYNCHRONOUSLY before any React state update or await.
    // The reminder interval reads startedBlocksRef inside its setReminderState updater,
    // which runs during the render phase — after this synchronous code has already run.
    // This prevents "Please begin" notifications during the stale-ref window between
    // handleStartBlock being called and todayBlocksRef.current reflecting the new ACTIVE status.
    startedBlocksRef.current.add(blockId);

    if (openFocus) {
      setSpotlightOpen(true);
    }

    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: BLOCK_STATUS.ACTIVE,
            ActualStart: b.ActualStart || nowIso,
          }
          : b
      )
    );

    setReminderState((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] || {}),
        start_now: true,
        not_started_3: true,
        please_begin_5: true,
        paused_too_long: false,
      },
    }));

    setStatus("✅ Block started. Focus Mode is active.");

    try {
      const out = await updateBlockAction("startBlock", {
        blockId,
        actualStart: nowIso,
        ...options,
      });

      if (out && !out.ok) {
        if (out.code === "STALE_ACTIVE_SESSION") {
          setStaleBlockData(out.staleBlock);
          setStaleRecoveryModalOpen(true);
          return;
        }
        startedBlocksRef.current.delete(blockId);
        setStatus(`❌ startBlock failed: ${out?.message || "unknown"}`);
        return;
      }

      await loadBlocksForDate(date);
    } catch (e) {
      console.error("startBlock failed", e);
      setStatus("❌ startBlock failed");
      await loadBlocksForDate(date);
    }
  }

  async function handlePauseBlock(blockId) {
    const nowIso = new Date().toISOString();

    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? {
            ...b,
            Status: BLOCK_STATUS.PAUSED,
            LastPauseAt: nowIso,
            PauseCount: Number(b.PauseCount || 0) + 1,
          }
          : b
      )
    );

    try {
      const out = await updateBlockAction("pauseBlock", {
        blockId,
        pausedAt: nowIso,
      });

      if (!out?.ok) {
        console.error("pauseBlock failed", out);
        setStatus(`❌ pauseBlock failed: ${out?.message || "unknown"}`);
        await loadBlocksForDate(date);
        return;
      }

      await loadBlocksForDate(date);
      setStatus("⏸️ Block paused.");
    } catch (e) {
      console.error("pauseBlock error", e);
      setStatus("❌ pauseBlock failed");
      await loadBlocksForDate(date);
    }
  }

  async function handleResumeBlock(blockId) {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    setTodayBlocks((prev) =>
      prev.map((b) => {
        if (b.BlockId !== blockId) return b;
        // Accumulate the duration of the current pause into TotalPauseMinutes
        const pauseStartMs = b.LastPauseAt ? new Date(b.LastPauseAt).getTime() : nowMs;
        const addedPauseMin = Math.max(0, (nowMs - pauseStartMs) / 60000);
        return {
          ...b,
          Status: BLOCK_STATUS.ACTIVE,
          LastResumeAt: nowIso,
          TotalPauseMinutes: Number(b.TotalPauseMinutes || 0) + addedPauseMin,
        };
      })
    );

    try {
      const res = await updateBlockAction("resumeBlock", {
        blockId,
        resumedAt: nowIso,
      });

      if (!res?.ok) {
        setStatus(`❌ resumeBlock failed: ${res?.message || "unknown"}`);
        await loadBlocksForDate(date);
        return;
      }

      setReminderState((prev) => ({
        ...prev,
        [blockId]: {
          ...(prev[blockId] || {}),
          paused_too_long: false,
        },
      }));

      await loadBlocksForDate(date);
      setSpotlightOpen(true);
      setStatus("▶️ Block resumed.");
    } catch (e) {
      console.error("resumeBlock failed", e);
      setStatus("❌ resumeBlock failed");
      await loadBlocksForDate(date);
    }
  }

  function requestStopBlock(block) {
    if (!block) return;
    setPendingStopBlock(block);
    setStopConfirmOpen(true);
  }

  async function handleStopBlock(block, signalData = {}) {
    if (!block) return;

    const blockId = block.BlockId;
    console.log("[StopBlock] clicked", block, signalData);

    // 1. Close modal + clear ALL execution state immediately for responsive UI
    console.log("[StopBlock] clearing execution state");
    setStopConfirmOpen(false);
    setPendingStopBlock(null);
    setSpotlightOpen(false);
    setActiveReviewBlock(null);  // close review popup immediately (also repeated at step 5)

    // 2. Optimistic local update — mark stopped so UI reflects immediately
    // currentBlock useMemo recomputes to null/next-planned block, which triggers
    // the timer useEffect cleanup → clearInterval fires → no ghost timer
    setTodayBlocks((prev) =>
      prev.map((b) =>
        b.BlockId === blockId
          ? { ...b, Status: BLOCK_STATUS.STOPPED, ActualEnd: new Date().toISOString() }
          : b
      )
    );
    setLiveElapsedSec(0);
    console.log("[StopBlock] active states after clear", {
      spotlightOpen: false,
      activeReviewBlock: null,
      pendingStopBlock: null,
      stopConfirmOpen: false,
      liveElapsedSec: 0,
    });

    // 3. Persist STOP to backend (PostgreSQL) — STOP ≠ COMPLETE
    // STOP sets status='partial' (not 'completed'), no revision/knowledge linkage triggers
    try {
      // ⚠️ CRITICAL: Must include dayKey so backend finds correct block on correct day
      const dayKey = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);

      const payload = {
        blockId,
        dayKey,
        status: "stopped",
        endedAt: new Date().toISOString(),
        elapsedSec: liveElapsedSec
      };

      console.log("[StopBlock] payload", payload);

      const result = await updateBlockAction("stopBlock", payload);

      console.log("[StopBlock] backend response", result);
      console.log("[StopBlock] backend status", result?.status ? result.status : (result?.ok ? 200 : 400));

      if (!result?.ok) {
        setStatus(`❌ Stop failed: ${result?.message || "unknown"}`);
      } else {
        setStatus("✅ Block stopped.");
      }
    } catch (e) {
      console.error("[StopBlock] backend call failed", e);
      setStatus("❌ Stop failed — please retry.");
    }

    // 4. Refetch blocks from backend to get authoritative state
    // (This re-anchors the timer and ensures UI is in sync)
    await loadBlocksForDate(date);

    // 5. STOP cleanup: belt-and-suspenders after refetch — block is PARTIAL so
    // currentBlock useMemo returns null/next, but reset explicitly to be safe
    // ✅ NO revision trigger — STOP ≠ COMPLETE
    // ✅ NO knowledge linkage — STOP is user-initiated abort
    // ✅ NO PYQ auto-open — STOP doesn't generate new knowledge
    setLiveElapsedSec(0);
    setActiveReviewBlock(null);
  }

  async function handleSubmitReview() {
    if (!activeReviewBlock) return;

    if (!reviewForm.completionStatus) {
      setStatus("❌ Please select block completion status.");
      return;
    }

    if (!reviewForm.topicMatchStatus) {
      setStatus("❌ Please select topic match status.");
      return;
    }

    const actualEndIso = new Date().toISOString();

    try {
      const res = await updateBlockAction("completeBlock", {
        blockId: activeReviewBlock.BlockId,
        actualEnd: actualEndIso,
        actualSubject: activeReviewBlock.ActualSubject || activeReviewBlock.PlannedSubject,
        actualTopic: activeReviewBlock.ActualTopic || activeReviewBlock.PlannedTopic,
        completionStatus: reviewForm.completionStatus,
        topicMatchStatus: reviewForm.topicMatchStatus,
        outputType: reviewForm.outputType,
        outputCount: Number(reviewForm.outputCount || 0),
        focusRating: reviewForm.focusRating,
        interruptionReason: reviewForm.interruptionReason,
        reviewNotes: reviewForm.reviewNotes,
        backlogBucket: reviewForm.backlogBucket,
      });

      if (!res?.ok) {
        setStatus(`❌ completeBlock failed: ${res?.message || "unknown"}`);
        return;
      }

      await loadBlocksForDate(date);

      setActiveReviewBlock(null);
      setPendingStopBlock(null);
      setStopConfirmOpen(false);
      setSpotlightOpen(false);

      setTimeout(() => {
        setStatus("✅ Block review saved.");
      }, 0);

      // Phase 8: Knowledge Linkage — fetch PYQ recommendation (non-blocking)
      if (res?.block?.id) {
        fetchWithAuth(`/api/knowledge/block/${res.block.id}`, { cache: "no-store" })
          .then(r => r.json())
          .then(data => {
            if (data?.ok && data?.recommendation?.hasRecommendation) {
              setPyqRecommendation(data.recommendation);
              // Auto-dismiss after 15 seconds
              setTimeout(() => setPyqRecommendation(null), 15000);
            }
          })
          .catch(() => {}); // Non-blocking: ignore errors
      }
    } catch (e) {
      console.error("completeBlock failed", e);
      setStatus("❌ completeBlock failed");
    }
  }

  async function onSetup() {
    setBusy(true);
    setStatus("Setting up sheets (Phase 2 tabs included)...");

    try {
      const out = await post("setup");
      if (!out?.ok) {
        setStatus("❌ Setup failed: " + (out?.message || "unknown"));
        return;
      }

      setStatus(
        "✅ Setup triggered. Check tabs: SETTINGS, DAILY_LOG, WEEKLY_DASHBOARD, SCHEDULE_BLOCKS, DAILY_REVIEW."
      );
    } catch (e) {
      setStatus("❌ Setup failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDaily() {
    setBusy(true);
    setStatus("Saving daily log...");
    setMappingResult(null);

    try {
      const basePayload = {
        date,
        planMin: Number(planMin) || 0,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
      };

      let mappingFields = {
        mappingCode: "",
        mappingPath: "",
        matchesCodes: "",
        matchesPaths: "",
        matchesNames: "",
      };

      if (basePayload.reflection) {
        try {
          const mapOut = await mapTextToSyllabus(basePayload.reflection);
          setMappingResult(mapOut);
          mappingFields = buildMappingFields(mapOut);
        } catch (e) {
          console.warn("mapTextToSyllabus failed:", e);
        }
      }

      const out = await post("logDaily", { ...basePayload, ...mappingFields });
      if (!out?.ok) {
        setStatus("❌ Save failed: " + (out?.message || "unknown"));
        return;
      }

      setStatus("✅ Saved to Sheets (DAILY_LOG) with mapping + top matches.");
    } catch (e) {
      setStatus("❌ Save failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyzeOnly() {
    setBusy(true);
    setStatus("Generating Daily Push Targets...");
    setAnalysis(null);

    try {
      const payload = {
        date,
        planMin: Number(planMin) || 0,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
      };

      const out = await analyzeDay(payload);
      if (!out?.ok) {
        setStatus("❌ Analyze-Day failed: " + (out?.message || "unknown"));
      } else {
        setAnalysis(out);
        setStatus("✅ Daily Push Targets generated.");
      }
    } catch (e) {
      setStatus("❌ Analyze-Day error: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onWeeklyRollup() {
    setBusy(true);
    setStatus("Generating weekly dashboard row...");

    try {
      const out = await post("weeklyRollup");
      if (!out?.ok) {
        setStatus("❌ Weekly rollup failed: " + (out?.message || "unknown"));
        return;
      }

      setWeekly({ message: "✅ Weekly rollup triggered. Check WEEKLY_DASHBOARD sheet." });
      setStatus("✅ Weekly dashboard updated. Check Google Sheet → WEEKLY_DASHBOARD.");
    } catch (e) {
      setStatus("❌ Weekly rollup failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveOcrBlocks() {
    const approvedBlocks = buildApprovedOcrBlocks(date, ocrDraftBlocks);

    if (!approvedBlocks.length) {
      setStatus("❌ No OCR blocks to approve.");
      return;
    }

    const blocksPayload = buildScheduleBlocksPayload(approvedBlocks);
    // Stage 3: Debug log for first payload item
    if (blocksPayload.length > 0) {
      console.log("[STAGE 3] Payload sent to saveScheduleBlocks (first item):", {
        blockId: blocksPayload[0].blockId,
        subject: blocksPayload[0].subject,
        topic: blocksPayload[0].topic,
        mode: blocksPayload[0].mode,
        rawText: blocksPayload[0].rawText,
        syllabusNodeId: blocksPayload[0].syllabusNodeId,
        outputExpected: blocksPayload[0].outputExpected,
        subtopic: blocksPayload[0].subtopic,
      });
    }
    const reminderBlocksToRegister = approvedBlocks.map((block, index) => {
      const existing = ocrPreviewReminderBlocks[index] || {};
      return {
        ...existing,
        blockId: block.BlockId,
        BlockId: block.BlockId,
        subject: block.PlannedSubject,
        plannedSubject: block.PlannedSubject,
        topic: block.PlannedTopic,
        plannedTopic: block.PlannedTopic,
        start: block.PlannedStart,
        plannedStart: block.PlannedStart,
        end: block.PlannedEnd,
        plannedEnd: block.PlannedEnd,
        minutes: Number(block.PlannedMinutes || 0),
        plannedMinutes: Number(block.PlannedMinutes || 0),
      };
    });

    setBusy(true);
    setStatus("Saving approved schedule blocks...");

    try {
      const saveBlocksOut = await post("saveScheduleBlocks", {
        date,
        items: blocksPayload,
      });

      if (!saveBlocksOut?.ok) {
        setStatus("❌ saveScheduleBlocks failed. Nothing else was synced.");
        return;
      }

      setStatus("Syncing approved calendar events...");

      const selectedDate = date;
      console.log("[Plan Sync] selectedDate used:", selectedDate);

      try {
        const calOut = await post("syncCalendarFromBlocks", { date: selectedDate });
        const calFailed =
          calOut?.success === false ||
          calOut?.ok === false ||
          Number(calOut?.errors || 0) > 0;

        const calSynced = Number(calOut?.synced || 0);
        const calSkipped = Number(calOut?.skipped || 0);
        const calTotal = calSynced + calSkipped;
        const calSkippedRatio = calTotal > 0 ? calSkipped / calTotal : 0;

        if (calFailed) {
          console.error("syncCalendarFromBlocks failed:", calOut);
        } else if (calTotal >= 20 && calSkippedRatio > 0.9) {
          console.warn("High skip ratio in calendar sync:", calOut);
        } else {
          console.log("syncCalendarFromBlocks success:", calOut);
        }
      } catch (err) {
        console.error("syncCalendarFromBlocks failed:", err);
      }

      setStatus("Syncing fixed reminders...");
      try {
        const fixedOut = await post("syncFixedReminders", { date: selectedDate });
        const fixedFailed =
          fixedOut?.success === false ||
          fixedOut?.ok === false ||
          Number(fixedOut?.errors || 0) > 0;

        const fixedSynced = Number(fixedOut?.synced || 0);
        const fixedSkipped = Number(fixedOut?.skipped || 0);
        const fixedTotal = fixedSynced + fixedSkipped;
        const fixedSkippedRatio = fixedTotal > 0 ? fixedSkipped / fixedTotal : 0;

        if (fixedFailed) {
          console.error("syncFixedReminders failed:", fixedOut);
        } else if (fixedTotal >= 20 && fixedSkippedRatio > 0.9) {
          console.warn("High skip ratio in reminders sync:", fixedOut);
        } else {
          console.log("syncFixedReminders success:", fixedOut);
        }
      } catch (err) {
        console.error("syncFixedReminders failed:", err);
      }

      if (reminderBlocksToRegister.length > 0) {
        setStatus("Registering approved reminder blocks...");
        const regRes = await fetchWithAuth(`/api/schedule/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayKey: date,
            userId: "moulika",
            blocks: reminderBlocksToRegister,
          }),
          cache: "no-store",
        });

        const regText = await regRes.text();
        let regOut;
        try {
          regOut = JSON.parse(regText);
        } catch {
          regOut = { ok: false, raw: regText };
        }

        if (!regOut?.ok) {
          console.warn("schedule/register failed:", regOut);
        }
      }

      setOcrApprovalOpen(false);
      setOcrDraftBlocks([]);
      setOcrPreviewReminderBlocks([]);
      setParsedPlan(null);
      setReminderState({});

      await loadBlocksForDate(date);

      setStatus("✅ Approved plan saved, calendar synced, and reminders registered.");
    } catch (e) {
      setStatus("❌ OCR approval save failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onParsePhoto() {
    if (!planPhoto) {
      setStatus("❌ Please choose a plan photo first.");
      return;
    }

    setBusy(true);
    setStatus("Reading plan photo… (time blocks)");

    try {
      const out = await parsePlanPhoto(planPhoto, date);
      if (!out?.ok) {
        setStatus("❌ Could not parse: " + (out?.message || "unknown"));
        return;
      }

      setParsedPlan(out);
      setReminderState({});
      autoFillFromParsed(out);

      const parsedItems = Array.isArray(out?.items) ? out.items : [];

      const draftBlocks = buildTodayBlocksFromParsed(out).map((block, index) => {
        const src = parsedItems[index] || {};
        const enrichedBlock = {
          ...block,
          linkedPyqs: src.linkedPyqs || safePyq(),
          mapped: src.mapped || null,
          mappedNodes: src.mappedNodes || src?.linkedPyqs?.mappedNodes || [],
          finalMapping: src.finalMapping || null,
          nodeId: src.finalMapping?.nodeId || src.syllabusNodeId || "",
          nodeName: src.finalMapping?.nodeName || "",
          isApproved: src.finalMapping?.isApproved || false,
          confidenceBadge: src.finalMapping?.confidenceBadge || src.confidenceBadge || "UNKNOWN",
          // Phase 2A fields — copy directly from backend-parsed item
          mode: src.mode || block.mode || "",
          Mode: src.mode || block.Mode || "",
          rawText: src.rawText || block.rawText || "",
          RawText: src.rawText || block.RawText || "",
          outputExpected: src.outputExpected || block.outputExpected || "",
          OutputExpected: src.outputExpected || block.OutputExpected || "",
          subtopic: src.subtopic || block.subtopic || "",
          Subtopic: src.subtopic || block.Subtopic || "",
          syllabusNodeId: src.syllabusNodeId || src.finalMapping?.nodeId || block.syllabusNodeId || "",
          SyllabusNodeId: src.syllabusNodeId || src.finalMapping?.nodeId || block.SyllabusNodeId || "",
        };
        // Stage 2: Debug log for first approved block
        if (index === 0) {
          console.log("[STAGE 2] Draft block (first):", {
            BlockId: enrichedBlock.BlockId,
            subject: enrichedBlock.PlannedSubject,
            topic: enrichedBlock.PlannedTopic,
            mode: enrichedBlock.mode,
            rawText: enrichedBlock.rawText,
            syllabusNodeId: enrichedBlock.syllabusNodeId,
            outputExpected: enrichedBlock.outputExpected,
            subtopic: enrichedBlock.subtopic,
          });
        }
        return enrichedBlock;
      });

      setOcrDraftBlocks(draftBlocks);

      const previewBlocks = Array.isArray(out?.reminderEngine?.previewBlocks)
        ? out.reminderEngine.previewBlocks
        : [];
      setOcrPreviewReminderBlocks(previewBlocks);

      setOcrApprovalOpen(true);

      setStatus(
        out?.approvalRequired
          ? "OCR parsed. Please review and approve before saving."
          : "OCR parsed successfully."
      );
    } catch (e) {
      setStatus("❌ Photo parse failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNightReview() {
    setBusy(true);
    setStatus("Saving night review...");

    try {
      const plannedMin = Number(planMin) || plannedMinFromParsed(parsedPlan);

      const baseReviewPayload = {
        date,
        plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        planCompleted: review.planCompleted,
        wentWell: review.wentWell,
        wentWrongReason: review.wentWrongReason,
        wentWrongText: review.wentWrongText,
        extraDone: review.extraDone,
        extraText: review.extraText,
        extraMinutes: Number(review.extraMinutes) || 0,
        loopFlags: "",
        tomorrowCorrection: "",
      };

      const saveOut = await post("saveDailyReview", baseReviewPayload);
      if (!saveOut?.ok) {
        setStatus("❌ saveDailyReview failed. Check DEBUG_LOG.");
        console.log("saveDailyReview out:", saveOut);
        return;
      }

      setStatus("Running Loop Detector...");
      const loopOut = await loopDetect({
        date,
        planMin: plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: String(reflection || "").trim(),
        review,
      });

      setLoops(loopOut?.ok ? loopOut : null);

      if (loopOut?.ok) {
        await post("saveDailyReview", {
          ...baseReviewPayload,
          loopFlags: String(loopOut.loopFlagsText || ""),
          tomorrowCorrection: String(loopOut.tomorrowCorrection || ""),
        });
      }

      const reflectionCombined =
        `Reflection: ${String(reflection || "").trim()}\n` +
        `Went well: ${review.wentWell}\n` +
        `Went wrong: ${review.wentWrongReason}${review.wentWrongText ? " — " + review.wentWrongText : ""
        }\n` +
        `Extra beyond plan: ${review.extraDone}${review.extraDone === "Yes"
          ? ` — ${review.extraText} (${Number(review.extraMinutes) || 0} min)`
          : ""
        }\n` +
        `LoopFlags: ${String(loopOut?.loopFlagsText || "").trim()}`;

      setStatus("Running Analyze-Day (night data)...");
      const analyzeOut = await analyzeDay({
        date,
        planMin: plannedMin,
        doneMin: Number(doneMin) || 0,
        csatMin: Number(csatMin) || 0,
        reflection: reflectionCombined,
      });

      if (analyzeOut?.ok) {
        setAnalysis(analyzeOut);
        setStatus("✅ Night review saved + Loops detected + Analyze-Day generated.");
      } else {
        setStatus(
          "⚠️ Night review saved + loops done, but Analyze-Day failed: " +
          (analyzeOut?.message || "unknown")
        );
      }
    } catch (e) {
      setStatus("❌ Night review failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  const advice = analysis?.advice || null;
  const activeFlags = Array.isArray(loops?.flags) ? loops.flags : [];
  const todayTriggered = Array.isArray(loops?.todayTriggered) ? loops.todayTriggered : [];

  function scrollToSection(ref) {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateOcrDraftBlock(index, patch) {
    setOcrDraftBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block))
    );
  }

  const handleRemapNode = async (blockIndex, newNodeId) => {
    if (!newNodeId) return;
    updateOcrDraftBlock(blockIndex, { nodeId: newNodeId, nodeName: newNodeId, SyllabusNodeId: newNodeId, isApproved: true });
    try {
      const res = await fetchWithAuth(`/api/pyq/node/${encodeURIComponent(newNodeId)}`);
      if (res.ok) {
        const data = await res.json();
        const qs = Array.isArray(data?.questions) ? data.questions : (Array.isArray(data) ? data : []);
        const pyqResult = {
          syllabusNodeId: newNodeId,
          total: qs.length,
          prelimsCount: qs.filter(q => q.stage === "prelims").length,
          mainsCount: qs.filter(q => q.stage === "mains").length,
          csatCount: qs.filter(q => q.stage === "csat").length,
          questions: qs
        };
        updateOcrDraftBlock(blockIndex, { linkedPyqs: pyqResult });
      }
    } catch (e) {
      console.error(e);
    }
  };
  function removeOcrDraftBlock(index) {
    setOcrDraftBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  const showAdvancedControls = false;

  return (
    <div className="mos-app-container-v2" data-page="plan">
      <div className="mentoros-content-inner">
        <div className="mos-plan-wrapper">
      <HeroSection
        dPre={dPre}
        dMains={dMains}
        streakToday={streakToday}
        completionToday={completionToday}
        dailyMotivation={dailyMotivation}
        alertPermission={alertPermission}
        todayBlocks={todayBlocks}
        currentBlock={currentBlock}
        onStartBlock={() => currentBlock && handleStartBlock(currentBlock.BlockId)}
        onPauseBlock={() => currentBlock && handlePauseBlock(currentBlock.BlockId)}
        onResumeBlock={() => currentBlock && handleResumeBlock(currentBlock.BlockId)}
        nextBlock={nextBlock}
        onStartNextBlock={(nextBlock) => nextBlock && handleStartBlock(nextBlock.BlockId)}
        onOpenFocus={() => setSpotlightOpen(true)}
      />

      <div className="main-work-grid">
        <SpotlightCard
          currentBlock={currentBlock}
          currentBlockPyq={currentBlockPyq}
          currentBlockPyqNodeId={currentBlockPyqNodeId}
          currentBlockPyqLoading={currentBlockPyqLoading}
          currentBlockPyqError={currentBlockPyqError}
          spotlightMessage={spotlightMessage}
          liveElapsedSec={liveElapsedSec}
          busy={busy}
          onStart={handleStartBlock}
          onPause={handlePauseBlock}
          onResume={handleResumeBlock}
          onStop={requestStopBlock}
          onOpenFocus={() => setSpotlightOpen(true)}
          todayBlocks={todayBlocks}
          nowTick={nowTick}
          formatCountdown={formatCountdown}
        />
          <div className="mos-sequence-card" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 16, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Today's Sequence</h2>
              <button onClick={() => setAddBlockOpen(true)} style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Manage Today</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {todayBlocks.length === 0 && <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>No blocks scheduled.</div>}
              {todayBlocks.map((block, idx) => {
                const status = getEffectiveBlockStatus(block).toLowerCase();
                const isActive = status === "active";
                const isDone = status === "completed" || status === "done";

                let timelineLabel = "LATER";
                if (isActive || status === "paused") timelineLabel = "NOW";
                else if (isDone) timelineLabel = "DONE";
                else if (status === "missed") timelineLabel = "MISSED";
                else if (
                  nextBlock &&
                  block.BlockId === nextBlock.BlockId
                ) {
                  timelineLabel = "NEXT";
                } else {
                  const normalizedTimelineStatus =
                    normalizeCanonicalBlockStatus(block);

                  if (
                    normalizedTimelineStatus === "planned" ||
                    normalizedTimelineStatus === "upcoming"
                  ) {
                    timelineLabel = "READY";
                  }
                }

                return (
                  <div key={idx} style={{
                    display: "flex",
                    gap: 16,
                    background: isActive ? "var(--brand-primary-soft)" : "transparent",
                    border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    borderRadius: 12,
                    padding: isActive ? "16px" : "8px 16px",
                    opacity: isDone ? 0.75 : 1
                  }}>
                    <div style={{ width: 48, flexShrink: 0, fontSize: 12, fontWeight: 700, color: isActive ? "var(--brand-primary)" : "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span>{timelineLabel}</span>
                      <div style={{ width: 2, flex: 1, background: isActive ? "var(--brand-primary)" : "var(--border-default)", borderRadius: 2 }} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                          {block.PlannedSubject || "Study Block"}
                        </div>
                        {isActive && (
                          <div style={{ padding: "4px 10px", background: "var(--brand-primary)", color: "#FFFFFF", fontSize: 11, fontWeight: 700, borderRadius: 12, letterSpacing: "0.05em" }}>
                            ACTIVE
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: isActive ? 12 : 0 }}>
                        <div className="sequence-time" style={{ fontFamily: 'var(--mono,monospace)', marginBottom: 2 }}>
                          {getBlockTimeRange(block)}
                        </div>
                        <div>{block.PlannedTopic && block.PlannedTopic !== "N/A" ? `${block.PlannedTopic} • ` : ""}{block.PlannedMinutes} min</div>
                      </div>

                      {isActive && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border-default)", overflow: "hidden" }}>
                            <div style={{ width: "40%", height: "100%", background: "var(--brand-primary)" }} />
                          </div>
                          <div style={{ color: "var(--brand-primary)", cursor: "pointer", fontWeight: 600 }}>›</div>
                        </div>
                      )}

                      {block.RequiresRecovery && (
                        <button
                          onClick={() => {
                            setStaleBlockData(block);
                            setStaleRecoveryModalOpen(true);
                          }}
                          style={{ marginTop: 8, background: "var(--brand-primary)", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                        >
                          Resolve session
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      </div>

      <div className="mos-upload-card" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 16, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Upload Plan Photo</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Auto-extract subjects, topics, and schedule via OCR.</div>
        </div>
        <div className="mos-upload-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPlanPhoto(e.target.files?.[0] || null)}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, height: 44, padding: "8px 12px", fontSize: 14, color: "var(--text-primary)" }}
          />
          <button
            disabled={busy}
            onClick={onParsePhoto}
            style={{ background: "var(--bg-surface)", color: "var(--brand-primary)", border: "1px solid var(--border-default)", borderRadius: 10, height: 44, padding: "0 20px", fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
            onMouseOver={e => e.currentTarget.style.background = "var(--brand-primary-soft)"}
            onMouseOut={e => e.currentTarget.style.background = "var(--bg-surface)"}
          >
            Parse Plan Photo
          </button>
        </div>
      </div>

      {staleRecoveryModalOpen && (
        <StaleRecoveryModal
          isOpen={staleRecoveryModalOpen}
          staleBlock={staleBlockData}
          onClose={() => {
            setStaleRecoveryModalOpen(false);
            setStaleBlockData(null);
          }}
          onRecovered={() => {
            setStaleRecoveryModalOpen(false);
            setStaleBlockData(null);
            loadBlocksForDate(date);
          }}
        />
      )}

      {showAdvancedControls && (
      <details className="adv-controls">
        <summary className="adv-controls-summary">
          <span>Advanced Controls</span>
          <span className="adv-controls-chevron">›</span>
        </summary>
        <div className="adv-controls-body">

        <div className="mos-daily-actions">
          <div className="mos-card-label mos-card-label--saf">EXECUTION • DAILY ACTIONS</div>
          <div className="mos-actions-row">
            <button className="btn" disabled={busy} onClick={onSetup}>Setup Sheets</button>
            <button className="btn btn-primary" disabled={busy} onClick={onSaveDaily}>Save Daily Log</button>
            <button className="btn" disabled={busy} onClick={onAnalyzeOnly}>Analyze Day Only</button>
            <button className="btn" disabled={busy} onClick={onWeeklyRollup}>Weekly Rollup</button>
            <button className="btn" disabled={busy} onClick={async () => {
              const perm = await ensureNotificationPermission();
              setAlertPermission(perm);
              setStatus(`Notification permission: ${perm}`);
            }}>Enable Alerts</button>
          </div>
        </div>

      <div className="mos-plan-grid">
        <section className="mos-plan-left">
          <div className="plan-card">
            <h2 className="mos-card-title">Daily Log</h2>

            <div className="mos-split-grid">
              <label className="field-label">
                Date
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
              </label>

              <div className="mos-mini-stat">
                <div className="mos-mini-stat-label">Today Completion</div>
                <div className="mos-mini-stat-value">{completionToday}%</div>
                <div className="mos-mini-stat-note">{dailyMotivation}</div>
              </div>

              <label className="field-label">
                Plan Minutes
                <input type="number" value={planMin} onChange={(e) => setPlanMin(e.target.value)} />
              </label>

              <label className="field-label">
                Done Minutes
                <input type="number" value={doneMin} onChange={(e) => setDoneMin(e.target.value)} />
              </label>

              <label className="field-label">
                CSAT Minutes
                <input type="number" value={csatMin} onChange={(e) => setCsatMin(e.target.value)} />
              </label>
            </div>

            <label className="field-label" style={{ marginTop: 16 }}>
              Reflection (THIS is your study text)
              <textarea
                rows={4}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What you studied today..."
              />
            </label>

            {mappingResult?.mapping && (
              <div className="mos-mini-stat" style={{ marginTop: 16 }}>
                <div className="mos-mini-stat-label">Syllabus Mapping</div>
                <div className="mos-mini-stat-note">
                  <b>Top Code:</b> {mappingResult.mapping.code || "—"}
                </div>
                <div className="mos-mini-stat-note">
                  <b>Path:</b> {mappingResult.mapping.path || "—"}
                </div>
              </div>
            )}

            {advice && (
              <div className="mos-mini-stat" style={{ marginTop: 16 }}>
                <div className="mos-mini-stat-label" style={{ marginBottom: 8 }}>
                  Daily Push Targets
                </div>
                <div className="mos-mini-stat-note" style={{ marginBottom: 8 }}>
                  <b>Coach Note:</b> {advice.coachNote || ""}
                </div>
                <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                  {(advice.pushes || []).map((p, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>


        </section>

        <PlanRightRail
          syllabusRadar={syllabusRadar}
          weekly={weekly}
          nightReviewRef={nightReviewRef}
          loopDetectorRef={loopDetectorRef}
          review={review}
          setReview={setReview}
          busy={busy}
          onSaveNightReview={onSaveNightReview}
          loops={loops}
          activeFlags={activeFlags}
          todayTriggered={todayTriggered}
          BACKEND_URL={BACKEND_URL}
          healthData={healthData}
        />
      </div>{/* /mos-plan-grid */}
        </div>{/* /adv-controls-body */}
      </details>
      )}

      <AddBlockModal
        open={addBlockOpen}
        busy={busy}
        onClose={() => setAddBlockOpen(false)}
        onAdd={({ text, startTime, endTime, resolved }) => {
          const now = new Date();
          const defaultStart = startTime || now.toTimeString().slice(0, 5);
          const defaultEnd = endTime || (() => {
            const d = new Date(now.getTime() + 60 * 60000);
            return d.toTimeString().slice(0, 5);
          })();
          const startMin = hhmmToMinutes(defaultStart) ?? 0;
          const endMin = hhmmToMinutes(defaultEnd) ?? (startMin + 60);
          const totalMinutes = Math.max(0, endMin - startMin);

          function makeBlock(subject, topic, pStart, pEnd, pMin, extra = {}) {
            return {
              BlockId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              PlannedSubject: subject || text,
              PlannedTopic: topic || text,
              PlannedStart: pStart,
              PlannedEnd: pEnd,
              PlannedMinutes: pMin,
              ActualStart: "", ActualEnd: "", ActualMinutes: 0,
              PauseCount: 0, TotalPauseMinutes: 0,
              LastPauseAt: "", LastResumeAt: "",
              Status: BLOCK_STATUS.PLANNED,
              finalMapping: {
                subjectId: "", subjectName: subject || text,
                nodeId: "", nodeName: topic || text,
                mappingSource: "MANUAL_RESOLVER", resolverConfidence: 0, isApproved: false,
              },
              mappedNodes: [],
              _isManual: true,
              ...extra,
            };
          }

          // ── Split-block path: resolver detected 2+ subjects ───────────────
          const subBlocks = Array.isArray(resolved?.subBlocks) && resolved.subBlocks.length >= 2
            ? resolved.subBlocks
            : null;

          if (subBlocks) {
            const perMin = Math.floor(totalMinutes / subBlocks.length);
            const newBlocks = subBlocks.map((sub, i) => {
              const subStartMin = startMin + i * perMin;
              const subEndMin = i === subBlocks.length - 1 ? endMin : startMin + (i + 1) * perMin;
              const subjectLabel = sub.splitSubjectLabel || sub.resolution?.subjectLabel || text;
              const activityLabel = sub.resolution?.activityType || sub.resolution?.meta?.activityType || text;
              const subNodeId = sub.resolution?.nodeId || "";
              const subStage = sub.resolution?.stageLock || sub.detections?.stage?.stage || "";
              const subPaper = sub.resolution?.gsPaper || "";
              return makeBlock(
                subjectLabel, activityLabel,
                minutesToHHMM(subStartMin), minutesToHHMM(subEndMin),
                subEndMin - subStartMin,
                {
                  _isSplit: true, _splitIndex: i,
                  finalMapping: {
                    subjectId: "", subjectName: subjectLabel,
                    nodeId: subNodeId, nodeName: activityLabel,
                    stageLock: subStage, gsPaper: subPaper,
                    mappingSource: "SPLIT_RESOLVER",
                    resolverConfidence: sub.overallConfidence || 0,
                    isApproved: false,
                  },
                }
              );
            });
            setTodayBlocks((prev) => [...prev, ...newBlocks]);
            setAddBlockOpen(false);
            setStatus(`✅ Split into ${newBlocks.length} blocks: ${subBlocks.map(s => s.splitSubjectLabel).join(" + ")}`);
            return;
          }

          // ── Single-block path ─────────────────────────────────────────────
          const resolverData = resolved?.ok !== false ? {
            subjectLabel: resolved?.resolution?.subjectLabel || resolved?.subject || "",
            activityType: resolved?.resolution?.activityType || resolved?.activityType || text,
            stage: resolved?.resolution?.stageLock || resolved?.stage || "",
            confidence: resolved?.overallConfidence ?? null,
            tags: resolved?.resolution?.tags || [],
          } : null;

          const manualBlock = makeBlock(
            resolverData?.subjectLabel, resolverData?.activityType,
            defaultStart, defaultEnd, totalMinutes,
            { _resolverData: resolverData }
          );
          manualBlock.finalMapping.resolverConfidence = resolverData?.confidence || 0;

          setTodayBlocks((prev) => [...prev, manualBlock]);
          setAddBlockOpen(false);
          setStatus(`✅ Block "${text}" added manually.`);
        }}
      />

      </div>{/* /mos-plan-wrapper */}

      <BlockReviewModal
        open={!!activeReviewBlock}
        block={activeReviewBlock}
        reviewForm={reviewForm}
        setReviewForm={setReviewForm}
        onSubmit={handleSubmitReview}
        onCancel={async () => {
          setActiveReviewBlock(null);
          setPendingStopBlock(null);
          setStopConfirmOpen(false);
          await loadBlocksForDate(date);
        }}
      />

      <BehaviourSignalModal
        open={stopConfirmOpen && !!(pendingStopBlock || currentBlock)}
        block={pendingStopBlock || currentBlock}
        BACKEND_URL={BACKEND_URL}
        onSignalSaved={(signalData) => {
          const stopTarget = pendingStopBlock || currentBlock;
          if (stopTarget) {
            handleStopBlock(stopTarget, signalData);
          }
        }}
        onClose={() => {
          setStopConfirmOpen(false);
          setPendingStopBlock(null);
        }}
      />

      {switchBlockConfirmOpen && pendingStartRequest && (
        <div className="focus-overlay" onClick={() => { setSwitchBlockConfirmOpen(false); setPendingStartRequest(null); }}>
          <div className="focus-modal" onClick={(e) => e.stopPropagation()}>
            <div className="focus-kicker">Block Already Running</div>
            <h2 className="focus-title">Switch active block?</h2>
            <div className="focus-subtitle">
              A block is already running. Stop it and start the new one?
            </div>
            <div className="focus-note">
              Current block will be marked for review later. No review popup will appear now.
            </div>
            <div className="focus-actions">
              <button className="focus-btn-primary" onClick={handleSwitchBlockConfirm}>Yes, Switch Block</button>
              <button
                className="focus-btn-secondary"
                onClick={() => { setSwitchBlockConfirmOpen(false); setPendingStartRequest(null); }}
              >
                Keep Current Block
              </button>
            </div>
          </div>
        </div>
      )}

      <FocusModeModal
        open={spotlightOpen}
        block={currentBlock}
        liveElapsedSec={liveElapsedSec}
        busy={busy}
        onStart={() => currentBlock && handleStartBlock(currentBlock.BlockId, { openFocus: true })}
        onPause={() => currentBlock && handlePauseBlock(currentBlock.BlockId)}
        onResume={() => currentBlock && handleResumeBlock(currentBlock.BlockId)}
        onStop={() => currentBlock && requestStopBlock(currentBlock)}
        onClose={() => setSpotlightOpen(false)}
      />

      {ocrApprovalOpen && (
        <div className="mos-focus-overlay">
          <div
            className="focus-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(980px, 96vw)", maxHeight: "88vh", overflow: "auto" }}
          >
            <div className="mos-focus-kicker">OCR Review</div>
            <h2 className="mos-focus-title">Approve Parsed Plan</h2>
            <div className="mos-focus-subtitle">
              Review subject, topic, time, minutes, mapping, and PYQ intelligence before saving.
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {ocrDraftBlocks.map((block, index) => {
                const mappedNodes = safeMappedNodes(block);

                let cardBorderColor = "transparent";
                if (block.confidenceBadge === "LOW") cardBorderColor = "#ef4444";
                else if (block.confidenceBadge === "MEDIUM") cardBorderColor = "#eab308";
                else if (block.confidenceBadge === "HIGH" || block.isApproved) cardBorderColor = "#22c55e";

                const displayCandidates = [...(block.topicCandidates || []), ...(block.subjectCandidates || [])]
                  .filter((c, i, self) => self.findIndex(x => x.nodeId === c.nodeId) === i);

                return (
                  <div
                    key={block.BlockId || `${block.PlannedStart}-${index}`}
                    className={`mos-ocr-block-card ${getDisplayStatus(block.Status) === BLOCK_STATUS.ACTIVE
                      ? "mos-ocr-block-card--active"
                      : ""
                      }`}
                    style={{ border: `1px solid ${cardBorderColor}` }}
                  >
                    <div className="mos-split-grid">
                      <label className="field-label">
                        Subject
                        <input
                          value={block.PlannedSubject || ""}
                          onChange={(e) =>
                            updateOcrDraftBlock(index, { PlannedSubject: e.target.value })
                          }
                        />
                      </label>

                      <label className="field-label">
                        Topic
                        <input
                          value={block.PlannedTopic || ""}
                          onChange={(e) =>
                            updateOcrDraftBlock(index, { PlannedTopic: e.target.value })
                          }
                        />
                      </label>

                      <label className="field-label">
                        Start
                        <input
                          value={block.PlannedStart || ""}
                          onChange={(e) =>
                            updateOcrDraftBlock(index, { PlannedStart: e.target.value })
                          }
                        />
                      </label>

                      <label className="field-label">
                        End
                        <input
                          value={block.PlannedEnd || ""}
                          onChange={(e) =>
                            updateOcrDraftBlock(index, { PlannedEnd: e.target.value })
                          }
                        />
                      </label>

                      <label className="field-label">
                        Minutes
                        <input
                          type="number"
                          value={block.PlannedMinutes || 0}
                          onChange={(e) =>
                            updateOcrDraftBlock(index, {
                              PlannedMinutes: Number(e.target.value || 0),
                            })
                          }
                        />
                      </label>
                    </div>

                    {renderPyqPanel(block)}


                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn mos-btn-close" onClick={() => removeOcrDraftBlock(index)}>
                        Remove Block
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mos-focus-actions" style={{ marginTop: 24 }}>
              <button
                disabled={busy}
                onClick={handleApproveOcrBlocks}
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Processing..." : "Approve and Continue"}
              </button>

              <button
                disabled={busy}
                className="btn mos-btn-close"
                onClick={() => {
                  setOcrApprovalOpen(false);
                  setOcrDraftBlocks([]);
                  setOcrPreviewReminderBlocks([]);
                  setParsedPlan(null);
                  setReminderState({});
                  setStatus("OCR review closed. Nothing was saved or synced.");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
