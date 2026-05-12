const fs = require("fs");
const path = require("path");

// Scan only the source topic files under prelims/, NOT the root-level derived indexes.
const ROOT = path.join(process.cwd(), "data", "pyq_questions_v2", "prelims");

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

function readAll(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            files = files.concat(readAll(full));
        } else if (f.endsWith(".json") && !isDerivedIndexFile(full)) {
            files.push(full);
        }
    }

    return files;
}

function normalize(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.questions)) return data.questions;
    if (Array.isArray(data.data)) return data.data;
    return [];
}

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

    if (text.includes("csat")) return false;
    if (text.includes("mains")) return false;
    if (text.includes("essay")) return false;
    if (text.includes("optional")) return false;

    return (
        text.includes("prelims") ||
        text.includes("gs") ||
        text.includes("general studies")
    );
}

function getYear(q) {
    const text = [q.year, q.examYear, q.id].join(" ");
    const m = text.match(/\b(19[9][5-9]|20[0-2][0-9]|2025)\b/);
    return m ? Number(m[1]) : "unknown_year";
}

function getQuestionNumber(q) {
    const candidates = [q.questionNumber, q.qNo, q.qno, q.number, q.id];

    for (const c of candidates) {
        if (/^\d{1,3}$/.test(String(c || "").trim())) {
            return Number(c);
        }

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

function makeKey(q) {
    const year = getYear(q);
    const qNo = getQuestionNumber(q);
    const text = getQuestionText(q).toLowerCase().slice(0, 120);
    // Always include text so questions from different subjects with the same
    // local questionNumber and year don't falsely collide.
    return `${year}::${qNo ?? "noq"}::${text}`;
}

const files = readAll(ROOT);
const map = new Map();
const duplicateRows = [];

for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const arr = normalize(parsed);

    for (const q of arr) {
        if (!isGsPrelimsQuestion(q, file)) continue;

        const k = makeKey(q);

        if (!map.has(k)) {
            map.set(k, { q, file });
        } else {
            duplicateRows.push({
                key: k,
                existingFile: map.get(k).file,
                duplicateFile: file,
                id: q.id || null,
                year: getYear(q),
                questionNumber: getQuestionNumber(q),
            });
        }
    }
}

const byYear = {};

for (const { q } of map.values()) {
    const year = getYear(q);
    byYear[year] = (byYear[year] || 0) + 1;
}

const unknownYearCount = byYear["unknown_year"] || 0;

console.log("\n✅ Unique GS Questions:", map.size);
console.log("\n📊 Year-wise after dedupe:\n");

Object.keys(byYear)
    .sort((a, b) => {
        if (a === "unknown_year") return 1;
        if (b === "unknown_year") return -1;
        return Number(a) - Number(b);
    })
    .forEach((year) => {
        console.log(`${year}: ${byYear[year]}`);
    });

console.log(`\n❓ unknown_year: ${unknownYearCount}`);
console.log("\n🧹 Duplicate rows detected:", duplicateRows.length);

const OUT_DIR = path.join(process.cwd(), "data", "audit");
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.writeFileSync(
    path.join(OUT_DIR, "gs_dedupe_audit.json"),
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            uniqueCount: map.size,
            byYear,
            duplicateRows,
        },
        null,
        2
    )
);

console.log("\n📄 Saved: data/audit/gs_dedupe_audit.json\n");