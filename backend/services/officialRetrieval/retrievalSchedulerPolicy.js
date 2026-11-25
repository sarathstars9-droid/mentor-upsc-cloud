/**
 * backend/services/officialRetrieval/retrievalSchedulerPolicy.js
 *
 * Deterministic Retrieval Cadence Policy (Phase 3A).
 * Defines controlled retrieval schedules by official source tier and type.
 * Never performs uncontrolled or continuous web crawling.
 */

export const RETRIEVAL_CADENCE_POLICIES = {
  PIB: {
    name: 'Press Information Bureau (PIB)',
    cadence: 'WINDOWED_DAILY',
    windowsPerDay: 3, // e.g., 09:00, 14:00, 19:00 IST
    maxDocsPerWindow: 20,
    checkIntervalHours: 8,
    priority: 95
  },
  MOSPI: {
    name: 'Ministry of Statistics & Programme Implementation (MoSPI)',
    cadence: 'RELEASE_DRIVEN_DAILY',
    releaseDatesExpected: [12, 14, 30], // Monthly release windows (CPI ~12-14th)
    checkIntervalHours: 24,
    priority: 100
  },
  RBI: {
    name: 'Reserve Bank of India (RBI)',
    cadence: 'EVENT_AND_DAILY',
    checkIntervalHours: 24,
    priority: 98
  },
  UNION_BUDGET: {
    name: 'Union Budget / Economic Survey',
    cadence: 'ANNUAL_SEASONAL',
    peakMonths: [1, 2, 7], // Jan, Feb, July
    checkIntervalHours: 24,
    priority: 100
  },
  AP_FINANCE: {
    name: 'Finance Department, Andhra Pradesh',
    cadence: 'ANNUAL_AND_MONTHLY_AUDIT',
    peakMonths: [2, 3, 11], // Budget sessions
    checkIntervalHours: 24,
    priority: 100
  },
  UPSC: {
    name: 'Union Public Service Commission (UPSC)',
    cadence: 'EXAM_CYCLE_DAILY',
    checkIntervalHours: 24,
    priority: 90
  },
  APPSC: {
    name: 'Andhra Pradesh Public Service Commission (APPSC)',
    cadence: 'EXAM_CYCLE_DAILY',
    checkIntervalHours: 24,
    priority: 90
  }
};

/**
 * Determine if an official source is due for scheduled check.
 */
export function isSourceRetrievalDue(sourceKey, lastRetrievedAt) {
  const policy = RETRIEVAL_CADENCE_POLICIES[sourceKey.toUpperCase()] || { checkIntervalHours: 24 };
  if (!lastRetrievedAt) return true;

  const lastTime = new Date(lastRetrievedAt).getTime();
  const now = Date.now();
  const elapsedHours = (now - lastTime) / (1000 * 60 * 60);

  return elapsedHours >= policy.checkIntervalHours;
}
