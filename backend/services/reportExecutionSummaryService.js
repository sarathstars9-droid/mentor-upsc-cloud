import { query } from '../db/index.js';
import { getKolkataDateKey, getRelativeKolkataDateKey, APPLICATION_TIMEZONE, normalizeSubjectLabel } from './progressNormalizer.js';

// Status Allowlists
export const TERMINAL_STATUS_ALLOWLIST = ['completed', 'done', 'partial', 'stopped'];
export const ACTIONABLE_STATUS_ALLOWLIST = ['planned', 'ready', 'active', 'paused'];

/**
 * Maximum acceptable rounding difference between two duration sources (seconds).
 * actual_minutes is stored at 1-minute precision; block_log timestamps are to-the-second.
 * Differences up to 60 s are acceptable rounding and do NOT constitute a CONFLICT.
 */
export const DURATION_ROUNDING_TOLERANCE_SECONDS = 60;

/**
 * Resolves the recorded study duration (in seconds) for a single block based on precedence rules.
 * 
 * Precedence:
 * 1. Persisted terminal actual_minutes * 60 (if > 0)
 * 2. Valid terminal block log duration
 * 3. Validated lifecycle start/end duration minus pauses (subject to guards)
 * 4. Accepted self-reported duration
 * 5. Otherwise 0
 * 
 * Returns { seconds: number, source: string, qualityIssues: Array }
 */
export function resolveBlockRecordedDuration(block, logs = [], events = []) {
  const issues = [];
  
  const dayKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!block.day_key || !dayKeyPattern.test(block.day_key)) {
    issues.push({ code: 'MALFORMED_DAY_KEY', blockId: block.id });
    return { seconds: 0, source: 'NONE', issues };
  }

  const startMs = block.started_at ? new Date(block.started_at).getTime() : NaN;
  const endMs = block.ended_at ? new Date(block.ended_at).getTime() : NaN;
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
    issues.push({ code: 'INVALID_LIFECYCLE_TIMESTAMPS', blockId: block.id });
    return { seconds: 0, source: 'NONE', issues };
  }

  const isTerminal = TERMINAL_STATUS_ALLOWLIST.includes(block.status);
  
  if (!isTerminal) {
    // Non-terminal blocks have 0 study duration by default, unless they have active/paused reliable work.
    if (['active', 'paused'].includes(block.status)) {
      if (Number.isFinite(startMs)) {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        const pauseSec = Number(block.total_pause_seconds) || 0;
        const net = Math.max(0, elapsed - pauseSec);
        if (net > 0 && net <= 21600) {
          return { seconds: net, source: 'ACTIVE_LIFECYCLE', issues };
        }
      }
    }
    return { seconds: 0, source: 'NONE', issues };
  }

  // Rule 1: Persisted terminal actual_minutes
  const actualMins = Number(block.actual_minutes);
  if (actualMins > 0) {
    // Cross-evidence conflict check: compare against any log timestamps before accepting actual_minutes.
    // actual_minutes is stored at 1-minute precision; differences up to DURATION_ROUNDING_TOLERANCE_SECONDS are acceptable.
    const blockLogsForConflict = logs.filter(l => l.block_id === block.id);
    const conflictLog = blockLogsForConflict.find(l => {
      const ls = l.started_at ? new Date(l.started_at).getTime() : NaN;
      const le = l.ended_at ? new Date(l.ended_at).getTime() : NaN;
      if (!Number.isFinite(ls) || !Number.isFinite(le) || le <= ls) return false;
      const elapsed = Math.floor((le - ls) / 1000);
      const pauseSec = Number(l.total_pause_seconds) || 0;
      const net = Math.max(0, elapsed - pauseSec);
      return net <= 21600 && Math.abs(net - actualMins * 60) > DURATION_ROUNDING_TOLERANCE_SECONDS;
    });
    if (conflictLog) {
      const ls = new Date(conflictLog.started_at).getTime();
      const le = new Date(conflictLog.ended_at).getTime();
      const net = Math.max(0, Math.floor((le - ls) / 1000) - (Number(conflictLog.total_pause_seconds) || 0));
      issues.push({ code: 'DURATION_CONFLICT', blockId: block.id, actualMinutes: actualMins, logNetSeconds: net });
    }
    // actual_minutes is authoritative regardless of conflict flag
    return { seconds: actualMins * 60, source: 'TERMINAL_ACTUAL_MINUTES', issues };
  }

  // Rule 2: Valid terminal block log duration
  const blockLogs = logs.filter(l => l.block_id === block.id);
  const validLog = blockLogs.find(l => {
    return l.completion_status === block.status || (block.status === 'stopped' && l.completion_status === 'partial');
  });

  if (validLog) {
    if (validLog.actual_minutes > 0) {
      return { seconds: validLog.actual_minutes * 60, source: 'BLOCK_LOG_MINUTES', issues };
    }
    const logStart = validLog.started_at ? new Date(validLog.started_at).getTime() : NaN;
    const logEnd = validLog.ended_at ? new Date(validLog.ended_at).getTime() : NaN;
    if (Number.isFinite(logStart) && Number.isFinite(logEnd) && logEnd > logStart) {
      const elapsed = Math.floor((logEnd - logStart) / 1000);
      const pauseSec = Number(validLog.total_pause_seconds) || 0;
      const net = Math.max(0, elapsed - pauseSec);
      if (net <= 21600) {
        return { seconds: net, source: 'BLOCK_LOG_TIMESTAMPS', issues };
      }
    }
  }

  // Rule 3: Validated lifecycle start/end duration
  if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
    if (endMs <= startMs) {
      issues.push({ code: 'INVALID_LIFECYCLE_TIMESTAMPS', blockId: block.id });
    } else {
      const elapsed = Math.floor((endMs - startMs) / 1000);
      const pauseSec = Number(block.total_pause_seconds) || 0;
      if (pauseSec < 0 || pauseSec >= elapsed) {
        issues.push({ code: 'INVALID_PAUSE_DURATION', blockId: block.id });
      } else {
        const net = elapsed - pauseSec;
        if (net > 21600) {
          issues.push({ code: 'MAX_SESSION_EXCEEDED', blockId: block.id });
        } else {
          return { seconds: net, source: 'LIFECYCLE_TIMESTAMPS', issues };
        }
      }
    }
  }

  // Rule 4: Accepted self-reported duration from study events
  const blockEvents = events.filter(e => e.block_id === block.id || (e.metadata_json && e.metadata_json.blockId === block.block_id));
  const selfReportEvent = blockEvents.find(e => e.event_type === 'BLOCK_COMPLETED' || e.event_type === 'BLOCK_STOPPED');
  if (selfReportEvent && selfReportEvent.metadata_json && selfReportEvent.metadata_json.actualMinutes > 0) {
    return { seconds: selfReportEvent.metadata_json.actualMinutes * 60, source: 'SELF_REPORT_EVENT', issues };
  }

  // Fallback 5: Otherwise zero with issues if appropriate
  if (actualMins === 0 && (Number.isFinite(startMs) || Number.isFinite(endMs))) {
    issues.push({ code: 'MISSING_EVIDENCE', blockId: block.id });
  }
  return { seconds: 0, source: 'NONE', issues };
}

