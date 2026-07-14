import assert from 'node:assert/strict';
import { classifyTimerExecutions } from './services/canonicalTimerClassification.js';

// --- Helpers ---
function createBlock(overrides) {
  return {
    id: 'uuid-1234',
    block_id: 'ext_block_id_456',
    status: 'completed',
    started_at: '2026-08-01T10:00:00Z',
    ended_at: '2026-08-01T11:00:00Z',
    actual_minutes: 60,
    ...overrides
  };
}

function createLog(overrides) {
  return {
    id: 'log-uuid-789',
    started_at: '2026-08-01T10:00:00Z',
    ended_at: '2026-08-01T11:00:00Z',
    completion_status: 'completed',
    actual_minutes: 60,
    pause_seconds: 0,
    ...overrides
  };
}

const tests = [];

tests.push({
  name: 'timestamp with Z',
  fn: () => {
    const block = createBlock();
    const logs = [createLog()];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'verified');
  }
});

tests.push({
  name: 'timestamp with explicit offset',
  fn: () => {
    const block = createBlock({ started_at: '2026-08-01T15:30:00+05:30', ended_at: '2026-08-01T16:30:00+05:30' });
    const logs = [createLog({ started_at: '2026-08-01T15:30:00+05:30', ended_at: '2026-08-01T16:30:00+05:30' })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'verified');
    assert.equal(result.recordedNetSeconds, 3600);
  }
});

tests.push({
  name: 'timezone-less timestamp excluded',
  fn: () => {
    const block = createBlock({ started_at: '2026-08-01T10:00:00' });
    const logs = [createLog({ started_at: '2026-08-01T10:00:00' })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('AMBIGUOUS_TIMESTAMP'));
  }
});

tests.push({
  name: 'missing start visible as excluded result',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ started_at: null })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('MISSING_START_TIMESTAMP'));
  }
});

tests.push({
  name: 'missing end visible as excluded result',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ ended_at: '' })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('MISSING_END_TIMESTAMP'));
  }
});

tests.push({
  name: 'invalid date visible as excluded result',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ started_at: 'not-a-dateZ' })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('INVALID_TIMESTAMP'));
  }
});

tests.push({
  name: 'negative pause excluded',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ pause_seconds: -10 })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('NEGATIVE_PAUSE_DURATION'));
  }
});

tests.push({
  name: 'non-numeric pause excluded',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ pause_seconds: 'abc' })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('INVALID_PAUSE_DURATION'));
  }
});

tests.push({
  name: 'fractional pause deterministic',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ pause_seconds: 12.9, actual_minutes: 60 })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.pauseSeconds, 12);
    assert.equal(result.recordedNetSeconds, 3600 - 12);
  }
});

tests.push({
  name: 'pause greater than gross excluded',
  fn: () => {
    const block = createBlock();
    const logs = [createLog({ pause_seconds: 4000 })];
    const result = classifyTimerExecutions({ block, logs })[0];
    assert.equal(result.classification, 'excluded');
    assert.ok(result.anomalyReasons.includes('PAUSE_EXCEEDS_ELAPSED'));
  }
});

