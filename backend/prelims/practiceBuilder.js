// backend/prelims/practiceBuilder.js
// Mode-aware wrapper around the existing Prelims question loading infrastructure.
// Supports: "continue" | "restart" | "retry_mistakes"
// Does NOT modify the existing buildPrelimsPracticeTest.js structure.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProgress, resetProgress } from "./topicProgressStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions");

// ─── Helpers (duplicated minimally to avoid breaking existing builder) ─────────

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
        id: String(id),
        questionId: String(id),
        sourceFile,
        answer: String(q.answer || "").trim().toUpperCase(),
        syllabusNodeId: q.syllabusNodeId || q.nodeId || "",
        sectionNorm: norm(q.section || ""),
        microNorm: norm(q.microtheme || q.microTheme || ""),
        moduleNorm: norm(q.module || ""),
    };
}

function dedupeById(items) {
    const seen = new Set();
    const out = [];
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

// ─── Question loader for a specific topicNodeId ───────────────────────────────

/**
 * Load ALL prelims questions that belong to a given topicNodeId (or its descendants).
 * topicNodeId is used as a prefix match against syllabusNodeId on each question.
 */
function loadAllQuestionsForTopic(topicNodeId) {
    if (!topicNodeId) return [];

    const files = getAllJsonFilesRecursive(DATA_DIR).filter(isTaggedPrelimsFile);
    const all = [];

    for (const file of files) {
        try {
            const json = readJSON(file);
            const arr = Array.isArray(json) ? json : safeArray(json?.questions);
            for (const q of arr) {
                const nq = normalizeQuestion(q, file);
                if (!nq) continue;
                const nodeId = nq.syllabusNodeId || "";
                // Match exact or descendant (prefix)
                if (nodeId === topicNodeId || nodeId.startsWith(topicNodeId + "-") || nodeId.startsWith(topicNodeId + "_")) {
                    all.push(nq);
                }
            }
        } catch {
            console.warn("[PracticeBuilder] Skipping unreadable file:", file);
        }
    }

    return dedupeById(all);
}

// ─── Main exported builder ────────────────────────────────────────────────────

/**
 * Build a question set using progress-aware mode.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.topicNodeId
 * @param {number} params.count
 * @param {"continue"|"restart"|"retry_mistakes"} params.practiceMode
 * @param {string} [params.stage]
 * @returns {{ questions: object[], progress: object, totalAvailable: number, mode: string }}
 */
export async function buildProgressAwareTest({
    userId,
    topicNodeId,
    count = 10,
    practiceMode = "continue",
    stage = "prelims",
}) {
    if (!userId) throw new Error("userId is required");
    if (!topicNodeId) throw new Error("topicNodeId is required");

    const allQuestions = loadAllQuestionsForTopic(topicNodeId);
    const totalAvailable = allQuestions.length;

    // Load current progress
    let progress = getProgress(userId, stage, topicNodeId);

    let candidatePool = [];

    if (practiceMode === "restart") {
        // Full reset, start from scratch
        progress = resetProgress(userId, stage, topicNodeId);
        candidatePool = allQuestions;
    } else if (practiceMode === "retry_mistakes") {
        // Only wrong + unattempted questions
        const mistakeSet = new Set([
            ...progress.wrongQuestionIds,
            ...progress.unattemptedQuestionIds,
        ]);
        candidatePool = allQuestions.filter((q) => mistakeSet.has(q.id));
    } else {
        // CONTINUE: exclude already-served questions
        const servedSet = new Set(progress.servedQuestionIds);
        candidatePool = allQuestions.filter((q) => !servedSet.has(q.id));
    }

    // Pick N questions (shuffle to randomize order within pool)
    const picked = shuffle(candidatePool).slice(0, Math.max(1, count));

    return {
        questions: picked,
        progress,
        totalAvailable,
        mode: practiceMode,
    };
}
