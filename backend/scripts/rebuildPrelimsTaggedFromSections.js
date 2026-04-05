/**
 * backend/scripts/rebuildPrelimsTaggedFromSections.js
 *
 * PRELIMS PYQ REBUILD PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads all tagged source files from:
 *   backend/data/pyq_questions/prelims/gs/
 *
 * For each question:
 *   1. Uses question.section as the PDF bucket key
 *   2. Resolves to canonical syllabusNodeId via pdfResolver
 *   3. Repairs invalid old nodeIds
 *   4. Replaces "Unmapped Topic" with derived topic label
 *   5. Writes rebuilt output to: backend/data/pyq_rebuilt/prelims/gs/
 *
 * Run: node backend/scripts/rebuildPrelimsTaggedFromSections.js
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, "..");

// ── Dynamic import of ESM modules ────────────────────────────────────────────
// pathToFileURL required on Windows for absolute path imports
const { resolveNode, deriveTopic } = await import(
  pathToFileURL(join(BACKEND_ROOT, "blockResolution/pdfResolver.js")).href
);
const { isValidNodeId } = await import(
  pathToFileURL(join(BACKEND_ROOT, "brain/validNodeSet.js")).href
);

// ── Paths ─────────────────────────────────────────────────────────────────────
const SOURCE_DIR = join(BACKEND_ROOT, "data/pyq_questions/prelims/gs");
const OUTPUT_DIR = join(BACKEND_ROOT, "data/pyq_rebuilt/prelims/gs");
const SUMMARY_PATH = join(BACKEND_ROOT, "data/pyq_rebuilt/prelims/prelims_gs_rebuild_summary.json");

// Ensure output dir exists
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Stats counters ────────────────────────────────────────────────────────────
let totalFiles = 0;
let totalQuestions = 0;
let repairedQuestions = 0;
let invalidOldNodeIds = 0;
let unresolvedSections = 0;
const unmappedSections = new Set();
const remainingUnmappedTopic = { count: 0 };
const remainingUnknown = { count: 0 };
let remainingInvalidNodeIds = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map mappingStatus from resolver → clean label for output
 */
function toMappingStatus(resolverStatus) {
  if (resolverStatus === "keyword-match") return "refined";
  if (resolverStatus === "fallback") return "fallback";
  if (resolverStatus === "existing-valid") return "existing-valid";
  if (resolverStatus === "subject-fallback") return "subject-fallback";
  return "fallback";
}

/**
 * Derive a topic string from the section label when resolver gives a fallback.
 * This ensures we never write "Unmapped Topic".
 */
function deriveTopicFromSection(section) {
  if (!section) return "General";
  // Strip leading numbering like "1B1: " or "2A1: "
  const stripped = section.replace(/^\d+[A-Z]*\d*:\s*/, "").trim();
  return stripped || "General";
}

// ── Source file list ──────────────────────────────────────────────────────────
const allFiles = readdirSync(SOURCE_DIR).filter(f => f.endsWith("_tagged.json"));

console.log(`\n${"═".repeat(60)}`);
console.log("  PRELIMS PYQ REBUILD PIPELINE");
console.log(`${"═".repeat(60)}`);
console.log(`Source dir : ${SOURCE_DIR}`);
console.log(`Output dir : ${OUTPUT_DIR}`);
console.log(`Files found: ${allFiles.length}`);
console.log(`${"─".repeat(60)}\n`);

