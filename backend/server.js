// backend/server.js (ESM ONLY)
// PHASE 2: Plan-photo OCR => TIME BLOCKS (start/end/subject/topic/minutes)
// Keeps syllabus + advice engine + mapping logic intact
// FIXED:
// - removed duplicate /api/pyq/node/:nodeId route
// - PYQ route now prefers *_tagged.json
// - PYQ route now checks nested folders correctly
// - PYQ enrichment matches by item.id first, then year + question number
// - no reminder/calendar/downstream registration before OCR approval

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { requireAuth } from "./middleware/authMiddleware.js";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import pyqRoutes from "./routes/pyqRoutes.js";
import buildTopicTest from "./phase3a/builders/buildTopicTest.js";
import {
  getPyqSummaryForNode,
  explainPyqResolution,
} from "./brain/pyqLinkEngine.js";
import SYLLABUS_GRAPH_2026 from "./brain/syllabusGraph.js";
import { detectLoops } from "./brain/loopDetector.js";
import { buildDailyAdvice } from "./brain/adviceEngine.js";
import prelimsPracticeRoute from "./routes/prelimsPracticeRoute.js";
import prelimsDashboardRoute from "./routes/prelimsDashboardRoute.js";
import prelimsRebuiltDatasetRoute from "./routes/prelimsRebuiltDatasetRoute.js";
import {
  query,
  activeDbHost,
  activeDbPort,
  activeDbSsl,
  activeDbSource,
} from "./db/index.js";
import {
  mapPlanItemToMicroTheme,
  daysToPrelims,
  killSwitchMode,
  findMicroTheme,
  findTopMicroThemes,
} from "./brain/findMicroTheme.js";
import prelimsPyqTestRoutes from "./routes/prelimsPyqTestRoutes.js";
import blockResolveRoute from "./routes/blockResolveRoute.js";
import { loadGs1Questions } from "./api/mainsGs1Questions.js";
import { loadGs1TopicQuestions } from "./api/mainsGs1TopicQuestions.js";
import { loadGs2Questions } from "./api/mainsGs2Questions.js";
import { loadGs3Questions } from "./api/mainsGs3Questions.js";
import mainsThemeRoutes from "./routes/mainsThemeRoutes.js";
import mainsReviewRoutes from "./routes/mainsReviewRoutes.js";
import mainsRoutes from "./routes/mainsRoutes.js";
import mainsIntelligenceRoutes from "./routes/mainsIntelligenceRoutes.js";
import mainsKnowledgeReviewRoutes from "./routes/mainsKnowledgeReviewRoutes.js";
import testGeminiRoute from "./routes/testGemini.js";
import evaluateAnswerRoute from "./routes/evaluateAnswerRoute.js";
import answerWritingRoutes from "./routes/answerWritingRoutes.js";
import air1ReviewRoutes from "./routes/air1ReviewRoutes.js";
import mainsPatternRoutes from "./routes/mainsPatternRoutes.js";
import mainsRecommendationRoutes from "./routes/mainsRecommendationRoutes.js";
import {
  computeSyllabusProgress,
} from "./brain/syllabusProgressEngine.js";
import prelimsAnalyticsRoute from "./routes/prelimsAnalyticsRoute.js";
import { buildFullLengthTest, getAvailableFullLengthYears } from "./utils/buildFullLengthTest.js";
import {
  registerDaySchedule,
  startBlock,
  completeBlock,
  getDay,
  tickReminderEngine,
} from "./reminderEngine.js";
import { autoResolveNodes } from "./brain/autoNodeResolver.js";
import { resolvePrelimsNodes } from "./brain/prelimsNodeResolver.js";
import { getGSCounts, loadGSData } from "./data/loaders/gsLoader.js";
import { loadCSATData } from "./data/loaders/csatLoader.js";
import { getRcSubtopicSummary, resetRcCache } from "./engines/rcSubtopicLoader.js";
import { processOcrText } from "./ocrMapping/index.js";
import mistakeRoutes from "./routes/mistakeRoutes.js";
import revisionRoutes from "./routes/revisionRoutes.js";
import weaknessRoutes from "./routes/weaknessRoutes.js";
import pyqExplanationRoutes from "./routes/pyqExplanationRoutes.js";
import subjectPyqRoutes from "./routes/subjectPyqRoutes.js";
import pyqIngestionRoutes from "./routes/pyqIngestionRoutes.js";
import planBlockRoutes from "./routes/planBlockRoutes.js";
import mentorRoutes from "./routes/mentorRoutes.js";
import executionRoutes from "./routes/executionRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import plannerRoutes from "./routes/plannerRoutes.js";
import knowledgeLinkageRoutes from "./routes/knowledgeLinkageRoutes.js";
import pyqLinkageRoutes from "./routes/pyqLinkageRoutes.js";
import pyqIntelligenceRoutes from "./routes/pyqIntelligenceRoutes.js";
import adaptiveRoutes from "./routes/adaptiveRoutes.js";
import mainsAttemptsRoute from "./routes/mainsAttemptsRoute.js";
import prelimsUnifiedRoutes from "./routes/prelimsUnifiedRoutes.js";
import prelimsTestRoutes from "./routes/prelimsTestRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import behaviourRoutes from "./routes/behaviourRoutes.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhookRoutes.js";
import disciplineRoutes from "./routes/disciplineRoutes.js";
import guardianRoutes from "./routes/guardianRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { registerEnvChatId, startTelegramPolling } from "./services/telegramService.js";
import { initNotificationScheduler } from "./services/notificationScheduler.js";
import { healthMonitor } from "./services/healthMonitor.js";
import {
  startBlock   as dbStartBlock,
  pauseBlock   as dbPauseBlock,
  resumeBlock  as dbResumeBlock,
  completeBlock as dbCompleteBlock,
  stopBlock    as dbStopBlock,
  mergeLifecycleIntoGasBlocks,
} from "./services/blockLifecycleService.js";
import { syncBlockToCalendar } from "./services/calendarBridgeService.js";
import { flushOutbox } from "./services/outboxService.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRELIMS_FULL_LENGTH_DIR = path.join(__dirname, "data", "pyq_papers", "prelims");

console.log("[BOOT] server.js loaded");

/* -------------------- HELPERS -------------------- */

function readPrelimsFullLengthPapers() {
  if (!fs.existsSync(PRELIMS_FULL_LENGTH_DIR)) return [];

  return fs.readdirSync(PRELIMS_FULL_LENGTH_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const match =
        entry.name.match(/^(\d{4})\.json$/) ||
        entry.name.match(/^prelims_(\d{4})_/);
      if (!match) return null;

      const year = Number(match[1]);
      const paperId = entry.name.replace(/\.json$/i, "");
      const filePath = path.join(PRELIMS_FULL_LENGTH_DIR, entry.name);
      let questionCount = 0;

      try {
        const paper = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        questionCount = Number(paper?.totalQuestions) || (Array.isArray(paper?.questions) ? paper.questions.length : 0);
      } catch (error) {
        console.warn("[Prelims FullLength] failed reading paper catalog item", {
          file: entry.name,
          error: String(error?.message || error),
        });
      }

      return { year, paperId, questionCount };
    })
    .filter(Boolean)
    .sort((a, b) => b.year - a.year || a.paperId.localeCompare(b.paperId));
}

