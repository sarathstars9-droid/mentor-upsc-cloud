import * as repo from "../repositories/mistakeRepository.js";
import { ensureRevisionItemFromMistake } from "./revisionService.js";

export async function logMistake(payload) {
    const mistake = await repo.upsertMistake(payload);
    const isError = mistake.answer_status === "wrong" || mistake.answer_status === "unattempted" || mistake.must_revise;
    if (isError) {
        await ensureRevisionItemFromMistake(mistake);
    }
    return mistake;
}

export async function getMistakes(userId, stage = null) {
    return await repo.listMistakes(userId, stage);
}

export async function patchMistake(id, changes) {
    return await repo.updateMistake(id, changes);
}
