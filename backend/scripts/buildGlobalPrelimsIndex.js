// backend/scripts/buildGlobalPrelimsIndex.js
// Builds four global index files from the unified prelims loader.
//
// Usage:  cd backend && npm run build:prelims-global

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadAllPrelimsQuestions } from "../loaders/prelimsUnifiedLoader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "../data/pyq_questions_v2");

function writeJson(filePath, obj) {
  writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

async function build() {
  console.log("⚙️  Loading all prelims questions…");
  const start = Date.now();
  const { questions, audit } = loadAllPrelimsQuestions();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`   Loaded ${questions.length} questions in ${elapsed}s`);

  // ── 1. global_master_index.json ─────────────────────────────────────────
  const masterIndex = {
    schemaVersion: "mentoros-global-prelims-v1",
    generatedAt:   new Date().toISOString(),
    totalQuestions: questions.length,
    subjects:      [...new Set(questions.map((q) => q.subject))].sort(),
    questions,
  };
  writeJson(join(OUTPUT_DIR, "global_master_index.json"), masterIndex);
  console.log(`✅  global_master_index.json  (${questions.length} questions)`);

  // ── 2. global_by_node_index.json ────────────────────────────────────────
  const byNode = {};
  for (const q of questions) {
    const key = q.nodeId || q.syllabusNodeId || "unknown";
    if (!byNode[key]) byNode[key] = [];
    byNode[key].push(q.id);
  }
  const byNodeOut = {
    schemaVersion: "mentoros-global-by-node-v1",
    generatedAt:   new Date().toISOString(),
    totalNodes:    Object.keys(byNode).length,
    index:         byNode,
  };
  writeJson(join(OUTPUT_DIR, "global_by_node_index.json"), byNodeOut);
  console.log(`✅  global_by_node_index.json  (${Object.keys(byNode).length} nodes)`);

  // ── 3. global_microtheme_index.json ─────────────────────────────────────
  const byMicro = {};
  for (const q of questions) {
    const key = q.microTheme || "general";
    if (!byMicro[key]) byMicro[key] = [];
    byMicro[key].push(q.id);
  }
  const microOut = {
    schemaVersion:    "mentoros-global-microtheme-v1",
    generatedAt:      new Date().toISOString(),
    totalMicroThemes: Object.keys(byMicro).length,
    index:            byMicro,
  };
  writeJson(join(OUTPUT_DIR, "global_microtheme_index.json"), microOut);
  console.log(`✅  global_microtheme_index.json  (${Object.keys(byMicro).length} microthemes)`);

  // ── 4. global_audit_report.json ─────────────────────────────────────────
  const bySubject = {};
  for (const q of questions) {
    bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
  }

  const auditReport = {
    schemaVersion:    "mentoros-global-audit-v1",
    generatedAt:      new Date().toISOString(),
    totalFiles:       audit.totalFiles,
    loadedFiles:      audit.loadedFiles,
    skippedFiles:     audit.skippedFiles,
    totalLoaded:      audit.totalLoaded,
    skippedQuestions: audit.skipped,
    duplicatesRemoved: audit.duplicatesRemoved,
    subjectsFound:    audit.subjectsFound,
    bySubject,
    fileErrors:       audit.fileErrors,
  };
  writeJson(join(OUTPUT_DIR, "global_audit_report.json"), auditReport);
  console.log(`✅  global_audit_report.json`);

  // ── Console summary ──────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BUILD COMPLETE
  Total questions loaded : ${audit.totalLoaded}
  Skipped (no text)      : ${audit.skipped}
  Duplicates removed     : ${audit.duplicatesRemoved}
  Files scanned          : ${audit.totalFiles}
  Files loaded           : ${audit.loadedFiles}
  Files skipped          : ${audit.skippedFiles}
  File errors            : ${audit.fileErrors.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (audit.fileErrors.length) {
    console.log("  File errors:");
    audit.fileErrors.forEach((e) => console.log(`    ${e.file}: ${e.error}`));
  }

  console.log("\n  By subject:");
  for (const [subj, cnt] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(cnt).padStart(5)}  ${subj}`);
  }
  console.log("");
}

build().catch((e) => { console.error("Build failed:", e); process.exit(1); });
