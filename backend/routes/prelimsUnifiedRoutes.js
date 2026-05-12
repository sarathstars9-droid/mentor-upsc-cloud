// backend/routes/prelimsUnifiedRoutes.js
// Unified API for all prelims PYQ data (all subjects, all nodes, all microthemes).

import { Router } from "express";
import { loadAllPrelimsQuestions } from "../loaders/prelimsUnifiedLoader.js";

const router = Router();

// ── Module-level cache (loaded once on first request) ────────────────────────
let _questions = null;
let _byNode    = null;
let _byMicro   = null;
let _bySubject = null;
let _loadedAt  = null;

function ensureLoaded() {
  if (_questions) return;

  const { questions } = loadAllPrelimsQuestions();
  _questions  = questions;
  _loadedAt   = new Date().toISOString();

  _byNode = {};
  _byMicro = {};
  _bySubject = {};

  for (const q of questions) {
    const node  = q.nodeId || q.syllabusNodeId || "unknown";
    const micro = q.microTheme || "general";
    const subj  = q.subject    || "unknown";

    if (!_byNode[node])    _byNode[node]    = [];
    if (!_byMicro[micro])  _byMicro[micro]  = [];
    if (!_bySubject[subj]) _bySubject[subj] = [];

    _byNode[node].push(q);
    _byMicro[micro].push(q);
    _bySubject[subj].push(q);

    const isArtCulture = 
      subj === "art_culture" ||
      subj === "culture" ||
      node.startsWith("GS1-ART") ||
      node.includes("ART-CULTURE") ||
      /\b(art|culture|heritage|architecture|sculpture|painting|craft|festival|folk|classical)\b/i.test(q.topic || "") ||
      /\b(art|culture|heritage|architecture|sculpture|painting|craft|festival|folk|classical)\b/i.test(q.topicName || "") ||
      /\b(art|culture|heritage|architecture|sculpture|painting|craft|festival|folk|classical)\b/i.test(micro);

    if (isArtCulture && subj !== "art_culture") {
      if (!_bySubject["art_culture"]) _bySubject["art_culture"] = [];
      _bySubject["art_culture"].push(q);
    }
  }
}

// ── GET /api/prelims-unified/health ─────────────────────────────────────────
router.get("/health", (req, res) => {
  try {
    ensureLoaded();
    const bySubjectCount = {};
    for (const [s, qs] of Object.entries(_bySubject)) bySubjectCount[s] = qs.length;
    res.json({
      ok:         true,
      total:      _questions.length,
      subjects:   Object.keys(_bySubject).sort().length,
      nodes:      Object.keys(_byNode).length,
      microThemes: Object.keys(_byMicro).length,
      loadedAt:   _loadedAt,
      bySubject:  bySubjectCount,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/prelims-unified/questions ──────────────────────────────────────
// Query params: subject, nodeId, microTheme, year, limit (default 50)
router.get("/questions", (req, res) => {
  try {
    ensureLoaded();
    let { subject, nodeId, microTheme, year, limit } = req.query;
    const cap = Math.min(parseInt(limit, 10) || 50, 500);

    // ── Priority: nodeId wins over microTheme ─────────────────────────────────
    // Never filter by microTheme when nodeId is present.
    // Also strip sentinel "Unknown" values before they reach the filter.
    if (nodeId && nodeId.trim()) {
      nodeId = nodeId.trim();
      microTheme = null; // nodeId has strict priority
    }
    if (microTheme === "Unknown" || microTheme === "unknown" || microTheme === "") {
      microTheme = null;
    }

    let qs = _questions;

    if (subject) {
      qs = _bySubject[subject] || [];
    }

    if (nodeId) {
      // Match exact nodeId OR prefix (e.g. CSAT-LR matches CSAT-LR-DIR)
      // Also match questions whose topic field resolves to this nodeId (CSAT legacy)
      qs = qs.filter((q) => {
        const qNode = q.nodeId || q.syllabusNodeId || "";
        if (qNode === nodeId)                    return true;
        if (qNode.startsWith(nodeId + "-"))      return true;
        return false;
      });
    } else if (microTheme) {
      // microTheme filter: match microTheme field OR topic field (CSAT)
      qs = qs.filter((q) =>
        q.microTheme === microTheme ||
        q.topic       === microTheme
      );
    }

    if (year) {
      const yearNum = Number(year);
      qs = qs.filter(q => {
        if (!q.year) return false;
        const y = String(q.year).trim();
        if (y.includes("-")) return y.startsWith(String(yearNum));
        return Number(y) === yearNum;
      });
    }

    const total = qs.length;
    qs = qs.slice(0, cap);

    console.log("[CSAT FILTER]", { nodeId, microTheme, subject, before: _questions.length, after: total });
    res.json({ ok: true, total, returned: qs.length, questions: qs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ── GET /api/prelims-unified/node/:nodeId ────────────────────────────────────
router.get("/node/:nodeId", (req, res) => {
  try {
    ensureLoaded();
    const { nodeId } = req.params;
    const qs = (_questions || [])
      .filter((q) =>
        q.nodeId === nodeId || q.syllabusNodeId === nodeId ||
        q.nodeId?.startsWith(nodeId + "-") || q.syllabusNodeId?.startsWith(nodeId + "-"))
      .slice(0, 500);
    res.json({ ok: true, nodeId, count: qs.length, questions: qs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/prelims-unified/microtheme/:microTheme ──────────────────────────
router.get("/microtheme/:microTheme", (req, res) => {
  try {
    ensureLoaded();
    const { microTheme } = req.params;
    const qs = (_byMicro[microTheme] || []).slice(0, 500);
    res.json({ ok: true, microTheme, count: qs.length, questions: qs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
