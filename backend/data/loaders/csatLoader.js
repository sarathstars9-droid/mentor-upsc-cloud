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
    "decision making":       "lr",
    "quantitative aptitude": "quant",
    "basic numeracy":        "quant",
    "mathematics":           "quant",
    "quant":                 "quant",
    "data interpretation":   "quant",
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

const BACKUP_DIR_RE = /^(backup_old|_backup|old|archive)$/i;

function walkDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (BACKUP_DIR_RE.test(entry.name)) continue;
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

// ── Options normalisation ─────────────────────────────────────────────────────

function normalizeOptions(q) {
    const raw = q.options;

    if (Array.isArray(raw)) {
        return {
            a: raw[0] ?? "",
            b: raw[1] ?? "",
            c: raw[2] ?? "",
            d: raw[3] ?? "",
        };
    }

    if (raw && typeof raw === "object") {
        return {
            a: raw.a ?? raw.A ?? "",
            b: raw.b ?? raw.B ?? "",
            c: raw.c ?? raw.C ?? "",
            d: raw.d ?? raw.D ?? "",
        };
    }

    console.warn("[csatLoader] Missing options:", q.id ?? "(no id)");
    return { a: "", b: "", c: "", d: "" };
}

// ── CSAT topic → canonical nodeId map ────────────────────────────────────────
// Used to retroactively assign nodeIds to questions that only carry a `topic` field.
const CSAT_TOPIC_TO_NODE_ID = {
    // Quantitative Aptitude / Basic Numeracy
    "Numbers":                             "CSAT-BN-NS",
    "Number System":                       "CSAT-BN-NS",
    "LCM-HCF":                             "CSAT-BN-LCMHCF",
    "LCM – HCF":                           "CSAT-BN-LCMHCF",
    "Ratio":                               "CSAT-BN-RATIO",
    "Ratio – Proportion and Variations":   "CSAT-BN-RATIO",
    "Percentage and Ratio":                "CSAT-BN-PERCENT",
    "Percentages":                         "CSAT-BN-PERCENT",
    "Percentage":                          "CSAT-BN-PERCENT",
    "Profit-Loss":                         "CSAT-BN-PLD",
    "Profit – Loss and Discounts":         "CSAT-BN-PLD",
    "Interest":                            "CSAT-BN-INT",
    "Simple Interest":                     "CSAT-BN-INT",
    "Compound Interest":                   "CSAT-BN-INT",
    "Time and Work":                       "CSAT-BN-TWP",
    "Time, Work and Pipes":                "CSAT-BN-TWP",
    "Time Speed Distance":                 "CSAT-BN-TSD",
    "Time – Speed – Distance":             "CSAT-BN-TSD",
    "Average":                             "CSAT-BN-AVG-MIX",
    "Averages":                            "CSAT-BN-AVG-MIX",
    "Average – Mixtures and Allegations":  "CSAT-BN-AVG-MIX",
    "Mixtures":                            "CSAT-BN-AVG-MIX",
    "Mixture":                             "CSAT-BN-AVG-MIX",
    "Ages":                                "CSAT-BN-AGES",
    "Simple Equations":                    "CSAT-BN-EQN",
    "Linear Equations":                    "CSAT-BN-EQN",
    "Permutations and Combinations":       "CSAT-BN-PNC",
    "Probability":                         "CSAT-BN-PROB",
    "Mensuration":                         "CSAT-BN-MENS",
    "AP-GP":                               "CSAT-BN-APGP",
    "AP – GP":                             "CSAT-BN-APGP",
    "Trains":                              "CSAT-BN-TRAINS",
    // Reading Comprehension
    "Reading Comprehension":               "CSAT-RC-MISC",
    "Theme":                               "CSAT-RC-THEME",
    "Main Idea":                           "CSAT-RC-THEME",
    "Central Idea":                        "CSAT-RC-THEME",
    "Tone":                                "CSAT-RC-TONE",
    "Summary":                             "CSAT-RC-TONE",
    "Assumptions":                         "CSAT-RC-ASSUMP",
    "Inference":                           "CSAT-RC-INFER",
    "Inferences":                          "CSAT-RC-INFER",
    "Conclusions":                         "CSAT-RC-CONCL",
    "Factual Question":                    "CSAT-RC-FACT",
    "Strengthening the Argument":          "CSAT-RC-STRENGTH",
    "Weakening the Argument":              "CSAT-RC-WEAKEN",
    // Logical Reasoning
    "Directions":                          "CSAT-LR-DIR",
    "Direction Sense":                     "CSAT-LR-DIR",
    "Coding-Decoding":                     "CSAT-LR-CODE",
    "Coding Decoding":                     "CSAT-LR-CODE",
    "Inequalities":                        "CSAT-LR-INEQ",
    "Syllogism":                           "CSAT-LR-SYL",
    "Blood Relations":                     "CSAT-LR-BLOOD",
    "Relationship Puzzles":                "CSAT-LR-BLOOD",
    "Seating Arrangement":                 "CSAT-LR-SEAT",
    "Sitting Arrangement":                 "CSAT-LR-SEAT",
    "Puzzles":                             "CSAT-LR-PUZZLE",
    "Ranking Puzzles":                     "CSAT-LR-PUZZLE",
    "Multiple Correlation Puzzles":        "CSAT-LR-PUZZLE",
    "Calendar":                            "CSAT-LR-CAL",
    "Clock":                               "CSAT-LR-CLOCK",
    "Series":                              "CSAT-LR-SERIES",
    "Logical Reasoning":                   "CSAT-LR-MISC",
    "Data Sufficiency":                    "CSAT-LR-MISC",
    "Deductive Reasoning":                 "CSAT-LR-MISC",
};

