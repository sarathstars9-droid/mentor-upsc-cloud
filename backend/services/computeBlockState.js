// backend/services/computeBlockState.js
// Pure function — no DB calls.
// Receives a raw DB row and returns backend-derived timing values.
// Frontend must render these directly without any local recalculation.

export function computeBlockState(block) {
  if (!block) return null;

  const now = Date.now();
  const startMs  = block.started_at  ? new Date(block.started_at).getTime()  : null;
  const pauseMs  = block.paused_at   ? new Date(block.paused_at).getTime()   : null;
  const endMs    = block.ended_at    ? new Date(block.ended_at).getTime()    : null;
  const totalPauseSec = Number(block.total_pause_seconds || 0);

  let actualSeconds = 0;
  let pauseSeconds  = totalPauseSec;

  if (startMs) {
    switch (block.status) {
      case 'active':
        // Live: elapsed since start minus all accumulated pauses.
        // total_pause_seconds only contains *completed* pauses (each resume folds one in).
        actualSeconds = Math.max(0, Math.floor((now - startMs) / 1000) - totalPauseSec);
        pauseSeconds  = totalPauseSec;
        break;

      case 'paused':
        // Timer frozen at the instant the latest pause began.
        // Current pause duration is NOT yet in total_pause_seconds (it will be on resume).
        if (pauseMs) {
          actualSeconds = Math.max(0, Math.floor((pauseMs - startMs) / 1000) - totalPauseSec);
          // pauseSeconds includes current ongoing pause for display
          pauseSeconds  = totalPauseSec + Math.max(0, Math.floor((now - pauseMs) / 1000));
        }
        break;

      default:
        // completed / partial / missed / skipped
        if (endMs) {
          // total_pause_seconds already includes any pause that was open at completion
          // (the completeBlock handler folds it in before setting ended_at)
          actualSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000) - totalPauseSec);
          pauseSeconds  = totalPauseSec;
        }
    }
  }

  return {
    // Raw DB columns (preserved for consumers that need them)
    ...block,

    proofUrl:                block.proof_url || null,
    proofType:               block.proof_type || null,
    proofUploadedAt:         block.proof_uploaded_at || null,
    proofVerificationStatus: block.proof_verification_status || 'pending',
    proofNotes:              block.proof_notes || null,

    // Derived — backend is truth, frontend renders directly
    actualSeconds,
    actualMinutes:  Math.floor(actualSeconds / 60),
    pauseSeconds,
    pauseMinutes:   Math.floor(pauseSeconds / 60),
    isPaused:       block.status === 'paused',
    isActive:       block.status === 'active',
    isCompleted:    ['completed', 'partial', 'missed', 'skipped'].includes(block.status),
  };
}

// Convert DB snake_case columns to the camelCase shape PlanPage expects so the
// merged response can drop straight into existing frontend rendering logic.
export function toFrontendBlock(dbBlock, gasBlock = {}) {
  const computed = computeBlockState(dbBlock);
  if (!computed) return gasBlock;

  return {
    // ── Schedule fields from GAS / Sheets ───────────────────────────────────
    Title:              gasBlock.Title          || computed.title           || '',
    PlannedSubject:     gasBlock.PlannedSubject || computed.subject         || '',
    PlannedTopic:       gasBlock.PlannedTopic   || computed.topic           || '',
    PlannedStart:       gasBlock.PlannedStart   || computed.planned_start   || '',
    PlannedEnd:         gasBlock.PlannedEnd     || computed.planned_end     || '',
    PlannedMinutes:     gasBlock.PlannedMinutes ?? computed.planned_minutes ?? 0,
    Mode:               gasBlock.Mode           || computed.block_type      || '',
    RawText:            gasBlock.RawText        || computed.raw_text        || '',
    OutputExpected:     gasBlock.OutputExpected || computed.output_expected || '',
    Subtopic:           gasBlock.Subtopic       || computed.subtopic        || '',
    SyllabusNodeId:     gasBlock.SyllabusNodeId ?? computed.node_id ?? '',
    ...gasBlock,

    // ── Lifecycle fields from PostgreSQL (override any GAS values) ──────────
    BlockId:            computed.id || computed.block_id,
    Date:               computed.day_key,
    Status:             computed.status,

    ActualStart:        computed.started_at  || '',
    ActualEnd:          computed.ended_at    || '',
    ActualMinutes:      computed.actualMinutes,
    ActualSeconds:      computed.actualSeconds,   // new — for live timer

    PauseCount:         computed.pauses_count,
    TotalPauseMinutes:  computed.pauseMinutes,
    TotalPauseSeconds:  computed.pauseSeconds,
    LastPauseAt:        computed.paused_at   || '',
    LastResumeAt:       computed.last_resumed_at || '',

    IsPaused:           computed.isPaused,
    IsActive:           computed.isActive,

    ProofUrl:                computed.proofUrl,
    ProofType:               computed.proofType,
    ProofUploadedAt:         computed.proofUploadedAt,
    ProofVerificationStatus: computed.proofVerificationStatus,
    ProofNotes:              computed.proofNotes,

    CalendarEventId:    computed.calendar_event_id   || '',
    CalendarSyncStatus: computed.calendar_sync_status || 'pending',

    // Internal — for debugging
    _lifecycleSource:   'postgres',
  };
}

export function getBlockState(block, now = Date.now()) {
  if (!block) return null;

  const status = (block.status || '').toLowerCase().trim();
  const actualMinutes = Number(block.actual_minutes || block.actualMinutes || 0);

  // 1. completed: actual_minutes > 0 or status completed/done/stopped/partial
  if (actualMinutes > 0) {
    return 'completed';
  }
  const isCompletedStatus = ['completed', 'done', 'stopped', 'partial'].includes(status);
  if (isCompletedStatus) {
    return 'completed';
  }

  // 2. active/running: currently started and not stopped
  const isActiveStatus = ['active', 'paused'].includes(status);
  if (isActiveStatus || (block.started_at && !block.ended_at && !isCompletedStatus)) {
    return 'active';
  }

  // Determine if planned_end has passed
  let isPast = false;
  if (block.planned_end && block.day_key) {
    const dayKey = block.day_key;
    const [endH, endM] = block.planned_end.split(':').map(Number);
    // Parse planned_end in Asia/Kolkata timezone
    const plannedEndDate = new Date(`${dayKey}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00+05:30`);
    isPast = now > plannedEndDate.getTime();
  } else if (block.day_key) {
    // Fallback: compare day_key to today's date in Kolkata timezone
    const kolkataStr = new Date(now).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayStr = new Date(kolkataStr).toISOString().slice(0, 10);
    isPast = block.day_key < todayStr;
  }

  // 3. missed/postponed: planned_end < now AND no actual study recorded
  const isExplicitlyMissed = ['missed', 'skipped'].includes(status);
  if (isExplicitlyMissed && actualMinutes === 0) {
    return 'missed';
  }

  if (isPast && actualMinutes === 0) {
    return 'postponed';
  }

  // 4. pending: now < planned_end and not completed
  return 'pending';
}

export function formatSubjectTopic(subject, topic) {
  const s = (subject || '').trim();
  const t = (topic || '').trim();
  if (!s && !t) return 'Unknown';
  if (!s) return t;
  if (!t) return s;
  if (s.toLowerCase() === t.toLowerCase()) {
    return s;
  }
  return `${s} (${t})`;
}

