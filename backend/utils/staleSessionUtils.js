export function getStaleThresholdMinutes() {
  const envVal = process.env.MENTOROS_STALE_ACTIVE_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 720; // 12 hours
}

export function detectStaleSession(block, serverNowStr) {
  const thresholdMinutes = getStaleThresholdMinutes();
  const defaultRes = { isStale: false, sessionAgeMinutes: 0, focusedElapsedMinutes: 0, thresholdMinutes, invalidTimestamp: true };
  if (!block || !block.started_at) {
    return defaultRes;
  }
  
  const startedAt = new Date(block.started_at).getTime();
  const now = new Date(serverNowStr).getTime();
  
  if (isNaN(startedAt) || now < startedAt) {
    return defaultRes;
  }
  
  const pausedAt = block.paused_at ? new Date(block.paused_at).getTime() : 0;
  
  let foldPauseSec = 0;
  let invalidTimestamp = false;
  
  if (block.paused_at && isNaN(pausedAt)) {
    invalidTimestamp = true;
  } else if (pausedAt && now >= pausedAt) {
    foldPauseSec = Math.floor((now - pausedAt) / 1000);
  } else if (pausedAt && now < pausedAt) {
    invalidTimestamp = true;
  }
  
  const pauseSec = (block.total_pause_seconds || 0) + foldPauseSec;
  
  const sessionAgeMinutes = Math.floor((now - startedAt) / 60000);
  const focusedElapsedMinutes = Math.max(0, Math.floor((now - startedAt - (pauseSec * 1000)) / 60000));
  
  return {
    isStale: sessionAgeMinutes > thresholdMinutes,
    sessionAgeMinutes,
    focusedElapsedMinutes,
    thresholdMinutes,
    invalidTimestamp
  };
}
