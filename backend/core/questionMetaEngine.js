function mapQuestionType(qType = "", text = "") {
    const normalized = String(qType).toUpperCase();

    if (normalized.includes("2_STATEMENT") || normalized.includes("3_STATEMENT") || normalized.includes("STATEMENT")) {
        return "statement_based";
    }
    if (normalized.includes("MATCHING")) return "matching";
    if (normalized.includes("MULTI_SELECT")) return "multi_select";
    if (normalized.includes("COUNT")) return "count_based";

    if (/consider the following statements/i.test(text)) return "statement_based";
    if (/consider the following pairs/i.test(text)) return "matching";
    if (/how many of the above/i.test(text)) return "count_based";

    return "single";
}

function detectTrapFromType(qType = "", text = "") {
    const normalized = String(qType).toUpperCase();

    if (normalized.includes("2_STATEMENT") || normalized.includes("3_STATEMENT") || normalized.includes("STATEMENT")) {
        return "statement_trap";
    }
    if (normalized.includes("MATCHING")) return "matching_trap";
    if (normalized.includes("MULTI_SELECT")) return "elimination_trap";
    if (normalized.includes("COUNT")) return "count_trap";

    if (/\bonly\b|\balways\b|\bnever\b/i.test(text)) return "extreme_wording";

    return "none";
}

function detectDifficulty(question = {}) {
    const text = question.question || "";
    const qType = String(question.questionType || "").toUpperCase();

    if (qType.includes("3_STATEMENT") || qType.includes("MATCHING") || qType.includes("COUNT")) {
        return "hard";
    }
    if (qType.includes("2_STATEMENT") || qType.includes("MULTI_SELECT")) {
        return "medium";
    }

    if (text.length > 220) return "hard";
    if (text.length > 120) return "medium";
    return "easy";
}

function getQuestionMeta(question) {
    const text = question.question || "";
    const type = mapQuestionType(question.questionType, text);
    let trapType = detectTrapFromType(question.questionType, text);

    if (trapType === "none" && /\bonly\b|\balways\b|\bnever\b/i.test(text)) {
        trapType = "extreme_wording";
    }

    return {
        questionId: question.id,
        subject: question.subject || "Unknown",
        nodeId:
            question.syllabusNodeId ||
            question.nodeId ||
            "UNKNOWN_NODE",
        topic: question.section || question.topic || "",
        microTheme: question.microtheme || question.microTheme || "",
        type,
        difficulty: detectDifficulty(question),
        trapType,
    };
}

export { getQuestionMeta };