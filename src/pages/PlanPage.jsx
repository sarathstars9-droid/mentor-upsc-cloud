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
import { fetchWithAuth, getAuthUserId, isLoggedIn } from "../utils/auth";
import HeroSection from "../components/Plan/HeroSection.jsx";
import MentorHeader from "../components/Plan/MentorHeader.jsx";
import ExamCountdowns from "../components/Plan/ExamCountdowns.jsx";
import NextBestAction from "../components/Plan/NextBestAction.jsx";
import StudyFlowTimeline from "../components/Plan/StudyFlowTimeline.jsx";
import MentorCommandStrip from "../components/Plan/MentorCommandStrip.jsx";
import LiveStudyWorkspace from "../components/Plan/LiveStudyWorkspace.jsx";
import ExamMilestonesRail from "../components/Plan/ExamMilestonesRail.jsx";
import TodayExecutionRail from "../components/Plan/TodayExecutionRail.jsx";
import QuickActionsRail from "../components/Plan/QuickActionsRail.jsx";
import StudyFlowTable from "../components/Plan/StudyFlowTable.jsx";
import { getTimeAwareGreeting } from "../utils/greetingUtils.js";
import SpotlightCard from "../components/Plan/SpotlightCard.jsx";
import PlanRightRail from "../components/Plan/PlanRightRail.jsx";
import TimePicker12Hour from "../components/Plan/TimePicker12Hour.jsx";
import ManageTodayModal from "../components/Plan/ManageTodayModal.jsx";
import AddStudyBlockModal from "../components/Plan/AddStudyBlockModal.jsx";
import QuickStartModal from "../components/Plan/QuickStartModal.jsx";
import CompletionSheetModal from "../components/Plan/CompletionSheetModal.jsx";
import ActiveCommentModal from "../components/Plan/ActiveCommentModal.jsx";
import ActiveConflictModal from "../components/Plan/ActiveConflictModal.jsx";
import CarryForwardModal from "../components/Plan/CarryForwardModal.jsx";
import EditPlannedBlockModal from "../components/Plan/EditPlannedBlockModal.jsx";
import StudyBlockCard from "../components/Plan/StudyBlockCard.jsx";
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

function formatDashboardDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    return `${dayName}, ${formatted}`;
  } catch {
    return dateStr;
  }
}

