/**
 * backend/scripts/auditSectionMapping.js
 *
 * AUDIT SCRIPT — Post-rebuild validation
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads all rebuilt files from:
 *   backend/data/pyq_rebuilt/prelims/gs/
 *
 * Checks:
 *   - Total questions
 *   - Repaired questions (mappingStatus !== "existing-valid")
 *   - Remaining invalid nodeIds
 *   - Remaining "Unmapped Topic" topic values
 *   - Remaining "Unknown" topic values
 *   - Sections not found in mapping table
 *   - Subject leakage (nodeId prefix doesn't match expected subject)
 *   - Top 20 repaired sections by count
 *
 * PASS only if:
 *   - remaining invalid nodeIds = 0
 *   - remaining "Unmapped Topic" = 0
 *   - remaining "Unknown" = 0
 *
 * Run: node backend/scripts/auditSectionMapping.js
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, "..");

const { isValidNodeId } = await import(pathToFileURL(join(BACKEND_ROOT, "brain/validNodeSet.js")).href);

const REBUILT_DIR = join(BACKEND_ROOT, "data/pyq_rebuilt/prelims/gs");
const SUMMARY_PATH = join(BACKEND_ROOT, "data/pyq_rebuilt/prelims/prelims_gs_rebuild_summary.json");

// ── Expected subject prefix map (for leakage detection) ───────────────────────
const EXPECTED_PREFIXES = {
  "Economy":             ["GS3-ECO"],
  "Polity":              ["GS2-POL"],
  "Polity and Governance": ["GS2-POL"],
  "Environment":         ["GS3-ENV"],
  "Science and Technology": ["GS3-ST"],
  "History":             ["GS1-HIS"],
  "Ancient Indian History": ["GS1-HIS-ANC"],
  "Medieval Indian History": ["GS1-HIS-MED"],
  "Modern Indian History": ["GS1-HIS-MOD", "GS1-HIS-POSTIND"],
  "Art and Culture":     ["1C-"],
  "Geography":           ["GS1-GEO"],
  "International Relations": ["GS2-IR"],
  "Society":             ["GS1-SOC"],
  "Current Affairs":     ["1C-MISC"],
  "Misc":                ["1C-MISC"],
};

// ── Counters ──────────────────────────────────────────────────────────────────
let total = 0;
let repairedCount = 0;
let invalidNodeCount = 0;
let unmappedTopicCount = 0;
let unknownCount = 0;
const leakageItems = [];
const missingSections = new Set();
const sectionRepairCounts = {};
const subjectLeakageMap = {};

// ── Load rebuilt files ────────────────────────────────────────────────────────
if (!existsSync(REBUILT_DIR)) {
  console.error(`[ERROR] Rebuilt directory not found: ${REBUILT_DIR}`);
  console.error("Run rebuildPrelimsTaggedFromSections.js first.");
  process.exit(1);
}

const files = readdirSync(REBUILT_DIR).filter(f => f.endsWith("_rebuilt.json"));

if (files.length === 0) {
  console.error("[ERROR] No rebuilt files found. Run rebuild script first.");
  process.exit(1);
}

console.log(`\n${"═".repeat(64)}`);
console.log("  PRELIMS PYQ SECTION MAPPING AUDIT");
console.log(`${"═".repeat(64)}`);
console.log(`  Auditing ${files.length} rebuilt files from:`);
console.log(`  ${REBUILT_DIR}\n`);

// ── Per-file audit ────────────────────────────────────────────────────────────
for (const filename of files) {
  const data = JSON.parse(readFileSync(join(REBUILT_DIR, filename), "utf8"));
  const fileSubject = data.subject || "";
  const questions = data.questions || [];

  for (const q of questions) {
    total++;

    const nodeId  = q.syllabusNodeId || "";
    const topic   = q.topic || "";
    const section = q.section || "";
    const status  = q.mappingStatus || "";
    const subject = q.subject || fileSubject;

    // Count repaired
    if (status !== "existing-valid") {
      repairedCount++;
      sectionRepairCounts[section] = (sectionRepairCounts[section] || 0) + 1;
    }

    // Check invalid nodeId
    if (!nodeId || !isValidNodeId(nodeId)) {
      invalidNodeCount++;
      console.warn(`  [INVALID NODE] id=${q.id}  node=${nodeId}`);
    }

    // Check "Unmapped Topic"
    if (topic === "Unmapped Topic") {
      unmappedTopicCount++;
      console.warn(`  [UNMAPPED TOPIC] id=${q.id}  section=${section}`);
    }

    // Check "Unknown"
    if (topic.toLowerCase() === "unknown") {
      unknownCount++;
      console.warn(`  [UNKNOWN TOPIC] id=${q.id}  section=${section}`);
    }

    // Check subject leakage
    if (subject && nodeId) {
      const expectedPrefixes = EXPECTED_PREFIXES[subject];
      if (expectedPrefixes) {
        const hasExpected = expectedPrefixes.some(p => nodeId.startsWith(p));
        if (!hasExpected) {
          leakageItems.push({ id: q.id, subject, nodeId, section });
          subjectLeakageMap[subject] = (subjectLeakageMap[subject] || 0) + 1;
        }
      }
    }

    // Track sections that needed fallback (possibly missing from map)
    if (status === "subject-fallback") {
      missingSections.add(`${subject} > ${section}`);
    }
  }
}

// ── Print results ─────────────────────────────────────────────────────────────
console.log(`${"─".repeat(64)}`);
console.log(`  TOTALS`);
console.log(`${"─".repeat(64)}`);
console.log(`  Total questions          : ${total}`);
console.log(`  Repaired questions       : ${repairedCount} (${((repairedCount/total)*100).toFixed(1)}%)`);
console.log(`  Invalid nodeIds          : ${invalidNodeCount}`);
console.log(`  "Unmapped Topic" remaining: ${unmappedTopicCount}`);
console.log(`  "Unknown" remaining       : ${unknownCount}`);

// Missing sections
if (missingSections.size > 0) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  SECTIONS MISSING FROM MAP (${missingSections.size})`);
  console.log(`${"─".repeat(64)}`);
  for (const s of [...missingSections].sort()) {
    console.log(`  ⚠  ${s}`);
  }
}

// Subject leakage
if (leakageItems.length > 0) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  SUBJECT LEAKAGE DETECTED (${leakageItems.length} questions)`);
  console.log(`${"─".repeat(64)}`);
  for (const [subj, count] of Object.entries(subjectLeakageMap)) {
    console.log(`  ${subj.padEnd(30)}: ${count} questions`);
  }
  // Show first 10 examples
  const examples = leakageItems.slice(0, 10);
  console.log(`\n  Sample leakage (first ${examples.length}):`);
  for (const ex of examples) {
    console.log(`    id=${ex.id}  subject=${ex.subject}  node=${ex.nodeId}  section=${ex.section}`);
  }
}

// Top 20 repaired sections
const topRepaired = Object.entries(sectionRepairCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 20);

console.log(`\n${"─".repeat(64)}`);
console.log(`  TOP 20 REPAIRED SECTIONS`);
console.log(`${"─".repeat(64)}`);
for (const [section, count] of topRepaired) {
  console.log(`  ${count.toString().padStart(4)} ✦ ${section}`);
}

// ── PASS / FAIL summary ───────────────────────────────────────────────────────
const pass =
  invalidNodeCount === 0 &&
  unmappedTopicCount === 0 &&
  unknownCount === 0;

console.log(`\n${"═".repeat(64)}`);
console.log(`  AUDIT RESULT: ${pass ? "✅  PASS" : "❌  FAIL"}`);
if (!pass) {
  if (invalidNodeCount > 0)  console.log(`  ✗ ${invalidNodeCount} invalid nodeIds remain`);
  if (unmappedTopicCount > 0) console.log(`  ✗ ${unmappedTopicCount} "Unmapped Topic" remain`);
  if (unknownCount > 0)       console.log(`  ✗ ${unknownCount} "Unknown" topics remain`);
}
console.log(`${"═".repeat(64)}\n`);

// Cross-check with rebuild summary if it exists
if (existsSync(SUMMARY_PATH)) {
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
  console.log("  Rebuild summary cross-check:");
  console.log(`    totalFiles      : ${summary.totalFiles}`);
  console.log(`    totalQuestions  : ${summary.totalQuestions}`);
  console.log(`    repairedQ       : ${summary.repairedQuestions}`);
  console.log(`    invalidOldNodes : ${summary.invalidOldNodeIds}`);
  console.log(`    unresolvedSect  : ${summary.unresolvedSections}`);
  console.log("");
}
