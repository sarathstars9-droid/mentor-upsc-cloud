export const APPLICATION_TIMEZONE = 'Asia/Kolkata';

// SAFETY CONFIGURATION CONSTANTS
// Genuine terminal execution statuses proven by lifecycle code
export const EXECUTED_STATUS_ALLOWLIST = ['completed', 'partial', 'stopped'];
export const ACTIONABLE_STATUS_ALLOWLIST = ['planned', 'active', 'paused'];

/**
 * Deterministically retrieves date parts for a date in the 'Asia/Kolkata' timezone.
 *
 * @param {Date} date
 * @returns {Object} { year, month, day, hour, minute, second }
 */
export function getKolkataDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APPLICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return partMap;
}

/**
 * Deterministically returns the YYYY-MM-DD key for a date in 'Asia/Kolkata' timezone.
 *
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export function getKolkataDateKey(date = new Date()) {
  const parts = getKolkataDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Returns a YYYY-MM-DD key relative to a base date with an offset in days, in 'Asia/Kolkata' timezone.
 *
 * @param {Date} date
 * @param {number} daysOffset
 * @returns {string} YYYY-MM-DD
 */
export function getRelativeKolkataDateKey(date = new Date(), daysOffset = 0) {
  const targetDate = new Date(date.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return getKolkataDateKey(targetDate);
}

/**
 * Formats duration in seconds to "Xh YYm" or "XXm", flooring to the nearest minute.
 *
 * @param {number} totalSeconds
 * @returns {string} Formatted duration
 */
export function formatDurationSeconds(totalSeconds) {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0m';
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes === 0) {
    return '0m';
  }
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) {
    return `${mins}m`;
  }
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Normalizes a study block record against available evidence to determine execution source and data quality.
 * This is a pure function: no DB queries, no network calls, and no side effects.
 *
 * @param {Object} block - The raw study_blocks database record.
 * @param {Array<Object>} logs - Block log records from block_logs (defaults to []).
 * @param {Array<Object>} events - Study event logs from study_events (defaults to []).
 * @param {number} [maxSessionDurationSeconds] - Optional maximum session duration limit.
 * @returns {Object}
 */