// ── Process each file ─────────────────────────────────────────────────────────
for (const filename of allFiles) {
  const filePath = join(SOURCE_DIR, filename);
  let raw;

  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`[ERROR] Could not parse ${filename}: ${e.message}`);
    continue;
  }

  totalFiles++;

  const questions = raw.questions || [];
  const rebuiltQuestions = [];

  for (const q of questions) {
    totalQuestions++;

    const oldNodeId   = q.syllabusNodeId || "";
    const section     = q.section || "";
    const microtheme  = q.microtheme || "";
    const subject     = q.subject || raw.subject || "";
    const questionText = q.question || "";
    const oldTopic    = q.topic || "";

    // Track invalid old nodes
    const oldWasInvalid = oldNodeId && !isValidNodeId(oldNodeId);
    if (oldWasInvalid) invalidOldNodeIds++;

    // ── Resolve via pdfResolver ──────────────────────────────────────────────
    // Primary: use section as the PDF bucket key
    // Secondary: attempt refinement via microtheme if section fails
    let resolved = resolveNode({
      pdfSubject: subject,
      pdfSection: section,
      questionText: questionText,
      existingNodeId: oldWasInvalid ? null : oldNodeId,
    });

    // If still on subject-fallback, try microtheme as an alternative section key
    if (
      resolved.mappingStatus === "subject-fallback" &&
      microtheme &&
      microtheme !== section
    ) {
      const alt = resolveNode({
        pdfSubject: subject,
        pdfSection: microtheme,
        questionText: questionText,
        existingNodeId: null,
      });
      if (alt.mappingStatus !== "subject-fallback") {
        resolved = alt;
      }
    }

    // Track unresolved sections
    if (resolved.mappingStatus === "subject-fallback") {
      unresolvedSections++;
      unmappedSections.add(`${subject} > ${section}`);
    }

    // Determine final topic label — NEVER "Unmapped Topic"
    let finalTopic;
    if (
      !oldTopic ||
      oldTopic === "Unmapped Topic" ||
      oldTopic.toLowerCase() === "unknown"
    ) {
      // Use resolver-derived topic, or fall back to section label
      finalTopic = resolved.topic || deriveTopicFromSection(section);
      if (oldTopic === "Unmapped Topic" || !oldTopic) repairedQuestions++;
    } else {
      // Keep existing clean topic, but verify node
      finalTopic = oldTopic;
      if (oldWasInvalid) repairedQuestions++;
    }

    // Final safety: never emit "Unmapped Topic" or "Unknown"
    if (!finalTopic || finalTopic === "Unmapped Topic") {
      finalTopic = deriveTopicFromSection(section);
      repairedQuestions++;
    }
    if (finalTopic.toLowerCase() === "unknown") {
      finalTopic = deriveTopicFromSection(section);
    }

    // Validate final nodeId
    const finalNodeId = resolved.syllabusNodeId;
    if (!isValidNodeId(finalNodeId)) {
      console.warn(`  [WARN] Invalid resolved nodeId: ${finalNodeId} for question ${q.id}`);
      remainingInvalidNodeIds++;
    }

    // Audit remaining bad values
    if (finalTopic === "Unmapped Topic") remainingUnmappedTopic.count++;
    if (finalTopic.toLowerCase() === "unknown") remainingUnknown.count++;

    // ── Build output question ────────────────────────────────────────────────
    const rebuilt = {
      id: q.id,
      exam: q.exam,
      stage: q.stage,
      paper: q.paper,
      subject: q.subject,
      section: q.section,
      microtheme: q.microtheme,
      year: q.year,
      questionNumber: q.questionNumber,
      questionType: q.questionType,
      format: q.format,
      question: q.question,
      options: q.options,
      answer: q.answer,
      // ── Resolved mapping fields ──
      syllabusNodeId: finalNodeId,
      pdfBucket: section,
      topic: finalTopic,
      mappingStatus: toMappingStatus(resolved.mappingStatus),
      mappingReason: resolved.reason,
      // Preserve audit for debugging
      mappingAudit: {
        oldNodeId: oldNodeId || null,
        oldNodeWasInvalid: oldWasInvalid,
        resolvedBy: resolved.reason,
      },
    };

    rebuiltQuestions.push(rebuilt);
  }

  // ── Write output file ──────────────────────────────────────────────────────
  const outFilename = filename.replace("_tagged.json", "_rebuilt.json");
  const outPath = join(OUTPUT_DIR, outFilename);

  const outData = {
    sourceFile: raw.sourceFile || filename,
    exam: raw.exam,
    stage: raw.stage,
    paper: raw.paper,
    subject: raw.subject,
    rebuiltAt: new Date().toISOString(),
    questions: rebuiltQuestions,
  };

  writeFileSync(outPath, JSON.stringify(outData, null, 2), "utf8");
  console.log(`  ✔ ${filename.padEnd(55)} → ${outFilename}  [${rebuiltQuestions.length} questions]`);
}

// ── Write summary ─────────────────────────────────────────────────────────────
const summary = {
  rebuiltAt: new Date().toISOString(),
  totalFiles,
  totalQuestions,
  repairedQuestions,
  invalidOldNodeIds,
  unresolvedSections,
  unmappedSectionsCount: unmappedSections.size,
  unmappedSectionsList: [...unmappedSections].sort(),
  remainingUnmappedTopic: remainingUnmappedTopic.count,
  remainingUnknown: remainingUnknown.count,
  remainingInvalidNodeIds,
};

writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf8");

// ── Final console report ──────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log("  REBUILD COMPLETE");
console.log(`${"═".repeat(60)}`);
console.log(`  Total files processed   : ${totalFiles}`);
console.log(`  Total questions         : ${totalQuestions}`);
console.log(`  Repaired questions      : ${repairedQuestions}`);
console.log(`  Invalid old nodeIds     : ${invalidOldNodeIds}`);
console.log(`  Unresolved sections     : ${unresolvedSections}`);
console.log(`  Remaining "Unmapped"    : ${remainingUnmappedTopic.count}`);
console.log(`  Remaining "Unknown"     : ${remainingUnknown.count}`);
console.log(`  Remaining invalid nodes : ${remainingInvalidNodeIds}`);

if (unmappedSections.size > 0) {
  console.log(`\n  ── Sections not found in mapping table (${unmappedSections.size}) ──`);
  for (const s of [...unmappedSections].sort()) {
    console.log(`     • ${s}`);
  }
}

const pass =
  remainingUnmappedTopic.count === 0 &&
  remainingUnknown.count === 0 &&
  remainingInvalidNodeIds === 0;

console.log(`\n  STATUS: ${pass ? "✅ PASS" : "❌ FAIL — see issues above"}`);
console.log(`  Summary written to: ${SUMMARY_PATH}`);
console.log(`${"═".repeat(60)}\n`);
