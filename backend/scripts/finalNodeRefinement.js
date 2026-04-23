/**
 * finalNodeRefinement.js — Post-patchNodeIds cleanup
 *
 * Part A: Assigns GS1-HIS-ANC to 35 placeholder stubs in art_and_craft_india.json
 *         (all have question text "Question N", empty options, null year)
 *
 * Part B: Keyword-based env topic refinement for ca_environment_ecology.json
 *         Replaces uniform GS3-ENV-CONSERVATION with the most specific ENV sub-node
 *         when question text contains reliable topic signals.
 *
 * Part C: Generates a JSON review report for questions that still need human
 *         attention (junk header records, semantically dubious node assignments).
 *
 * Usage:  node backend/scripts/finalNodeRefinement.js
 * Safe to re-run: already-correct nodes are not re-touched.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const V2_ROOT   = path.resolve(__dirname, "../data/pyq_questions_v2/prelims");
const REPORT_PATH = path.resolve(__dirname, "../data/pyq_index/node_refinement_report.json");

// ── Part A: Art & Craft stubs ─────────────────────────────────────────────────

const ART_FILE   = path.join(V2_ROOT, "art_and_craft_india.json");
const ART_NODE   = "GS1-HIS-ANC";
const STUB_RE    = /^Question\s+\d+$/i; // "Question 1" … "Question 35"

function fixArtAndCraftStubs() {
  const raw = fs.readFileSync(ART_FILE, "utf8");
  const d   = JSON.parse(raw);
  const qs  = d.questions || [];

  let patched = 0;
  for (const q of qs) {
    if (!q || typeof q !== "object") continue;
    const isStub = STUB_RE.test((q.question || "").trim());
    if (!isStub) continue; // leave non-stub questions untouched

    let changed = false;
    if (!q.nodeId)         { q.nodeId         = ART_NODE; changed = true; }
    if (!q.syllabusNodeId) { q.syllabusNodeId = ART_NODE; changed = true; }
    // Already has correct node — keep but still flag for review
    if (q.nodeId === ART_NODE && !q.reviewRequired) {
      q.reviewRequired = true; changed = true;
    }
    if (changed) patched++;
  }

  if (patched > 0) {
    fs.writeFileSync(ART_FILE, JSON.stringify(d, null, 2), "utf8");
    console.log(`[PART A] art_and_craft_india.json: patched ${patched} stubs → ${ART_NODE}`);
  } else {
    console.log(`[PART A] art_and_craft_india.json: already correct (${qs.length} questions)`);
  }
  return patched;
}

// ── Part B: Environment topic refinement ──────────────────────────────────────

const ENV_FILE = path.join(
  V2_ROOT, "current_affairs", "ca_environment_ecology.json"
);

// Keyword patterns → target canonical node (ordered most-specific first)
// Only applied when the current node is the coarse fallback GS3-ENV-CONSERVATION
const ENV_RULES = [
  { node: "GS3-ENV-GLOBALWARM",  keywords: ["climate change","global warming","greenhouse","emission","temperature rise","carbon","ipcc","unfccc","kyoto","paris agreement","deforestation","desertification"] },
  { node: "GS3-ENV-SPECIES",     keywords: ["species","tiger","elephant","leopard","wildlife","sanctuary","national park","iucn","red list","endemic","biodiversity hotspot","wetland","ramsar","coral reef"] },
  { node: "GS3-ENV-POLLUTION",   keywords: ["pollution","waste","plastic","microplastic","air quality","ozone","smog","e-waste","solid waste","noise pollution","water pollution","toxin","hazardous"] },
  { node: "GS3-ENV-ENERGY",      keywords: ["solar","wind","renewable","nuclear energy","biofuel","hydropower","geothermal","energy efficiency","fossil fuel","coal","natural gas"] },
  { node: "GS3-ENV-LAND-WATER",  keywords: ["groundwater","river","aquifer","irrigation","drought","flood","soil erosion","land degradation","waterlogging","watershed"] },
];

const ENV_COARSE = "GS3-ENV-CONSERVATION"; // default that was assigned by patchNodeIds.js

function envNodeForQuestion(q) {
  const text = (q.question || "").toLowerCase();
  for (const rule of ENV_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return rule.node;
  }
  return null; // no refinement possible
}

function refineEnvQuestions() {
  if (!fs.existsSync(ENV_FILE)) {
    console.log("[PART B] ca_environment_ecology.json not found — skipping");
    return 0;
  }
  const raw = fs.readFileSync(ENV_FILE, "utf8");
  const d   = JSON.parse(raw);
  const qs  = d.questions || [];

  let patched = 0;
  for (const q of qs) {
    if (!q || typeof q !== "object") continue;
    // Only refine questions currently at the coarse fallback node
    if ((q.nodeId || q.syllabusNodeId) !== ENV_COARSE) continue;
    // Skip junk header records
    if (q.reviewRequired && !q.year) continue;

    const better = envNodeForQuestion(q);
    if (!better) continue;

    q.nodeId         = better;
    q.syllabusNodeId = better;
    patched++;
  }

  if (patched > 0) {
    fs.writeFileSync(ENV_FILE, JSON.stringify(d, null, 2), "utf8");
    console.log(`[PART B] ca_environment_ecology.json: refined ${patched} questions`);
  } else {
    console.log(`[PART B] ca_environment_ecology.json: no keyword matches found`);
  }
  return patched;
}

// ── Part C: Review report ─────────────────────────────────────────────────────

// Files where the node assignment is semantically loose and may need human review
const REVIEW_TARGETS = [
  { file: path.join(V2_ROOT, "current_affairs", "ca_sports.json"),
    reason: "Sports GK questions assigned to GS1-HIS-MOD (Modern History). No dedicated UPSC sports node exists; human review may assign to GS2-GOV-GOOD-GOV." },
  { file: path.join(V2_ROOT, "current_affairs", "ca_misc_gk.json"),
    reason: "Miscellaneous GK questions (awards, cricket, UN years) assigned to GS2-GOV-GOOD-GOV. Some may fit GS3-ECO-INCLUSIVE-GROWTH or GS2-IR-INSTITUTIONS." },
  { file: path.join(V2_ROOT, "current_affairs", "ca_awards_books_personalities.json"),
    reason: "Awards/books/personalities assigned to GS2-GOV-GOOD-GOV. May fit GS1-HIS-MOD or subject-specific nodes depending on award context." },
  { file: ART_FILE,
    reason: "35 placeholder stubs (question text 'Question N', empty options). Assigned GS1-HIS-ANC but contain no real content — should be replaced with actual PYQ data." },
];

const JUNK_HEADER_RE = /^Question count:\s*\d+/i;

function buildReviewReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    sections: [],
  };

  // Section 1: still-missing nodeId across entire v2 tree
  // Exclude csat/ — CSAT questions have no nodeId in source; it's assigned at build time
  // by deriveCsatNodeId() in buildPyqMasterIndex.js based on the module field.
  const missingNodeId = [];
  walk(V2_ROOT).filter(fp => !fp.replace(/\\/g, "/").includes("/csat/")).forEach(fp => {
    let d;
    try { d = JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return; }
    const qs = extractAllQuestions(d);
    for (const q of qs) {
      if (!q || typeof q !== "object") continue;
      if (!q.nodeId && !q.syllabusNodeId) {
        missingNodeId.push({
          file: path.relative(V2_ROOT, fp),
          id: q.id || null,
          question: (q.question || "").slice(0, 80),
        });
      }
    }
  });
  report.sections.push({
    title: "Questions still missing nodeId/syllabusNodeId",
    count: missingNodeId.length,
    items: missingNodeId,
  });

  // Section 2: junk header records (PDF extraction artifacts)
  const junkRecords = [];
  REVIEW_TARGETS.forEach(({ file }) => {
    if (!fs.existsSync(file)) return;
    let d;
    try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return; }
    const qs = (d.questions || []);
    for (const q of qs) {
      if (JUNK_HEADER_RE.test(q.question || "")) {
        junkRecords.push({
          file: path.relative(V2_ROOT, file),
          id: q.id,
          question: (q.question || "").slice(0, 100),
          nodeId: q.nodeId || q.syllabusNodeId || null,
        });
      }
    }
  });
  report.sections.push({
    title: "Junk PDF-extraction header records (should be deleted when real data is available)",
    count: junkRecords.length,
    items: junkRecords,
  });

  // Section 3: semantically loose node assignments
  const looseAssignments = [];
  REVIEW_TARGETS.forEach(({ file, reason }) => {
    if (!fs.existsSync(file)) return;
    let d;
    try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return; }
    const qs = (d.questions || []).filter(q => q && !JUNK_HEADER_RE.test(q.question || ""));
    if (qs.length > 0) {
      looseAssignments.push({
        file: path.relative(V2_ROOT, file),
        questions: qs.length,
        currentNode: qs[0]?.nodeId || qs[0]?.syllabusNodeId,
        reason,
        sample: qs.slice(0, 3).map(q => ({ id: q.id, year: q.year, question: (q.question || "").slice(0, 100) })),
      });
    }
  });
  report.sections.push({
    title: "Semantically loose node assignments requiring human review",
    count: looseAssignments.length,
    items: looseAssignments,
  });

  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`[PART C] Review report written to: ${path.relative(process.cwd(), REPORT_PATH)}`);
  return report;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const META_FILE_RE = /(_master|_report|_index|_by_node|_all_topics|_production|_perfection|_zero_ambiguity)/i;

function walk(dir) {
  const res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory())                                         res.push(...walk(fp));
    else if (e.name.endsWith(".json") && !META_FILE_RE.test(e.name)) res.push(fp);
  }
  return res;
}

function extractAllQuestions(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.questions)) return d.questions;
  if (Array.isArray(d.years)) {
    const out = [];
    for (const yr of d.years)
      for (const s of (yr.sets || []))
        if (Array.isArray(s.questions)) out.push(...s.questions);
    return out;
  }
  return [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("🔧 Final Node Refinement\n");

  const aPatched = fixArtAndCraftStubs();
  const bPatched = refineEnvQuestions();
  const report   = buildReviewReport();

  const missingCount = report.sections[0].count;
  const junkCount    = report.sections[1].count;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Part A — art stubs patched     : ${aPatched}`);
  console.log(`  Part B — env nodes refined      : ${bPatched}`);
  console.log(`  Still missing nodeId            : ${missingCount}`);
  console.log(`  Junk header records             : ${junkCount}`);
  console.log(`  Review report                   : ${path.relative(process.cwd(), REPORT_PATH)}`);
  if (missingCount === 0) {
    console.log("\n✅ All questions now have a syllabusNodeId.");
  } else {
    console.log(`\n⚠️  ${missingCount} questions still lack a nodeId — see report for details.`);
  }
}

main();