function readPrelimsFullLengthPaperById(paperId) {
  const safePaperId = String(paperId || "").trim();
  if (!/^(?:\d{4}|prelims_\d{4}_[a-z0-9_]+)$/i.test(safePaperId)) return null;

  const filePath = path.join(PRELIMS_FULL_LENGTH_DIR, `${safePaperId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const paper = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const questions = Array.isArray(paper?.questions) ? paper.questions : [];

  return {
    paperId: safePaperId,
    year: Number(paper?.year) || Number(safePaperId.match(/\d{4}/)?.[0]),
    paper: paper?.paper || "GS",
    questionCount: Number(paper?.totalQuestions) || questions.length,
    questions,
  };
}

function normalizeOcrSubject(subject = "", topic = "") {
  const s = String(subject || "").trim().toLowerCase().replace(/\s+/g, " ");
  const t = String(topic || "").trim().toLowerCase().replace(/\s+/g, " ");

  if (
    ["gs3-st", "gs3 st", "gs3st", "science", "science and tech", "science & tech"].includes(s)
  ) {
    return "Science and Tech";
  }

  if (["csat", "aptitude"].includes(s)) {
    return "CSAT";
  }

  if (["economy", "gs3-economy", "gs3 economy"].includes(s)) {
    return "Economy";
  }

  if (["gs3"].includes(s)) {
    if (/\bbiotech(nology)?\b|\bgenomics\b|\bproteomics\b|\bstem cell\b|\bdna\b|\brna\b|\bgene\b/i.test(t)) return "Science and Tech";
    if (/\bnumber\s*system\b|\bprofit and loss\b|\bratio and proportion\b|\baverages?\b|\bmixtures?\b/i.test(t)) return "CSAT";
    if (/\binflation\b|\bbanking\b|\bmoney\b|\bnational income\b|\bfiscal\b|\bmonetary\b|\bbudget\b|\btax\b|\bexternal sector\b|\bfinancial market\b/i.test(t)) return "Economy";
    if (/\benvironment\b|\becology\b|\bbiodiversity\b|\bconservation\b/i.test(t)) return "Environment";
    return "GS3";
  }

  return String(subject || "").trim();
}

function normalizeOcrTopic(topic = "", subject = "") {
  let t = String(topic || "").trim();

  t = t

    .replace(/[–—]/g, "-")
    .replace(/\bGS\s*[- ]?\s*\d+\b/gi, "")
    .replace(/\bClass\b/gi, "")
    .replace(/\bLecture\b/gi, "")
    .replace(/\bRevision of\b/gi, "")
    .replace(/\bshort notes?\b/gi, "")
    .replace(/\ball topics under\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  t = t
    .replace(/\b2\s*vc\b/gi, "IVC")
    .replace(/\bi\s*vc\b/gi, "IVC")
    .replace(/\bivc\b/gi, "IVC")
    .replace(/\bmauryas\b/gi, "Mauryas")
    .replace(/\bvedic age\b/gi, "Vedic Age");

  const s = normalizeOcrSubject(subject);

  if (s === "Science and Tech") {
    if (/^biotechnology$/i.test(t) || /\bbiotech(nology)?\b/i.test(t)) {
      return "Biotechnology";
    }
  }

  if (s === "CSAT") {
    if (/^numbersystem$/i.test(t) || /\bnumber\s*system\b/i.test(t)) {
      return "Number System";
    }
  }

  return t;
}

function todayISODate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// normalize "4 40", "4.40", "4:40", "04:40", "0440" => "04:40"
function normTime(t) {
  const s = String(t || "").trim();
  if (!s) return "";

  const cleaned = s.replace(/[.\s]/g, ":").replace(/::+/g, ":");

  if (/^\d{4}$/.test(cleaned)) {
    const hh = cleaned.slice(0, 2);
    const mm = cleaned.slice(2, 4);
    const H = Number(hh);
    const M = Number(mm);
    if (H < 0 || H > 23 || M < 0 || M > 59) return "";
    return `${hh}:${mm}`;
  }

  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "";

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function toMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatMinutes(m) {
  if (m === null) return "";
  let d = Math.round(m) % 1440;
  if (d < 0) d += 1440;
  const hh = Math.floor(d / 60);
  const mm = d % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// robust chronological sequence validator
function inferCorrectTimeSequence(items) {
  let lastMin = null;
  return items.map((it) => {
    let st = normTime(it.startTime);
    let en = normTime(it.endTime);

    let sMin = toMinutes(st);
    let eMin = toMinutes(en);

    // Rule 1: Attempt to convert AM to PM if it strictly enforces chronological progression
    if (sMin !== null && lastMin !== null) {
      if (sMin + 60 < lastMin && sMin < 12 * 60) {
         sMin += 12 * 60;
      }
    }
    
    if (eMin !== null && sMin !== null) {
      if (eMin < sMin && eMin < 12 * 60) {
         eMin += 12 * 60;
      }
    }

    // Rule 2: Validation of logical sequence
    let needsConfirmation = false;
    let diff = null;
    if (sMin !== null && eMin !== null) {
      diff = eMin - sMin;
      if (diff < 0) diff += 1440; // overnight?
      
      // If it's a ridiculous duration (> 8 hrs) or starting way before previous block
      if (diff > 480 || diff < 0 || (lastMin !== null && sMin < lastMin - 120)) {
        if (it.minutes && it.minutes > 0 && it.minutes <= 360) {
          // Attempt to anchor using explicit duration if provided by OCR
          if (eMin !== null && eMin >= (lastMin || 0)) {
            sMin = eMin - it.minutes;
            if (sMin < 0) sMin += 1440;
            needsConfirmation = false;
          } else if (sMin !== null && sMin >= (lastMin || 0)) {
            eMin = sMin + it.minutes;
            needsConfirmation = false;
          } else {
             needsConfirmation = true;
          }
        } else {
          needsConfirmation = true;
        }
      }
    }

    if (!it.minutes && sMin !== null && eMin !== null) {
       it.minutes = eMin - sMin;
       if (it.minutes < 0) it.minutes += 1440;
    }

    // Format back
    st = formatMinutes(sMin) || st;
    en = formatMinutes(eMin) || en;

    if (eMin !== null) {
      lastMin = eMin;
    } else if (sMin !== null && it.minutes) {
      lastMin = sMin + it.minutes;
    }

    return { ...it, startTime: st, endTime: en, needsTimeConfirmation: needsConfirmation };
  });
}

/**
 * Non-study blocks should NOT be syllabus-mapped or returned to the frontend.
 * isNonStudyBlock — negative blocklist check (subject OR topic contains a non-study keyword)
 */
function isNonStudyBlock(subject, topic) {
  const s = String(subject || "").toLowerCase();
  const t = String(topic || "").toLowerCase();

  const keys = [
    "yoga",
    "puja",
    "prayer",
    "break",
    "rest",
    "walk",
    "stretch",
    "lunch",
    "dinner",
    "breakfast",
    "snack",
    "bath",
    "freshen",
    "commute",
    "travel",
    "nap",
    "sleep",
    "gym",
    "workout",
    "exercise",
    // extended
    "hospital",
    "clinic",
    "doctor",
    "personal",
    "free time",
    "family",
    "office",
    "college",
    "work",
    "class",
    "school",
  ];

  return keys.some((k) => s.includes(k) || t.includes(k));
}

/**
 * isStudyBlock — positive allowlist check (subject OR topic contains a study keyword).
 * Applied AFTER isNonStudyBlock. An item must pass both:
 *   !isNonStudyBlock(item) → strip obvious non-study entries
 *   isStudyBlock(item)    → keep only items that are recognisably academic
 *
 * Items with very short / unrecognised subjects that aren't in either list are
 * also kept (they may be OCR artefacts like "GS" or abbreviated subject names).
 */
function isStudyBlock(item) {
  const text = [
    item.subject,
    item.topic,
    item.title,
    item.label,
    item.activity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Non-study blocklist takes priority
  if (isNonStudyBlock(item.subject, item.topic)) return false;

  const studyKeywords = [
    "geography",
    "gs",
    "gs1",
    "gs2",
    "gs3",
    "gs4",
    "ethics",
    "essay",
    "prelims",
    "mcq",
    "csat",
    "current affairs",
    "revision",
    "optional",
    "answer writing",
    "pyq",
    "newspaper",
    "mains",
    "polity",
    "economy",
    "history",
    "environment",
    "science",
    "mapping",
    "sociology",
    "hindi",
    "english",
    "aptitude",
    "reading",
    "study",
    "practice",
    "test",
    "mock",
    "upsc",
    "ias",
    "culture",
    "art",
    "economics",
    "international",
    "governance",
    "social",
    "security",
    "agriculture",
    "disaster",
    "internal security",
    "biodiversity",
    "ecology",
  ];

  // Accept if any study keyword is present
  if (studyKeywords.some((k) => text.includes(k))) return true;

  // Fallback: accept short items that aren't in the blocklist
  // (e.g., "GS", "CA", abbreviated subject codes from handwritten schedules)
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount <= 3;
}

/**
 * Overlap marking (non-blocking)
 * Keeps all items, only marks overlap
 */
function markOverlaps(items) {
  const timeline = items
    .map((it, idx) => {
      const s = toMinutes(it.startTime);
      const e = toMinutes(it.endTime);
      if (s == null || e == null) return null;
      const end = e >= s ? e : e + 24 * 60;
      return { idx, s, e: end };
    })
    .filter(Boolean)
    .sort((a, b) => a.s - b.s);

  const overlapped = new Set();
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    if (cur.s < prev.e) {
      overlapped.add(prev.idx);
      overlapped.add(cur.idx);
    }
  }

  return items.map((it, idx) => ({
    ...it,
    status: overlapped.has(idx) ? "OVERLAP" : "",
  }));
}

function toISOWithDate(dateStr, hhmm) {
  const t = normTime(hhmm);
  if (!dateStr || !t) return "";
  return `${dateStr}T${t}:00+05:30`;
}

function blockLabelFromIndex(idx) {
  if (idx === 0) return "First block";
  if (idx === 1) return "Second block";
  if (idx === 2) return "Third block";
  if (idx === 3) return "Fourth block";
  if (idx === 4) return "Fifth block";
  if (idx === 5) return "Sixth block";
  return `${idx + 1}th block`;
}

function emptyLinkedPyqs(nodeId = "") {
  return {
    syllabusNodeId: nodeId,
    matchedNodeId: null,
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
  };
}


function buildMappedObject(mapped, nonStudy, originalItem) {
  if (nonStudy) {
    return {
      syllabusNodeId: "NON_STUDY",
      code: "NON_STUDY",
      gsPaper: "",
      subjectGroup: "",
      gsHeading: "",
      macroTheme: "Non-Study",
      subject: "Non-Study",
      microTheme: originalItem?.subject || "Non-Study",
      mappedTopicName: originalItem?.topic || originalItem?.subject || "Non-Study",
      section: "",
      parentTopic: "",
      path: "",
      tag: "X",
      caThemes: [],
      confidence: 1,
      matched: [],
      matchedTokens: [],
      allMatches: [],
      chunks: [],
      ignoredTokens: [],
      ignoredText: "",
      mappingVersion: "phase2-v1",
      nonStudy: true,
    };
  }

  if (!mapped) return null;

  return {
    syllabusNodeId: mapped.syllabusNodeId || mapped.code || null,
    code: mapped.code || null,
    gsPaper: mapped.gsPaper || "",
    subjectGroup: mapped.subjectGroup || "",
    gsHeading: mapped.gsHeading || mapped.subjectGroup || "",
    macroTheme: mapped.macroTheme || mapped.section || "",
    subject: mapped.subject || "",
    microTheme: mapped.microTitle || mapped.mappedTopicName || mapped.microTheme || "",
    mappedTopicName: mapped.mappedTopicName || mapped.microTitle || mapped.microTheme || "",
    section: mapped.section || "",
    parentTopic: mapped.parentTopic || "",
    path: mapped.path || "",
    tag: mapped.tag || "",
    caThemes: mapped.caThemes || [],
    confidence: mapped.confidence || 0,
    matched: mapped.matched || [],
    matchedTokens: mapped.matchedTokens || [],
    allMatches: mapped.allMatches || [],
    chunks: mapped.chunks || [],
    ignoredTokens: mapped.ignoredTokens || [],
    ignoredText: mapped.ignoredText || "",
    mappingVersion: mapped.mappingVersion || "phase2-v1",
    nonStudy: false,
  };
}

/* -------------------- APP INIT -------------------- */

const app = express();

if (process.env.RAILWAY_ENVIRONMENT) {
  app.set("trust proxy", 1);
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = new Set([
  "https://www.mentorupsc.in",
  "https://mentorupsc.in",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// Lightweight request logger
app.use((req, res, next) => {
  if (req.path === '/api/sheets' || req.path === '/api/notifications/unread' || req.path === '/api/system/health') {
    console.log(`[REQ_LOG] ${req.method} ${req.path} origin=${req.headers.origin || 'none'}`);
  }
  next();
});

// Explicit allowed origins. PATCH must be listed for mistake/revision updates.

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, Railway health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    // In development fall through to allow all; in production, block unknown origins
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ✅ MUST BE HERE (TOP)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
// Protected upload serving — forwards /uploads/proofs to authenticated proof-file route
app.use("/uploads/proofs", (req, res, next) => {
  req.url = `/proof-file?file=${encodeURIComponent(req.path.replace(/^\//, ''))}`;
  return planBlockRoutes(req, res, next);
});
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* -------------------- MIDDLEWARE -------------------- */
app.use("/api/prelims-rebuilt", prelimsRebuiltDatasetRoute);
app.use("/api/prelims", prelimsAnalyticsRoute);
app.use("/api/prelims", prelimsDashboardRoute);
app.use("/api/auth", authRoutes);
app.use("/api", pyqRoutes);
app.use("/api/prelims/practice", prelimsPracticeRoute);
app.use("/api/prelims/pyq", prelimsPyqTestRoutes);
app.use("/api/blocks", blockResolveRoute);        // isolated block classification — no PYQ/CSAT side-effects

// ── Mistake, Revision & Weakness routes ──────────────────────────────────────
app.use("/api/mains-intelligence", mainsIntelligenceRoutes);
app.use("/api/mains/knowledge/review", mainsKnowledgeReviewRoutes);
app.use("/api/mistakes", mistakeRoutes);
app.use("/api/test-gemini", testGeminiRoute);
app.use("/api/evaluate-answer", evaluateAnswerRoute);
app.use("/api/answer-writing", answerWritingRoutes);
app.use("/api/air1-review", air1ReviewRoutes);
app.use("/api/mains-patterns", mainsPatternRoutes);
app.use("/api/mains-patterns", mainsRecommendationRoutes);
app.use("/api/revision-items", revisionRoutes);
app.use("/api/revision", revisionRoutes);   // alias — same router, both paths work
app.use("/api/weakness", weaknessRoutes);
app.use("/api/pyq", pyqExplanationRoutes);
app.use("/api/subject-pyq", subjectPyqRoutes);

//  Plan block lifecycle (PostgreSQL-backed, transaction-safe) 
app.use("/api/plan/blocks", planBlockRoutes);

// Mentor AI Call MVP
app.use("/api/mentor", mentorRoutes);
app.use("/api/daily-execution", executionRoutes);

// ── Study reports (PostgreSQL only, no Sheets / Calendar dependency) ────────
app.use("/api/reports", reportRoutes);

// ── Adaptive Planner Engine ──────────────────────────────────────────────────
app.use("/api/planner", plannerRoutes);

// ── Knowledge Linkage Engine (Phase 8) ───────────────────────────────────────
// Connects Study → PYQs → Mistakes → Revision → Planner
app.use("/api/knowledge", knowledgeLinkageRoutes);
app.use("/api/pyq-linkage", pyqLinkageRoutes);
app.use("/api/pyq-intelligence", pyqIntelligenceRoutes);
app.use("/api/adaptive", adaptiveRoutes);
app.use("/api/prelims-unified", prelimsUnifiedRoutes);
app.use("/api/prelims-tests", prelimsTestRoutes);

// ── PYQ Ingestion pipeline (Step 1: upload only) ───────────────────────────
// Isolated admin utility — does NOT touch existing PYQ master/index logic
app.use("/api/pyq-ingestion", pyqIngestionRoutes);

// ── Progress & Notification Engine ──────────────────────────────────────────
app.use("/api", progressRoutes);
app.use("/api/behaviour", behaviourRoutes);

// ── Discipline & Rescue System ────────────────────────────────────────────────
app.use("/api", whatsappWebhookRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/notifications", notificationRoutes);

import { sendTelegramMessage } from "./services/telegramService.js";

app.post("/api/notifications/test-telegram", async (req, res) => {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return res.status(400).json({ ok: false, error: "TELEGRAM_CHAT_ID not configured in .env" });
    }
    
    const success = await sendTelegramMessage(chatId, "🧪 *Test Message*\nThis is a test notification from UPSC Mentor.");
    if (success) {
      return res.json({ ok: true, message: "Test message sent to Telegram" });
    } else {
      return res.status(500).json({ ok: false, error: "Failed to send test message" });
    }
  } catch (err) {
    console.error("Test Telegram Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* -------------------- MAINS GS1 QUESTIONS API -------------------- */

// Cache on first call — no file I/O on every request
let _gs1Cache = null;
function getGs1Questions() {
  if (!_gs1Cache) _gs1Cache = loadGs1Questions();
  return _gs1Cache;
}

app.get("/api/mains/gs1/questions", (req, res) => {
  try {
    const questions = getGs1Questions();
    return res.json({ ok: true, count: questions.length, questions });
  } catch (err) {
    console.error("[mains/gs1] Failed to load questions:", err);
    return res.status(500).json({ ok: false, error: "Failed to load GS1 questions" });
  }
});

/* -------------------- MAINS GS1 TOPIC QUESTIONS API -------------------- */

let _gs1TopicCache = null;
function getGs1TopicQuestions() {
  if (!_gs1TopicCache) _gs1TopicCache = loadGs1TopicQuestions();
  return _gs1TopicCache;
}

app.get("/api/mains/gs1/topic-questions", (req, res) => {
  try {
    const questions = getGs1TopicQuestions();
    return res.json({ ok: true, count: questions.length, questions });
  } catch (err) {
    console.error("[mains/gs1/topic] Failed to load topic questions:", err);
    return res.status(500).json({ ok: false, error: "Failed to load GS1 topic questions" });
  }
});

/* -------------------- MAINS GS2 QUESTIONS API -------------------- */

let _gs2Cache = null;
function getGs2Questions() {
  if (!_gs2Cache) _gs2Cache = loadGs2Questions();
  return _gs2Cache;
}

app.get("/api/mains/gs2/questions", (req, res) => {
  try {
    const questions = getGs2Questions();
    return res.json({ ok: true, count: questions.length, questions });
  } catch (err) {
    console.error("[mains/gs2] Failed to load questions:", err);
    return res.status(500).json({ ok: false, error: "Failed to load GS2 questions" });
  }
});

/* -------------------- MAINS GS3 QUESTIONS API -------------------- */

let _gs3Cache = null;
function getGs3Questions() {
  if (!_gs3Cache) _gs3Cache = loadGs3Questions();
  return _gs3Cache;
}

/* -------------------- MAINS THEME INTELLIGENCE ROUTES -------------------- */
// Safe additive mount — no overlap with existing gs1/gs2/gs3 question routes
// because existing routes use /api/mains/gs*/questions (not /api/mains/themes or /api/mains/pyqs)
app.use("/api/mains", mainsThemeRoutes);

/* -------------------- MAINS REVIEW PIPELINE ROUTES -------------------- */
// Handles: POST attempt/save, POST review/save, POST review/process, GET review/result
// Safe mount — uses /api/mains/attempt/* and /api/mains/review/* (no conflict with theme/gs routes)
app.use("/api/mains", mainsReviewRoutes);

app.use("/api/mains/attempts", mainsAttemptsRoute);
app.use("/api/mains-answers", mainsAttemptsRoute);

/* -------------------- MAINS CLEAN DATASET ROUTES -------------------- */
// Backed by mains_master_clean_fixed.json via backend/loaders/mainsLoader.js
// Safe mount — uses /api/mains/questions (no conflict with theme/review/gs* routes)
app.use("/api/mains", mainsRoutes);

/* -------------------- MAINS INTELLIGENCE ROUTES -------------------- */
// Handles: POST /api/mains/evaluate for manual ChatGPT evaluation parsing and saving
// Saves to PostgreSQL mains_answer_evaluations table
// Safe mount — uses /api/mains/evaluate (no conflict with other mains routes)
app.use("/api/mains", mainsIntelligenceRoutes);

app.get("/api/mains/gs3/questions", (req, res) => {
  try {
    const questions = getGs3Questions();
    return res.json({ ok: true, count: questions.length, questions });
  } catch (err) {
    console.error("[mains/gs3] Failed to load questions:", err);
    return res.status(500).json({ ok: false, error: "Failed to load GS3 questions" });
  }
});

app.get("/api/syllabus/dashboard", async (_req, res) => {
  try {
    const progress = await computeSyllabusProgress();
    const summary = progress?.summary || {};
    const papers = Array.isArray(progress?.papers) ? progress.papers : [];

    const dashboard = {
      meta: {
        generatedAt: new Date().toISOString(),
        dateRange: "all",
        lastActivityAt:
          papers
            .map((p) => p.lastActivityAt)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
      },
      summary: {
        overallSyllabusCoveragePercent: summary.overallSyllabusCoveragePercent || 0,
        overallPyqCoveragePercent: summary.overallPyqCoveragePercent || 0,
        overallRevisionPercent: summary.overallRevisionPercent || 0,
        overallReadinessScore: summary.overallReadinessScore || 0,
        untouchedNodes: summary.untouchedNodes || 0,
        weakClusters: summary.weakClusters || 0,
      },
      papers,
      tableRows: papers.map((paper) => ({
        paperKey: paper.paperKey,
        paperLabel: paper.paperLabel,
        totalNodes: paper?.totals?.totalNodes || 0,
        touchedNodes: paper?.totals?.touchedNodes || 0,
        inProgressNodes: paper?.totals?.inProgressNodes || 0,
        coveredNodes: paper?.totals?.coveredNodes || 0,
        revisedNodes: paper?.totals?.revisedNodes || 0,
        masteredNodes: paper?.totals?.masteredNodes || 0,
        untouchedNodes: paper?.totals?.untouchedNodes || 0,
        totalPyqs: paper?.pyq?.totalPyqs || 0,
        attemptedPyqs: paper?.pyq?.attemptedPyqs || 0,
        correctPercent: paper?.pyq?.correctPercent || 0,
        revisedPyqs: paper?.pyq?.revisedPyqs || 0,
        sectionalTests: paper?.tests?.sectionalCount || 0,
        fullTests: paper?.tests?.fullTestCount || 0,
        institutionalTests: paper?.tests?.institutionalTestCount || 0,
        weakZones: paper?.weakZonesCount || 0,
        lastActivityAt: paper?.lastActivityAt || null,
        readinessScore: paper?.readinessScore || 0,
        status: paper?.status || "balanced",
      })),
      charts: {
        syllabusByPaper: papers.map((paper) => ({
          paper: paper.paperLabel,
          value: paper?.progress?.syllabusPercent || 0,
        })),
        pyqByPaper: papers.map((paper) => ({
          paper: paper.paperLabel,
          value: paper?.progress?.pyqPercent || 0,
        })),
      },
      weakZones: progress?.weakZones || [],
      untouchedZones: progress?.untouchedZones || [],
      recentActivity: progress?.recentActivity || [],
      nextActions: progress?.nextActions || [],
    };

    res.json(dashboard);
  } catch (err) {
    console.error("syllabus dashboard error", err);
    res.status(500).json({ error: "Failed to build syllabus dashboard" });
  }
});

app.use(express.json());
/* -------------------- FILE UPLOAD -------------------- */

const upload = multer({ storage: multer.memoryStorage() });

/* -------------------- OPENAI -------------------- */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Safe boot log — never prints the actual key value
console.log("[BOOT] OpenAI key loaded:", !!process.env.OPENAI_API_KEY);

/**
 * callOpenAIResponsesWithRetry
 * ─────────────────────────────────────────────────────────────────────────────
 * Calls the OpenAI Responses API using native fetch with:
 *   - compress: false  (prevents node-fetch gzip ERR_STREAM_PREMATURE_CLOSE)
 *   - Accept-Encoding: identity  (requests uncompressed response)
 *   - response.text() → JSON.parse()  (avoids response.json() on partial body)
 *   - Up to `attempts` retries on transient stream / network errors
 */
async function callOpenAIResponsesWithRetry(payload, attempts = 3) {
  let lastErr;

  for (let i = 1; i <= attempts; i++) {
    try {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "Accept-Encoding": "identity",
        },
        body: JSON.stringify(payload),
        compress: false,
      });

      const raw = await resp.text();

      if (!resp.ok) {
        console.error("[plan-photo OpenAI HTTP ERR]", resp.status, raw.slice(0, 1000));
        const err = new Error(`OpenAI HTTP ${resp.status}`);
        err.status = resp.status;
        err.raw = raw.slice(0, 500);
        throw err;
      }

      try {
        return JSON.parse(raw);
      } catch (parseErr) {
        console.error("[plan-photo OpenAI PARSE ERR]", raw.slice(0, 1000));
        const err = new Error("OpenAI returned invalid or partial JSON");
        err.cause = parseErr;
        throw err;
      }
    } catch (err) {
      lastErr = err;

      const msg  = String(err.message || "");
      const code = String(err.code || err.errno || "");

      const retryable =
        code.includes("ERR_STREAM_PREMATURE_CLOSE") ||
        code.includes("ETIMEDOUT") ||
        code.includes("ECONNRESET") ||
        msg.includes("Premature close") ||
        msg.includes("fetch failed");

      console.error(`[plan-photo OpenAI retry ${i}/${attempts}]`, {
        message: err.message,
        code: err.code || err.errno,
        retryable,
      });

      if (!retryable || i === attempts) break;

      // Linear backoff: 1 s, 2 s, …
      await new Promise((resolve) => setTimeout(resolve, 1000 * i));
    }
  }

  throw lastErr;
}

/* -------------------- HEALTH ROUTE -------------------- */

import { execSync } from "child_process";
let RUNNING_COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_COMMIT_SHA || "";
if (!RUNNING_COMMIT_SHA) {
  try {
    RUNNING_COMMIT_SHA = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (e) {
    RUNNING_COMMIT_SHA = "unknown";
  }
}

app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch (err) {
    // Log internally; never expose raw error details to callers.
    console.error("[Health] DB liveness check failed:", err.message);
  }
  return res.status(dbOk ? 200 : 503).json({
    ok:     dbOk,
    status: dbOk ? "healthy" : "unhealthy",
  });
});

/* ── Production guard: blocks diagnostic routes in production ────────────── */
// Returns 404 (not 403) so internal route structure is not disclosed.
import { rejectInProduction } from './utils/productionGuard.js';

/* -------------------- DEBUG DB CHECK (internal only) -------------------- */

app.get("/api/debug/db-check", rejectInProduction, async (req, res) => {
  const results = {};

  // 0) Network Diagnostics
  results.diagnostics = {};

  // DNS resolve postgres.railway.internal
  try {
    const dns = await import("dns/promises");
    const ips = await dns.resolve("postgres.railway.internal");
    results.diagnostics.postgres_internal_ips = ips;
  } catch (err) {
    results.diagnostics.postgres_internal_dns_error = err.message || String(err);
  }

  // DNS resolve maglev.proxy.rlwy.net
  try {
    const dns = await import("dns/promises");
    const ips = await dns.resolve("maglev.proxy.rlwy.net");
    results.diagnostics.postgres_public_ips = ips;
  } catch (err) {
    results.diagnostics.postgres_public_dns_error = err.message || String(err);
  }

  // TCP connection check postgres.railway.internal:5432
  try {
    const net = await import("net");
    const connectPromise = new Promise((resolve, reject) => {
      const socket = net.connect(5432, "postgres.railway.internal");
      socket.setTimeout(2500);
      socket.on("connect", () => {
        socket.destroy();
        resolve("connected");
      });
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("timeout"));
      });
      socket.on("error", (err) => {
        socket.destroy();
        reject(err);
      });
    });
    results.diagnostics.postgres_internal_tcp = await connectPromise;
  } catch (err) {
    results.diagnostics.postgres_internal_tcp_error = err.message || String(err);
  }

  // TCP connection check maglev.proxy.rlwy.net:47713
  try {
    const net = await import("net");
    const connectPromise = new Promise((resolve, reject) => {
      const socket = net.connect(47713, "maglev.proxy.rlwy.net");
      socket.setTimeout(2500);
      socket.on("connect", () => {
        socket.destroy();
        resolve("connected");
      });
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("timeout"));
      });
      socket.on("error", (err) => {
        socket.destroy();
        reject(err);
      });
    });
    results.diagnostics.postgres_public_tcp = await connectPromise;
  } catch (err) {
    results.diagnostics.postgres_public_tcp_error = err.message || String(err);
  }

  // 1) basic connection
  try {
    const r = await query("SELECT NOW() AS now");
    results.connected = true;
    results.server_time = r.rows[0].now;
  } catch (err) {
    results.connected = false;
    results.connect_error = {
      message: err.message || "(empty)",
      code: err.code,
      detail: err.detail,
      hint: err.hint,
    };
    return res.status(503).json({ ok: false, ...results });
  }

  // 2) table existence + row counts
  const tables = ["mistakes", "revision_items"];
  results.tables = {};

  for (const table of tables) {
    try {
      const exists = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table]
      );
      const tableExists = exists.rows[0].exists;
      results.tables[table] = { exists: tableExists };

      if (tableExists) {
        const count = await query(`SELECT COUNT(*) AS n FROM "${table}"`);
        results.tables[table].row_count = Number(count.rows[0].n);
      }
    } catch (err) {
      results.tables[table] = {
        exists: "error",
        error: err.message || err.code || String(err),
      };
    }
  }

  res.json({
    ok: true,
    activeDbHost,
    activeDbPort,
    activeDbSsl,
    activeDbSource,
    ...results
  });
});

