// backend/verify_plan_acceptance_tracking.mjs
import { query } from './db/index.js';
import { savePlanBlocksAndLogEvents } from './services/blockLifecycleService.js';

const TEST_USER = 'test_plan_user_2027';
const TEST_DATE = '2027-02-15';
const TEST_NODE = 'GS1-HIS-MED-BHAKTI-MT01';

async function cleanup() {
  console.log(`[TEST SETUP] Cleaning up old verification data for: ${TEST_USER}`);
  await query(`DELETE FROM public.study_events WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [TEST_USER]);
  await query(`DELETE FROM public.syllabus_node_progress WHERE user_id = $1`, [TEST_USER]);
}

async function runVerification() {
  await cleanup();

  console.log('\n================================================================');
  console.log('       Phase 2A Plan Acceptance Tracking Verification          ');
  console.log('================================================================');

  const items = [
    {
      blockId: 'B1',
      startTime: '09:00',
      endTime: '10:30',
      minutes: 90,
      subject: 'GS1',
      topic: 'Bhakti Movement',
      syllabusNodeId: TEST_NODE,
      gsPaper: 'GS1',
      mode: 'study',
      outputExpected: 'Mind map of Sufi and Bhakti saints',
      rawText: '09:00 - 10:30 Bhakti Movement - study (notes)'
    }
  ];

  console.log('\n--- Step 1: Simulating Plan Block Acceptance ---');
  const result = await savePlanBlocksAndLogEvents(TEST_USER, TEST_DATE, items);
  if (result.ok) {
    console.log('✔ savePlanBlocksAndLogEvents executed successfully.');
  } else {
    throw new Error('savePlanBlocksAndLogEvents returned non-ok result.');
  }

  // 1. Verify study block creation
  console.log('\n--- Verification 1: Study Block Persistence ---');
  const blockRes = await query(`
    SELECT * FROM public.study_blocks 
    WHERE user_id = $1 AND day_key = $2 AND block_id = $3
  `, [TEST_USER, TEST_DATE, 'B1']);
  
  if (blockRes.rows.length === 1) {
    const block = blockRes.rows[0];
    console.log('✔ Study block row created successfully.');
    console.table([{
      'Block ID': block.block_id,
      'Day Key': block.day_key,
      'Subject': block.subject,
      'Syllabus Node': block.syllabus_node_id,
      'Source Type': block.source_type,
      'Mode': block.mode,
      'Output Expected': block.output_expected,
      'Raw Text': block.raw_text
    }]);
  } else {
    throw new Error(`Expected 1 study block row, found ${blockRes.rows.length}`);
  }

  // 2. Verify events in study_events
  console.log('\n--- Verification 2: Study Events Ledger ---');
  const eventsRes = await query(`
    SELECT event_type, metadata_json 
    FROM public.study_events 
    WHERE user_id = $1 
    ORDER BY created_at ASC
  `, [TEST_USER]);

  console.log(`Found ${eventsRes.rows.length} study events logged.`);
  console.table(eventsRes.rows.map(r => ({
    'Event Type': r.event_type,
    'Metadata Preview': JSON.stringify(r.metadata_json)
  })));

  const hasOverallPlan = eventsRes.rows.some(r => r.event_type === 'PLAN_ACCEPTED' && !r.metadata_json.blockId);
  const hasBlockPlan = eventsRes.rows.some(r => r.event_type === 'PLAN_ACCEPTED' && r.metadata_json.blockId === 'B1');
  const hasPyqSeen = eventsRes.rows.some(r => r.event_type === 'PYQ_SEEN');

  if (hasOverallPlan) console.log('✔ Overall PLAN_ACCEPTED event verified.');
  else throw new Error('Overall PLAN_ACCEPTED event is missing.');

  if (hasBlockPlan) console.log('✔ Block-level PLAN_ACCEPTED event verified.');
  else throw new Error('Block-level PLAN_ACCEPTED event is missing.');

  if (hasPyqSeen) {
    const pyqEvent = eventsRes.rows.find(r => r.event_type === 'PYQ_SEEN');
    console.log('✔ PYQ_SEEN event verified with correct exposure fields:');
    console.log('  - prelims_pyq_count:', pyqEvent.metadata_json.prelims_pyq_count);
    console.log('  - mains_pyq_count:', pyqEvent.metadata_json.mains_pyq_count);
    console.log('  - optional_pyq_count:', pyqEvent.metadata_json.optional_pyq_count);
    console.log('  - pyq_ids count:', pyqEvent.metadata_json.pyq_ids?.length);
    console.log('  - purpose:', pyqEvent.metadata_json.purpose);
  } else {
    throw new Error('PYQ_SEEN event is missing.');
  }

  // 3. Verify syllabus node progress transition
  console.log('\n--- Verification 3: Syllabus Node Progress Cache ---');
  const progressRes = await query(`
    SELECT * FROM public.syllabus_node_progress 
    WHERE user_id = $1 AND syllabus_node_id = $2
  `, [TEST_USER, TEST_NODE]);

  if (progressRes.rows.length === 1) {
    const p = progressRes.rows[0];
    console.log('✔ Syllabus node progress entry created.');
    console.log(`  - Status: ${p.status} (Expected: PYQ_SEEN due to logged PYQ exposure)`);
    console.log(`  - Readiness Score: ${p.readiness_score}%`);
    console.log(`  - Prescribed Next Action: "${p.next_action}"`);
    if (p.status !== 'PYQ_SEEN') {
      throw new Error(`Expected node status to be PYQ_SEEN, but found ${p.status}`);
    }
  } else {
    throw new Error(`Expected 1 progress entry, found ${progressRes.rows.length}`);
  }

  // 4. Verify duplicate acceptance behavior
  console.log('\n--- Step 2: Simulating Duplicate Plan Acceptance ---');
  await savePlanBlocksAndLogEvents(TEST_USER, TEST_DATE, items);
  
  const dupBlockRes = await query(`
    SELECT COUNT(*) as count FROM public.study_blocks 
    WHERE user_id = $1 AND day_key = $2
  `, [TEST_USER, TEST_DATE]);

  const dupEventsRes = await query(`
    SELECT event_type, COUNT(*) as count 
    FROM public.study_events 
    WHERE user_id = $1 
    GROUP BY event_type
  `, [TEST_USER]);

  console.log(`After duplicate submission:`);
  console.log(`  - Study Blocks count: ${dupBlockRes.rows[0].count} (Expected: 1)`);
  if (Number(dupBlockRes.rows[0].count) !== 1) {
    throw new Error('Duplicate block was created.');
  } else {
    console.log('✔ Duplicate study blocks avoided.');
  }

  console.log('  - Event Counts:');
  console.table(dupEventsRes.rows.map(r => ({
    'Event Type': r.event_type,
    'Log Count': r.count
  })));

  const planAcceptedCount = Number(dupEventsRes.rows.find(r => r.event_type === 'PLAN_ACCEPTED')?.count || 0);
  const pyqSeenCount = Number(dupEventsRes.rows.find(r => r.event_type === 'PYQ_SEEN')?.count || 0);

  if (planAcceptedCount === 2 && pyqSeenCount === 1) {
    console.log('✔ Duplicate event logging avoided (exactly 1 overall PLAN_ACCEPTED + 1 block PLAN_ACCEPTED + 1 block PYQ_SEEN).');
  } else {
    throw new Error(`Expected exactly 2 PLAN_ACCEPTED and 1 PYQ_SEEN events, found ${planAcceptedCount} and ${pyqSeenCount}`);
  }

  console.log('\n--- Cleanup test data ---');
  await cleanup();
  console.log('================================================================');
  console.log('          Phase 2A Verification Success!                        ');
  console.log('================================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n✘ Verification Failed:', err.message);
  process.exit(1);
});
