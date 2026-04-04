// backend/routes/mainsThemeRoutes.js
// Mains-only theme intelligence API routes.
// Mount in server.js under: app.use("/api/mains", mainsThemeRoutes)
//
// Endpoints:
//   GET /api/mains/themes/:paper                                              → subject-theme tree
//   GET /api/mains/themes/:paper/:subject                                     → themes + subthemes under one subject
//   GET /api/mains/pyqs/by-theme?paper=&subject=&theme=                       → questions for a theme
//   GET /api/mains/pyqs/by-subtheme?paper=&subject=&theme=&subtheme=          → questions for a subtheme
//   GET /api/mains/themes-unmatched/:paper                                    → audit log of unmatched questions

import express from "express";
import {
  buildMainsThemeIndex,
  loadAllMainsQuestions,
  getSubjectTreeForPaper,
  getQuestionIdsForTheme,
  getQuestionIdsForSubtheme,
} from "../brain/mainsThemeAggregator.js";

const router = express.Router();

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Built once on first request; never touches disk at runtime.
let _indexCache     = null;
let _unmatchedCache = null;
let _questionsCache = null;  // full question map keyed by id

function getIndex() {
  if (!_indexCache) {
    console.log("[mainsThemeRoutes] Building theme index (first request)...");
    const result     = buildMainsThemeIndex();
    _indexCache      = result.matched;
    _unmatchedCache  = result.unmatched;
    console.log(
      `[mainsThemeRoutes] Index ready — ${result.totalQuestions} questions, ` +
      `${result.unmatched.length} unmatched`
    );
  }
  return _indexCache;
}

function getQuestionsById() {
  if (!_questionsCache) {
    const all = loadAllMainsQuestions();
    _questionsCache = new Map();
    for (const q of all) {
      const id = String(q?.id || "").trim();
      if (id) _questionsCache.set(id, q);
    }
  }
  return _questionsCache;
}

// ─── Helper: resolve IDs → full question objects ──────────────────────────────
function resolveQuestions(ids) {
  const qMap   = getQuestionsById();
  const result = [];
  for (const id of ids) {
    const q = qMap.get(id);
    if (q) result.push(q);
  }
  return result;
}

// ─── Normalize paper param ────────────────────────────────────────────────────
function normPaper(raw) {
  return String(raw || "").toUpperCase().trim();
}

const VALID_PAPERS = ["GS1", "GS2", "GS3", "GS4"];

// ─── A. GET /themes/:paper ────────────────────────────────────────────────────
// Returns: { ok, paper, subjectCount, tree: [ { subject, count, themes: [...] } ] }
// Each subtheme in tree includes: name, count, lastAskedYear, years, directives, topDirective
router.get("/themes/:paper", (req, res) => {
  try {
    const paper = normPaper(req.params.paper);
    if (!VALID_PAPERS.includes(paper)) {
      return res.status(400).json({ ok: false, error: `Invalid paper. Valid: ${VALID_PAPERS.join(", ")}` });
    }

    const index = getIndex();
    const tree  = getSubjectTreeForPaper(index, paper);

    return res.json({ ok: true, paper, subjectCount: tree.length, tree });
  } catch (err) {
    console.error("[mainsThemeRoutes] /themes/:paper error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load theme tree" });
  }
});