app.post("/alexa/ping", (req, res) => {
  console.log("Alexa ping received on cloud");
  return res.json({
    ok: true,
    speech: "Mentor backend connected successfully version 2.",
  });
});

/* -------------------- SYLLABUS API -------------------- */

app.get("/api/syllabus", (req, res) => {
  try {
    res.json(SYLLABUS_GRAPH_2026);
  } catch (err) {
    console.error("[Syllabus API Error]", err);
    res.status(500).json({ ok: false, error: "Failed to load syllabus" });
  }
});

app.post("/api/loop-detect", requireAuth, (req, res) => {
  try {
    const out = detectLoops(req.body || {});
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});

/* -------------------- PYQ NODE API -------------------- */
// Uses getPyqSummaryForNode which goes through the full alias-aware
// resolveInputToLookupNodeIds chain (family anchors, syllabus registry,
// prefix-descendant map). This correctly resolves parent nodes like
// GS2-POLITY-FR whose children may be stored under aliased keys.
app.get("/api/pyq/node/:nodeId", (req, res) => {
  try {
    const { nodeId } = req.params;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: "nodeId is required",
      });
    }

    // getPyqSummaryForNode handles: exact match, family aliases, leaf descendants,
    // prefix-descendant fallback. Limit 0 = return all questions.
    const summary = getPyqSummaryForNode(nodeId, 0);
    const resolution = explainPyqResolution(nodeId);

    console.log("[PYQ NODE API]", {
      requestedNodeId: nodeId,
      lookupNodeIds: summary.lookupNodeIds,
      total: summary.total,
    });

    return res.json({
      success: true,
      nodeId,
      matchedNodeId: summary.matchedNodeId,
      matchedNodeIds: summary.lookupNodeIds,
      counts: {
        total:    summary.total,
        prelims:  summary.prelimsCount,
        mains:    summary.mainsCount,
        essay:    summary.essayCount,
        ethics:   summary.ethicsCount,
        optional: summary.optionalCount,
        csat:     summary.csatCount,
      },
      lastAskedYear: summary.lastAskedYear,
      resolution,
      questions: summary.questions,
    });
  } catch (err) {
    console.error("PYQ node API failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load PYQ node data",
      error: String(err?.message || err),
    });
  }
});

