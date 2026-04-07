// backend/prelims/topicProgressStore.js
// Cross-device topic/subject progress store for Prelims PYQ practice.
// Uses in-memory Maps backed by flat JSON files.
//
// Progress key: `${userId}::${stage}::${topicNodeId}`
// Subject-level synthetic nodeId: "SUBJ::GS::economy", "SUBJ::CSAT::csat_rc", etc.

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_DIR   = path.join(__dirname, "..", "data", "progress");
const ATTEMPT_FILE  = path.join(STORE_DIR, "attempt_history.json");
const PROGRESS_FILE = path.join(STORE_DIR, "topic_progress.json");

// ─── Persistence helpers ──────────────────────────────────────────────────────

function ensureStoreDir() {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function loadJSON(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
        console.warn(`[TopicProgressStore] Failed to load ${filePath}:`, e.message);
    }
    return fallback;
}

function saveJSON(filePath, data) {
    // Non-blocking: write errors are logged but don't fail the request
    ensureStoreDir();
    fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
        .catch((e) => console.error(`[TopicProgressStore] Failed to save ${filePath}:`, e.message));
}

// ─── In-Memory Maps ───────────────────────────────────────────────────────────

/** Map<attemptId, AttemptHistory> */
const _attempts = new Map(Object.entries(loadJSON(ATTEMPT_FILE, {})));

/** Map<progressKey, TopicProgress> */
const _progress = new Map(Object.entries(loadJSON(PROGRESS_FILE, {})));

function progressKey(userId, stage, topicNodeId) {
    return `${userId}::${stage}::${topicNodeId}`;
}

function flushAttempts() { saveJSON(ATTEMPT_FILE, Object.fromEntries(_attempts)); }
function flushProgress() { saveJSON(PROGRESS_FILE, Object.fromEntries(_progress)); }

// ─── AttemptHistory CRUD ─────────────────────────────────────────────────────
//
// Schema:
// {
//   attemptId, userId, stage, topicNodeId, mode,
//   questionIds, answers,
//   wrongQuestionIds, unattemptedQuestionIds,
//   correctCount, wrongCount, unattemptedCount,
//   positiveMarks, negativeMarks, finalScore, paperType,
//   submittedAt
// }