// ─── B. GET /themes/:paper/:subject ──────────────────────────────────────────
// Returns: { ok, paper, subject, themeCount, themes: [...] }
// Each subtheme includes: name, count, lastAskedYear, years, directives, topDirective
router.get("/themes/:paper/:subject", (req, res) => {
  try {
    const paper   = normPaper(req.params.paper);
    const subject = decodeURIComponent(req.params.subject || "").trim();

    const index       = getIndex();
    const subjectData = index?.[paper]?.[subject] || {};

    const themes = Object.entries(subjectData).map(([themeName, subthemes]) => {
      let themeTotal = 0;
      const subthemeList = Object.entries(subthemes).map(([subthemeName, bucket]) => {
        themeTotal += bucket.count || 0;
        return {
          name:             subthemeName,
          count:            bucket.count            || 0,
          lastAskedYear:    bucket.lastAskedYear    || null,
          years:            bucket.years            || [],
          directives:       bucket.directives       || {},
          topDirective:     bucket.topDirective     || null,
          avgConfidence:    bucket.avgConfidence    ?? null,
          matchModeSummary: bucket.matchModeSummary || {},
        };
      });
      subthemeList.sort((a, b) => (b.lastAskedYear || 0) - (a.lastAskedYear || 0));
      return { name: themeName, count: themeTotal, subthemes: subthemeList };
    });

    themes.sort((a, b) => b.count - a.count);

    return res.json({ ok: true, paper, subject, themeCount: themes.length, themes });
  } catch (err) {
    console.error("[mainsThemeRoutes] /themes/:paper/:subject error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load subject themes" });
  }
});

// ─── C. GET /pyqs/by-theme ───────────────────────────────────────────────────
// Query: ?paper=GS3&subject=Economy&theme=Public%20Finance
// Returns: { ok, questions, count, years, lastAskedYear }
router.get("/pyqs/by-theme", (req, res) => {
  try {
    const paper   = normPaper(req.query.paper);
    const subject = String(req.query.subject || "").trim();
    const theme   = String(req.query.theme   || "").trim();

    if (!paper || !subject || !theme) {
      return res.status(400).json({ ok: false, error: "paper, subject, and theme are required" });
    }

    const index = getIndex();
    const { questionIds, count, years, lastAskedYear } =
      getQuestionIdsForTheme(index, paper, subject, theme);

    const questions = resolveQuestions(questionIds);

    return res.json({ ok: true, paper, subject, theme, count, years, lastAskedYear, questions });
  } catch (err) {
    console.error("[mainsThemeRoutes] /pyqs/by-theme error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load theme PYQs" });
  }
});

// ─── D. GET /pyqs/by-subtheme ────────────────────────────────────────────────
// Query: ?paper=GS4&subject=Ethics%20Theory&theme=...&subtheme=...
// Returns: { ok, questions, count, years, lastAskedYear, directives, topDirective }
router.get("/pyqs/by-subtheme", (req, res) => {
  try {
    const paper    = normPaper(req.query.paper);
    const subject  = String(req.query.subject  || "").trim();
    const theme    = String(req.query.theme    || "").trim();
    const subtheme = String(req.query.subtheme || "").trim();

    if (!paper || !subject || !theme || !subtheme) {
      return res.status(400).json({
        ok: false, error: "paper, subject, theme, and subtheme are required",
      });
    }

    const index  = getIndex();
    const bucket = getQuestionIdsForSubtheme(index, paper, subject, theme, subtheme);

    const questions = resolveQuestions(bucket.questionIds);

    return res.json({
      ok: true,
      paper, subject, theme, subtheme,
      count:            bucket.count,
      years:            bucket.years,
      lastAskedYear:    bucket.lastAskedYear,
      directives:       bucket.directives,
      topDirective:     bucket.topDirective,
      avgConfidence:    bucket.avgConfidence,
      matchModeSummary: bucket.matchModeSummary,
      questions,
    });
  } catch (err) {
    console.error("[mainsThemeRoutes] /pyqs/by-subtheme error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load subtheme PYQs" });
  }
});

// ─── E. GET /themes-unmatched/:paper ─────────────────────────────────────────
// Returns unmatched records for audit/debug.
// Each entry: { id, paper, question, theme, syllabusNodeId, bestCandidate, reason }
router.get("/themes-unmatched/:paper", (req, res) => {
  try {
    const paper = normPaper(req.params.paper);
    getIndex(); // ensure built

    const unmatched = (_unmatchedCache || []).filter(u =>
      !paper || u.paper === paper
    );
    return res.json({ ok: true, paper, count: unmatched.length, unmatched });
  } catch (err) {
    console.error("[mainsThemeRoutes] /themes-unmatched error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load unmatched" });
  }
});

export default router;