export function normalizeStudyBlock(block, logs = [], events = [], maxSessionDurationSeconds = undefined) {
  const blockId = block?.id || null;
  const plannedSeconds = (Number(block?.planned_minutes) || 0) * 60;

  const result = {
    blockId,
    executionSource: 'NONE',
    dataQuality: 'VALID',
    plannedSeconds,
    verifiedTimerSeconds: 0,
    acceptedSelfReportedSeconds: 0,
    excludedSeconds: 0,
    exclusionReason: null,
    evidenceSources: [],
    confidence: 'HIGH'
  };

  if (!block) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.confidence = 'LOW';
    return result;
  }

  // Malformed date check
  const dayKey = block.day_key;
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'MALFORMED_DAY_KEY';
    result.confidence = 'LOW';
    return result;
  }

  const isTerminalExecuted = EXECUTED_STATUS_ALLOWLIST.includes(block.status);
  const isActiveSession = ['active', 'paused'].includes(block.status);

  // Active / paused sessions never contribute to completed study time, even if they have ended_at timestamps.
  if (isActiveSession) {
    result.verifiedTimerSeconds = 0;
    result.acceptedSelfReportedSeconds = 0;
    const hasStartedAt = block.started_at != null;
    const hasEndedAt = block.ended_at != null;

    if (hasStartedAt) {
      result.executionSource = 'TIMER';
    }

    if (!hasEndedAt) {
      result.dataQuality = 'OPEN';
    } else {
      result.dataQuality = 'CORRUPTED';
      result.exclusionReason = 'ACTIVE_PAUSED_WITH_END_TIMESTAMP';
    }
    result.confidence = 'LOW';
    return result;
  }

  // If status is not executable at all (missed, skipped, planned, etc.)
  if (!isTerminalExecuted) {
    result.executionSource = 'NONE';
    result.dataQuality = 'VALID';
    result.confidence = 'HIGH';
    return result;
  }

  const hasStartedAt = block.started_at != null;
  const hasEndedAt = block.ended_at != null;

  // Validate start/end times parsed numbers
  const startMs = hasStartedAt ? new Date(block.started_at).getTime() : NaN;
  const endMs = hasEndedAt ? new Date(block.ended_at).getTime() : NaN;

  if (hasStartedAt && !Number.isFinite(startMs)) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.exclusionReason = 'INVALID_TIMESTAMP';
    result.confidence = 'LOW';
    return result;
  }

  if (hasEndedAt && !Number.isFinite(endMs)) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.exclusionReason = 'INVALID_TIMESTAMP';
    result.confidence = 'LOW';
    return result;
  }

  const isZeroDuration = hasStartedAt && hasEndedAt && startMs === endMs;

  // If it is terminal executed but has no start time or zero duration
  if (!hasStartedAt || isZeroDuration) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'MISSING_TIMER_EVIDENCE';
    result.confidence = 'LOW';
    return result;
  }

  result.executionSource = 'TIMER';

  if (!hasEndedAt) {
    result.dataQuality = 'CORRUPTED';
    result.exclusionReason = 'MISSING_TIMER_EVIDENCE';
    result.confidence = 'LOW';
    return result;
  }

  if (endMs <= startMs) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'END_BEFORE_OR_EQUAL_TO_START';
    result.confidence = 'LOW';
    return result;
  }

  const elapsedSeconds = Math.floor((endMs - startMs) / 1000);

  // Enforce session duration cap only if an approved value is supplied
  if (maxSessionDurationSeconds !== undefined && elapsedSeconds > maxSessionDurationSeconds) {
    result.dataQuality = 'CORRUPTED';
    result.exclusionReason = 'UNREASONABLE_SESSION_DURATION';
    result.confidence = 'LOW';
    return result;
  }

  const totalPauseSeconds = Number(block.total_pause_seconds) || 0;

  if (totalPauseSeconds < 0) {
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'NEGATIVE_PAUSE_DURATION';
    result.confidence = 'LOW';
    return result;
  }

  if (totalPauseSeconds >= elapsedSeconds) {
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'PAUSE_EXCEEDS_ELAPSED_DURATION';
    result.confidence = 'LOW';
    return result;
  }

  const blockGrossSeconds = elapsedSeconds;
  const blockNetSeconds = elapsedSeconds - totalPauseSeconds;

  // Validate block log records
  let isLogsContradictory = false;
  const uniqueLogs = [];
  const logMap = new Set();

  const TOLERANCE_MS = 60 * 1000; // 60 seconds timestamp window tolerance
  const DURATION_TOLERANCE_SECONDS = 5 * 60; // 5 minutes matching tolerance

  for (const log of logs) {
    const logStartMs = log.started_at ? new Date(log.started_at).getTime() : NaN;
    const logEndMs = log.ended_at ? new Date(log.ended_at).getTime() : NaN;

    if (!Number.isFinite(logStartMs) || !Number.isFinite(logEndMs) || logEndMs <= logStartMs) {
      isLogsContradictory = true;
      break;
    }

    const logDurationSeconds = (logEndMs - logStartMs) / 1000;
    const logGrossSeconds = logDurationSeconds;

    // Deduplicate identical duplicate logs
    const logKey = `${logStartMs}_${logEndMs}_${log.completion_status}_${log.actual_minutes}`;
    if (logMap.has(logKey)) {
      continue;
    }
    logMap.add(logKey);

    // 1. Status consistency check
    if (log.completion_status !== block.status) {
      isLogsContradictory = true;
      break;
    }

    // 2. Interval consistency check
    if (logStartMs < startMs - TOLERANCE_MS || logEndMs > endMs + TOLERANCE_MS) {
      isLogsContradictory = true;
      break;
    }

    // A. logGrossSeconds must approximately match blockGrossSeconds.
    if (Math.abs(logGrossSeconds - blockGrossSeconds) > DURATION_TOLERANCE_SECONDS) {
      isLogsContradictory = true;
      break;
    }

    // B. When log.actual_minutes is positive:
    // log.actual_minutes * 60 must approximately match blockNetSeconds.
    if (log.actual_minutes > 0) {
      const logNetMinutesSeconds = log.actual_minutes * 60;
      if (Math.abs(logNetMinutesSeconds - blockNetSeconds) > DURATION_TOLERANCE_SECONDS) {
        isLogsContradictory = true;
        break;
      }
    }

    uniqueLogs.push({ logStartMs, logEndMs, ...log });
  }

  if (!isLogsContradictory && uniqueLogs.length > 1) {
    const sortedLogs = [...uniqueLogs].sort((a, b) => a.logStartMs - b.logStartMs);
    for (let i = 1; i < sortedLogs.length; i++) {
      if (sortedLogs[i].logStartMs < sortedLogs[i - 1].logEndMs) {
        isLogsContradictory = true;
        break;
      }
    }
  }

  if (isLogsContradictory) {
    result.executionSource = 'UNKNOWN';
    result.dataQuality = 'CORRUPTED';
    result.excludedSeconds = (Number(block.actual_minutes) || 0) * 60;
    result.exclusionReason = 'CONTRADICTORY_LOGS';
    result.confidence = 'LOW';
    return result;
  }

  // April Legacy Recoverable Blocks (actual_minutes is missing or 0, but valid timer execution exists)
  const actualMinutes = Number(block.actual_minutes);
  if (isNaN(actualMinutes) || actualMinutes === 0) {
    result.dataQuality = 'RECOVERABLE';
    result.verifiedTimerSeconds = blockNetSeconds;
    result.confidence = 'MEDIUM';
    result.evidenceSources.push('TIMESTAMPS_RECOVERY');
  } else {
    result.dataQuality = 'VALID';
    result.verifiedTimerSeconds = blockNetSeconds;
    result.evidenceSources.push('TIMER_TIMESTAMPS');

    // Check corroboration from block logs/events
    const hasLogMatch = uniqueLogs.some(l => l.completion_status === block.status);
    const hasEventMatch = events.some(e => e.event_type === 'BLOCK_COMPLETED');

    if (hasLogMatch || hasEventMatch) {
      result.confidence = 'HIGH';
      if (hasLogMatch) result.evidenceSources.push('BLOCK_LOGS');
      if (hasEventMatch) result.evidenceSources.push('STUDY_EVENTS');
    } else {
      result.confidence = 'MEDIUM';
    }
  }

  return result;
}

