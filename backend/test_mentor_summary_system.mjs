import { query } from './db/index.js';
import { 
  generateNightMentorReviewMessage, 
  generateMorningRecallMessage, 
  handleMentorReviewReply 
} from './services/mentorReviewService.js';

const TEST_USER = 'moulika_test';

async function cleanup() {
  console.log(`[TEST SETUP] Cleaning up old test data for user: ${TEST_USER}`);
  await query(`DELETE FROM public.daily_mentor_reviews WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
}

async function runTests() {
  try {
    await cleanup();

    // Make sure the test user exists
    await query(
      `INSERT INTO public.users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [TEST_USER, 'Moulika Test']
    );

    console.log('\n==================================================');
    console.log('🤖 Test 1: Full Completion Day');
    console.log('==================================================');
    
    // Insert 2 completed study blocks
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status)
      VALUES 
        ($1, 'B1', '2026-06-10', 'Geography Optional', 'Geomorphology', 180, 180, 'completed'),
        ($1, 'B2', '2026-06-10', 'CSAT', 'Number System', 90, 90, 'completed')
    `, [TEST_USER]);

    const review1 = await generateNightMentorReviewMessage(TEST_USER, '2026-06-10');
    console.log('Generated Review Text:\n', review1.reviewText);

    // Assertions
    if (!review1.reviewText.includes('studied hours: 4h 30m (Planned: 4h 30m)')) throw new Error('Mismatch in studied hours');
    if (!review1.reviewText.includes('blocks completed: 2/2')) throw new Error('Mismatch in blocks completed count');
    if (!review1.reviewText.includes('Geography Optional, CSAT')) throw new Error('Mismatch in subjects completed list');
    if (!review1.reviewText.includes('Flawless execution today, Moulika Test')) throw new Error('Observation is missing or wrong');
    if (!review1.reviewText.includes('Geography Optional')) throw new Error('Recommended first block is wrong');
    console.log('✅ Test 1: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 2: Partial Completion Day');
    console.log('==================================================');
    
    // Insert 1 completed block and 1 missed block
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status)
      VALUES 
        ($1, 'B1', '2026-06-11', 'Geography Optional', 'Geomorphology', 180, 180, 'completed'),
        ($1, 'B2', '2026-06-11', 'GS1', 'Art & Culture', 60, 0, 'missed')
    `, [TEST_USER]);

    const review2 = await generateNightMentorReviewMessage(TEST_USER, '2026-06-11');
    console.log('Generated Review Text:\n', review2.reviewText);

    // Assertions
    if (!review2.reviewText.includes('studied hours: 3h (Planned: 4h)')) throw new Error('Mismatch in studied hours');
    if (!review2.reviewText.includes('blocks completed: 1/2')) throw new Error('Mismatch in blocks completed count');
    if (!review2.reviewText.includes('missed blocks: 1 (GS1 (Art & Culture))')) throw new Error('Mismatch in missed blocks list');
    if (!review2.reviewText.includes('subjects postponed: GS1')) throw new Error('Mismatch in subjects postponed');
    if (!review2.reviewText.includes('Solid effort today, but we let a few areas slip.')) throw new Error('Observation is missing or wrong');
    if (!review2.reviewText.includes('Tomorrow\'s first priority:\nGS1')) throw new Error('Recommended first block is wrong');
    console.log('✅ Test 2: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 3: Zero-Study Day');
    console.log('==================================================');
    
    // Insert 2 missed blocks
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status)
      VALUES 
        ($1, 'B1', '2026-06-12', 'Geography Optional', 'Geomorphology', 180, 0, 'missed'),
        ($1, 'B2', '2026-06-12', 'CSAT', 'Number System', 90, 0, 'missed')
    `, [TEST_USER]);

    const review3 = await generateNightMentorReviewMessage(TEST_USER, '2026-06-12');
    console.log('Generated Review Text:\n', review3.reviewText);

    // Assertions
    if (!review3.reviewText.includes('studied hours: 0m (Planned: 4h 30m)')) throw new Error('Mismatch in studied hours');
    if (!review3.reviewText.includes('blocks completed: 0/2')) throw new Error('Mismatch in blocks completed count');
    if (!review3.reviewText.includes('A complete zero day. The plan was there, but you avoided execution entirely.')) throw new Error('Observation is missing or wrong');
    if (!review3.reviewText.includes('Reply with the number that best matches the reason:')) throw new Error('Reflection choices missing');
    console.log('✅ Test 3: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 4: Repeated Avoided Subject');
    console.log('==================================================');
    
    // Insert past missed blocks of CSAT in the last 7 days (e.g. 2026-06-05 and 2026-06-07)
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status)
      VALUES 
        ($1, 'BP1', '2026-06-08', 'CSAT', 'Percentage', 60, 0, 'missed'),
        ($1, 'BP2', '2026-06-07', 'CSAT', 'Ratio', 60, 0, 'missed')
    `, [TEST_USER]);

    // Insert today's missed CSAT block
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, topic, planned_minutes, actual_minutes, status)
      VALUES 
        ($1, 'B1', '2026-06-13', 'CSAT', 'Time & Work', 60, 0, 'missed')
    `, [TEST_USER]);

    const review4 = await generateNightMentorReviewMessage(TEST_USER, '2026-06-13');
    console.log('Generated Review Text:\n', review4.reviewText);

    // Assertions
    if (!review4.reviewText.includes('repeated avoidance pattern: CSAT is slipping. You avoided it multiple times this week.')) {
      throw new Error('Repeated avoidance pattern not flagged');
    }
    console.log('✅ Test 4: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 5: No Data Fallback');
    console.log('==================================================');
    
    // No study blocks at all
    const review5 = await generateNightMentorReviewMessage(TEST_USER, '2026-06-14');
    console.log('Generated Review Text:\n', review5.reviewText);

    if (!review5.reviewText.includes('You spent the day without a plan. Flying blind is the easiest way to waste time.')) {
      throw new Error('Fallback observation is wrong or missing');
    }

    // Clean reviews to force recall fallback
    await query(`DELETE FROM public.daily_mentor_reviews WHERE user_id = $1`, [TEST_USER]);

    // Morning recall on the next day (2026-06-15) when yesterday has no data
    const recallFallback = await generateMorningRecallMessage(TEST_USER, '2026-06-15');
    console.log('Generated Recall Text (Fallback):\n', recallFallback);
    if (!recallFallback.includes('we don\'t have study logs or reviews from yesterday')) {
      throw new Error('Fallback recall message is wrong');
    }
    console.log('✅ Test 5: PASSED');

    await cleanup();

    console.log('\n==================================================');
    console.log('🤖 Test 6: Morning Recall After Plan Upload');
    console.log('==================================================');
    
    // Seed yesterday's nightly review in database (date: 2026-06-15)
    await query(`
      INSERT INTO public.daily_mentor_reviews (
        user_id, date, achievements_json, misses_json, mentor_observation, recommended_first_block, reflection_question
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      TEST_USER, 
      '2026-06-15', 
      JSON.stringify({
        completed_details: [
          { subject: 'Geography Optional', topic: 'Geomorphology' }
        ]
      }),
      JSON.stringify({
        missed_details: [
          { subject: 'CSAT', topic: 'Number System' }
        ]
      }),
      'Good work but missed CSAT.',
      'CSAT',
      'Why?'
    ]);

    // Morning recall for today (2026-06-16)
    const recall = await generateMorningRecallMessage(TEST_USER, '2026-06-16');
    console.log('Generated Recall Text:\n', recall);

    // Assertions
    if (!recall.includes('Good. Plan received.')) throw new Error('Header missing');
    if (!recall.includes('- Geography Optional (Geomorphology)')) throw new Error('Completed subjects list missing or formatted wrongly');
    if (!recall.includes('- CSAT (Number System)')) throw new Error('Missed subjects list missing or formatted wrongly');
    if (!recall.includes('So today\'s first block should repair that gap:\nCSAT')) throw new Error('Recommendation line missing or wrong');
    if (!recall.includes('Do not start with an easy comfort topic if yesterday\'s important work is still pending.')) throw new Error('Comfort warning line missing');
    if (!recall.includes('Press Start.')) throw new Error('Footer CTA missing');
    console.log('✅ Test 6: PASSED');

    console.log('\n==================================================');
    console.log('🤖 Test 7: Handle Reflection Reply Interception');
    console.log('==================================================');
    
    // Set user_reply as null
    await query(`
      UPDATE public.daily_mentor_reviews 
      SET user_reply = NULL 
      WHERE user_id = $1 AND date = '2026-06-15'
    `, [TEST_USER]);

    const replyMsg = await handleMentorReviewReply(TEST_USER, '1'); // 'Fear'
    console.log('Reflection Reply Message:\n', replyMsg);

    if (!replyMsg.includes('Fear of failure or fear of not understanding the topic is common')) {
      throw new Error('Reply message is wrong');
    }

    const checkReplyRes = await query(`SELECT user_reply FROM public.daily_mentor_reviews WHERE user_id = $1 AND date = '2026-06-15'`, [TEST_USER]);
    if (checkReplyRes.rows[0].user_reply !== 'Fear') {
      throw new Error('user_reply was not updated in the database');
    }
    console.log('✅ Test 7: PASSED');

    await cleanup();
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test run failed:', err);
    process.exit(1);
  }
}

runTests();
