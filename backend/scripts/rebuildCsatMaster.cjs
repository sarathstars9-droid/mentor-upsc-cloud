#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function getArg(name, fallback = null) {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

const RC_PATH = getArg("--rc");
const QUANT_PATH = getArg("--quant");
const LR_PATH = getArg("--lr");
const OUT_PATH = getArg(
    "--out",
    path.resolve(process.cwd(), "backend", "data", "pyq_questions", "prelims", "csat", "csat_master_clean.json")
);

if (!RC_PATH || !QUANT_PATH || !LR_PATH) {
    console.error(
        "Missing args.\n" +
        "Example:\n" +
        'node backend/scripts/rebuildCsatMaster.js --rc "C:\\path\\rc.json" --quant "C:\\path\\quant.json" --lr "C:\\path\\lr.json" --out "C:\\path\\csat_master_clean.json"'
    );
    process.exit(1);
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        throw new Error(`Failed to read JSON: ${filePath}\n${err.message}`);
    }
}

function normalizeText(s) {
    return String(s || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function slugify(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function canonicalKey(year, questionNumber) {
    return `${year}_${String(questionNumber).padStart(3, "0")}`;
}

function getCanonicalSection({ year, questionNumber, sourceBucket }) {
    if (year === 2025) {
        if (questionNumber >= 1 && questionNumber <= 30) return "Quant";
        if (questionNumber >= 31 && questionNumber <= 51) return "Reasoning";
        if (questionNumber >= 52 && questionNumber <= 80) return "Comprehension";
        return null;
    }

    if (year >= 2011 && year <= 2024) {
        if (sourceBucket === "rc") return "Comprehension";
        if (sourceBucket === "quant") return "Quant";
        if (sourceBucket === "lr") return "Reasoning";
    }

    return null;
}

function extractTopicTag(q) {
    const section = normalizeText(q.section);
    if (!section) return [];
    return [slugify(section)];
}

function toCanonicalRecord(q, sourceBucket) {
    const year = Number(q.year);
    const questionNumber = Number(q.questionNumber);

    if (!Number.isInteger(year) || !Number.isInteger(questionNumber)) {
        return { error: "INVALID_IDENTITY", raw: q };
    }

    if (year < 2011 || year > 2025) {
        return { error: "INVALID_YEAR", raw: q };
    }

    const section = getCanonicalSection({ year, questionNumber, sourceBucket });
    if (!section) {
        return { error: "UNMAPPABLE_SECTION", raw: q };
    }

    const prompt = normalizeText(q.prompt);
    const question = normalizeText(q.question);
    const passageText = normalizeText(q.passageText);

    const options =
        q.options && typeof q.options === "object"
            ? Object.fromEntries(
                Object.entries(q.options).map(([k, v]) => [String(k).toLowerCase(), normalizeText(v)])
            )
            : null;

    const statements = Array.isArray(q.statements)
        ? q.statements.map((s) => ({
            label: normalizeText(s.label),
            text: normalizeText(s.text),
        }))
        : null;

    return {
        key: canonicalKey(year, questionNumber),
        year,
        questionNumber,
        stage: "Prelims",
        paper: "CSAT",
        section,
        questionType: q.questionType || null,
        format: q.format || null,
        question,
        prompt: prompt || null,
        passageId: q.passageId || null,
        passageText: passageText || null,
        statements,
        pairs: q.pairs || null,
        table: q.table || null,
        options,
        answer: q.answer ?? null,
        topicTags: extractTopicTag(q),
        sourceFiles: [sourceBucket],
        originalIds: [q.id].filter(Boolean),
        legacySyllabusNodeIds: [q.syllabusNodeId].filter(Boolean),
    };
}

function mergeRecords(a, b) {
    const pick = (x, y) => (x !== null && x !== undefined && x !== "" ? x : y);

    return {
        ...a,
        questionType: pick(a.questionType, b.questionType),
        format: pick(a.format, b.format),
        question: pick(a.question, b.question),
        prompt: pick(a.prompt, b.prompt),
        passageId: pick(a.passageId, b.passageId),
        passageText: pick(a.passageText, b.passageText),
        statements: pick(a.statements, b.statements),
        pairs: pick(a.pairs, b.pairs),
        table: pick(a.table, b.table),
        options: pick(a.options, b.options),
        answer: pick(a.answer, b.answer),
        topicTags: [...new Set([...(a.topicTags || []), ...(b.topicTags || [])])],
        sourceFiles: [...new Set([...(a.sourceFiles || []), ...(b.sourceFiles || [])])],
        originalIds: [...new Set([...(a.originalIds || []), ...(b.originalIds || [])])],
        legacySyllabusNodeIds: [
            ...new Set([...(a.legacySyllabusNodeIds || []), ...(b.legacySyllabusNodeIds || [])]),
        ],
    };
}

function loadBucket(filePath, sourceBucket) {
    const data = readJson(filePath);
    const questions = Array.isArray(data.questions) ? data.questions : [];
    return questions.map((q) => toCanonicalRecord(q, sourceBucket));
}

const rcItems = loadBucket(RC_PATH, "rc");
const quantItems = loadBucket(QUANT_PATH, "quant");
const lrItems = loadBucket(LR_PATH, "lr");

const all = [...rcItems, ...quantItems, ...lrItems];

const errors = [];
const map = new Map();

for (const item of all) {
    if (item.error) {
        errors.push(item);
        continue;
    }

    const existing = map.get(item.key);
    if (!existing) {
        map.set(item.key, item);
    } else {
        if (existing.section !== item.section) {
            errors.push({
                error: "SECTION_CONFLICT",
                key: item.key,
                aSection: existing.section,
                bSection: item.section,
                aSources: existing.sourceFiles,
                bSources: item.sourceFiles,
            });
            continue;
        }
        map.set(item.key, mergeRecords(existing, item));
    }
}

const records = [...map.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.questionNumber - b.questionNumber;
});

const yearStats = {};
for (const r of records) {
    if (!yearStats[r.year]) {
        yearStats[r.year] = {
            total: 0,
            Comprehension: 0,
            Quant: 0,
            Reasoning: 0,
        };
    }
    yearStats[r.year].total += 1;
    yearStats[r.year][r.section] += 1;
}

const output = {
    schemaVersion: "csat-master-v2",
    generatedAt: new Date().toISOString(),
    totalQuestions: records.length,
    validation: {
        years: yearStats,
        errorsCount: errors.length,
    },
    errors,
    questions: records.map((r) => ({
        year: r.year,
        questionNumber: r.questionNumber,
        stage: r.stage,
        paper: r.paper,
        section: r.section,
        questionType: r.questionType,
        format: r.format,
        question: r.question,
        prompt: r.prompt,
        passageId: r.passageId,
        passageText: r.passageText,
        statements: r.statements,
        pairs: r.pairs,
        table: r.table,
        options: r.options,
        answer: r.answer,
        topicTags: r.topicTags,
        sourceFiles: r.sourceFiles,
        originalIds: r.originalIds,
        legacySyllabusNodeIds: r.legacySyllabusNodeIds,
    })),
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");

console.log(`Wrote ${records.length} canonical CSAT questions to: ${OUT_PATH}`);
console.log("Year stats:");
for (const year of Object.keys(yearStats).sort()) {
    console.log(year, yearStats[year]);
}
console.log(`Errors: ${errors.length}`);