/* -------------------- PHOTO → PLAN PARSE (TIME BLOCKS) -------------------- */
/* IMPORTANT UX RULE:
   This route only PARSES + ENRICHES + RETURNS PREVIEW.
   It does NOT register reminders / save / trigger downstream actions.
   Approval must happen on frontend before calling save/register routes.
*/

app.post("/api/plan-photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No photo uploaded" });
    }

    const providedDate = String(req.body?.date || "").trim();
    const dateFallback = providedDate || todayISODate();

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const userPrompt = `
Extract UPSC study sessions from the image as TIME BLOCKS.

IMPORTANT: Include ONLY academic study sessions.
Skip and IGNORE all non-study entries such as:
  breaks, lunch, dinner, breakfast, hospital, clinic, doctor,
  travel, commute, sleep, nap, rest, bath, prayer, yoga, puja,
  exercise, gym, walk, personal work, family time, free time,
  office, college (as institution), class (non-UPSC), school.

Return ONLY valid JSON — no markdown, no code fences, no explanation text.
Do NOT wrap the output in triple backticks or any code block markers.

JSON schema (respond with exactly this structure):
{
  "ok": true,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "subject": "string",
      "topic": "string",
      "activity": "string",
      "targetValue": number or null,
      "targetUnit": "string",
      "minutes": number
    }
  ],
  "totalMinutes": number
}

RULES:
1) Each item must be a real UPSC study session (e.g., Polity, CSAT, Geography, History, Economy, Ethics, Essay, Current Affairs, PYQ, Mains, Revision, Answer Writing, Optional).
2) Each item must contain:
   - startTime: "HH:MM" (24-hour) or "" if not visible
   - endTime: "HH:MM" (24-hour) or "" if not visible
   - subject: short subject label
   - topic: specific topic text (do not include activity here)
   - activity: e.g. "PYQ_ANSWER_WRITING", "READING", "REVISION", "MOCK_TEST". If unknown, use "STUDY".
   - targetValue: number of items targeted (e.g., 5 for "5 PYQs") or null if not applicable.
   - targetUnit: e.g. "PYQs", "Chapters", "Pages", or "" if not applicable.
   - minutes: integer minutes
3) If minutes not explicitly written, compute:
   minutes = difference between endTime and startTime (if both exist).
4) If only startTime exists and minutes exist, you may leave endTime as "".
5) If times are written in formats like "4 40", "4:40", "04.40", normalize to "04:40".
6) Keep subject/topic clean, no emojis.
7) date: if not present in image, use "${dateFallback}".
8) totalMinutes: sum of item.minutes for study items only.
9) If no study blocks are found, return: {"ok":true,"date":"${dateFallback}","items":[],"totalMinutes":0}

Output ONLY the JSON object. No preamble. No trailing text.
`.trim();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        ok: { type: "boolean" },
        date: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              startTime: { type: "string" },
              endTime: { type: "string" },
              subject: { type: "string" },
              topic: { type: "string" },
              activity: { type: "string" },
              targetValue: { type: ["number", "null"] },
              targetUnit: { type: "string" },
              minutes: { type: "number" },
            },
            required: ["startTime", "endTime", "subject", "topic", "activity", "minutes"],
          },
        },
        totalMinutes: { type: "number" },
      },
      required: ["ok", "date", "items", "totalMinutes"],
    };

    // ── OpenAI Responses API call (with retry + stream-safe fetch) ──────────
    let aiResponse;
    try {
      aiResponse = await callOpenAIResponsesWithRetry({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: "You are a strict JSON extraction engine. Output only JSON.",
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "plan_photo_timeblocks",
            strict: true,
            schema,
          },
        },
      });
    } catch (aiErr) {
      console.error("[plan-photo ERR] OpenAI call failed after retries:", aiErr.message);
      return res.status(502).json({
        ok: false,
        error: "OpenAI request failed",
        detail: String(aiErr.message || aiErr),
      });
    }

    // ── Extract text from all known Responses API shapes ───────────────────
    // Shape A: response.output_text  (SDK shortcut field)
    // Shape B: response.output[0].content[0].text  (raw REST shape)
    let outText =
      aiResponse?.output_text ||
      aiResponse?.output?.[0]?.content?.[0]?.text ||
      "";

    // Always log a safe preview so we can see what the model actually returned
    console.log("[plan-photo RAW MODEL OUTPUT]", String(outText || "").slice(0, 2000));

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const stripped = String(outText || "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    if (stripped) outText = stripped;

    let parsed;
    try {
      parsed = JSON.parse(outText);
    } catch (parseErr) {
      console.error(
        "[plan-photo ERR] Could not parse model output:",
        String(outText || "").slice(0, 2000)
      );
      // Also log the raw aiResponse shape so we can diagnose missing output_text
      console.error(
        "[plan-photo ERR] Raw aiResponse keys:",
        Object.keys(aiResponse || {})
      );
      return res.status(400).json({
        ok: false,
        error: "Model did not return valid JSON",
        detail: String(outText || "").slice(0, 500) || "Model returned empty output",
      });
    }

    // ── Deterministic non-study filter ────────────────────────────────────────
    // Applied AFTER model output is parsed. Do not rely solely on the prompt.
    const originalItems = Array.isArray(parsed.items) ? parsed.items : [];
    const studyItems = originalItems.filter(isStudyBlock);

    console.log("[plan-photo FILTER]", {
      originalCount: originalItems.length,
      studyCount: studyItems.length,
      ignoredCount: originalItems.length - studyItems.length,
      ignored: originalItems
        .filter((it) => !isStudyBlock(it))
        .map((it) => `${it.subject} / ${it.topic}`),
    });

    parsed.items = studyItems;
    parsed.totalMinutes = studyItems.reduce(
      (sum, it) => sum + Number(it.minutes || 0),
      0
    );

    const safeDate = String(parsed.date || "").trim() || dateFallback;
    let items = Array.isArray(parsed.items) ? parsed.items : [];

    items = items.map((it) => {
      let subject = String(it.subject || "Unknown").trim() || "Unknown";
      let topic = String(it.topic || "").trim();

      const subjLower = subject.toLowerCase();
      const topicLower = topic.toLowerCase();

      const isCA =
        subjLower.includes("current affairs") ||
        subjLower === "ca" ||
        topicLower === "ca" ||
        topicLower === "[ca]" ||
        topicLower.includes("current affairs");

      if (isCA) {
        subject = "Current Affairs";
        if (!topic || topicLower === "ca" || topicLower === "[ca]") {
          topic = "Daily CA";
        } else {
          topic = topic.replace(/\[ca\]/gi, "").trim() || "Daily CA";
        }
      }

      return {
        startTime: it.startTime || "",
        endTime: it.endTime || "",
        subject,
        topic,
        activity: it.activity || "",
        targetValue: it.targetValue !== undefined ? it.targetValue : null,
        targetUnit: it.targetUnit || "",
        minutes: Number(it.minutes || 0),
      };
    });

    items = inferCorrectTimeSequence(items);

    items = items.map((it) => {
      let mins = safeNum(it.minutes, 0);
      if (!mins || mins <= 0) {
         mins = 120;
      }
      return { ...it, minutes: Math.max(0, Math.round(mins)) };
    });

    items = markOverlaps(items);

    const tr = daysToPrelims(new Date());
    const kill = killSwitchMode(tr);

    function inferStudyMode(subj = "", top = "") {
      const text = `${subj} ${top}`.toLowerCase();
      
      if (text.includes("news") || text.includes("hindu") || text.includes("current affairs") || text.includes("newspaper") || text.includes("ca ")) {
        return "current_affairs_tagging";
      }
      if (text.includes("revision") || text.includes("revise") || text.includes("recall") || text.includes("sheet")) {
        return "revision";
      }
      if (text.includes("pyq")) {
        if (text.includes("practice") || text.includes("solve")) return "practice";
        return "pyq_revision";
      }
      if (
        text.includes("practice") ||
        text.includes("solve") ||
        text.includes("drill") ||
        text.includes("mcq") ||
        text.includes("test") ||
        text.includes("mock") ||
        text.includes("writing") ||
        text.includes("answer")
      ) {
        return "practice";
      }
      return "study";
    }

    const enrichedItems = items.map((rawIt, itemIndex) => {
      const item = { ...rawIt };

      const ocrInput = `${item.subject || ""} ${item.topic || ""}`.trim();
      let mappingResult;
      try {
        mappingResult = processOcrText(ocrInput, { minutes: item.minutes || 0 });
      } catch (err) {
        console.error(`[processOcrText ERR] Failed to parse input: "${ocrInput}"`, err);
        mappingResult = {
          rawText: ocrInput,
          cleanedText: ocrInput,
          stage: "general",
          gsPaper: null,
          subjectId: null,
          subjectName: item.subject || "Unknown",
          nodeId: null,
          nodeName: "Unmapped",
          resolverConfidence: 0,
          confidenceBadge: "LOW",
          mappingSource: "NONE",
          isApproved: false,
          isMiscGen: false,
          subjectCandidates: [],
          topicCandidates: [],
          textQuality: "ACCEPTABLE",
          warnings: ["PARSE_EXCEPTION"],
        };
      }

      // Guard: Do not force vague generic entries into specific nodes
      const genericTerms = ["pyq", "pyqs", "revision", "the hindu", "news", "current affairs", "ca", "day revision", "practice", "mcq", "newspaper", "daily"];
      const isGenericText = genericTerms.some(t => ocrInput.toLowerCase().includes(t)) && ocrInput.split(" ").length <= 5;
      
      if (isGenericText && (mappingResult.confidenceBadge === "LOW" || mappingResult.confidenceBadge === "MEDIUM")) {
        mappingResult.nodeId = null;
        mappingResult.nodeName = "Unmapped";
        mappingResult.resolverConfidence = 0;
        mappingResult.confidenceBadge = "LOW";
      }

      let linkedPyqs = { total: 0, mappedNodes: [] };
      // Try confirmed nodeId first, then scan all top candidates for best PYQ coverage
      const candidateNodeIds = [
        mappingResult.nodeId,
        ...(mappingResult.topicCandidates || []).map(c => c.nodeId),
      ].filter(Boolean);

      for (const cid of candidateNodeIds) {
        try {
          const result = getPyqSummaryForNode(cid, 500);
          if (result.total > linkedPyqs.total) {
            linkedPyqs = result;
          }
          if (mappingResult.nodeId && cid === mappingResult.nodeId && linkedPyqs.total > 0) break; // confirmed match, stop
        } catch (e) {
          console.error("[plan-photo PYQ load error]", e);
        }
      }
      // Also try subject-level fallback if nothing found
      if (linkedPyqs.total === 0 && mappingResult.subjectCandidates?.[0]?.subjectId) {
        try {
          const r = getPyqSummaryForNode(mappingResult.subjectCandidates[0].subjectId, 500);
          if (r.total > 0) { linkedPyqs = r; }
        } catch (e) { }
      }
      // Final fallback: walk parent prefixes of top candidate (e.g. GS3-ECO-BANKING-MT03 → GS3-ECO-BANKING → GS3-ECO)
      if (linkedPyqs.total === 0 && candidateNodeIds[0]) {
        const parts = candidateNodeIds[0].split("-");
        for (let len = parts.length - 1; len >= 2; len--) {
          const prefix = parts.slice(0, len).join("-");
          try {
            const r = getPyqSummaryForNode(prefix, 500);
            if (r.total > 0) { linkedPyqs = r; break; }
          } catch (e) { }
        }
      }
      // pyqNodeLinked must ONLY be the confidently-mapped node from the OCR pipeline.
      // bestLookupNodeId is used only for linkedPyqs data (PYQ count/panel), never for display.
      // Mains blocks, mixed PYQ blocks, or any block with ambiguous topic → nodeId = null.
      const resolvedNodeId = mappingResult.nodeId || null;

      const finalMapping = {
        subjectId: mappingResult.subjectId,
        subjectName: mappingResult.subjectName,
        nodeId: resolvedNodeId,
        nodeName: mappingResult.nodeName !== "Unmapped" ? mappingResult.nodeName : (mappingResult.topicCandidates?.[0]?.nodeName || mappingResult.nodeName),
        mappingSource: mappingResult.mappingSource,
        resolverConfidence: mappingResult.resolverConfidence,
        isApproved: mappingResult.isApproved,
      };

      const itemMode = inferStudyMode(item.subject, item.topic);
      let itemOutputExpected = "";
      if (itemMode === "practice") {
        itemOutputExpected = "Questions solved and reviewed";
      } else if (itemMode === "revision") {
        itemOutputExpected = "Key concepts revised";
      } else {
        itemOutputExpected = "Study goals completed";
      }

      const rawText = `${item.startTime || ""} - ${item.endTime || ""} ${item.subject || ""} - ${item.topic || ""}`.trim();

      // Log Stage 1 OCR parsed block
      if (itemIndex === 0) {
        console.log("[STAGE 1] OCR parsed block:", {
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          topic: item.topic,
          minutes: item.minutes,
          mode: itemMode,
          rawText,
          syllabusNodeId: resolvedNodeId
        });
      }

      const targetStr = (item.targetValue && item.targetUnit) ? `${item.targetValue} ${item.targetUnit}` : "";
      
      return {
        ...item,
        // Override OCR extraction with canonical mapping to preserve hierarchy: Subject -> Topic
        subject: (mappingResult.subjectName && mappingResult.subjectName !== "Unknown" && mappingResult.subjectName !== "Unmapped") 
          ? mappingResult.subjectName 
          : (item.subject || "Unknown"),
        topic: (resolvedNodeId && mappingResult.nodeName && mappingResult.nodeName !== "Unmapped") 
          ? mappingResult.nodeName 
          : (item.topic || ""),
        finalMapping,
        subjectCandidates: mappingResult.subjectCandidates,
        topicCandidates: mappingResult.topicCandidates,
        textQuality: mappingResult.textQuality,
        confidenceBadge: mappingResult.confidenceBadge,
        linkedPyqs,
        // Phase 2A fields: Map OCR activity to mode, OCR target to outputExpected
        mode: item.activity || itemMode,
        outputExpected: targetStr || itemOutputExpected,
        rawText,
        subtopic: mappingResult.nodeName !== "Unmapped" ? mappingResult.nodeName : "",
        syllabusNodeId: resolvedNodeId,
        needsTimeConfirmation: item.needsTimeConfirmation || false
      };
    });

    const totalMinutes = enrichedItems.reduce(
      (sum, x) => sum + (Number(x.minutes) || 0),
      0
    );

    const csatDrill = enrichedItems.some((x) => x.nodeId && x.nodeId.startsWith("CSAT-BN")) ? "CHECK_NUMERACY" : "NONE";

    const reminderPreview = enrichedItems
      .filter((it) => it.startTime)
      .map((it, idx) => ({
        blockId: `B${idx + 1}`,
        label: blockLabelFromIndex(idx),
        subject: it.subject || "Study",
        topic: it.topic || "",
        startTime: toISOWithDate(safeDate, it.startTime),
        endTime: it.endTime ? toISOWithDate(safeDate, it.endTime) : "",
        plannedMinutes: Number(it.minutes || 0),
        syllabusNodeId: it.nodeId || null,
        confidence: it.resolverConfidence || 0,
      }));

    return res.json({
      ok: true,
      date: safeDate,
      items: enrichedItems,
      totalMinutes,
      daysToPrelims: tr,
      killSwitchMode: kill,
      csatDrill,
      approvalRequired: true,
      reminderEngine: {
        ok: true,
        registeredBlocks: 0,
        blocks: [],
        previewBlocks: reminderPreview,
        message: "OCR parsed successfully. Approval required before save/calendar/reminder registration.",
      },
    });
  } catch (err) {
    console.error("[plan-photo ERR]", err);
    return res.status(500).json({
      ok: false,
      error: "plan-photo internal error",
      detail: String(err?.message || err),
    });
  }
});

