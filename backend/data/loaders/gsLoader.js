/**
 * GS LOADER — Single Source of Truth for Prelims GS Questions
 *
 * Recursively traverses backend/data/pyq_questions_v2/prelims/, excluding:
 *   - The csat/ subfolder
 *   - Metadata/aggregate files: *_master*, *_report*, *_index*, *_by_node*,
 *     *_all_topics*, *_production*, *_perfection*, *_zero_ambiguity*
 *
 * Supports both JSON formats:
 *   - Direct array: [ { id, question, ... }, ... ]
 *   - Wrapped:      { questions: [...], subject?, module?, paper?, stage? }
 *
 * Deduplication order:
 *   1. By `id` field (string equality)
 *   2. By fingerprint: year|questionNumber|first-80-chars-of-normalized-question
 *
 * Subject keys returned (backward-compatible with previous loader):
 *   culture, economy, environment, geography, history,
 *   polity, science_tech, ir, current_affairs_misc
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const GS_V2_DIR = path.resolve(__dirname, "../pyq_questions_v2/prelims");

// Files whose names match this pattern are metadata/aggregate files — skip them
const META_FILE_RE = /(_master|_report|_index|_by_node|_all_topics|_production|_perfection|_zero_ambiguity)/i;

const STANDARD_SUBJECT_KEYS = [
    "culture", "economy", "environment", "geography",
    "history", "polity", "science_tech", "ir", "current_affairs_misc",
];

// ── Directory walker ──────────────────────────────────────────────────────────

function walkDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip csat entirely
            if (entry.name.toLowerCase() === "csat") continue;
            results.push(...walkDir(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            if (!META_FILE_RE.test(entry.name)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

// ── Payload normalisation ─────────────────────────────────────────────────────

function extractQuestions(payload) {
    if (Array.isArray(payload)) return { questions: payload, meta: {} };
    if (payload && Array.isArray(payload.questions)) {
        const { questions, ...meta } = payload;
        return { questions, meta };
    }
    return { questions: [], meta: {} };
}

// ── Subject-key derivation ────────────────────────────────────────────────────

function deriveSubjectKey(subject, module, filePath) {
    const s  = (subject || "").toLowerCase();
    const m  = (module  || "").toLowerCase();
    const fp = filePath.replace(/\\/g, "/").toLowerCase();

    // Safety — should be filtered at walk time but guard here too
    if (fp.includes("/csat/")) return null;

    if (fp.includes("/current_affairs/")) return "current_affairs_misc";

    if (s.includes("economy") || s.includes("economic")) return "economy";
    if (s.includes("environment") || s.includes("ecology")) return "environment";
    if (s.includes("geography")) return "geography";
    if (s.includes("polity") || s.includes("governance")) return "polity";
    if (s.includes("science") || s.includes("technology")) return "science_tech";
    if (s.includes("international relation") || s === "ir") return "ir";
    if (s.includes("history") || s.includes("culture")) {
        if (m.includes("art") || m.includes("culture") || m.includes("craft")) return "culture";
        return "history";
    }

    return "current_affairs_misc";
}

// ── Deduplication fingerprint ─────────────────────────────────────────────────

function fingerprint(q) {
    const text = (q.question || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
    return `${q.year ?? "?"}|${q.questionNumber ?? "?"}|${text}`;
}

// ── Core loader ───────────────────────────────────────────────────────────────

let _cache = null;

function loadAll() {
    if (_cache) return _cache;

    const files = walkDir(GS_V2_DIR);

    // Dedup tracking
    const seenIds          = new Set();
    const seenFingerprints = new Set();

    // Result grouped by subject key
    const result = Object.fromEntries(STANDARD_SUBJECT_KEYS.map((k) => [k, []]));

    for (const filePath of files) {
        let payload;
        try {
            payload = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (e) {
            console.warn(`[gsLoader] JSON parse error in ${filePath}:`, e.message);
            continue;
        }

        const { questions, meta } = extractQuestions(payload);
        if (!questions.length) continue;

        const subjectKey = deriveSubjectKey(meta.subject, meta.module, filePath);
        if (!subjectKey) continue; // null = CSAT or unknown, skip

        for (const q of questions) {
            if (!q || typeof q !== "object") continue;

            // Dedup by id first
            if (q.id) {
                if (seenIds.has(q.id)) continue;
                seenIds.add(q.id);
            } else {
                // Dedup by fingerprint when no id
                const fp = fingerprint(q);
                if (seenFingerprints.has(fp)) continue;
                seenFingerprints.add(fp);
            }

            result[subjectKey].push({
                ...q,
                exam:    q.exam    || meta.exam    || "UPSC_CSE",
                stage:   q.stage   || meta.stage   || "Prelims",
                paper:   (q.paper && q.paper !== "CSAT") ? q.paper : (meta.paper && meta.paper !== "CSAT") ? meta.paper : "GS",
                subject: q.subject || meta.subject,
            });
        }
    }

    _cache = result;

    console.log(
        "[gsLoader] Loaded GS data from v2:",
        STANDARD_SUBJECT_KEYS.map((k) => `${k}=${result[k].length}`).join(", "),
    );

    return result;
}

// ── Public API (backward-compatible) ─────────────────────────────────────────

/** Returns all GS questions keyed by subject. */
export function loadGSData() {
    return loadAll();
}

/** Returns question counts per subject plus a total. */
export function getGSCounts() {
    const data = loadAll();
    const counts = {};
    let total = 0;
    for (const [subject, questions] of Object.entries(data)) {
        counts[subject] = questions.length;
        total += questions.length;
    }
    counts.total = total;
    return counts;
}

/** Returns the flat question array for a single subject key. */
export function loadGSSubject(subjectId) {
    return loadAll()[subjectId] ?? [];
}

/** All valid subject keys (fixed list for backward compatibility). */
export function getGSSubjectKeys() {
    return STANDARD_SUBJECT_KEYS;
}

/** Bust the in-process cache (useful after data files are updated at runtime). */
export function resetGSCache() {
    _cache = null;
}
