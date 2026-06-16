// backend/services/adaptiveGoalService.js

/**
 * Get daily target minutes based on the user's mission health state and recovery progress.
 *
 * @param {string} state - The current mission health state
 * @param {number} recoveryDay - The day index of recovery (1-indexed)
 * @param {number} defaultTargetMinutes - The normal target minutes for the user (default: 600 mins / 10 hours)
 * @returns {number} The calculated daily target minutes
 */
export function getDailyTargetMinutes(state, recoveryDay = 0, defaultTargetMinutes = 600) {
  const normState = (state || 'HEALTHY').toUpperCase();

  switch (normState) {
    case 'MISSION_FAILURE':
      return 15; // 10-20 minutes target

    case 'CRITICAL':
      return 25; // ONE 25-minute Pomodoro

    case 'HIGH_RISK':
      return 45; // 45 minutes target

    case 'AT_RISK':
      return 75; // 60-90 minutes target

    case 'SLIGHT_RISK':
      return defaultTargetMinutes;

    case 'RECOVERY':
      const day = Number(recoveryDay) || 1;
      if (day === 1) return 25;
      if (day === 2) return 45;
      if (day === 3) return 60;
      if (day === 4) return 90;
      return defaultTargetMinutes;

    case 'HEALTHY':
    default:
      return defaultTargetMinutes;
  }
}
