// backend/server.js (ESM ONLY)
// PHASE 2: Plan-photo OCR => TIME BLOCKS (start/end/subject/topic/minutes)
// Keeps your existing syllabus + advice engine + mapping logic intact.

// ---- imports MUST be first in ESM ----
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import { detectLoops } from "./brain/loopDetector.js";

import SYLLABUS_GRAPH_2026 from "./brain/syllabusGraph.js";
import { buildDailyAdvice } from "./brain/adviceEngine.js";

import {
  mapPlanItemToMicroTheme,
  daysToPrelims,
  killSwitchMode,
  findMicroTheme,
  findTopMicroThemes,
} from "./brain/findMicroTheme.js";

dotenv.config();

// ---- boot logs (after imports) ----
console.log("[BOOT] server.js loaded");

/* -------------------- HELPERS -------------------- */
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

  // "0440"
  if (/^\d{4}$/.test(cleaned)) {
    const hh = cleaned.slice(0, 2);
    const mm = cleaned.slice(2, 4);
    const H = Number(hh),
      M = Number(mm);
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
  if (d < 0) d += 24 * 60; // if crosses midnight / ambiguous AM-PM
  return d;
}

// infer PM blocks if time goes backwards later in the same day (e.g., 13:00 after 11:30)
function inferHalfDay(items) {
  let last = null;
  return items.map((it) => {
    let st = normTime(it.startTime);
    let en = normTime(it.endTime);

    const sMin = toMinutes(st);
    if (sMin != null && last != null) {
      // if time goes backwards significantly, assume PM by adding 12h (only if plausible)
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
 * Non-study blocks that should NOT be syllabus-mapped
 * (prevents yoga/puja/break etc from polluting analytics)
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
 * Overlap marking (non-blocking):
 * Adds status = "OVERLAP" if time blocks overlap.
 * We still keep ALL items.
 */
function markOverlaps(items) {
  // Build timeline entries only for items with start and end
  const timeline = items
    .map((it, idx) => {
      const s = toMinutes(it.startTime);
      const e = toMinutes(it.endTime);
      if (s == null || e == null) return null;
      // handle midnight crossing
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

/* -------------------- APP INIT -------------------- */
const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "25mb" }));

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

/* -------------------- PHOTO → PLAN PARSE (TIME BLOCKS) -------------------- */
app.post("/api/plan-photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No photo uploaded" });
    }

    const providedDate = String(req.body?.date || "").trim(); // optional
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

    // normalize + CA cleanup
    let items = Array.isArray(parsed.items) ? parsed.items : [];

    items = items.map((it) => {
      let subject = String(it.subject || "Unknown").trim() || "Unknown";
      let topic = String(it.topic || "").trim();

      // ✅ Current Affairs normalization
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

    // infer PM where needed
    items = inferHalfDay(items);

    // compute minutes when missing
    items = items.map((it) => {
      let mins = safeNum(it.minutes, 0);
      if ((!mins || mins <= 0) && it.startTime && it.endTime) {
        const d = diffMinutes(it.startTime, it.endTime);
        if (d != null) mins = d;
      }
      return { ...it, minutes: Math.max(0, Math.round(mins)) };
    });

    // add overlap status (NON-BLOCKING)
    items = markOverlaps(items);

    // ---- Syllabus Intelligence Enrichment (keep your logic) ----
    const tr = daysToPrelims(new Date());
    const kill = killSwitchMode(tr);

    const enrichedItems = items.map((it) => {
      const textForMap = `${it.subject} ${it.topic}`.trim();
      const nonStudy = isNonStudyBlock(it.subject, it.topic);

      // ✅ If non-study, do NOT map into syllabus
      let mapped = null;
      let fallbackPath = null;

      if (!nonStudy) {
        // Pass combined text for stronger semantic match
        mapped = mapPlanItemToMicroTheme(textForMap, it.subject);

        if (!mapped) {
          const m2 = findMicroTheme(textForMap || "");
          fallbackPath = m2?.found ? m2.path : null;
        }
      }

      const locked = kill === "ON" && mapped?.tag === "M";

      return {
        ...it,
        // keep subject as-is (do not override non-study blocks)
        subject:
          it.subject && it.subject !== "Unknown"
            ? it.subject
            : mapped?.subject
            ? mapped.subject
            : fallbackPath || "Unknown",
        mapped: mapped
          ? {
              code: mapped.code,
              gsPaper: mapped.gsPaper,
              gsHeading: mapped.gsHeading,
              macroTheme: mapped.macroTheme,
              subject: mapped.subject,
              microTheme: mapped.microTitle,
              tag: mapped.tag,
              caThemes: mapped.caThemes || [],
              confidence: mapped.confidence || 0,
              nonStudy,
            }
          : nonStudy
          ? {
              code: "NON_STUDY",
              gsPaper: "",
              gsHeading: "",
              macroTheme: "Non-Study",
              subject: "Non-Study",
              microTheme: it.subject || "Non-Study",
              tag: "X",
              caThemes: [],
              confidence: 1,
              nonStudy: true,
            }
          : null,
        locked,
      };
    });

    const totalMinutes = enrichedItems.reduce(
      (sum, x) => sum + (Number(x.minutes) || 0),
      0
    );

    const hasC1 = enrichedItems.some((x) => x.mapped?.code === "C.1");
    const csatDrill = hasC1 ? "CHECK_NUMERACY" : "NONE";

    return res.json({
      ok: true,
      date: safeDate,
      items: enrichedItems,
      totalMinutes,
      daysToPrelims: tr,
      killSwitchMode: kill,
      csatDrill,
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

/* -------------------- LISTEN (KEEP THIS LAST) -------------------- */
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

console.log("[BOOT] about to listen", { HOST, PORT });

/* -------------------- PROXY: FRONTEND -> BACKEND -> APPS SCRIPT (NO CORS) -------------------- */
app.post("/api/sheets", async (req, res) => {
  try {
    const scriptUrl = String(process.env.SCRIPT_URL || "").trim();
    if (!scriptUrl) {
      return res.status(500).json({ ok: false, message: "Missing SCRIPT_URL in backend .env" });
    }

    // Frontend sends: { action: "setup", ...payload }
    const payload = req.body || {};
    const action = String(payload.action || "").trim();
    if (!action) {
      return res.status(400).json({ ok: false, message: "Missing action" });
    }

    // Apps Script expects: data=<JSON string>
    const body = new URLSearchParams();
    body.set("data", JSON.stringify(payload));

    const r = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await r.text();

    // Try JSON else return raw
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

app.listen(PORT, HOST, () => {
  console.log(`backend running on http://${HOST}:${PORT}`);
});