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
import pyqRoutes from "./routes/pyqRoutes.js";
import buildTopicTest from "./phase3a/builders/buildTopicTest.js";
import {
  getPyqSummaryForNode,
  getPyqsForTopic,
  explainPyqResolution
} from "./brain/pyqLinkEngine.js";
import SYLLABUS_GRAPH_2026 from "./brain/syllabusGraph.js";
import { detectLoops } from "./brain/loopDetector.js";
import { buildDailyAdvice } from "./brain/adviceEngine.js";
import prelimsPracticeRoute from "./routes/prelimsPracticeRoute.js";
import prelimsDashboardRoute from "./routes/prelimsDashboardRoute.js";
import prelimsRebuiltDatasetRoute from "./routes/prelimsRebuiltDatasetRoute.js";
import { query } from "./db/index.js";
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
import { fileURLToPath } from "url";
import mistakeRoutes from "./routes/mistakeRoutes.js";
import revisionRoutes from "./routes/revisionRoutes.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

console.log("[BOOT] server.js loaded");

/* -------------------- HELPERS -------------------- */

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
  return new Date().toISOString().slice(0, 10);
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

function diffMinutes(start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null || e == null) return null;
  let d = e - s;
  if (d < 0) d += 24 * 60;
  return d;
}

// infer PM blocks if time goes backwards later in the same day
function inferHalfDay(items) {
  let last = null;
  return items.map((it) => {
    let st = normTime(it.startTime);
    let en = normTime(it.endTime);

    const sMin = toMinutes(st);
    if (sMin != null && last != null) {
      if (sMin + 60 < last && sMin < 12 * 60) {
        const hh = Number(st.slice(0, 2)) + 12;
        if (hh <= 23) st = `${String(hh).padStart(2, "0")}:${st.slice(3)}`;

        if (en) {
          const eh = Number(en.slice(0, 2)) + 12;
          if (eh <= 23) en = `${String(eh).padStart(2, "0")}:${en.slice(3)}`;
        }
      }
    }

    const newSMin = toMinutes(st);
    if (newSMin != null) last = newSMin;

    return { ...it, startTime: st, endTime: en };
  });
}

/**
 * Non-study blocks should NOT be syllabus-mapped
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
  ];

  return keys.some((k) => s.includes(k) || t.includes(k));
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

function getQuestionStage(q = {}) {
  const id = String(q?.id || "").trim().toUpperCase();
  const exam = String(q?.exam || "").trim().toLowerCase();
  const paper = String(q?.paper || "").trim().toLowerCase();
  const subject = String(q?.subject || "").trim().toLowerCase();

  // 1) ID HAS HIGHEST PRIORITY
  if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) {
    return "csat";
  }

  if (id.startsWith("PRE_")) {
    return "prelims";
  }

  if (id.startsWith("ESSAY_")) {
    return "essay";
  }

  if (id.startsWith("ETH_")) {
    return "ethics";
  }

  if (id.startsWith("OPT_")) {
    return "optional";
  }

  if (id.startsWith("MAINS_") || id.startsWith("MAIN_")) {
    return "mains";
  }

  // Support mains ids like GS1_2020_Q1, GS2_2019_Q3, etc.
  if (/^GS[1-4]_/.test(id)) {
    if (id.startsWith("GS4_")) return "ethics";
    return "mains";
  }

  // 2) EXAM FIELD NEXT
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

  // 3) PAPER FIELD LAST
  if (
    paper === "prelims" ||
    paper === "mains" ||
    paper === "essay" ||
    paper === "ethics" ||
    paper === "optional" ||
    paper === "csat"
  ) {
    return paper;
  }

  if (paper === "gs4") {
    return "ethics";
  }

  // gs1/gs2/gs3 are ambiguous in your dataset,
  // because prelims records also carry paper:"GS1".
  // So do NOT force them unless you have stronger evidence.
  if (
    (paper === "gs1" || paper === "gs2" || paper === "gs3") &&
    subject.includes("csat")
  ) {
    return "csat";
  }

  return "";
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

// ── CORS ──────────────────────────────────────────────────────────────────────
// Explicit allowed origins. PATCH must be listed for mistake/revision updates.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://mentorupsc.in",
  "https://www.mentorupsc.in",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, Railway health checks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
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

/* -------------------- MIDDLEWARE -------------------- */
app.use("/api/prelims-rebuilt", prelimsRebuiltDatasetRoute);
app.use("/api/prelims", prelimsAnalyticsRoute);
app.use("/api/prelims", prelimsDashboardRoute);
app.use("/api", pyqRoutes);
app.use("/api/prelims/practice", prelimsPracticeRoute);
app.use("/api/prelims/pyq", prelimsPyqTestRoutes);
app.use("/api/blocks", blockResolveRoute);        // isolated block classification — no PYQ/CSAT side-effects

