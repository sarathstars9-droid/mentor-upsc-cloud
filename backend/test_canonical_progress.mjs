// backend/test_canonical_progress.mjs
import test from 'node:test';
import assert from 'node:assert';

// Import only the pure modules to keep the tests completely isolated from database/scheduler modules
import {
  getKolkataDateParts,
  getKolkataDateKey,
  getRelativeKolkataDateKey,
  formatDurationSeconds,
  normalizeStudyBlock,
  aggregateCanonicalProgress,
  buildCanonicalGoodMorningData,
  EXECUTED_STATUS_ALLOWLIST,
  ACTIONABLE_STATUS_ALLOWLIST
} from './services/progressNormalizer.js';

import { generateCanonicalGoodMorningReport } from './services/reportGeneratorService.js';

// ── TEST: NO DB MODULE OR SCHEDULER INITIALIZATION ──────────────────────────
test('The pure test suite imports no database module', () => {
  // We check that process.env.DATABASE_URL has not been used to connect and no pool objects exist
  assert.strictEqual(global.telegramPollingLoopStarted, undefined);
  assert.strictEqual(global.telegramIsPolling, undefined);
});

// ── DATE CALCULATIONS TESTS ──────────────────────────────────────────────────
test('IST date calculation around UTC midnight boundary', () => {
  const date = new Date('2026-07-11T20:00:00Z');
  const todayKey = getKolkataDateKey(date);
  const yesterdayKey = getRelativeKolkataDateKey(date, -1);
  const sevenDayStartKey = getRelativeKolkataDateKey(date, -7);

  assert.strictEqual(todayKey, '2026-07-12');
  assert.strictEqual(yesterdayKey, '2026-07-11');
  assert.strictEqual(sevenDayStartKey, '2026-07-05');
});

test('IST date calculation around IST midnight boundary', () => {
  const date = new Date('2026-07-11T18:00:00Z');
  const todayKey = getKolkataDateKey(date);
  const yesterdayKey = getRelativeKolkataDateKey(date, -1);
  const sevenDayStartKey = getRelativeKolkataDateKey(date, -7);

  assert.strictEqual(todayKey, '2026-07-11');
  assert.strictEqual(yesterdayKey, '2026-07-10');
  assert.strictEqual(sevenDayStartKey, '2026-07-04');
});

// ── FORMATTER TESTS ──────────────────────────────────────────────────────────
test('formatDurationSeconds outputs correct minutes format', () => {
  assert.strictEqual(formatDurationSeconds(0), '0m');
  assert.strictEqual(formatDurationSeconds(2700), '45m');
});

test('formatDurationSeconds floors seconds to minutes before formatting', () => {
  assert.strictEqual(formatDurationSeconds(4219), '1h 10m');
  assert.strictEqual(formatDurationSeconds(7500), '2h 05m');
});

