/**
 * PRELIMS MISTAKE ENGINE
 * ─────────────────────────────────────────────────────────────
 * Two-layer storage architecture:
 *
 *   Layer 1 — Attempt records   → localStorage["prelims_attempts_v2"]
 *   Layer 2 — Mistake book      → localStorage["prelims_mistakes"]
 *
 * Each test attempt is stored whole (Layer 1).
 * Mistake book entries are aggregated across attempts (Layer 2),
 * supporting repeated questions, progress tracking, and revision engine data.
 *
 * Design goals:
 *   • Same test can be attempted multiple times
 *   • Same question across attempts → one entry with full attemptHistory
 *   • Correct answers on later attempts → keep entry, update status
 *   • Structure is revision-engine ready (spaced-rep, weak-topic analysis)
 * ─────────────────────────────────────────────────────────────
 */

// ───────────────────────────────────────────────────────
// STORAGE KEYS
// ───────────────────────────────────────────────────────
const MISTAKES_KEY  = "prelims_mistakes";
const ATTEMPTS_KEY  = "prelims_attempts_v2";

const MAX_MISTAKES  = 2000;   // guard against localStorage overflow
const MAX_ATTEMPTS  = 500;

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

// ───────────────────────────────────────────────────────
// MISTAKE TYPE CLASSIFIER
// ───────────────────────────────────────────────────────

/**
 * Classify a single question result into a mistake type.
 * confidence: "sure" | "not_sure" | "guess"
 */
function classifyMistakeType(status, confidence) {
    if (status === "unattempted") return "unattempted";
    if (status === "correct")     return null; // not a mistake
    // wrong below
    if (confidence === "sure")     return "overconfidence_trap";
    if (confidence === "guess")    return "guess_error";
    return "conceptual_error";
}

// ───────────────────────────────────────────────────────
// TEST ID BUILDER  (stable, human-readable)
// ───────────────────────────────────────────────────────

/**
 * Build a stable testId from the test context.
 *
 * Examples:
 *   topic_test_economy_banking_monetary
 *   sectional_test_environment
 *   full_length_gs_2019
 *   full_length_csat_2021
 *   institutional_topic_polity_fundamental_rights
 */
export function buildTestId({
    sourceType,       // "topic_test" | "sectional_test" | "full_length" | "institutional"
    paper = "GS",     // "GS" | "CSAT"
    year,             // for full_length
    subject,
    topic,
    subtopic,
    customLabel,      // for institutional
}) {
    const safe = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    if (sourceType === "full_length") {
        return `full_length_${safe(paper)}_${safe(year)}`;
    }
    if (sourceType === "institutional") {
        const parts = ["institutional", safe(customLabel || "test")];
        if (subject) parts.push(safe(subject));
        if (topic)   parts.push(safe(topic));
        return parts.join("_");
    }
    if (sourceType === "topic_test") {
        return ["topic_test", safe(subject), safe(topic), safe(subtopic)].filter(Boolean).join("_");
    }
    if (sourceType === "sectional_test") {
        return ["sectional_test", safe(subject)].filter(Boolean).join("_");
    }
    return safe(customLabel || sourceType || "unknown_test");
}

// ───────────────────────────────────────────────────────
// LAYER 1 — ATTEMPT ENGINE
// ───────────────────────────────────────────────────────

/**
 * Save a full attempt record (Layer 1).
 *
 * @param {object} params
 * @param {string} params.testId        - stable test identifier
 * @param {string} params.sourceType    - "topic_test" | "sectional_test" | "full_length" | "institutional"
 * @param {string} params.paper         - "GS" | "CSAT"
 * @param {string|number} params.year   - for full-length only
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.subtopic
 * @param {object[]} params.evaluatedQuestions  - from buildAttemptRows()
 * @param {object}  params.resultSummary        - { total, correct, wrong, unattempted, accuracy }
 * @returns {string} attemptId
 */
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
        questionId:    q.questionId || q.id,
        userAnswer:    q.userAnswer  || "",
        correctAnswer: q.correctAnswer || q.answer || "",
        confidence:    q.confidence  || "not_sure",
        timeTaken:     q.timeTaken   || null,
        result:        q.status,        // "correct" | "wrong" | "unattempted"
    }));

    const record = {
        attemptId,
        testId,
        sourceType,
        paper,
        year:     year ? String(year) : null,
        subject,
        topic,
        subtopic,
        createdAt,
        answers,
        resultSummary,
    };

    const existing = safeRead(ATTEMPTS_KEY, []);
    const updated  = [record, ...existing].slice(0, MAX_ATTEMPTS);
    safeWrite(ATTEMPTS_KEY, updated);

    return attemptId;
}

// ───────────────────────────────────────────────────────
// LAYER 2 — MISTAKE BOOK ENGINE
// ───────────────────────────────────────────────────────

