// backend/prelims/practiceBuilder.js
// Mode-aware Prelims question builder.
//
// Supported modes:
//   "continue"          — serve only unseen questions (default)
//   "retry_wrong"       — serve only previously wrong questions
//   "retry_attempted"   — serve from all previously served (seen) questions
//   "retry_entire"      — serve all questions in pool; does NOT reset history
//   "restart"           — full reset then serve all questions
//   "retry_mistakes"    — wrong + unattempted (legacy compat, same as retry_wrong+unattempted)
//
// Subject-level synthetic nodeIds:
//   "SUBJ::GS::economy"  — loads all economy questions by subject field
//   "SUBJ::GS::history"  — loads history questions (all sub-subjects)
//   etc.
//
// Does NOT modify topicProgressStore.js or any existing builder outside this file.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProgress, resetProgress } from "./topicProgressStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions");

// ─── Subject alias map ────────────────────────────────────────────────────────
// Maps subjectId → canonical subject field values found in question JSON files.
// Mirrors getSubjectBuildHints() in frontend/PrelimsPage.jsx.

const GS_SUBJECT_ALIASES = {
    culture:              ["Art & Culture", "Culture"],
    economy:              ["Economy"],
    environment:          ["Environment", "Ecology", "Env & Ecology"],
    geography:            ["Geography"],
    history:              ["Ancient History", "Medieval History", "Modern History", "History"],
    polity:               ["Polity", "Indian Polity"],
    science_tech:         ["Science & Technology", "ScienceTech", "Science and Technology", "Science Tech"],
    ir:                   ["International Relations", "IR", "International Relation"],
    current_affairs_misc: ["Current Affairs & Misc", "Current Affairs", "Miscellaneous", "Misc", "Current Affairs and Misc"],
};

// ─── Question loader cache ────────────────────────────────────────────────────
// Avoids rescanning the entire question directory on every request.
// Keys are topicNodeId strings; values are the deduped question arrays.
// Safe to cache forever: question files don't change during server lifetime.
const _questionCache = new Map();

// ─── File helpers ─────────────────────────────────────────────────────────────

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function norm(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[_/\\-]+/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getAllJsonFilesRecursive(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getAllJsonFilesRecursive(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            results.push(fullPath);
        }
    }
    return results;
}

function isTaggedPrelimsFile(filePath) {
    const name = path.basename(filePath).toLowerCase();
    return name.startsWith("prelims_") && name.endsWith("_tagged.json");
}

function normalizeQuestion(q, sourceFile) {
    const id = q?.id || q?.questionId;
    if (!id) return null;
    const question = String(q.question || q.questionText || q.title || "").trim();
    if (!question) return null;
    return {
        ...q,
        id:           String(id),
        questionId:   String(id),
        sourceFile,
        answer:       String(q.answer || "").trim().toUpperCase(),
        syllabusNodeId: q.syllabusNodeId || q.nodeId || "",
        sectionNorm:  norm(q.section || ""),
        microNorm:    norm(q.microtheme || q.microTheme || ""),
        moduleNorm:   norm(q.module || ""),
    };
}