/** Resolve canonical nodeId for a CSAT question using topic field as fallback. */
function resolveCSATNodeId(q) {
    if (q.nodeId)          return q.nodeId;
    if (q.canonicalNodeId) return q.canonicalNodeId;
    const topic = q.topic || q.subtopic || q.section || "";
    if (!topic) return null;
    // Exact match first
    if (CSAT_TOPIC_TO_NODE_ID[topic]) return CSAT_TOPIC_TO_NODE_ID[topic];
    // Case-insensitive fallback
    const lower = topic.toLowerCase();
    for (const [k, v] of Object.entries(CSAT_TOPIC_TO_NODE_ID)) {
        if (k.toLowerCase() === lower) return v;
    }
    return null;
}

/** Export the map so other modules (routes, frontend utils) can reuse it. */
export { CSAT_TOPIC_TO_NODE_ID };



let _cache = null;

function loadAll() {
    if (_cache) return _cache;

    const files = walkDir(CSAT_V2_DIR);

    const seenIds          = new Set();
    const seenFingerprints = new Set();
    const seenBucketSlots  = new Set(); // bucket|year|questionNumber dedup

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

            // ── Field normalisation ──────────────────────────────────────────
            const questionText   = q.questionText   || q.question   || "";
            const correctAnswer  = q.correctAnswer  || q.answer     || q.correct_answer || "";

            // Determine bucket early (needed for slot-dedup key)
            const bucket =
                moduleToBucket(q.module) ||
                moduleToBucket(meta.module) ||
                fileBucket;

            if (!bucket) {
                console.warn(`[csatLoader] Cannot determine bucket for question ${q.id ?? "(no id)"} in ${filePath}`);
                continue;
            }

            // ── Dedup by id ──────────────────────────────────────────────────
            if (q.id) {
                if (seenIds.has(q.id)) continue;
                seenIds.add(q.id);
            } else {
                // Dedup by bucket|year|questionNumber (structural dedup)
                const year   = q.year ?? "?";
                const qNum   = q.questionNumber ?? "?";
                if (year !== "?" && qNum !== "?") {
                    const slot = `${bucket}|${year}|${qNum}`;
                    if (seenBucketSlots.has(slot)) continue;
                    seenBucketSlots.add(slot);
                } else {
                    // Fall back to text fingerprint when slot can't be determined
                    const fp = fingerprint({ ...q, question: questionText });
                    if (seenFingerprints.has(fp)) continue;
                    seenFingerprints.add(fp);
                }
            }

            const resolvedNodeId = resolveCSATNodeId(q);
            result[bucket].push({
                ...q,
                question:       questionText,
                questionText,
                correctAnswer,
                options:        normalizeOptions(q),
                exam:           q.exam    || meta.exam    || "UPSC_CSE",
                stage:          q.stage   || meta.stage   || "Prelims",
                paper:          q.paper   || meta.paper   || "CSAT",
                subject:        q.subject || meta.subject || "CSAT",
                module:         q.module  || meta.module,
                // Normalize nodeId from topic field so backend filters work
                nodeId:         resolvedNodeId || undefined,
                canonicalNodeId: resolvedNodeId || undefined,
                // microTheme = subtopic > topic (never "Unknown")
                microTheme:     q.microTheme || q.subtopic || q.topic || undefined,
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
