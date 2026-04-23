/**
 * CSAT LOADER — Single Source of Truth for Prelims CSAT Questions
 *
 * Recursively traverses backend/data/pyq_questions_v2/prelims/csat/, supporting:
 *   - Direct array: [ { id, question, module, ... }, ... ]
 *   - Wrapped:      { questions: [...], module?, paper?, stage? }
 *   - RC schema:    { years: [{ year, sets: [{ questions: [...] }] }] }
 *
 * Deduplication: by `id` first, then fingerprint (year|questionNumber|text).
 *
 * Returns the same shape as the previous loader for full backward compatibility:
 *   { quant: [...], lr: [...], rc: [...] }
 *
 * Module → bucket mapping:
 *   "Logical Reasoning"      → lr
 *   "Quantitative Aptitude"  → quant
 *   "Reading Comprehension"  → rc
 *   Fallback: derived from filename (csat_lr_*, csat_quant*, csat_rc*)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CSAT_V2_DIR = path.resolve(__dirname, "../pyq_questions_v2/prelims/csat");

// ── Module → bucket mapping ───────────────────────────────────────────────────

const MODULE_TO_BUCKET = {
    "logical reasoning":     "lr",
    "reasoning":             "lr",
    "quantitative aptitude": "quant",
    "mathematics":           "quant",
    "quant":                 "quant",
    "reading comprehension": "rc",
    "comprehension":         "rc",
    "rc":                    "rc",
};

function moduleToBucket(module) {
    return MODULE_TO_BUCKET[(module || "").toLowerCase().trim()] ?? null;
}

function filenameToBucket(filename) {
    const n = filename.toLowerCase();
    if (n.includes("_lr") || n.includes("logical"))  return "lr";
    if (n.includes("quant") || n.includes("maths"))  return "quant";
    if (n.includes("_rc")  || n.includes("reading")) return "rc";
    return null;
}

// ── Directory walker ──────────────────────────────────────────────────────────

function walkDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            results.push(fullPath);
        }
    }
    return results;
}

// ── Payload normalisation ─────────────────────────────────────────────────────

function extractQuestions(payload) {
    if (Array.isArray(payload)) return { questions: payload, meta: {} };

    // RC schema: { years: [ { year, sets: [ { questions: [...] } ] } ] }
    if (payload && Array.isArray(payload.years)) {
        const { years, ...meta } = payload;
        const questions = [];
        for (const yearObj of years) {
            for (const setObj of (yearObj.sets || [])) {
                for (const q of (setObj.questions || [])) {
                    questions.push({
                        ...q,
                        id:   q.id || q.questionId || undefined,
                        year: q.year || yearObj.year,
                    });
                }
            }
        }
        return { questions, meta };
    }

    if (payload && Array.isArray(payload.questions)) {
        const { questions, ...meta } = payload;
        return { questions, meta };
    }
    return { questions: [], meta: {} };
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

    const files = walkDir(CSAT_V2_DIR);

    const seenIds          = new Set();
    const seenFingerprints = new Set();

    const result = { quant: [], lr: [], rc: [] };

    for (const filePath of files) {
        let payload;
        try {
            payload = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (e) {
            console.warn(`[csatLoader] JSON parse error in ${filePath}:`, e.message);
            continue;
        }

        const { questions, meta } = extractQuestions(payload);
        if (!questions.length) continue;

        // Determine which bucket this file contributes to
        const fileBucket = filenameToBucket(path.basename(filePath));

        for (const q of questions) {
            if (!q || typeof q !== "object") continue;

            // Dedup by id first
            if (q.id) {
                if (seenIds.has(q.id)) continue;
                seenIds.add(q.id);
            } else {
                const fp = fingerprint(q);
                if (seenFingerprints.has(fp)) continue;
                seenFingerprints.add(fp);
            }

            // Determine bucket from question module, then file-level module, then filename
            const bucket =
                moduleToBucket(q.module) ||
                moduleToBucket(meta.module) ||
                fileBucket;

            if (!bucket) {
                console.warn(`[csatLoader] Cannot determine bucket for question ${q.id ?? "(no id)"} in ${filePath}`);
                continue;
            }

            result[bucket].push({
                ...q,
                exam:    q.exam    || meta.exam    || "UPSC_CSE",
                stage:   q.stage   || meta.stage   || "Prelims",
                paper:   q.paper   || meta.paper   || "CSAT",
                subject: q.subject || meta.subject || "CSAT",
                module:  q.module  || meta.module,
            });
        }
    }

    _cache = result;

    console.log(
        "[csatLoader] Loaded CSAT data from v2:",
        `lr=${result.lr.length}, quant=${result.quant.length}, rc=${result.rc.length}`,
    );

    return result;
}

// ── Public API (backward-compatible) ─────────────────────────────────────────

/** Returns CSAT questions grouped into { quant, lr, rc }. */
export function loadCSATData() {
    return loadAll();
}

/** Returns question counts per bucket plus total. */
export function getCSATCounts() {
    const { quant, lr, rc } = loadAll();
    return {
        quant: quant.length,
        lr:    lr.length,
        rc:    rc.length,
        total: quant.length + lr.length + rc.length,
    };
}

/** Bust the in-process cache (useful after data files are updated at runtime). */
export function resetCSATCache() {
    _cache = null;
}
