import fs from "fs";
import path from "path";

const MASTER_PATH = path.join(
    process.cwd(),
    "data",
    "pyq_rebuilt",
    "prelims",
    "prelims_gs_rebuilt_master.json"
);

let CACHE = null;

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[‐-–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function compactText(text) {
    return normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s&/_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSubject(subject) {
    const s = compactText(subject);

    if (s.includes("polity")) return "Polity";
    if (s.includes("economy")) return "Economy";
    if (s.includes("geography")) return "Geography";
    if (s.includes("environment")) return "Environment";
    if (s.includes("science")) return "Science & Technology";
    if (s.includes("history")) return "History & Culture";
    if (s.includes("culture")) return "History & Culture";

    return subject || "Unknown";
}

function normalizeQuestionType(type) {
    const t = compactText(type);

    if (t === "mcq") return "MCQ";
    if (t === "pair_based") return "PAIR_BASED";
    if (t === "matching") return "MATCHING";
    if (t === "map_based") return "MAP_BASED";
    if (t === "chronology") return "CHRONOLOGY";
    if (t === "assertion_reason") return "ASSERTION_REASON";
    if (t === "mcq_1_statement") return "MCQ_1_STATEMENT";
    if (t === "mcq_2_statement") return "MCQ_2_STATEMENT";
    if (t === "mcq_3_statement") return "MCQ_3_STATEMENT";
    if (t === "mcq_4_statement") return "MCQ_4_STATEMENT";
    if (t === "statement_based") return "STATEMENT_BASED";

    return type || "MCQ";
}

function getAllRows() {
    if (!CACHE) {
        CACHE = readJson(MASTER_PATH);
    }
    return CACHE;
}

export function reloadPrelimsRebuiltDataset() {
    CACHE = readJson(MASTER_PATH);
    return CACHE.length;
}

export function getPrelimsRebuiltDataset() {
    return getAllRows();
}

export function getPrelimsSubjects() {
    const rows = getAllRows();
    const counts = {};

    for (const row of rows) {
        const subject = normalizeSubject(row.subject);
        counts[subject] = (counts[subject] || 0) + 1;
    }

    return Object.entries(counts)
        .map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count);
}

export function getPrelimsTopics(subject) {
    const rows = getAllRows();
    const targetSubject = normalizeSubject(subject);
    const counts = {};

    for (const row of rows) {
        const rowSubject = normalizeSubject(row.subject);
        if (rowSubject !== targetSubject) continue;

        const topic = row.topic || "Unmapped Topic";
        counts[topic] = (counts[topic] || 0) + 1;
    }

    return Object.entries(counts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);
}

export function getPrelimsMicrothemes(subject, topic) {
    const rows = getAllRows();
    const targetSubject = normalizeSubject(subject);
    const targetTopic = normalizeText(topic || "");
    const counts = {};

    for (const row of rows) {
        const rowSubject = normalizeSubject(row.subject);
        const rowTopic = normalizeText(row.topic || "");

        if (rowSubject !== targetSubject) continue;
        if (rowTopic !== targetTopic) continue;

        const microtheme = row.microtheme || "Unmapped Microtheme";
        counts[microtheme] = (counts[microtheme] || 0) + 1;
    }

    return Object.entries(counts)
        .map(([microtheme, count]) => ({ microtheme, count }))
        .sort((a, b) => b.count - a.count);
}

export function filterPrelimsQuestions({
    subject = null,
    topic = null,
    microtheme = null,
    questionType = null,
    year = null,
    limit = null,
    includeReview = true
} = {}) {
    let rows = [...getAllRows()];

    if (subject) {
        const targetSubject = normalizeSubject(subject);
        rows = rows.filter((row) => normalizeSubject(row.subject) === targetSubject);
    }

    if (topic) {
        const targetTopic = normalizeText(topic);
        rows = rows.filter((row) => normalizeText(row.topic || "") === targetTopic);
    }

    if (microtheme) {
        const targetMicro = normalizeText(microtheme);
        rows = rows.filter((row) => normalizeText(row.microtheme || "") === targetMicro);
    }

    if (questionType) {
        const targetType = normalizeQuestionType(questionType);
        rows = rows.filter((row) => normalizeQuestionType(row.questionType) === targetType);
    }

    if (year != null && year !== "") {
        rows = rows.filter((row) => Number(row.year) === Number(year));
    }

    if (!includeReview) {
        rows = rows.filter((row) => row.reviewFlag === "OK");
    }

    if (limit != null) {
        rows = rows.slice(0, Number(limit));
    }

    return rows;
}

export function buildPrelimsSelectorTree({ includeReview = true } = {}) {
    const rows = includeReview
        ? getAllRows()
        : getAllRows().filter((row) => row.reviewFlag === "OK");

    const tree = {};

    for (const row of rows) {
        const subject = normalizeSubject(row.subject);
        const topic = row.topic || "Unmapped Topic";
        const microtheme = row.microtheme || "Unmapped Microtheme";

        if (!tree[subject]) {
            tree[subject] = {
                count: 0,
                topics: {}
            };
        }

        tree[subject].count++;

        if (!tree[subject].topics[topic]) {
            tree[subject].topics[topic] = {
                count: 0,
                microthemes: {}
            };
        }

        tree[subject].topics[topic].count++;

        if (!tree[subject].topics[topic].microthemes[microtheme]) {
            tree[subject].topics[topic].microthemes[microtheme] = 0;
        }

        tree[subject].topics[topic].microthemes[microtheme]++;
    }

    return tree;
}

export function buildPrelimsPracticeSet({
    subject = null,
    topic = null,
    microtheme = null,
    questionType = null,
    year = null,
    count = 10,
    includeReview = false
} = {}) {
    const rows = filterPrelimsQuestions({
        subject,
        topic,
        microtheme,
        questionType,
        year,
        includeReview
    });

    return rows.slice(0, Number(count) || 10);
}

export function getPrelimsDatasetSummary() {
    const rows = getAllRows();

    const reviewSummary = {};
    const questionTypeCounts = {};
    const yearCounts = {};

    for (const row of rows) {
        const reviewFlag = row.reviewFlag || "OK";
        reviewSummary[reviewFlag] = (reviewSummary[reviewFlag] || 0) + 1;

        const qt = normalizeQuestionType(row.questionType);
        questionTypeCounts[qt] = (questionTypeCounts[qt] || 0) + 1;

        const year = row.year || "UNKNOWN";
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    }

    return {
        totalQuestions: rows.length,
        reviewSummary,
        questionTypeCounts,
        yearCounts
    };
}