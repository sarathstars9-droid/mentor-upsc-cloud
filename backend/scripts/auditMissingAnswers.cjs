const fs = require("fs");
const path = require("path");

const MASTER_FILE = path.join(
    process.cwd(),
    "data",
    "pyq_index",
    "pyq_master_index.json"
);

const OUT_DIR = path.join(process.cwd(), "data", "audit");

const MISSING_FILE = path.join(OUT_DIR, "missing_answers_full.json");
const AVAILABLE_FILE = path.join(OUT_DIR, "available_answers_full.json");
const SUMMARY_FILE = path.join(OUT_DIR, "answer_audit_summary.json");

function normalizeAnswer(ans) {
    if (ans === undefined || ans === null) return null;

    const clean = String(ans)
        .trim()
        .toUpperCase()
        .replace(/[().]/g, "");

    return ["A", "B", "C", "D"].includes(clean) ? clean : null;
}

function getQuestions(raw) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.questions)) return raw.questions;
    if (Array.isArray(raw.data)) return raw.data;
    return Object.values(raw);
}

function safePreview(text, limit = 180) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
}

function inc(obj, key) {
    const k = key === undefined || key === null || key === "" ? "null" : String(key);
    obj[k] = (obj[k] || 0) + 1;
}

function main() {
    if (!fs.existsSync(MASTER_FILE)) {
        console.error("❌ Missing file:", MASTER_FILE);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
    const questions = getQuestions(raw);

    const missing = [];
    const available = [];

    const missingByYear = {};
    const availableByYear = {};
    const missingByPaper = {};
    const availableByPaper = {};
    const rawAnswerValues = {};

    for (const q of questions) {
        const normalizedAnswer = normalizeAnswer(q.answer);

        inc(rawAnswerValues, q.answer);

        const row = {
            id: q.id || null,
            year: q.year ?? null,
            questionNumber: q.questionNumber ?? null,
            paper: q.paper || q.stage || null,
            stage: q.stage || null,
            subject: q.subject || null,
            nodeId: q.nodeId || q.syllabusNodeId || null,
            syllabusNodeId: q.syllabusNodeId || q.nodeId || null,
            sourceFile: q.sourceFile || null,
            answer: q.answer ?? null,
            normalizedAnswer,
            question: safePreview(q.question || q.questionText || q.text || q.stem),
            options: q.options || null,
        };

        if (!normalizedAnswer) {
            missing.push(row);
            inc(missingByYear, q.year);
            inc(missingByPaper, q.paper || q.stage);
        } else {
            available.push(row);
            inc(availableByYear, q.year);
            inc(availableByPaper, q.paper || q.stage);
        }
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const summary = {
        generatedAt: new Date().toISOString(),
        totalQuestions: questions.length,
        availableAnswers: available.length,
        missingAnswers: missing.length,
        missingPercentage:
            questions.length === 0
                ? 0
                : Number(((missing.length / questions.length) * 100).toFixed(2)),
        availableByYear,
        missingByYear,
        availableByPaper,
        missingByPaper,
        rawAnswerValues,
    };

    fs.writeFileSync(MISSING_FILE, JSON.stringify(missing, null, 2), "utf8");
    fs.writeFileSync(AVAILABLE_FILE, JSON.stringify(available, null, 2), "utf8");
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8");

    console.log("\n✅ ANSWER AUDIT COMPLETE\n");

    console.log("Total Questions     :", questions.length);
    console.log("Available Answers   :", available.length);
    console.log("Missing Answers     :", missing.length);
    console.log("Missing Percentage  :", `${summary.missingPercentage}%`);

    console.log("\n📊 MISSING ANSWERS BY YEAR\n");

    Object.keys(missingByYear)
        .sort((a, b) => {
            if (a === "null") return 1;
            if (b === "null") return -1;
            return Number(a) - Number(b);
        })
        .forEach((year) => {
            console.log(`${year}: ${missingByYear[year]}`);
        });

    console.log("\n📊 AVAILABLE ANSWERS BY YEAR\n");

    Object.keys(availableByYear)
        .sort((a, b) => {
            if (a === "null") return 1;
            if (b === "null") return -1;
            return Number(a) - Number(b);
        })
        .forEach((year) => {
            console.log(`${year}: ${availableByYear[year]}`);
        });

    console.log("\n🔍 Missing sample first 10:\n");

    missing.slice(0, 10).forEach((q) => {
        console.log(
            `${q.year} Q${q.questionNumber} | ${q.id} | answer=${q.answer}`
        );
    });

    console.log("\n✅ Available sample first 10:\n");

    available.slice(0, 10).forEach((q) => {
        console.log(
            `${q.year} Q${q.questionNumber} | ${q.id} | ${q.answer} → ${q.normalizedAnswer}`
        );
    });

    console.log("\n📄 Saved:");
    console.log(MISSING_FILE);
    console.log(AVAILABLE_FILE);
    console.log(SUMMARY_FILE);
    console.log("");
}

main();