/* -------------------- TEXT → MICROTHEME MAP -------------------- */

app.post("/api/map-text", requireAuth, upload.none(), (req, res) => {
  try {
    let text = "";

    if (req.body?.data) {
      const payload = JSON.parse(req.body.data);
      text = String(payload?.text || "").trim();
    } else {
      text = String(req.body?.text || "").trim();
    }

    if (!text) {
      return res.status(400).json({ ok: false, message: "text is required" });
    }

    const matches = findTopMicroThemes(text, 3);
    const mapping = matches?.[0] || findMicroTheme(text);

    return res.json({
      ok: true,
      input: text,
      mapping,
      matches,
    });
  } catch (err) {
    console.error("[map-text ERR]", err);
    return res.status(500).json({ ok: false, message: "map-text failed" });
  }
});

/* -------------------- ANALYZE DAY -------------------- */

app.post("/api/analyze-day", requireAuth, (req, res) => {
  try {
    const date = String(req.body?.date || "").trim();

    const planMin = safeNum(req.body?.planMin ?? req.body?.plannedMin ?? 0, 0);
    const doneMin = safeNum(req.body?.doneMin ?? 0, 0);
    const csatMin = safeNum(req.body?.csatMin ?? 0, 0);

    const reflection = String(req.body?.reflection || "").trim();
    if (!reflection) {
      return res
        .status(400)
        .json({ ok: false, message: "reflection is required" });
    }

    const matches = findTopMicroThemes(reflection, 3);
    const mapping = matches?.[0] || findMicroTheme(reflection);

    const advice = buildDailyAdvice({
      date,
      planMin,
      doneMin,
      csatMin,
      matches,
      mapping,
    });

    return res.json({
      ok: true,
      input: reflection,
      mapping,
      matches,
      advice,
    });
  } catch (err) {
    console.error("[analyze-day ERR]", err);
    return res
      .status(500)
      .json({ ok: false, message: String(err?.message || err) });
  }
});

