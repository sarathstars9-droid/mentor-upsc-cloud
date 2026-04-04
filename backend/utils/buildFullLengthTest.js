

function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
}

function normalizeStage(stage) {
    const s = normalizeText(stage);

    if (!s) return "";
    if (s.includes("PRE")) return "PRELIMS";
    return s;
}

function normalizePaper(paper) {
    const p = normalizeText(paper);

    if (!p) return "";

    if (
        p === "GS" ||
        p === "GS1" ||
        p === "GENERAL STUDIES" ||
        p === "GENERAL STUDIES-I" ||
        p === "GENERAL STUDIES I" ||
        p === "PAPER I" ||
        p === "PAPER-I"
    ) {
        return "GS";
    }

    if (
        p === "CSAT" ||
        p === "GS2" ||
        p === "GENERAL STUDIES II" ||
        p === "GENERAL STUDIES-II" ||
        p === "APTITUDE" ||
        p === "PAPER II" ||
        p === "PAPER-II"
    ) {
        return "CSAT";
    }

    if (p.includes("CSAT")) return "CSAT";
    if (p.includes("APTITUDE")) return "CSAT";

    if (
        p.includes("GS") ||
        p.includes("GENERAL STUDIES") ||
        p.includes("PAPER I")
    ) {
        return "GS";
    }

    if (p.includes("PAPER II")) {
        return "CSAT";
    }

    return p;
}

function extractYearFromQuestion(question) {
    const directCandidates = [
        question?.year,
        question?.examYear,
        question?.questionYear,
        question?.meta?.year,
        question?.meta?.examYear,
    ];

    for (const candidate of directCandidates) {
        const str = String(candidate ?? "").trim();
        if (/^\d{4}$/.test(str)) {
            return Number(str);
        }
    }

    const idCandidates = [
        question?.id,
        question?.questionId,
        question?.qid,
        question?.sourceId,
    ];

    for (const candidate of idCandidates) {
        const str = String(candidate ?? "");
        const match = str.match(/\b(20\d{2}|19\d{2})\b/);
        if (match) {
            return Number(match[1]);
        }
    }

    return null;
}

function extractPaperFromQuestion(question) {
    const candidates = [
        question?.paper,
        question?.paperType,
        question?.paper_type,
        question?.examPaper,
        question?.meta?.paper,
        question?.meta?.paperType,
        question?.stageBucket,
    ];

    for (const candidate of candidates) {
        const normalized = normalizePaper(candidate);
        if (normalized === "GS" || normalized === "CSAT") {
            return normalized;
        }
    }

    const idCandidates = [
        question?.id,
        question?.questionId,
        question?.qid,
        question?.sourceId,
    ];

    for (const candidate of idCandidates) {
        const text = normalizeText(candidate);

        if (text.includes("CSAT")) return "CSAT";
        if (text.includes("PRE_GS") || text.includes("GS1")) return "GS";
    }

    return "";
}

function extractStageFromQuestion(question) {
    const candidates = [
        question?.stage,
        question?.examStage,
        question?.type,
        question?.meta?.stage,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeStage(candidate);
        if (normalized) return normalized;
    }

    const idText = normalizeText(
        question?.id || question?.questionId || question?.qid || ""
    );

    if (idText.startsWith("PRE") || idText.includes("PRELIMS")) {
        return "PRELIMS";
    }

    return "";
}

function dedupeQuestions(questions) {
    const seen = new Set();
    const unique = [];

    for (const question of questions) {
        const key =
            question?.id ||
            question?.questionId ||
            question?.qid ||
            JSON.stringify([
                question?.question,
                question?.title,
                question?.year,
                question?.paper,
            ]);

        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(question);
    }

    return unique;
}

function sortQuestionsForStableOrder(questions) {
    return [...questions].sort((a, b) => {
        const aId = String(a?.id || a?.questionId || a?.qid || "");
        const bId = String(b?.id || b?.questionId || b?.qid || "");

        return aId.localeCompare(bId, undefined, { numeric: true });
    });
}

export function buildFullLengthTest(allQuestions, options = {}) {
    if (!Array.isArray(allQuestions)) {
        throw new Error("buildFullLengthTest expected allQuestions to be an array.");
    }

    const selectedYear = Number(options.year);
    const selectedPaper = normalizePaper(options.paperType);

    if (!selectedYear || Number.isNaN(selectedYear)) {
        throw new Error("Full-length test requires a valid year.");
    }

    if (selectedPaper !== "GS" && selectedPaper !== "CSAT") {
        throw new Error("Full-length test requires paperType to be GS or CSAT.");
    }

    const expectedCount = selectedPaper === "GS" ? 100 : 80;

    const prelimsQuestions = allQuestions.filter((question) => {
        const stage = extractStageFromQuestion(question);
        return stage === "PRELIMS";
    });

    const exactMatches = prelimsQuestions.filter((question) => {
        const year = extractYearFromQuestion(question);
        const paper = extractPaperFromQuestion(question);

        return year === selectedYear && paper === selectedPaper;
    });

    const uniqueMatches = dedupeQuestions(exactMatches);
    const sortedMatches = sortQuestionsForStableOrder(uniqueMatches);

    if (!sortedMatches.length) {
        throw new Error(
            `No prelims ${selectedPaper} questions found for year ${selectedYear}.`
        );
    }

    if (sortedMatches.length > expectedCount) {
        return sortedMatches.slice(0, expectedCount);
    }

    return sortedMatches;
}

export function getAvailableFullLengthYears(allQuestions, paperType) {
    if (!Array.isArray(allQuestions)) return [];

    const selectedPaper = normalizePaper(paperType);
    if (selectedPaper !== "GS" && selectedPaper !== "CSAT") return [];

    const expectedCount = selectedPaper === "GS" ? 100 : 80;
    const countsByYear = new Map();

    for (const question of allQuestions) {
        const stage = extractStageFromQuestion(question);
        if (stage !== "PRELIMS") continue;

        const paper = extractPaperFromQuestion(question);
        if (paper !== selectedPaper) continue;

        const year = extractYearFromQuestion(question);
        if (!year) continue;

        if (!countsByYear.has(year)) {
            countsByYear.set(year, []);
        }

        countsByYear.get(year).push(question);
    }

    return [...countsByYear.entries()]
        .filter(([, questions]) => dedupeQuestions(questions).length >= expectedCount)
        .map(([year]) => year)
        .sort((a, b) => a - b);
}

export function debugFullLengthSummary(allQuestions, paperType) {
    if (!Array.isArray(allQuestions)) return [];

    const selectedPaper = normalizePaper(paperType);
    const years = getAvailableFullLengthYears(allQuestions, selectedPaper);

    return years.map((year) => {
        const paperQuestions = buildFullLengthTest(allQuestions, {
            year,
            paperType: selectedPaper,
        });

        return {
            year,
            paperType: selectedPaper,
            count: paperQuestions.length,
            sampleIds: paperQuestions.slice(0, 5).map((q) => q?.id || q?.questionId),
        };
    });
}

export default buildFullLengthTest;