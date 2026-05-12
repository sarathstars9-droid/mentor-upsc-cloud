/**
 * PRELIMS MISTAKE ENGINE
 * ─────────────────────────────────────────────────────────────
 * Transitional architecture:
 *
 *   Layer 1 — Attempt records   → localStorage["prelims_attempts_v2"]
 *   Layer 2 — Mistake book      → PostgreSQL via /api/mistakes
 *
 * Attempts are still stored locally for now.
 * Mistake book reads come from the backend API.
 * Mistake creation during test submission is written to the backend API.
 *
 * NOTE:
 *   - Read APIs are async now.
 *   - Any UI consuming mistake APIs must use await / useEffect.
 *   - Manual status/revision mutation is currently cache-based until
 *     dedicated PATCH endpoints are added on the backend.
 * ─────────────────────────────────────────────────────────────
 */

import { BACKEND_URL } from "../config";

// ───────────────────────────────────────────────────────
// STORAGE KEYS
// ───────────────────────────────────────────────────────
const MISTAKES_KEY = "prelims_mistakes";
const ATTEMPTS_KEY = "prelims_attempts_v2";

const MAX_MISTAKES = 2000;
const MAX_ATTEMPTS = 500;
const API_BASE = `${BACKEND_URL}/api/mistakes`;
const DEFAULT_USER_ID = "user_1";

// ───────────────────────────────────────────────────────
// INTERNAL HELPERS
// ───────────────────────────────────────────────────────

function safeRead(key, fallback) {
    // localStorage removed
    return fallback;
}

function safeWrite(key, value) {
    // localStorage removed
    return false;
}

function uid() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeStatus(status) {
    if (status === "correct" || status === "wrong" || status === "unattempted") {
        return status;
    }
    return "wrong";
}

function normalizeMistakeType(status, confidence) {
    if (status === "unattempted") return "unattempted";
    if (status === "correct") return null;
    if (confidence === "sure") return "overconfidence_trap";
    if (confidence === "guess") return "guess_error";
    return "conceptual_error";
}

function mapQuestionToApiPayload({
    sourceType,
    testId,
    subject,
    topic,
    subtopic,
    paper,
    year,
    question,
}) {
    const questionId = question.questionId || question.id || null;
    const answerStatus = normalizeStatus(question.status);
    const mistakeType =
        question.mistakeType ||
        normalizeMistakeType(answerStatus, question.confidence || "not_sure");

    return {
        user_id: DEFAULT_USER_ID,
        source_type: sourceType || "prelims_pyq",
        source_ref: testId || null,
        question_id: questionId,
        stage: "prelims",
        subject: subject || null,
        node_id: question.syllabusNodeId || question.nodeId || null,
        question_text: question.questionText || question.question || "",
        selected_answer: question.latestUserAnswer || question.userAnswer || null,
        correct_answer: question.correctAnswer || question.answer || null,
        answer_status: answerStatus,
        error_type: mistakeType,
        notes: "",
        must_revise: answerStatus !== "correct",
        meta: {
            topic: topic || "",
            subtopic: subtopic || "",
            paper: paper || "GS",
            year: year ? String(year) : null,
            confidence: question.confidence || "not_sure",
            timeTaken: question.timeTaken || null,
        },
    };
}

async function apiCreateMistake(payload) {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Mistake create failed: non-JSON response (${res.status})`);
    }

    if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Mistake create failed with status ${res.status}`);
    }

    return data.item;
}

async function apiFetchMistakes() {
    const res = await fetch(`${API_BASE}?userId=${encodeURIComponent(DEFAULT_USER_ID)}`);
    const text = await res.text();

    try {
        const data = text ? JSON.parse(text) : {};
        if (!res.ok || data?.success === false) {
            throw new Error(data?.error || `Fetch failed with status ${res.status}`);
        }
        return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    } catch (err) {
        throw new Error(`Failed to fetch mistakes: ${err.message}`);
    }
}

async function refreshMistakeCache() {
    const items = await apiFetchMistakes();
    safeWrite(MISTAKES_KEY, items);
    return items;
}

// ───────────────────────────────────────────────────────
// MISTAKE TYPE CLASSIFIER
// ───────────────────────────────────────────────────────

/**
 * Classify a single question result into a mistake type.
 * confidence: "sure" | "not_sure" | "guess"
 */
function classifyMistakeType(status, confidence) {
    if (status === "unattempted") return "unattempted";
    if (status === "correct") return null;
    if (confidence === "sure") return "overconfidence_trap";
    if (confidence === "guess") return "guess_error";
    return "conceptual_error";
}

// ───────────────────────────────────────────────────────
// TEST ID BUILDER  (stable, human-readable)
// ───────────────────────────────────────────────────────

export function buildTestId(ctx) {
    const parts = [ctx.paper || "GS", ctx.year || "", ctx.subject || "", ctx.topic || ""]
        .filter(Boolean);
    return parts.join("_").toLowerCase().replace(/\s+/g, "_") || uid();
}

// ───────────────────────────────────────────────────────
// MISTAKE BOOK ENGINE (API BACKED)
// ───────────────────────────────────────────────────────

