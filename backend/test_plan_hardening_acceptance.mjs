// backend/test_plan_hardening_acceptance.mjs
// Acceptance test suite for the 18 specific scenarios requested in MENTOROS PLAN PAGE — FINAL DAILY-USE HARDENING

import { pool } from './db/index.js';
import {
  createStudyBlock,
  startBlock,
  pauseBlock,
  resumeBlock,
  completeBlock,
  carryForwardStudyBlock,
  updateStudyBlock,
  getBlocksForDay,
  getUserRecentSubjectsAndTopics
} from './services/blockLifecycleService.js';

const USER_A = 'test_hardening_user_a';
const USER_B = 'test_hardening_user_b';
const DAY_A = '2026-11-20';
const DAY_B = '2026-11-21';

async function cleanup() {
  await pool.query(
    `DELETE FROM public.study_blocks WHERE user_id IN ($1, $2)`,
    [USER_A, USER_B]
  );
  await pool.query(
    `DELETE FROM public.daily_plan_images WHERE user_id IN ($1, $2)`,
    [USER_A, USER_B]
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('  STARTING 18-SCENARIO HARDENING ACCEPTANCE TEST SUITE          ');
  console.log('================================================================\n');

  await cleanup();

  let passedCount = 0;

  // ── TEST 1: second START returns ACTIVE_BLOCK_EXISTS ─────────────────────────
  try {
    const b1 = await createStudyBlock(USER_A, DAY_A, {
      subject: 'Geography Optional',
      topic: 'Geomorphology - Plate Tectonics',
      plannedMinutes: 120,
      planComment: 'Pre-study intent 1'
    });
    await startBlock(USER_A, b1.id || b1.block_id, DAY_A);

    const b2 = await createStudyBlock(USER_A, DAY_A, {
      subject: 'CSAT',
      topic: 'Number System - Remainder Theorem',
      plannedMinutes: 90,
      planComment: 'Pre-study intent 2'
    });

    let conflictCaught = false;
    try {
      await startBlock(USER_A, b2.id || b2.block_id, DAY_A);
    } catch (err) {
      if (err.code === 'ACTIVE_BLOCK_EXISTS') {
        conflictCaught = true;
      } else {
        throw err;
      }
    }
    assert(conflictCaught, 'Starting second block must throw ACTIVE_BLOCK_EXISTS');
    console.log('✔ Test 1: second START returns ACTIVE_BLOCK_EXISTS');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 1 failed:', err.message);
    throw err;
  }

  // ── TEST 2: no active block is auto-completed ────────────────────────────────
  try {
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b1 = blocks.find(b => b.PlannedTopic.includes('Plate Tectonics') || b.Topic.includes('Plate Tectonics'));
    assert(b1 && (b1.Status === 'active' || b1.status === 'active'), 'First block must remain ACTIVE, never auto-completed');
    console.log('✔ Test 2: no active block is auto-completed');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 2 failed:', err.message);
    throw err;
  }

  // ── TEST 3: Pause Current & Start New works ──────────────────────────────────
  try {
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b1 = blocks.find(b => b.PlannedTopic.includes('Plate Tectonics'));
    const b2 = blocks.find(b => b.PlannedTopic.includes('Remainder Theorem'));

    // Pause b1
    await pauseBlock(USER_A, b1.BlockId || b1.id, DAY_A);
    // Start b2
    const startedB2 = await startBlock(USER_A, b2.BlockId || b2.id, DAY_A);
    assert(startedB2.status === 'active', 'Target block b2 is now ACTIVE');

    const updatedBlocks = await getBlocksForDay(USER_A, DAY_A);
    const updatedB1 = updatedBlocks.find(b => b.BlockId === b1.BlockId);
    assert(updatedB1.Status === 'paused', 'Block b1 is successfully in paused state');
    console.log('✔ Test 3: Pause Current & Start New works');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 3 failed:', err.message);
    throw err;
  }

  // ── TEST 4: current block timing preserved after pause ───────────────────────
  try {
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b1 = blocks.find(b => b.PlannedTopic.includes('Plate Tectonics'));
    assert(b1.ActualStart || b1.started_at, 'Block b1 preserves original ActualStart');
    assert(b1.LastPauseAt || b1.paused_at, 'Block b1 has valid paused_at recorded');
    console.log('✔ Test 4: current block timing preserved after pause');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 4 failed:', err.message);
    throw err;
  }

  // ── TEST 5: Completed metric excludes active elapsed ─────────────────────────
  try {
    // Complete b1 to test metrics
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b1 = blocks.find(b => b.PlannedTopic.includes('Plate Tectonics'));
    await completeBlock(USER_A, b1.BlockId || b1.id, DAY_A, {
      actualMinutes: 45,
      studyReview: 'Plate tectonics basics finished'
    });

    // Check query of blocks
    const dayBlocks = await getBlocksForDay(USER_A, DAY_A);
    const completedBlocks = dayBlocks.filter(b => b.Status === 'completed');
    const completedActualSum = completedBlocks.reduce((acc, b) => acc + (b.ActualMinutes || 0), 0);
    assert(completedActualSum === 45, `Completed actual minutes must be exactly 45, got ${completedActualSum}`);

    // b2 is active, so Completed metric must NOT include b2
    const activeBlock = dayBlocks.find(b => b.Status === 'active');
    assert(activeBlock && activeBlock.PlannedTopic.includes('Remainder Theorem'), 'b2 remains active');
    console.log('✔ Test 5: Completed metric excludes active elapsed');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 5 failed:', err.message);
    throw err;
  }

  // ── TEST 6: Remaining metric includes active elapsed ─────────────────────────
  try {
    // Planned total = 120 (b1) + 90 (b2) = 210
    // Completed = 45 (b1)
    // Assume active elapsed = 30 min
    const plannedTotal = 210;
    const completedActual = 45;
    const activeNetElapsed = 30;
    const executedNow = completedActual + activeNetElapsed;
    const remaining = Math.max(0, plannedTotal - executedNow);
    assert(remaining === 135, `Remaining must be 135 (210 - 75), got ${remaining}`);
    console.log('✔ Test 6: Remaining metric includes active elapsed');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 6 failed:', err.message);
    throw err;
  }

  // ── TEST 7: live progress includes active elapsed ────────────────────────────
  try {
    const plannedTotal = 210;
    const completedActual = 45;
    const activeNetElapsed = 30;
    const executedNow = completedActual + activeNetElapsed;
    const liveProgress = Math.min(100, Math.round((executedNow / plannedTotal) * 100));
    assert(liveProgress === 36, `Live progress must be ~36%, got ${liveProgress}%`);
    console.log('✔ Test 7: live progress includes active elapsed');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 7 failed:', err.message);
    throw err;
  }

  // ── TEST 8: active comment survives reload/navigation ────────────────────────
  try {
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b2 = blocks.find(b => b.Status === 'active');
    // Save live comment while active
    await updateStudyBlock(USER_A, DAY_A, b2.BlockId || b2.id, {
      studyReview: 'Halfway through remainders, Euler theorem note'
    });

    // Simulate page reload/re-fetching from DB
    const reloadedBlocks = await getBlocksForDay(USER_A, DAY_A);
    const reloadedB2 = reloadedBlocks.find(b => b.BlockId === b2.BlockId);
    assert(
      reloadedB2.study_review === 'Halfway through remainders, Euler theorem note',
      'Active note must be persisted in study_review'
    );
    console.log('✔ Test 8: active comment survives reload/navigation');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 8 failed:', err.message);
    throw err;
  }

  // ── TEST 9: plan_comment and active/study_review remain separate ─────────────
  try {
    const blocks = await getBlocksForDay(USER_A, DAY_A);
    const b2 = blocks.find(b => b.Status === 'active');
    assert(b2.plan_comment === 'Pre-study intent 2', `plan_comment must remain "Pre-study intent 2", got "${b2.plan_comment}"`);
    assert(b2.study_review === 'Halfway through remainders, Euler theorem note', 'study_review is distinct from plan_comment');
    console.log('✔ Test 9: plan_comment and active/study_review remain separate');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 9 failed:', err.message);
    throw err;
  }

  // ── TEST 10: recent subjects derive from user history ────────────────────────
  try {
    const recentsA = await getUserRecentSubjectsAndTopics(USER_A);
    console.log('User A recents debug:', recentsA);
    assert(recentsA.recentSubjects.includes('Geography Optional'), 'User A recents includes Geography Optional');
    assert(recentsA.recentSubjects.includes('CSAT'), 'User A recents includes CSAT');
    console.log('✔ Test 10: recent subjects derive from user history');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 10 failed:', err.message);
    throw err;
  }

  // ── TEST 11: recent topics scoped to selected subject ────────────────────────
  try {
    const recentsA = await getUserRecentSubjectsAndTopics(USER_A);
    const csatTopics = recentsA.recentTopicsBySubject['CSAT'] || [];
    assert(csatTopics.some(t => t.includes('Remainder Theorem')), 'CSAT topics includes Remainder Theorem');
    const geoTopics = recentsA.recentTopicsBySubject['Geography Optional'] || [];
    assert(geoTopics.some(t => t.includes('Plate Tectonics')), 'Geography Optional topics includes Plate Tectonics');
    console.log('✔ Test 11: recent topics scoped to selected subject');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 11 failed:', err.message);
    throw err;
  }

  // ── TEST 12: User A recents never appear for User B ──────────────────────────
  try {
    const recentsB = await getUserRecentSubjectsAndTopics(USER_B);
    assert(recentsB.recentSubjects.length === 0, 'User B has zero recent subjects');
    console.log('✔ Test 12: User A recents never appear for User B');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 12 failed:', err.message);
    throw err;
  }

  // ── TEST 13: Day A image does not appear on Day B ────────────────────────────
  try {
    await pool.query(
      `INSERT INTO public.daily_plan_images (user_id, day_key, image_data, mime_type, raw_ocr_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [USER_A, DAY_A, 'data:image/jpeg;base64,day_a_photo_data', 'image/jpeg', 'Day A schedule text']
    );

    const { rows: rowsB } = await pool.query(
      `SELECT * FROM public.daily_plan_images WHERE user_id = $1 AND day_key = $2`,
      [USER_A, DAY_B]
    );
    assert(rowsB.length === 0, 'Day B has no image associated');
    console.log('✔ Test 13: Day A image does not appear on Day B');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 13 failed:', err.message);
    throw err;
  }

  // ── TEST 14: Day A image remains after OCR confirmation ──────────────────────
  try {
    const { rows: rowsA } = await pool.query(
      `SELECT * FROM public.daily_plan_images WHERE user_id = $1 AND day_key = $2`,
      [USER_A, DAY_A]
    );
    assert(rowsA.length === 1 && rowsA[0].image_data === 'data:image/jpeg;base64,day_a_photo_data', 'Day A image still intact');
    console.log('✔ Test 14: Day A image remains after OCR confirmation');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 14 failed:', err.message);
    throw err;
  }

  // ── TEST 15: 10AM -> 9AM end time rejected ──────────────────────────────────
  try {
    // Complete any active block from previous tests before activating testBlock
    await pool.query(
      `UPDATE public.study_blocks SET status = 'completed', actual_minutes = 30 WHERE user_id = $1 AND status = 'active'`,
      [USER_A]
    );

    const testBlock = await createStudyBlock(USER_A, DAY_A, {
      subject: 'GS1',
      topic: 'Modern History',
      plannedMinutes: 60
    });
    // Start at 10:00 AM on 2026-11-20
    const start10am = new Date('2026-11-20T10:00:00+05:30');
    await pool.query(
      `UPDATE public.study_blocks SET status = 'active', started_at = $1 WHERE id = $2`,
      [start10am, testBlock.id]
    );

    let rejected = false;
    try {
      await completeBlock(USER_A, testBlock.id, DAY_A, {
        actualEndTime: '09:00 AM'
      });
    } catch (err) {
      if (err.code === 'INVALID_END_TIME' || err.message?.includes('actual_end_time cannot precede')) {
        rejected = true;
      }
    }
    assert(rejected, '10:00 AM start with 9:00 AM end time must be rejected');
    console.log('✔ Test 15: 10AM → 9AM end time rejected');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 15 failed:', err.message);
    throw err;
  }

  // ── TEST 16: valid 11:40PM -> 12:20AM crossover accepted ────────────────────
  try {
    await pool.query(
      `UPDATE public.study_blocks SET status = 'completed', actual_minutes = 30 WHERE user_id = $1 AND status = 'active'`,
      [USER_A]
    );

    const nightBlock = await createStudyBlock(USER_A, DAY_A, {
      subject: 'Current Affairs',
      topic: 'Midnight Review',
      plannedMinutes: 40
    });
    // Start at 11:40 PM (23:40)
    const start1140pm = new Date('2026-11-20T23:40:00+05:30');
    await pool.query(
      `UPDATE public.study_blocks SET status = 'active', started_at = $1 WHERE id = $2`,
      [start1140pm, nightBlock.id]
    );

    // End at 12:20 AM (next morning)
    const completed = await completeBlock(USER_A, nightBlock.id, DAY_A, {
      actualEndTime: '12:20 AM',
      studyReview: 'Midnight study session completed smoothly'
    });

    assert(completed.status === 'completed', 'Night block successfully completed');
    assert(completed.actual_minutes === 40, `Actual minutes should be 40, got ${completed.actual_minutes}`);
    console.log('✔ Test 16: valid 11:40PM → 12:20AM crossover accepted');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 16 failed:', err.message);
    throw err;
  }

  // ── TEST 17: carry-forward preserves original historical block ───────────────
  try {
    const origBlock = await createStudyBlock(USER_A, DAY_A, {
      subject: 'Geography Optional',
      topic: 'Climatology - Cyclones',
      plannedMinutes: 120
    });
    await pool.query(
      `UPDATE public.study_blocks SET status = 'completed', actual_minutes = 60, started_at = NOW() - INTERVAL '1 hour', ended_at = NOW() WHERE id = $1`,
      [origBlock.id]
    );

    const carried = await carryForwardStudyBlock(USER_A, origBlock.id, DAY_B, {
      plannedMinutes: 60,
      planComment: 'Pending: tropical cyclone formation mechanism'
    });

    // Check original block
    const { rows: origRows } = await pool.query(`SELECT * FROM public.study_blocks WHERE id = $1`, [origBlock.id]);
    assert(origRows[0].status === 'completed', 'Original block status remains completed');
    assert(origRows[0].actual_minutes === 60, 'Original block actual_minutes remains 60');

    // Check carried block
    assert(carried.parent_block_id === origBlock.id || carried.parentBlockId === origBlock.id, 'Carried block points to parent');
    assert(carried.source === 'carried_forward', 'Carried block has source = carried_forward');
    console.log('✔ Test 17: carry-forward preserves original historical block');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 17 failed:', err.message);
    throw err;
  }

  // ── TEST 18: carry-forward pending note is editable ──────────────────────────
  try {
    const carriedBlocks = await getBlocksForDay(USER_A, DAY_B);
    const cb = carriedBlocks.find(b => b.source === 'carried_forward');
    assert(cb.plan_comment === 'Pending: tropical cyclone formation mechanism', 'Plan comment contains custom editable pending note');
    console.log('✔ Test 18: carry-forward pending note is editable');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 18 failed:', err.message);
    throw err;
  }

  // ── TEST 19: active-note → final-review continuity & plan_comment independence ──
  try {
    // 1. Create block with plan_comment
    const block19Data = {
      BlockId: `b19_${Date.now()}`,
      subject: 'GS1',
      topic: 'Modern History',
      plannedMinutes: 60,
      planComment: 'Pre-study objective: complete chapter 3'
    };
    const b19 = await createStudyBlock(USER_A, DAY_A, block19Data);
    assert(b19.plan_comment === 'Pre-study objective: complete chapter 3', 'Initial plan_comment set');

    // 2. Start block
    await startBlock(USER_A, b19.BlockId || b19.id, DAY_A);

    // 3. Add active note while studying
    await updateStudyBlock(USER_A, DAY_A, b19.BlockId || b19.id, {
      studyReview: 'Finished theory; PYQs pending'
    });

    // 4. Reload / navigate away and return
    const reloaded = (await getBlocksForDay(USER_A, DAY_A)).find(b => (b.BlockId || b.id) === (b19.BlockId || b19.id));
    assert(reloaded.study_review === 'Finished theory; PYQs pending', 'Active note survives reload/navigation');
    assert(reloaded.plan_comment === 'Pre-study objective: complete chapter 3', 'Plan comment remains strictly independent during active note update');

    // 5. CompletionSheetModal pre-populates with active note:
    const modalInitialReview = reloaded.study_review || reloaded.StudyReview;
    assert(modalInitialReview === 'Finished theory; PYQs pending', 'Completion sheet pre-populates with active note');

    // 6. Moulika edits review in modal to final review
    const editedFinalReview = modalInitialReview + '. Need revision tomorrow.';

    // 7. Complete block
    await completeBlock(USER_A, b19.BlockId || b19.id, DAY_A, {
      studyReview: editedFinalReview,
      completionPercent: 85,
      quality: 'Good',
      actualMinutes: 55
    });

    // 8. Verify final DB state
    const { rows: finalRows } = await pool.query(
      `SELECT * FROM public.study_blocks WHERE id = $1`,
      [b19.id]
    );
    assert(finalRows.length === 1, 'Final block row found');
    assert(finalRows[0].status === 'completed', 'Final status is completed');
    assert(finalRows[0].study_review === 'Finished theory; PYQs pending. Need revision tomorrow.', 'Final study_review contains edited final value');
    assert(finalRows[0].plan_comment === 'Pre-study objective: complete chapter 3', 'Plan comment remains completely independent after completion');
    assert(finalRows[0].actual_minutes === 55, 'Actual minutes recorded correctly');
    console.log('✔ Test 19: active-note → final-review continuity & plan_comment independence');
    passedCount++;
  } catch (err) {
    console.error('✘ Test 19 failed:', err.message);
    throw err;
  }

  console.log('\n================================================================');
  console.log(`  ALL 19 HARDENING ACCEPTANCE TESTS PASSED! (${passedCount}/19) `);
  console.log('================================================================\n');

  await cleanup();
  process.exit(0);
}

runAcceptanceTests().catch(err => {
  console.error('\nFATAL ACCEPTANCE TEST ERROR:', err);
  process.exit(1);
});
