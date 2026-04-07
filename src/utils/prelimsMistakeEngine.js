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

// ───────────────────────────────────────────────────────
// STORAGE KEYS
// ───────────────────────────────────────────────────────
const MISTAKES_KEY = "prelims_mistakes";
const ATTEMPTS_KEY = "prelims_attempts_v2";

const MAX_MISTAKES = 2000;
const MAX_ATTEMPTS = 500;
const API_BASE = "http://localhost:8787/api/mistakes";
const DEFAULT_USER_ID = "user_1";

// ───────────────────────────────────────────────────────
// INTERNAL HELPERS
// ───────────────────────────────────────────────────────

function safeRead(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function safeWrite(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
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
        return Array.isArray(data.items) ? data.items : [];
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

export function buildTestId({
    sourceType,
    paper = "GS",
    year,
    subject,
    topic,
    subtopic,
    customLabel,
}) {
    const safe = (s) =>
        String(s || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");

    if (sourceType === "full_length") {
        return `full_length_${safe(paper)}_${safe(year)}`;
    }
    if (sourceType === "institutional") {
        const parts = ["institutional", safe(customLabel || "test")];
        if (subject) parts.push(safe(subject));
        if (topic) parts.push(safe(topic));
        return parts.join("_");
    }
    if (sourceType === "topic_test") {
        return ["topic_test", safe(subject), safe(topic), safe(subtopic)]
            .filter(Boolean)
            .join("_");
    }
    if (sourceType === "sectional_test") {
        return ["sectional_test", safe(subject)].filter(Boolean).join("_");
    }
    return safe(customLabel || sourceType || "unknown_test");
}

// ───────────────────────────────────────────────────────
// LAYER 1 — ATTEMPT ENGINE
// ───────────────────────────────────────────────────────

export function saveAttempt({
    testId,
    sourceType,
    paper = "GS",
    year = null,
    subject = "",
    topic = "",
    subtopic = "",
    evaluatedQuestions = [],
    resultSummary = {},
}) {
    const attemptId = uid();
    const createdAt = Date.now();

    const answers = evaluatedQuestions.map((q) => ({
        questionId: q.questionId || q.id,
        userAnswer: q.userAnswer || "",
        correctAnswer: q.correctAnswer || q.answer || "",
        confidence: q.confidence || "not_sure",
        timeTaken: q.timeTaken || null,
        result: q.status,
    }));

    const record = {
        attemptId,
        testId,
        sourceType,
        paper,
        year: year ? String(year) : null,
        subject,
        topic,
        subtopic,
        createdAt,
        answers,
        resultSummary,
    };

    const existing = safeRead(ATTEMPTS_KEY, []);
    const updated = [record, ...existing].slice(0, MAX_ATTEMPTS);
    safeWrite(ATTEMPTS_KEY, updated);

    return attemptId;
}

// ───────────────────────────────────────────────────────
// LAYER 2 — MISTAKE BOOK ENGINE
// ───────────────────────────────────────────────────────

export function mergeMistakesFromAttempt({
    attemptId,
    testId,
    sourceType,
    paper = "GS",
    year = null,
    subject = "",
    topic = "",
    subtopic = "",
    evaluatedQuestions = [],
}) {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const existing = safeRead(MISTAKES_KEY, []);

    const indexById = new Map(existing.map((m, i) => [m.questionId, i]));
    const updated = [...existing];

    for (const q of evaluatedQuestions) {
        const qid = q.questionId || q.id;
        const userAnswer = q.userAnswer || null;
        const correctAnswer = q.correctAnswer || q.answer || "";
        const confidence = q.confidence || "not_sure";
        const status = normalizeStatus(q.status);
        const mistakeType = classifyMistakeType(status, confidence);

        const historyEntry = {
            attemptId,
            testId,
            createdAt: nowIso,
            userAnswer,
            correctAnswer,
            confidence,
            timeTaken: q.timeTaken || null,
            result: status,
        };

        const isError = status === "wrong" || status === "unattempted";

        if (indexById.has(qid)) {
            const idx = indexById.get(qid);
            const entry = updated[idx];
            const prevHistory = Array.isArray(entry.attemptHistory) ? entry.attemptHistory : [];
            const newHistory = [...prevHistory, historyEntry];

            updated[idx] = {
                ...entry,
                latestUserAnswer: userAnswer,
                latestResult: status,
                lastSeenAt: nowIso,
                totalSeenCount: (entry.totalSeenCount || 0) + 1,
                totalWrongCount: isError
                    ? (entry.totalWrongCount || 0) + 1
                    : entry.totalWrongCount || 0,
                mistakeType: isError ? mistakeType : entry.mistakeType,
                status: isError
                    ? entry.status === "mastered"
                        ? "revised"
                        : entry.status
                    : advanceStatus(entry.status, status),
                attemptHistory: newHistory,
            };
        } else if (isError) {
            const newEntry = {
                id: uid(),
                questionId: qid,
                nodeId: q.syllabusNodeId || q.nodeId || "",
                subject,
                topic,
                subtopic,
                year: year ? String(year) : q.year ? String(q.year) : null,
                paper,
                questionText: q.questionText || q.question || "",
                options: q.options || {},
                latestUserAnswer: userAnswer,
                latestResult: status,
                correctAnswer,
                mistakeType,
                sourceType,
                testId,
                status: "new",
                revisionCount: 0,
                createdAt: nowIso,
                firstSeenAt: nowIso,
                lastSeenAt: nowIso,
                lastReviewedAt: null,
                totalWrongCount: 1,
                totalSeenCount: 1,
                attemptHistory: [historyEntry],
            };

            updated.push(newEntry);
            indexById.set(qid, updated.length - 1);
        }
    }

    const sorted = updated
        .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0))
        .slice(0, MAX_MISTAKES);

    safeWrite(MISTAKES_KEY, sorted);
    return sorted;
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
    const {
        testId = buildTestId(testContext),
        sourceType,
        paper = "GS",
        year = null,
        subject = "",
        topic = "",
        subtopic = "",
    } = testContext;

    const attemptId = saveAttempt({
        testId,
        sourceType,
        paper,
        year,
        subject,
        topic,
        subtopic,
        evaluatedQuestions,
        resultSummary,
    });

    mergeMistakesFromAttempt({
        attemptId,
        testId,
        sourceType,
        paper,
        year,
        subject,
        topic,
        subtopic,
        evaluatedQuestions,
    });

    const mistakeQuestions = evaluatedQuestions.filter((q) => {
        const status = normalizeStatus(q.status);
        return status === "wrong" || status === "unattempted";
    });

    const settled = await Promise.allSettled(
        mistakeQuestions.map((q) =>
            apiCreateMistake(
                mapQuestionToApiPayload({
                    sourceType,
                    testId,
                    subject,
                    topic,
                    subtopic,
                    paper,
                    year,
                    question: q,
                })
            )
        )
    );

    const rejected = settled.filter((r) => r.status === "rejected");
    if (rejected.length) {
        console.error("[recordTestAttempt] failed to sync some mistakes", rejected);
    }

    try {
        await refreshMistakeCache();
    } catch (err) {
        console.error("[recordTestAttempt] failed to refresh mistake cache", err);
    }

    return attemptId;
}

// ───────────────────────────────────────────────────────
// READ API
// ───────────────────────────────────────────────────────

export async function getAllMistakes() {
    try {
        return await refreshMistakeCache();
    } catch (err) {
        console.error(err.message || "Failed to fetch mistakes");
        return safeRead(MISTAKES_KEY, []);
    }
}

export function getAllAttempts() {
    return safeRead(ATTEMPTS_KEY, []);
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

export function getAttemptsByTest(testId) {
    return getAllAttempts().filter((a) => a.testId === testId);
}

// ───────────────────────────────────────────────────────
// MUTATION API
// ───────────────────────────────────────────────────────

/**
 * Temporary cache-only mutation.
 * Real persistence needs backend PATCH endpoint.
 */
export async function updateMistakeStatus(mistakeId, status) {
    const all = await getAllMistakes();
    const updated = all.map((m) =>
        m.id === mistakeId
            ? { ...m, status, lastReviewedAt: new Date().toISOString() }
            : m
    );
    safeWrite(MISTAKES_KEY, updated);
    return updated;
}

/**
 * Temporary cache-only mutation.
 * Real persistence needs backend PATCH endpoint.
 */
export async function incrementRevision(mistakeId) {
    const all = await getAllMistakes();
    const updated = all.map((m) =>
        m.id === mistakeId
            ? {
                ...m,
                revisionCount: (m.revisionCount || 0) + 1,
                lastReviewedAt: new Date().toISOString(),
                status: advanceStatus(m.status, "correct"),
            }
            : m
    );
    safeWrite(MISTAKES_KEY, updated);
    return updated;
}

export async function addMistakes(newMistakes = []) {
    if (!Array.isArray(newMistakes) || !newMistakes.length) return [];

    const existing = await getAllMistakes();
    const existingIds = new Set(existing.map((m) => m.question_id || m.questionId));

    const candidates = newMistakes.filter((m) => {
        const qid = m.questionId || m.question_id;
        return qid && !existingIds.has(qid);
    });

    if (!candidates.length) return [];

    const settled = await Promise.allSettled(
        candidates.map((m) =>
            apiCreateMistake({
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
            })
        )
    );

    try {
        await refreshMistakeCache();
    } catch (err) {
        console.error("[addMistakes] failed to refresh mistake cache", err);
    }

    return settled;
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