/**
 * Aggregates canonical read-only progress from study blocks, logs, and events in integer seconds.
 *
 * @param {Array<Object>} blocks
 * @param {Array<Object>} logs
 * @param {Array<Object>} events
 * @param {number} [maxSessionDurationSeconds] - Optional maximum session duration limit.
 * @returns {Object} { verifiedTimerSeconds, acceptedSelfReportedSeconds }
 */
export function aggregateCanonicalProgress(blocks, logs = [], events = [], maxSessionDurationSeconds = undefined) {
  let verifiedTimerSeconds = 0;
  let acceptedSelfReportedSeconds = 0;

  for (const block of blocks) {
    const blockLogs = logs.filter(l => l.block_id === block.id);
    const blockEvents = events.filter(e => e.block_id === block.id);
    const norm = normalizeStudyBlock(block, blockLogs, blockEvents, maxSessionDurationSeconds);
    verifiedTimerSeconds += norm.verifiedTimerSeconds;
    acceptedSelfReportedSeconds += norm.acceptedSelfReportedSeconds;
  }

  return {
    verifiedTimerSeconds,
    acceptedSelfReportedSeconds
  };
}

/**
 * Pure builder that converts raw data into canonical good morning data.
 *
 * @param {Object} params
 * @returns {Object}
 */