function formatMetricDuration(totalMinutes) {
  const m = Math.max(0, Number(totalMinutes) || 0);
  if (m === 0) return "0m";
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${rem}m`;
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
function AddBlockModal({ open, busy, onClose, onSave, editingBlock = null, existingBlocks = [] }) {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  useEffect(() => {
    if (open) {
      if (editingBlock) {
        setText(editingBlock.PlannedTopic || editingBlock.topic || editingBlock.PlannedSubject || "");
        setSubject(editingBlock.PlannedSubject || editingBlock.subject || "");
        setStartTime(editingBlock.PlannedStart || editingBlock.start || "09:00");
        setEndTime(editingBlock.PlannedEnd || editingBlock.end || "10:00");
      } else {
        const now = new Date();
        const start = now.toTimeString().slice(0, 5);
        const endD = new Date(now.getTime() + 60 * 60000);
        const end = endD.toTimeString().slice(0, 5);
        setText("");
        setSubject("");
        setStartTime(start);
        setEndTime(end);
      }
      setResolveError("");
    }
  }, [open, editingBlock]);

  if (!open) return null;

  const startMin = hhmmToMinutes(startTime);
  const endMin = hhmmToMinutes(endTime);
  const durationMin = (startMin !== null && endMin !== null && endMin > startMin) ? endMin - startMin : 0;

  let validationError = "";
  if (startMin === null || endMin === null) {
    validationError = "Please select valid start and end times.";
  } else if (endMin <= startMin) {
    validationError = "End time must be after start time.";
  } else {
    const targetBlockId = editingBlock?.BlockId || editingBlock?.blockId;
    const hasOverlap = (existingBlocks || []).some((b) => {
      const bId = b.BlockId || b.blockId;
      if (targetBlockId && bId === targetBlockId) return false; // exclude self!
      const bStart = hhmmToMinutes(b.PlannedStart || b.start);
      const bEnd = hhmmToMinutes(b.PlannedEnd || b.end);
      if (bStart === null || bEnd === null) return false;
      return (startMin < bEnd && endMin > bStart);
    });

    if (hasOverlap) {
      validationError = "Selected time range overlaps with another scheduled block.";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || validationError) return;
    setResolving(true);
    setResolveError("");
    try {
      let resolved = null;
      if (!editingBlock) {
        resolved = await resolveBlock(text.trim(), durationMin || undefined);
      }
      onSave({
        blockId: editingBlock?.BlockId || editingBlock?.blockId,
        text: text.trim(),
        subject: subject.trim(),
        startTime,
        endTime,
        plannedMinutes: durationMin,
        resolved,
        isEdit: !!editingBlock,
      });
      onClose();
    } catch (err) {
      setResolveError("Save failed. Will proceed with manual input.");
      onSave({
        blockId: editingBlock?.BlockId || editingBlock?.blockId,
        text: text.trim(),
        subject: subject.trim(),
        startTime,
        endTime,
        plannedMinutes: durationMin,
        resolved: null,
        isEdit: !!editingBlock,
      });
      onClose();
    } finally {
      setResolving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 96vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "24px",
          border: "1px solid #e2e8f0",
          opacity: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0A64F5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          {editingBlock ? "Edit Study Block" : "Manual Entry"}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
          {editingBlock ? "Update Study Block" : "Add Study Block"}
        </h2>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {editingBlock ? "Modify schedule details below." : "Type block details — MentorOS will classify it."}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Block Description / Topic *</span>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Polity revision, Economy PYQs, World mapping"
              style={{
                height: 42,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Subject (Optional)</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Polity, Economy, Geography"
              style={{
                height: 42,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
              }}
            />
          </label>

          {/* Explicit 12-Hour AM/PM Time Pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <TimePicker12Hour label="Start Time *" value={startTime} onChange={setStartTime} />
            <TimePicker12Hour label="End Time *" value={endTime} onChange={setEndTime} />
          </div>

          {/* Duration Indicator */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: durationMin > 0 ? "#0A64F5" : "#64748b",
              background: "#f0f6ff",
              padding: "8px 12px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Calculated Duration:</span>
            <span>{durationMin > 0 ? `${durationMin} min (${Math.floor(durationMin / 60)}h ${durationMin % 60}m)` : "0 min"}</span>
          </div>

          {/* Validation Error / Overlap Warning */}
          {validationError && (
            <div style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ⚠️ {validationError}
            </div>
          )}

          {resolveError && <div style={{ color: "#d97706", fontSize: 12 }}>{resolveError}</div>}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                background: "#ffffff",
                color: "#475569",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resolving || busy || !text.trim() || !!validationError}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "#0A64F5",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                border: "none",
                cursor: "pointer",
                opacity: resolving || busy || !text.trim() || !!validationError ? 0.6 : 1,
                boxShadow: "0 2px 4px rgba(10, 100, 245, 0.2)",
              }}
            >
              {resolving ? "Processing…" : editingBlock ? "Save Changes" : "Add Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [greeting, setGreeting] = useState(() => getTimeAwareGreeting());
  const [acknowledgedContinue, setAcknowledgedContinue] = useState(false);

  useEffect(() => {
    const update = () => setGreeting(getTimeAwareGreeting());
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

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
  const [manageTodayOpen, setManageTodayOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
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

  // Canonical Study Block Execution System Modals
  const [addBlockModalOpen, setAddBlockModalOpen] = useState(false);
  const [quickStartModalOpen, setQuickStartModalOpen] = useState(false);
  const [completionSheetBlock, setCompletionSheetBlock] = useState(null);
  const [activeCommentBlock, setActiveCommentBlock] = useState(null);
  const [activeConflictData, setActiveConflictData] = useState(null);
  const [carryForwardBlock, setCarryForwardBlock] = useState(null);
  const [editPlannedBlock, setEditPlannedBlock] = useState(null);
  const [viewUploadedPhotoOpen, setViewUploadedPhotoOpen] = useState(false);
  const planPhotoInputRef = useRef(null);

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

  const dashboardMetrics = useMemo(() => {
    let plannedMinutes = 0;
    let completedActual = 0;
    let provisionalRecovered = 0;
    let activeNetElapsed = 0;

    for (const b of todayBlocks) {
      const s = (b.Status || b.status || "").toLowerCase();
      const planned = Number(b.PlannedMinutes ?? b.planned_minutes ?? b.Minutes ?? 0);
      const actual = Number(b.ActualMinutes ?? b.actual_minutes ?? 0);
      const isProvisional = Boolean(b.isProvisional || b.is_provisional || b.Reason === "stale_session_recovered" || b.completion_reason === "stale_session_recovered");

      plannedMinutes += planned;

      if (s === "completed" || s === "done") {
        if (isProvisional) {
          provisionalRecovered += actual;
        } else {
          completedActual += actual;
        }
      } else if (s === "active" || s === "studying") {
        activeNetElapsed += liveElapsedSec > 0 ? Math.floor(liveElapsedSec / 60) : (actual || 0);
      } else if (s === "paused") {
        activeNetElapsed += actual > 0 ? actual : 0;
      }
    }

    const executedNow = completedActual + activeNetElapsed;
    const remainingMinutes = Math.max(0, plannedMinutes - executedNow);
    const executionPercent = plannedMinutes > 0
      ? Math.min(100, Math.round((executedNow / plannedMinutes) * 100))
      : 0;

    return {
      plannedMinutes,
      completedMinutes: completedActual,
      provisionalMinutes: provisionalRecovered,
      studyingMinutes: activeNetElapsed,
      remainingMinutes,
      executionPercent,
    };
  }, [todayBlocks, liveElapsedSec]);

  const studyingBlocks = useMemo(() => {
    return todayBlocks.filter((b) => {
      const s = (b.Status || b.status || "").toLowerCase();
      return s === "active" || s === "paused";
    });
  }, [todayBlocks]);

  const nextBlocks = useMemo(() => {
    return todayBlocks.filter((b) => {
      const s = (b.Status || b.status || "").toLowerCase();
      return s === "planned" || s === "upcoming" || (!s && !b.ActualStart);
    });
  }, [todayBlocks]);

  const completedBlocks = useMemo(() => {
    return todayBlocks.filter((b) => {
      const s = (b.Status || b.status || "").toLowerCase();
      return s === "completed" || s === "done";
    });
  }, [todayBlocks]);

  const skippedBlocks = useMemo(() => {
    return todayBlocks.filter((b) => {
      const s = (b.Status || b.status || "").toLowerCase();
      return s === "skipped" || s === "missed" || s === "partial" || s === "stopped";
    });
  }, [todayBlocks]);

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

        const authUserId = getAuthUserId() || pgRes?.userId || "moulika";
        if (pgRes && pgRes.ok && pgRes.blocks && pgRes.blocks.length > 0) {
          res = pgRes;
          console.log(JSON.stringify({ operation: 'load_plan', user_id: authUserId, requested_date: targetDate, source: 'postgres', block_count: pgRes.blocks.length, elapsed_ms: Date.now() - startTime }));
        } else if (pgRes && pgRes.ok && pgRes.blocks && pgRes.blocks.length === 0) {
          res = pgRes;
          console.log(JSON.stringify({ operation: 'load_plan', user_id: authUserId, requested_date: targetDate, source: 'postgres', block_count: 0, elapsed_ms: Date.now() - startTime }));
        } else {
          // Postgres failed
          res = { ok: false, source: 'postgres_error', error: 'Unable to load the current plan.' };
          console.error(JSON.stringify({ operation: 'load_plan', user_id: authUserId, requested_date: targetDate, source: 'postgres_error', error: pgErr || pgRes?.message }));
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

          if (
            rawStatus === BLOCK_STATUS.MISSED ||
            rawStatus === "missed"
          ) {
            derivedStatus = BLOCK_STATUS.MISSED;
          } else if (
            rawStatus === BLOCK_STATUS.SKIPPED ||
            rawStatus === "skipped" ||
            rawStatus === "stopped"
          ) {
            derivedStatus = BLOCK_STATUS.SKIPPED;
          } else if (
            rawStatus === BLOCK_STATUS.PARTIAL ||
            rawStatus === "partial"
          ) {
            derivedStatus = BLOCK_STATUS.PARTIAL;
          } else if (
            rawStatus === "carried_forward"
          ) {
            derivedStatus = "carried_forward";
          } else if (
            rawStatus === BLOCK_STATUS.COMPLETED ||
            rawStatus === "completed" ||
            b.IsCompleted
          ) {
            derivedStatus = BLOCK_STATUS.COMPLETED;
          } else if (rawStatus === "review_pending") {
            derivedStatus = "review_pending";
          } else if (rawStatus === BLOCK_STATUS.PAUSED || pausedAfterResume) {
            derivedStatus = BLOCK_STATUS.PAUSED;
          } else if (b.ActualStart && !b.ActualEnd) {
            derivedStatus = BLOCK_STATUS.ACTIVE;
          } else if (b.ActualEnd) {
            derivedStatus = BLOCK_STATUS.COMPLETED;
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
            PlannedSubject: b.PlannedSubject || b.Subject || "Unknown",
            PlannedTopic: b.PlannedTopic || b.Topic || "",
            PlannedStart: b.PlannedStart || b.Start || "",
            PlannedEnd: b.PlannedEnd || b.End || "",
            PlannedMinutes: Number(b.PlannedMinutes ?? b.Minutes ?? 0),

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

            plan_comment: b.plan_comment || b.PlanComment || b.planComment || "",
            PlanComment: b.PlanComment || b.plan_comment || b.planComment || "",
            study_review: b.study_review || b.StudyReview || b.studyReview || "",
            StudyReview: b.StudyReview || b.study_review || b.studyReview || "",
            completion_percent: b.completion_percent ?? b.CompletionPercent ?? b.completionPercent ?? null,
            CompletionPercent: b.CompletionPercent ?? b.completion_percent ?? b.completionPercent ?? null,
            quality: b.quality || b.Quality || "",
            Quality: b.Quality || b.quality || "",
            custom_topic: b.custom_topic || b.CustomTopic || b.customTopic || "",
            CustomTopic: b.CustomTopic || b.custom_topic || b.customTopic || "",
            source: b.source || b.Source || "manual",
            Source: b.Source || b.source || "manual",
            parent_block_id: b.parent_block_id || b.ParentBlockId || null,
            ParentBlockId: b.ParentBlockId || b.parent_block_id || null,

            Reason: b.Reason || b.completion_reason || "",
            completion_reason: b.completion_reason || b.Reason || "",
            isProvisional: Boolean(b.isProvisional || b.is_provisional || b.Reason === "stale_session_recovered" || b.completion_reason === "stale_session_recovered"),
            is_provisional: Boolean(b.isProvisional || b.is_provisional || b.Reason === "stale_session_recovered" || b.completion_reason === "stale_session_recovered"),

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
    // Reset plan photo when navigating dates, then load saved daily image for the date
    setPlanPhoto(null);
    setParsedPlan(null);

    fetchWithAuth(`/api/plan/blocks/daily-image?dayKey=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.exists && data.image) {
          setPlanPhoto(data.image.imageData);
          if (data.image.rawOcrText) {
            setParsedPlan({ rawText: data.image.rawOcrText });
          }
        }
      })
      .catch((err) => console.warn("Failed to load daily plan image:", err));
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

  async function handleStartBlock(target, options = {}) {
    const blockId = typeof target === 'object' && target !== null ? (target.BlockId || target.id) : target;
    const { openFocus = true, forceStart = false } = options;

    // NEVER AUTO-COMPLETE AN ACTIVE BLOCK!
    // Check if another block is currently ACTIVE or PAUSED
    const existingActive = todayBlocks.find(
      (b) => {
        const s = (b.Status || b.status || "").toLowerCase();
        return (s === "active" || s === "paused") && (b.BlockId !== blockId && b.id !== blockId);
      }
    );

    if (existingActive && !forceStart) {
      // Show confirmation modal with full details
      const targetBlock = todayBlocks.find((b) => b.BlockId === blockId || b.id === blockId);
      setActiveConflictData({
        activeBlock: existingActive,
        targetBlock: targetBlock || { id: blockId, BlockId: blockId }
      });
      return;
    }

    const nowIso = new Date().toISOString();

    // Mark this block as started SYNCHRONOUSLY before any React state update or await.
    startedBlocksRef.current.add(blockId);

    if (openFocus) {
      setSpotlightOpen(true);
    }

    setTodayBlocks((prev) =>
      prev.map((b) =>
        (b.BlockId === blockId || b.id === blockId)
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
        startedBlocksRef.current.delete(blockId);
        if (out.code === "ACTIVE_BLOCK_EXISTS") {
          setSpotlightOpen(false);
          setActiveConflictData({
            activeBlock: out.activeBlock || existingActive,
            targetBlock: { id: blockId, BlockId: blockId }
          });
          await loadBlocksForDate(date);
          return;
        }
        if (out.code === "STALE_ACTIVE_SESSION") {
          setSpotlightOpen(false);
          setStatus("⚠️ Previous session needs confirmation before a new block can start.");
          setStaleBlockData(out.staleBlock);
          setStaleRecoveryModalOpen(true);
          await loadBlocksForDate(date);
          return;
        }
        setStatus(`❌ startBlock failed: ${out?.message || "unknown"}`);
        await loadBlocksForDate(date);
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
          console.error("[CALENDAR_BLOCK_SYNC_ERROR]", {
            date: selectedDate,
            errors: calOut?.errors,
            synced: calOut?.synced,
            skipped: calOut?.skipped,
            calendarId: calOut?.calendarId,
            errorMessage: calOut?.message || calOut?.error || "Calendar sync reported failure"
          });
        } else if (calTotal >= 20 && calSkippedRatio > 0.9) {
          console.warn("High skip ratio in calendar sync:", calOut);
        } else {
          console.log("syncCalendarFromBlocks success:", calOut);
        }
      } catch (err) {
        console.error("[CALENDAR_BLOCK_SYNC_ERROR]", {
          date: selectedDate,
          errorMessage: err?.message || String(err)
        });
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
      // Requirement 6: OCR confirmation must NOT delete/replace source image association. Keep parsedPlan or photo reference
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

  /* ---------------- Canonical Study Block Execution Handlers ---------------- */
  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (file) {
      // Read as data URL and persist for this date
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target?.result;
        if (base64Data) {
          setPlanPhoto(base64Data);
          fetchWithAuth("/api/plan/blocks/daily-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayKey: date,
              imageData: base64Data,
              mimeType: file.type || "image/jpeg"
            })
          }).catch((err) => console.warn("Failed to persist daily image:", err));
        }
      };
      reader.readAsDataURL(file);

      // Auto-trigger parse
      parseSelectedFile(file);
    }
  }

  async function parseSelectedFile(file) {
    if (!file) return;
    setBusy(true);
    setStatus("Extracting daily plan with OCR…");
    try {
      const out = await parsePlanPhoto(file, date);
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
        return {
          ...block,
          linkedPyqs: src.linkedPyqs || safePyq(),
          mapped: src.mapped || null,
          mappedNodes: src.mappedNodes || src?.linkedPyqs?.mappedNodes || [],
          finalMapping: src.finalMapping || null,
          nodeId: src.finalMapping?.nodeId || src.syllabusNodeId || "",
          nodeName: src.finalMapping?.nodeName || "",
          isApproved: src.finalMapping?.isApproved || false,
          confidenceBadge: src.finalMapping?.confidenceBadge || src.confidenceBadge || "UNKNOWN",
          mode: src.mode || block.mode || "",
          rawText: src.rawText || block.rawText || "",
          outputExpected: src.outputExpected || block.outputExpected || "",
          subtopic: src.subtopic || block.subtopic || "",
          syllabusNodeId: src.syllabusNodeId || src.finalMapping?.nodeId || block.syllabusNodeId || "",
          planComment: src.planComment || src.plan_comment || block.plan_comment || "",
          PlanComment: src.planComment || src.plan_comment || block.plan_comment || "",
        };
      });

      setOcrDraftBlocks(draftBlocks);
      const previewBlocks = Array.isArray(out?.reminderEngine?.previewBlocks) ? out.reminderEngine.previewBlocks : [];
      setOcrPreviewReminderBlocks(previewBlocks);
      setOcrApprovalOpen(true);
      setStatus("✅ Plan photo parsed! Review your study blocks below.");
    } catch (e) {
      setStatus("❌ Photo parse failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateManualBlock({ subject, topic, subtopic, customTopic, plannedMinutes, planComment, source }) {
    setBusy(true);
    try {
      const res = await fetchWithAuth("/api/plan/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayKey: date,
          subject,
          topic,
          subtopic,
          customTopic,
          plannedMinutes,
          planComment,
          source: source || "manual",
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ Failed to add study block: ${data?.error || "unknown"}`);
        return;
      }
      setAddBlockModalOpen(false);
      setStatus("✅ Study block created.");
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleCreateManualBlock error:", err);
      setStatus("❌ Failed to add study block.");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickStart({ subject, topic, duration, planComment }) {
    setBusy(true);
    try {
      const res = await fetchWithAuth("/api/plan/blocks/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayKey: date,
          subject,
          topic,
          duration,
          planComment,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ Quick start failed: ${data?.error || "unknown"}`);
        return;
      }
      setQuickStartModalOpen(false);
      setStatus("⚡ Quick start active! Timer running.");
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleQuickStart error:", err);
      setStatus("❌ Quick start failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinishBlock({ blockId, dayKey, actualEndTime, actualMinutes, completionPercent, quality, studyReview }) {
    setBusy(true);
    try {
      const isProvisional = Boolean(
        completionSheetBlock?.IsProvisional ||
        completionSheetBlock?.isProvisional ||
        completionSheetBlock?.is_provisional ||
        (completionSheetBlock?.Reason === "stale_session_recovered" && !completionSheetBlock?.completed_at && completionSheetBlock?.completion_source !== "user_confirmed")
      );

      const endpoint = isProvisional
        ? "/api/plan/blocks/confirm-recovery"
        : "/api/plan/blocks/complete";

      const res = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          dayKey: dayKey || date,
          actualEndTime,
          actualMinutes,
          completionPercent,
          quality,
          studyReview,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ ${isProvisional ? "Confirmation" : "Finish"} failed: ${data?.message || data?.error || "unknown"}`);
        return;
      }
      setCompletionSheetBlock(null);
      setStatus(isProvisional ? "✅ Recovery duration confirmed!" : "✅ Study block completed!");
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleFinishBlock error:", err);
      setStatus("❌ Finish block failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCarryForward({ blockId, targetDate, plannedMinutes, planComment }) {
    setBusy(true);
    try {
      const res = await fetchWithAuth("/api/plan/blocks/carry-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          targetDate,
          plannedMinutes,
          planComment,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ Carry forward failed: ${data?.error || "unknown"}`);
        return;
      }
      setCarryForwardBlock(null);
      setStatus(`✅ Work carried forward to ${targetDate}.`);
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleCarryForward error:", err);
      setStatus("❌ Carry forward failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePlannedPatch(blockId, patch) {
    setBusy(true);
    try {
      const res = await fetchWithAuth("/api/plan/blocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ Update failed: ${data?.error || "unknown"}`);
        return;
      }
      setEditPlannedBlock(null);
      setActiveCommentBlock(null);
      setStatus("✅ Study block updated.");
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleSavePlannedPatch error:", err);
      setStatus("❌ Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlannedBlock(blockId) {
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/plan/blocks?blockId=${encodeURIComponent(blockId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data?.ok) {
        setStatus(`❌ Delete failed: ${data?.error || "unknown"}`);
        return;
      }
      setEditPlannedBlock(null);
      setStatus("✅ Study block deleted.");
      await loadBlocksForDate(date);
    } catch (err) {
      console.error("handleDeletePlannedBlock error:", err);
      setStatus("❌ Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicateBlock(block) {
    const subject = block.PlannedSubject || block.subject || "Study Block";
    const topic = block.PlannedTopic || block.topic || block.custom_topic || "";
    const subtopic = block.subtopic || block.Subtopic || "";
    const plannedMinutes = Number(block.PlannedMinutes || block.planned_minutes || 60);
    const planComment = block.plan_comment || block.PlanComment || "";
    await handleCreateManualBlock({
      subject,
      topic,
      subtopic,
      customTopic: topic,
      plannedMinutes,
      planComment,
      source: "manual",
    });
  }

  async function handleMoveToTomorrow(block) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDate = tomorrow.toISOString().slice(0, 10);
    const plannedMinutes = Number(block.PlannedMinutes || block.planned_minutes || 60);
    const planComment = block.plan_comment || block.PlanComment || "";

    await handleCarryForward({
      blockId: block.BlockId || block.id,
      targetDate,
      plannedMinutes,
      planComment,
    });
  }

  async function handleSkipBlock(blockId) {
    await handleSavePlannedPatch(blockId, { status: "skipped" });
  }

  async function handleSaveComment(blockId, text) {
    // Only update studyReview so planComment remains strictly separated as pre-study intent!
    await handleSavePlannedPatch(blockId, { studyReview: text });
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

  const isCurrentPaused = Boolean(currentBlock && normalizeCanonicalBlockStatus(currentBlock) === "paused");
  const isCurrentActive = Boolean(currentBlock && normalizeCanonicalBlockStatus(currentBlock) === "active");
  const currentPlannedMinutes = Number(currentBlock?.PlannedMinutes || currentBlock?.planned_minutes || 0);
  const currentActualMinutes = Number(currentBlock?.ActualMinutes || currentBlock?.actual_minutes || 0);
  const currentNetElapsed = liveElapsedSec > 0 ? Math.floor(liveElapsedSec / 60) : currentActualMinutes;
  const overTargetMinutes = currentPlannedMinutes > 0 && currentNetElapsed > currentPlannedMinutes
    ? (currentNetElapsed - currentPlannedMinutes)
    : 0;

  return (
    <div className="mos-app-container-v2" data-page="plan">
      <div className="mentoros-content-inner">
        <div className="mos-plan-wrapper">
        {/* Hidden file input for OCR photo upload */}
        <input
          ref={planPhotoInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />

        {/* Editorial Breadcrumbs & Header */}
        <div className="mos-editorial-header" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{
                fontFamily: "var(--mono, monospace)",
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-tertiary)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 4
              }}>
                MENTOROS / PLAN / DAILY EXECUTION
              </div>
              <h1 style={{
                fontSize: "clamp(20px, 6vw, 28px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 4px 0",
                letterSpacing: "-0.02em",
                wordBreak: "break-word"
              }}>
                {greeting}, <span style={{ color: "var(--brand-primary)" }}>Moulika.</span>
              </h1>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                }).format(new Date(date + "T00:00:00"))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)"
                }}
              />
            </div>
          </div>
        </div>

        {/* Horizontal Mentor Command Strip */}
        <MentorCommandStrip
          activeBlock={isCurrentActive ? currentBlock : null}
          pausedBlock={isCurrentPaused ? currentBlock : null}
          nextBlock={nextBlock}
          todayBlocks={todayBlocks}
          dashboardMetrics={dashboardMetrics}
          overTargetMinutes={overTargetMinutes}
          acknowledgedContinue={acknowledgedContinue}
          onFinishBlock={(b) => setCompletionSheetBlock(b)}
          onContinue={(b) => setAcknowledgedContinue(true)}
          onStartBlock={(bId) => handleStartBlock(bId, { openFocus: false })}
          onResumeBlock={(bId) => handleResumeBlock(bId)}
          onOpenComment={(b) => setActiveCommentBlock(b)}
          onAddBlock={() => setAddBlockModalOpen(true)}
          onUploadPlan={() => planPhotoInputRef.current?.click()}
          onQuickStart={() => setQuickStartModalOpen(true)}
          onOpenDailyReview={() => nightReviewRef.current?.scrollIntoView({ behavior: "smooth" })}
        />

        {/* Dual-Column 65/35 Command Center Grid */}
        <div className="mos-command-center-grid">
          {/* Left Column (~65%) */}
          <div className="mos-column-main">
            <div className="mos-item-workspace">
              <LiveStudyWorkspace
                activeBlock={isCurrentActive ? currentBlock : null}
                pausedBlock={isCurrentPaused ? currentBlock : null}
                nextBlock={nextBlock}
                liveElapsedSec={liveElapsedSec}
                overTargetMinutes={overTargetMinutes}
                acknowledgedContinue={acknowledgedContinue}
                busy={busy}
                onStartBlock={(bId) => handleStartBlock(bId, { openFocus: false })}
                onPauseBlock={(bId) => handlePauseBlock(bId)}
                onResumeBlock={(bId) => handleResumeBlock(bId)}
                onFinishBlock={(b) => setCompletionSheetBlock(b)}
                onContinue={(b) => setAcknowledgedContinue(true)}
                onOpenComment={(b) => setActiveCommentBlock(b)}
                onAddBlock={() => setAddBlockModalOpen(true)}
                onUploadPlan={() => planPhotoInputRef.current?.click()}
                onQuickStart={() => setQuickStartModalOpen(true)}
              />
            </div>

            <div className="mos-item-flow">
              <StudyFlowTable
                todayBlocks={todayBlocks}
                onStartBlock={(bId) => handleStartBlock(bId, { openFocus: false })}
                onPauseBlock={(bId) => handlePauseBlock(bId)}
                onResumeBlock={(bId) => handleResumeBlock(bId)}
                onFinishBlock={(b) => setCompletionSheetBlock(b)}
                onEditBlock={(b) => setEditPlannedBlock(b)}
                onEditReview={(b) => setCompletionSheetBlock(b)}
                onCarryForward={(b) => setCarryForwardBlock(b)}
                onAddBlock={() => setAddBlockModalOpen(true)}
                busy={busy}
              />
            </div>
          </div>

          {/* Right Rail (~35%) */}
          <div className="mos-column-rail">
            <div className="mos-item-execution">
              <TodayExecutionRail
                dashboardMetrics={dashboardMetrics}
                todayBlocks={todayBlocks}
                overTargetMinutes={overTargetMinutes}
              />
            </div>

            <div className="mos-item-milestones">
              <ExamMilestonesRail />
            </div>

            <div className="mos-item-actions">
              <QuickActionsRail
                onUploadPlan={() => planPhotoInputRef.current?.click()}
                onAddBlock={() => setAddBlockModalOpen(true)}
                onNavigateRevision={() => { window.location.href = "/revision"; }}
                onNavigateLogBook={() => { window.location.href = "/execution"; }}
                busy={busy}
              />
            </div>
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

      <ManageTodayModal
        open={manageTodayOpen}
        onClose={() => setManageTodayOpen(false)}
        todayBlocks={todayBlocks}
        onOpenAddBlock={() => {
          setEditingBlock(null);
          setAddBlockOpen(true);
        }}
        onEditBlock={(block) => {
          setEditingBlock(block);
          setAddBlockOpen(true);
        }}
        onDeleteBlock={async (block) => {
          setBusy(true);
          setStatus(`Deleting block "${block.PlannedSubject || "study block"}"...`);
          try {
            const res = await post("deleteBlock", { blockId: block.BlockId, dayKey: date });
            if (!res?.ok) {
              setStatus(`❌ Delete block failed: ${res?.message || "unknown"}`);
            } else {
              setStatus("✅ Block deleted.");
              await loadBlocksForDate(date);
            }
          } catch (err) {
            setStatus(`❌ Delete block failed: ${err.message}`);
          } finally {
            setBusy(false);
          }
        }}
        onResetExecution={async () => {
          setBusy(true);
          setStatus("Resetting execution...");
          try {
            const res = await post("resetDayExecution", { dayKey: date });
            if (!res?.ok) {
              setStatus(`❌ Reset execution failed: ${res?.message || "unknown"}`);
            } else {
              setStatus("✅ Execution reset.");
              await loadBlocksForDate(date);
            }
          } catch (err) {
            setStatus(`❌ Reset execution failed: ${err.message}`);
          } finally {
            setBusy(false);
          }
        }}
        onClearTimetable={async () => {
          setBusy(true);
          setStatus("Clearing timetable...");
          try {
            const res = await post("clearTodayTimetable", { dayKey: date });
            if (!res?.ok) {
              setStatus(`❌ Clear timetable failed: ${res?.message || "unknown"}`);
            } else {
              setStatus("✅ Timetable cleared.");
              await loadBlocksForDate(date);
            }
          } catch (err) {
            setStatus(`❌ Clear timetable failed: ${err.message}`);
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />

      <AddBlockModal
        open={addBlockOpen}
        busy={busy}
        onClose={() => {
          setAddBlockOpen(false);
          setEditingBlock(null);
        }}
        editingBlock={editingBlock}
        existingBlocks={todayBlocks}
        onSave={async ({ blockId, text, subject, startTime, endTime, plannedMinutes, resolved, isEdit }) => {
          setBusy(true);
          if (isEdit) {
            setStatus(`Updating block "${subject || text}"...`);
            try {
              const res = await post("updateBlock", {
                blockId,
                dayKey: date,
                patch: {
                  PlannedSubject: subject || text,
                  PlannedTopic: text,
                  PlannedStart: startTime,
                  PlannedEnd: endTime,
                  PlannedMinutes: plannedMinutes,
                },
              });
              if (!res?.ok) {
                setStatus(`❌ Update failed: ${res?.message || "unknown"}`);
              } else {
                setStatus(`✅ Block updated.`);
                await loadBlocksForDate(date);
              }
            } catch (e) {
              setStatus(`❌ Update failed: ${e.message}`);
            } finally {
              setBusy(false);
            }
          } else {
            setStatus(`Adding block "${subject || text}"...`);
            try {
              const res = await post("createBlock", {
                dayKey: date,
                blockData: {
                  BlockId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  PlannedSubject: subject || text,
                  PlannedTopic: text,
                  PlannedStart: startTime,
                  PlannedEnd: endTime,
                  PlannedMinutes: plannedMinutes,
                  mode: resolved?.resolution?.activityType || "study",
                  rawText: text,
                },
              });
              if (!res?.ok) {
                setStatus(`❌ Add block failed: ${res?.message || "unknown"}`);
              } else {
                setStatus(`✅ Block "${text}" added.`);
                await loadBlocksForDate(date);
              }
            } catch (e) {
              setStatus(`❌ Add block failed: ${e.message}`);
            } finally {
              setBusy(false);
            }
          }
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
        <div className="mos-ocr-review-overlay">
          <div
            className="mos-ocr-review-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mos-ocr-review-header">
              <div className="mos-ocr-review-heading">
                <div className="mos-ocr-review-eyebrow">OCR Review</div>
                <h2 className="mos-ocr-review-title">Approve Parsed Plan</h2>
                <p className="mos-ocr-review-subtitle">
                  Review what MentorOS extracted. Your original wording stays visible while mapping and PYQ intelligence work in the background.
                </p>
              </div>

              <button
                type="button"
                className="mos-ocr-review-close-btn"
                aria-label="Close OCR review"
                disabled={busy}
                onClick={() => {
                  setOcrApprovalOpen(false);
                  setOcrDraftBlocks([]);
                  setOcrPreviewReminderBlocks([]);
                  setParsedPlan(null);
                  setReminderState({});
                  setStatus("OCR review closed. Nothing was saved or synced.");
                }}
              >
                ✕
              </button>
            </header>

            <div className="mos-ocr-review-summary-bar">
              <div className="mos-ocr-review-summary-pills">
                <span className="mos-ocr-review-pill">
                  {ocrDraftBlocks.length} {ocrDraftBlocks.length === 1 ? "block" : "blocks"}
                </span>
                <span className="mos-ocr-review-pill">
                  {ocrDraftBlocks.reduce((sum, block) => sum + Number(block?.PlannedMinutes || 0), 0)} min planned
                </span>
              </div>
              <span className="mos-ocr-review-summary-note">Nothing is saved until you approve.</span>
            </div>

            <div className="mos-ocr-review-body">
              <div className="mos-ocr-review-cards">
                {ocrDraftBlocks.map((block, index) => {
                  const rawActivity = String(
                    block?.RawActivity || block?.rawActivity || block?.Mode || block?.mode || "Study"
                  ).trim();
                  const activityLabel = rawActivity
                    .replace(/[_-]+/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  const confidence = String(block?.confidenceBadge || "").trim().toUpperCase();
                  const canonicalSubject =
                    block?.CanonicalSubject || block?.canonicalSubject || block?.finalMapping?.subjectName || "";
                  const canonicalTopic =
                    block?.CanonicalTopic || block?.canonicalTopic || block?.finalMapping?.nodeName || "";
                  const mappingLabel = [canonicalSubject, canonicalTopic].filter(Boolean).join(" · ");

                  return (
                    <section
                      key={block.BlockId || `${block.PlannedStart}-${index}`}
                      className={`mos-ocr-review-card ${
                        getDisplayStatus(block.Status) === BLOCK_STATUS.ACTIVE
                          ? "mos-ocr-review-card--active"
                          : ""
                      }`}
                    >
                      <div className="mos-ocr-review-card-head">
                        <div className="mos-ocr-review-card-head-left">
                          <span className="mos-ocr-review-card-index">Block {index + 1}</span>
                          <div className="mos-ocr-review-card-badges">
                            <span className="mos-ocr-badge mos-ocr-badge--subject">
                              {block.PlannedSubject || "Subject"}
                            </span>
                            <span className="mos-ocr-badge mos-ocr-badge--activity">{activityLabel}</span>
                            {confidence ? (
                              <span className={`mos-ocr-badge mos-ocr-badge--${confidence.toLowerCase()}`}>
                                {confidence.charAt(0) + confidence.slice(1).toLowerCase()} confidence
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="mos-ocr-review-remove-btn"
                          onClick={() => removeOcrDraftBlock(index)}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mos-ocr-review-card-summary">
                        <div className="mos-ocr-review-summary-main">
                          <h3 className="mos-ocr-review-topic-title">{block.PlannedTopic || "Untitled study block"}</h3>
                          <div className="mos-ocr-review-time-row">
                            {block.PlannedStart || "—"}–{block.PlannedEnd || "—"}
                            <span> • </span>
                            {Number(block.PlannedMinutes || 0)} min
                          </div>
                        </div>

                        {mappingLabel ? (
                          <div className="mos-ocr-review-mapping" title={block?.SyllabusNodeId || block?.syllabusNodeId || ""}>
                            <span className="mos-ocr-review-mapping-label">Mentor mapping</span>
                            <strong className="mos-ocr-review-mapping-value">{mappingLabel}</strong>
                          </div>
                        ) : null}
                      </div>

                      <div className="mos-ocr-review-fields">
                        <label className="mos-ocr-field-label mos-ocr-field-label--subject">
                          <span>Subject</span>
                          <input
                            value={block.PlannedSubject || ""}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, { PlannedSubject: e.target.value })
                            }
                          />
                        </label>

                        <label className="mos-ocr-field-label mos-ocr-field-label--topic">
                          <span>Topic</span>
                          <input
                            value={block.PlannedTopic || ""}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, { PlannedTopic: e.target.value })
                            }
                          />
                        </label>

                        <label className="mos-ocr-field-label mos-ocr-field-label--start">
                          <span>Start</span>
                          <input
                            value={block.PlannedStart || ""}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, { PlannedStart: e.target.value })
                            }
                          />
                        </label>

                        <label className="mos-ocr-field-label mos-ocr-field-label--end">
                          <span>End</span>
                          <input
                            value={block.PlannedEnd || ""}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, { PlannedEnd: e.target.value })
                            }
                          />
                        </label>

                        <label className="mos-ocr-field-label mos-ocr-field-label--minutes">
                          <span>Minutes</span>
                          <input
                            type="number"
                            min="0"
                            value={block.PlannedMinutes || 0}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, {
                                PlannedMinutes: Number(e.target.value || 0),
                              })
                            }
                          />
                        </label>

                        <label className="mos-ocr-field-label mos-ocr-field-label--comment" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                          <span>Plan Comment (Intent)</span>
                          <input
                            placeholder="What do you intend to complete in this block?"
                            value={block.planComment || block.PlanComment || block.plan_comment || ""}
                            onChange={(e) =>
                              updateOcrDraftBlock(index, {
                                planComment: e.target.value,
                                PlanComment: e.target.value,
                                plan_comment: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      {renderPyqPanel(block)}
                    </section>
                  );
                })}
              </div>
            </div>

            <footer className="mos-ocr-review-footer">
              <div className="mos-ocr-review-footer-note">
                Review complete? Confirming saves these blocks as canonical study blocks.
              </div>

              <div className="mos-ocr-review-footer-actions">
                <button
                  type="button"
                  disabled={busy}
                  className="mos-ocr-btn-secondary"
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

                <button
                  type="button"
                  disabled={busy}
                  className="mos-ocr-btn-primary"
                  onClick={handleApproveOcrBlocks}
                >
                  {busy ? "Processing…" : "Confirm All"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Canonical Study Block Execution System Modals */}
      <AddStudyBlockModal
        open={addBlockModalOpen}
        onClose={() => setAddBlockModalOpen(false)}
        onAdd={handleCreateManualBlock}
        onAddBlock={handleCreateManualBlock}
        existingBlocks={todayBlocks}
        busy={busy}
      />

      <QuickStartModal
        open={quickStartModalOpen}
        onClose={() => setQuickStartModalOpen(false)}
        onQuickStart={handleQuickStart}
        existingBlocks={todayBlocks}
        busy={busy}
      />

      <CompletionSheetModal
        open={!!completionSheetBlock}
        block={completionSheetBlock}
        onClose={() => setCompletionSheetBlock(null)}
        onComplete={handleFinishBlock}
        busy={busy}
      />

      <ActiveCommentModal
        open={!!activeCommentBlock}
        block={activeCommentBlock}
        onClose={() => setActiveCommentBlock(null)}
        onSaveComment={(text) => activeCommentBlock && handleSaveComment(activeCommentBlock.BlockId || activeCommentBlock.id, text)}
        busy={busy}
      />

      {/* Active Conflict Modal (Never Auto-Complete Active Block) */}
      <ActiveConflictModal
        open={!!activeConflictData}
        activeBlock={activeConflictData?.activeBlock}
        targetBlock={activeConflictData?.targetBlock}
        onKeepStudying={() => setActiveConflictData(null)}
        onPauseAndStartNew={async () => {
          if (!activeConflictData?.activeBlock || !activeConflictData?.targetBlock) return;
          const activeBid = activeConflictData.activeBlock.BlockId || activeConflictData.activeBlock.id;
          const targetBid = activeConflictData.targetBlock.BlockId || activeConflictData.targetBlock.id;
          setBusy(true);
          try {
            await handlePauseBlock(activeBid);
            setActiveConflictData(null);
            await handleStartBlock(targetBid, { forceStart: true });
          } catch (err) {
            console.error("Pause and start new failed:", err);
          } finally {
            setBusy(false);
          }
        }}
        onFinishCurrentFirst={() => {
          const activeB = activeConflictData?.activeBlock;
          setActiveConflictData(null);
          if (activeB) {
            setCompletionSheetBlock(activeB);
          }
        }}
        busy={busy}
      />

      <CarryForwardModal
        open={!!carryForwardBlock}
        block={carryForwardBlock}
        onClose={() => setCarryForwardBlock(null)}
        onCarryForward={handleCarryForward}
        busy={busy}
      />

      <EditPlannedBlockModal
        open={!!editPlannedBlock}
        block={editPlannedBlock}
        onClose={() => setEditPlannedBlock(null)}
        onSavePatch={(patch) => editPlannedBlock && handleSavePlannedPatch(editPlannedBlock.BlockId || editPlannedBlock.id, patch)}
        onDuplicate={() => editPlannedBlock && handleDuplicateBlock(editPlannedBlock)}
        onMoveToTomorrow={() => editPlannedBlock && handleMoveToTomorrow(editPlannedBlock)}
        onSkip={() => editPlannedBlock && handleSkipBlock(editPlannedBlock.BlockId || editPlannedBlock.id)}
        onDelete={() => editPlannedBlock && handleDeletePlannedBlock(editPlannedBlock.BlockId || editPlannedBlock.id)}
        busy={busy}
      />

      {/* Preserve Original Plan Photo View Modal (Section 14) */}
      {viewUploadedPhotoOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setViewUploadedPhotoOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 18,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📷</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Original Uploaded Daily Plan</h3>
              </div>
              <button
                onClick={() => setViewUploadedPhotoOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {planPhoto && (
                <img
                  src={planPhoto instanceof File ? URL.createObjectURL(planPhoto) : planPhoto}
                  alt="Uploaded Daily Plan"
                  style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              )}
              {parsedPlan?.rawText && (
                <div style={{ width: "100%", background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#334155" }}>
                  <strong>Extracted Plan Text:</strong>
                  <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontFamily: "var(--mono, monospace)" }}>
                    {parsedPlan.rawText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
