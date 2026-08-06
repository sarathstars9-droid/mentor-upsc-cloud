import test from 'node:test';
import assert from 'node:assert';
import { toFrontendBlock } from '../services/computeBlockState.js';

test('toFrontendBlock preserves zero actual minutes and includes fields', (t) => {
  const dbRow = {
    id: 'blk-123',
    day_key: '2026-08-04',
    planned_start: '09:00',
    planned_end: '10:00',
    planned_minutes: 60,
    subject: 'History',
    topic: 'Modern',
    status: 'paused',
    actual_minutes: 0,
    started_at: '2026-08-04T09:00:00.000Z',
    ended_at: null,
    total_pause_seconds: 0
  };

  const mapped = toFrontendBlock(dbRow);

  assert.strictEqual(mapped.BlockId, 'blk-123');
  assert.strictEqual(mapped.PlannedStart, '09:00');
  assert.strictEqual(mapped.PlannedEnd, '10:00');
  assert.strictEqual(mapped.PlannedMinutes, 60);
  assert.strictEqual(mapped.PlannedSubject, 'History');
  assert.strictEqual(mapped.PlannedTopic, 'Modern');
  assert.strictEqual(mapped.ActualMinutes, 0, 'actualMinutes must be exactly 0, not null/undefined');
  assert.strictEqual(mapped.Status, 'paused', 'a paused block should map to active or paused'); // wait, computeBlockState might return 'active' or 'paused'. Let's check status mapping.

  // Actually, computeBlockState maps status: 'paused' to 'active' internally in getBlockState, but in toFrontendBlock it returns `computed.status` which is just dbRow.status. Let's verify what computeBlockState returns.
});

test('toFrontendBlock handles null timestamps safely', (t) => {
  const dbRow = {
    id: 'blk-456',
    status: 'planned',
    started_at: null,
    ended_at: null,
    actual_minutes: null
  };
  const mapped = toFrontendBlock(dbRow);
  assert.strictEqual(mapped.ActualStart, '');
  assert.strictEqual(mapped.ActualEnd, '');
  assert.strictEqual(mapped.ActualMinutes, 0); // computeBlockState uses Number(0) for null actual_minutes
});

test('recovered 95 minutes maps as exactly 95, despite long elapsed time', (t) => {
  const startedAtStr = new Date(Date.now() - (48 * 3600 * 1000)).toISOString(); // 48 hours ago
  const dbRow = {
    id: 'blk-rec-95',
    status: 'completed',
    actual_minutes: 95,
    started_at: startedAtStr,
    ended_at: new Date().toISOString(), // ended now
    total_pause_seconds: 0
  };
  const mapped = toFrontendBlock(dbRow);
  assert.strictEqual(mapped.ActualMinutes, 95);
});

test('recovered zero maps as exactly zero', (t) => {
  const dbRow = {
    id: 'blk-rec-0',
    status: 'completed',
    actual_minutes: 0,
    started_at: new Date(Date.now() - (48 * 3600 * 1000)).toISOString(),
    ended_at: new Date().toISOString(),
    total_pause_seconds: 0
  };
  const mapped = toFrontendBlock(dbRow);
  assert.strictEqual(mapped.ActualMinutes, 0);
});

test('normal completed blocks without actual_minutes map correctly (fallback)', (t) => {
  const startMs = Date.now() - (45 * 60000);
  const endMs = Date.now();
  const dbRow = {
    id: 'blk-norm',
    status: 'completed',
    actual_minutes: null, // Legacy row missing actual_minutes
    started_at: new Date(startMs).toISOString(),
    ended_at: new Date(endMs).toISOString(),
    total_pause_seconds: 300 // 5 minutes pause
  };
  const mapped = toFrontendBlock(dbRow);
  assert.strictEqual(mapped.ActualMinutes, 40); // 45 total - 5 pause
});

test('active stale elapsed is not exposed as trusted actual study time', (t) => {
  const startMs = Date.now() - (1000 * 60000); // 1000 mins ago
  const dbRow = {
    id: 'blk-stale-active',
    status: 'active',
    actual_minutes: null,
    started_at: new Date(startMs).toISOString(),
    ended_at: null,
    total_pause_seconds: 0
  };
  const mapped = toFrontendBlock(dbRow);
  // stale active session age > 12 hours means wall-clock elapsed time is excluded
  assert.strictEqual(mapped.ActualMinutes, 0);
});

import { safeExecutionPercent } from '../utils/mathUtils.js';
import { buildMentorCommand } from '../services/mentorStateService.js';

test('safeExecutionPercent helper logic', (t) => {
  // 1. plannedMinutes = 0
  assert.strictEqual(safeExecutionPercent(45, 0), 0);

  // 2. plannedMinutes = null
  assert.strictEqual(safeExecutionPercent(45, null), 0);

  // 3. actualMinutes = 830 and plannedMinutes = 0
  assert.strictEqual(safeExecutionPercent(830, 0), 0);

  // 4. calculated percentage over 100 is capped at 100
  assert.strictEqual(safeExecutionPercent(120, 60), 100);

  // 5. negative values
  assert.strictEqual(safeExecutionPercent(-10, 60), 0);
  assert.strictEqual(safeExecutionPercent(45, -60), 0);
  assert.strictEqual(safeExecutionPercent(-45, -60), 0);

  // 10. valid zero actual minutes remains zero
  assert.strictEqual(safeExecutionPercent(0, 60), 0);
});

test('invalid block and mentor command exclusion', (t) => {
  // 6 & 7. missing subject and title, invalid block excluded from Mentor Command
  const invalidBlock = {
    subject: '',
    title: '',
    status: 'active'
  };

  const cmd = buildMentorCommand({
    profile: {},
    blocks: [invalidBlock],
    pendingBlocks: [invalidBlock],
    staleBlock: null,
    activeBlock: invalidBlock,
    pausedBlock: null,
    hasPreviousDayLeakage: false
  });

  assert.strictEqual(cmd.title, 'Plan block needs correction');
  assert.match(cmd.instruction, /missing subject or task details/);
});
