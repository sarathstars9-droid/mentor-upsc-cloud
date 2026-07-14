/**
 * canonicalTimerClassification.js
 * 
 * General future-proof canonical timer classifier.
 */

function isOverlap(startA, endA, startB, endB) {
  // Half-open interval: startA < endB AND endA > startB
  return startA < endB && endA > startB;
}

const ALLOWED_LIFECYCLE_STATUSES = ['completed', 'partial', 'stopped', 'active', 'paused', 'missed', 'skipped'];
const ALLOWED_COMPLETION_QUALITIES = ['completed', 'partial', 'stopped', 'missed', 'skipped'];

function checkStatusCompatibility(lifecycle, completion) {
  if (lifecycle === 'completed' && completion === 'completed') return true;
  if (lifecycle === 'partial' && completion === 'partial') return true;
  if (lifecycle === 'stopped' && completion === 'partial') return true;
  if (lifecycle === 'stopped' && completion === 'stopped') return true;
  return false;
}

function parseTimestamp(ts) {
  if (ts === null || ts === undefined || ts === '') {
    return { ms: NaN, error: 'MISSING_TIMESTAMP' };
  }
  
  if (typeof ts === 'number') {
    return { ms: ts, error: null };
  }

  const str = String(ts);
  // Check for absolute ISO string: must contain 'Z' or explicit offset like '+05:30' or '-0400'
  const hasZ = str.toUpperCase().includes('Z');
  const hasOffset = /[+-]\d{2}:?\d{2}$/.test(str);
  
  if (!hasZ && !hasOffset) {
    return { ms: NaN, error: 'AMBIGUOUS_TIMESTAMP' };
  }

  const ms = new Date(str).getTime();
  if (!Number.isFinite(ms)) {
    return { ms: NaN, error: 'INVALID_TIMESTAMP' };
  }

  return { ms, error: null };
}