export async function addMistakes(newMistakes = []) {
    if (!Array.isArray(newMistakes) || !newMistakes.length) return [];

    const candidates = newMistakes.filter((m) => m.questionId || m.question_id);
    if (!candidates.length) return [];

    const payload = candidates.map((m) => ({
        user_id: DEFAULT_USER_ID,
        source_type: m.sourceType || m.source_type || "prelims_pyq",
        source_ref: m.testId || m.source_ref || null,
        question_id: m.questionId || m.question_id || null,
        stage: m.stage || "prelims",
        subject: m.subject || null,
        node_id: m.nodeId || m.node_id || null,
        question_text: m.questionText || m.question_text || "",
        selected_answer: m.latestUserAnswer || m.selected_answer || null,
        correct_answer: m.correctAnswer || m.correct_answer || null,
        answer_status: normalizeStatus(m.latestResult || m.answer_status || "wrong"),
        error_type: m.mistakeType || m.error_type || "conceptual_error",
        notes: m.notes || "",
        must_revise: Boolean(m.must_revise ?? true),
    }));

    try {
        const res = await fetch(`${API_BASE}/bulk-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: payload })
        });
        const data = await res.json();
        return data.items || [];
    } catch (err) {
        console.error("[addMistakes] bulk-sync failed", err);
        return [];
    }
}

function advanceStatus(currentStatus, result) {
    if (result !== "correct") return currentStatus;
    const progression = {
        new: "learning",
        learning: "revised",
        revised: "mastered",
        mastered: "mastered",
    };
    return progression[currentStatus] || currentStatus;
}

// ───────────────────────────────────────────────────────
// CONVENIENCE FUNCTION — call once on test submit
// ───────────────────────────────────────────────────────

export async function recordTestAttempt(testContext, evaluatedQuestions, resultSummary) {
    const attemptId = uid(); // local reference 
    const {
        testId = buildTestId(testContext),
        sourceType,
        paper = "GS",
        year = null,
        subject = "",
        topic = "",
        subtopic = "",
    } = testContext;

    const mistakeQuestions = evaluatedQuestions.filter((q) => {
        const status = normalizeStatus(q.status);
        return status === "wrong" || status === "unattempted";
    });

    const itemsToSync = mistakeQuestions.map(q => ({
        sourceType,
        testId,
        subject,
        topic,
        subtopic,
        paper,
        year,
        questionId: q.questionId || q.id,
        nodeId: q.syllabusNodeId || q.nodeId,
        questionText: q.questionText || q.question,
        latestUserAnswer: q.userAnswer,
        correctAnswer: q.correctAnswer || q.answer,
        latestResult: normalizeStatus(q.status),
        mistakeType: classifyMistakeType(normalizeStatus(q.status), q.confidence || "not_sure"),
    }));

    await addMistakes(itemsToSync);
    return attemptId;
}

// ───────────────────────────────────────────────────────
// READ API
// ───────────────────────────────────────────────────────

export async function getAllMistakes() {
    try {
        const res = await fetch(`${API_BASE}?userId=${encodeURIComponent(DEFAULT_USER_ID)}`);
        return await res.json();
    } catch (err) {
        console.error("Failed to fetch mistakes");
        return [];
    }
}

export async function getMistakesBySubject(subjectId) {
    const all = await getAllMistakes();
    if (!subjectId || subjectId === "all") return all;
    return all.filter(
        (m) => (m.subject || "").toLowerCase() === String(subjectId).toLowerCase()
    );
}

export async function getMistakesByTest(testId) {
    const all = await getAllMistakes();
    return all.filter((m) => (m.source_ref || m.testId) === testId);
}

// ───────────────────────────────────────────────────────
// MUTATION API
// ───────────────────────────────────────────────────────

/**
 * Backend PATCH endpoints 
 */
export async function updateMistakeStatus(mistakeId, status) {
    const res = await fetch(`${API_BASE}/${mistakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_status: status }),
    });
    return await res.json();
}

export async function incrementRevision(mistakeId) {
    const res = await fetch(`${API_BASE}/${mistakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision_flag: true }),
    });
    return await res.json();
}


// ───────────────────────────────────────────────────────
// STATS HELPERS  (for future revision / performance engines)
// ───────────────────────────────────────────────────────

export async function getWeakSubjects() {
    const all = await getAllMistakes();
    const map = new Map();

    for (const m of all) {
        const sub = m.subject || "Unknown";
        if (!map.has(sub)) {
            map.set(sub, { subject: sub, totalWrong: 0, totalSeen: 0 });
        }
        const entry = map.get(sub);
        entry.totalWrong += m.totalWrongCount || 1;
        entry.totalSeen += m.totalSeenCount || 1;
    }

    return [...map.values()]
        .map((e) => ({
            ...e,
            errorRate: e.totalSeen ? e.totalWrong / e.totalSeen : 0,
        }))
        .sort((a, b) => b.totalWrong - a.totalWrong);
}

export async function getMistakeTypeBreakdown() {
    const all = await getAllMistakes();
    const counts = {
        conceptual_error: 0,
        overconfidence_trap: 0,
        guess_error: 0,
        unattempted: 0,
    };

    for (const m of all) {
        const t = m.mistakeType || m.error_type || "conceptual_error";
        if (t in counts) counts[t]++;
    }

    return counts;
}

export async function getStuckQuestions(minSeen = 3) {
    const all = await getAllMistakes();
    return all.filter(
        (m) =>
            (m.totalSeenCount || 0) >= minSeen &&
            m.status !== "mastered" &&
            (m.totalWrongCount || 0) >= minSeen - 1
    );
}