/**
 * Aggregates canonical summary for a single day.
 */
export function aggregateDailySummary({ dayKey, blocks = [], logs = [], events = [], revisionItemsCount = 0 }) {
  let totalRecordedSeconds = 0;
  let completedBlockCount = 0;
  let partialBlockCount = 0;
  let missedBlockCount = 0;
  let pendingBlockCount = 0;
  
  let dataQuality = 'OK';
  const dataQualityIssues = [];

  const subjectMap = {};

  for (const block of blocks) {
    const { seconds: recordedSeconds, source, issues } = resolveBlockRecordedDuration(block, logs, events);
    dataQualityIssues.push(...issues);

    // Detect conflict scenarios
    const blockLogs = logs.filter(l => l.block_id === block.id);
    const hasLogConflict = blockLogs.some(l => {
      // Status discrepancy
      if (block.status === 'completed' && l.completion_status !== 'completed') return true;
      if (block.status === 'partial' && l.completion_status !== 'partial') return true;
      return false;
    });
    if (hasLogConflict) {
      dataQualityIssues.push({ code: 'LOG_STATUS_CONFLICT', blockId: block.id });
    }

    const plannedSeconds = (Number(block.planned_minutes) || 0) * 60;

    // No production writers exist for isRescheduled or isCancelled, so we treat 
    // any 'missed' or 'skipped' status as unexplained.

    // Stopped/Completed/Partial resolution
    let isCompleted = false;
    let isPartial = false;
    let isMissed = false;
    let isPending = false;

    if (block.status === 'completed' || block.status === 'done') {
      isCompleted = true;
    } else if (block.status === 'stopped') {
      if (recordedSeconds >= plannedSeconds && plannedSeconds > 0) {
        isCompleted = true;
      } else if (recordedSeconds > 0) {
        isPartial = true;
      } else {
        // stopped with zero reliable evidence — retain as pending, not missed
        // only authoritative status 'missed'/'skipped' counts as missed
        isPending = true;
        dataQualityIssues.push({ code: 'STOPPED_DURATION_UNCONFIRMED', blockId: block.id });
      }
    } else if (block.status === 'partial') {
      isPartial = true;
    } else if (['missed', 'skipped'].includes(block.status)) {
      isMissed = true;
    } else if (ACTIONABLE_STATUS_ALLOWLIST.includes(block.status)) {
      isPending = true;
    }

    // Pending remaining calculation
    let pendingSeconds = 0;
    if (isPending) {
      pendingSeconds = Math.max(0, plannedSeconds - recordedSeconds);
    } else if (isPartial) {
      pendingSeconds = Math.max(0, plannedSeconds - recordedSeconds);
    } else if (isMissed) {
      pendingSeconds = plannedSeconds; // Carry forward full planned duration
      dataQualityIssues.push({ code: 'UNEXPLAINED_MISSED_BLOCK', blockId: block.id });
    }

    if (isCompleted) completedBlockCount++;
    else if (isPartial) partialBlockCount++;
    else if (isMissed) missedBlockCount++;
    else if (isPending) pendingBlockCount++;

    totalRecordedSeconds += recordedSeconds;

    const subName = normalizeSubjectLabel(block.subject || block.subject_id);
    if (!subjectMap[subName]) {
      subjectMap[subName] = {
        subject: subName,
        plannedSeconds: 0,
        recordedSeconds: 0,
        pendingSeconds: 0,
        completedBlockCount: 0,
        partialBlockCount: 0,
        missedBlockCount: 0
      };
    }

    subjectMap[subName].plannedSeconds += plannedSeconds;
    subjectMap[subName].recordedSeconds += recordedSeconds;
    subjectMap[subName].pendingSeconds += pendingSeconds;
    if (isCompleted) subjectMap[subName].completedBlockCount++;
    else if (isPartial) subjectMap[subName].partialBlockCount++;
    else if (isMissed) subjectMap[subName].missedBlockCount++;
  }

  // Resolve overall day dataQuality based on accumulated issues
  const hasConflicts = dataQualityIssues.some(issue => 
    ['INVALID_LIFECYCLE_TIMESTAMPS', 'INVALID_PAUSE_DURATION', 'LOG_STATUS_CONFLICT', 'DURATION_CONFLICT'].includes(issue.code)
  );
  const hasPartials = dataQualityIssues.some(issue => 
    ['MISSING_EVIDENCE', 'UNEXPLAINED_MISSED_BLOCK', 'STOPPED_DURATION_UNCONFIRMED'].includes(issue.code)
  );

  if (hasConflicts) {
    dataQuality = 'CONFLICT';
  } else if (hasPartials) {
    dataQuality = 'PARTIAL';
  }

  const subjects = Object.values(subjectMap).sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    dayKey,
    totalRecordedSeconds,
    dataQuality,
    dataQualityIssues,
    subjects,
    completedBlockCount,
    partialBlockCount,
    missedBlockCount,
    pendingBlockCount,
    revisionsDue: revisionItemsCount
  };
}

