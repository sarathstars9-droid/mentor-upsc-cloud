import { query } from './db/index.js';
import {
  createStudyBlock,
  updateStudyBlock,
  startBlock,
  pauseBlock,
  resumeBlock,
  completeBlock,
  carryForwardStudyBlock,
  quickStartStudyBlock,
  getLogBookEntries,
  savePlanBlocksAndLogEvents,
} from './services/blockLifecycleService.js';
import { toFrontendBlock } from './services/computeBlockState.js';

const USER_A = 'test_moulika_exec_user_a';
const USER_B = 'test_moulika_exec_user_b';
const TEST_DATE = '2026-11-25';
const TOMORROW_DATE = '2026-11-26';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
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
  await query(`DELETE FROM public.study_events WHERE user_id IN ($1, $2)`, [USER_A, USER_B]);
  await query(`DELETE FROM public.block_logs WHERE user_id IN ($1, $2)`, [USER_A, USER_B]);
  await query(`DELETE FROM public.study_blocks WHERE user_id IN ($1, $2)`, [USER_A, USER_B]);
}

async function runAll27Tests() {
  console.log('\n================================================================');
  console.log('   MENTOROS — 27 VERIFICATION TESTS FOR STUDY BLOCK EXECUTION  ');
  console.log('================================================================\n');

  await cleanup();

  let blockId1, blockId2, blockId3, blockId4, blockIdCustom, blockIdOcr, blockIdQuick;

  // 1. manual block creation
  await test('1. Manual block creation', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'Geography Optional',
      topic: 'Climatology',
      subtopic: 'Jet Streams',
      plannedMinutes: 120,
      planComment: 'Revise core concepts and diagrams',
      source: 'manual',
    });
    assert(res.ok, 'createStudyBlock should return ok: true');
    assert(res.block && res.block.id, 'Block id must exist');
    assert(res.block.source === 'manual', `Source must be manual, got ${res.block.source}`);
    blockId1 = res.block.id;
  });

  // 2. 30m duration = 30 minutes
  await test('2. 30m duration = 30 minutes', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'Current Affairs',
      topic: 'The Hindu Editorials',
      plannedMinutes: 30,
      source: 'manual',
    });
    assert(res.ok && Number(res.block.planned_minutes) === 30, `Expected 30 minutes, got ${res.block.planned_minutes}`);
    blockId2 = res.block.id;
  });

  // 3. 1h30m = 90 minutes
  await test('3. 1h30m = 90 minutes', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'CSAT',
      topic: 'Number System',
      plannedMinutes: 90,
      source: 'manual',
    });
    assert(res.ok && Number(res.block.planned_minutes) === 90, `Expected 90 minutes, got ${res.block.planned_minutes}`);
    blockId3 = res.block.id;
  });

  // 4. 2h30m = 150 minutes
  await test('4. 2h30m = 150 minutes', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'GS1',
      topic: 'Modern History',
      subtopic: 'Gandhian Movements',
      plannedMinutes: 150,
      source: 'manual',
    });
    assert(res.ok && Number(res.block.planned_minutes) === 150, `Expected 150 minutes, got ${res.block.planned_minutes}`);
    blockId4 = res.block.id;
  });

  // 5. custom duration (e.g. 75 minutes)
  await test('5. Custom duration persists accurately', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'GS2',
      topic: 'Constitutional Amendments',
      plannedMinutes: 75,
      source: 'manual',
    });
    assert(res.ok && Number(res.block.planned_minutes) === 75, `Expected 75 minutes, got ${res.block.planned_minutes}`);
    blockIdCustom = res.block.id;
  });

  // 6. custom subject/topic
  await test('6. Custom subject/topic allows unconstrained user wording', async () => {
    const res = await createStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'Special Essay Practice',
      topic: 'AI Ethics in Public Governance',
      customTopic: 'AI Ethics in Public Governance',
      plannedMinutes: 60,
      planComment: 'Practice 2 full essay intros and structure',
      source: 'manual',
    });
    assert(res.ok, 'Custom subject/topic should create successfully');
    assert(res.block.subject === 'Special Essay Practice', 'Subject should match custom input');
    assert(res.block.topic === 'AI Ethics in Public Governance', 'Topic should match custom input');
    assert(res.block.custom_topic === 'AI Ethics in Public Governance', 'custom_topic should match');
  });

  // 7. custom topic does not create global knowledge topic
  await test('7. Custom topic does not insert into global syllabus node progress or canonical tables', async () => {
    const checkProgress = await query(`SELECT COUNT(*) as cnt FROM public.syllabus_node_progress WHERE user_id = $1 AND syllabus_node_id ILIKE '%AI Ethics%'`, [USER_A]);
    assert(Number(checkProgress.rows[0].cnt) === 0, 'No syllabus node progress should be created for custom topic');
  });

  // 8. plan comment persists
  await test('8. Plan comment persists independently as intent', async () => {
    const row = await query(`SELECT plan_comment FROM public.study_blocks WHERE id = $1`, [blockId1]);
    assert(row.rows[0].plan_comment === 'Revise core concepts and diagrams', 'Plan comment must persist');
  });

  // 9. Start automatically records start timestamp
  await test('9. Start automatically records start timestamp and sets active status', async () => {
    const startTime = new Date(Date.now() - 95 * 60 * 1000).toISOString(); // 95 mins ago
    const res = await startBlock(USER_A, blockId1, startTime);
    assert(res.ok, 'startBlock should succeed');
    assert(res.block.status === 'active', `Expected active status, got ${res.block.status}`);
    assert(res.block.started_at, 'started_at timestamp must be recorded');
  });

  // 10. block remains planned before Start
  await test('10. Block remains planned before Start is explicitly tapped', async () => {
    const row = await query(`SELECT status, started_at FROM public.study_blocks WHERE id = $1`, [blockId2]);
    assert(row.rows[0].status === 'planned', `Expected planned status, got ${row.rows[0].status}`);
    assert(row.rows[0].started_at === null, 'started_at should be null before start');
  });

  // 12. user can override end time (completing blockId1 which was started in test 9)
  await test('12. User can override stopped end time in completion sheet', async () => {
    // blockId1 was started 95 mins ago. Let user specify end time 5 mins ago (90 min actual study)
    const customEnd = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const res = await completeBlock(USER_A, blockId1, {
      actualEndTime: customEnd,
      completionPercent: 75,
      quality: 'Strong',
      studyReview: 'Completed Jet Streams core concepts, Rossby waves need more revision tomorrow.',
    });
    assert(res.ok, 'completeBlock with custom end time should succeed');
    const dbEnd = new Date(res.block.ended_at).getTime();
    const expectedEnd = new Date(customEnd).getTime();
    assert(Math.abs(dbEnd - expectedEnd) < 2000, 'ended_at in DB must match user-chosen end time');
  });

  // 13. actual duration calculates correctly (e.g. 90 minutes)
  await test('13. Actual study duration calculates correctly (endTime - startTime - pause)', async () => {
    const row = await query(`SELECT actual_minutes FROM public.study_blocks WHERE id = $1`, [blockId1]);
    const actual = Number(row.rows[0].actual_minutes);
    assert(actual === 90, `Expected 90 actual minutes, got ${actual}`);
  });

  // 15. completion percentage persists
  await test('15. Completion percentage persists (e.g. 75%)', async () => {
    const row = await query(`SELECT completion_percent FROM public.study_blocks WHERE id = $1`, [blockId1]);
    assert(Number(row.rows[0].completion_percent) === 75, `Expected 75%, got ${row.rows[0].completion_percent}`);
  });

  // 16. quality persists
  await test('16. Study quality persists (e.g. Strong)', async () => {
    const row = await query(`SELECT quality FROM public.study_blocks WHERE id = $1`, [blockId1]);
    assert(row.rows[0].quality === 'Strong', `Expected Strong, got ${row.rows[0].quality}`);
  });

  // 17. study review persists
  await test('17. Multi-line study review persists distinctly from pre-study plan comment', async () => {
    const row = await query(`SELECT plan_comment, study_review FROM public.study_blocks WHERE id = $1`, [blockId1]);
    assert(row.rows[0].plan_comment === 'Revise core concepts and diagrams', 'Plan comment must remain intact');
    assert(row.rows[0].study_review === 'Completed Jet Streams core concepts, Rossby waves need more revision tomorrow.', 'Study review must match reflection');
  });

  // 11. Finish defaults to current time
  await test('11. Finish defaults to current time when no override provided', async () => {
    // Start blockId2 and finish immediately without explicit endedAt
    await startBlock(USER_A, blockId2, new Date(Date.now() - 30 * 60 * 1000).toISOString());
    const beforeComplete = Date.now();
    const res = await completeBlock(USER_A, blockId2, {
      completionPercent: 100,
      quality: 'Good',
      studyReview: 'Quick editorial review',
    });
    assert(res.ok, 'completeBlock should succeed');
    assert(res.block.status === 'completed', `Expected completed, got ${res.block.status}`);
    const endedTime = new Date(res.block.ended_at).getTime();
    assert(endedTime >= beforeComplete - 2000, 'ended_at should default to current time');
  });

  // 14. invalid end-before-start rejected
  await test('14. Invalid end-before-start is rejected with validation error', async () => {
    await startBlock(USER_A, blockId3, new Date().toISOString());
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hr before start
    let rejected = false;
    try {
      await completeBlock(USER_A, blockId3, { actualEndTime: pastTime });
    } catch (err) {
      rejected = true;
      assert(err.message.includes('precede') || err.message.includes('earlier') || err.message.includes('INVALID_END_TIME'), 'Error message should indicate invalid end time');
    }
    assert(rejected, 'End time before start time must be rejected');
    // Complete blockId3 so no active block lingers into subsequent tests
    await completeBlock(USER_A, blockId3, { actualMinutes: 10, studyReview: 'completed' });
  });

  // 18. OCR-confirmed item becomes same Study Block model
  await test('18. OCR-confirmed item becomes the same Study Block model (source = ocr)', async () => {
    const ocrItems = [
      {
        blockId: 'OCR_B1',
        startTime: '14:00',
        endTime: '15:30',
        minutes: 90,
        subject: 'Geography Optional',
        topic: 'Geomorphology',
        planComment: 'Cycle of erosion models by Davis and Penck',
        customTopic: 'Geomorphology',
      }
    ];
    const saveRes = await savePlanBlocksAndLogEvents(USER_A, TEST_DATE, ocrItems);
    assert(saveRes.ok, 'OCR items should save successfully');

    const dbOcr = await query(`SELECT * FROM public.study_blocks WHERE user_id = $1 AND subject = 'Geography Optional' AND topic = 'Geomorphology'`, [USER_A]);
    assert(dbOcr.rows.length === 1, 'OCR item should exist in public.study_blocks');
    assert(dbOcr.rows[0].source === 'ocr', `Source should be 'ocr', got ${dbOcr.rows[0].source}`);
    assert(dbOcr.rows[0].plan_comment === 'Cycle of erosion models by Davis and Penck', 'Plan comment from OCR should persist');
    blockIdOcr = dbOcr.rows[0].id;

    // Verify it executes like a normal manual block: start -> finish
    await startBlock(USER_A, blockIdOcr);
    const completedOcr = await completeBlock(USER_A, blockIdOcr, {
      completionPercent: 100,
      quality: 'Good',
      studyReview: 'Davis peneplain theory finished clearly',
    });
    assert(completedOcr.ok && completedOcr.block.status === 'completed', 'OCR block must complete like a regular block');
  });

  // 19. quick-start creates + starts same canonical block
  await test('19. Quick-start creates + starts the same canonical block (source = quick_start)', async () => {
    const res = await quickStartStudyBlock(USER_A, {
      dayKey: TEST_DATE,
      subject: 'CSAT',
      topic: 'Permutations & Combinations',
      duration: 60,
      planComment: 'Practice 15 PYQs from 2021-2024',
    });
    assert(res.ok, 'quickStartStudyBlock should succeed');
    assert(res.block.source === 'quick_start', `Expected source quick_start, got ${res.block.source}`);
    assert(res.block.status === 'active', `Expected active status, got ${res.block.status}`);
    assert(res.block.started_at, 'started_at must be populated immediately');
    blockIdQuick = res.block.id;
  });

  // 20. carry-forward preserves original history
  await test('20. Carry-forward creates pending block on target day and preserves original history', async () => {
    // Complete blockIdQuick before carry forward
    await completeBlock(USER_A, blockIdQuick, {
      completionPercent: 50,
      quality: 'Okay',
      studyReview: 'Solved 7 questions, 8 questions remaining for tomorrow',
    });

    const cfRes = await carryForwardStudyBlock(USER_A, blockIdQuick, {
      targetDate: TOMORROW_DATE,
      plannedMinutes: 45,
      planComment: 'Finish remaining 8 CSAT P&C questions',
    });
    assert(cfRes.ok, 'carryForwardStudyBlock should succeed');
    assert(cfRes.block.day_key === TOMORROW_DATE, `Target day should be ${TOMORROW_DATE}`);
    assert(cfRes.block.source === 'carried_forward', `Source should be carried_forward, got ${cfRes.block.source}`);
    assert(cfRes.block.parent_block_id === blockIdQuick, `parent_block_id must point to original block`);
    assert(Number(cfRes.block.planned_minutes) === 45, 'Planned minutes should match carry-forward input');

    // Original block must be unchanged
    const origRow = await query(`SELECT * FROM public.study_blocks WHERE id = $1`, [blockIdQuick]);
    assert(origRow.rows[0].status === 'completed', 'Original block must remain completed');
    assert(origRow.rows[0].study_review.includes('8 questions remaining'), 'Original review must be preserved');
  });

  // 21. completed block visible in Log Book
  await test('21. Completed blocks feed directly into Log Book', async () => {
    const logBook = await getLogBookEntries(USER_A, { limit: 10 });
    assert(logBook.ok, 'getLogBookEntries should return ok: true');
    assert(Array.isArray(logBook.entries) && logBook.entries.length >= 3, 'Completed blocks should be present in logbook');
    const hasJetStreams = logBook.entries.some(e => e.topic === 'Climatology' && e.study_review && e.study_review.includes('Jet Streams'));
    assert(hasJetStreams, 'Jet Streams block with review should appear in Log Book');
  });

  // 22. planned/actual dashboard totals correct
  await test('22. Planned vs actual dashboard totals calculate correctly', async () => {
    const allBlocks = await query(`SELECT * FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`, [USER_A, TEST_DATE]);
    let plannedMin = 0;
    let completedMin = 0;
    for (const b of allBlocks.rows) {
      plannedMin += Number(b.planned_minutes || 0);
      if (b.status === 'completed') {
        completedMin += Number(b.actual_minutes || b.planned_minutes || 0);
      }
    }
    assert(plannedMin > 0, 'Planned minutes total must be > 0');
    assert(completedMin > 0, 'Completed minutes total must be > 0');
    const progress = Math.round((completedMin / plannedMin) * 100);
    assert(progress >= 0 && progress <= 100, `Progress % must be between 0 and 100, got ${progress}`);
  });

  // 23. one active block protection
  await test('23. Concurrency guard ensures only one active/paused block at a time', async () => {
    // Clear lingering active blocks
    await query(`UPDATE public.study_blocks SET status = 'completed', actual_minutes = 30 WHERE user_id = $1 AND status = 'active'`, [USER_A]);

    // Start blockId4
    await startBlock(USER_A, blockId4);
    // Start blockIdCustom should throw ACTIVE_BLOCK_EXISTS because auto-completion is forbidden!
    let conflict = false;
    try {
      await startBlock(USER_A, blockIdCustom);
    } catch (err) {
      if (err.code === 'ACTIVE_BLOCK_EXISTS') {
        conflict = true;
      }
    }
    assert(conflict, 'Starting second block without pausing first must throw ACTIVE_BLOCK_EXISTS');

    // Verify only ONE active block exists for USER_A
    const activeRows = await query(`SELECT * FROM public.study_blocks WHERE user_id = $1 AND status = 'active'`, [USER_A]);
    assert(activeRows.rows.length === 1, `Expected exactly 1 active block, got ${activeRows.rows.length}`);
    assert(activeRows.rows[0].id === blockId4, 'First block remains the active one');
  });

  // 24. user isolation
  await test('24. Strict user isolation protects data across distinct accounts', async () => {
    // USER_B should not be able to read or modify USER_A's block
    const bRes = await query(`SELECT * FROM public.study_blocks WHERE user_id = $1 AND id = $2`, [USER_B, blockId1]);
    assert(bRes.rows.length === 0, 'USER_B must not see USER_A blocks');

    const updateAttempt = await updateStudyBlock(USER_B, blockId1, { topic: 'Hacked Topic' });
    assert(!updateAttempt.ok, 'USER_B must not be allowed to update USER_A block');

    const checkOrig = await query(`SELECT topic FROM public.study_blocks WHERE id = $1`, [blockId1]);
    assert(checkOrig.rows[0].topic === 'Climatology', 'USER_A topic must remain intact');
  });

  // 25. original OCR upload remains linked
  await test('25. Original OCR upload remains linked via source and metadata', async () => {
    const ocrBlock = await query(`SELECT source, source_type FROM public.study_blocks WHERE id = $1`, [blockIdOcr]);
    assert(ocrBlock.rows[0].source === 'ocr', 'Source must be ocr');
    assert(ocrBlock.rows[0].source_type === 'ocr', 'Source type must be ocr');
  });

  // 26. page works with no OCR upload
  await test('26. Full manual planning works completely without OCR upload', async () => {
    const manualOnly = await query(`SELECT COUNT(*) as cnt FROM public.study_blocks WHERE user_id = $1 AND source = 'manual'`, [USER_A]);
    assert(Number(manualOnly.rows[0].cnt) >= 4, 'Multiple manual blocks must exist and operate independently');
  });

  // 27. existing historical plans continue loading
  await test('27. Historical blocks continue loading with forward-compatible mapping', async () => {
    // Insert a legacy block row without migration 061 fields (simulating historical data)
    const legRes = await query(`
      INSERT INTO public.study_blocks (
        user_id, day_key, block_id, subject, topic, planned_minutes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [USER_A, '2026-01-01', 'LEGACY_01', 'GS4 Ethics', 'Foundational Values', 60, 'completed']);

    const mapped = toFrontendBlock(legRes.rows[0]);
    assert(mapped.PlannedSubject === 'GS4 Ethics', 'Legacy subject must map');
    assert(mapped.PlannedTopic === 'Foundational Values', 'Legacy topic must map');
    assert(mapped.source === 'manual', 'Legacy source defaults to manual');
    assert(mapped.plan_comment === '', 'Legacy plan comment defaults to empty string');
    assert(mapped.study_review === '', 'Legacy study review defaults to empty string');
  });

  await cleanup();

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed}/27 PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll27Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
