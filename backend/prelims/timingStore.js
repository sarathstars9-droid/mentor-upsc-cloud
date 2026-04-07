// backend/prelims/timingStore.js
// EXTENSION LAYER — stores per-attempt timing data separately from core progress.
//
// Linked to core attempts by attemptId only.
// Does NOT touch topicProgressStore.js, practiceSubmit.js, or any locked core file.
//
// Storage: backend/data/attempt_timing/timing.json
//
// Schema per record:
// {
//   attemptId,          — links to AttemptHistory in topicProgressStore
//   userId,
//   topicNodeId,
//   totalTimeSpent,     — ms, whole attempt
//   averageTimePerQuestion, — ms
//   questionTimeMap,    — { [qid]: ms }
//   createdAt
// }

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const STORE_DIR   = path.join(__dirname, "..", "data", "attempt_timing");
const TIMING_FILE = path.join(STORE_DIR, "timing.json");

// ─── Persistence ──────────────────────────────────────────────────────────────

function ensureDir() {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function loadTimingMap() {
    try {
        if (fs.existsSync(TIMING_FILE)) return JSON.parse(fs.readFileSync(TIMING_FILE, "utf-8"));
    } catch (e) {
        console.warn("[TimingStore] Failed to load timing file:", e.message);
    }
    return {};
}

function flushTimingMap(map) {
    ensureDir();
    fs.promises.writeFile(TIMING_FILE, JSON.stringify(map, null, 2), "utf-8")
        .catch(e => console.error("[TimingStore] Failed to save:", e.message));
}

// In-memory map: attemptId → TimingRecord
const _timing = new Map(Object.entries(loadTimingMap()));

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save timing for an attempt.
 * @param {object} p
 * @param {string}  p.attemptId
 * @param {string}  p.userId
 * @param {string}  p.topicNodeId
 * @param {number}  p.totalTimeSpent          ms
 * @param {number}  p.averageTimePerQuestion  ms
 * @param {object}  p.questionTimeMap         { [qid]: ms }
 */
export function saveTiming({ attemptId, userId, topicNodeId, totalTimeSpent, averageTimePerQuestion, questionTimeMap }) {
    if (!attemptId) return null;
    const record = {
        attemptId,
        userId:      userId    || "",
        topicNodeId: topicNodeId || "",
        totalTimeSpent:          Number(totalTimeSpent)         || 0,
        averageTimePerQuestion:  Number(averageTimePerQuestion) || 0,
        questionTimeMap:         questionTimeMap                || {},
        createdAt: new Date().toISOString(),
    };
    _timing.set(attemptId, record);
    flushTimingMap(Object.fromEntries(_timing));
    return record;
}

/**
 * Retrieve timing for an attempt, or null if not found.
 */
export function getTiming(attemptId) {
    return _timing.get(attemptId) || null;
}