/* -------------------- SYLLABUS PROGRESS -------------------- */

app.post("/api/syllabus-progress", requireAuth, (req, res) => {
  try {
    const { blocks = [] } = req.body || {};
    const out = computeSyllabusProgress(blocks);
    return res.json({ ok: true, ...out });
  } catch (err) {
    console.error("syllabus-progress failed", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "syllabus-progress failed",
    });
  }
});

/* -------------------- REMINDER ENGINE API -------------------- */
/* Call this only AFTER OCR approval / manual confirmation */

app.post("/api/schedule/register", requireAuth, (req, res) => {
  try {
    const { dayKey, userId, blocks } = req.body || {};

    if (!dayKey || !Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "dayKey and blocks are required",
      });
    }

    const saved = registerDaySchedule({ dayKey, userId, blocks });

    return res.json({
      ok: true,
      dayKey,
      blocks: saved,
    });
  } catch (err) {
    console.error("[schedule/register ERR]", err);
    return res.status(500).json({
      ok: false,
      message: String(err?.message || err),
    });
  }
});

app.post("/api/block/start", (req, res) => {
  try {
    const result = startBlock(req.body || {});
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("[block/start ERR]", err);
    return res.status(500).json({
      ok: false,
      message: String(err?.message || err),
    });
  }
});

app.post("/api/block/complete", (req, res) => {
  try {
    const result = completeBlock(req.body || {});
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("[block/complete ERR]", err);
    return res.status(500).json({
      ok: false,
      message: String(err?.message || err),
    });
  }
});

app.get("/api/day/:dayKey", (req, res) => {
  try {
    return res.json({
      ok: true,
      day: getDay(req.params.dayKey),
    });
  } catch (err) {
    console.error("[day/get ERR]", err);
    return res.status(500).json({
      ok: false,
      message: String(err?.message || err),
    });
  }
});

/* -------------------- PROXY: FRONTEND -> BACKEND -> APPS SCRIPT (NO CORS) -------------------- */
/* Lifecycle actions (startBlock / pauseBlock / resumeBlock / completeBlock) are intercepted     */
/* here and routed to PostgreSQL instead of Google Sheets.  getBlocksForDate is enriched with    */
/* PostgreSQL-derived timing values before being returned.  All other actions proxy to GAS.      */

const LIFECYCLE_ACTIONS = new Set([
  "startBlock", "pauseBlock", "resumeBlock", "completeBlock", "stopBlock",
  "markDone", "markMissed", "skipBlock"
]);
const DEFAULT_PLAN_USER = process.env.DEFAULT_USER_ID || "moulika";

