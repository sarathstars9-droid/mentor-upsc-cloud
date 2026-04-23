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
    ...gasBlock,

    // ── Lifecycle fields from PostgreSQL (override any GAS values) ──────────
    BlockId:            computed.block_id,
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

    CalendarEventId:    computed.calendar_event_id   || '',
    CalendarSyncStatus: computed.calendar_sync_status || 'pending',

    // Internal — for debugging
    _lifecycleSource:   'postgres',
  };
}
