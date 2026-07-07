/**
 * Unit test for skipped_rescue lifecycle transition logic.
 * Tests the assertTransition function in isolation — no DB required.
 *
 * Run: node backend/scripts/testRescueModeTransition.js
 */

// ── Replicate the exact logic from blockLifecycleService.js ──────────────────

const ALLOWED_FROM = {
  active:    new Set(['paused', 'completed', 'partial', 'missed', 'skipped']),
  paused:    new Set(['active', 'completed', 'partial', 'missed', 'skipped']),
  planned:   new Set(['active']),
  upcoming:  new Set(['active']),
  completed: new Set(),
  partial:   new Set(),
  missed:    new Set(),
  skipped:   new Set(),
};

function assertTransition(fromStatus, toStatus, targetRowDayKey) {
  if (fromStatus === 'skipped_rescue' && toStatus === 'active') {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (targetRowDayKey !== todayKey) {
      throw Object.assign(
        new Error('Invalid lifecycle transition: cannot start past skipped_rescue block'),
        { code: 'INVALID_TRANSITION', fromStatus, toStatus }
      );
    }
    return; // allowed
  }
  const allowed = ALLOWED_FROM[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw Object.assign(
      new Error(`Invalid lifecycle transition: ${fromStatus} → ${toStatus}`),
      { code: 'INVALID_TRANSITION', fromStatus, toStatus }
    );
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   → ${err.message}`);
    failed++;
  }
}

const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const pastKey  = '2023-01-01';

// Test 1: skipped_rescue on today → allowed
test('skipped_rescue today + startBlock => active (allowed)', () => {
  assertTransition('skipped_rescue', 'active', todayKey);
  // must not throw
});

// Test 2: completed block → rejected
test('completed block + startBlock => rejected', () => {
  let threw = false;
  try {
    assertTransition('completed', 'active', todayKey);
  } catch (err) {
    if (err.code === 'INVALID_TRANSITION') threw = true;
    else throw err;
  }
  if (!threw) throw new Error('Expected INVALID_TRANSITION but none was thrown');
});

// Test 3: past-date skipped_rescue → rejected
test('past-date skipped_rescue + startBlock => rejected', () => {
  let threw = false;
  try {
    assertTransition('skipped_rescue', 'active', pastKey);
  } catch (err) {
    if (err.code === 'INVALID_TRANSITION') threw = true;
    else throw err;
  }
  if (!threw) throw new Error('Expected INVALID_TRANSITION but none was thrown');
});

// Test 4: normal planned → active still works
test('planned today + startBlock => active (still works)', () => {
  assertTransition('planned', 'active', todayKey);
});

// Test 5: done (completed) block cannot be restarted at all
test('done block + startBlock => rejected (no date dependency)', () => {
  let threw = false;
  try {
    assertTransition('completed', 'active', todayKey);
  } catch (err) {
    if (err.code === 'INVALID_TRANSITION') threw = true;
    else throw err;
  }
  if (!threw) throw new Error('Expected INVALID_TRANSITION but none was thrown');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
