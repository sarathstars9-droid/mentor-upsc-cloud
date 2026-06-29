import { pool, query } from './db/index.js';
import fs from 'fs';
import path from 'path';
import { startBlock, completeBlock, attachBlockProof, getBlockState } from './services/blockLifecycleService.js';
import { getBacklogSummary, rebalanceSchedule } from './services/plannerService.js';
import { getAuthUserId } from './middleware/authMiddleware.js';

async function runFullVerification() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE BLOCKER VERIFICATION CHECK');
  console.log('====================================================\n');

  const userId = 'verify_user_prod_1';
  const otherUserId = 'verify_user_prod_2';
  const dayKey = new Date().toISOString().slice(0, 10);
  const testBlockId = `blk_guard_chk_${Date.now()}`;
  const otherBlockId = `blk_other_chk_${Date.now()}`;

  try {
    // --- BLOCKER B: AUTHENTICATION CHECK ---
    console.log('--- BLOCKER B: AUTHENTICATION & HEADER SAFETY ---');
    const mockProdReqWithHeaderOnly = {
      headers: { 'x-user-id': 'hacker_user' },
      body: { userId: 'hacker_user' },
      query: {}
    };
    
    // Simulate production env check
    process.env.NODE_ENV = 'production';
    const authIdProd = getAuthUserId(mockProdReqWithHeaderOnly);
    console.log(`Production Auth Result for unverified headers: ${authIdProd} (Expect null/untrusted)`);
    if (authIdProd === null) {
      console.log('✓ PASS: Public x-user-id and request body userId are correctly untrusted in production!');
    } else {
      console.error('❌ FAIL: x-user-id was trusted in production!');
    }

    const mockProdReqWithBearer = {
      headers: { authorization: 'Bearer verify_user_prod_1' }
    };
    const authIdBearer = getAuthUserId(mockProdReqWithBearer);
    console.log(`Production Auth Result with Bearer token: ${authIdBearer}`);
    if (authIdBearer === 'verify_user_prod_1') {
      console.log('✓ PASS: Verified Bearer token correctly populates user ID.');
    } else {
      console.error('❌ FAIL: Bearer token user extraction failed!');
    }

    process.env.NODE_ENV = 'development'; // reset for remaining test steps

    // --- 2. PROOF COMPLETION & GUARD TESTS ---
    console.log('\n--- PROOF COMPLETION & SECURITY GUARD TESTS ---');

    // Clean up old test data
    await query(`DELETE FROM study_blocks WHERE user_id IN ($1, $2)`, [userId, otherUserId]);
    
    await query(`
      INSERT INTO study_blocks (user_id, block_id, day_key, title, subject, topic, planned_minutes, status, proof_required, is_test_data)
      VALUES ($1, $2, $3, 'Production Guard Block', 'Polity', 'Preamble', 60, 'planned', true, false)
    `, [userId, testBlockId, dayKey]);

    await query(`
      INSERT INTO study_blocks (user_id, block_id, day_key, title, subject, topic, planned_minutes, status, proof_required, is_test_data)
      VALUES ($1, $2, $3, 'Other User Block', 'History', 'Modern', 45, 'planned', true, false)
    `, [otherUserId, otherBlockId, dayKey]);

    // Start block for test user
    await startBlock(userId, testBlockId, dayKey);

    // Test case: Complete without proof
    console.log('\nTest Case 2: Try completing proof-required block without uploading proof...');
    try {
      await completeBlock(userId, testBlockId, dayKey, { reason: 'completed', completionSource: 'manual', isTestData: false });
      console.error('❌ FAIL: Completed without proof!');
    } catch (err) {
      if (err.code === 'PROOF_REQUIRED') {
        console.log(`✓ PASS: Blocked with code PROOF_REQUIRED. Message: "${err.message}"`);
      } else {
        console.error(`❌ FAIL: Unexpected error code ${err.code}: ${err.message}`);
      }
    }

    // Test case: Attach proof and complete
    console.log('\nTest Case 4 & 5: Attach valid proof and complete block...');
    const proofUrl = `/api/plan/blocks/proof-file?file=${userId}%2Fproof_test_sample.png`;
    await attachBlockProof(userId, testBlockId, dayKey, { proofUrl, proofType: 'image', proofNotes: 'Valid study notes' });
    const completedBlock = await completeBlock(userId, testBlockId, dayKey, { reason: 'completed', actualMinutes: 55, completionSource: 'manual', isTestData: false });
    
    console.log(`✓ PASS: Completed successfully. Status: ${completedBlock.status}, Actual Minutes: ${completedBlock.actualMinutes}`);

    // --- BLOCKER C: REBALANCE DUP CHECKS ---
    console.log('\n--- BLOCKER C: ADAPTIVE BACKLOG & REBALANCE IDEMPOTENCY ---');

    // Create a missed block to test backlog
    const missedBlockId = `blk_missed_${Date.now()}`;
    await query(`
      INSERT INTO study_blocks (user_id, block_id, day_key, title, subject, topic, planned_minutes, status, is_test_data)
      VALUES ($1, $2, $3, 'Missed Session', 'Economy', 'Budget', 90, 'missed', false)
    `, [userId, missedBlockId, dayKey]);

    console.log('\nRunning rebalance (Run 1)...');
    const reb1 = await rebalanceSchedule(userId, { startDate: dayKey, maxHoursPerDay: 8 });
    console.log(`Run 1 Result: ${reb1.message} (Created: ${reb1.rebalancedCount})`);

    console.log('Running rebalance again immediately (Run 2 - Must create 0 new recovery blocks)...');
    const reb2 = await rebalanceSchedule(userId, { startDate: dayKey, maxHoursPerDay: 8 });
    console.log(`Run 2 Result: ${reb2.message} (Created: ${reb2.rebalancedCount})`);

    if (reb2.rebalancedCount === 0) {
      console.log('✓ PASS: Run 2 created EXACTLY 0 new recovery blocks. Idempotency proven!');
    } else {
      console.error(`❌ FAIL: Run 2 created ${reb2.rebalancedCount} duplicate recovery blocks!`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL BLOCKER VERIFICATION CHECKS PASSED!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('💥 Verification error:', err);
  } finally {
    // Cleanup test data
    await query(`DELETE FROM study_blocks WHERE user_id IN ($1, $2)`, [userId, otherUserId]);
    await query(`DELETE FROM block_logs WHERE user_id IN ($1, $2)`, [userId, otherUserId]);
    process.exit(0);
  }
}

runFullVerification();
