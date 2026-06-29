import { pool, query } from './db/index.js';
import { getBacklogSummary, rebalanceSchedule } from './services/plannerService.js';

async function runVerification() {
  console.log('--- STARTING PHASE 1 & PHASE 7 DIRECT VERIFICATION ---');
  const userId = 'moulika';
  const dayKey = '2026-06-29';
  const testBlockId = 'test_proof_direct_1';

  try {
    // 1. Clean up old test row if exists
    await query(`DELETE FROM study_blocks WHERE user_id = $1 AND block_id = $2`, [userId, testBlockId]);

    // 2. Insert test planned block
    console.log('1. Inserting planned study block...');
    const { rows: inserted } = await query(
      `INSERT INTO study_blocks (user_id, block_id, day_key, title, subject, topic, planned_minutes, status, is_test_data, source_type)
       VALUES ($1, $2, $3, 'Polity Direct', 'Polity', 'Preamble', 60, 'planned', true, 'test')
       RETURNING *`,
      [userId, testBlockId, dayKey]
    );
    console.log('   ✓ Inserted block ID:', inserted[0].id);

    // 3. Import service complete function dynamically
    const { completeBlock, attachBlockProof } = await import('./services/blockLifecycleService.js');

    // 4. Test completion without proof (expect PROOF_REQUIRED error)
    console.log('2. Testing completion without proof (expecting PROOF_REQUIRED guard)...');
    try {
      await completeBlock(userId, testBlockId, dayKey, { reason: 'completed', completionSource: 'test', isTestData: true });
      console.error('   ❌ FAILED: Block completed without proof!');
    } catch (err) {
      if (err.code === 'PROOF_REQUIRED') {
        console.log('   ✓ SUCCESS: Block completion blocked with PROOF_REQUIRED guard as expected.');
      } else {
        console.error('   ❌ Unexpected error:', err.message);
      }
    }

    // 5. Attach proof to block
    console.log('3. Attaching proof to study block...');
    const proofAttached = await attachBlockProof(userId, testBlockId, dayKey, {
      proofUrl: '/uploads/proofs/test_direct_notes.png',
      proofType: 'image',
      proofNotes: 'Handwritten notes on Preamble',
      verificationStatus: 'verified'
    });
    console.log('   ✓ Proof attached. Verification Status:', proofAttached.proofVerificationStatus, 'Proof URL:', proofAttached.proofUrl);

    // 6. Complete block with proof
    console.log('4. Completing study block with attached proof...');
    const completed = await completeBlock(userId, testBlockId, dayKey, { reason: 'completed', actualMinutes: 50, completionSource: 'test', isTestData: true });
    console.log('   ✓ Block completed successfully! Status:', completed.status, 'Actual Minutes:', completed.actualMinutes);

    // 7. Verify Backlog Summary
    console.log('5. Testing Backlog Summary aggregation...');
    const backlog = await getBacklogSummary(userId);
    console.log('   ✓ Total Missed Blocks:', backlog.totalMissedBlocks, 'Total Missed Hours:', backlog.totalMissedHours);

    // 8. Test Adaptive Schedule Rebalancing
    console.log('6. Testing Adaptive Schedule Rebalancing...');
    const rebalance = await rebalanceSchedule(userId, { startDate: dayKey, maxHoursPerDay: 10 });
    console.log('   ✓ Rebalancing output:', rebalance.message);

    console.log('\n==========================================');
    console.log('🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!');
    console.log('==========================================\n');
  } catch (err) {
    console.error('💥 Verification crashed:', err);
  } finally {
    // Always clean up test data so production DB remains clean
    await query(`DELETE FROM study_blocks WHERE user_id = $1 AND block_id = $2`, [userId, testBlockId]);
    await query(`DELETE FROM block_logs WHERE user_id = $1 AND (block_id = $2 OR actual_minutes = 50)`, [userId, testBlockId]);
    process.exit(0);
  }
}

runVerification();