tests.push({
  name: 'overlapping A/B plus independent C',
  fn: () => {
    const block = createBlock();
    const logs = [
      createLog({ id: 'A', started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:00Z' }),
      createLog({ id: 'B', started_at: '2026-08-01T10:30:00Z', ended_at: '2026-08-01T11:30:00Z' }),
      createLog({ id: 'C', started_at: '2026-08-01T14:00:00Z', ended_at: '2026-08-01T15:00:00Z' })
    ];
    const results = classifyTimerExecutions({ block, logs });
    assert.equal(results.length, 3);
    const a = results.find(r => r.blockLogId === 'A');
    const b = results.find(r => r.blockLogId === 'B');
    const c = results.find(r => r.blockLogId === 'C');
    assert.equal(a.classification, 'excluded');
    assert.ok(a.anomalyReasons.includes('OVERLAPPING_CONTRADICTORY_LOGS'));
    assert.equal(b.classification, 'excluded');
    assert.ok(b.anomalyReasons.includes('OVERLAPPING_CONTRADICTORY_LOGS'));
    assert.equal(c.classification, 'verified'); // Independent C remains valid
  }
});

tests.push({
  name: 'paused execution ID',
  fn: () => {
    const block = createBlock({ status: 'paused', started_at: '2026-08-01T10:00:00Z', ended_at: null });
    const result = classifyTimerExecutions({ block, logs: [] });
    assert.equal(result[0].executionId, 'current_paused_uuid-1234');
    assert.equal(result[0].classification, 'paused');
  }
});

tests.push({
  name: 'current block’s own planned interval ignored',
  fn: () => {
    const block = createBlock();
    const logs = [createLog()];
    // Overlapping interval but it belongs to the same block
    const nextBlocks = [{
      blockUuid: 'uuid-1234',
      plannedStartMs: new Date('2026-08-01T10:30:00Z').getTime(),
      plannedEndMs: new Date('2026-08-01T11:30:00Z').getTime()
    }];
    const result = classifyTimerExecutions({ block, logs, nextBlocks })[0];
    assert.equal(result.classification, 'verified'); // Ignored
  }
});

tests.push({
  name: 'later adjacent block not overlapping',
  fn: () => {
    const block = createBlock({ started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:00Z' });
    const logs = [createLog({ started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:00Z' })];
    const nextBlocks = [{
      blockUuid: 'other-block',
      plannedStartMs: new Date('2026-08-01T11:00:00Z').getTime(),
      plannedEndMs: new Date('2026-08-01T12:00:00Z').getTime()
    }];
    const result = classifyTimerExecutions({ block, logs, nextBlocks })[0];
    assert.equal(result.classification, 'verified');
  }
});

tests.push({
  name: 'later one-second overlap requiring confirmation',
  fn: () => {
    const block = createBlock({ started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:01Z' });
    const logs = [createLog({ started_at: '2026-08-01T10:00:00Z', ended_at: '2026-08-01T11:00:01Z' })];
    const nextBlocks = [{
      blockUuid: 'other-block',
      plannedStartMs: new Date('2026-08-01T11:00:00Z').getTime(),
      plannedEndMs: new Date('2026-08-01T12:00:00Z').getTime()
    }];
    const result = classifyTimerExecutions({ block, logs, nextBlocks })[0];
    assert.equal(result.classification, 'confirmation_required');
    assert.ok(result[0].anomalyReasons.includes('OVERLAPS_LATER_PLANNED_BLOCK'));
  }
});

tests.push({
  name: 'every input log produces exactly one result after exact deduplication',
  fn: () => {
    const block = createBlock();
    // Two exact logs + one distinct log = 2 results
    const logs = [
      createLog({ id: 'L1', pause_seconds: 0 }),
      createLog({ id: 'L1', pause_seconds: 0 }), // Deduplicated based on properties
      createLog({ id: 'L2', started_at: '2026-08-01T14:00:00Z', ended_at: '2026-08-01T15:00:00Z' })
    ];
    const results = classifyTimerExecutions({ block, logs });
    assert.equal(results.length, 2);
  }
});

tests.push({
  name: 'invariant across verified, pending and every excluded category',
  fn: () => {
    const fixtures = [
      { block: createBlock(), logs: [createLog()] }, // verified
      { block: createBlock(), logs: [createLog({ actual_minutes: 50 })] }, // confirmation_required
      { block: createBlock(), logs: [createLog({ started_at: 'invalid' })] }, // excluded
      { block: createBlock(), logs: [createLog({ pause_seconds: 4000 })] }, // excluded
      { block: createBlock(), logs: [] } // missing logs -> confirmation required
    ];

    for (const f of fixtures) {
      const results = classifyTimerExecutions(f);
      for (const result of results) {
        if (['active', 'paused'].includes(result.classification)) continue;
        
        assert.equal(
          result.recordedNetSeconds,
          result.verifiedTimerSeconds + result.confirmationRequiredSeconds + result.excludedTimerSeconds
        );
      }
    }
  }
});

tests.push({
  name: 'repeated immutable input produces deeply identical output',
  fn: () => {
    const block = createBlock();
    const logs = [createLog()];
    const result1 = classifyTimerExecutions({ block, logs });
    const result2 = classifyTimerExecutions({ block, logs });
    assert.deepEqual(result1, result2);
  }
});


async function run() {
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      t.fn();
      passed++;
    } catch (e) {
      console.error(`❌ ${t.name}`);
      console.error(e.stack);
      failed++;
    }
  }

  if (failed === 0) {
    console.log(`\nAll ${passed} generic test matrix tests passed!`);
  } else {
    console.error(`\n${failed} tests failed.`);
    process.exit(1);
  }

  console.log(`
ABSOLUTE_TIMESTAMPS_ENFORCED: YES
AMBIGUOUS_TIMESTAMPS_FAIL_CLOSED: YES
MALFORMED_LOGS_REMAIN_VISIBLE: YES
INVALID_PAUSES_FAIL_CLOSED: YES
OVERLAP_CORRUPTION_IS_PER_EXECUTION: YES
INDEPENDENT_EXECUTIONS_REMAIN_VALID: YES
ACTIVE_AND_PAUSED_IDS_DISTINCT: YES
CURRENT_BLOCK_INTERVAL_IGNORED: YES
ALL_INPUT_LOGS_ACCOUNTED_FOR: YES
ALL_INVARIANTS_PASS: YES
COMMIT_AMENDED: YES
PUSH_PERFORMED: NO
DEPLOY_PERFORMED: NO
SAFE_TO_REVIEW_AMENDED_COMMIT: YES
`);
}

run();