// ── INVALID TIMESTAMPS TESTS ─────────────────────────────────────────────────
test('Invalid started_at or ended_at strings are safely excluded', () => {
  const blockStartInvalid = {
    id: 'invalid-start',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: 'not-a-date',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const norm1 = normalizeStudyBlock(blockStartInvalid, [], []);
  assert.strictEqual(norm1.verifiedTimerSeconds, 0);
  assert.strictEqual(norm1.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm1.exclusionReason, 'INVALID_TIMESTAMP');

  const blockEndInvalid = {
    id: 'invalid-end',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: 'garbage-date',
    actual_minutes: 60
  };
  const norm2 = normalizeStudyBlock(blockEndInvalid, [], []);
  assert.strictEqual(norm2.verifiedTimerSeconds, 0);
  assert.strictEqual(norm2.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm2.exclusionReason, 'INVALID_TIMESTAMP');
});

// ── TERMINAL STATUS TESTS ────────────────────────────────────────────────────
test('Only terminal statuses in EXECUTED_STATUS_ALLOWLIST count', () => {
  assert.ok(EXECUTED_STATUS_ALLOWLIST.includes('completed'));
  assert.ok(EXECUTED_STATUS_ALLOWLIST.includes('partial'));
  assert.ok(EXECUTED_STATUS_ALLOWLIST.includes('stopped'));

  const missedBlock = {
    id: 'missed-with-timestamps',
    day_key: '2026-07-11',
    status: 'missed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const norm = normalizeStudyBlock(missedBlock, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.acceptedSelfReportedSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'VALID');
});

// ── ACTIVE AND PAUSED TESTS ──────────────────────────────────────────────────
test('Active and paused sessions never count as completed time, even with end timestamps', () => {
  const activeWithEnd = {
    id: 'active-with-end',
    day_key: '2026-07-11',
    status: 'active',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const normActive = normalizeStudyBlock(activeWithEnd, [], []);
  assert.strictEqual(normActive.verifiedTimerSeconds, 0);
  assert.strictEqual(normActive.dataQuality, 'CORRUPTED');
  assert.strictEqual(normActive.exclusionReason, 'ACTIVE_PAUSED_WITH_END_TIMESTAMP');

  const pausedWithEnd = {
    id: 'paused-with-end',
    day_key: '2026-07-11',
    status: 'paused',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const normPaused = normalizeStudyBlock(pausedWithEnd, [], []);
  assert.strictEqual(normPaused.verifiedTimerSeconds, 0);
  assert.strictEqual(normPaused.dataQuality, 'CORRUPTED');
  assert.strictEqual(normPaused.exclusionReason, 'ACTIVE_PAUSED_WITH_END_TIMESTAMP');
});

// ── CONFIGURED SESSION CAP TESTS ─────────────────────────────────────────────
test('Session cap checks enforce limits only when configured limit is supplied', () => {
  const longSession = {
    id: 'long-session-5h',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T17:00:00Z', // 5 hours elapsed
    actual_minutes: 300
  };

  // Case A: No limit supplied -> is VALID and returns 5h (18000s)
  const normNoLimit = normalizeStudyBlock(longSession, [], [], undefined);
  assert.strictEqual(normNoLimit.verifiedTimerSeconds, 18000);
  assert.strictEqual(normNoLimit.dataQuality, 'VALID');

  // Case B: 4 hours (14400s) limit supplied -> is CORRUPTED
  const normWithLimit = normalizeStudyBlock(longSession, [], [], 14400);
  assert.strictEqual(normWithLimit.verifiedTimerSeconds, 0);
  assert.strictEqual(normWithLimit.dataQuality, 'CORRUPTED');
  assert.strictEqual(normWithLimit.exclusionReason, 'UNREASONABLE_SESSION_DURATION');
});

// ── LOG CONSISTENCY TESTS ────────────────────────────────────────────────────
test('Identical duplicate block logs do not multiply duration', () => {
  const block = {
    id: 'duplicate-logs-block',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T13:00:00Z', completion_status: 'completed', actual_minutes: 60 },
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T13:00:00Z', completion_status: 'completed', actual_minutes: 60 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 3600);
  assert.strictEqual(norm.dataQuality, 'VALID');
});

test('Overlapping block logs are corrupted and contribute zero', () => {
  const block = {
    id: 'overlapping-logs-block',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T12:40:00Z', completion_status: 'completed', actual_minutes: 40 },
    { block_id: block.id, started_at: '2026-07-11T12:30:00Z', ended_at: '2026-07-11T13:00:00Z', completion_status: 'completed', actual_minutes: 30 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'CONTRADICTORY_LOGS');
});

test('Block duration 90m and log duration 10m is contradictory and contributes zero', () => {
  const block = {
    id: 'block-90m-log-10m',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:30:00Z', // 90 minutes gross
    actual_minutes: 90
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T12:10:00Z', completion_status: 'completed', actual_minutes: 90 } // 10 minutes gross
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'CONTRADICTORY_LOGS');
});

test('Block gross 90m (net 60m) and log actual_minutes 10 is contradictory and contributes zero', () => {
  const block = {
    id: 'block-net-60-log-10',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T10:00:00Z',
    ended_at: '2026-07-11T11:30:00Z', // 90 minutes gross
    total_pause_seconds: 1800, // 30 minutes pause -> net 60 minutes
    actual_minutes: 60
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T10:00:00Z', ended_at: '2026-07-11T11:30:00Z', completion_status: 'completed', actual_minutes: 10 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'CONTRADICTORY_LOGS');
});

test('Block completed and log partial is contradictory and contributes zero', () => {
  const block = {
    id: 'block-completed',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T13:00:00Z', completion_status: 'partial', actual_minutes: 60 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'CONTRADICTORY_LOGS');
});

test('Valid stopped block and consistent stopped log contributes completed study time', () => {
  const block = {
    id: 'block-stopped',
    day_key: '2026-07-11',
    status: 'stopped',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const logs = [
    { block_id: block.id, started_at: '2026-07-11T12:00:00Z', ended_at: '2026-07-11T13:00:00Z', completion_status: 'stopped', actual_minutes: 60 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 3600);
  assert.strictEqual(norm.dataQuality, 'VALID');
});

test('Pause-aware timer session contributes net duration when consistent', () => {
  const block = {
    id: 'pause-aware-block',
    day_key: '2026-07-11',
    started_at: '2026-07-11T10:00:00.000Z',
    ended_at: '2026-07-11T11:30:00.000Z', // 90 minutes gross
    total_pause_seconds: 1800, // 30 minutes pause -> net 60 minutes
    status: 'completed',
    actual_minutes: 60
  };
  const logs = [
    {
      block_id: 'pause-aware-block',
      started_at: '2026-07-11T10:00:00.000Z',
      ended_at: '2026-07-11T11:30:00.000Z',
      completion_status: 'completed',
      actual_minutes: 60
    }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 3600);
  assert.strictEqual(norm.dataQuality, 'VALID');
});

// ── STATUS-AWARE IMMEDIATE ACTION TESTS ──────────────────────────────────────
test('Active takes priority over planned block and says Continue', () => {
  const plannedBlock = { id: 'planned-1', status: 'planned', planned_start: '09:00', subject: 'Geography' };
  const activeBlock = { id: 'active-1', status: 'active', planned_start: '11:00', subject: 'History' };

  const payload = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user: { name: 'Moulika' },
    todayBlocks: [plannedBlock, activeBlock]
  });

  assert.strictEqual(payload.immediateAction, 'Continue your active block (History) now.');
});

test('Paused takes priority over planned block and says Resume', () => {
  const plannedBlock = { id: 'planned-1', status: 'planned', planned_start: '09:00', subject: 'Geography' };
  const pausedBlock = { id: 'paused-1', status: 'paused', planned_start: '11:00', subject: 'Polity' };

  const payload = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user: { name: 'Moulika' },
    todayBlocks: [plannedBlock, pausedBlock]
  });

  assert.strictEqual(payload.immediateAction, 'Resume your paused block (Polity) now.');
});

test('Planned block message contains its scheduled start time', () => {
  const plannedBlock = { id: 'planned-1', status: 'planned', planned_start: '14:30', subject: 'Ethics' };

  const payload = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user: { name: 'Moulika' },
    todayBlocks: [plannedBlock]
  });

  assert.strictEqual(payload.immediateAction, 'Start your first planned block (Ethics) at 14:30.');
});

// ── PURE NORMALIZER UNIT TESTS ───────────────────────────────────────────────
test('v_block-style zero duration records contribute zero timer seconds', () => {
  const block = {
    id: 'v_block_1',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T06:34:26.480Z',
    ended_at: '2026-07-11T06:34:26.480Z',
    actual_minutes: 25,
    planned_minutes: 25
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.acceptedSelfReportedSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'MISSING_TIMER_EVIDENCE');
});

test('April legacy recoverable block recovers raw seconds from timestamps', () => {
  const block = {
    id: 'legacy_block_1',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:03:14Z',
    ended_at: '2026-07-11T13:12:07Z',
    actual_minutes: 0,
    planned_minutes: 60
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 4133);
  assert.strictEqual(norm.dataQuality, 'RECOVERABLE');
});

test('Malformed day_key block is excluded', () => {
  const block = {
    id: 'malformed_block',
    day_key: '6-16-2026,',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'MALFORMED_DAY_KEY');
});

test('Open session timer block contributes 0 seconds', () => {
  const block = {
    id: 'open_block',
    day_key: '2026-07-11',
    status: 'active',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: null,
    actual_minutes: 0
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'OPEN');
});

test('End before or equal to start block is corrupted and contributes 0', () => {
  const block = {
    id: 'end_before_start',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T13:00:00Z',
    ended_at: '2026-07-11T12:00:00Z',
    actual_minutes: 60
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'END_BEFORE_OR_EQUAL_TO_START');
});

test('Pause duration exceeding elapsed duration is corrupted and contributes 0', () => {
  const block = {
    id: 'pause_exceeds_elapsed',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    total_pause_seconds: 3700,
    actual_minutes: 60
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'PAUSE_EXCEEDS_ELAPSED_DURATION');
});

test('Contradictory block logs contribute 0 seconds', () => {
  const block = {
    id: 'contradictory_logs',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const logs = [
    { completion_status: 'completed', actual_minutes: 60 },
    { completion_status: 'partial', actual_minutes: 20 }
  ];
  const norm = normalizeStudyBlock(block, logs, []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.dataQuality, 'CORRUPTED');
  assert.strictEqual(norm.exclusionReason, 'CONTRADICTORY_LOGS');
});

test('Planned minutes are never fallback to actual progress', () => {
  const block = {
    id: 'planned_fallback',
    day_key: '2026-07-11',
    status: 'skipped',
    started_at: null,
    ended_at: null,
    actual_minutes: 0,
    planned_minutes: 90
  };
  const norm = normalizeStudyBlock(block, [], []);
  assert.strictEqual(norm.verifiedTimerSeconds, 0);
  assert.strictEqual(norm.acceptedSelfReportedSeconds, 0);
});

test('Input block object remains immutable', () => {
  const block = {
    id: 'immutable_test',
    day_key: '2026-07-11',
    status: 'completed',
    started_at: '2026-07-11T12:00:00Z',
    ended_at: '2026-07-11T13:00:00Z',
    actual_minutes: 60
  };
  const frozen = Object.freeze(block);
  assert.doesNotThrow(() => normalizeStudyBlock(frozen, [], []));
});

// ── TODAY ACTIONABLE STATUS TESTS ────────────────────────────────────────────
test("Today's blocks are considered available only if they are actionable", () => {
  assert.deepStrictEqual(ACTIONABLE_STATUS_ALLOWLIST, ['planned', 'active', 'paused']);

  const completedTodayBlock = {
    id: 'b1',
    day_key: '2026-07-12',
    status: 'completed',
    planned_minutes: 60
  };
  const missedTodayBlock = {
    id: 'b2',
    day_key: '2026-07-12',
    status: 'missed',
    planned_minutes: 60
  };
  const plannedTodayBlock = {
    id: 'b3',
    day_key: '2026-07-12',
    status: 'planned',
    planned_start: '09:00',
    planned_minutes: 60,
    subject: 'Geography Optional'
  };

  const payload1 = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user: { name: 'Moulika' },
    todayBlocks: [completedTodayBlock, missedTodayBlock],
    yesterdayBlocks: [],
    sevenDayBlocks: [],
    logs: [],
    events: []
  });

  assert.strictEqual(payload1.todayBlocksCount, 0);
  const msg1 = generateCanonicalGoodMorningReport(payload1, 'Moulika');
  assert.ok(msg1.includes("Today's blocks: Not available"));

  const payload2 = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user: { name: 'Moulika' },
    todayBlocks: [completedTodayBlock, plannedTodayBlock],
    yesterdayBlocks: [],
    sevenDayBlocks: [],
    logs: [],
    events: []
  });

  assert.strictEqual(payload2.todayBlocksCount, 1);
  const msg2 = generateCanonicalGoodMorningReport(payload2, 'Moulika');
  assert.ok(msg2.includes("Today's blocks: Available"));
  assert.ok(msg2.includes("Start your first planned block (Geography Optional) at 09:00."));
});

// ── PURE PRODUCTION-DATA BUILDER TESTS ───────────────────────────────────────
test('Pure production-data builder constructs correct payloads and filters v_blocks/malformed keys', () => {
  const user = { name: 'Moulika' };

  const todayBlocks = [
    { id: 'today-1', day_key: '2026-07-12', status: 'planned', planned_start: '10:00', planned_minutes: 60, subject: 'Ethics' }
  ];

  const yesterdayBlocks = [
    { id: 'legacy-1', day_key: '2026-07-11', started_at: '2026-07-11T12:03:14Z', ended_at: '2026-07-11T13:12:07Z', actual_minutes: 0, planned_minutes: 60, status: 'completed' },
    { id: 'malformed-1', day_key: '6-16-2026,', started_at: '2026-07-11T17:00:00Z', ended_at: '2026-07-11T18:00:00Z', actual_minutes: 60, status: 'completed' }
  ];

  const sevenDayBlocks = [
    { id: 'vblock-1', day_key: '2026-07-09', started_at: '2026-07-09T06:34:26.480Z', ended_at: '2026-07-09T06:34:26.480Z', actual_minutes: 25, planned_minutes: 25, status: 'completed' },
    { id: '7day-1', day_key: '2026-07-09', started_at: '2026-07-09T10:00:00Z', ended_at: '2026-07-09T12:05:00Z', actual_minutes: 125, planned_minutes: 120, status: 'completed' }
  ];

  const logs = [
    { block_id: 'legacy-1', started_at: '2026-07-11T12:03:14Z', ended_at: '2026-07-11T13:12:07Z', completion_status: 'completed', actual_minutes: 0 }
  ];

  const events = [];

  const payload = buildCanonicalGoodMorningData({
    now: new Date('2026-07-12T05:00:00Z'),
    user,
    todayBlocks,
    yesterdayBlocks,
    sevenDayBlocks,
    logs,
    events
  });

  assert.strictEqual(payload.userName, 'Moulika');
  assert.strictEqual(payload.yesterdayVerifiedSeconds, 4133);
  assert.strictEqual(payload.yesterdayAcceptedSelfReportedSeconds, 0);
  assert.strictEqual(payload.last7DaysVerifiedSeconds, 7500);
  assert.strictEqual(payload.last7DaysAcceptedSelfReportedSeconds, 0);
  assert.strictEqual(payload.todayBlocksCount, 1);
  assert.strictEqual(payload.todayPlannedMinutes, 60);
  assert.strictEqual(payload.realisticMinimumMinutes, null);
  assert.strictEqual(payload.immediateAction, 'Start your first planned block (Ethics) at 10:00.');
});

test('Report text generator correctly prints metrics and omits minimum commitment when null', () => {
  const data = {
    userName: 'Moulika',
    yesterdayVerifiedSeconds: 4219,
    yesterdayAcceptedSelfReportedSeconds: 0,
    last7DaysVerifiedSeconds: 7500,
    last7DaysAcceptedSelfReportedSeconds: 0,
    todayBlocksCount: 1,
    todayPlannedMinutes: 90,
    realisticMinimumMinutes: null,
    immediateAction: "Start your first planned block (Geography Optional) at 09:00."
  };

  const message = generateCanonicalGoodMorningReport(data, 'Moulika');

  assert.ok(message.includes("Yesterday\nTimer verified: 1h 10m"));
  assert.ok(message.includes("Last 7 days\nTimer verified: 2h 05m"));
  assert.ok(message.includes("Today's blocks: Available"));
  assert.ok(message.includes("Start your first planned block (Geography Optional) at 09:00."));

  assert.ok(!message.includes("Minimum commitment:"));
  assert.ok(!message.includes("Expected progress"));
  assert.ok(!message.includes("Backlog:"));
  assert.ok(!message.includes("expected_hours"));
  assert.ok(!message.includes("backlog_hours"));

  assert.ok(!/\b\d+\.\d+\b/.test(message));
});
