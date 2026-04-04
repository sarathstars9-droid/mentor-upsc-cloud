// src/utils/mainsMistakeEngine.js
// Mains Mistake Book — localStorage engine
// Key: mains_mistakes_v1

const STORAGE_KEY = "mains_mistakes_v1";

// ─── Read / write helpers ────────────────────────────────────────────────────
function readAll() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Save a new mains mistake entry.
 * @param {Object} entry — partial; safe defaults applied for missing fields.
 * @returns {Object} the saved entry with generated id.
 */
export function saveMainsMistake(entry = {}) {
    const all = readAll();
    const mistake = {
        id:                  crypto.randomUUID?.() || `mm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        attemptId:           entry.attemptId        || null,
        createdAt:           new Date().toISOString(),
        paper:               entry.paper            || "GS1",
        mode:                entry.mode             || "PYQ",
        marks:               entry.marks            || "15",
        year:                entry.year             || null,
        question:            entry.question         || "",
        topic:               entry.topic            || "",
        subtopic:            entry.subtopic         || "",
        answerText:          entry.answerText        || "",
        wordCount:           entry.wordCount        || 0,
        targetWords:         entry.targetWords      || 200,
        timeSpentSec:        entry.timeSpentSec     || 0,
        mistakeTypes:        entry.mistakeTypes     || [],
        severity:            entry.severity         || "medium",
        source:              entry.source           || "self_review",
        notes:               entry.notes            || "",
        mustRevise:          entry.mustRevise       ?? false,
        status:              entry.status           || "open",
        linkedRevisionType:  entry.linkedRevisionType || null,
    };
    all.unshift(mistake);
    writeAll(all);
    return mistake;
}

/**
 * Get all mistakes, newest first.
 */
export function getAllMainsMistakes() {
    return readAll();
}

/**
 * Get only open (unresolved) mistakes.
 */
export function getOpenMainsMistakes() {
    return readAll().filter((m) => m.status === "open");
}

/**
 * Get mistakes filtered by paper (GS1, GS2, GS3, etc).
 */
export function getMistakesByPaper(paper) {
    return readAll().filter((m) => m.paper === paper);
}

/**
 * Mark a mistake as resolved.
 */
export function markMainsMistakeResolved(id) {
    const all = readAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx].status = "resolved";
    all[idx].resolvedAt = new Date().toISOString();
    writeAll(all);
    return all[idx];
}

/**
 * Toggle mustRevise flag.
 */
export function toggleMustRevise(id) {
    const all = readAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx].mustRevise = !all[idx].mustRevise;
    writeAll(all);
    return all[idx];
}

/**
 * Reopen a previously resolved mistake.
 */
export function reopenMainsMistake(id) {
    const all = readAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx].status = "open";
    delete all[idx].resolvedAt;
    writeAll(all);
    return all[idx];
}

/**
 * Analyse weak patterns across all open mistakes.
 * Returns an array sorted by frequency: [{ type, count, pct }].
 */
export function getMainsWeakPatterns() {
    const open = getOpenMainsMistakes();
    if (!open.length) return [];

    const freq = {};
    open.forEach((m) => {
        (m.mistakeTypes || []).forEach((t) => {
            freq[t] = (freq[t] || 0) + 1;
        });
    });

    return Object.entries(freq)
        .map(([type, count]) => ({
            type,
            count,
            pct: Math.round((count / open.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Delete a mistake permanently.
 */
export function deleteMainsMistake(id) {
    const all = readAll();
    writeAll(all.filter((m) => m.id !== id));
}