export function buildCanonicalGoodMorningData({
  now = new Date(),
  user = {},
  todayBlocks = [],
  yesterdayBlocks = [],
  sevenDayBlocks = [],
  logs = [],
  events = [],
  maxSessionDurationSeconds = undefined,
  planState = null
}) {
  const userName = user?.name || 'User';

  const yesterdayAgg = aggregateCanonicalProgress(yesterdayBlocks, logs, events, maxSessionDurationSeconds);
  const last7DaysAgg = aggregateCanonicalProgress(sevenDayBlocks, logs, events, maxSessionDurationSeconds);

  // Today's blocks status checking actionable allowlist
  const actionableTodayBlocks = todayBlocks.filter(b => ACTIONABLE_STATUS_ALLOWLIST.includes(b?.status));

  const todayBlocksCount = actionableTodayBlocks.length;
  const userPlanBlockCount = planState ? planState.userPlanBlockCount : 0;
  const recoveryBlockCount = planState ? planState.recoveryBlockCount : 0;
  const systemGeneratedBlockCount = planState ? planState.systemGeneratedBlockCount : 0;

  let todayPlannedMinutes = 0;
  for (const b of actionableTodayBlocks) {
    todayPlannedMinutes += Number(b.planned_minutes) || 0;
  }

  // Block classification helpers
  const hasPlanAcceptedEvent = planState?.evidence?.hasPlanAcceptedEvent || false;

  const isRecoveryBlock = (b) => {
    return b.block_type === 'recovery' ||
           (b.block_id && String(b.block_id).startsWith('rec_')) ||
           (b.source_meta && b.source_meta.is_recovery === true);
  };

  const isSystemBlock = (b) => {
    return ['system', 'placeholder', 'suggestion'].includes((b.source_type || '').toLowerCase()) ||
           (b.source_meta && b.source_meta.is_system === true);
  };

  const isUserBlock = (b) => {
    if (isRecoveryBlock(b) || isSystemBlock(b)) return false;
    return b.source_type === 'uploaded_plan' ||
           b.source_type === 'user_uploaded' ||
           (b.source_type === 'ocr' && hasPlanAcceptedEvent);
  };

  let immediateAction = "Upload one study block and begin it.";
  let candidateBlocks = [];

  if (planState) {
    if (planState.state === 'USER_PLAN_PRESENT') {
      candidateBlocks = actionableTodayBlocks.filter(isUserBlock);
    } else if (planState.state === 'RECOVERY_ONLY') {
      candidateBlocks = actionableTodayBlocks.filter(isRecoveryBlock);
    } else if (planState.state === 'SYSTEM_PLAN_ONLY') {
      candidateBlocks = actionableTodayBlocks.filter(isSystemBlock);
    } else {
      // NO_PLAN or AMBIGUOUS -> no immediate action
      candidateBlocks = [];
    }
  } else {
    candidateBlocks = actionableTodayBlocks;
  }

  if (candidateBlocks.length > 0) {
    // Priority order: active -> paused -> planned
    const activeBlocks = candidateBlocks.filter(b => b.status === 'active');
    const pausedBlocks = candidateBlocks.filter(b => b.status === 'paused');
    const plannedBlocks = candidateBlocks.filter(b => b.status === 'planned');

    let selectedBlock = null;

    const sortByStart = (list) => {
      return [...list].sort((a, b) => {
        const startA = a.planned_start || '';
        const startB = b.planned_start || '';
        return startA.localeCompare(startB);
      });
    };

    if (activeBlocks.length > 0) {
      selectedBlock = sortByStart(activeBlocks)[0];
    } else if (pausedBlocks.length > 0) {
      selectedBlock = sortByStart(pausedBlocks)[0];
    } else if (plannedBlocks.length > 0) {
      selectedBlock = sortByStart(plannedBlocks)[0];
    }

    if (selectedBlock) {
      const subLabel = selectedBlock.subject || selectedBlock.subject_id || "Block";
      if (selectedBlock.status === 'active') {
        immediateAction = `Continue your active block (${subLabel}) now.`;
      } else if (selectedBlock.status === 'paused') {
        immediateAction = `Resume your paused block (${subLabel}) now.`;
      } else {
        const startStr = selectedBlock.planned_start || "09:00";
        immediateAction = `Start your first planned block (${subLabel}) at ${startStr}.`;
      }
    }
  }

  return {
    userName,
    yesterdayVerifiedSeconds: yesterdayAgg.verifiedTimerSeconds,
    yesterdayAcceptedSelfReportedSeconds: yesterdayAgg.acceptedSelfReportedSeconds,
    last7DaysVerifiedSeconds: last7DaysAgg.verifiedTimerSeconds,
    last7DaysAcceptedSelfReportedSeconds: last7DaysAgg.acceptedSelfReportedSeconds,
    todayBlocksCount,
    userPlanBlockCount,
    recoveryBlockCount,
    systemGeneratedBlockCount,
    todayPlannedMinutes,
    realisticMinimumMinutes: null, // Omitted in Phase 1
    immediateAction,
    planState
  };
}
