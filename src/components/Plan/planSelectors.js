import { hhmmToMinutes } from "../../utils/studyEngine";

export function getCurrentBlock(todayBlocks, getEffectiveBlockStatus, BLOCK_STATUS) {
    if (!todayBlocks.length) return null;

    // 1. Explicitly active or paused block takes absolute precedence
    const activeOrPaused = todayBlocks.find((b) => {
        const status = String(getEffectiveBlockStatus(b)).toLowerCase();
        return ["active", "paused"].includes(status);
    });
    if (activeOrPaused) return activeOrPaused;

    // 2. Otherwise, select the most relevant not-started block (ready_to_start, overdue, or planned)
    const notStartedBlocks = todayBlocks
        .filter((b) => {
            const status = String(getEffectiveBlockStatus(b)).toLowerCase();
            return ["planned", "ready_to_start", "overdue"].includes(status);
        })
        .sort((a, b) => {
            const aMin = hhmmToMinutes(a?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            const bMin = hhmmToMinutes(b?.PlannedStart) ?? Number.MAX_SAFE_INTEGER;
            return aMin - bMin;
        });

    const readyBlock = notStartedBlocks.find((b) => getEffectiveBlockStatus(b) === "ready_to_start");
    if (readyBlock) return readyBlock;

    const overdueBlock = notStartedBlocks.find((b) => getEffectiveBlockStatus(b) === "overdue");
    if (overdueBlock) return overdueBlock;

    return notStartedBlocks[0] || null;
}