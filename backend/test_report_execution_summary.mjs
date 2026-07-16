import assert from 'assert';
import { 
  resolveBlockRecordedDuration, 
  aggregateDailySummary 
} from './services/reportExecutionSummaryService.js';

function runTests() {
  console.log("=== Running reportExecutionSummaryService Tests ===");

  // Test 1: Terminal actual_minutes preferred
  {
    const block = {
      id: 'block-1',
      block_id: 'b-1',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 45,
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T10:00:00Z',
      total_pause_seconds: 0
    };
    const logs = [];
    const events = [];
    const res = resolveBlockRecordedDuration(block, logs, events);
    assert.strictEqual(res.seconds, 45 * 60, "Should use actual_minutes * 60");
    assert.strictEqual(res.source, 'TERMINAL_ACTUAL_MINUTES');
    console.log("✓ Test 1 Passed: Terminal actual_minutes preferred");
  }

  // Test 2: Valid block log fallback
  {
    const block = {
      id: 'block-2',
      block_id: 'b-2',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 0,
      started_at: null,
      ended_at: null
    };
    const logs = [
      {
        block_id: 'block-2',
        completion_status: 'completed',
        actual_minutes: 30
      }
    ];
    const res = resolveBlockRecordedDuration(block, logs, []);
    assert.strictEqual(res.seconds, 30 * 60, "Should use block log actual_minutes * 60");
    assert.strictEqual(res.source, 'BLOCK_LOG_MINUTES');
    console.log("✓ Test 2 Passed: Valid block log fallback");
  }

  // Test 3: Timestamp fallback and safety guards (cap at 6 hours, reject negative)
  {
    const block = {
      id: 'block-3',
      block_id: 'b-3',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 0,
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T17:00:00Z', // 8 hours
      total_pause_seconds: 0
    };
    const { seconds, issues } = resolveBlockRecordedDuration(block, [], []);
    assert.strictEqual(seconds, 0, "8 hours session exceeds safety limit (max 6h)");
    assert.ok(issues.some(i => i.code === 'MAX_SESSION_EXCEEDED'));

    const block2 = {
      id: 'block-4',
      block_id: 'b-4',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 0,
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T08:00:00Z', // negative duration
      total_pause_seconds: 0
    };
    const res2 = resolveBlockRecordedDuration(block2, [], []);
    assert.strictEqual(res2.seconds, 0);
    assert.ok(res2.issues.some(i => i.code === 'INVALID_LIFECYCLE_TIMESTAMPS'));
    console.log("✓ Test 3 Passed: Safety guards enforced");
  }

  // Test 4: Active/paused work preserved
  {
    const block = {
      id: 'block-5',
      block_id: 'b-5',
      day_key: '2026-07-16',
      status: 'active',
      planned_minutes: 60,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // started 30 mins ago
      total_pause_seconds: 60 // 1 min pause
    };
    const { seconds } = resolveBlockRecordedDuration(block, [], []);
    assert.ok(seconds >= 1700 && seconds <= 1800, "Should preserve active work");
    
    // Aggregate summary check
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], logs: [], events: [] });
    assert.strictEqual(summary.completedBlockCount, 0, "Active block is not counted as completed");
    assert.ok(summary.totalRecordedSeconds > 0);
    assert.ok(summary.subjects[0].pendingSeconds > 0, "Pending work is calculated");
    console.log("✓ Test 4 Passed: Active/paused work preserved and not completed");
  }

  // Test 5: Missed work carried forward
  {
    const block = {
      id: 'block-6',
      block_id: 'b-6',
      day_key: '2026-07-16',
      status: 'missed',
      planned_minutes: 60,
      actual_minutes: 0
    };
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
    assert.strictEqual(summary.missedBlockCount, 1);
    assert.strictEqual(summary.subjects[0].pendingSeconds, 3600, "Missed work carries forward planned minutes");
    console.log("✓ Test 5 Passed: Missed work carried forward");
  }

  // Test 6: Rescheduled work not duplicated
  {
    const block = {
      id: 'block-7',
      block_id: 'b-7',
      day_key: '2026-07-16',
      status: 'skipped',
      completion_reason: 'rescheduled',
      planned_minutes: 60,
      actual_minutes: 0
    };
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
    assert.strictEqual(summary.subjects[0].pendingSeconds, 3600, "Rescheduled work treated as missed if unsupported");
    assert.ok(summary.dataQualityIssues.some(i => i.code === 'UNEXPLAINED_MISSED_BLOCK'));
    console.log("✓ Test 6 Passed: Unsupported reschedule defaults to missed");
  }

  // Test 7: Cancelled work excluded from pending
  {
    const block = {
      id: 'block-8',
      block_id: 'b-8',
      day_key: '2026-07-16',
      status: 'skipped',
      completion_reason: 'cancelled',
      planned_minutes: 60,
      actual_minutes: 0
    };
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
    assert.strictEqual(summary.subjects[0].pendingSeconds, 3600, "Cancelled work treated as missed if unsupported");
    assert.ok(summary.dataQualityIssues.some(i => i.code === 'UNEXPLAINED_MISSED_BLOCK'));
    console.log("✓ Test 7 Passed: Unsupported cancelled defaults to missed");
  }

  // Test 8: Revisions supplied explicitly
  {
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [], revisionItemsCount: 5 });
    assert.strictEqual(summary.revisionsDue, 5);
    console.log("✓ Test 8 Passed: Revisions supplied explicitly");
  }

  // Test 9: Conflicting evidence produces dataQuality=CONFLICT
  {
    const block = {
      id: 'block-9',
      block_id: 'b-9',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 0,
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T10:00:00Z'
    };
    const logs = [
      {
        block_id: 'block-9',
        completion_status: 'partial' // conflict status!
      }
    ];
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], logs });
    assert.strictEqual(summary.dataQuality, 'CONFLICT');
    console.log("✓ Test 9 Passed: Conflicting evidence produces dataQuality=CONFLICT");
  }

  // Test 10: Stopped block classification
  {
    // Case A: Over-target counts completed
    const blockA = {
      id: 'block-10a',
      block_id: 'b-10a',
      day_key: '2026-07-16',
      status: 'stopped',
      planned_minutes: 45,
      actual_minutes: 50
    };
    const summaryA = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [blockA] });
    assert.strictEqual(summaryA.completedBlockCount, 1);
    assert.strictEqual(summaryA.partialBlockCount, 0);

    // Case B: Under-target counts partial
    const blockB = {
      id: 'block-10b',
      block_id: 'b-10b',
      day_key: '2026-07-16',
      status: 'stopped',
      planned_minutes: 45,
      actual_minutes: 30
    };
    const summaryB = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [blockB] });
    assert.strictEqual(summaryB.completedBlockCount, 0);
    assert.strictEqual(summaryB.partialBlockCount, 1);
    console.log("✓ Test 10 Passed: Stopped block classification rules");
  }

  // Test 11: Stopped zero evidence → pending retained, STOPPED_DURATION_UNCONFIRMED (NOT missed) [Item 3]
  {
    const block = {
      id: 'block-11',
      block_id: 'b-11',
      day_key: '2026-07-16',
      status: 'stopped',
      planned_minutes: 90,
      actual_minutes: 0
    };
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
    assert.strictEqual(summary.missedBlockCount, 0, "stopped+zero should NOT be missed");
    assert.strictEqual(summary.pendingBlockCount, 1, "stopped+zero should be pending");
    assert.ok(summary.dataQualityIssues.some(i => i.code === 'STOPPED_DURATION_UNCONFIRMED'), "must flag STOPPED_DURATION_UNCONFIRMED");
    assert.notStrictEqual(summary.dataQuality, 'OK', "dataQuality must not be OK");
    // pending seconds = full planned because no evidence of completion
    assert.strictEqual(summary.subjects[0].pendingSeconds, 90 * 60, "full planned duration retained as pending");
    console.log("✓ Test 11 Passed: Stopped+zero retains pending, not missed");
  }

  // Test 12: Explicit missed status is still classified as missed [Item 3]
  {
    const block = {
      id: 'block-12',
      block_id: 'b-12',
      day_key: '2026-07-16',
      status: 'missed',
      planned_minutes: 60,
      actual_minutes: 0
    };
    const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
    assert.strictEqual(summary.missedBlockCount, 1, "explicit missed must be counted as missed");
    assert.strictEqual(summary.pendingBlockCount, 0, "explicit missed must NOT be pending");
    console.log("✓ Test 12 Passed: Explicit missed status correctly classified");
  }

  // Test 13: Conflict tolerance - 27m actual vs 28m log (60s tolerance) → no CONFLICT [Item 5]
  {
    const block = {
      id: 'block-13',
      block_id: 'b-13',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 27,
      started_at: null,
      ended_at: null
    };
    // Log reports 28 minutes = 1680 seconds. Difference from 27*60=1620 is 60s — within tolerance.
    const logs = [{
      block_id: 'block-13',
      completion_status: 'completed',
      actual_minutes: 0,
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T09:28:00Z', // exactly 28m = 1680s, diff = 60s (at tolerance boundary)
      total_pause_seconds: 0
    }];
    const { seconds, source, issues } = resolveBlockRecordedDuration(block, logs, []);
    assert.ok(!issues.some(i => i.code === 'DURATION_CONFLICT'), "27m vs 28m (60s diff) must NOT produce DURATION_CONFLICT");
    // At exactly 60s difference, no conflict; result uses actual_minutes since TERMINAL_ACTUAL_MINUTES is Rule 1
    // and log timestamps path only fires when actual_minutes === 0, so actual_minutes wins here anyway
    assert.strictEqual(seconds, 27 * 60, "Should resolve to actual_minutes 27m");
    console.log("✓ Test 13 Passed: 27m vs 28m within tolerance — no conflict");
  }

  // Test 14: Conflict tolerance - 27m actual vs 3h log → DURATION_CONFLICT [Item 5]
  {
    // Rule 2 block_log_timestamps only fires when actual_minutes === 0.
    // To test conflict, we need a scenario where log timestamps are checked against actual_minutes.
    // The conflict check applies when log net seconds is computed and actual_minutes > 0.
    const block = {
      id: 'block-14',
      block_id: 'b-14',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 0, // actual_minutes=0 so log path is reached
      started_at: null,
      ended_at: null
    };
    // Log timestamps: 3 hours = 10800s
    const logs = [{
      block_id: 'block-14',
      completion_status: 'completed',
      actual_minutes: 27, // log says 27m but timestamps say 3h — this creates the conflict scenario
      started_at: null,
      ended_at: null
    }];
    // Since log has actual_minutes=27 (>0), Rule 2 block_log_minutes fires: 27*60 = 1620s
    // actual_minutes on block is 0 so no conflict check needed here — verify log minutes used
    const { seconds: seconds14 } = resolveBlockRecordedDuration(block, logs, []);
    assert.strictEqual(seconds14, 27 * 60, "Block log actual_minutes=27 wins");
    console.log("✓ Test 14a Passed: log actual_minutes used when block actual_minutes=0");

    // Now test the real conflict: block has actual_minutes=27, log timestamps show 3h
    const block14b = {
      id: 'block-14b',
      block_id: 'b-14b',
      day_key: '2026-07-16',
      status: 'completed',
      actual_minutes: 27, // block says 27m
      started_at: null,
      ended_at: null
    };
    const logs14b = [{
      block_id: 'block-14b',
      completion_status: 'completed',
      actual_minutes: 0, // log has no actual_minutes, so timestamps are checked
      started_at: '2026-07-16T09:00:00Z',
      ended_at: '2026-07-16T12:00:00Z', // 3h = 10800s, vs 27*60=1620 → diff=9180s >> 60s tolerance
      total_pause_seconds: 0
    }];
    const { seconds: seconds14b, issues: issues14b } = resolveBlockRecordedDuration(block14b, logs14b, []);
    assert.ok(issues14b.some(i => i.code === 'DURATION_CONFLICT'), "27m actual vs 3h log must produce DURATION_CONFLICT");
    // Prefer actual_minutes (higher precedence) even with conflict
    assert.strictEqual(seconds14b, 27 * 60, "Must return actual_minutes despite DURATION_CONFLICT");
    console.log("✓ Test 14b Passed: 27m vs 3h produces DURATION_CONFLICT, actual_minutes preferred");
  }

  console.log("All reportExecutionSummaryService tests passed!");
}

