/**
 * GS LOADER — Single Source of Truth for Prelims GS Questions
 * Modified to trigger nodemon restart
 *
 * Loads each GS subject directly from its raw _tagged.json file(s).
 * No dependency on pyq_by_node or pyq_master_index.
 * Mirrors the csatLoader.js pattern for CSAT.
 *
 * Subject keys match the ids in src/data/prelimsStructure.js:
 *   culture, economy, environment, geography, history,
 *   polity, science_tech, ir, current_affairs_misc
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GS_DIR = path.resolve(__dirname, "../pyq_questions/prelims/gs");

// Maps subject key → one or more source files (all within GS_DIR)
const SUBJECT_FILE_MAP = {
    culture: ["prelims_gs_art_culture_tagged.json"],
    economy: ["prelims_gs_economy_tagged.json"],
    environment: ["prelims_gs_environment_tagged.json"],
    geography: [
        "prelims_gs_geography_india_tagged.json",
        "prelims_gs_geography_world_tagged.json",
    ],
    history: [
        "prelims_gs_history_ancient_tagged.json",
        "prelims_gs_history_medieval_tagged.json",
        "prelims_gs_history_modern_tagged.json",
    ],
    polity: ["prelims_gs_polity_governance_tagged.json"],
    science_tech: ["prelims_gs_science_tech_tagged.json"],
    ir: ["prelims_gs_international_relations_tagged.json"],
    current_affairs_misc: ["prelims_gs_current_affairs_misc_tagged.json"],
};

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function extractQuestions(payload) {
    if (Array.isArray(payload?.questions)) return payload.questions;
    if (Array.isArray(payload)) return payload;
    return [];
}

function loadSubjectQuestions(subjectKey) {
    const files = SUBJECT_FILE_MAP[subjectKey];
    if (!files) return [];

    const all = [];
    const seen = new Set();

    for (const fileName of files) {
        const fullPath = path.join(GS_DIR, fileName);
        if (!fs.existsSync(fullPath)) {
            console.warn(`[gsLoader] File not found: ${fullPath}`);
            continue;
        }

        let payload;
        try {
            payload = readJson(fullPath);
        } catch (e) {
            console.error(`[gsLoader] JSON parse error in ${fullPath}:`, e.message);
            continue;
        }

        const questions = extractQuestions(payload);
        for (const q of questions) {
            if (!q?.id) continue;
            if (seen.has(q.id)) continue;  // deduplicate by question ID
            seen.add(q.id);
            all.push({
                ...q,
                primarySubject: subjectKey,
                exam: q.exam || payload.exam || "UPSC_CSE",
                stage: q.stage || payload.stage || "Prelims",
                paper: q.paper || payload.paper || "GS1",
            });
        }
    }

    return all;
}

// In-process cache — survives restarts only via module reload
let _cache = null;

function loadAll() {
    if (_cache) return _cache;
    const result = {};
    for (const key of Object.keys(SUBJECT_FILE_MAP)) {
        result[key] = loadSubjectQuestions(key);
    }
    _cache = result;
    console.log(
        "[gsLoader] Loaded GS data:",
        Object.entries(result)
            .map(([k, v]) => `${k}=${v.length}`)
            .join(", ")
    );
    return result;
}

/** Returns all GS questions keyed by subject. */
export function loadGSData() {
    return loadAll();
}

/**
 * Returns question counts per subject plus a total.
 * Used by GET /api/prelims/gs/counts.
 */
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

/** All valid subject keys. */
export function getGSSubjectKeys() {
    return Object.keys(SUBJECT_FILE_MAP);
}

/** Bust the cache (useful after data files are updated at runtime). */
export function resetGSCache() {
    _cache = null;
}
