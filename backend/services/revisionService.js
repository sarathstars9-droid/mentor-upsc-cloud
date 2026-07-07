import * as repo from "../repositories/revisionRepository.js";
import { query } from "../db/index.js";

function getPriorityFromMistake(mistake) {
    if (mistake.must_revise || mistake.severity === "high") return "high";
    if (mistake.answer_status === "wrong") return "high";
    if (mistake.severity === "medium" || mistake.answer_status === "unattempted") return "medium";
    return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spaced repetition interval ladder.
// ─────────────────────────────────────────────────────────────────────────────
function getNextIntervalDays(reviewCount, priority) {
    const ladder = [1, 3, 7, 15, 30, 45, 60];
    const base = ladder[Math.min(reviewCount, ladder.length - 1)];

    const multiplier =
        priority === "high" ? 0.7 :
        priority === "low"  ? 1.2 :
        1.0;

    return Math.max(1, Math.round(base * multiplier));
}

export async function ensureRevisionItemFromMistake(mistake) {
    if (!mistake?.user_id) {
        return null;
    }

    try {
        const existing = await repo.findRevisionItemForMistake(
            mistake.user_id,
            mistake.question_id || null,
            mistake.source_type || null,
            mistake.source_ref || null,
            mistake.stage || null,
            mistake.id || null
        );

        let intervalDays = 3; // default
        if (mistake.severity === "high" || mistake.must_revise) {
            intervalDays = 1;
        } else if (mistake.severity === "medium") {
            intervalDays = 3;
        } else if (mistake.severity === "low") {
            intervalDays = 7;
        }

        const nextReviewAt = new Date();
        nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
        const nextReviewAtStr = nextReviewAt.toISOString();

        // Check if this mistake type was made before in a different attempt
        let hasPreviousRepeat = false;
        if (mistake.paper && mistake.mistake_type && mistake.attempt_id) {
            const repeatCheck = await query(
                `SELECT id FROM mistakes 
                 WHERE user_id = $1 AND paper = $2 AND mistake_type = $3 AND attempt_id <> $4 AND id <> $5
                 LIMIT 1`,
                [mistake.user_id, mistake.paper, mistake.mistake_type, mistake.attempt_id, mistake.id]
            );
            if (repeatCheck.rows.length > 0) {
                hasPreviousRepeat = true;
            }
        }

        if (existing) {
            const updates = {};
            
            // Priority escalation
            let nextPriority = existing.priority || "low";
            if (hasPreviousRepeat || mistake.severity === "high" || mistake.must_revise) {
                nextPriority = "high";
            } else {
                if (nextPriority === "low") {
                    nextPriority = "medium";
                } else if (nextPriority === "medium") {
                    nextPriority = "high";
                }
            }
            if (nextPriority !== existing.priority) {
                updates.priority = nextPriority;
            }

            // Reactivate completed / resolved revision item
            const isCompleted = ["completed", "revised", "reviewed"].includes(existing.status);
            if (isCompleted || existing.status !== "pending" || mistake.must_revise || mistake.severity === "high" || hasPreviousRepeat) {
                updates.status = "pending";
                updates.next_review_at = nextReviewAtStr;
                updates.due_date = nextReviewAtStr;
            }

            if (Object.keys(updates).length > 0) {
                return await repo.updateRevisionItem(existing.id, updates);
            }
            return existing;
        }

        let basePriority = getPriorityFromMistake(mistake);
        if (hasPreviousRepeat) {
            basePriority = "high";
        }

        return await repo.upsertRevisionItem({
            user_id: mistake.user_id,
            source_type: mistake.source_type,
            source_ref: mistake.source_ref,
            question_id: mistake.question_id,
            stage: mistake.stage,
            subject: mistake.subject,
            node_id: mistake.node_id,
            title: mistake.question_text
                ? (mistake.question_text.length > 120 ? mistake.question_text.slice(0, 120) + "…" : mistake.question_text)
                : (mistake.mistake_text || "Revision Item"),
            content: mistake.question_text || mistake.mistake_text || null,
            question_text: mistake.question_text || null,
            status: "pending",
            priority: basePriority,
            review_count: 0,
            interval_days: intervalDays,
            last_reviewed_at: null,
            next_review_at: nextReviewAtStr,
            due_date: nextReviewAtStr,
            block_id: mistake.block_id || null,
            mistake_id: mistake.id || null,
        });
    } catch (err) {
        console.error(
            "[REVISION] ensureRevisionItemFromMistake failed — mistake was saved, revision item was not created:",
            err?.message || err,
            { userId: mistake.user_id, questionId: mistake.question_id, stage: mistake.stage }
        );
        return null;
    }
}

export async function getRevisionQueue(userId, options = {}) {
    return await repo.listRevisionItems(userId, options);
}

export async function markRevisionReviewed(id) {
    const item = await repo.getRevisionItemById(id);
    if (!item) return null;

    const currentReviewCount = item.review_count ?? item.revision_count ?? 0;
    const newReviewCount = currentReviewCount + 1;

    const intervalDays = getNextIntervalDays(currentReviewCount, item.priority);

    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + intervalDays);
    const nextReviewStr = nextReview.toISOString();

    const updated = await repo.updateRevisionItem(id, {
        status:           "completed",
        review_count:     newReviewCount,
        revision_count:   newReviewCount,   // keep both fields in sync
        interval_days:    intervalDays,
        last_reviewed_at: now.toISOString(),
        next_review_at:   nextReviewStr,
        due_date:         nextReviewStr,
    });

    if (updated) {
        try {
            const { logStudyEvent } = await import("./eventService.js");
            await logStudyEvent({
                userId: updated.user_id,
                eventType: "REVISION_COMPLETED",
                subject: updated.subject,
                topic: updated.title,
                syllabusNodeId: updated.node_id,
                blockId: updated.block_id || null,
                metadata: {
                    revision_id: updated.id,
                    review_count: updated.review_count,
                    interval_days: updated.interval_days
                }
            });
        } catch (e) {
            console.error("[markRevisionReviewed] failed logging event:", e.message);
        }
    }

    return updated;
}

export async function snoozeRevision(id, days = 1) {
    const item = await repo.getRevisionItemById(id);
    if (!item) return null;

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + Number(days || 1));

    return await repo.updateRevisionItem(id, {
        status: "pending",
        next_review_at: nextReview.toISOString(),
    });
}

export async function patchRevisionItem(id, changes) {
    return await repo.updateRevisionItem(id, changes);
}
