const fs = require("fs");
const path = require("path");

const CSAT_DIR = path.join(__dirname, "..", "data", "pyq_questions", "prelims", "csat");

function loadJsonSmart(candidates) {
    for (const name of candidates) {
        const full = path.join(CSAT_DIR, name);
        if (fs.existsSync(full)) {
            return {
                file: full,
                data: JSON.parse(fs.readFileSync(full, "utf8")),
            };
        }
    }
    throw new Error(
        "None of these files were found:\n" +
        candidates.map((x) => " - " + path.join(CSAT_DIR, x)).join("\n")
    );
}

const lrLoaded = loadJsonSmart([
    "prelims_csat_lr_tagged_normalized.json",
    "prelims_csat_lr_tagged.json",
]);

const quantLoaded = loadJsonSmart([
    "prelims_csat_quant_tagged_normalized.json",
    "prelims_csat_quant_tagged.json",
]);

const rcLoaded = loadJsonSmart([
    "prelims_csat_rc_tagged_normalized.json",
    "prelims_csat_rc_tagged.json",
]);

const lr = lrLoaded.data;
const quant = quantLoaded.data;
const rc = rcLoaded.data;

console.log("Using files:");
console.log("LR   :", lrLoaded.file);
console.log("Quant:", quantLoaded.file);
console.log("RC   :", rcLoaded.file);

const master = {};

function ensureYear(year) {
    if (!master[year]) {
        master[year] = {};
    }
}

function normalizeRcPaperNumber(q) {
    const n = Number(q.questionNumber);

    // normalized RC files often keep book numbering like 407..441
    if (n >= 407 && n <= 441) {
        return n - 355; // 407 -> 52
    }

    // if later you insert true 2025 RC as 52..80 directly, this will already be correct
    return n;
}

function isValidPaperQuestionNumber(n) {
    return Number.isInteger(n) && n >= 1 && n <= 80;
}

function addQuestion(q, moduleName) {
    const year = Number(q.year);
    if (!Number.isInteger(year) || year < 2011 || year > 2024) return;

    let paperQuestionNumber = Number(q.questionNumber);

    if (moduleName === "RC") {
        paperQuestionNumber = normalizeRcPaperNumber(q);
    }

    if (!isValidPaperQuestionNumber(paperQuestionNumber)) return;

    ensureYear(year);

    const existing = master[year][paperQuestionNumber];

    const candidate = {
        year,
        paper: "CSAT",
        paperQuestionNumber,
        module: moduleName,
        section: q.section || null,
        questionType: q.questionType || null,
        format: q.format || null,
        question: q.question || "",
        passageText: q.passageText || null,
        statements: q.statements || null,
        pairs: q.pairs || null,
        table: q.table || null,
        options: q.options || null,
        answer: q.answer || null,
        sourceId: q.id || null,
        syllabusNodeId: q.syllabusNodeId || null,
    };

    // prefer richer record if duplicate slot
    const score = (obj) => {
        if (!obj) return -1;
        let s = 0;
        if (obj.question) s += 2;
        if (obj.options) s += Object.keys(obj.options).length;
        if (obj.answer) s += 1;
        if (obj.passageText) s += 2;
        if (obj.statements) s += 1;
        return s;
    };

    if (!existing || score(candidate) > score(existing)) {
        master[year][paperQuestionNumber] = candidate;
    }
}

(quant.questions || []).forEach((q) => addQuestion(q, "Quant"));
(lr.questions || []).forEach((q) => addQuestion(q, "Reasoning"));
(rc.questions || []).forEach((q) => addQuestion(q, "RC"));

const output = [];
const summary = {};

for (const year of Object.keys(master).map(Number).sort((a, b) => a - b)) {
    const questions = Object.values(master[year]).sort(
        (a, b) => a.paperQuestionNumber - b.paperQuestionNumber
    );

    const moduleCounts = { Quant: 0, Reasoning: 0, RC: 0 };
    for (const q of questions) {
        if (moduleCounts[q.module] != null) moduleCounts[q.module]++;
    }

    summary[year] = {
        total: questions.length,
        Quant: moduleCounts.Quant,
        Reasoning: moduleCounts.Reasoning,
        RC: moduleCounts.RC,
        missingTo80: 80 - questions.length,
    };

    output.push({
        year,
        paper: "CSAT",
        totalQuestions: questions.length,
        questions,
    });
}

const outFile = path.join(CSAT_DIR, "csat_master_clean_final.json");
fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

const summaryFile = path.join(CSAT_DIR, "csat_master_clean_summary.json");
fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), "utf8");

console.log("\n✅ Master dataset built");
console.log("Master :", outFile);
console.log("Summary:", summaryFile);
console.log("\nYear-wise summary:");
console.log(JSON.stringify(summary, null, 2));