import { hhmmToMinutes } from "../../utils/studyEngine";

export function getCurrentBlock(todayBlocks, getEffectiveBlockStatus, BLOCK_STATUS) {
    if (!todayBlocks.length) return null;

    const visibleBlocks = todayBlocks
        .filter((b) => {
            const status = getEffectiveBlockStatus(b);
            return [BLOCK_STATUS.ACTIVE, BLOCK_STATUS.PAUSED].includes(String(status).toLowerCase());
        })
        .sort((a, b) => {
            const aMin = hhmmToMinutes(a?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            const bMin = hhmmToMinutes(b?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            return aMin - bMin;
        });

    if (!visibleBlocks.length) return null;

    return (
        visibleBlocks.find((b) => String(getEffectiveBlockStatus(b)).toLowerCase() === BLOCK_STATUS.ACTIVE) ||
        visibleBlocks.find((b) => String(getEffectiveBlockStatus(b)).toLowerCase() === BLOCK_STATUS.PAUSED) ||
        null
    );
}