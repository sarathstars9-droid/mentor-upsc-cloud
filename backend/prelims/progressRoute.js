// backend/prelims/progressRoute.js
// GET /api/prelims/progress/:topicNodeId?userId=...
// Returns cross-device progress stats for a given topic.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProgress } from "./topicProgressStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data", "pyq_questions");

// ─── Count total available questions for a topicNodeId ────────────────────────

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

function countTotalQuestionsForTopic(topicNodeId) {
    if (!topicNodeId) return 0;
    const files = getAllJsonFilesRecursive(DATA_DIR).filter(isTaggedPrelimsFile);
    const seen = new Set();

    for (const file of files) {
        try {
            const json = JSON.parse(fs.readFileSync(file, "utf-8"));
            const arr = Array.isArray(json) ? json : (Array.isArray(json?.questions) ? json.questions : []);
            for (const q of arr) {
                const id = q?.id || q?.questionId;
                if (!id || seen.has(id)) continue;
                const nodeId = q?.syllabusNodeId || q?.nodeId || "";
                if (nodeId === topicNodeId || nodeId.startsWith(topicNodeId + "-") || nodeId.startsWith(topicNodeId + "_")) {
                    seen.add(id);
                }
            }
        } catch {
            // skip unreadable files
        }
    }

    return seen.size;
}

/**
 * GET /api/prelims/progress/:topicNodeId?userId=...
 *
 * Response:
 * {
 *   ok: true,
 *   topicNodeId: string,
 *   userId: string,
 *   totalQuestions: number,
 *   servedCount: number,
 *   remainingCount: number,
 *   wrongCount: number,
 *   unattemptedCount: number,
 *   canContinue: boolean,          // remainingCount > 0
 *   canRetryMistakes: boolean,     // wrongCount + unattemptedCount > 0
 *   canRestart: boolean,           // always true (reset is always allowed)
 *   isFullyCompleted: boolean      // servedCount >= totalQuestions
 * }
 */
export default async function progressRouteHandler(req, res) {
    try {
        const topicNodeId = String(req.params?.topicNodeId || "").trim();
        const userId = String(req.query?.userId || "").trim();
        const stage = String(req.query?.stage || "prelims").trim();

        if (!topicNodeId) {
            return res.status(400).json({ ok: false, error: "topicNodeId is required" });
        }
        if (!userId) {
            return res.status(400).json({ ok: false, error: "userId query param is required" });
        }

        const progress = getProgress(userId, stage, topicNodeId);
        const totalQuestions = countTotalQuestionsForTopic(topicNodeId);

        const servedCount = progress.servedQuestionIds.length;
        const wrongCount = progress.wrongQuestionIds.length;
        const unattemptedCount = progress.unattemptedQuestionIds.length;
        const remainingCount = Math.max(0, totalQuestions - servedCount);
        const isFullyCompleted = servedCount >= totalQuestions && totalQuestions > 0;

        return res.json({
            ok: true,
            topicNodeId,
            userId,
            stage,
            totalQuestions,
            servedCount,
            remainingCount,
            wrongCount,
            unattemptedCount,
            canContinue: remainingCount > 0,
            canRetryMistakes: wrongCount + unattemptedCount > 0,
            canRestart: true,  // always allowed
            isFullyCompleted,
            lastAttemptId: progress.lastAttemptId || null,
            updatedAt: progress.updatedAt || null,
        });
    } catch (error) {
        console.error("[progressRoute] Error:", error);
        return res.status(500).json({
            ok: false,
            error: error.message || "Failed to fetch topic progress",
        });
    }
}
