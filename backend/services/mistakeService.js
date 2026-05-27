import * as repo from "../repositories/mistakeRepository.js";
import { ensureRevisionItemFromMistake } from "./revisionService.js";

export async function logMistake(payload) {
    const mistake = await repo.upsertMistake(payload);
    
    // Log mistake event
    try {
        const { logStudyEvent } = await import("./eventService.js");
        await logStudyEvent({
            userId: mistake.user_id,
            eventType: "MISTAKE_LOGGED",
            subject: mistake.subject,
            topic: mistake.question_text ? mistake.question_text.slice(0, 100) : '',
            syllabusNodeId: mistake.node_id,
            blockId: mistake.block_id || null,
            metadata: {
                mistake_id: mistake.id,
                source_type: mistake.source_type,
                question_id: mistake.question_id,
                answer_status: mistake.answer_status,
                error_type: mistake.error_type
            }
        });
    } catch (e) {
        console.error("[logMistake] failed logging event:", e.message);
    }

    const isError = mistake.answer_status === "wrong" || mistake.answer_status === "unattempted" || mistake.must_revise;
    if (isError) {
        const rev = await ensureRevisionItemFromMistake(mistake);
        if (rev) {
            try {
                const { logStudyEvent } = await import("./eventService.js");
                await logStudyEvent({
                    userId: rev.user_id,
                    eventType: "REVISION_CREATED",
                    subject: rev.subject,
                    topic: rev.title,
                    syllabusNodeId: rev.node_id,
                    blockId: rev.block_id || mistake.block_id || null,
                    metadata: {
                        revision_id: rev.id,
                        priority: rev.priority,
                        due_date: rev.due_date
                    }
                });
            } catch (e) {
                console.error("[logMistake] failed logging revision event:", e.message);
            }
        }
    }
    return mistake;
}

export async function getMistakes(userId, stage = null) {
    return await repo.listMistakes(userId, stage);
}

export async function patchMistake(id, changes) {
    return await repo.updateMistake(id, changes);
}
