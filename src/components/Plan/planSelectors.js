import { hhmmToMinutes } from "../../utils/studyEngine";

export function getCurrentBlock(todayBlocks, getEffectiveBlockStatus, BLOCK_STATUS) {
    if (!todayBlocks.length) return null;

    const visibleBlocks = todayBlocks
        .filter((b) => {
            const status = getEffectiveBlockStatus(b);
            return (
                status !== "review_pending" &&
                status !== BLOCK_STATUS.COMPLETED &&
                status !== BLOCK_STATUS.PARTIAL &&
                status !== BLOCK_STATUS.MISSED &&
                status !== BLOCK_STATUS.SKIPPED
            );
        })
        .sort((a, b) => {
            const aMin = hhmmToMinutes(a?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            const bMin = hhmmToMinutes(b?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            return aMin - bMin;
        });

    if (!visibleBlocks.length) return null;

    return (
        visibleBlocks.find((b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.ACTIVE) ||
        visibleBlocks.find((b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.PAUSED) ||
        visibleBlocks.find((b) => getEffectiveBlockStatus(b) === BLOCK_STATUS.PLANNED) ||
        visibleBlocks[0] ||
        null
    );
}