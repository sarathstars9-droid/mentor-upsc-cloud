// backend/routes/mainsRoutes.js
// Clean unified mains PYQ API — backed by mains_master_clean_fixed.json.
// Mount in server.js: app.use("/api/mains", mainsRoutes)
//
// Endpoints:
//   GET /api/mains/questions
//       ?paper=GS1|GS2|GS3          (optional)
//       ?year=2023                   (optional, numeric)
//       ?subject=Economy             (optional, case-insensitive)
//       ?syllabusNodeId=MAINS-ECO-01 (optional)
//
// Response:
//   { ok: true, count: <n>, questions: [...] }

import express from "express";
import { loadMainsQuestions } from "../loaders/mainsLoader.js";

const router = express.Router();

// ─── GET /api/mains/questions ─────────────────────────────────────────────────
router.get("/questions", (req, res) => {
  try {
    const allQuestions = loadMainsQuestions();

    const { paper, year, subject, syllabusNodeId } = req.query;

    let filtered = allQuestions;

    // Filter: paper (GS1 / GS2 / GS3) — exact match, case-insensitive
    if (paper) {
      const paperUpper = paper.trim().toUpperCase();
      filtered = filtered.filter(
        (q) => (q.paper || "").toUpperCase() === paperUpper
      );
    }

    // Filter: year — coerce to number for a reliable match
    if (year) {
      const yearNum = Number(year);
      if (!Number.isNaN(yearNum)) {
        filtered = filtered.filter((q) => Number(q.year) === yearNum);
      }
    }

    // Filter: subject — case-insensitive partial match
    if (subject) {
      const subjectLower = subject.trim().toLowerCase();
      filtered = filtered.filter((q) =>
        (q.subject || "").toLowerCase().includes(subjectLower)
      );
    }

    // Filter: syllabusNodeId — exact match
    if (syllabusNodeId) {
      const nodeId = syllabusNodeId.trim();
      filtered = filtered.filter((q) => q.syllabusNodeId === nodeId);
    }

    return res.json({ ok: true, count: filtered.length, questions: filtered });
  } catch (err) {
    console.error("[mainsRoutes] GET /questions error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to load mains questions",
      detail: err.message,
    });
  }
});

export default router;