async function proxyToGas(payload, scriptUrl) {
  const body = new URLSearchParams();
  body.set("data", JSON.stringify(payload));
  const r = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

app.post("/api/sheets", requireAuth, async (req, res) => {
  try {
    const scriptUrl = String(process.env.SCRIPT_URL || "").trim();
    const payload   = req.body || {};
    const action    = String(payload.action || "").trim();

    if (!action) {
      return res.status(400).json({ ok: false, message: "Missing action" });
    }

    const userId = req.user?.id || "moulika";
    payload.userId = userId; // Override payload identity to ensure GAS receives the authenticated user

    // ── INTERCEPT: saveScheduleBlocks → PostgreSQL ───────────────────────────
    if (action === "saveScheduleBlocks") {
      const { date, items = [] } = payload;
      if (!date || !Array.isArray(items)) {
        return res.status(400).json({ ok: false, message: "Missing date or items array" });
      }

      try {
        console.log("[DEBUG PLAN] Backend received block preview (first item):", items[0]);
        const { savePlanBlocksAndLogEvents } = await import("./services/blockLifecycleService.js");
        await savePlanBlocksAndLogEvents(userId, date, items);

        if (scriptUrl) {
          proxyToGas(payload, scriptUrl).catch((err) =>
            console.warn("[sheets proxy] saveScheduleBlocks background GAS sync failed:", err.message)
          );
        }

        return res.json({ ok: true, message: "Blocks saved to database and events logged." });
      } catch (err) {
        console.error("[sheets interceptor saveScheduleBlocks]", err.message);
        return res.status(500).json({ ok: false, message: err.message, dbError: err.message, stack: err.stack });
      }
    }

    // ── INTERCEPT: lifecycle → PostgreSQL ────────────────────────────────────
    if (LIFECYCLE_ACTIONS.has(action)) {
      const p = payload.payload || {};   // frontend wraps args in payload.payload
      const blockId = p.blockId;
      const dayKey  = p.dayKey || (payload.date ? String(payload.date).slice(0, 10) : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

      if (!blockId) {
        return res.status(400).json({ ok: false, message: "Missing blockId" });
      }

      try {
        let block;
        if (action === "startBlock") {
          console.log(`[PlanUI] action=startBlock blockId=${blockId}`);
          block = await dbStartBlock(userId, blockId, dayKey, {
            title:          p.title    || "",
            subject:        p.subject  || "",
            topic:          p.topic    || "",
            plannedStart:   p.plannedStart  || "",
            plannedEnd:     p.plannedEnd    || "",
            plannedMinutes: Number(p.plannedMinutes || 0),
          });
          syncBlockToCalendar(block, "start").catch(() => {});

        } else if (action === "pauseBlock") {
          console.log(`[PlanUI] action=pauseBlock blockId=${blockId}`);
          block = await dbPauseBlock(userId, blockId, dayKey);
          syncBlockToCalendar(block, "pause").catch(() => {});

        } else if (action === "resumeBlock") {
          console.log(`[PlanUI] action=resumeBlock blockId=${blockId}`);
          block = await dbResumeBlock(userId, blockId, dayKey);
          syncBlockToCalendar(block, "resume").catch(() => {});

        } else if (action === "completeBlock" || action === "markDone") {
          console.log(`[PlanUI] action=${action} blockId=${blockId}`);
          const reason = p.completionStatus || p.reason || "completed";
          block = await dbCompleteBlock(userId, blockId, dayKey, { reason, actualMinutes: p.actualMinutes });
          syncBlockToCalendar(block, "complete").catch(() => {});
        } else if (action === "markMissed") {
          console.log(`[PlanUI] action=markMissed blockId=${blockId}`);
          block = await dbCompleteBlock(userId, blockId, dayKey, { reason: "missed" });
        } else if (action === "skipBlock") {
          console.log(`[PlanUI] action=skipBlock blockId=${blockId}`);
          block = await dbCompleteBlock(userId, blockId, dayKey, { reason: "skipped" });
        } else if (action === "stopBlock") {
          console.log(`[PlanUI] action=stopBlock blockId=${blockId}`);
          block = await dbStopBlock(userId, blockId, dayKey);
          syncBlockToCalendar(block, "complete").catch(() => {});
        }

        // Also fire GAS in background so Sheets stay loosely in sync (analytics/logs)
        if (scriptUrl) {
          proxyToGas(payload, scriptUrl).catch((err) =>
            console.warn("[sheets proxy] background GAS sync failed:", err.message)
          );
        }

        return res.json({ ok: true, block });

      } catch (err) {
        console.error(`[sheets interceptor ${action}]`, err.message);
        const status = err.code === "RACE_CONDITION" ? 409
                     : err.code === "STALE_ACTIVE_SESSION" ? 409
                     : err.code === "INVALID_TRANSITION" ? 422
                     : err.code === "PROOF_REQUIRED" ? 422
                     : 500;
        const payloadOut = {
          ok: false, message: err.message, code: err.code, dbError: err.message, stack: err.stack
        };
        if (err.code === 'STALE_ACTIVE_SESSION' && err.staleBlock) {
          payloadOut.staleBlock = err.staleBlock;
        }
        return res.status(status).json(payloadOut);
      }
    }

    // ── INTERCEPT: getBlocksForDate → enrich with PostgreSQL lifecycle ────────
    if (action === "getBlocksForDate") {
      if (!scriptUrl) {
        return res.status(500).json({ ok: false, message: "Missing SCRIPT_URL in backend .env" });
      }
      const gasResult = await proxyToGas(payload, scriptUrl);
      const dayKey = String(payload.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).slice(0, 10);

      if (Array.isArray(gasResult?.blocks) && gasResult.blocks.length) {
        try {
          gasResult.blocks = await mergeLifecycleIntoGasBlocks(gasResult.blocks, userId, dayKey);
        } catch (mergeErr) {
          // Non-fatal: return un-merged GAS data rather than 500
          console.error("[sheets getBlocksForDate merge]", mergeErr.message);
        }
      }
      return res.status(200).json(gasResult);
    }

    // ── Default: proxy everything else to GAS ─────────────────────────────────
    if (!scriptUrl) {
      return res.status(500).json({ ok: false, message: "Missing SCRIPT_URL in backend .env" });
    }
    const result = await proxyToGas(payload, scriptUrl);
    return res.status(200).json(result);

  } catch (e) {
    console.error("[api/sheets ERR]", e);
    return res.status(500).json({ ok: false, message: String(e?.message || e), dbError: String(e?.message || e), stack: e?.stack });
  }
});

/* ── RC SUBTOPICS ── classified RC subtopic buckets with real question counts ── */
app.get("/api/prelims/csat/rc-subtopics", (_req, res) => {
  try {
    const subtopics = getRcSubtopicSummary();
    return res.json({ ok: true, subtopics });
  } catch (err) {
    console.error("❌ getRcSubtopics error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post("/api/prelims/csat/rc-reset", (_req, res) => {
  resetRcCache();
  const subtopics = getRcSubtopicSummary();
  return res.json({ ok: true, message: "RC cache rebuilt", subtopics });
});

/* ── GS COUNTS ── returns actual buildable question counts from raw files ── */
app.get("/api/prelims/gs/counts", (_req, res) => {
  try {
    const counts = getGSCounts();
    return res.json({ ok: true, counts });
  } catch (err) {
    console.error("❌ getGSCounts error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.get("/api/prelims/csat/counts", (_req, res) => {
  try {
    const { quant, lr, rc } = loadCSATData();
    return res.json({
      ok: true,
      counts: {
        csat_quant:     quant.length,
        csat_reasoning: lr.length,
        csat_rc:        rc.length,
      },
    });
  } catch (err) {
    console.error("❌ CSAT counts error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

/* ── FULL-LENGTH YEARS ── returns available years for each paper type ── */
app.get("/api/prelims/full-length/years", (_req, res) => {
  try {
    const gsData = loadGSData();
    const csatData = loadCSATData();
    const fullLengthPapers = readPrelimsFullLengthPapers();
    const availableFullLengthYears = [...new Set(fullLengthPapers.map((paper) => paper.year))]
      .sort((a, b) => b - a);

    // Flatten GS data
    const allGSQuestions = [];
    for (const subjectQuestions of Object.values(gsData)) {
      allGSQuestions.push(...subjectQuestions);
    }

    // Flatten CSAT data
    const allCSATQuestions = [...csatData.quant, ...csatData.lr, ...csatData.rc];

    const gsYears = getAvailableFullLengthYears(allGSQuestions, "GS");
    const csatYears = getAvailableFullLengthYears(allCSATQuestions, "CSAT");

    return res.json({
      ok: true,
      gs: gsYears.sort((a, b) => a - b),
      csat: csatYears.sort((a, b) => a - b),
      availableFullLengthYears,
      fullLengthPapers,
    });
  } catch (err) {
    console.error("❌ getAvailableYears error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.get("/api/prelims/years", (_req, res) => {
  try {
    const csatData = loadCSATData();
    const fullLengthPapers = readPrelimsFullLengthPapers();
    const availableFullLengthYears = [...new Set(fullLengthPapers.map((paper) => paper.year))]
      .sort((a, b) => b - a);
    const allCSAT = [...csatData.lr, ...csatData.quant, ...csatData.rc];
    const csatYears = [...new Set(
      allCSAT.map((q) => Number(q.year)).filter((year) => Number.isFinite(year) && year > 1980)
    )].sort((a, b) => a - b);

    console.log("[Prelims FullLength] API years:", availableFullLengthYears);

    return res.json({
      ok: true,
      gs: [...availableFullLengthYears].sort((a, b) => a - b),
      csat: csatYears,
      availableFullLengthYears,
      fullLengthPapers,
    });
  } catch (err) {
    console.error("/api/prelims/years error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});
app.get("/api/db-check", async (req, res) => {
  try {
    const result = await query("SELECT NOW() as now");
    res.json({ success: true, now: result.rows[0].now });
  } catch (err) {
    console.error("[DB CHECK ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/prelims/practice/build", (req, res) => {
  try {
    function normalizeResolverSubject(value = "") {
      const v = String(value || "").trim().toLowerCase();

      if (v.includes("science")) return "science_tech";
      if (v.includes("economy")) return "economy";
      // Preserve specific CSAT sub-subjects — must check before generic 'csat'
      if (v === "csat_rc" || v.includes("csat_rc")) return "csat_rc";
      if (v === "csat_quant" || v.includes("csat_quant")) return "csat_quant";
      if (v === "csat_reasoning" || v.includes("csat_reasoning")) return "csat_reasoning";
      // Generic CSAT (full subject) — currently not in resolver, will fall through
      if (v.includes("csat")) return "csat_rc"; // Default CSAT → RC as broadest set
      if (v.includes("history")) return "history";
      if (v.includes("geography")) return "geography";
      if (v.includes("polity")) return "polity";
      if (v.includes("environment")) return "environment";
      if (v.includes("culture")) return "culture";

      return v;
    }

    function humanizeResolverInput(value = "") {
      return String(value)
        .replace(/[_-]+/g, " ")
        .replace(/\bGS\d\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const {
      topicNodeId,
      count,
      sort,
      subjectId,
      subjectAliases = [],
      practiceScope = "subject",
      selectedSubjectId,
      selectedTopicId,
      selectedMicroThemeIds = [],
      practicePaper: rawPracticePaper,
      mode,
      fullLengthYear,
      fullLengthPaperId,
      paper,
      year,
    } = req.body || {};

    // Compatibility fallback for old payloads (paper -> practicePaper, year -> fullLengthYear)
    const practicePaper =
      rawPracticePaper ||
      (String(paper || "").toUpperCase() === "GS1" ? "GS" :
        String(paper || "").toUpperCase() === "CSAT" ? "CSAT" :
          String(paper || "").toUpperCase() === "GS" ? "GS" :
            paper);

    const fullLengthYearFinal = fullLengthYear || year;
    console.log("[/api/prelims/practice/build] request body", {
      topicNodeId,
      count,
      sort,
      subjectId,
      subjectAliases,
      practiceScope,
      selectedSubjectId,
      selectedTopicId,
      selectedMicroThemeIds,
      practicePaper,
    });

    let resolvedTopicNodeId = "";
    let resolvedNodeIds = [];

    // Prefer selectedSubjectId — it already has the specific csat_rc/csat_quant/csat_reasoning value.
    // subjectId from frontend is the generic "CSAT" / "GS" label, which loses specificity.
    const normalizedSubjectId = normalizeResolverSubject(selectedSubjectId || subjectId);

    const primaryResolution = resolvePrelimsNodes({
      subjectId: normalizedSubjectId,
      topicId: String(selectedTopicId || "").trim(),
      subtopicIds: Array.isArray(selectedMicroThemeIds)
        ? selectedMicroThemeIds.map(String)
        : [],
      practiceScope,
    });

    console.log("PRIMARY RESOLUTION DEBUG:", {
      subject: normalizedSubjectId,
      topic: selectedTopicId,
      subtopics: selectedMicroThemeIds,
      result: primaryResolution,
    });

    if (
      primaryResolution &&
      Array.isArray(primaryResolution.nodeIds) &&
      primaryResolution.nodeIds.length > 0
    ) {
      resolvedNodeIds = primaryResolution.nodeIds;
      resolvedTopicNodeId = primaryResolution.nodeIds[0] || "";

      console.log("✅ DATA-DRIVEN RESOLVER SUCCESS:", {
        nodeIds: resolvedNodeIds,
        level: primaryResolution.level || null,
      });
    } else {
      console.warn("⚠ PRIMARY RESOLVER FAILED — CHECK MAPPING:", {
        subject: normalizedSubjectId,
        topic: selectedTopicId,
        subtopics: selectedMicroThemeIds,
      });

      let baseInput = selectedTopicId || "";
      if (!baseInput && practiceScope === "subject") baseInput = normalizedSubjectId;

      const topicText = humanizeResolverInput(baseInput);
      const subtopicParts = Array.isArray(selectedMicroThemeIds)
        ? selectedMicroThemeIds.map(humanizeResolverInput).filter(Boolean)
        : [];

      const combinedText = [topicText, ...subtopicParts].filter(Boolean).join(" ").trim();

      const resolved = autoResolveNodes({
        text: combinedText,
        subjectId: normalizedSubjectId,
        debug: true,
      });

      if (practiceScope === "topic") {
        resolvedTopicNodeId = resolved?.selectedNode || "";
        resolvedNodeIds =
          Array.isArray(resolved?.nodeIds) && resolved.nodeIds.length
            ? resolved.nodeIds
            : resolvedTopicNodeId
              ? [resolvedTopicNodeId]
              : [];
      } else if (practiceScope === "subtopic") {
        resolvedNodeIds = Array.isArray(resolved?.nodeIds) ? resolved.nodeIds : [];
        if (!resolvedNodeIds.length && resolved?.selectedNode) {
          resolvedNodeIds = [resolved.selectedNode];
          resolvedTopicNodeId = resolved.selectedNode;
        }
      } else {
        resolvedNodeIds = Array.isArray(resolved?.nodeIds) ? resolved.nodeIds : [];
        if (!resolvedNodeIds.length && resolved?.selectedNode) {
          resolvedNodeIds = [resolved.selectedNode];
          resolvedTopicNodeId = resolved.selectedNode;
        }
      }

      console.log("[/api/prelims/practice/build][AUTO-MAPPER FALLBACK]", {
        inputText: combinedText,
        subjectId: normalizedSubjectId,
        practiceScope,
        selectedNode: resolved?.selectedNode || null,
        nodeIds: resolved?.nodeIds || [],
        confidence: resolved?.confidence || 0,
        gap: resolved?.gap || 0,
      });
    }

    console.log("FINAL INPUT TO BUILDER:", {
      resolvedTopicNodeId,
      resolvedNodeIds,
    });
    // ================= FULL LENGTH HANDLER =================
    if (mode === "full_length") {
      try {
        // Validate required parameters for full-length mode
        if (!practicePaper) {
          return res.status(400).json({
            ok: false,
            message: "Full-length mode requires 'practicePaper' (GS or CSAT)",
          });
        }

        if (!fullLengthYearFinal) {
          return res.status(400).json({
            ok: false,
            message: "Full-length mode requires 'fullLengthYear'",
          });
        }

        const normalizedPaper = String(practicePaper).toUpperCase().trim();
        if (normalizedPaper !== "GS" && normalizedPaper !== "CSAT") {
          return res.status(400).json({
            ok: false,
            message: `Invalid paper type: '${practicePaper}'. Must be 'GS' or 'CSAT'.`,
          });
        }

        console.log("🚀 FULL LENGTH MODE HIT", {
          year: fullLengthYearFinal,
          paper: normalizedPaper,
          paperId: fullLengthPaperId || null,
        });

        if (normalizedPaper === "GS") {
          const fullPaper = readPrelimsFullLengthPaperById(fullLengthPaperId || String(fullLengthYearFinal));

          if (fullPaper?.questions?.length) {
            const requestedCount = Number(count) || 100;
            const questions = fullPaper.questions.slice(0, requestedCount).map((question) => ({
              ...question,
              stage: question.stage || "prelims",
              paper: question.paper || "GS",
              year: question.year || fullPaper.year,
            }));

            console.log("[Prelims FullLength] selected paper:", {
              year: fullPaper.year,
              paperId: fullPaper.paperId,
              questionCount: fullPaper.questionCount,
              returned: questions.length,
            });

            return res.json({
              ok: true,
              questions,
              total: questions.length,
              mode: "full_length",
              year: fullPaper.year,
              paper: "GS",
              paperId: fullPaper.paperId,
              questionCount: fullPaper.questionCount,
            });
          }
        }

        // Load from correct prelims data sources
        let allQuestions = [];

        if (normalizedPaper === "GS") {
          // Load all GS subjects
          const gsData = loadGSData();
          for (const subjectQuestions of Object.values(gsData)) {
            allQuestions.push(...subjectQuestions);
          }
        } else if (normalizedPaper === "CSAT") {
          // Load all CSAT modules
          const csatData = loadCSATData();
          allQuestions.push(...csatData.quant, ...csatData.lr, ...csatData.rc);
        }

        const questions = buildFullLengthTest(allQuestions, {
          year: fullLengthYearFinal,
          paperType: normalizedPaper,
        });

        return res.json({
          ok: true,
          questions,
          total: questions.length,
          mode: "full_length",
          year: fullLengthYearFinal,
          paper: normalizedPaper,
        });

      } catch (err) {
        console.error("❌ FULL LENGTH ERROR:", {
          message: err.message,
          year: fullLengthYearFinal,
          paper: normalizedPaper,
          stack: err.stack,
        });

        return res.status(400).json({
          ok: false,
          message: err.message,
          details: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
      }
    }
    // ======================================================
    const result = buildTopicTest({
      topicNodeId: resolvedTopicNodeId,
      count,
      sort,
      includeDescendants: true,
      subjectId,
      subjectAliases,
      practiceScope,
      selectedSubjectId,
      selectedTopicId,
      selectedMicroThemeIds,
      practicePaper,
      resolvedNodeIds,
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ buildTopicTest error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to build test",
      details: String(err?.message || err),
    });
  }
});

/* -------------------- SYSTEM HEALTH ENDPOINT -------------------- */

app.get("/api/system/health", async (req, res) => {
  try {
    // toPublicSummary() is a projection of getHealthStatus(); no second algorithm.
    return res.json(await healthMonitor.toPublicSummary());
  } catch (err) {
    console.error("[Health Endpoint Error]", err.message);
    // Never expose err.message or internal state to the caller.
    return res.status(500).json({
      status:    'unhealthy',
      database:  'Failed',
      scheduler: 'Failed',
      telegram:  'Failed',
    });
  }
});

/* -------------------- SYSTEM DB DIAGNOSTICS (internal only) -------------------- */

app.get("/api/system/db-test", rejectInProduction, async (req, res) => {
  try {
    const pg = await import("pg");
    const dns = await import("dns/promises");
    const results = {};
    
    // 1. DNS lookups
    try {
      const addr = await dns.lookup("postgres.railway.internal", { all: true });
      results["dns-private"] = { success: true, addresses: addr };
    } catch (err) {
      results["dns-private"] = { success: false, error: err.message };
    }

    try {
      const addr = await dns.lookup("maglev.proxy.rlwy.net", { all: true });
      results["dns-public"] = { success: true, addresses: addr };
    } catch (err) {
      results["dns-public"] = { success: false, error: err.message };
    }

    // 2. Private DB Connection test
    const privateOptions = [
      { name: "private-ssl-disabled", ssl: false },
      { name: "private-ssl-enabled", ssl: { rejectUnauthorized: false } }
    ];
    for (const opt of privateOptions) {
      try {
        const client = new pg.default.Client({
          connectionString: process.env.DATABASE_URL,
          ssl: opt.ssl,
          connectionTimeoutMillis: 3000
        });
        const start = Date.now();
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        results[opt.name] = { success: true, timeMs: Date.now() - start };
      } catch (err) {
        results[opt.name] = { success: false, error: err.message };
      }
    }

    // 3. Public DB Connection test
    const publicUrl = process.env.DATABASE_URL;
    const publicOptions = [
      { name: "public-ssl-disabled", ssl: false },
      { name: "public-ssl-enabled", ssl: { rejectUnauthorized: false } }
    ];
    for (const opt of publicOptions) {
      try {
        const client = new pg.default.Client({
          connectionString: publicUrl,
          ssl: opt.ssl,
          connectionTimeoutMillis: 3000
        });
        const start = Date.now();
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        results[opt.name] = { success: true, timeMs: Date.now() - start };
      } catch (err) {
        results[opt.name] = { success: false, error: err.message };
      }
    }

    return res.json({
      databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, "://<redacted>@") : "MISSING",
      activeDbHost,
      activeDbPort,
      activeDbSsl,
      activeDbSource,
      results
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/system/caddy-test", async (req, res) => {
  const results = {};
  
  // DNS lookups
  try {
    const dns = await import("dns/promises");
    results["dns-private-app"] = await dns.lookup("mentor-upsc-cloud.railway.internal", { all: true });
    results["dns-private-db"] = await dns.lookup("postgres.railway.internal", { all: true });
  } catch (err) {
    results["dns-errors"] = err.message;
  }
  
  // Test http to private
  try {
    const r = await fetch("http://postgres.railway.internal:5432/", { signal: AbortSignal.timeout(3000) });
    results["http-private"] = {
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: await r.text()
    };
  } catch (err) {
    results["http-private"] = { error: err.message };
  }

  // Test https to private
  try {
    const r = await fetch("https://postgres.railway.internal:5432/", {
      signal: AbortSignal.timeout(3000)
    });
    results["https-private"] = {
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: await r.text()
    };
  } catch (err) {
    results["https-private"] = { error: err.message };
  }

  // Test http to public
  try {
    const r = await fetch("http://maglev.proxy.rlwy.net:47713/", { signal: AbortSignal.timeout(3000) });
    results["http-public"] = {
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: await r.text()
    };
  } catch (err) {
    results["http-public"] = { error: err.message };
  }

  return res.json(results);
});

/* -------------------- REMINDER ENGINE TICK -------------------- */

setInterval(async () => {
  try {
    await tickReminderEngine();
  } catch (err) {
    console.error("[ReminderEngine Tick ERR]", err);
  }
}, 30 * 1000);

/* -------------------- OUTBOX WORKER -------------------- */
setInterval(async () => {
  try {
    await flushOutbox();
  } catch (err) {
    console.error("[Outbox Worker ERR]", err);
  }
}, 30 * 1000);

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  console.error("[FINAL_ERROR_HANDLER]", {
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack
  });

  res.status(err.status || ((err.code === 'CIRCUIT_OPEN' || err.message?.includes('timeout') || err.message?.includes('ECONNREFUSED')) ? 502 : 500)).json({
    ok: false,
    error: "internal_server_error",
    message: process.env.NODE_ENV === "production" ? "Server error" : err.message,
    code: err.code
  });
});

/* -------------------- LISTEN -------------------- */

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

console.log("[BOOT] about to listen", { HOST, PORT });
app.listen(PORT, HOST, () => {
  console.log(`backend running on http://${HOST}:${PORT}`);
  
  // Start system health heartbeat checker
  healthMonitor.startHeartbeatAlerts();
  
  // ── Boot sequence: register chat ID → start polling → start scheduler ──────
  // startTelegramPolling() has a module-level singleton guard (pollingLoopStarted).
  // Even if this callback fires more than once, only one polling loop will run.
  // startTelegramPolling() is async (awaits deleteWebhook pre-flight) but the
  // polling loop itself runs forever inside it, so we intentionally do NOT await
  // the full call — we just let it run in the background.
  registerEnvChatId()
    .then(() => {
      // Kick off polling (non-blocking). The singleton guard prevents duplicates.
      startTelegramPolling().catch(err => {
        console.error("[BOOT] startTelegramPolling error:", err);
      });
      initNotificationScheduler('moulika');
    })
    .catch(err => {
      console.error("[BOOT] Failed to initialize Telegram / Notifications:", err);
    });
});

export default app;
