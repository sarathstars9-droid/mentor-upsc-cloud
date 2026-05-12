/**
 * auditGsLoaderSourceFiles.cjs
 *
 * Diagnostic script for the GS prelims question pipeline.
 * Run from backend/ directory: node scripts/auditGsLoaderSourceFiles.cjs
 *
 * Prints:
 *   - Total JSON files discovered
 *   - Files skipped as derived/index
 *   - Files included and question count per file
 *   - Final unique GS question count
 *   - Year-wise GS count after dedup
 *   - unknown_year count
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "data", "pyq_questions_v2");

// ── File discovery ────────────────────────────────────────────────────────────

function readAllJsonFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            files.push(...readAllJsonFiles(full));
        } else if (name.endsWith(".json")) {
            files.push(full);
        }
    }

    return files;
}

function isDerivedIndexFile(filePath) {
    const base = path.basename(filePath).toLowerCase();
    return (
        base.includes("global_master_index") ||
        base.includes("master_index") ||
        base.includes("by_node") ||
        base.includes("_audit") ||
        base.includes("_change_log") ||
        base.includes("_report") ||
        base.includes("_validation")
    );
}

// ── Question extraction ───────────────────────────────────────────────────────

function normalize(data) {
    if (Array.isArray(data)) {
        // Flat array of questions
        if (!data.length || typeof data[0] !== "object") return [];
        // Nested { fileName, data: { questions } } format
        if (data[0].fileName && data[0].data) {
            return data.flatMap((item) => item.data?.questions || []);
        }
        return data;
    }
    if (Array.isArray(data.questions)) return data.questions;
    if (Array.isArray(data.data))      return data.data;
    return [];
}

// ── GS filter ─────────────────────────────────────────────────────────────────

function isGsPrelimsQuestion(q, filePath) {
    const text = [
        q.exam,
        q.stage,
        q.paper,
        q.subject,
        q.section,
        q.module,
        q.id,
        filePath,
    ]
        .join(" ")
        .toLowerCase();

    if (text.includes("csat"))     return false;
    if (text.includes("mains"))    return false;
    if (text.includes("essay"))    return false;
    if (text.includes("optional")) return false;

    return (
        text.includes("prelims") ||
        text.includes("gs") ||
        text.includes("general studies")
    );
}

// ── Stable dedup key ──────────────────────────────────────────────────────────

function getYear(q) {
    const candidates = [q.year, q.examYear, q.paperYear, q.id, q.sourceFile];
    for (const c of candidates) {
        const m = String(c || "").match(/\b(19[9][5-9]|20[0-2][0-9]|2025)\b/);
        if (m) return Number(m[1]);
    }
    return null;
}

function getQuestionNumber(q) {
    const candidates = [q.questionNumber, q.qNo, q.qno, q.number, q.serialNo, q.id];
    for (const c of candidates) {
        if (/^\d{1,3}$/.test(String(c || "").trim())) return Number(c);
        const m = String(c || "").match(/(?:Q|_|-|\b)(\d{1,3})(?:\b|_|-)/i);
        if (m) return Number(m[1]);
    }
    return null;
}

function getQuestionText(q) {
    return String(q.question || q.questionText || q.text || q.stem || "")
        .replace(/\s+/g, " ")
        .trim();
}

function makeDedupeKey(q) {
    const year  = getYear(q) || "unknown";
    const qNo   = getQuestionNumber(q) ?? "noq";
    const text  = getQuestionText(q).toLowerCase().slice(0, 120);
    return `${year}::${qNo}::${text}`;
}

// ── Main audit ────────────────────────────────────────────────────────────────

const allFiles    = readAllJsonFiles(ROOT);
const skippedFiles  = [];
const includedFiles = [];

for (const f of allFiles) {
    if (isDerivedIndexFile(f)) skippedFiles.push(f);
    else                       includedFiles.push(f);
}

console.log("=".repeat(60));
console.log("GS LOADER SOURCE FILE AUDIT");
console.log("=".repeat(60));
console.log(`ROOT: ${ROOT}`);
console.log(`Total JSON files discovered : ${allFiles.length}`);
console.log(`Files skipped (derived/idx) : ${skippedFiles.length}`);
console.log(`Files included              : ${includedFiles.length}`);

console.log("\n── SKIPPED FILES ──────────────────────────────────────────");
for (const f of skippedFiles) {
    console.log("  SKIP", path.relative(ROOT, f));
}

console.log("\n── INCLUDED FILES (question counts) ───────────────────────");

const dedupeMap   = new Map();
let totalRaw      = 0;
let totalGsRaw    = 0;
let parseErrors   = 0;

for (const filePath of includedFiles) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
        console.log("  ERROR", path.relative(ROOT, filePath), "→", e.message);
        parseErrors++;
        continue;
    }

    const arr = normalize(data);
    totalRaw += arr.length;

    const gsInFile = arr.filter((q) => isGsPrelimsQuestion(q, filePath));
    totalGsRaw += gsInFile.length;

    const rel = path.relative(ROOT, filePath);
    console.log(`  ${String(arr.length).padStart(4)} total  ${String(gsInFile.length).padStart(4)} GS  ${rel}`);

    for (const q of gsInFile) {
        const key = makeDedupeKey(q);
        if (!dedupeMap.has(key)) dedupeMap.set(key, q);
    }
}

// ── Year-wise summary ─────────────────────────────────────────────────────────

const byYear = {};
let unknownYearCount = 0;

for (const q of dedupeMap.values()) {
    const yr = getYear(q);
    if (!yr) { unknownYearCount++; continue; }
    byYear[yr] = (byYear[yr] || 0) + 1;
}

console.log("\n── YEAR-WISE GS COUNT (after dedup) ───────────────────────");
Object.keys(byYear)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((yr) => console.log(`  ${yr}: ${byYear[yr]}`));
console.log(`  unknown_year: ${unknownYearCount}`);

console.log("\n── SUMMARY ────────────────────────────────────────────────");
console.log(`Total questions across all files    : ${totalRaw}`);
console.log(`GS questions (before dedup)         : ${totalGsRaw}`);
console.log(`GS questions (after dedup)          : ${dedupeMap.size}`);
console.log(`unknown_year                        : ${unknownYearCount}`);
console.log(`Parse errors                        : ${parseErrors}`);
if (parseErrors > 0) console.log("⚠️  Fix parse errors before trusting counts.");