/**
 * Merge new attempt mistakes into the mistake book.
 *
 * For each question that was wrong or unattempted:
 *   - If an entry with the same questionId already exists → update it (append history)
 *   - Otherwise → create a new entry
 *
 * If the user got it correct → if an existing entry exists, update lastSeenAt and
 * append to history (so revision engine can track improvement), but do NOT create
 * a new entry.
 *
 * @param {object} params
 * @param {string} params.attemptId
 * @param {string} params.testId
 * @param {string} params.sourceType
 * @param {string} params.paper
 * @param {string|number} params.year
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.subtopic
 * @param {object[]} params.evaluatedQuestions  - ALL questions in the test, not just wrong
 */
export function mergeMistakesFromAttempt({
    attemptId,
    testId,
    sourceType,
    paper = "GS",
    year  = null,
    subject = "",
    topic   = "",
    subtopic = "",
    evaluatedQuestions = [],
}) {
    const now       = Date.now();
    const nowIso    = new Date(now).toISOString();
    const existing  = safeRead(MISTAKES_KEY, []);

    // Index existing entries by questionId for O(1) lookup
    const indexById = new Map(existing.map((m, i) => [m.questionId, i]));

    const updated = [...existing];

    for (const q of evaluatedQuestions) {
        const qid          = q.questionId || q.id;
        const userAnswer   = q.userAnswer || null;   // null = truly not answered
        const correctAnswer = q.correctAnswer || q.answer || "";
        const confidence   = q.confidence  || "not_sure";
        const status       = q.status;  // "correct" | "wrong" | "unattempted"
        const mistakeType  = classifyMistakeType(status, confidence);

        const historyEntry = {
            attemptId,
            testId,
            createdAt: nowIso,
            userAnswer,
            correctAnswer,
            confidence,
            timeTaken:  q.timeTaken || null,
            result:     status,    // "correct" | "wrong" | "unattempted"
        };

        const isError = status === "wrong" || status === "unattempted";

        if (indexById.has(qid)) {
            // ── UPDATE existing entry ──────────────────────────
            const idx   = indexById.get(qid);
            const entry = updated[idx];

            const prevHistory = Array.isArray(entry.attemptHistory) ? entry.attemptHistory : [];

            // Append this attempt to history
            const newHistory = [...prevHistory, historyEntry];

            updated[idx] = {
                ...entry,
                latestUserAnswer: userAnswer,
                latestResult:     status,
                lastSeenAt:       nowIso,
                totalSeenCount:   (entry.totalSeenCount || 0) + 1,
                totalWrongCount:  isError
                    ? (entry.totalWrongCount || 0) + 1
                    : (entry.totalWrongCount || 0),
                // Most recent mistake type (only if error)
                mistakeType:      isError ? mistakeType : entry.mistakeType,
                // If user got correct → advance status toward mastered
                status:           isError
                    ? (entry.status === "mastered" ? "revised" : entry.status)
                    : advanceStatus(entry.status, status),
                attemptHistory:   newHistory,
            };
        } else if (isError) {
            // ── CREATE new entry (only for errors) ────────────
            const newEntry = {
                id:             uid(),
                questionId:     qid,
                nodeId:         q.syllabusNodeId || q.nodeId || "",

                subject,
                topic,
                subtopic,
                year:           year ? String(year) : (q.year ? String(q.year) : null),
                paper,

                questionText:   q.questionText || q.question || "",
                options:        q.options || {},

                latestUserAnswer: userAnswer,
                latestResult:     status,
                correctAnswer,

                mistakeType,
                sourceType,
                testId,

                status:           "new",        // new | learning | revised | mastered
                revisionCount:    0,

                createdAt:      nowIso,   // display-facing creation timestamp
                firstSeenAt:    nowIso,   // revision engine timestamp
                lastSeenAt:     nowIso,
                lastReviewedAt: null,

                totalWrongCount: 1,
                totalSeenCount:  1,

                attemptHistory:  [historyEntry],
            };

            updated.push(newEntry);
            indexById.set(qid, updated.length - 1);
        }
    }

    // Newest entries first, cap size
    const sorted = updated
        .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0))
        .slice(0, MAX_MISTAKES);

    safeWrite(MISTAKES_KEY, sorted);
}

/**
 * Advance mistake status when user gets a question right.
 * new → learning → revised → mastered
 */
function advanceStatus(currentStatus, result) {
    if (result !== "correct") return currentStatus;
    const progression = { new: "learning", learning: "revised", revised: "mastered", mastered: "mastered" };
    return progression[currentStatus] || currentStatus;
}

// ───────────────────────────────────────────────────────
// CONVENIENCE FUNCTION  — call once on test submit
// ───────────────────────────────────────────────────────

/**
 * Primary entry point. Call this on test submission.
 * Saves the attempt record AND merges mistakes into the book.
 *
 * @param {object} testContext  - { testId, sourceType, paper, year, subject, topic, subtopic }
 * @param {object[]} evaluatedQuestions  - output of buildAttemptRows()
 * @param {object}  resultSummary        - { total, correct, wrong, unattempted, accuracy }
 * @returns {string} attemptId
 */
