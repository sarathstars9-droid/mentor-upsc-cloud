import * as repo from "../repositories/mistakeRepository.js";

export async function logMistake(payload) {
    return await repo.upsertMistake(payload);
}

export async function getMistakes(userId, stage = null) {
    return await repo.listMistakes(userId, stage);
}

export async function patchMistake(id, changes) {
    return await repo.updateMistake(id, changes);
}
