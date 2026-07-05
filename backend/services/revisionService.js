import * as repo from "../repositories/revisionRepository.js";

function getPriorityFromMistake(mistake) {
    if (mistake.must_revise) return "high";
    if (mistake.answer_status === "wrong") return "high";
    if (mistake.answer_status === "unattempted") return "medium";
    return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spaced repetition interval ladder.
//
// reviewCount is the value BEFORE this review (i.e. how many times the item
// has been reviewed so far). The returned value is the number of days until
// the next review should be shown.
//
// Priority tuning:
//   high  → 0.7× (review sooner — high-priority items need more reinforcement)
//   low   → 1.2× (review later  — low-priority items can wait longer)
//   medium → 1.0× (no change)
//
// Minimum enforced at 1 day so next_review_at never moves backwards.
// ─────────────────────────────────────────────────────────────────────────────
function getNextIntervalDays(reviewCount, priority) {
    const ladder = [1, 3, 7, 15, 30, 45, 60];
    // reviewCount 0 → ladder[0]=1d, 1 → ladder[1]=3d … 5+ → ladder[6]=60d
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
        // SELECT first — prevents duplicates without depending on DB unique index
        const existing = await repo.findRevisionItemForMistake(
            mistake.user_id,
            mistake.question_id || null,
            mistake.source_type || null,
            mistake.source_ref || null,
            mistake.stage || null
        );

        let intervalDays = 1;
        if (mistake.severity === "high") {
            intervalDays = 1; // today or tomorrow
        } else if (mistake.severity === "medium") {
            intervalDays = 3; // 3 or 7 days
        } else if (mistake.severity === "low") {
            intervalDays = 7; // 7 to 14 days
        }

        const nextReviewAt = new Date();
        nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
        const nextReviewAtStr = nextReviewAt.toISOString();

        if (existing) {
            const newPriority = getPriorityFromMistake(mistake);
            const updates = {};
            if (newPriority === "high" && existing.priority !== "high") {
                updates.priority = "high";
            }
            if ((mistake.must_revise || mistake.severity === "high") && existing.status !== "pending") {
                updates.status = "pending";
                updates.next_review_at = nextReviewAtStr;
                updates.due_date = nextReviewAtStr;
            }
            if (Object.keys(updates).length > 0) {
                return await repo.updateRevisionItem(existing.id, updates);
            }
            return existing;
        }

        return await repo.upsertRevisionItem({
            user_id: mistake.user_id,
            source_type: mistake.source_type,
            source_ref: mistake.source_ref,
            question_id: mistake.question_id,
            stage: mistake.stage,
            subject: mistake.subject,
            node_id: mistake.node_id,
            question_text: mistake.question_text,
            status: "pending",
            priority: getPriorityFromMistake(mistake),
            review_count: 0,
            interval_days: intervalDays,
            last_reviewed_at: null,
            next_review_at: nextReviewAtStr,
            due_date: nextReviewAtStr,
            block_id: mistake.block_id || null,
            mistake_id: mistake.id || null,
        });
    } catch (err) {
        // Revision item creation must never break the mistake save flow.
        // Log the error so it's visible in Railway logs, but do not rethrow.
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

    // Use review_count (preferred) or fall back to revision_count for
    // backward compatibility with rows created before the migration.
    const currentReviewCount = item.review_count ?? item.revision_count ?? 0;
    const newReviewCount = currentReviewCount + 1;

    const intervalDays = getNextIntervalDays(currentReviewCount, item.priority);

    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + intervalDays);

    const updated = await repo.updateRevisionItem(id, {
        status:           "reviewed",
        review_count:     newReviewCount,
        revision_count:   newReviewCount,   // keep both fields in sync
        interval_days:    intervalDays,
        last_reviewed_at: now.toISOString(),
        next_review_at:   nextReview.toISOString(),
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
