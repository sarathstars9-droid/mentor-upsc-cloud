// backend/prelims/topicProgressStore.js
// Cross-device topic progress store for Prelims PYQ practice.
// Uses in-memory Maps (survives server restart with JSON backup if needed).
// SOURCE OF TRUTH: servedQuestionIds per (userId + stage + topicNodeId)

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Persistence layer (flat JSON, no external DB) ───────────────────────────

const STORE_DIR = path.join(__dirname, "..", "data", "progress");
const ATTEMPT_FILE = path.join(STORE_DIR, "attempt_history.json");
const PROGRESS_FILE = path.join(STORE_DIR, "topic_progress.json");

function ensureStoreDir() {
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
}

function loadJSON(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
    } catch (e) {
        console.warn(`[TopicProgressStore] Failed to load ${filePath}:`, e.message);
    }
    return fallback;
}

function saveJSON(filePath, data) {
    try {
        ensureStoreDir();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error(`[TopicProgressStore] Failed to save ${filePath}:`, e.message);
    }
}

// ─── In-Memory Maps ───────────────────────────────────────────────────────────

/** Map<attemptId, AttemptHistory> */
const _attempts = new Map(
    Object.entries(loadJSON(ATTEMPT_FILE, {}))
);

/** Map<progressKey, TopicProgress> where progressKey = `${userId}::${stage}::${topicNodeId}` */
const _progress = new Map(
    Object.entries(loadJSON(PROGRESS_FILE, {}))
);

function progressKey(userId, stage, topicNodeId) {
    return `${userId}::${stage}::${topicNodeId}`;
}

// ─── Persistence flush ────────────────────────────────────────────────────────

function flushAttempts() {
    saveJSON(ATTEMPT_FILE, Object.fromEntries(_attempts));
}

function flushProgress() {
    saveJSON(PROGRESS_FILE, Object.fromEntries(_progress));
}

// ─── AttemptHistory CRUD ─────────────────────────────────────────────────────

/**
 * AttemptHistory schema:
 * {
 *   attemptId: string,
 *   userId: string,
 *   stage: "prelims",
 *   topicNodeId: string,
 *   mode: "continue" | "restart" | "retry_mistakes",
 *   questionIds: string[],
 *   answers: { [questionId]: string },      // user's selected option (A/B/C/D or "")
 *   wrongQuestionIds: string[],
 *   unattemptedQuestionIds: string[],
 *   submittedAt: ISO string
 * }
 */
export function createAttempt({
    userId,
    stage = "prelims",
    topicNodeId,
    mode,
    questionIds,
    answers,
    wrongQuestionIds,
    unattemptedQuestionIds,
}) {
    const attemptId = randomUUID();
    const record = {
        attemptId,
        userId,
        stage,
        topicNodeId,
        mode,
        questionIds: Array.from(questionIds || []),
        answers: answers || {},
        wrongQuestionIds: Array.from(wrongQuestionIds || []),
        unattemptedQuestionIds: Array.from(unattemptedQuestionIds || []),
        submittedAt: new Date().toISOString(),
    };
    _attempts.set(attemptId, record);
    flushAttempts();
    return record;
}

export function getAttempt(attemptId) {
    return _attempts.get(attemptId) || null;
}

// ─── TopicProgress CRUD ───────────────────────────────────────────────────────

/**
 * TopicProgress schema:
 * {
 *   userId: string,
 *   stage: "prelims",
 *   topicNodeId: string,
 *   servedQuestionIds: string[],        // SOURCE OF TRUTH for "continue"
 *   completedQuestionIds: string[],     // all answered (right or wrong)
 *   wrongQuestionIds: string[],         // ever wrong
 *   unattemptedQuestionIds: string[],   // answered nothing (skipped)
 *   lastAttemptId: string | null,
 *   updatedAt: ISO string
 * }
 */
function emptyProgress(userId, stage, topicNodeId) {
    return {
        userId,
        stage,
        topicNodeId,
        servedQuestionIds: [],
        completedQuestionIds: [],
        wrongQuestionIds: [],
        unattemptedQuestionIds: [],
        lastAttemptId: null,
        updatedAt: new Date().toISOString(),
    };
}

export function getProgress(userId, stage, topicNodeId) {
    const key = progressKey(userId, stage, topicNodeId);
    return _progress.get(key) || emptyProgress(userId, stage, topicNodeId);
}

/**
 * Merge new attempt data into TopicProgress.
 * Rules:
 *   - add questionIds → servedQuestionIds (dedup)
 *   - add questionIds → completedQuestionIds (dedup)
 *   - merge wrongQuestionIds (dedup)
 *   - merge unattemptedQuestionIds (dedup)
 *   - update lastAttemptId + updatedAt
 */
export function updateProgress({
    userId,
    stage = "prelims",
    topicNodeId,
    newQuestionIds,
    newWrongIds,
    newUnattemptedIds,
    attemptId,
}) {
    const key = progressKey(userId, stage, topicNodeId);
    const existing = _progress.get(key) || emptyProgress(userId, stage, topicNodeId);

    const served = new Set(existing.servedQuestionIds);
    const completed = new Set(existing.completedQuestionIds);
    const wrong = new Set(existing.wrongQuestionIds);
    const unattempted = new Set(existing.unattemptedQuestionIds);

    for (const id of newQuestionIds || []) {
        served.add(id);
        completed.add(id);
    }
    for (const id of newWrongIds || []) {
        wrong.add(id);
        // If previously unattempted and now wrong, remove from unattempted
        unattempted.delete(id);
    }
    for (const id of newUnattemptedIds || []) {
        unattempted.add(id);
        // If now answered wrong, it wouldn't be here, so this is safe
    }

    const updated = {
        ...existing,
        servedQuestionIds: Array.from(served),
        completedQuestionIds: Array.from(completed),
        wrongQuestionIds: Array.from(wrong),
        unattemptedQuestionIds: Array.from(unattempted),
        lastAttemptId: attemptId || existing.lastAttemptId,
        updatedAt: new Date().toISOString(),
    };

    _progress.set(key, updated);
    flushProgress();
    return updated;
}

/**
 * RESTART: completely reset progress for this (userId, stage, topicNodeId).
 */
export function resetProgress(userId, stage, topicNodeId) {
    const key = progressKey(userId, stage, topicNodeId);
    const fresh = emptyProgress(userId, stage, topicNodeId);
    _progress.set(key, fresh);
    flushProgress();
    return fresh;
}