export function recordTestAttempt(testContext, evaluatedQuestions, resultSummary) {
    const {
        testId    = buildTestId(testContext),
        sourceType,
        paper     = "GS",
        year      = null,
        subject   = "",
        topic     = "",
        subtopic  = "",
    } = testContext;

    // Layer 1: full attempt record
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

    // Layer 2: mistake book update
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

    return attemptId;
}

// ───────────────────────────────────────────────────────
// READ API
// ───────────────────────────────────────────────────────

/** Return all mistake entries, newest first. */
export function getAllMistakes() {
    return safeRead(MISTAKES_KEY, []);
}

/** Return all attempt records, newest first. */
export function getAllAttempts() {
    return safeRead(ATTEMPTS_KEY, []);
}

/** Return mistakes filtered by subject. */
export function getMistakesBySubject(subjectId) {
    const all = getAllMistakes();
    if (!subjectId || subjectId === "all") return all;
    return all.filter((m) => (m.subject || "").toLowerCase() === subjectId.toLowerCase());
}

/** Return mistakes for a specific testId. */
export function getMistakesByTest(testId) {
    return getAllMistakes().filter((m) => m.testId === testId);
}

/** Return attempts for a specific testId. */
export function getAttemptsByTest(testId) {
    return getAllAttempts().filter((a) => a.testId === testId);
}

// ───────────────────────────────────────────────────────
// MUTATION API
// ───────────────────────────────────────────────────────

/**
 * Update the status of a mistake entry manually.
 * status: "new" | "learning" | "revised" | "mastered"
 */
export function updateMistakeStatus(mistakeId, status) {
    const all = getAllMistakes();
    const updated = all.map((m) =>
        m.id === mistakeId
            ? { ...m, status, lastReviewedAt: new Date().toISOString() }
            : m
    );
    safeWrite(MISTAKES_KEY, updated);
}

/**
 * Increment revisionCount for a mistake entry and update lastReviewedAt.
 */
export function incrementRevision(mistakeId) {
    const all = getAllMistakes();
    const updated = all.map((m) =>
        m.id === mistakeId
            ? {
                ...m,
                revisionCount:  (m.revisionCount || 0) + 1,
                lastReviewedAt: new Date().toISOString(),
                status:         advanceStatus(m.status, "correct"),
              }
            : m
    );
    safeWrite(MISTAKES_KEY, updated);
}

/**
 * Manually add mistake entries (e.g. from institutional tests without auto-evaluation).
 * Skips any question already present in the mistake book.
 */
export function addMistakes(newMistakes = []) {
    const all     = getAllMistakes();
    const existing = new Set(all.map((m) => m.questionId));

    const toAdd = newMistakes.filter(
        (m) => m.questionId && !existing.has(m.questionId)
    );

    if (!toAdd.length) return;
    const merged = [...toAdd, ...all].slice(0, MAX_MISTAKES);
    safeWrite(MISTAKES_KEY, merged);
}

// ───────────────────────────────────────────────────────
// STATS HELPERS  (for future revision / performance engines)
// ───────────────────────────────────────────────────────

/**
 * Get weak subjects ranked by total wrong count.
 * Returns: [{ subject, totalWrong, totalSeen, errorRate }]
 */
export function getWeakSubjects() {
    const all = getAllMistakes();
    const map = new Map();

    for (const m of all) {
        const sub = m.subject || "Unknown";
        if (!map.has(sub)) {
            map.set(sub, { subject: sub, totalWrong: 0, totalSeen: 0 });
        }
        const entry = map.get(sub);
        entry.totalWrong += m.totalWrongCount || 1;
        entry.totalSeen  += m.totalSeenCount  || 1;
    }

    return [...map.values()]
        .map((e) => ({ ...e, errorRate: e.totalSeen ? e.totalWrong / e.totalSeen : 0 }))
        .sort((a, b) => b.totalWrong - a.totalWrong);
}

/**
 * Get mistake type breakdown.
 * Returns: { conceptual_error: N, overconfidence_trap: N, guess_error: N, unattempted: N }
 */
export function getMistakeTypeBreakdown() {
    const all = getAllMistakes();
    const counts = {
        conceptual_error:    0,
        overconfidence_trap: 0,
        guess_error:         0,
        unattempted:         0,
    };
    for (const m of all) {
        const t = m.mistakeType || "conceptual_error";
        if (t in counts) counts[t]++;
    }
    return counts;
}

/**
 * Get questions that are "stuck" — seen 3+ times and still wrong.
 */
export function getStuckQuestions(minSeen = 3) {
    return getAllMistakes().filter(
        (m) =>
            (m.totalSeenCount || 0) >= minSeen &&
            m.status !== "mastered" &&
            (m.totalWrongCount || 0) >= minSeen - 1
    );
}
