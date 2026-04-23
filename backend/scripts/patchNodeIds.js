/**
 * patchNodeIds.js — One-time migration
 *
 * Rewrites nodeId + syllabusNodeId in every question across all v2 JSON files.
 * Only modifies those two fields. All other content is preserved exactly.
 *
 * Usage:  node backend/scripts/patchNodeIds.js
 * Safe to re-run: already-correct IDs are unchanged.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "../data/pyq_questions_v2/prelims");

// ── Canonical alias map (source → target) ─────────────────────────────────────
const ALIAS = {
  // Current affairs
  "CA-ABP":           "GS2-GOV-GOOD-GOV",
  "CA-MISC":          "GS2-GOV-GOOD-GOV",
  "CA-SPORT":         "GS1-HIS-MOD",
  "GS1-CA-CULT":      "GS1-HIS-ANC",
  "GS1-CA-GEO":       "GS1-GEO-IND",
  "GS1-CA-HIST":      "GS1-HIS-MOD",
  "GS2-CA-GOV":       "GS2-GOV-GOOD-GOV",
  "GS2-CA-IR":        "GS2-IR-INSTITUTIONS",
  "GS3-CA-ECO":       "GS3-ECO-INCLUSIVE-GROWTH",
  "GS3-CA-ENV":       "GS3-ENV-CONSERVATION",
  "GS3-CA-SCI":       "GS3-ST-GENSCI-BIO",
  "GS3-CA-GENSCI":    "GS3-ST-GENSCI-BIO",
  // Geography
  "geo.indian-geography": "GS1-GEO-IND",
  "geo.climatology":      "GS1-GEO-IND-CLIMATE",
  "geo.geomorphology":    "GS1-GEO-IND",
  "geo.oceanography":     "GS1-GEO-IND",
  "geo.agriculture":      "GS1-GEO-IND-AGRI",
  "geo.world-mapping":       "GS1-GEO-IND",
  "geo.world-regions":       "GS1-GEO-IND",
  "geo.economic-geography":  "GS1-GEO-IND",
  "geo.industry-resources":  "GS1-GEO-IND",
  // Science & Technology
  "GS3-SCI-TECH-SPACE":     "GS3-ST-SPACE",
  "GS3-SCI-TECH-IT":        "GS3-ST-IT-COMM",
  "GS3-SCI-TECH-BIOTECH":   "GS3-ST-BIOTECH",
  "GS3-SCI-TECH-GENERAL":   "GS3-ST-GENSCI-BIO",
  "GS3-SCI-TECH-MATERIALS": "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-SCI-TECH-ROBOTICS":  "GS3-ST-MATERIALS-NANO-ROBOTICS-AI",
  "GS3-SCI-TECH-HEALTH":    "GS3-ST-GENSCI-BIO",
  "GS3-SCI-TECH-ENERGY":    "GS3-ENV-ENERGY",
  // Polity
  "GS2-POL-PARLIAMENT": "GS2-POL-PARL",
  "GS2-POL-STATE-LEG":  "GS2-POL-STATE",
};

const META_FILE_RE = /(_master|_report|_index|_by_node|_all_topics|_production|_perfection|_zero_ambiguity)/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function walk(dir) {
  const res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) res.push(...walk(fp));
    else if (e.name.endsWith(".json") && !META_FILE_RE.test(e.name)) res.push(fp);
  }
  return res;
}

/** Patch a single question object in-place. Returns true if changed. */
function patchQuestion(q) {
  let changed = false;
  const canon = ALIAS[q.nodeId] || ALIAS[q.syllabusNodeId];
  if (!canon) return false;

  if (q.nodeId        && ALIAS[q.nodeId])        { q.nodeId        = canon; changed = true; }
  if (q.syllabusNodeId && ALIAS[q.syllabusNodeId]) { q.syllabusNodeId = canon; changed = true; }
  // Keep them in sync: if one is set to canon, mirror to the other
  if (changed) {
    q.nodeId        = q.nodeId        || canon;
    q.syllabusNodeId = q.syllabusNodeId || canon;
  }
  return changed;
}

/** Extract question arrays from any supported JSON format (returns mutable refs). */
function extractQuestionArrays(d) {
  if (Array.isArray(d))            return [d];
  if (Array.isArray(d.questions))  return [d.questions];
  if (Array.isArray(d.years)) {
    const arrays = [];
    for (const yr of d.years)
      for (const s of (yr.sets || []))
        if (Array.isArray(s.questions)) arrays.push(s.questions);
    return arrays;
  }
  return [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const files = walk(ROOT);

  let totalFiles   = 0;
  let totalPatched = 0;

  for (const fp of files) {
    let raw;
    try { raw = fs.readFileSync(fp, "utf8"); } catch { continue; }

    let d;
    try { d = JSON.parse(raw); } catch {
      console.warn(`[SKIP] JSON parse error: ${fp}`);
      continue;
    }

    const arrays = extractQuestionArrays(d);
    let fileChanged = 0;

    for (const arr of arrays) {
      for (const q of arr) {
        if (q && typeof q === "object" && patchQuestion(q)) fileChanged++;
      }
    }

    if (fileChanged > 0) {
      fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf8");
      console.log(`[PATCHED] ${path.relative(ROOT, fp).padEnd(70)}  ${fileChanged} questions`);
      totalFiles++;
      totalPatched += fileChanged;
    }
  }

  console.log(`\n✅ Done — ${totalFiles} files updated, ${totalPatched} questions patched.`);
}

main();