/**
 * Aggregates study info over a complete weekly period.
 */
export async function getWeeklyExecutionSummary({ userId, startDayKey, endDayKey, queryFn = query }) {
  const blocksRes = await queryFn(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3`,
    [userId, startDayKey, endDayKey]
  );
  
  const blockIds = blocksRes.rows.map(b => b.id).filter(Boolean);
  let logs = [];
  let events = [];
  if (blockIds.length > 0) {
    const logsRes = await queryFn(`SELECT * FROM public.block_logs WHERE block_id = ANY($1::uuid[])`, [blockIds]);
    logs = logsRes.rows;
    const eventsRes = await queryFn(`SELECT * FROM public.study_events WHERE block_id = ANY($1::uuid[])`, [blockIds]);
    events = eventsRes.rows;
  }

  const daysMap = new Set();
  // Fill all date keys between start and end
  let curr = new Date(startDayKey);
  const end = new Date(endDayKey);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    daysMap.add(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }

  let activeDaysCount = 0;
  let totalRecordedSeconds = 0;
  let totalPlannedSeconds = 0;
  let completedBlockCount = 0;
  let partialBlockCount = 0;
  let missedBlockCount = 0;
  let pendingBlockCount = 0;
  let pendingSeconds = 0;
  const subjectMap = {};

  for (const dayKey of daysMap) {
    const dayBlocks = blocksRes.rows.filter(b => b.day_key === dayKey);
    const daySummary = aggregateDailySummary({ dayKey, blocks: dayBlocks, logs, events });
    
    if (daySummary.totalRecordedSeconds > 0) {
      activeDaysCount++;
    }
    totalRecordedSeconds += daySummary.totalRecordedSeconds;
    completedBlockCount += daySummary.completedBlockCount;
    partialBlockCount += daySummary.partialBlockCount;
    missedBlockCount += daySummary.missedBlockCount;
    pendingBlockCount += daySummary.pendingBlockCount;

    for (const sub of daySummary.subjects) {
      const name = sub.subject;
      if (!subjectMap[name]) {
        subjectMap[name] = {
          subject: name,
          recordedSeconds: 0,
          plannedSeconds: 0,
          pendingSeconds: 0,
          completedBlockCount: 0,
          partialBlockCount: 0,
          missedBlockCount: 0
        };
      }
      subjectMap[name].recordedSeconds += sub.recordedSeconds;
      subjectMap[name].plannedSeconds += sub.plannedSeconds;
      subjectMap[name].pendingSeconds += sub.pendingSeconds;
      subjectMap[name].completedBlockCount += sub.completedBlockCount;
      subjectMap[name].partialBlockCount += sub.partialBlockCount;
      subjectMap[name].missedBlockCount += sub.missedBlockCount;
      
      totalPlannedSeconds += sub.plannedSeconds;
      pendingSeconds += sub.pendingSeconds;
    }
  }

  const revRes = await queryFn(
    `SELECT COUNT(*)::int as count FROM public.revision_items 
     WHERE user_id = $1 AND status = 'pending' AND next_review_at <= NOW()`,
    [userId]
  );
  const revisionsDue = revRes.rows[0]?.count || 0;

  const subjects = Object.values(subjectMap).sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    startDayKey,
    endDayKey,
    activeDaysCount,
    totalRecordedSeconds,
    totalPlannedSeconds,
    pendingSeconds,
    completedBlockCount,
    partialBlockCount,
    missedBlockCount,
    pendingBlockCount,
    subjects,
    revisionsDue
  };
}

/**
 * Builds the Authoritative, Single Validated Monthly Report Dataset.
 */
export async function getCanonicalMonthlyReportDataset({ userId, monthKey, queryFn = query }) {
  const startDayKey = `${monthKey}-01`;
  const [yyyy, mm] = monthKey.split('-').map(Number);
  const lastDay = new Date(yyyy, mm, 0).getDate();
  const endDayKey = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

  const blocksRes = await queryFn(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3`,
    [userId, startDayKey, endDayKey]
  );

  const blockIds = blocksRes.rows.map(b => b.id).filter(Boolean);
  let logs = [];
  let events = [];
  if (blockIds.length > 0) {
    const logsRes = await queryFn(`SELECT * FROM public.block_logs WHERE block_id = ANY($1::uuid[])`, [blockIds]);
    logs = logsRes.rows;
    const eventsRes = await queryFn(`SELECT * FROM public.study_events WHERE block_id = ANY($1::uuid[])`, [blockIds]);
    events = eventsRes.rows;
  }

  // Iterate month days
  const daysMap = new Set();
  for (let d = 1; d <= lastDay; d++) {
    daysMap.add(`${monthKey}-${String(d).padStart(2, '0')}`);
  }

  let activeDaysCount = 0;
  let totalRecordedSeconds = 0;
  let totalPlannedSeconds = 0;
  let completedBlockCount = 0;
  let partialBlockCount = 0;
  let missedBlockCount = 0;
  let pendingBlockCount = 0;
  let pendingSeconds = 0;
  const subjectMap = {};

  for (const dayKey of daysMap) {
    const dayBlocks = blocksRes.rows.filter(b => b.day_key === dayKey);
    const daySummary = aggregateDailySummary({ dayKey, blocks: dayBlocks, logs, events });

    if (daySummary.totalRecordedSeconds > 0) {
      activeDaysCount++;
    }
    totalRecordedSeconds += daySummary.totalRecordedSeconds;
    completedBlockCount += daySummary.completedBlockCount;
    partialBlockCount += daySummary.partialBlockCount;
    missedBlockCount += daySummary.missedBlockCount;
    pendingBlockCount += daySummary.pendingBlockCount;

    for (const sub of daySummary.subjects) {
      const name = sub.subject;
      if (!subjectMap[name]) {
        subjectMap[name] = {
          subject: name,
          recordedSeconds: 0,
          plannedSeconds: 0,
          pendingSeconds: 0,
          completedBlockCount: 0,
          partialBlockCount: 0
        };
      }
      subjectMap[name].recordedSeconds += sub.recordedSeconds;
      subjectMap[name].plannedSeconds += sub.plannedSeconds;
      subjectMap[name].pendingSeconds += sub.pendingSeconds;
      subjectMap[name].completedBlockCount += sub.completedBlockCount;
      subjectMap[name].partialBlockCount += sub.partialBlockCount;

      totalPlannedSeconds += sub.plannedSeconds;
      pendingSeconds += sub.pendingSeconds;
    }
  }

  const subjects = Object.values(subjectMap).sort((a, b) => a.subject.localeCompare(b.subject));

  // Perform Reconciliation Check
  const sumSubjectSeconds = subjects.reduce((sum, s) => sum + s.recordedSeconds, 0);
  if (sumSubjectSeconds !== totalRecordedSeconds) {
    console.error(`[Reconciliation Error] Monthly recorded seconds (${totalRecordedSeconds}) does not match sum of subject execution seconds (${sumSubjectSeconds})`);
    throw new Error("MONTHLY_RECONCILIATION_FAILED");
  }

  // Get cumulative/all-time mission progress (Mission to date)
  // Compute weekly mission target from top-level targets only (sub_area IS NULL)
  const targetRes = await queryFn(
    `SELECT SUM(target_hours) as total_target, MIN(mission_start_date) as start_date, MAX(mission_end_date) as end_date 
     FROM public.subject_targets WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  const totalMissionHours = Number(targetRes.rows[0]?.total_target || 3500);

  // Fetch all-time blocks to compute cumulative hours
  const allBlocksRes = await queryFn(
    `SELECT * FROM public.study_blocks WHERE user_id = $1`,
    [userId]
  );
  const allBlockIds = allBlocksRes.rows.map(b => b.id).filter(Boolean);
  let allLogs = [];
  let allEvents = [];
  if (allBlockIds.length > 0) {
    const logsRes = await queryFn(`SELECT * FROM public.block_logs WHERE block_id = ANY($1::uuid[])`, [allBlockIds]);
    allLogs = logsRes.rows;
    const eventsRes = await queryFn(`SELECT * FROM public.study_events WHERE block_id = ANY($1::uuid[])`, [allBlockIds]);
    allEvents = eventsRes.rows;
  }

  // Calculate cumulative subject completed hours
  const cumulativeSubjectMap = {};
  for (const block of allBlocksRes.rows) {
    const subName = normalizeSubjectLabel(block.subject || block.subject_id);
    const { seconds } = resolveBlockRecordedDuration(block, allLogs, allEvents);
    cumulativeSubjectMap[subName] = (cumulativeSubjectMap[subName] || 0) + seconds;
  }

  // Fetch all seeded subjects/targets
  const targetsAllRes = await queryFn(
    `SELECT * FROM public.subject_targets WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  
  const missionSubjects = targetsAllRes.rows.map(t => {
    const subName = normalizeSubjectLabel(t.subject);
    const completedSeconds = cumulativeSubjectMap[subName] || 0;
    const completedHours = completedSeconds / 3600.0;
    const targetHours = Number(t.target_hours) || 0;
    const remainingHours = Math.max(0, targetHours - completedHours);
    const progressPercent = targetHours > 0 ? (completedHours / targetHours) * 100 : 0;
    return {
      subject: t.subject,
      completedHours: Number(completedHours.toFixed(1)),
      targetHours,
      remainingHours: Number(remainingHours.toFixed(1)),
      progressPercent: Number(progressPercent.toFixed(1))
    };
  });

  const cumulativeCompletedHours = missionSubjects.reduce((sum, s) => sum + s.completedHours, 0);
  const remainingHours = Math.max(0, totalMissionHours - cumulativeCompletedHours);
  const overallProgressPercent = totalMissionHours > 0 ? (cumulativeCompletedHours / totalMissionHours) * 100 : 0;

  // Weak areas detection from missed blocks this month
  const weakAreasList = subjects
    .filter(s => s.missedBlockCount > 0)
    .sort((a, b) => b.missedBlockCount - a.missedBlockCount)
    .slice(0, 3)
    .map(s => s.subject);

  return {
    monthKey,
    thisMonth: {
      recordedSeconds: totalRecordedSeconds,
      plannedSeconds: totalPlannedSeconds,
      activeDaysCount,
      completedBlockCount,
      partialBlockCount,
      missedBlockCount,
      pendingSeconds,
      subjects
    },
    missionToDate: {
      cumulativeCompletedHours: Number(cumulativeCompletedHours.toFixed(1)),
      remainingHours: Number(remainingHours.toFixed(1)),
      overallProgressPercent: Number(overallProgressPercent.toFixed(1)),
      subjects: missionSubjects
    },
    weakAreas: weakAreasList,
    revisionsDueCount: 0 // Will be resolved dynamically
  };
}
