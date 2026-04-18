// backend/routes/subjectPyqRoutes.js
// GET /api/subject-pyq?subject=essay|ethics|geography_optional
// Returns { questions: [...] } from the tagged mains JSON files.

import express from "express";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data/pyq_questions/mains");

function loadJson(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"));
}

router.get("/", (req, res) => {
  const { subject } = req.query;

  try {
    if (subject === "essay") {
      const data = loadJson("mains_essay_tagged.json");
      return res.json({ questions: data.topics || [] });
    }

    if (subject === "ethics") {
      const data = loadJson("mains_gs4_ethics_tagged.json");
      return res.json({ questions: data.questions || [] });
    }

    if (subject === "geography_optional") {
      const p1 = loadJson("optional_geography_paper1_tagged.json");
      const p2 = loadJson("optional_geography_paper2_tagged.json");
      const arr1 = Array.isArray(p1) ? p1 : [];
      const arr2 = Array.isArray(p2) ? p2 : [];
      return res.json({ questions: [...arr1, ...arr2] });
    }

    return res.status(400).json({ error: "Unknown subject. Use: essay, ethics, or geography_optional" });
  } catch (err) {
    console.error("[subject-pyq]", err.message);
    return res.status(500).json({ error: "Failed to load subject PYQ data" });
  }
});

export default router;