export function createAttempt({
    userId,
    stage = "prelims",
    topicNodeId,
    mode,
    questionIds,
    answers,
    wrongQuestionIds,
    unattemptedQuestionIds,
    // scoring fields (optional — computed in practiceSubmit)
    correctCount   = 0,
    wrongCount     = 0,
    unattemptedCount = 0,
    positiveMarks  = 0,
    negativeMarks  = 0,
    finalScore     = 0,
    paperType      = "GS",
}) {
    const attemptId = randomUUID();
    const record = {
        attemptId,
        userId,
        stage,
        topicNodeId,
        mode,
        questionIds:           Array.from(questionIds || []),
        answers:               answers || {},
        wrongQuestionIds:      Array.from(wrongQuestionIds || []),
        unattemptedQuestionIds: Array.from(unattemptedQuestionIds || []),
        correctCount,
        wrongCount,
        unattemptedCount,
        positiveMarks,
        negativeMarks,
        finalScore,
        paperType,
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
//
// Schema:
// {
//   userId, stage, topicNodeId,
//   servedQuestionIds,        // all questions ever shown (SOURCE OF TRUTH for "continue")
//   correctQuestionIds,       // ever answered correctly (cumulative, dedup)
//   wrongQuestionIds,         // ever answered wrong (cumulative, dedup)
//   unattemptedQuestionIds,   // ever skipped / left blank
//
//   attemptsCount,            // total attempt sessions for this scope
//   bestScore,                // highest finalScore across all attempts
//   latestScore,              // finalScore from most recent attempt
//   scoreHistory,             // [{ attemptId, finalScore, correct, wrong, total, date }] last 50
//   coveragePercent,          // servedCount / totalQuestionsInPool * 100
//
//   lastAttemptId,
//   updatedAt
// }

function emptyProgress(userId, stage, topicNodeId) {
    return {
        userId,
        stage,
        topicNodeId,
        servedQuestionIds:      [],
        correctQuestionIds:     [],
        wrongQuestionIds:       [],
        unattemptedQuestionIds: [],
        attemptsCount:     0,
        bestScore:         null,
        latestScore:       null,
        scoreHistory:      [],
        coveragePercent:   0,
        lastAttemptId:     null,
        updatedAt:         new Date().toISOString(),
    };
}

export function getProgress(userId, stage, topicNodeId) {
    const key = progressKey(userId, stage, topicNodeId);
    return _progress.get(key) || emptyProgress(userId, stage, topicNodeId);
}

/**
 * Merge new attempt data into TopicProgress.
 *
 * @param {object} params
 * @param {string}   params.userId
 * @param {string}   params.stage
 * @param {string}   params.topicNodeId
 * @param {string[]} params.newQuestionIds     — all questions in this attempt
 * @param {string[]} params.newCorrectIds      — questions answered correctly
 * @param {string[]} params.newWrongIds        — questions answered wrong
 * @param {string[]} params.newUnattemptedIds  — questions left blank
 * @param {string}   params.attemptId
 * @param {number}   params.finalScore         — UPSC final score
 * @param {number}   params.positiveMarks
 * @param {number}   params.negativeMarks
 * @param {number}   params.totalQuestionsInPool — for coveragePercent
 */
export function updateProgress({
    userId,
    stage = "prelims",
    topicNodeId,
    newQuestionIds     = [],
    newCorrectIds      = [],
    newWrongIds        = [],
    newUnattemptedIds  = [],
    attemptId,
    finalScore         = 0,
    positiveMarks      = 0,
    negativeMarks      = 0,
    totalQuestionsInPool = 0,
}) {
    const key = progressKey(userId, stage, topicNodeId);
    const existing = _progress.get(key) || emptyProgress(userId, stage, topicNodeId);

    const served      = new Set(existing.servedQuestionIds      || []);
    const correct     = new Set(existing.correctQuestionIds     || []);
    const wrong       = new Set(existing.wrongQuestionIds       || []);
    const unattempted = new Set(existing.unattemptedQuestionIds || []);

    for (const id of newQuestionIds) { served.add(id); }
    for (const id of newCorrectIds)  { correct.add(id); }
    for (const id of newWrongIds)    { wrong.add(id); unattempted.delete(id); }
    // Only mark unattempted if not already classified as wrong
    for (const id of newUnattemptedIds) { if (!wrong.has(id)) unattempted.add(id); }

    // ── Scoring stats ──────────────────────────────────────────────────────────
    const attemptsCount = (existing.attemptsCount || 0) + 1;
    const latestScore   = finalScore;
    const bestScore     = existing.bestScore === null
        ? finalScore
        : Math.max(existing.bestScore, finalScore);

    // Append to scoreHistory (keep last 50)
    const scoreEntry = {
        attemptId: attemptId || null,
        finalScore,
        positiveMarks,
        negativeMarks,
        correct: newCorrectIds.length,
        wrong:   newWrongIds.length,
        total:   newQuestionIds.length,
        date:    new Date().toISOString(),
    };
    const scoreHistory = [...(existing.scoreHistory || []), scoreEntry].slice(-50);

    // ── Coverage ───────────────────────────────────────────────────────────────
    const servedCount = served.size;
    const coveragePercent = totalQuestionsInPool > 0
        ? Math.round((servedCount / totalQuestionsInPool) * 100)
        : existing.coveragePercent || 0;

    const updated = {
        ...existing,
        servedQuestionIds:      Array.from(served),
        correctQuestionIds:     Array.from(correct),
        wrongQuestionIds:       Array.from(wrong),
        unattemptedQuestionIds: Array.from(unattempted),
        attemptsCount,
        bestScore,
        latestScore,
        scoreHistory,
        coveragePercent,
        lastAttemptId: attemptId || existing.lastAttemptId,
        updatedAt:     new Date().toISOString(),
    };

    _progress.set(key, updated);
    flushProgress();
    return updated;
}

/**
 * RESTART: completely reset progress for this scope.
 * WARNING: This wipes history. Use "retry_entire" mode to rewrite without wiping.
 */
export function resetProgress(userId, stage, topicNodeId) {
    const key   = progressKey(userId, stage, topicNodeId);
    const fresh = emptyProgress(userId, stage, topicNodeId);
    _progress.set(key, fresh);
    flushProgress();
    return fresh;
}

/**
 * Compute average score from scoreHistory.
 */
export function computeAverageScore(progress) {
    const history = progress?.scoreHistory || [];
    if (!history.length) return null;
    const sum = history.reduce((acc, h) => acc + (h.finalScore || 0), 0);
    return Math.round((sum / history.length) * 100) / 100;
}
