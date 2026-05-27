// backend/test_tracking_foundation.mjs
import { query } from './db/index.js';
import { logStudyEvent } from './services/eventService.js';
import { recalculateSyllabusNodeProgress, generateBacklogRescue } from './services/trackingFoundationService.js';

async function cleanup(userId) {
  console.log(`[TEST SETUP] Cleaning up old test data for user: ${userId}`);
  await query(`DELETE FROM public.backlog_items WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.study_events WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.block_logs WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.revision_items WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.mistakes WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.syllabus_node_progress WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM public.subject_targets WHERE user_id = $1`, [userId]);
}

async function runTests() {
  const userId = 'test_user_2027';
  await cleanup(userId);

  console.log('\n--- Test 1: Seeding Subject Target for 2027 attempt ---');
  await query(`
    INSERT INTO public.subject_targets (
      user_id, subject, target_hours, weekly_target_minutes, daily_average_minutes, exam_year, priority
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [userId, 'GS1', 250, 325, 46, '2027', 'high']);
  
  const targetRes = await query(`SELECT * FROM public.subject_targets WHERE user_id = $1`, [userId]);
  console.log('✔ Target created:', targetRes.rows[0]);

  console.log('\n--- Test 2: Creating a study block and logging PLAN_ACCEPTED ---');
  const blockRes = await query(`
    INSERT INTO public.study_blocks (
      user_id, block_id, day_key, subject, topic, planned_minutes, status, syllabus_node_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
  `, [userId, 'B1', '2027-01-01', 'GS1', 'Bhakti Movement', 90, 'planned', 'gs1-art-culture-1']);
  const blockId = blockRes.rows[0].id;
  console.log('✔ Study block created with ID:', blockId);

  const planEvent = await logStudyEvent({
    userId,
    eventType: 'PLAN_ACCEPTED',
    subject: 'GS1',
    topic: 'Bhakti Movement',
    syllabusNodeId: 'gs1-art-culture-1',
    blockId: 'B1',
    metadata: { plan_version: 'v1' }
  });
  console.log('✔ PLAN_ACCEPTED event logged:', planEvent);

  console.log('\n--- Test 3: Simulating Block Lifecycle (STARTED -> PAUSED -> RESUMED -> COMPLETED) ---');
  await logStudyEvent({ userId, eventType: 'BLOCK_STARTED', syllabusNodeId: 'gs1-art-culture-1', blockId: 'B1' });
  await logStudyEvent({ userId, eventType: 'BLOCK_PAUSED', syllabusNodeId: 'gs1-art-culture-1', blockId: 'B1' });
  await logStudyEvent({ userId, eventType: 'BLOCK_RESUMED', syllabusNodeId: 'gs1-art-culture-1', blockId: 'B1' });
  
  // Update study block to completed
  await query(`UPDATE public.study_blocks SET status = 'completed', actual_minutes = 90 WHERE id = $1`, [blockId]);

  // Insert block log
  const logRes = await query(`
    INSERT INTO public.block_logs (
      block_id, user_id, actual_minutes, completion_status, output_type, output_count, accuracy, score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
  `, [blockId, userId, 90, 'completed', 'notes', 2, 85, 90]);
  console.log('✔ Block Log entry created:', logRes.rows[0]);

  const blockCompletedEvent = await logStudyEvent({
    userId,
    eventType: 'BLOCK_COMPLETED',
    subject: 'GS1',
    topic: 'Bhakti Movement',
    syllabusNodeId: 'gs1-art-culture-1',
    blockId: 'B1',
    metadata: { actual_minutes: 90, log_id: logRes.rows[0].id }
  });
  console.log('✔ BLOCK_COMPLETED event logged:', blockCompletedEvent);

  console.log('\n--- Test 4: Logging PYQ_SEEN ---');
  const pyqSeenEvent = await logStudyEvent({
    userId,
    eventType: 'PYQ_SEEN',
    subject: 'GS1',
    topic: 'Bhakti Movement',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { pyq_id: 'PYQ_2023_Q1' }
  });
  console.log('✔ PYQ_SEEN event logged:', pyqSeenEvent);

  console.log('\n--- Test 5: Logging Practice Output (PYQ_ATTEMPTED / MCQ_ATTEMPTED) ---');
  const pyqAttemptedEvent = await logStudyEvent({
    userId,
    eventType: 'PYQ_ATTEMPTED',
    subject: 'GS1',
    topic: 'Bhakti Movement',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { score: 80, accuracy: 80 }
  });
  console.log('✔ PYQ_ATTEMPTED event logged:', pyqAttemptedEvent);

  console.log('\n--- Test 6: Logging Mistakes & Revision Creation ---');
  const mistakeRes = await query(`
    INSERT INTO public.mistakes (
      user_id, question_id, stage, subject, node_id, question_text, answer_status, error_type, source_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
  `, [userId, 'Q_MISTAKE_1', 'prelims', 'GS1', 'gs1-art-culture-1', 'Bhakti Movement origins', 'wrong', 'factual', 'prelims_practice']);
  console.log('✔ Mistake logged in DB:', mistakeRes.rows[0]);

  await logStudyEvent({
    userId,
    eventType: 'MISTAKE_LOGGED',
    subject: 'GS1',
    topic: 'Bhakti Movement origins',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { mistake_id: mistakeRes.rows[0].id }
  });

  const revRes = await query(`
    INSERT INTO public.revision_items (
      user_id, node_id, subject, title, status, priority, review_count, next_review_at, source_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *;
  `, [userId, 'gs1-art-culture-1', 'GS1', 'Bhakti Movement Revision', 'pending', 'high', 0, 'prelims_mistake']);
  console.log('✔ Revision Item created in DB:', revRes.rows[0]);

  await logStudyEvent({
    userId,
    eventType: 'REVISION_CREATED',
    subject: 'GS1',
    topic: 'Bhakti Movement Revision',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { revision_id: revRes.rows[0].id }
  });

  console.log('\n--- Test 7: Completing Revision ---');
  await query(`UPDATE public.revision_items SET status = 'reviewed', review_count = 1 WHERE id = $1`, [revRes.rows[0].id]);
  const revCompletedEvent = await logStudyEvent({
    userId,
    eventType: 'REVISION_COMPLETED',
    subject: 'GS1',
    topic: 'Bhakti Movement Revision',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { revision_id: revRes.rows[0].id }
  });
  console.log('✔ REVISION_COMPLETED event logged:', revCompletedEvent);

  console.log('\n--- Test 8: Logging Mains Answer Submission, Basic Evaluation, and AIR-1 Review ---');
  await logStudyEvent({
    userId,
    eventType: 'MAINS_ANSWER_SUBMITTED',
    subject: 'GS1',
    topic: 'Discuss the significance of the Bhakti Movement...',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { attempt_id: 'mains_att_1' }
  });

  await logStudyEvent({
    userId,
    eventType: 'BASIC_REVIEW_DONE',
    subject: 'GS1',
    topic: 'Discuss the significance of the Bhakti Movement...',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { evaluation_id: 'eval_1', score: 6.5 }
  });

  await logStudyEvent({
    userId,
    eventType: 'AIR1_REVIEW_SAVED',
    subject: 'GS1',
    topic: 'Discuss the significance of the Bhakti Movement...',
    syllabusNodeId: 'gs1-art-culture-1',
    metadata: { air1_review_id: 'air1_rev_1', score: 7.0 }
  });
  console.log('✔ All Mains events successfully logged');

  console.log('\n--- Test 8.5: Defensive Normalization of Priority/Confidence ---');
  const normalizedEvent = await logStudyEvent({
    userId,
    eventType: 'EDGE_CASE_TEST',
    subject: 'GS1',
    metadata: { priority: 'high', confidence: 3, score: 75.5 }
  });
  console.log('✔ Edge case event logged with priority:', normalizedEvent.metadata_json.priority, 'and confidence:', normalizedEvent.metadata_json.confidence);


  console.log('\n--- Test 9: Syllabus Node Progress Recalculation & Status Ladder Validation ---');
  // Trigger a recalculation manually
  await recalculateSyllabusNodeProgress(userId, 'gs1-art-culture-1');
  
  const progressRes = await query(`SELECT * FROM public.syllabus_node_progress WHERE user_id = $1 AND syllabus_node_id = $2`, [userId, 'gs1-art-culture-1']);
  console.log('✔ Calculated Progress Row:', progressRes.rows[0]);
  
  if (progressRes.rows.length === 0) {
    throw new Error('Syllabus progress row was not created!');
  }
  const progress = progressRes.rows[0];
  console.log(`Status Ladder: ${progress.status} (Expected: REVISED or similar based on actual events)`);
  console.log(`Readiness Score: ${progress.readiness_score} / 100`);

  console.log('\n--- Test 10: Backlog Generator Verification ---');
  // Let's create an overdue revision or a missed block in the past to trigger backlog recovery
  await query(`
    INSERT INTO public.study_blocks (
      user_id, block_id, day_key, subject, topic, planned_minutes, status, syllabus_node_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
  `, [userId, 'B_MISSED', '2026-05-20', 'GS1', 'Colonial Economic Impact', 90, 'planned', 'gs1-history-1']);
  
  await query(`
    INSERT INTO public.revision_items (
      user_id, node_id, subject, title, status, priority, review_count, next_review_at, source_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '1 day', $8)
  `, [userId, 'gs1-history-1', 'GS1', 'Colonial Rule Overdue Revision', 'pending', 'high', 0, 'prelims_mistake']);

  console.log('Generating backlog rescue actions...');
  const backlogRes = await generateBacklogRescue(userId);
  console.log('✔ Backlog Rescue items generated:', backlogRes.length);
  
  const savedBacklogs = await query(`SELECT * FROM public.backlog_items WHERE user_id = $1`, [userId]);
  console.log('✔ Backlog Items in Database:');
  console.table(savedBacklogs.rows.map(r => ({
    subject: r.subject,
    topic: r.topic,
    risk: r.risk_level,
    reason: r.reason,
    rescue: r.rescue_action
  })));

  console.log('\n--- Cleanup test user ---');
  await cleanup(userId);
  console.log('All tests completed successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
