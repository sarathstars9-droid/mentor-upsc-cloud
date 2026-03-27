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
import {
  mapPlanItemToMicroTheme,
  daysToPrelims,
  killSwitchMode,
  findMicroTheme,
  findTopMicroThemes,
} from "./brain/findMicroTheme.js";
import prelimsPyqTestRoutes from "./routes/prelimsPyqTestRoutes.js";
import {
  computeSyllabusProgress,
} from "./brain/syllabusProgressEngine.js";
import prelimsAnalyticsRoute from "./routes/prelimsAnalyticsRoute.js";
import {
  registerDaySchedule,
  startBlock,
  completeBlock,
  getDay,
  tickReminderEngine,
} from "./reminderEngine.js";
import { fileURLToPath } from "url";
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
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// ✅ MUST BE HERE (TOP)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------- MIDDLEWARE -------------------- */
app.use("/api/prelims-rebuilt", prelimsRebuiltDatasetRoute);
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use("/api/prelims", prelimsAnalyticsRoute);
app.use("/api/prelims", prelimsDashboardRoute);
app.use("/api", pyqRoutes);
app.use("/api/prelims/practice", prelimsPracticeRoute);
app.use("/api/prelims/pyq", prelimsPyqTestRoutes);
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

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "backend live" });
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

    const questions = getPyqsForTopic(nodeId, 0);
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

      console.log("[PYQ NODE DEBUG]", {
        nodeId,
        id: q?.id,
        exam: q?.exam,
        paper: q?.paper,
        subject: q?.subject,
        stage,
      });

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

      const normalizedSubject = normalizeOcrSubject(item.subject, item.topic);
      const normalizedTopic = normalizeOcrTopic(item.topic, normalizedSubject);

      item.subject = normalizedSubject;
      item.topic = normalizedTopic;

      const textForMap = `${item.subject} ${item.topic}`.trim();
      const nonStudy = isNonStudyBlock(item.subject, item.topic);

      const rawTopicText = String(normalizedTopic || "").trim();

      function normalizeAnchorText(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[–—]/g, "-")
          .replace(/[_/]+/g, " ")
          .replace(/[()[\]{}]/g, " ")
          .replace(/[.:]/g, " ")
          .replace(/\bthe\b/g, " ")
          .replace(/\bof\b/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      function splitTopicIntoParts(topicText) {
        const raw = String(topicText || "").trim();
        if (!raw) return [];

        return raw
          .replace(/[•●▪■◆►→]/g, ",")
          .replace(/[;|]/g, ",")
          .replace(/\s+\/\s+/g, ",")
          .replace(/\s*&\s*/g, ",")
          .replace(/\s+\+\s+/g, ",")
          .replace(/\s+\band\b\s+/gi, ",")
          .replace(/\s+\bthen\b\s+/gi, ",")
          .replace(/\s+\bplus\b\s+/gi, ",")
          .split(",")
          .map((part) =>
            String(part || "")
              .replace(/^[\s\-–—:]+/, "")
              .replace(/[\s\-–—:]+$/, "")
              .replace(/\s+/g, " ")
              .trim()
          )
          .filter(Boolean)
          .filter((part) => part.split(" ").length >= 2);
      }

      function buildBroadAnchorSet(subject, topicText) {
        const set = new Set();

        const subjectNorm = normalizeAnchorText(subject);
        if (subjectNorm) set.add(subjectNorm);

        [
          "history",
          "ancient history",
          "medieval history",
          "modern history",
          "art and culture",
          "culture",
          "society",
          "indian society",
          "world history",
          "post independence",
          "polity",
          "indian polity",
          "constitution",
          "governance",
          "social justice",
          "international relations",
          "ir",
          "economy",
          "indian economy",
          "economic development",
          "agriculture",
          "internal security",
          "disaster management",
          "science and technology",
          "science and tech",
          "science and technology current affairs",
          "science",
          "technology",
          "environment",
          "ecology",
          "environment and ecology",
          "geography",
          "physical geography",
          "human geography",
          "indian geography",
          "world geography",
          "geography optional",
          "optional geography",
          "geography optional paper 1",
          "geography optional paper 2",
          "ethics",
          "ethics integrity and aptitude",
          "ethics integrity aptitude",
          "integrity",
          "aptitude",
          "essay",
          "essay writing",
          "essay practice",
          "current affairs",
          "current affair",
          "ca",
          "csat",
          "comprehension",
          "reasoning",
          "quant",
          "quantitative aptitude",
          "mathematics",
          "maths",
          "number system",
          "general studies",
          "general studies paper 1",
          "general studies paper 2",
          "general studies paper 3",
          "general studies paper 4",
          "gs",
          "gs1",
          "gs2",
          "gs3",
          "gs4",
          "paper 1",
          "paper 2",
          "optional",
        ].forEach((x) => {
          const n = normalizeAnchorText(x);
          if (n) set.add(n);
        });

        return set;
      }

      function shouldDropBroadPart(partNorm, subjectNorm, broadAnchors, partCount) {
        if (!partNorm) return true;
        if (broadAnchors.has(partNorm)) return true;

        if (subjectNorm) {
          if (partNorm === subjectNorm) return true;

          // Only do contains-based dropping for obviously broad subject labels,
          // and only when there are multiple parts to preserve specific single-topic blocks.
          if (partCount > 1) {
            if (
              partNorm.length <= Math.max(10, subjectNorm.length + 6) &&
              (partNorm.includes(subjectNorm) || subjectNorm.includes(partNorm))
            ) {
              return true;
            }
          }
        }

        return false;
      }

      function normalizeMappedHit(hit) {
        if (!hit) return null;
        if (hit.microTitle) return hit;

        return {
          ...hit,
          microTitle: hit.name || hit.mappedTopicName || hit.microTheme || "",
          mappedTopicName: hit.name || hit.mappedTopicName || hit.microTheme || "",
          gsHeading: hit.gsHeading || hit.subjectGroup || hit.gsPaper || "",
          macroTheme: hit.macroTheme || hit.section || "",
          microTheme: hit.microTheme || hit.name || hit.mappedTopicName || "",
        };
      }

      function mapSinglePart(part, subject) {
        const cleanPart = String(part || "").trim();
        if (!cleanPart) return null;

        const expandedPart = cleanPart
          .replace(/\b2\s*vc\b/gi, "Indus Valley Civilization")
          .replace(/\bi\s*vc\b/gi, "Indus Valley Civilization")
          .replace(/\bivc\b/gi, "Indus Valley Civilization")
          .replace(/\bmauryas\b/gi, "Mauryan Empire")
          .replace(/\bvedic age\b/gi, "Vedic Period")
          .replace(/\bpm\b/gi, "Prime Minister")
          .replace(/\bfr\b/gi, "Fundamental Rights")
          .replace(/\bei\b/gi, "Emotional Intelligence")
          .trim();

        const attempts = [
          () => mapPlanItemToMicroTheme(expandedPart, subject),
          () => mapPlanItemToMicroTheme(cleanPart, subject),

          () => findMicroTheme(expandedPart),
          () => findMicroTheme(cleanPart),

          () => findMicroTheme(`${subject} ${expandedPart}`),
          () => findMicroTheme(`${subject} ${cleanPart}`),
        ];

        for (const tryMap of attempts) {
          const hit = normalizeMappedHit(tryMap());
          const syllabusNodeId = hit?.syllabusNodeId || hit?.code || null;
          if (hit && syllabusNodeId) {
            return {
              topic: cleanPart,
              syllabusNodeId,
              code: hit.code || syllabusNodeId,
              label: hit.mappedTopicName || hit.microTitle || cleanPart,
              microTheme: hit.microTheme || hit.microTitle || cleanPart,
              path: hit.path || "",
              confidence: hit.confidence || 0,
            };
          }
        }

        return null;
      }

      const rawTopicParts = splitTopicIntoParts(rawTopicText);
      const broadAnchorsToIgnore = buildBroadAnchorSet(normalizedSubject, rawTopicText);
      const subjectNorm = normalizeAnchorText(normalizedSubject);

      const cleanedTopicParts = rawTopicParts.filter((part) => {
        const pNorm = normalizeAnchorText(part);
        return !shouldDropBroadPart(
          pNorm,
          subjectNorm,
          broadAnchorsToIgnore,
          rawTopicParts.length
        );
      });

      // Final fallback order:
      // 1) cleaned specific subtopics
      // 2) all split parts (if cleaning removed everything)
      // 3) raw topic text
      let topicParts =
        cleanedTopicParts.length > 0
          ? cleanedTopicParts
          : rawTopicParts.length > 0
            ? rawTopicParts
            : [rawTopicText].filter(Boolean);

      // De-dupe by normalized text while preserving order
      {
        const seen = new Set();
        topicParts = topicParts.filter((part) => {
          const key = normalizeAnchorText(part);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      let mapped = null;
      let fallbackPath = null;
      let mappedNodes = [];
      let linkedPyqs = emptyLinkedPyqs("");

      if (!nonStudy) {
        // Primary block-level mapping
        mapped = normalizeMappedHit(
          mapPlanItemToMicroTheme(normalizedTopic, normalizedSubject)
        );

        if (!mapped) {
          const m2 =
            findMicroTheme(`${normalizedSubject} ${normalizedTopic}`) ||
            findMicroTheme(normalizedTopic) ||
            findMicroTheme(textForMap || "");

          if (m2?.found || m2?.syllabusNodeId || m2?.code) {
            fallbackPath = m2?.path || null;
            mapped = normalizeMappedHit(m2);
          }
        }

        // Per-subtopic multi-mapping
        mappedNodes = topicParts
          .map((part) => mapSinglePart(part, normalizedSubject))
          .filter(Boolean);

        // 🚨 HARD SUBJECT LOCK (FINAL FIX)
        const subjectKey = String(normalizedSubject || "").toUpperCase();

        mappedNodes = mappedNodes.filter((node) => {
          const id = String(node?.syllabusNodeId || "").toUpperCase();

          if (subjectKey.includes("ECONOMY") || subjectKey === "GS3") {
            return id.startsWith("GS3-ECO");
          }

          if (subjectKey.includes("SCIENCE")) {
            return id.startsWith("GS3-ST");
          }

          if (subjectKey.includes("CSAT")) {
            return id.startsWith("CSAT");
          }

          if (subjectKey.includes("HISTORY")) {
            return id.startsWith("GS1-HIS");
          }

          return true;
        });

        // Also include primary mapped node if not already present
        const primaryNodeId = mapped?.syllabusNodeId || mapped?.code || null;
        if (
          primaryNodeId &&
          !mappedNodes.some((x) => x.syllabusNodeId === primaryNodeId)
        ) {
          mappedNodes.unshift({
            topic:
              cleanedTopicParts[0] ||
              normalizedTopic ||
              item.topic ||
              "",
            syllabusNodeId: primaryNodeId,
            code: mapped?.code || primaryNodeId,
            label:
              mapped?.mappedTopicName ||
              mapped?.microTitle ||
              normalizedTopic ||
              item.topic ||
              "Primary Topic",
            microTheme:
              mapped?.microTheme ||
              mapped?.microTitle ||
              normalizedTopic ||
              item.topic ||
              "Primary Topic",
            path: mapped?.path || "",
            confidence: mapped?.confidence || 0,
          });
        }
        // Also include safe alternative PYQ buckets if provided
        const alternativeNodeIds = Array.isArray(mapped?.alternativeNodeIds)
          ? mapped.alternativeNodeIds
          : [];

        for (const altNodeId of alternativeNodeIds) {
          if (!altNodeId) continue;

          if (!mappedNodes.some((x) => x.syllabusNodeId === altNodeId)) {
            mappedNodes.push({
              topic: normalizedTopic || item.topic || "",
              syllabusNodeId: altNodeId,
              code: altNodeId,
              label: altNodeId,
              microTheme: normalizedTopic || item.topic || altNodeId,
              path: mapped?.path || "",
              confidence: Math.max(0.85, mapped?.confidence || 0),
            });
          }
        }
        // Dedupe mapped nodes by syllabus node id
        {
          const seenNodeIds = new Set();
          mappedNodes = mappedNodes.filter((x) => {
            if (!x?.syllabusNodeId) return false;
            if (seenNodeIds.has(x.syllabusNodeId)) return false;
            seenNodeIds.add(x.syllabusNodeId);
            return true;
          });
        }

        // Optional debug logs
        console.log("[plan-photo][multi-topic]", {
          index: itemIndex,
          subject: normalizedSubject,
          rawTopicText,
          rawTopicParts,
          cleanedTopicParts,
          topicParts,
          mappedNodeIds: mappedNodes.map((x) => x.syllabusNodeId),
        });

        // Merge PYQs from all mapped nodes
        if (mappedNodes.length > 0) {
          const mergedQuestions = [];
          const questionSeen = new Set();

          let prelimsCount = 0;
          let mainsCount = 0;
          let essayCount = 0;
          let ethicsCount = 0;
          let optionalCount = 0;
          let csatCount = 0;
          let lastAskedYear = null;

          // 🚨 STRICT SUBJECT FILTER (SAFE VERSION)
          const subjectPrefix = String(normalizedSubject || item.subject || "").toUpperCase();

          const filteredMappedNodes = (mappedNodes || []).filter((node) => {
            const nodeId = String(node?.syllabusNodeId || "").toUpperCase();
            if (!nodeId) return false;

            if (subjectPrefix.includes("ECONOMY") || subjectPrefix === "GS3") {
              return nodeId.startsWith("GS3-ECO");
            }

            if (subjectPrefix.includes("SCIENCE")) {
              return nodeId.startsWith("GS3-ST");
            }

            if (subjectPrefix.includes("CSAT")) {
              return nodeId.startsWith("CSAT");
            }

            if (subjectPrefix.includes("HISTORY")) {
              return nodeId.startsWith("GS1-HIS");
            }

            return true;
          });

          const effectiveMappedNodes =
            filteredMappedNodes.length > 0 ? filteredMappedNodes : mappedNodes;

          for (const node of effectiveMappedNodes) {
            let summary = emptyLinkedPyqs(node.syllabusNodeId);

            try {
              summary = getPyqSummaryForNode(node.syllabusNodeId, 500);
            } catch (err) {
              console.error("[plan-photo PYQ load error]", err);
            }

            for (const q of Array.isArray(summary.questions) ? summary.questions : []) {
              const qid =
                q?.id ||
                `${q?.year || ""}-${q?.paper || q?.exam || ""}-${q?.question || q?.questionText || ""}`.trim();

              if (!questionSeen.has(qid)) {
                questionSeen.add(qid);

                const qNodes = q?.syllabusNodeIds || q?.syllabusNodeId;
                const qNodeArr = Array.isArray(qNodes) ? qNodes : qNodes ? [qNodes] : [];
                const isExactNodeMatch =
                  qNodeArr.length === 0 || qNodeArr.includes(node.syllabusNodeId);

                if (!isExactNodeMatch) {
                  continue;
                }

                mergedQuestions.push(q);
                const stage = getQuestionStage(q);

                if (stage === "prelims") prelimsCount += 1;
                else if (stage === "mains") mainsCount += 1;
                else if (stage === "essay") essayCount += 1;
                else if (stage === "ethics") ethicsCount += 1;
                else if (stage === "optional") optionalCount += 1;
                else if (stage === "csat") csatCount += 1;

                if (q?.year) {
                  const yearNum = Number(q.year);
                  if (!Number.isNaN(yearNum)) {
                    lastAskedYear = lastAskedYear
                      ? Math.max(lastAskedYear, yearNum)
                      : yearNum;
                  }
                }
              }
            }
          }

          linkedPyqs = {
            syllabusNodeId: effectiveMappedNodes[0]?.syllabusNodeId || "",
            matchedNodeId: effectiveMappedNodes[0]?.syllabusNodeId || null,
            total: mergedQuestions.length,
            lastAskedYear,
            frequency: mergedQuestions.length,
            prelimsCount,
            mainsCount,
            essayCount,
            ethicsCount,
            optionalCount,
            csatCount,
            questions: mergedQuestions,
            mappedNodes: effectiveMappedNodes,
          };
        } else {
          const pyqNodeId = mapped?.syllabusNodeId || mapped?.code || "";
          linkedPyqs = pyqNodeId
            ? getPyqSummaryForNode(pyqNodeId, 500)
            : emptyLinkedPyqs(pyqNodeId);
        }
      }

      const normalizedMapped = normalizeMappedHit(mapped);
      const mappedObj = buildMappedObject(normalizedMapped, nonStudy, item);
      const locked = kill === "ON" && mappedObj?.tag === "M";

      return {
        ...item,
        subject:
          item.subject && item.subject !== "Unknown"
            ? item.subject
            : mappedObj?.subject
              ? mappedObj.subject
              : fallbackPath || "Unknown",
        mapped: mappedObj,
        mappedNodes,
        locked,
        syllabusTopCode: mappedObj?.code || null,
        syllabusTopPath: mappedObj?.path || null,
        linkedPyqs,
      };
    });

    const totalMinutes = enrichedItems.reduce(
      (sum, x) => sum + (Number(x.minutes) || 0),
      0
    );

    const hasC1 = enrichedItems.some((x) => x.mapped?.code === "C.1");
    const csatDrill = hasC1 ? "CHECK_NUMERACY" : "NONE";

    const reminderPreview = enrichedItems
      .filter((it) => !it.mapped?.nonStudy && it.startTime)
      .map((it, idx) => ({
        blockId: `B${idx + 1}`,
        label: blockLabelFromIndex(idx),
        subject: it.subject || "Study",
        topic: it.topic || "",
        startTime: toISOWithDate(safeDate, it.startTime),
        endTime: it.endTime ? toISOWithDate(safeDate, it.endTime) : "",
        plannedMinutes: Number(it.minutes || 0),
        syllabusNodeId: it.mapped?.syllabusNodeId || null,
        gsPaper: it.mapped?.gsPaper || null,
        subjectGroup: it.mapped?.subjectGroup || null,
        confidence: it.mapped?.confidence || 0,
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