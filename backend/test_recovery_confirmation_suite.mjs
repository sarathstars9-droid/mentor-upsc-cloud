import { query } from './db/index.js';
import { confirmRecoveredBlock } from './services/blockLifecycleService.js';
import { toFrontendBlock } from './services/computeBlockState.js';
import { sumActualMinutes, sumVerifiedActualMinutes, sumProvisionalMinutes } from '../src/utils/studyEngine.js';

const TEST_USER_A = 'test_fixture_recovery_user_a';
const TEST_USER_B = 'test_fixture_recovery_user_b';
const TEST_DATE = '2026-11-26';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✘ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function cleanup() {
  await query(`DELETE FROM public.study_events WHERE user_id IN ($1, $2)`, [TEST_USER_A, TEST_USER_B]);
  await query(`DELETE FROM public.block_logs WHERE user_id IN ($1, $2)`, [TEST_USER_A, TEST_USER_B]);
  await query(`DELETE FROM public.study_blocks WHERE user_id IN ($1, $2)`, [TEST_USER_A, TEST_USER_B]);
}

async function runRecoveryConfirmationSuite() {
  console.log('\n================================================================');
  console.log('   MENTOROS — RECOVERY CONFIRMATION & TERMINAL STATUS SUITE    ');
  console.log('================================================================\n');

  // Ensure DB columns exist
  await query(`
    ALTER TABLE public.study_blocks
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS schedule_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completion_source TEXT,
    ADD COLUMN IF NOT EXISTS completed_by TEXT;
  `);

  await cleanup();

  let fixtureBlock1UUID;
  let fixtureBlock2UUID;
  const fixtureBlock1Id = 'block_rec_fixture_1';
  const fixtureBlock2Id = 'block_rec_fixture_2';

  // 1. Setup isolated recovered fixture matching Nov 26 recovery state
  await test('1. Isolated fixture starting state (exact Nov 26 recovery format)', async () => {
    const res = await query(
      `INSERT INTO public.study_blocks (
        user_id, block_id, day_key, subject, topic, subtopic, planned_minutes,
        actual_minutes, status, completion_reason, is_provisional,
        completed_at, created_at
      ) VALUES (
        $1, $2, $3, 'Geography Optional', 'Geomorphology', 'Continental Drift',
        120, 120, 'completed', 'stale_session_recovered', TRUE,
        NULL, NOW()
      ) RETURNING id, block_id`,
      [TEST_USER_A, fixtureBlock1Id, TEST_DATE]
    );

    assert(res.rows && res.rows.length === 1, 'Failed to insert isolated fixture block');
    fixtureBlock1UUID = res.rows[0].id;

    // Verify no block_logs exist initially
    const logRes = await query(
      `SELECT COUNT(*)::int AS count FROM public.block_logs WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER_A, fixtureBlock1UUID]
    );
    assert(logRes.rows[0].count === 0, 'Initial block_logs count must be 0');
  });

  // 2. Compute state recognizes provisional recovered block
  await test('2. computeBlockState flags provisional recovered session accurately', async () => {
    const bRes = await query(`SELECT * FROM public.study_blocks WHERE id = $1`, [fixtureBlock1UUID]);
    const row = bRes.rows[0];
    const feBlock = toFrontendBlock(row);

    assert(feBlock.Status === 'completed', `Expected completed status, got ${feBlock.Status}`);
    assert(feBlock.IsCompleted === true, 'IsCompleted must be true');
    assert(feBlock.Reason === 'stale_session_recovered', 'Reason must be stale_session_recovered');
    assert(feBlock.IsProvisional === true, 'IsProvisional must be true for unconfirmed recovered session');
    assert(feBlock.IsUserConfirmed === false, 'IsUserConfirmed must be false initially');
    assert(feBlock.ActualMinutes === 120, `ActualMinutes must be 120, got ${feBlock.ActualMinutes}`);
  });

  // 3. Study metrics exclude provisional duration from verified study time
  await test('3. Study metrics exclude provisional recovery time from verified minutes', async () => {
    const bRes = await query(`SELECT * FROM public.study_blocks WHERE id = $1`, [fixtureBlock1UUID]);
    const feBlock = toFrontendBlock(bRes.rows[0]);
    const blocks = [feBlock];

    const verifiedMins = sumVerifiedActualMinutes(blocks);
    const provisionalMins = sumProvisionalMinutes(blocks);
    const totalWithoutProvisional = sumActualMinutes(blocks, true);
    const totalWithProvisional = sumActualMinutes(blocks, false);

    assert(verifiedMins === 0, `Verified minutes must be 0, got ${verifiedMins}`);
    assert(provisionalMins === 120, `Provisional minutes must be 120, got ${provisionalMins}`);
    assert(totalWithoutProvisional === 0, `Total without provisional must be 0, got ${totalWithoutProvisional}`);
    assert(totalWithProvisional === 120, `Total with provisional must be 120, got ${totalWithProvisional}`);
  });

  // 4. Confirm duration keeping 120m (idempotent, records provenance, generates exactly 1 block_log)
  await test('4. Confirm duration keeping 120m (creates 1 block_log, records user confirmation provenance)', async () => {
    const confirmRes = await confirmRecoveredBlock(TEST_USER_A, fixtureBlock1Id, {
      actualMinutes: 120,
      studyReview: 'Revised continental drift theory and paleomagnetic evidence thoroughly.',
      quality: 'GOOD',
      completionPercent: 100
    });

    assert(confirmRes.ok === true, 'confirmRecoveredBlock should return ok: true');
    assert(confirmRes.is_provisional === false || confirmRes.IsProvisional === false, 'is_provisional must become false');
    assert(confirmRes.completion_source === 'user_confirmed' || confirmRes.confirmationProvenance === 'user_confirmed', 'completion_source must be user_confirmed');
    assert(confirmRes.completion_reason === 'stale_session_recovered' || confirmRes.Reason === 'stale_session_recovered', 'completion_reason must be preserved');
    assert(confirmRes.completed_at !== null || confirmRes.confirmedAt !== null, 'completed_at must be populated');
    const actualMins = confirmRes.ActualMinutes ?? confirmRes.actual_minutes;
    assert(actualMins === 120, `actual_minutes must remain 120, got ${actualMins}`);

    // Verify exactly 1 row in block_logs
    const logRes = await query(
      `SELECT * FROM public.block_logs WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER_A, fixtureBlock1UUID]
    );
    assert(logRes.rows.length === 1, `Expected exactly 1 block_log, got ${logRes.rows.length}`);
    assert(logRes.rows[0].actual_minutes === 120, 'block_logs actual_minutes must be 120');

    // Verify RECOVERY_CONFIRMED event logged
    const evtRes = await query(
      `SELECT * FROM public.study_events WHERE user_id = $1 AND block_id = $2 AND event_type = 'RECOVERY_CONFIRMED'`,
      [TEST_USER_A, fixtureBlock1UUID]
    );
    assert(evtRes.rows.length === 1, 'Expected 1 RECOVERY_CONFIRMED event');

    // Verify metrics now reflect verified time
    const bRes = await query(`SELECT * FROM public.study_blocks WHERE id = $1`, [fixtureBlock1UUID]);
    const feBlock = toFrontendBlock(bRes.rows[0]);
    const verifiedMins = sumVerifiedActualMinutes([feBlock]);
    const provisionalMins = sumProvisionalMinutes([feBlock]);
    assert(verifiedMins === 120, `Verified minutes must now be 120, got ${verifiedMins}`);
    assert(provisionalMins === 0, `Provisional minutes must now be 0, got ${provisionalMins}`);
  });

  // 5. Correct duration (e.g. adjust to 90m) on a second recovered session fixture
  await test('5. Correct duration: adjust recovered time from 120m to 90m', async () => {
    const insertRes = await query(
      `INSERT INTO public.study_blocks (
        user_id, block_id, day_key, subject, topic, subtopic, planned_minutes,
        actual_minutes, status, completion_reason, is_provisional,
        completed_at, created_at
      ) VALUES (
        $1, $2, $3, 'Polity', 'Parliament', 'Budget Procedures',
        120, 120, 'completed', 'stale_session_recovered', TRUE,
        NULL, NOW()
      ) RETURNING id, block_id`,
      [TEST_USER_A, fixtureBlock2Id, TEST_DATE]
    );
    fixtureBlock2UUID = insertRes.rows[0].id;

    const confirmRes = await confirmRecoveredBlock(TEST_USER_A, fixtureBlock2Id, {
      actualMinutes: 90,
      studyReview: 'Spent 90 minutes; took a 30m break in between.',
      quality: 'EXCELLENT',
      completionPercent: 90
    });

    assert(confirmRes.ok === true, 'confirmRecoveredBlock should return ok: true');
    const actualMins = confirmRes.ActualMinutes ?? confirmRes.actual_minutes;
    assert(actualMins === 90, `actual_minutes must be 90, got ${actualMins}`);
    assert(confirmRes.IsProvisional === false || confirmRes.is_provisional === false, 'is_provisional must be false');

    const logRes = await query(
      `SELECT * FROM public.block_logs WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER_A, fixtureBlock2UUID]
    );
    assert(logRes.rows.length === 1, `Expected 1 block_log, got ${logRes.rows.length}`);
    assert(logRes.rows[0].actual_minutes === 90, `block_logs actual_minutes must be 90, got ${logRes.rows[0].actual_minutes}`);

    const bRes = await query(`SELECT * FROM public.study_blocks WHERE id = $1`, [fixtureBlock2UUID]);
    const feBlock = toFrontendBlock(bRes.rows[0]);
    assert(sumVerifiedActualMinutes([feBlock]) === 90, 'Verified minutes should be 90');
    assert(sumProvisionalMinutes([feBlock]) === 0, 'Provisional minutes should be 0');
  });

  // 6. Idempotency & network retry safety
  await test('6. Idempotent confirmation: multiple retries produce exactly 1 log and no duplicate minutes', async () => {
    // Call 3 times consecutively
    const res1 = await confirmRecoveredBlock(TEST_USER_A, fixtureBlock2Id, { actualMinutes: 90, quality: 'EXCELLENT' });
    const res2 = await confirmRecoveredBlock(TEST_USER_A, fixtureBlock2Id, { actualMinutes: 90, quality: 'EXCELLENT' });
    const res3 = await confirmRecoveredBlock(TEST_USER_A, fixtureBlock2Id, { actualMinutes: 90, quality: 'EXCELLENT' });

    assert(res1.ok && res2.ok && res3.ok, 'All retries must return ok');

    const logRes = await query(
      `SELECT COUNT(*)::int AS count FROM public.block_logs WHERE user_id = $1 AND block_id = $2`,
      [TEST_USER_A, fixtureBlock2UUID]
    );
    assert(logRes.rows[0].count === 1, `Expected strictly 1 block_log after retries, got ${logRes.rows[0].count}`);

    const bRes = await query(`SELECT actual_minutes FROM public.study_blocks WHERE id = $1`, [fixtureBlock2UUID]);
    assert(bRes.rows[0].actual_minutes === 90, 'actual_minutes must remain 90');
  });

  // 7. Strict user isolation: other user cannot confirm or access User A blocks
  await test('7. User isolation: User B cannot confirm or access User A blocks', async () => {
    let rejected = false;
    try {
      await confirmRecoveredBlock(TEST_USER_B, fixtureBlock1Id, {
        actualMinutes: 300,
        quality: 'POOR'
      });
    } catch (err) {
      rejected = true;
      assert(err.code === 'NOT_FOUND' || err.status === 404, `Expected NOT_FOUND error, got ${err.code}`);
    }

    assert(rejected, 'Malicious confirmation across users must be rejected with 404 / NOT_FOUND');

    // Verify block1 on User A was NOT modified
    const bRes = await query(`SELECT user_id, actual_minutes FROM public.study_blocks WHERE id = $1`, [fixtureBlock1UUID]);
    assert(bRes.rows[0].user_id === TEST_USER_A, 'user_id must be uncorrupted');
    assert(bRes.rows[0].actual_minutes === 120, 'actual_minutes must remain 120');
  });

  // 8. Terminal status accuracy: missed, skipped, partial, carried_forward
  await test('8. Terminal status accuracy: missed and skipped do not count as completed or inflate minutes', async () => {
    const insertRes = await query(
      `INSERT INTO public.study_blocks (
        user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status
      ) VALUES 
        ($1, 'block_term_missed', $2, 'Polity', 'Judiciary', 60, 0, 'missed'),
        ($1, 'block_term_skipped', $2, 'History', 'Modern India', 60, 0, 'skipped'),
        ($1, 'block_term_partial', $2, 'Economy', 'Monetary Policy', 60, 35, 'partial'),
        ($1, 'block_term_carried', $2, 'Environment', 'Biodiversity', 60, 0, 'carried_forward')
      RETURNING id, block_id, status, actual_minutes`,
      [TEST_USER_A, TEST_DATE]
    );

    assert(insertRes.rows.length === 4, 'Should insert 4 terminal test blocks');

    const blocksRes = await query(
      `SELECT * FROM public.study_blocks WHERE user_id = $1 AND block_id IN ('block_term_missed', 'block_term_skipped', 'block_term_partial', 'block_term_carried')`,
      [TEST_USER_A]
    );

    const feBlocks = blocksRes.rows.map(toFrontendBlock);

    const missed = feBlocks.find(b => b.PlannedTopic === 'Judiciary');
    const skipped = feBlocks.find(b => b.PlannedTopic === 'Modern India');
    const partial = feBlocks.find(b => b.PlannedTopic === 'Monetary Policy');
    const carried = feBlocks.find(b => b.PlannedTopic === 'Biodiversity');

    // Terminal flags check
    assert(missed.Status === 'missed' && missed.IsCompleted === false && missed.IsMissed === true, 'Missed block must not be IsCompleted');
    assert(skipped.Status === 'skipped' && skipped.IsCompleted === false && skipped.IsSkipped === true, 'Skipped block must not be IsCompleted');
    assert(partial.Status === 'partial' && partial.IsCompleted === false && partial.IsPartial === true, 'Partial block must not be IsCompleted');
    assert(carried.Status === 'carried_forward' && carried.IsCompleted === false && carried.IsCarriedForward === true, 'Carried block must not be IsCompleted');

    // Metrics check across these 4 blocks
    const completedBlocks = feBlocks.filter(b => b.IsCompleted);
    assert(completedBlocks.length === 0, `Completed blocks count must be 0, got ${completedBlocks.length}`);

    // Missed and skipped minutes must be 0
    assert(sumVerifiedActualMinutes([missed]) === 0, 'Missed block verified minutes must be 0');
    assert(sumVerifiedActualMinutes([skipped]) === 0, 'Skipped block verified minutes must be 0');
    assert(sumVerifiedActualMinutes([carried]) === 0, 'Carried forward verified minutes must be 0');
    assert(sumVerifiedActualMinutes([partial]) === 35, `Partial block verified minutes must equal actual (35m), got ${sumVerifiedActualMinutes([partial])}`);
  });

  // 9. Safety audit: verify real user Moulika records remain completely untouched
  await test('9. Safety verification: Real user records and Nov 26 recovered block remain pristine', async () => {
    const realBlockRes = await query(
      `SELECT id, user_id, day_key, subject, planned_minutes, actual_minutes, status, completion_reason, is_provisional, completed_at
       FROM public.study_blocks
       WHERE id = 'c66eb034-eb49-4f2d-afca-07849072a976'`
    );

    assert(realBlockRes.rows.length === 1, 'Real recovered block must exist');
    const rb = realBlockRes.rows[0];
    assert(rb.actual_minutes === 120, `Real block actual_minutes must be 120, got ${rb.actual_minutes}`);
    assert(rb.status === 'completed', `Real block status must be completed, got ${rb.status}`);
    assert(rb.completion_reason === 'stale_session_recovered', `Real block reason must be stale_session_recovered, got ${rb.completion_reason}`);
    assert(rb.completed_at === null, `Real block completed_at must be NULL (unconfirmed), got ${rb.completed_at}`);

    // Ensure zero test logs exist for real users
    const realLogRes = await query(
      `SELECT COUNT(*)::int AS count FROM public.block_logs WHERE block_id = 'c66eb034-eb49-4f2d-afca-07849072a976'`
    );
    assert(realLogRes.rows[0].count === 0, 'Real block must have 0 block_logs entries');
  });

  // Clean up isolated test users
  await cleanup();

  console.log('\n================================================================');
  console.log(`RECOVERY CONFIRMATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRecoveryConfirmationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
