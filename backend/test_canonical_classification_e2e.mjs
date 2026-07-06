// backend/test_canonical_classification_e2e.mjs
import { query } from './db/index.js';
import { getDailyExecutionSummary } from './services/dailyExecutionSummaryService.js';
import { generateNightMentorReviewMessage, generateMorningRecallMessage } from './services/mentorReviewService.js';
import { getWeeklyExecutionSummary, getMondayOfCurrentWeek } from './services/progressService.js';
import { formatSubjectTopic, getBlockState } from './services/computeBlockState.js';
import { generateGoodMorningReport } from './services/reportGeneratorService.js';

const TEST_USER = 'moulika_e2e_test';

async function cleanup() {
  console.log(`[TEST SETUP] Cleaning up test data for: ${TEST_USER}`);
  await query(`DELETE FROM public.daily_mentor_reviews WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.subject_targets WHERE user_id = $1`, [TEST_USER]);
}

async function runAllTests() {
  try {
    await cleanup();

    // Ensure the test user exists
    await query(
      `INSERT INTO public.users (id, name, mission_health_state) VALUES ($1, $2, 'AT_RISK') ON CONFLICT (id) DO NOTHING`,
      [TEST_USER, 'Moulika Test E2E']
    );

    // Seed default subject targets for testing weekly report
    await query(`
      INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
      VALUES 
        ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15'),
        ($1, 'CSAT', 450, '2026-05-25', '2027-04-15'),
        ($1, 'GS4 Ethics', 325, '2026-05-25', '2027-04-15'),
        ($1, 'GS1', 250, '2026-05-25', '2027-04-15'),
        ($1, 'Current Affairs', 175, '2026-05-25', '2027-04-15')
    `, [TEST_USER]);

    console.log('\n==================================================');
    console.log('🤖 Test 1: Completed GS-4 must not appear as missed');
    console.log('==================================================');

    // B1: GS-4 completed with 2h25m actual (145 mins)
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, started_at, ended_at, planned_end)
      VALUES ($1, 'B1', '2026-07-06', 'GS4 Ethics', 'GS4 Ethics', 180, 145, 'completed', '2026-07-06 09:00:00+05:30', '2026-07-06 11:30:00+05:30', '12:00')
    `, [TEST_USER]);

    let summary = await getDailyExecutionSummary(TEST_USER, '2026-07-06');
    let review = await generateNightMentorReviewMessage(TEST_USER, '2026-07-06');
    console.log('Review achievements:\n', review.achievementsJson);
    console.log('Review misses:\n', review.missesJson);

    if (!summary.subjectsCompleted.includes('GS4 Ethics')) throw new Error('GS4 Ethics should be in completed subjects');
    if (review.missesJson.subjects_postponed.includes('GS4 Ethics')) throw new Error('GS4 Ethics should not be postponed');
    if (review.missesJson.blocks_missed !== 0) throw new Error('Missed blocks count should be 0');

    console.log('✅ Test 1: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 2: Missed list and postponed list consistency');
    console.log('==================================================');

    // GS-1 missed, Current Affairs missed, GS-4 completed
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, planned_end)
      VALUES 
        ($1, 'B1', '2026-07-06', 'GS1', 'Art & Culture', 60, 0, 'missed', '10:00'),
        ($1, 'B2', '2026-07-06', 'Current Affairs', 'Polity news', 60, 0, 'missed', '11:00'),
        ($1, 'B3', '2026-07-06', 'GS4 Ethics', 'Ethics case studies', 120, 120, 'completed', '14:00')
    `, [TEST_USER]);

    summary = await getDailyExecutionSummary(TEST_USER, '2026-07-06');
    review = await generateNightMentorReviewMessage(TEST_USER, '2026-07-06');
    
    console.log('Postponed subjects:', review.missesJson.subjects_postponed);
    console.log('Missed details subjects:', review.missesJson.missed_details.map(m => m.subject));

    if (review.missesJson.subjects_postponed.length !== 2) throw new Error('Should have exactly 2 postponed subjects');
    if (!review.missesJson.subjects_postponed.includes('GS1') || !review.missesJson.subjects_postponed.includes('Current Affairs')) {
      throw new Error('Postponed subjects should be GS1 and Current Affairs');
    }
    if (review.missesJson.subjects_postponed.includes('GS4 Ethics')) throw new Error('GS4 Ethics should not be postponed');

    console.log('✅ Test 2: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 3: Plan received recall without missed tasks');
    console.log('==================================================');

    // Clean reviews to force recall generation for Test 3
    await query(`DELETE FROM public.daily_mentor_reviews WHERE user_id = $1`, [TEST_USER]);

    // Seed a yesterday review with no misses
    await query(`
      INSERT INTO public.daily_mentor_reviews (
        user_id, date, achievements_json, misses_json, mentor_observation, recommended_first_block, reflection_question
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      TEST_USER, 
      '2026-07-05', 
      JSON.stringify({
        completed_details: [{ subject: 'GS4 Ethics', topic: 'Case Studies' }]
      }),
      JSON.stringify({
        missed_details: [],
        subjects_postponed: []
      }),
      'Good work.',
      'Polity',
      'Why?'
    ]);

    const recall = await generateMorningRecallMessage(TEST_USER, '2026-07-06');
    console.log('Recall Text:\n', recall);

    if (recall.includes('repair that gap')) throw new Error('Should not say "repair that gap"');
    if (!recall.includes('No missed tasks yesterday. Start today with your first planned priority: Polity.')) {
      throw new Error('Correct priority message missing');
    }

    console.log('✅ Test 3: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 4: Good morning report zero-study streak label');
    console.log('==================================================');

    // Scenario A: Actual progress > 0
    const morningReportA = generateGoodMorningReport({
      mission_health_state: 'AT_RISK',
      consecutive_zero_study_days: 14,
      completed_hours: 0.8, // 48 mins
      expected_hours_till_today: 100,
      backlog_hours: 20,
      adaptive_target_hours: 2,
      yesterday_summary: { has_data: false }
    }, 'Moulika');
    console.log('Morning Report A (progress > 0):\n', morningReportA);

    if (morningReportA.includes('Zero-study streak')) throw new Error('Streak label should be Days below minimum target');
    if (!morningReportA.includes('Days below minimum target: 14 day(s)')) throw new Error('Days below minimum target label missing');

    // Scenario B: Actual progress == 0
    const morningReportB = generateGoodMorningReport({
      mission_health_state: 'AT_RISK',
      consecutive_zero_study_days: 14,
      completed_hours: 0,
      expected_hours_till_today: 100,
      backlog_hours: 20,
      adaptive_target_hours: 2,
      yesterday_summary: { has_data: false }
    }, 'Moulika');
    console.log('Morning Report B (progress == 0):\n', morningReportB);

    if (!morningReportB.includes('Zero-study streak: 14 day(s)')) throw new Error('Zero-study streak label missing');

    console.log('✅ Test 4: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 5: Weekly report includes daily study time');
    console.log('==================================================');

    // Seed default subject targets for testing weekly report
    await query(`
      INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
      VALUES 
        ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15'),
        ($1, 'CSAT', 450, '2026-05-25', '2027-04-15'),
        ($1, 'GS4 Ethics', 325, '2026-05-25', '2027-04-15'),
        ($1, 'GS1', 250, '2026-05-25', '2027-04-15'),
        ($1, 'Current Affairs', 175, '2026-05-25', '2027-04-15')
    `, [TEST_USER]);

    // Seed daily study blocks on a day that is in the current week (e.g. today)
    const mondayStr = getMondayOfCurrentWeek();


    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, started_at, ended_at, planned_end)
      VALUES 
        ($1, 'B1', $2, 'Geography Optional', 'Geomorphology', 180, 145, 'completed', '2026-07-06 09:00:00+05:30', '2026-07-06 11:25:00+05:30', '12:00'),
        ($1, 'B2', $2, 'GS1', 'Modern History', 60, 60, 'completed', '2026-07-06 14:00:00+05:30', '2026-07-06 15:00:00+05:30', '15:00')
    `, [TEST_USER, mondayStr]);

    const weeklySummary = await getWeeklyExecutionSummary(TEST_USER);
    console.log('Weekly summary execution:', weeklySummary.weekly_executed);

    // 145 + 60 = 205 mins = 3.4 hours
    if (weeklySummary.weekly_executed !== 3.4) throw new Error(`Weekly execution should be 3.4 hours, got ${weeklySummary.weekly_executed}`);

    console.log('✅ Test 5: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 6: Deduplicate subject/topic display name');
    console.log('==================================================');

    const formattedA = formatSubjectTopic('GS-1', 'GS-1');
    const formattedB = formatSubjectTopic('GS-1', 'Art & Culture');

    console.log(`'GS-1' and 'GS-1' ->`, formattedA);
    console.log(`'GS-1' and 'Art & Culture' ->`, formattedB);

    if (formattedA !== 'GS-1') throw new Error('Deduplicated name is wrong');
    if (formattedB !== 'GS-1 (Art & Culture)') throw new Error('Regular formatting is wrong');

    console.log('✅ Test 6: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 7: Data-driven risk subjects');
    console.log('==================================================');

    // We have blocks on Monday:
    // Geography Optional: 145/180 completed (execRate = 80.5%)
    // GS1: 60/60 completed (execRate = 100%)
    // Now let's add a missed block for Current Affairs and a missed block for CSAT:
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, planned_end)
      VALUES 
        ($1, 'B3', $2, 'Current Affairs', 'News', 60, 0, 'missed', '16:00'),
        ($1, 'B4', $2, 'CSAT', 'Maths', 60, 0, 'missed', '17:00'),
        ($1, 'B5', $2, 'Current Affairs', 'Editorial', 60, 0, 'missed', '18:00')
    `, [TEST_USER, mondayStr]);

    const weeklySummaryRisk = await getWeeklyExecutionSummary(TEST_USER);
    console.log('Weekly risk subjects:', weeklySummaryRisk.weak_subjects);

    // Current Affairs has 2 missed blocks.
    // CSAT has 1 missed block.
    // Geography Optional has 0 missed blocks but execRate = 80.5% (< 85%).
    // GS1 has 100% execution and 0 missed.
    // Thus, risk subjects sorted should be:
    // 1. Current Affairs (2 missed blocks)
    // 2. CSAT (1 missed block)
    // 3. Geography Optional (0 missed, 80.5% execRate)
    
    if (weeklySummaryRisk.weak_subjects[0] !== 'Current Affairs') throw new Error('Current Affairs should be at highest risk');
    if (weeklySummaryRisk.weak_subjects[1] !== 'CSAT') throw new Error('CSAT should be second highest risk');
    if (weeklySummaryRisk.weak_subjects.includes('Geography Optional')) {
      throw new Error('Geography Optional should not appear under risk since it is in strong subjects');
    }

    console.log('✅ Test 7: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 8: Relaxed getBlockState completed logic cases');
    console.log('==================================================');

    // Case 1: status = planned, actual_minutes = 60
    const state1 = getBlockState({ status: 'planned', actual_minutes: 60 });
    console.log('Case 1 state:', state1);
    if (state1 !== 'completed') throw new Error('Expected status = planned, actual_minutes = 60 to be completed');

    // Case 2: status = done, actual_minutes = 0, started_at and ended_at exist
    const state2 = getBlockState({ status: 'done', actual_minutes: 0, started_at: '2026-07-06T10:00:00Z', ended_at: '2026-07-06T11:00:00Z' });
    console.log('Case 2 state:', state2);
    if (state2 !== 'completed') throw new Error('Expected status = done to be completed');

    // Verify dailyExecutionSummaryService calculated effective minutes for Case 2
    await cleanup();
    // Seed target areas for this test
    await query(`
      INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
      VALUES ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15')
    `, [TEST_USER]);

    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, started_at, ended_at, planned_end)
      VALUES ($1, 'B_CASE2', '2026-07-06', 'Geography Optional', 'Geo', 60, 0, 'done', '2026-07-06T10:00:00Z', '2026-07-06T11:00:00Z', '12:00')
    `, [TEST_USER]);

    const summaryCase2 = await getDailyExecutionSummary(TEST_USER, '2026-07-06');
    console.log('Case 2 effectiveMinutes:', summaryCase2.blockRows[0]?.effectiveMinutes);
    if (summaryCase2.blockRows[0]?.effectiveMinutes !== 60) {
      throw new Error(`Expected effectiveMinutes to be 60 calculated from started_at and ended_at, got ${summaryCase2.blockRows[0]?.effectiveMinutes}`);
    }

    // Case 3: status = done, actual_minutes = 0, no started_at/ended_at, planned_minutes = 90
    await cleanup();
    await query(`
      INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
      VALUES ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15')
    `, [TEST_USER]);
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, planned_end)
      VALUES ($1, 'B_CASE3', '2026-07-06', 'Geography Optional', 'Geo', 90, 0, 'done', '12:00')
    `, [TEST_USER]);

    const summaryCase3 = await getDailyExecutionSummary(TEST_USER, '2026-07-06');
    console.log('Case 3 effectiveMinutes:', summaryCase3.blockRows[0]?.effectiveMinutes);
    if (summaryCase3.blockRows[0]?.effectiveMinutes !== 90) {
      throw new Error(`Expected effectiveMinutes to fallback to planned_minutes = 90, got ${summaryCase3.blockRows[0]?.effectiveMinutes}`);
    }

    console.log('✅ Test 8: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 9: Strong subject exclusion & empty risk report');
    console.log('==================================================');

    await cleanup();
    // Seed default subject targets
    await query(`
      INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
      VALUES 
        ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15'),
        ($1, 'CSAT', 450, '2026-05-25', '2027-04-15')
    `, [TEST_USER]);

    // Geography Optional has 1 completed block of 180 mins. It is strong.
    // We add a missed block for Geography Optional as well.
    // It has missed count > 0, but since it is strong, it must not appear in risk.
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status, started_at, ended_at, planned_end)
      VALUES 
        ($1, 'B_STRONG', $2, 'Geography Optional', 'Geo1', 180, 180, 'completed', '2026-07-06 09:00:00+05:30', '2026-07-06 12:00:00+05:30', '12:00'),
        ($1, 'B_MISSED', $2, 'Geography Optional', 'Geo2', 60, 0, 'missed', NULL, NULL, '13:00')
    `, [TEST_USER, mondayStr]);

    const weeklySummaryCase4 = await getWeeklyExecutionSummary(TEST_USER);
    console.log('Strong subjects:', weeklySummaryCase4.strong_subjects);
    console.log('Weak subjects:', weeklySummaryCase4.weak_subjects);

    if (!weeklySummaryCase4.strong_subjects.includes('Geography Optional')) throw new Error('Geography Optional should be strong');
    if (weeklySummaryCase4.weak_subjects.includes('Geography Optional')) throw new Error('Geography Optional should not appear under risk since it is strong');

    // Verify weekly report with no real risk subjects prints "None clearly at risk this week"
    // Since there are no other subjects with missed/low execution blocks, weak_subjects should be empty.
    if (weeklySummaryCase4.weak_subjects.length !== 0) throw new Error('Weak subjects should be empty');

    const formattedWeeklyReport = await import('./services/reportGeneratorService.js').then(m => m.generateWeeklyMentorReport(weeklySummaryCase4, 'Moulika'));
    console.log('Weekly Report Text:\n', formattedWeeklyReport);

    if (!formattedWeeklyReport.includes('None clearly at risk this week')) {
      throw new Error('Fallback string "None clearly at risk this week" missing in report');
    }

    console.log('✅ Test 9: PASSED');

    await cleanup();
    console.log('\n🎉 ALL CANONICAL E2E TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ E2E Test run failed:', err);
    process.exit(1);
  }
}

runAllTests();
