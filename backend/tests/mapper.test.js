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