function dedupeById(items) {
    const seen = new Set();
    const out  = [];
    for (const item of items) {
        const id = item?.id || item?.questionId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(item);
    }
    return out;
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ─── Question loaders ─────────────────────────────────────────────────────────

/**
 * Load all prelims questions matching a syllabusNodeId prefix.
 * Used for topic/subtopic scope.
 */
function loadAllQuestionsForTopic(topicNodeId) {
    if (!topicNodeId) return [];
    if (_questionCache.has(topicNodeId)) return _questionCache.get(topicNodeId);

    const files = getAllJsonFilesRecursive(DATA_DIR).filter(isTaggedPrelimsFile);
    const all   = [];

    for (const file of files) {
        try {
            const json = readJSON(file);
            const arr  = Array.isArray(json) ? json : safeArray(json?.questions);
            for (const q of arr) {
                const nq = normalizeQuestion(q, file);
                if (!nq) continue;
                const nodeId = nq.syllabusNodeId || "";
                if (
                    nodeId === topicNodeId ||
                    nodeId.startsWith(topicNodeId + "-") ||
                    nodeId.startsWith(topicNodeId + "_")
                ) {
                    all.push(nq);
                }
            }
        } catch {
            console.warn("[PracticeBuilder] Skipping unreadable file:", file);
        }
    }
    const result = dedupeById(all);
    _questionCache.set(topicNodeId, result);
    return result;
}

/**
 * Load all prelims GS questions for a subject using the subject field.
 * Used for synthetic nodeIds like "SUBJ::GS::economy".
 */
function loadAllQuestionsForSubjectId(subjectId) {
    const cacheKey = `SUBJ::GS::${subjectId}`;
    if (_questionCache.has(cacheKey)) return _questionCache.get(cacheKey);

    const aliases = GS_SUBJECT_ALIASES[subjectId];
    if (!aliases || !aliases.length) {
        console.warn("[PracticeBuilder] Unknown subjectId for subject loading:", subjectId);
        return [];
    }
    const normalizedAliases = new Set(aliases.map((a) => norm(a)));

    const files = getAllJsonFilesRecursive(DATA_DIR).filter(isTaggedPrelimsFile);
    const all   = [];

    for (const file of files) {
        // Skip CSAT files for GS subject loading
        if (file.includes(path.sep + "csat" + path.sep)) continue;
        try {
            const json = readJSON(file);
            const arr  = Array.isArray(json) ? json : safeArray(json?.questions);
            for (const q of arr) {
                const nq = normalizeQuestion(q, file);
                if (!nq) continue;
                // Exact match only: prevents short aliases ("ir") matching unrelated subjects
                if (normalizedAliases.has(norm(q.subject || ""))) {
                    all.push(nq);
                }
            }
        } catch {
            console.warn("[PracticeBuilder] Skipping unreadable file:", file);
        }
    }
    const result = dedupeById(all);
    _questionCache.set(cacheKey, result);
    return result;
}

/**
 * Parse synthetic subject nodeId: "SUBJ::GS::economy" → { paper:"GS", subjectId:"economy" }
 * Returns null if not a synthetic nodeId.
 */
function parseSyntheticNodeId(topicNodeId) {
    if (!topicNodeId || !topicNodeId.startsWith("SUBJ::")) return null;
    const parts = topicNodeId.split("::");
    if (parts.length < 3) return null;
    return { paper: parts[1], subjectId: parts[2] };
}

// ─── Pool counts helper ───────────────────────────────────────────────────────

/**
 * Given all questions and current progress, compute pool sizes for each mode.
 */
export function computePoolCounts(allQuestions, progress) {
    const served      = new Set(progress.servedQuestionIds      || []);
    const wrong       = new Set(progress.wrongQuestionIds       || []);
    const unattempted = new Set(progress.unattemptedQuestionIds || []);

    let unseen = 0, wrongOnly = 0, mistakes = 0, attempted = 0;
    for (const q of allQuestions) {
        const id = q.id;
        if (!served.has(id))                     unseen++;
        if (wrong.has(id))                        wrongOnly++;
        if (wrong.has(id) || unattempted.has(id)) mistakes++;
        if (served.has(id))                       attempted++;
    }
    return { total: allQuestions.length, unseen, wrongOnly, mistakes, attempted, entire: allQuestions.length };
}

// ─── Main exported builder ────────────────────────────────────────────────────

/**
 * Build a question set using progress-aware mode.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.topicNodeId      — may be synthetic "SUBJ::GS::economy"
 * @param {number} params.count
 * @param {"continue"|"retry_wrong"|"retry_attempted"|"retry_entire"|"restart"|"retry_mistakes"} params.practiceMode
 * @param {string} [params.stage]
 * @returns {{ questions, progress, totalAvailable, mode, poolCounts }}
 */
export async function buildProgressAwareTest({userId, topicNodeId, count, practiceMode, stage}) { return await buildProgressAwareTestImpl({userId, topicNodeId, count, practiceMode, stage}); }
export async function buildProgressAwareTestImpl({
    userId,
    topicNodeId,
    count = 10,
    practiceMode = "continue",
    stage = "prelims",
}) {
    if (!userId)      throw new Error("userId is required");
    if (!topicNodeId) throw new Error("topicNodeId is required");

    // ── Load all questions for this scope ──────────────────────────────────────
    let allQuestions;
    const parsed = parseSyntheticNodeId(topicNodeId);
    if (parsed) {
        // Subject-level synthetic nodeId → load by subject field
        allQuestions = loadAllQuestionsForSubjectId(parsed.subjectId);
    } else {
        // Standard syllabusNodeId prefix match
        allQuestions = loadAllQuestionsForTopic(topicNodeId);
    }
    const totalAvailable = allQuestions.length;

    // ── Load current progress ──────────────────────────────────────────────────
    let progress = getProgress(userId, stage, topicNodeId);

    // ── Build candidate pool based on mode ─────────────────────────────────────
    let candidatePool = [];

    if (practiceMode === "restart") {
        // Full reset then serve everything
        progress = resetProgress(userId, stage, topicNodeId);
        candidatePool = allQuestions;

    } else if (practiceMode === "retry_wrong") {
        // Wrong answers only
        const wrongSet = new Set(progress.wrongQuestionIds || []);
        candidatePool = allQuestions.filter((q) => wrongSet.has(q.id));

    } else if (practiceMode === "retry_mistakes") {
        // Legacy: wrong + unattempted (kept for backward compat)
        const mistakeSet = new Set([
            ...(progress.wrongQuestionIds      || []),
            ...(progress.unattemptedQuestionIds || []),
        ]);
        candidatePool = allQuestions.filter((q) => mistakeSet.has(q.id));

    } else if (practiceMode === "retry_attempted") {
        // All previously served questions (re-attempt seen set)
        const servedSet = new Set(progress.servedQuestionIds || []);
        candidatePool = allQuestions.filter((q) => servedSet.has(q.id));

    } else if (practiceMode === "retry_entire") {
        // Full subject pool WITHOUT resetting history
        // Repeated questions won't inflate coverage because updateProgress deduplicates
        candidatePool = allQuestions;

    } else {
        // DEFAULT: "continue" — serve only unseen questions
        const servedSet = new Set(progress.servedQuestionIds || []);
        candidatePool = allQuestions.filter((q) => !servedSet.has(q.id));
    }

    // ── Pick N questions (shuffled within pool) ────────────────────────────────
    const safeCount = Math.max(1, Math.min(count, candidatePool.length));
    const picked    = shuffle(candidatePool).slice(0, safeCount);

    // ── Compute pool counts for UI display ─────────────────────────────────────
    const poolCounts = computePoolCounts(allQuestions, progress);

    return {
        questions:      picked,
        progress,
        totalAvailable,
        mode:           practiceMode,
        poolCounts,
        candidateSize:  candidatePool.length,  // available for selected mode
    };
}

/**
 * Standalone: load all questions for a nodeId or synthetic subject key.
 * Used by progressRoute to count totalQuestions.
 */
export function loadAllQuestionsForNodeId(topicNodeId) {
    if (!topicNodeId) return [];
    const parsed = parseSyntheticNodeId(topicNodeId);
    if (parsed) return loadAllQuestionsForSubjectId(parsed.subjectId);
    return loadAllQuestionsForTopic(topicNodeId);
}
