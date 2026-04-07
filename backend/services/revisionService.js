import * as repo from "../repositories/revisionRepository.js";

function getPriorityFromMistake(mistake) {
    if (mistake.must_revise) return "high";
    if (mistake.answer_status === "wrong") return "high";
    if (mistake.answer_status === "unattempted") return "medium";
    return "low";
}

export async function ensureRevisionItemFromMistake(mistake) {
    if (!mistake?.user_id || !mistake?.question_id) {
        return null;
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
        interval_days: 1,
        last_reviewed_at: null,
        next_review_at: new Date().toISOString(),
    });
}

export async function getRevisionQueue(userId, options = {}) {
    return await repo.listRevisionItems(userId, options);
}

function getNextInterval(currentIntervalDays) {
    const ladder = [1, 3, 7, 15, 30];
    const current = Number(currentIntervalDays) || 1;
    const next = ladder.find((n) => n > current);
    return next || 30;
}

export async function markRevisionReviewed(id) {
    const item = await repo.getRevisionItemById(id);
    if (!item) return null;

    const now = new Date();
    const nextInterval = getNextInterval(item.interval_days);
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + nextInterval);

    return await repo.updateRevisionItem(id, {
        status: "reviewed",
        review_count: (item.review_count || 0) + 1,
        interval_days: nextInterval,
        last_reviewed_at: now.toISOString(),
        next_review_at: nextReview.toISOString(),
    });
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
