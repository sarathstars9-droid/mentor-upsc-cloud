const INSTITUTIONAL_SOURCES = new Set([
    "institutional",
    "prelims_institutional",
]);

const PYQ_SOURCES = new Set([
    "pyq",
    "prelims_pyq",
    "pyq_test",
    "topic_pyq",
    "full_length_pyq",
    "pyq_practice",
    "focus_pyq",
    "topic_test",
    "sectional_test",
    "full_length",
]);

const DIAGNOSIS_LABELS = {
    concept_gap: "Concept Gap",
    factual_recall: "Factual Recall",
    statement_trap: "Statement Trap",
    overthinking: "Overthinking",
    elimination_error: "Elimination Error",
    question_misread: "Question Misread",
    guessing_error: "Guessing Error",
    time_pressure: "Time Pressure",
    knowledge_gap: "Knowledge Gap",
    unclassified: "Unclassified",
};

const DIAGNOSIS_COMPATIBILITY = {
    conceptual_error: "concept_gap",
    overconfidence_trap: "overthinking",
    guess_error: "guessing_error",
    unattempted: "knowledge_gap",
};

const REVIEW_STATUS_LABELS = {
    new: "New",
    reviewed: "Reviewed",
    retest_due: "Retest Due",
};

export const MISTAKE_DIAGNOSIS_OPTIONS = [
    "concept_gap",
    "factual_recall",
    "statement_trap",
    "overthinking",
    "elimination_error",
    "question_misread",
    "guessing_error",
    "time_pressure",
    "knowledge_gap",
    "unclassified",
];

export const REVIEW_STATUS_OPTIONS = [
    "new",
    "reviewed",
    "retest_due",
];

export function normalizeMistakeResult(value) {
    const result = String(value || "").trim().toLowerCase();
    if (result === "correct") return "correct";
    if (result === "wrong" || result === "incorrect") return "wrong";
    if (result === "unattempted" || result === "skipped") return "unattempted";
    return result;
}

export function getMistakeSourceGroup(sourceType) {
    const source = String(sourceType || "").trim().toLowerCase();
    if (INSTITUTIONAL_SOURCES.has(source)) return "institutional";
    if (PYQ_SOURCES.has(source)) return "pyq";
    return "other";
}

export function getMistakeSourceLabel(sourceType) {
    const group = getMistakeSourceGroup(sourceType);
    if (group === "institutional") return "Institutional";
    if (group === "pyq") return "PYQ";
    return "Other";
}

export function normalizeMistakeDiagnosis(value) {
    const diagnosis = String(value || "").trim().toLowerCase();
    if (!diagnosis) return "unclassified";
    if (DIAGNOSIS_COMPATIBILITY[diagnosis]) return DIAGNOSIS_COMPATIBILITY[diagnosis];
    if (MISTAKE_DIAGNOSIS_OPTIONS.includes(diagnosis)) return diagnosis;
    return "unclassified";
}

export function getMistakeDiagnosisLabel(value) {
    return DIAGNOSIS_LABELS[normalizeMistakeDiagnosis(value)] || DIAGNOSIS_LABELS.unclassified;
}

export function normalizeReviewStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    if (REVIEW_STATUS_OPTIONS.includes(status)) return status;
    return "new";
}

export function getReviewStatusLabel(value) {
    return REVIEW_STATUS_LABELS[normalizeReviewStatus(value)] || REVIEW_STATUS_LABELS.new;
}