export function classifyTimerExecutions({ block, logs = [], nextBlocks = [], durationToleranceSeconds = 60 }) {
  const executions = [];
  const blockStatus = block.status || 'unknown';

  // 1. Terminal executions from logs
  let terminalExecutions = [];

  if (logs && logs.length > 0) {
    const logMap = new Map();
    for (const log of logs) {
      // Deduplicate identical logs. If timestamps are ambiguous, they still get a key.
      const key = `${log.started_at}_${log.ended_at}_${log.completion_status}_${log.actual_minutes}_${log.pause_seconds}`;
      if (!logMap.has(key)) {
        logMap.set(key, { ...log, source: 'log' });
      }
    }
    terminalExecutions = Array.from(logMap.values());
  } else if (['completed', 'partial', 'stopped', 'missed', 'skipped'].includes(blockStatus)) {
    // Missing logs fallback
    terminalExecutions.push({
      completion_status: blockStatus,
      actual_minutes: block.actual_minutes,
      source: 'block_fallback',
      started_at: block.started_at,
      ended_at: block.ended_at
    });
  }

  // Pre-parse timestamps
  for (const exec of terminalExecutions) {
    if (exec.started_at === undefined || exec.started_at === null || exec.started_at === '') {
      exec.startParsed = { ms: NaN, error: 'MISSING_START_TIMESTAMP' };
    } else {
      exec.startParsed = parseTimestamp(exec.started_at);
      if (exec.startParsed.error === 'MISSING_TIMESTAMP') exec.startParsed.error = 'MISSING_START_TIMESTAMP';
    }

    if (exec.ended_at === undefined || exec.ended_at === null || exec.ended_at === '') {
      exec.endParsed = { ms: NaN, error: 'MISSING_END_TIMESTAMP' };
    } else {
      exec.endParsed = parseTimestamp(exec.ended_at);
      if (exec.endParsed.error === 'MISSING_TIMESTAMP') exec.endParsed.error = 'MISSING_END_TIMESTAMP';
    }
  }

  // Detect overlapping contradictory logs per execution
  for (let i = 0; i < terminalExecutions.length; i++) {
    terminalExecutions[i].overlapsOtherLog = false;
  }
  
  for (let i = 0; i < terminalExecutions.length; i++) {
    for (let j = i + 1; j < terminalExecutions.length; j++) {
      const msStartA = terminalExecutions[i].startParsed.ms;
      const msEndA = terminalExecutions[i].endParsed.ms;
      const msStartB = terminalExecutions[j].startParsed.ms;
      const msEndB = terminalExecutions[j].endParsed.ms;

      if (Number.isFinite(msStartA) && Number.isFinite(msEndA) && Number.isFinite(msStartB) && Number.isFinite(msEndB)) {
        if (isOverlap(msStartA, msEndA, msStartB, msEndB)) {
          terminalExecutions[i].overlapsOtherLog = true;
          terminalExecutions[j].overlapsOtherLog = true;
        }
      }
    }
  }

  for (const exec of terminalExecutions) {
    const startMs = exec.startParsed.ms;
    const endMs = exec.endParsed.ms;

    // Identity
    const executionId = exec.id || `exec_${exec.started_at}_${exec.ended_at}`;
    const blockUuid = block.id;
    const externalBlockId = block.block_id || null;
    const blockLogId = exec.id || null;
    
    // Historical logs get evaluated with their own completion status when block is active/paused
    let lifecycleForCompat = blockStatus;
    if (['active', 'paused'].includes(blockStatus) && exec.source === 'log') {
       lifecycleForCompat = exec.completion_status;
    }

    const classification = {
      executionId,
      blockUuid,
      externalBlockId,
      blockLogId,
      lifecycleStatus: lifecycleForCompat,
      completionQuality: exec.completion_status,
      startedAt: exec.started_at || null,
      endedAt: exec.ended_at || null,
      grossElapsedSeconds: 0,
      pauseSeconds: 0,
      recordedNetSeconds: 0,
      verifiedTimerSeconds: 0,
      confirmationRequiredSeconds: 0,
      excludedTimerSeconds: 0,
      classification: 'excluded',
      anomalyReasons: [],
      dataQuality: 'VALID',
      confidence: 'HIGH',
      systemExplanation: ''
    };

    if (exec.startParsed.error) classification.anomalyReasons.push(exec.startParsed.error);
    if (exec.endParsed.error) classification.anomalyReasons.push(exec.endParsed.error);

    if (classification.anomalyReasons.length > 0) {
      classification.dataQuality = 'CORRUPTED';
      classification.confidence = 'LOW';
    } else if (endMs <= startMs) {
      classification.anomalyReasons.push(endMs === startMs ? 'ZERO_DURATION' : 'END_BEFORE_START');
      classification.dataQuality = 'CORRUPTED';
      classification.confidence = 'LOW';
    } else {
      const grossSec = Math.floor((endMs - startMs) / 1000);
      classification.grossElapsedSeconds = grossSec;
      
      let rawPause = 0;
      if (exec.source === 'block_fallback') {
        rawPause = Number(block.total_pause_seconds);
      } else {
        rawPause = Number(exec.pause_seconds);
      }

      if (rawPause === undefined || rawPause === null || isNaN(rawPause)) {
        rawPause = 0; 
      }
      
      if (!Number.isFinite(rawPause) || Number.isNaN(rawPause)) {
        classification.anomalyReasons.push('INVALID_PAUSE_DURATION');
        classification.dataQuality = 'CORRUPTED';
        classification.confidence = 'LOW';
      } else if (rawPause < 0) {
        classification.anomalyReasons.push('NEGATIVE_PAUSE_DURATION');
        classification.dataQuality = 'CORRUPTED';
        classification.confidence = 'LOW';
      } else {
        // Deterministic fractional truncation policy: floor positive values to nearest integer
        const explicitPauseSec = Math.floor(rawPause);
        classification.pauseSeconds = explicitPauseSec;

        if (explicitPauseSec > grossSec) {
          classification.anomalyReasons.push('PAUSE_EXCEEDS_ELAPSED');
          classification.dataQuality = 'CORRUPTED';
          classification.confidence = 'LOW';
        } else {
          classification.recordedNetSeconds = grossSec - explicitPauseSec;
          
          // Duration mismatch tolerance allows for async updates/client drift
          if (exec.actual_minutes != null) {
             const actualMinutesSec = Math.floor(Number(exec.actual_minutes) * 60);
             if (Math.abs(classification.recordedNetSeconds - actualMinutesSec) > durationToleranceSeconds) {
                classification.anomalyReasons.push('DURATION_EVIDENCE_MISMATCH');
             }
          }
        }
      }
    }

    if (exec.overlapsOtherLog) {
      classification.anomalyReasons.push('OVERLAPPING_CONTRADICTORY_LOGS');
      classification.dataQuality = 'CORRUPTED';
      classification.confidence = 'LOW';
    }

    if (!ALLOWED_LIFECYCLE_STATUSES.includes(classification.lifecycleStatus)) {
      classification.anomalyReasons.push('UNKNOWN_LIFECYCLE_STATUS');
      classification.dataQuality = 'CORRUPTED';
      classification.confidence = 'LOW';
    }
    
    if (!ALLOWED_COMPLETION_QUALITIES.includes(classification.completionQuality)) {
      classification.anomalyReasons.push('UNKNOWN_COMPLETION_QUALITY');
      classification.dataQuality = 'CORRUPTED';
      classification.confidence = 'LOW';
    }

    if (classification.dataQuality !== 'CORRUPTED' && exec.source !== 'block_corrupted') {
      if (!checkStatusCompatibility(classification.lifecycleStatus, classification.completionQuality)) {
        classification.anomalyReasons.push(`INCOMPATIBLE_STATUS: block=${classification.lifecycleStatus} log=${classification.completionQuality}`);
        classification.dataQuality = 'CORRUPTED';
        classification.confidence = 'LOW';
      }
    }

    if (exec.source === 'block_fallback' && classification.recordedNetSeconds > 0) {
      classification.anomalyReasons.push('MISSING_LOGS');
    }

    let overlapsNext = false;
    if (classification.recordedNetSeconds > 0) {
      for (const nb of nextBlocks) {
        // Ignore planned intervals belonging to the same block
        if ((nb.blockUuid && nb.blockUuid === blockUuid) || (nb.externalBlockId && nb.externalBlockId === externalBlockId)) {
          continue;
        }

        const nbStart = Number(nb.plannedStartMs);
        const nbEnd = Number(nb.plannedEndMs);
        if (Number.isFinite(nbStart) && Number.isFinite(nbEnd) && nbEnd > nbStart) {
          if (isOverlap(startMs, endMs, nbStart, nbEnd)) {
            overlapsNext = true;
            classification.anomalyReasons.push('OVERLAPS_LATER_PLANNED_BLOCK');
            break;
          }
        }
      }
    }

    if (classification.dataQuality === 'CORRUPTED') {
      classification.classification = 'excluded';
      classification.excludedTimerSeconds = classification.recordedNetSeconds;
      classification.systemExplanation = 'Excluded due to invalid timestamps, contradictory evidence, or data corruption.';
    } else if (classification.recordedNetSeconds <= 0) {
      classification.classification = 'excluded';
      classification.excludedTimerSeconds = classification.recordedNetSeconds;
      classification.systemExplanation = 'Excluded due to zero or negative net duration.';
    } else if (classification.anomalyReasons.length > 0) {
      classification.classification = 'confirmation_required';
      classification.confirmationRequiredSeconds = classification.recordedNetSeconds;
      classification.systemExplanation = 'Confirmation required due to mismatching evidence or overlaps.';
    } else {
      classification.classification = 'verified';
      classification.verifiedTimerSeconds = classification.recordedNetSeconds;
      classification.systemExplanation = 'Normal execution. Timer verified automatically.';
    }

    executions.push(classification);
  }

  // 2. Active/Paused execution state
  if (['active', 'paused'].includes(blockStatus)) {
    const classification = {
      executionId: `current_${blockStatus}_${block.id}`,
      blockUuid: block.id,
      externalBlockId: block.block_id || null,
      blockLogId: null,
      lifecycleStatus: blockStatus,
      completionQuality: null,
      startedAt: block.started_at || null,
      endedAt: null,
      grossElapsedSeconds: 0,
      pauseSeconds: 0,
      recordedNetSeconds: 0,
      verifiedTimerSeconds: 0,
      confirmationRequiredSeconds: 0,
      excludedTimerSeconds: 0,
      classification: blockStatus,
      anomalyReasons: [],
      dataQuality: 'VALID',
      confidence: 'HIGH',
      systemExplanation: `Session is currently ${blockStatus}. Excluded from completed time.`
    };
    
    executions.push(classification);
  }

  return executions;
}
