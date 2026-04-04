/**
 * prelimsInstitutionalSyncEngine.js
 *
 * Syncs confirmed institutional evaluation results to:
 *   1. Mistake Book  (localStorage "prelims_mistakes")
 *   2. Revision Queue (localStorage "prelims_revision_queue_v1")
 *
 * RULES:
 *   - Only wrong and unattempted questions are synced.
 *   - Correct questions are never synced.
 *   - Duplicate protection via stable deterministic IDs.
 *   - Broad subject bucket (subjectBucket, subjectConfidence, mappingStatus)
 *     is forwarded from the evaluator's questionResult.
 *   - No exact topic/node mapping in this step.
 *
 * STABLE IDs:
 *   Mistake Book  → questionId: "INST_<testId>_<questionNumber>"
 *   Revision Queue → id:        "REV_INST_<testId>_<questionNumber>"
 */

// ─── Storage keys ─────────────────────────────────────────────────────────────
const MISTAKES_KEY  = "prelims_mistakes";
const REVISION_KEY  = "prelims_revision_queue_v1";
const MAX_MISTAKES  = 2000;
const MAX_REVISION  = 2000;

// ─── Internal helpers ─────────────────────────────────────────────────────────
function safeRead(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function safeWrite(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/**
 * Build a stable, deterministic mistake Book questionId.
 * Format: INST_<testId>_<questionNumber>
 *
 * Using the institutional test's UUID testId ensures uniqueness across tests.
 */
function mistakeQid(testId, questionNumber) {
    return `INST_${testId}_${questionNumber}`;
}

/**
 * Build a stable revision queue item ID.
 * Format: REV_INST_<testId>_<questionNumber>
 */
function revisionId(testId, questionNumber) {
    return `REV_INST_${testId}_${questionNumber}`;
}

// ─── Preview helper ───────────────────────────────────────────────────────────

/**
 * Returns a preview of what would be synced without writing anything.
 *
 * @param {object} test              Evaluated test record from institutionalTestStore
 * @param {object} evaluationResult  Result from evaluateAnswers()
 * @returns {{ total: number, wrong: number, unattempted: number,
 *             mistakeBookNew: number, revisionNew: number }}
 */
export function previewSync(test, evaluationResult) {
    const eligible = (evaluationResult.questionResults || []).filter(
        (r) => r.result === "wrong" || r.result === "unattempted"
    );

    const existingMistakeIds = new Set(
        safeRead(MISTAKES_KEY).map((m) => m.questionId)
    );
    const existingRevIds = new Set(
        safeRead(REVISION_KEY).map((r) => r.id)
    );

    let mistakeNew = 0;
    let revisionNew = 0;

    for (const q of eligible) {
        const qid = mistakeQid(test.id, q.questionNumber);
        const rid = revisionId(test.id, q.questionNumber);
        if (!existingMistakeIds.has(qid)) mistakeNew++;
        if (!existingRevIds.has(rid)) revisionNew++;
    }

    return {
        total:       evaluationResult.totalQuestions,
        wrong:       evaluationResult.wrong,
        unattempted: evaluationResult.unattempted,
        eligible:    eligible.length,
        mistakeBookNew:  mistakeNew,
        revisionNew,
    };
}

// ─── Mistake Book sync ────────────────────────────────────────────────────────

/**
 * Sync institutional evaluation results into the Mistake Book.
 * Only wrong and unattempted questions are written.
 * Existing entries (same questionId) are skipped — idempotent.
 *
 * @param {object} test              Evaluated test record from institutionalTestStore
 * @param {object} evaluationResult  Result from evaluateAnswers()
 * @returns {{ added: number, skipped: number }}
 */
export function syncToMistakeBook(test, evaluationResult) {
    const now     = new Date().toISOString();
    const existing = safeRead(MISTAKES_KEY);

    // Build Set of existing questionIds for O(1) duplicate check
    const existingQids = new Set(existing.map((m) => m.questionId));

    const toAdd = [];

    for (const q of (evaluationResult.questionResults || [])) {
        // Only wrong and unattempted
        if (q.result !== "wrong" && q.result !== "unattempted") continue;

        const questionId = mistakeQid(test.id, q.questionNumber);

        // Duplicate protection
        if (existingQids.has(questionId)) continue;

        toAdd.push({
            // Identity
            id:             questionId,   // display-facing id
            questionId,                   // engine key used by mistake engine

            // Source
            sourceType:     "institutional",
            paperType:      test.paperType || q.paperType || "GS",
            testId:         test.id,
            testTitle:      test.title || "",
            year:           test.year   || null,

            // Broad subject bucket from evaluator (may be null in V1 — no question text)
            subjectBucket:     q.subjectBucket     || null,
            subjectConfidence: q.subjectConfidence || 0,
            mappingStatus:     q.mappingStatus     || "unmapped",

            // Compat field for existing Mistake Book UI subject filter
            subject:   q.subjectBucket || "",
            topic:     "",
            subtopic:  "",
            nodeId:    "",

            // Question data (sparse in V1 — no question text from file upload)
            questionNumber: q.questionNumber,
            questionText:   q.questionText  || null,
            options:        q.options       || null,
            correctAnswer:  q.correctAnswer || "",
            userAnswer:     q.userAnswer    || null,

            // Classification
            result:         q.result,
            mistakeType:    q.result === "unattempted" ? "unattempted" : "conceptual_error",
            latestResult:   q.result,
            latestUserAnswer: q.userAnswer || null,

            // Revision tracking (compatible with existing mistake engine)
            status:          "new",
            revisionCount:   0,
            totalWrongCount: 1,
            totalSeenCount:  1,

            // Timestamps
            createdAt:      now,
            firstSeenAt:    now,
            lastSeenAt:     now,
            lastReviewedAt: null,
            updatedAt:      now,

            attemptHistory: [{
                attemptId:     `inst_${test.id}`,
                testId:        test.id,
                createdAt:     now,
                userAnswer:    q.userAnswer || null,
                correctAnswer: q.correctAnswer || "",
                confidence:    "not_sure",
                timeTaken:     null,
                result:        q.result,
            }],
        });
    }

    if (toAdd.length > 0) {
        const merged = [...toAdd, ...existing].slice(0, MAX_MISTAKES);
        safeWrite(MISTAKES_KEY, merged);
    }

    return { added: toAdd.length, skipped: (evaluationResult.questionResults || []).filter(
        (r) => r.result !== "correct" && existingQids.has(mistakeQid(test.id, r.questionNumber))
    ).length };
}

// ─── Revision Queue sync ──────────────────────────────────────────────────────

/**
 * Sync institutional evaluation results into the Revision Queue.
 * Only wrong and unattempted questions are written.
 * Existing entries (same id) are skipped — idempotent.
 *
 * nextRevisionAt is set to tomorrow by default.
 *
 * @param {object} test              Evaluated test record from institutionalTestStore
 * @param {object} evaluationResult  Result from evaluateAnswers()
 * @returns {{ added: number, skipped: number }}
 */
export function syncToRevisionQueue(test, evaluationResult) {
    const now  = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const existing  = safeRead(REVISION_KEY);
    const existingIds = new Set(existing.map((r) => r.id));

    const toAdd = [];

    for (const q of (evaluationResult.questionResults || [])) {
        if (q.result !== "wrong" && q.result !== "unattempted") continue;

        const rid     = revisionId(test.id, q.questionNumber);
        const sourceId = mistakeQid(test.id, q.questionNumber);

        if (existingIds.has(rid)) continue;

        toAdd.push({
            id:             rid,
            revisionType:   "question",         // question-only — no topic revision
            sourceType:     "institutional",
            sourceId,                           // links back to Mistake Book entry
            paperType:      test.paperType || q.paperType || "GS",
            testId:         test.id,
            testTitle:      test.title || "",
            year:           test.year  || null,

            // Broad subject bucket from evaluator (null in V1 — no question text)
            subjectBucket:     q.subjectBucket     || null,
            subjectConfidence: q.subjectConfidence || 0,
            mappingStatus:     q.mappingStatus     || "unmapped",
            mappedNodeId:      null,             // never set — no node mapping in this step

            // Question data
            questionNumber: q.questionNumber,
            questionText:   q.questionText  || null,
            options:        q.options       || null,
            correctAnswer:  q.correctAnswer || "",
            userAnswer:     q.userAnswer    || null,
            result:         q.result,

            // No exact topic/node fields — compat shape only
            subject:  q.subjectBucket || "",
            topic:    "",
            nodeId:   "",

            // SRS fields
            revisionCount:  0,
            status:         "pending",
            priority:       q.result === "wrong" ? "high" : "medium",

            // Timestamps
            createdAt:      now,
            updatedAt:      now,
            nextRevisionAt: tomorrow,
            lastRevisedAt:  null,
        });
    }

    if (toAdd.length > 0) {
        const merged = [...toAdd, ...existing].slice(0, MAX_REVISION);
        safeWrite(REVISION_KEY, merged);
    }

    return { added: toAdd.length, skipped: (evaluationResult.questionResults || []).filter(
        (r) => r.result !== "correct" && existingIds.has(revisionId(test.id, r.questionNumber))
    ).length };
}
