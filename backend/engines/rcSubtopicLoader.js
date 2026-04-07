// backend/engines/rcSubtopicLoader.js
// Loads prelims_csat_rc_tagged.json, classifies all 441 RC questions
// into 8 buckets, and caches the result in memory.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyRcQuestion } from "./classifyRcQuestion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RC_FILE = path.resolve(
    __dirname,
    "../data/pyq_questions/prelims/csat/prelims_csat_rc_tagged.json"
);

// ── Topic ID → classifier type ────────────────────────────────────────────────
export const TOPIC_TO_RC_TYPE = {
    rc_assumption:       "ASSUMPTION",
    rc_tone:             "TONE",
    rc_conclusion:       "LOGICAL_CONCLUSION",
    rc_inference:        "INFERENCE",
    rc_main_idea:        "MAIN_IDEA",
    rc_critical_message: "CRITICAL_MESSAGE",
    rc_statement:        "STATEMENT_BASED",
    rc_mixed:            "MIXED",
};

// Reverse: classifier type → topic ID
const TYPE_TO_TOPIC = Object.fromEntries(
    Object.entries(TOPIC_TO_RC_TYPE).map(([k, v]) => [v, k])
);

const SUBTOPIC_LABELS = {
    rc_assumption:       "Assumption",
    rc_tone:             "Tone & Attitude",
    rc_conclusion:       "Logical Conclusion",
    rc_inference:        "Inference",
    rc_main_idea:        "Main Idea / Crux",
    rc_critical_message: "Critical Message",
    rc_statement:        "Statement-Based",
    rc_mixed:            "Mixed / General",
};

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache = null;

function buildCache() {
    const json = JSON.parse(fs.readFileSync(RC_FILE, "utf-8"));
    const questions = Array.isArray(json) ? json : (json.questions || []);

    const buckets = {};
    for (const topicId of Object.keys(TOPIC_TO_RC_TYPE)) {
        buckets[topicId] = {
            id: topicId,
            label: SUBTOPIC_LABELS[topicId],
            questions: [],
        };
    }

    const before = { MIXED: 0 };
    for (const q of questions) {
        const id = q.id || q.questionId;
        if (!id) continue;
        const text = String(q.question || q.questionText || "");
        const type = classifyRcQuestion(text);
        if (type === "MIXED") before.MIXED++;
        const topicId = TYPE_TO_TOPIC[type] || "rc_mixed";
        buckets[topicId].questions.push(q);
    }

    _cache = buckets;
    console.log("[rcSubtopicLoader] Classification complete:");
    Object.entries(buckets).forEach(([k, v]) =>
        console.log(`  ${k.padEnd(22)} → ${v.questions.length}`)
    );
    return buckets;
}

/** Force-bust the cache (call after classifier changes in dev). */
export function resetRcCache() {
    _cache = null;
}

function getCache() {
    return _cache || buildCache();
}

/**
 * Returns [{id, label, count}] for all 8 RC subtopic types.
 * Used by GET /api/prelims/csat/rc-subtopics.
 */
export function getRcSubtopicSummary() {
    const buckets = getCache();
    return Object.values(buckets).map((b) => ({
        id: b.id,
        label: b.label,
        count: b.questions.length,
    }));
}

/**
 * Returns the full question array for a given topicId (e.g., "rc_inference").
 * Used by the practice builder when practiceScope === "topic" for CSAT RC.
 */
export function getRcQuestionsForTopic(topicId) {
    const buckets = getCache();
    return buckets[topicId]?.questions || [];
}
