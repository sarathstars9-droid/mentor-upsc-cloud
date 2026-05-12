const fs = require("fs");
const path = require("path");

const INPUT = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index.json");
const OUTPUT_DIR = path.join(process.cwd(), "data", "pyq_papers", "prelims");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const questions = Object.values(raw);

const EXCLUDE_IDS = new Set([
    "CA_IR_2014_Q078"
]);

function isCSAT(q) {
    const text = [
        q.paper,
        q.stage,
        q.subject,
        q.module,
        q.id,
        q.sourceFile
    ]
        .join(" ")
        .toLowerCase();

    return text.includes("csat");
}

function isGarbage(q) {
    const question = String(q.question || "").trim();

    if (!question) return true;
    if (/^question\s*\d+$/i.test(question)) return true;

    const options = q.options || {};
    const optionValues = Object.values(options).map(v => String(v || "").trim());

    if (optionValues.length < 4) return true;
    if (optionValues.every(v => !v)) return true;

    if (!q.answer || !["A", "B", "C", "D"].includes(String(q.answer).toUpperCase())) {
        return true;
    }

    return false;
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\[2014\]/g, "")
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .slice(0, 180);
}

function qualityScore(q) {
    let score = 0;

    if (q.answer) score += 100;
    if (q.options && Object.values(q.options).filter(Boolean).length >= 4) score += 50;
    if (q.nodeId || q.syllabusNodeId) score += 20;
    if (q.subject) score += 10;
    if (q.sourceFile && !String(q.sourceFile).includes("master")) score += 5;
    score += String(q.question || "").length;

    return score;
}

const byYear = {};

for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    if (EXCLUDE_IDS.has(q.id)) continue;
    if (isCSAT(q)) continue;
    if (!q.year) continue;
    if (isGarbage(q)) continue;

    const year = Number(q.year);
    if (!byYear[year]) byYear[year] = [];

    byYear[year].push(q);
}

console.log("\n📦 BUILDING FULL GS PAPERS\n");
console.log("YEAR | RAW | UNIQUE | OUTPUT");

for (const year of Object.keys(byYear).sort((a, b) => Number(a) - Number(b))) {
    const list = byYear[year];

    const map = new Map();

    for (const q of list) {
        const key = normalizeText(q.question);
        if (!key) continue;

        const existing = map.get(key);

        if (!existing) {
            map.set(key, q);
        } else if (qualityScore(q) > qualityScore(existing)) {
            map.set(key, q);
        }
    }

    const unique = Array.from(map.values());

    unique.sort((a, b) => {
        const aq = Number(a.questionNumber || 9999);
        const bq = Number(b.questionNumber || 9999);
        if (aq !== bq) return aq - bq;

        return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const finalQuestions = unique.map((q, index) => ({
        id: q.id,
        year: Number(q.year),
        paper: "GS",
        questionNumber: index + 1,
        originalQuestionNumber: q.questionNumber ?? null,
        subject: q.subject || null,
        sourceFile: q.sourceFile || null,
        question: q.question,
        options: q.options,
        answer: String(q.answer).toUpperCase(),
        nodeId: q.nodeId || q.syllabusNodeId || null,
        syllabusNodeId: q.syllabusNodeId || q.nodeId || null,
        microthemes: q.microthemes || [],
        keywords: q.keywords || [],
        mappingAudit: q.mappingAudit || null
    }));

    const paper = {
        year: Number(year),
        paper: "GS",
        source: "pyq_master_index",
        totalQuestions: finalQuestions.length,
        questions: finalQuestions
    };

    const outFile = path.join(OUTPUT_DIR, `${year}.json`);
    fs.writeFileSync(outFile, JSON.stringify(paper, null, 2), "utf8");

    console.log(`${year} | ${list.length} | ${unique.length} | ${finalQuestions.length}`);
}

console.log("\n✅ FULL PAPER BUILD COMPLETE");
console.log("Saved to:", OUTPUT_DIR);