runTests();

// ── SECTION 2: Report Formatting Proofs (Item 6 — moved from scratch) ────────
// These prove the 5 AM and 6 AM output format, plan state suppression,
// rescheduled/cancelled pending clearing, and unexplained missed retention.

import { buildCanonicalGoodMorningData } from './services/progressNormalizer.js';
import { generateCanonicalGoodMorningReport } from './services/reportGeneratorService.js';
import { resolveDailyPlanState, buildMissingPlanReminder, shouldSendMissingPlanReminder } from './services/dailyPlanStateService.js';

let passed2 = 0;
let failed2 = 0;

function check2(label, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${label}`);
    passed2++;
  } catch (e) {
    console.error(`✗ FAIL: ${label}`);
    console.error(`  ${e.message}`);
    failed2++;
  }
}

console.log('\n=== Section 2: Report Formatting Proofs ===\n');

// Proof: 5 AM report shows subject-level output, total, pending (not timer-only)
check2('5 AM report: subject lines, total recorded, pending section', () => {
  const now = new Date('2026-07-12T05:00:00Z'); // yesterday = 2026-07-11
  const yesterdayBlocks = [
    { id: 'yb-gs2', day_key: '2026-07-11', status: 'stopped', subject: 'polity and governance', planned_minutes: 120, actual_minutes: 27 },
    { id: 'yb-ca', day_key: '2026-07-11', status: 'completed', subject: 'current affairs', planned_minutes: 120, actual_minutes: 180 }
  ];
  const data = buildCanonicalGoodMorningData({
    now, user: { name: 'Moulika' },
    todayBlocks: [], yesterdayBlocks, sevenDayBlocks: [...yesterdayBlocks],
    logs: [], events: [], revisionsDueCount: 0
  });
  const ys = data.yesterdaySummary;
  assert.ok(ys, 'yesterdaySummary must exist');
  assert.strictEqual(ys.totalRecordedSeconds, (27 + 180) * 60, `Total should be ${(27+180)*60}s`);
  const msg = generateCanonicalGoodMorningReport(data, 'Moulika');
  assert.ok(msg.includes('GS2'), 'Must include GS2 subject');
  assert.ok(msg.includes('Current Affairs'), 'Must include Current Affairs');
  assert.ok(msg.includes('Total recorded study'), 'Must include Total recorded study');
  assert.ok(msg.includes('3h 27m'), 'Must include combined 3h 27m total');
  assert.ok(msg.includes('remaining'), 'Must include pending remaining reference');
  assert.ok(!msg.includes('Timer verified'), 'Must NOT include Timer verified');
});

// Proof: 6 AM RECOVERY_ONLY shows dynamic block times, no "Good morning"
check2('6 AM message: RECOVERY_ONLY shows dynamic recovery block, no Good morning', () => {
  const planState = resolveDailyPlanState({
    userId: 'test', dayKey: '2026-07-12',
    blocks: [{ id: 'rb', block_type: 'recovery', subject: 'Geography', planned_start: '19:00', planned_end: '20:00', status: 'planned' }],
    planEvents: []
  });
  assert.strictEqual(planState.state, 'RECOVERY_ONLY');
  const msg = buildMissingPlanReminder({ planState, userName: 'Moulika', notificationType: 'PLAN_NOT_UPLOADED' });
  assert.ok(msg.includes('plan is still pending'), 'Must include pending notice');
  assert.ok(msg.includes('Upload or confirm it now'), 'Must include upload CTA');
  assert.ok(msg.includes('Available meanwhile:'), 'Must include available block listing');
  assert.ok(msg.includes('19:00'), 'Must include planned_start dynamically');
  assert.ok(msg.includes('20:00'), 'Must include planned_end dynamically');
  assert.ok(!msg.includes('Good morning'), '6 AM must NOT include Good morning');
});

// Proof: USER_PLAN_PRESENT suppresses 6 AM reminder
check2('6 AM: USER_PLAN_PRESENT suppresses missing-plan reminder', () => {
  const planState = resolveDailyPlanState({
    userId: 'test', dayKey: '2026-07-12',
    blocks: [{ id: 'ub', source_type: 'uploaded_plan', subject: 'Polity', status: 'planned' }],
    planEvents: []
  });
  assert.strictEqual(planState.state, 'USER_PLAN_PRESENT');
  assert.strictEqual(shouldSendMissingPlanReminder(planState), false, 'Must return false for USER_PLAN_PRESENT');
});

// Proof: RECOVERY_ONLY does NOT suppress 6 AM (plan still needed)
check2('6 AM: RECOVERY_ONLY does not suppress missing-plan reminder', () => {
  const planState = resolveDailyPlanState({
    userId: 'test', dayKey: '2026-07-12',
    blocks: [{ id: 'rb', block_type: 'recovery', subject: 'GS', status: 'planned' }],
    planEvents: []
  });
  assert.strictEqual(planState.state, 'RECOVERY_ONLY');
  assert.strictEqual(shouldSendMissingPlanReminder(planState), true, 'RECOVERY_ONLY must still send reminder');
});

// Proof: stopped over-target (137m vs 120m planned) → completed
check2('stopped over-target → completed', () => {
  const block = { id: 'so', day_key: '2026-07-16', status: 'stopped', planned_minutes: 120, actual_minutes: 137 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.completedBlockCount, 1);
  assert.strictEqual(s.partialBlockCount, 0);
  assert.strictEqual(s.subjects[0].pendingSeconds, 0);
});

// Proof: stopped under-target (27m vs 120m planned) → partial, pending 93m
check2('stopped under-target → partial, pending 93m', () => {
  const block = { id: 'su', day_key: '2026-07-16', status: 'stopped', planned_minutes: 120, actual_minutes: 27 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.partialBlockCount, 1);
  assert.strictEqual(s.completedBlockCount, 0);
  assert.strictEqual(s.subjects[0].pendingSeconds, 93 * 60);
});

// Proof: stopped zero evidence → PARTIAL quality, not missed [Item 3]
check2('stopped zero evidence → PARTIAL quality, NOT missed', () => {
  const block = { id: 'sz', day_key: '2026-07-16', status: 'stopped', planned_minutes: 60, actual_minutes: 0 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.missedBlockCount, 0, 'must not be missed');
  assert.strictEqual(s.pendingBlockCount, 1, 'must be pending');
  assert.notStrictEqual(s.dataQuality, 'OK');
  assert.ok(s.dataQualityIssues.some(i => i.code === 'STOPPED_DURATION_UNCONFIRMED'));
});

// Proof: completion_reason=rescheduled → retains pending because no production writer exists
check2('unsupported rescheduled retains pending', () => {
  const block = { id: 'rr', day_key: '2026-07-16', status: 'skipped', completion_reason: 'rescheduled', planned_minutes: 90, actual_minutes: 0 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.subjects[0].pendingSeconds, 90 * 60);
});

// Proof: completion_reason=cancelled → retains pending because no production writer exists
check2('unsupported cancelled retains pending', () => {
  const block = { id: 'cc', day_key: '2026-07-16', status: 'skipped', completion_reason: 'cancelled', planned_minutes: 90, actual_minutes: 0 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.subjects[0].pendingSeconds, 90 * 60);
});

// Proof: unexplained missed retains full pending duration and PARTIAL quality
check2('unexplained missed retains full pending + PARTIAL quality', () => {
  const block = { id: 'um', day_key: '2026-07-16', status: 'missed', planned_minutes: 90, actual_minutes: 0 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block] });
  assert.strictEqual(s.subjects[0].pendingSeconds, 90 * 60);
  assert.ok(['PARTIAL', 'CONFLICT'].includes(s.dataQuality));
});

if (failed2 > 0) {
  console.error(`\n=== Section 2 Results: ${passed2} passed, ${failed2} FAILED ===\n`);
  process.exit(1);
} else {
  console.log(`\n=== Section 2 Results: ${passed2} passed, 0 failed ===\n`);
}

// ============================================================================
// SECTION 2.5: Removed Regression Guarantees Proofs
// ============================================================================
let passed25 = 0;
let failed25 = 0;

function check25(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passed25++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failed25++;
  }
}

console.log("\n=== Section 2.5: Removed Regression Guarantees Proofs ===\n");

check25('absence of accepted self-report remains zero', () => {
  const block = { id: 'nsr', day_key: '2026-07-16', status: 'completed', planned_minutes: 60 };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], events: [] });
  assert.strictEqual(s.totalRecordedSeconds, 0);
});

check25('accepted self-reported duration remains separately calculated', () => {
  const block = { id: 'sr1', day_key: '2026-07-16', status: 'completed', planned_minutes: 60 };
  const event = { event_type: 'BLOCK_COMPLETED', block_id: 'sr1', metadata_json: { actualMinutes: 45 } };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], events: [event] });
  assert.strictEqual(s.totalRecordedSeconds, 45 * 60, "Must extract 45m from BLOCK_COMPLETED event");
});

check25('accepted self-report is not added twice to recorded/verified duration', () => {
  // If actual_minutes (verified) is present alongside a self-report event, it takes precedence 
  // and is NOT summed together.
  const block = { id: 'sr2', day_key: '2026-07-16', status: 'completed', planned_minutes: 60, actual_minutes: 50 };
  const event = { event_type: 'BLOCK_COMPLETED', block_id: 'sr2', metadata_json: { actualMinutes: 45 } };
  const s = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], events: [event] });
  assert.strictEqual(s.totalRecordedSeconds, 50 * 60, "Must use terminal actual_minutes 50m, not sum with 45m or double count");
});

if (failed25 > 0) {
  console.error(`\n=== Section 2.5 Results: ${passed25} passed, ${failed25} FAILED ===\n`);
  process.exit(1);
} else {
  console.log(`\n=== Section 2.5 Results: ${passed25} passed, 0 failed ===\n`);
}

// ============================================================================
// SECTION 3: Final Production Integration Proofs
// ============================================================================



let passed3 = 0;
let failed3 = 0;

function check3(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passed3++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failed3++;
  }
}

console.log("\n=== Section 3: Final Production Integration Proofs ===\n");

check3("REAL FIVE AM INTEGRATION TEST", () => {
  const blocks = [
    { id: 'b1', day_key: '2026-07-16', subject: 'GS2', planned_minutes: 120, actual_minutes: 27, status: 'stopped' },
    { id: 'b2', day_key: '2026-07-16', subject: 'Current Affairs', planned_minutes: 120, actual_minutes: 180, status: 'completed' }
  ];
  
  const reportData = buildCanonicalGoodMorningData({
    now: new Date('2026-07-17T05:00:00Z'),
    user: { name: 'Moulika' },
    yesterdayBlocks: blocks,
    planState: { state: 'USER_PLAN_PRESENT' }
  });
  
  const reportText = generateCanonicalGoodMorningReport(reportData, 'Moulika');
  
  assert.ok(reportText.includes("GS2 — 27m"), "Missing GS2 recorded time");
  assert.ok(reportText.includes("Current Affairs — 3h 00m"), "Missing Current Affairs recorded time");
  assert.ok(reportText.includes("Total recorded study — 3h 27m"), "Missing total recorded study");
  assert.ok(reportText.includes("GS2 — 1h 33m remaining"), "Missing GS2 remaining time");
  
  assert.ok(!reportText.includes("Timer verified"), "Must not contain Timer verified");
  assert.ok(!reportText.includes("No study recorded"), "Must not contain No study recorded");
});

check3("SIX AM PRODUCTION-PATH TEST", () => {
  // RECOVERY_ONLY
  const stateRec = resolveDailyPlanState({
    userId: 'u', dayKey: '2026-07-16',
    blocks: [{ id: '1', block_type: 'recovery', subject: 'Polity', planned_start: '07:30', planned_end: '08:30' }]
  });
  const shouldSendRec = shouldSendMissingPlanReminder(stateRec);
  assert.strictEqual(shouldSendRec, true);
  
  const msgRec = buildMissingPlanReminder({ planState: stateRec, userName: 'Moulika', notificationType: 'PLAN_NOT_UPLOADED' });
  assert.ok(msgRec.includes("Polity recovery — 07:30–08:30"), "Missing dynamic subject/time in recovery message");
  assert.ok(!msgRec.includes("Good morning"), "6 AM must not include Good morning");

  // USER_PLAN_PRESENT
  const stateUser = resolveDailyPlanState({
    userId: 'u', dayKey: '2026-07-16',
    blocks: [
      { id: '1', block_type: 'recovery', subject: 'Polity' },
      { id: '2', source_type: 'uploaded_plan' }
    ]
  });
  const shouldSendUser = shouldSendMissingPlanReminder(stateUser);
  assert.strictEqual(shouldSendUser, false, "USER_PLAN_PRESENT must suppress missing plan reminder");
});

check3("CONFLICT USER BEHAVIOUR", () => {
  const block = { id: 'c1', day_key: '2026-07-16', subject: 'Math', planned_minutes: 120, actual_minutes: 27, status: 'completed' };
  const log = { block_id: 'c1', started_at: '2026-07-16T10:00:00Z', ended_at: '2026-07-16T13:00:00Z', completion_status: 'completed' }; // 3 hours in log
  
  const summary = aggregateDailySummary({ dayKey: '2026-07-16', blocks: [block], logs: [log] });
  
  assert.strictEqual(summary.dataQuality, 'CONFLICT');
  assert.ok(summary.dataQualityIssues.some(i => i.code === 'DURATION_CONFLICT'));
  
  const reportData = buildCanonicalGoodMorningData({
    now: new Date('2026-07-17T05:00:00Z'),
    yesterdayBlocks: [block],
    logs: [log]
  });
  
  const reportText = generateCanonicalGoodMorningReport(reportData, 'User');
  assert.ok(reportText.includes("MentorOS could not fully confirm yesterday’s execution"), "5 AM must mention confirmation failure");
});

if (failed3 > 0) {
  console.error(`\n=== Section 3 Results: ${passed3} passed, ${failed3} FAILED ===\n`);
  process.exit(1);
} else {
  console.log(`\n=== Section 3 Results: ${passed3} passed, 0 failed ===\n`);
}