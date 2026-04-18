#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const inputPaths = process.argv.slice(2);

if (inputPaths.length === 0) {
    console.error(
        "Usage:\n" +
        'node backend/scripts/normalizeCsatFiles.cjs "path/to/prelims_csat_lr_tagged.json" "path/to/prelims_csat_quant_tagged.json" "path/to/prelims_csat_rc_tagged.json"'
    );
    process.exit(1);
}

function cleanText(value) {
    if (value == null) return value;
    let s = String(value);

    return s
        .replace(/\u0000/g, "")
        .replace(/\u000e/g, "")
        .replace(/\u0010/g, "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{2,}/g, "\n")
        .replace(/Previous Year Questions/gi, "")
        .replace(/Comprehension\d+\s*Comprehension/gi, "")
        .replace(/Cyclicity\s*\(unit digit\)/gi, "")
        .replace(/Exponents/gi, "")
        .replace(/Divisibility/gi, "")
        .replace(/Remainder theorem/gi, "")
        .replace(/LCM and HCF/gi, "")
        .replace(/Factors/gi, "")
        .replace(/Ratio and proportion/gi, "")
        .replace(/Percentage\s*\(Compensation\)/gi, "Percentage")
        .replace(/Time,\s*Speed\s*&\s*Distance/gi, "Time Speed and Distance")
        .replace(/CSAT\s+FOUNDATION.*$/gim, "")
        .replace(/ungist.*$/gim, "")
        .replace(/sarath\.stars9@gmail\.com.*$/gim, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[ ]{2,}/g, " ")
        .replace(/\n /g, "\n")
        .trim();
}

function cleanOptionText(s) {
    s = cleanText(s);
    if (s == null) return s;

    return s
        .replace(/\n+/g, " ")
        .replace(/[ ]{2,}/g, " ")
        .trim();
}

function normalizeSection(moduleName, sectionName) {
    const m = String(moduleName || "").toLowerCase();
    const s = String(sectionName || "").trim();

    if (m.includes("reading comprehension") || m === "comprehension") {
        return "COMPREHENSION";
    }
    return s;
}

function normalizeModule(moduleName, fallbackFileName) {
    const m = String(moduleName || "").toLowerCase();
    const f = String(fallbackFileName || "").toLowerCase();

    if (m.includes("reason") || f.includes("_lr_")) return "Reasoning";
    if (m.includes("quant") || f.includes("_quant_")) return "Quant";
    if (m.includes("comprehension") || f.includes("_rc_")) return "Comprehension";

    return moduleName || null;
}

function normalizeQuestionType(q) {
    if (q.questionType) return q.questionType;
    if (q.format === "passage" || q.passageText) return "PASSAGE_BASED";
    return "MCQ_SINGLE";
}

function normalizeFormat(q) {
    if (q.format) return q.format;
    if (q.passageText) return "passage";
    return "text";
}

function isBadYear(y) {
    return !Number.isInteger(y) || y <= 0;
}

function shouldDropRecord(q, fileName) {
    const year = Number(q.year);
    const qno = Number(q.questionNumber);

    if (isBadYear(year)) return true;
    if (!Number.isInteger(qno) || qno <= 0) return true;

    // Keep official/new-pattern range only
    if (year < 2011 || year > 2025) return true;

    // Guard: RC 2025 should only be 52-80 in corrected dataset
    if (fileName.includes("_rc_") && year === 2025 && (qno < 52 || qno > 80)) return true;

    // Guard: Quant 2025 should only be 1-30
    if (fileName.includes("_quant_") && year === 2025 && (qno < 1 || qno > 30)) return true;

    // Guard: LR 2025 should only be 31-51
    if (fileName.includes("_lr_") && year === 2025 && (qno < 31 || qno > 51)) return true;

    return false;
}

function cleanQuestionObject(q, fileName) {
    const cleaned = { ...q };

    cleaned.year = Number(q.year);
    cleaned.questionNumber = Number(q.questionNumber);
    cleaned.questionType = normalizeQuestionType(q);
    cleaned.format = normalizeFormat(q);
    cleaned.module = normalizeModule(q.module, fileName);
    cleaned.section = normalizeSection(cleaned.module, q.section);

    cleaned.question = cleanText(q.question || "");
    cleaned.prompt = cleanText(q.prompt || null);
    cleaned.passageId = q.passageId ?? null;
    cleaned.passageText = cleanText(q.passageText || null);
    cleaned.table = q.table ?? null;
    cleaned.pairs = q.pairs ?? null;
    cleaned.answer = q.answer == null ? null : String(q.answer).trim().toLowerCase();

    if (Array.isArray(q.statements)) {
        cleaned.statements = q.statements.map((st) => ({
            ...st,
            label: cleanText(st.label || ""),
            text: cleanText(st.text || ""),
        }));
    } else {
        cleaned.statements = null;
    }

    if (q.options && typeof q.options === "object") {
        cleaned.options = {};
        for (const [k, v] of Object.entries(q.options)) {
            cleaned.options[String(k).toLowerCase()] = cleanOptionText(v);
        }
    } else {
        cleaned.options = null;
    }

    // Normalize answer to a/b/c/d if present
    if (cleaned.answer && !["a", "b", "c", "d"].includes(cleaned.answer)) {
        cleaned.answer = cleaned.answer.charAt(0).toLowerCase();
        if (!["a", "b", "c", "d"].includes(cleaned.answer)) {
            cleaned.answer = null;
        }
    }

    return cleaned;
}

function dedupeQuestions(questions) {
    const seen = new Map();

    for (const q of questions) {
        const key = `${q.year}_${q.questionNumber}`;
        if (!seen.has(key)) {
            seen.set(key, q);
            continue;
        }

        const prev = seen.get(key);

        // Prefer richer record
        const prevScore =
            (prev.question ? 1 : 0) +
            (prev.passageText ? 2 : 0) +
            (prev.options ? Object.keys(prev.options).length : 0) +
            (prev.answer ? 1 : 0);

        const currScore =
            (q.question ? 1 : 0) +
            (q.passageText ? 2 : 0) +
            (q.options ? Object.keys(q.options).length : 0) +
            (q.answer ? 1 : 0);

        if (currScore > prevScore) {
            seen.set(key, q);
        }
    }

    return Array.from(seen.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.questionNumber - b.questionNumber;
    });
}

function processFile(inputPath) {
    const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const fileName = path.basename(inputPath).toLowerCase();

    const questions = Array.isArray(raw.questions) ? raw.questions : [];

    const filtered = questions.filter((q) => !shouldDropRecord(q, fileName));
    const cleaned = filtered.map((q) => cleanQuestionObject(q, fileName));
    const deduped = dedupeQuestions(cleaned);

    const out = {
        ...raw,
        sourceFile: raw.sourceFile || "normalized_from_user_dataset",
        fileName: raw.fileName || path.basename(inputPath),
        totalQuestions: deduped.length,
        questions: deduped,
    };

    const outPath = inputPath.replace(/\.json$/i, "_normalized.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

    return {
        inputPath,
        outPath,
        before: questions.length,
        afterFilter: filtered.length,
        final: deduped.length,
    };
}

const results = inputPaths.map(processFile);

console.log("Normalization complete:\n");
for (const r of results) {
    console.log(`Input : ${r.inputPath}`);
    console.log(`Output: ${r.outPath}`);
    console.log(`Count : ${r.before} -> ${r.afterFilter} -> ${r.final}`);
    console.log("");
}