import { useMemo } from 'react';
import { getEffectiveBlockStatus } from '../utils/studyEngine.js';

export function parseBlockTimeIST(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }

  const [year, month, day] = String(dateStr).split("-").map(Number);
  if (!year || !month || !day) return null;

  const pad = (v) => String(v).padStart(2, "0");
  const d = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const pad = (v) => String(v).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatConciseDuration(totalSeconds) {
  if (totalSeconds <= 0) return "0 min";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return `${m} min`;
  return `00:${String(s).padStart(2, '0')}`;
}

export function calculateBlockTiming(block, nowMs) {
    if (!block) return null;

    const status = getEffectiveBlockStatus(block).toLowerCase();

    // Rule: Use the existing engine's true completed statuses only.
    const isCompleted = status === "completed" || status === "done";

    const plannedStart = parseBlockTimeIST(block.Date, block.PlannedStart);
    const plannedEnd = parseBlockTimeIST(block.Date, block.PlannedEnd);

    // Rule: Resolve planned duration without assuming PlannedMinutes always exists
    let plannedDurationSeconds = 0;
    if (typeof block.PlannedMinutes === 'number' && block.PlannedMinutes > 0) {
        plannedDurationSeconds = block.PlannedMinutes * 60;
    } else if (plannedStart && plannedEnd) {
        plannedDurationSeconds = Math.max(0, Math.floor((plannedEnd.getTime() - plannedStart.getTime()) / 1000));
    }

    const actualStart = block.ActualStart ? new Date(block.ActualStart) : null;
    const actualEnd = block.ActualEnd ? new Date(block.ActualEnd) : null;
    const lastResumedAt = block.LastResumeAt ? new Date(block.LastResumeAt) : (actualStart || null);

    // Contract verification: ActualMinutes represents the exact sum of finalized active intervals
    // saved by the backend. It does NOT include the live session currently ticking.
    // If ACTIVE, we calculate the time since LastResumeAt and add it to base.
    let baseAccumulatedSeconds = (block.ActualMinutes || 0) * 60;
    let liveAccumulatedSeconds = baseAccumulatedSeconds;

    if (status === "active" && lastResumedAt && !isCompleted && !actualEnd) {
       const sessionActiveSeconds = Math.max(0, Math.floor((nowMs - lastResumedAt.getTime()) / 1000));
       liveAccumulatedSeconds += sessionActiveSeconds;
    }

    let remainingStudySeconds = 0;
    if (plannedDurationSeconds > 0) {
        remainingStudySeconds = Math.max(0, plannedDurationSeconds - liveAccumulatedSeconds);
    }

    if (isCompleted) {
        remainingStudySeconds = 0;
    }

    let completionPercentage = 0;
    if (isCompleted) {
        completionPercentage = 100;
    } else if (plannedDurationSeconds > 0) {
       completionPercentage = Math.min(100, Math.round((liveAccumulatedSeconds / plannedDurationSeconds) * 100));
    }

    const secondsUntilStart = plannedStart ? Math.floor((plannedStart.getTime() - nowMs) / 1000) : 0;
    const overdueSeconds = plannedStart ? Math.floor((nowMs - plannedStart.getTime()) / 1000) : 0;
    const secondsUntilPlannedEnd = plannedEnd ? Math.floor((plannedEnd.getTime() - nowMs) / 1000) : 0;
    const plannedWindowOverdueSeconds = plannedEnd ? Math.floor((nowMs - plannedEnd.getTime()) / 1000) : 0;
    const startDelaySeconds = (actualStart && plannedStart) ? Math.floor((actualStart.getTime() - plannedStart.getTime()) / 1000) : 0;

    let timingState = "UPCOMING";

    if (isCompleted) {
        timingState = "COMPLETED";
    } else if (plannedDurationSeconds > 0 && remainingStudySeconds <= 0 && actualStart) {
        timingState = "DURATION_REACHED";
    } else if (!actualStart) {
        if (plannedEnd && nowMs > plannedEnd.getTime()) {
            timingState = "MISSED";
        } else if (plannedStart && nowMs >= plannedStart.getTime()) {
            timingState = "OVERDUE_NOT_STARTED";
        } else {
            timingState = "UPCOMING";
        }
    } else {
        if (status === "paused") {
            timingState = "PAUSED";
        } else if (plannedEnd && nowMs > plannedEnd.getTime()) {
            timingState = "OVERDUE_ACTIVE";
        } else {
            timingState = "ACTIVE";
        }
    }

    let displayPrimary = "";
    let displaySecondary = "";
    let badgeText = timingState;
    let severity = "neutral";
    let plannedWindowLabel = "";

    // Generate Planned Window Label
    if (plannedEnd) {
        if (nowMs > plannedEnd.getTime()) {
            plannedWindowLabel = `Planned window ended ${Math.floor(plannedWindowOverdueSeconds / 60)} min ago`;
        } else {
            plannedWindowLabel = `Planned window ends in ${Math.floor(secondsUntilPlannedEnd / 60)} min`;
        }
    }

    switch (timingState) {
        case "UPCOMING":
            badgeText = "NEXT";
            displayPrimary = `Starts in ${formatConciseDuration(secondsUntilStart)}`;
            displaySecondary = `Scheduled for ${block.PlannedStart}`;
            break;
        case "OVERDUE_NOT_STARTED":
            badgeText = "START OVERDUE";
            severity = overdueSeconds > 600 ? "error" : "warning";
            displayPrimary = `${Math.floor(overdueSeconds / 60)} min overdue`;
            displaySecondary = `Scheduled start was ${block.PlannedStart}`;
            break;
        case "ACTIVE":
        case "OVERDUE_ACTIVE":
        case "DURATION_REACHED":
            badgeText = "ACTIVE";
            severity = "active";
            displayPrimary = `${formatConciseDuration(remainingStudySeconds)} study remaining`;
            if (startDelaySeconds > 60) {
                displaySecondary = `Started ${Math.floor(startDelaySeconds / 60)} min late \u00b7 ${Math.floor(liveAccumulatedSeconds / 60)} min completed`;
            } else {
                displaySecondary = `${Math.floor(liveAccumulatedSeconds / 60)} min completed`;
            }
            break;
        case "PAUSED": {
            badgeText = "PAUSED";
            severity = "warning";
            const pausedAt = block.LastPauseAt ? new Date(block.LastPauseAt).getTime() : nowMs;
            const pausedSeconds = Math.max(0, Math.floor((nowMs - pausedAt) / 1000));
            displayPrimary = `Paused for ${formatDuration(pausedSeconds)}`;
            displaySecondary = `${formatConciseDuration(remainingStudySeconds)} study remaining`;
            break;
        }
        case "MISSED":
            badgeText = "BLOCK MISSED";
            severity = "error";
            displayPrimary = `Scheduled window ended ${Math.floor(plannedWindowOverdueSeconds / 60)} min ago`;
            displaySecondary = `${Math.floor(plannedDurationSeconds / 60)} min study still pending`;
            break;
        case "COMPLETED": {
            badgeText = "COMPLETED";
            severity = "success";
            displayPrimary = "Block completed";
            const doneTime = block.ActualEnd ? new Date(block.ActualEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "";
            displaySecondary = `${Math.floor(liveAccumulatedSeconds / 60)} focused minutes${doneTime ? ` \u00b7 Completed at ${doneTime}` : ''}`;
            break;
        }
    }

    return {
      timingState,
      severity,
      badgeText,
      secondsUntilStart,
      startOverdueSeconds: overdueSeconds,
      accumulatedActiveSeconds: liveAccumulatedSeconds,
      remainingStudySeconds,
      pausedSeconds: timingState === "PAUSED" ? Math.max(0, Math.floor((nowMs - (block.LastPauseAt ? new Date(block.LastPauseAt).getTime() : nowMs)) / 1000)) : 0,
      secondsUntilPlannedEnd,
      plannedWindowOverdueSeconds,
      startDelaySeconds,
      completionPercentage,
      displayPrimary,
      displaySecondary,
      plannedWindowLabel
    };
}

export function useBlockTiming(block, nowMs) {
  return useMemo(() => calculateBlockTiming(block, nowMs), [block, nowMs]);
}