// ── Mistake & Revision routes (registered here, not at bottom) ───────────────
app.use("/api/mistakes", mistakeRoutes);
app.use("/api/revision-items", revisionRoutes);

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

/* -------------------- HEALTH ROUTE -------------------- */

app.get("/health", async (_req, res) => {
  let dbOk = false;
  let dbTime = null;
  let dbError = null;
  try {
    const result = await query("SELECT NOW() AS now");
    dbOk = true;
    dbTime = result.rows[0].now;
  } catch (err) {
    dbError = err.message || err.code || String(err);
  }
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    message: dbOk ? "backend live, DB connected" : "backend live, DB ERROR",
    db: { connected: dbOk, time: dbTime, error: dbError },
    env: {
      NODE_ENV: process.env.NODE_ENV || "(not set)",
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || "(not set)",
      DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
      DB_SSL: process.env.DB_SSL || "(not set)",
      PORT: process.env.PORT || "(not set)",
    },
  });
});

/* -------------------- DEBUG DB CHECK (temporary) -------------------- */

app.get("/api/debug/db-check", async (req, res) => {
  const results = {};

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

  res.json({ ok: true, ...results });
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

app.post("/api/loop-detect", (req, res) => {
  try {
    const out = detectLoops(req.body || {});
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});
function collectNodeAndDescendantIds(pyqByNode, requestedNodeId) {
  const matchingNodeIds = Object.keys(pyqByNode || {}).filter(
    (id) => id === requestedNodeId || id.startsWith(`${requestedNodeId}-`)
  );

  const result = {
    prelims: new Set(),
    mains: new Set(),
    essay: new Set(),
    ethics: new Set(),
    optional: new Set(),
    csat: new Set(),
  };

  for (const matchedNodeId of matchingNodeIds) {
    const bucket = pyqByNode?.[matchedNodeId] || {};
    for (const stage of Object.keys(result)) {
      const ids = Array.isArray(bucket?.[stage]) ? bucket[stage] : [];
      for (const qid of ids) result[stage].add(qid);
    }
  }

  return {
    matchingNodeIds,
    aggregated: Object.fromEntries(
      Object.entries(result).map(([stage, set]) => [stage, Array.from(set)])
    ),
  };
}
/* -------------------- PYQ NODE API -------------------- */
/* -------------------- PYQ NODE API -------------------- */
app.get("/api/pyq/node/:nodeId", (req, res) => {
  try {
    const { nodeId } = req.params;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: "nodeId is required",
      });
    }

    const pyqByNodePath = path.join(__dirname, "data", "pyq_index", "pyq_by_node.json");
    const pyqByNode = JSON.parse(fs.readFileSync(pyqByNodePath, "utf8"));

    const { matchingNodeIds } = collectNodeAndDescendantIds(pyqByNode, nodeId);

    let questions = [];
    const seen = new Set();

    for (const matchedNodeId of matchingNodeIds) {
      const nodeQuestions = getPyqsForTopic(matchedNodeId, 0);
      for (const q of Array.isArray(nodeQuestions) ? nodeQuestions : []) {
        const qid = String(q?.id || "").trim();
        if (!qid || seen.has(qid)) continue;
        seen.add(qid);
        questions.push(q);
      }
    }

    console.log("[PYQ AGG DEBUG]", {
      requestedNodeId: nodeId,
      matchingNodeIds,
      totalQuestions: questions.length,
    });

    const resolution = explainPyqResolution(nodeId);

    const counts = {
      total: questions.length,
      prelims: 0,
      mains: 0,
      essay: 0,
      ethics: 0,
      optional: 0,
      csat: 0,
    };

    for (const q of questions) {
      const stage = getQuestionStage(q);
      if (process.env.NODE_ENV !== "production") {
        console.log("[PYQ NODE SUMMARY]", {
          nodeId,
          total: questions.length,
          prelims: counts.prelims,
          mains: counts.mains,
          essay: counts.essay,
          ethics: counts.ethics,
          optional: counts.optional,
          csat: counts.csat,
        });
      }

      if (stage === "prelims") counts.prelims++;
      else if (stage === "mains") counts.mains++;
      else if (stage === "essay") counts.essay++;
      else if (stage === "ethics") counts.ethics++;
      else if (stage === "optional") counts.optional++;
      else if (stage === "csat") counts.csat++;
    }

    return res.json({
      success: true,
      nodeId,
      matchedNodeIds: matchingNodeIds,
      counts,
      resolution,
      questions,
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

app.post("/api/plan-photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No photo uploaded" });
    }

    const providedDate = String(req.body?.date || "").trim();
    const dateFallback = providedDate || todayISODate();

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const userPrompt = `
Extract a UPSC daily study plan from the image as TIME BLOCKS.

Return JSON exactly in this schema:
{
  "ok": true,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "subject": "string",
      "topic": "string",
      "minutes": number
    }
  ],
  "totalMinutes": number
}

RULES:
1) Each item must contain:
   - startTime: "HH:MM" (24-hour) or "" if not visible
   - endTime: "HH:MM" (24-hour) or "" if not visible
   - subject: short subject label (e.g., Polity, CSAT, Geography Optional, History, Economy, Ethics, Essay)
   - topic: specific topic text (e.g., "FR - Article 19", "RC Practice", "Geomorphology - Slope")
   - minutes: integer minutes
2) If minutes not explicitly written, compute:
   minutes = difference between endTime and startTime (if both exist).
3) If only startTime exists and minutes exist, you may leave endTime as "".
4) If times are written in formats like "4 40", "4:40", "04.40", normalize to "04:40".
5) Ignore decorations/headings. Focus only on schedule blocks.
6) Keep subject/topic clean, no emojis.
7) date: if not present in image, use "${dateFallback}".
8) totalMinutes: sum of item.minutes.

Output ONLY JSON.
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
              minutes: { type: "number" },
            },
            required: ["startTime", "endTime", "subject", "topic", "minutes"],
          },
        },
        totalMinutes: { type: "number" },
      },
      required: ["ok", "date", "items", "totalMinutes"],
    };

    const response = await openai.responses.create({
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

    const outText = response.output_text || "";

    let parsed;
    try {
      parsed = JSON.parse(outText);
    } catch {
      return res.status(400).json({
        ok: false,
        message: "Model did not return valid JSON",
        raw: outText,
      });
    }

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
        startTime: normTime(it.startTime),
        endTime: normTime(it.endTime),
        subject,
        topic,
        minutes: Number(it.minutes || 0),
      };
    });

    items = inferHalfDay(items);

    items = items.map((it) => {
      let mins = safeNum(it.minutes, 0);
      if ((!mins || mins <= 0) && it.startTime && it.endTime) {
        const d = diffMinutes(it.startTime, it.endTime);
        if (d != null) mins = d;
      }
      return { ...it, minutes: Math.max(0, Math.round(mins)) };
    });

    items = markOverlaps(items);

    const tr = daysToPrelims(new Date());
    const kill = killSwitchMode(tr);

    const enrichedItems = items.map((rawIt, itemIndex) => {
      const item = { ...rawIt };

      const ocrInput = `${item.subject || ""} ${item.topic || ""}`.trim();
      const mappingResult = processOcrText(ocrInput, { minutes: item.minutes || 0 });

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

      return {
        ...item,
        subject: item.subject && item.subject !== "Unknown" ? item.subject : (mappingResult.subjectName || "Unknown"), // Preserve text recognized by OCR, fallback to resolved
        finalMapping,
        subjectCandidates: mappingResult.subjectCandidates,
        topicCandidates: mappingResult.topicCandidates,
        textQuality: mappingResult.textQuality,
        confidenceBadge: mappingResult.confidenceBadge,
        linkedPyqs
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
      message: String(err?.message || err),
    });
  }
});

/* -------------------- TEXT → MICROTHEME MAP -------------------- */

app.post("/api/map-text", upload.none(), (req, res) => {
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

app.post("/api/analyze-day", (req, res) => {
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

app.post("/api/syllabus-progress", (req, res) => {
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

app.post("/api/schedule/register", (req, res) => {
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

app.post("/api/sheets", async (req, res) => {
  try {
    const scriptUrl = String(process.env.SCRIPT_URL || "").trim();
    if (!scriptUrl) {
      return res.status(500).json({
        ok: false,
        message: "Missing SCRIPT_URL in backend .env",
      });
    }

    const payload = req.body || {};
    const action = String(payload.action || "").trim();
    if (!action) {
      return res.status(400).json({ ok: false, message: "Missing action" });
    }

    const body = new URLSearchParams();
    body.set("data", JSON.stringify(payload));

    const r = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await r.text();

    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      return res.status(200).json({ ok: true, raw: text });
    }
  } catch (e) {
    console.error("[api/sheets ERR]", e);
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
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

/* ── FULL-LENGTH YEARS ── returns available years for each paper type ── */
app.get("/api/prelims/full-length/years", (_req, res) => {
  try {
    const gsData = loadGSData();
    const csatData = loadCSATData();

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
    });
  } catch (err) {
    console.error("❌ getAvailableYears error:", err);
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
        });

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

/* -------------------- REMINDER ENGINE TICK -------------------- */

setInterval(() => {
  try {
    tickReminderEngine();
  } catch (err) {
    console.error("[ReminderEngine Tick ERR]", err);
  }
}, 30 * 1000);

/* -------------------- LISTEN -------------------- */

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

console.log("[BOOT] about to listen", { HOST, PORT });
app.listen(PORT, HOST, () => {
  console.log(`backend running on http://${HOST}:${PORT}`);
});

