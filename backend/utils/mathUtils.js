export function safeExecutionPercent(actualMinutes, plannedMinutes) {
  const actual = Number(actualMinutes);
  const planned = Number(plannedMinutes);

  if (!Number.isFinite(actual) || !Number.isFinite(planned) || planned <= 0 || actual < 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((actual / planned) * 100)));
}
