/**
 * prelimsInstitutionalTestStore.js
 * Safe localStorage persistence for institutional tests.
 * NEVER stores raw File objects — only serializable metadata.
 */

const STORAGE_KEY = "prelims_institutional_tests";

export function loadTests() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveTests(tests) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
    } catch (e) {
        console.error("[InstitutionalStore] Failed to save:", e);
    }
}

export function addTest(test) {
    const tests = loadTests();
    const updated = [test, ...tests];
    saveTests(updated);
    return updated;
}

export function updateTest(id, patch) {
    const tests = loadTests();
    const updated = tests.map((t) =>
        t.id === id
            ? { ...t, ...patch, updatedAt: new Date().toISOString() }
            : t
    );
    saveTests(updated);
    return updated;
}

export function deleteTest(id) {
    const tests = loadTests();
    const updated = tests.filter((t) => t.id !== id);
    saveTests(updated);
    return updated;
}

/**
 * Extract serializable metadata from a browser File object.
 * Safe to JSON.stringify — no circular refs.
 */
export function fileMeta(file) {
    if (!file) return null;
    return {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
    };
}

/** Stamp mistakeBookSyncedAt on the test record. */
export function markMistakeBookSynced(id) {
    return updateTest(id, { mistakeBookSyncedAt: new Date().toISOString() });
}

/** Stamp revisionSyncedAt on the test record. */
export function markRevisionSynced(id) {
    return updateTest(id, { revisionSyncedAt: new Date().toISOString() });
}
