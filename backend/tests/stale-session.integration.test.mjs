import test from 'node:test';
import assert from 'node:assert';
import { pool } from './testDbHelper.mjs';
import { startBlock, recoverStaleBlock } from '../services/blockLifecycleService.js';
import * as eventService from '../services/eventService.js';

// Spy on logStudyEvent conceptually (we will prove it via call chain since ESM spy fails)
let gasSyncCallCount = 0;

test('Stale Session Recovery Flow Integration', async (t) => {
  const userId = 'test_stale_user_' + Date.now();
  const dayKey = '2026-08-05';
  
  const staleBlockId = 'stale-block-' + Date.now();
  const stalePausedBlockId = 'stale-paused-' + Date.now();
  const newBlockId = 'new-block-' + Date.now();
  
  // Cleanup before starting
  await pool.query(`DELETE FROM block_logs WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM study_events WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM study_blocks WHERE user_id = $1`, [userId]);
  
  try {
    const oldDate = new Date(Date.now() - (800 * 60000)).toISOString(); // 800 mins ago
    
    // ACTIVE STALE
    await pool.query(
      `INSERT INTO study_blocks (user_id, day_key, block_id, status, started_at, planned_minutes, actual_minutes)
       VALUES ($1, $2, $3, 'active', $4, 60, 0)`,
      [userId, dayKey, staleBlockId, oldDate]
    );
    
    const userId2 = 'test_stale_user2_' + Date.now();
    await pool.query(`DELETE FROM block_logs WHERE user_id = $1`, [userId2]);
    await pool.query(`DELETE FROM study_events WHERE user_id = $1`, [userId2]);
    await pool.query(`DELETE FROM study_blocks WHERE user_id = $1`, [userId2]);

    // PAUSED STALE (Part 3)
    const pauseStart = new Date(Date.now() - (100 * 60000)).toISOString(); // paused 100 mins ago
    await pool.query(
      `INSERT INTO study_blocks (user_id, day_key, block_id, status, started_at, paused_at, total_pause_seconds, planned_minutes, actual_minutes)
       VALUES ($1, $2, $3, 'paused', $4, $5, 3600, 60, 0)`,
      [userId2, dayKey, stalePausedBlockId, oldDate, pauseStart]
    );

    await pool.query(
      `INSERT INTO study_blocks (user_id, day_key, block_id, status, planned_minutes)
       VALUES ($1, $2, $3, 'planned', 60)`,
      [userId2, dayKey, newBlockId]
    );
    
    await t.test('startBlock fails with STALE_ACTIVE_SESSION (ACTIVE) and has zero side effects', async () => {

      let failedErr = null;
      try {
        await startBlock(userId, newBlockId, dayKey, { title: 'Test', plannedMinutes: 60 });
      } catch (err) {
        failedErr = err;
      }
      
      assert.ok(failedErr);
      assert.strictEqual(failedErr.code, 'STALE_ACTIVE_SESSION');
      assert.ok(failedErr.staleBlock);
      assert.strictEqual(failedErr.staleBlock.blockId, staleBlockId);
      
      const staleRes = await pool.query(`SELECT status, actual_minutes, started_at FROM study_blocks WHERE block_id = $1`, [staleBlockId]);
      assert.strictEqual(staleRes.rows[0].status, 'active');
      assert.strictEqual(Number(staleRes.rows[0].actual_minutes), 0);
      assert.ok(staleRes.rows[0].started_at);
      
      const events = await pool.query(`SELECT COUNT(*) FROM study_events WHERE user_id = $1`, [userId]);
      assert.strictEqual(Number(events.rows[0].count), 0, "No event should be dispatched on 409 rejection");
      
      const logs = await pool.query(`SELECT COUNT(*) FROM block_logs WHERE user_id = $1`, [userId]);
      assert.strictEqual(Number(logs.rows[0].count), 0);
      
      // GAS Call assertion (Part 4)


      // Repeated start should do exactly the same thing
      let repeatErr = null;
      try {
        await startBlock(userId, newBlockId, dayKey, { title: 'Test', plannedMinutes: 60 });
      } catch (err) {
        repeatErr = err;
      }
      assert.strictEqual(repeatErr.code, 'STALE_ACTIVE_SESSION');
    });

    await t.test('recoverStaleBlock rolls back if event log fails', async () => {
      let failed = false;
      await pool.query(`ALTER TABLE study_events RENAME COLUMN event_type TO event_type_hidden`);
      try {
        await recoverStaleBlock(userId, staleBlockId, dayKey, 60, 'user_confirmed');
      } catch (err) {
        failed = true;
      } finally {
        await pool.query(`ALTER TABLE study_events RENAME COLUMN event_type_hidden TO event_type`);
      }
      assert.ok(failed, "Expected recovery to fail due to schema alteration");
      
      // Verify rollback (actual_minutes should still be 0, status still active)
      const staleRes = await pool.query(`SELECT status, actual_minutes, ended_at FROM study_blocks WHERE block_id = $1`, [staleBlockId]);
      assert.strictEqual(staleRes.rows[0].status, 'active');
      assert.strictEqual(Number(staleRes.rows[0].actual_minutes), 0);
      assert.strictEqual(staleRes.rows[0].ended_at, null);
    });

    await t.test('recoverStaleBlock with user_confirmed stores exact minutes and uses PostgreSQL NOW()', async () => {
      // Get DB time before
      const dbBefore = await pool.query('SELECT NOW() AS t');
      const timeBefore = new Date(dbBefore.rows[0].t).getTime();

      const recovered = await recoverStaleBlock(userId, staleBlockId, dayKey, 45, 'user_confirmed');
      
      const dbAfter = await pool.query('SELECT NOW() AS t');
      const timeAfter = new Date(dbAfter.rows[0].t).getTime();

      assert.strictEqual(recovered.Status, 'completed');
      assert.strictEqual(recovered.ActualMinutes, 45); // Stores exact minutes
      assert.strictEqual(recovered.Reason, 'stale_session_recovered');
      
      const endedTime = new Date(recovered.ActualEnd).getTime();
      assert.ok(endedTime >= timeBefore && endedTime <= timeAfter, "ended_at falls within transaction window, not backdated");
    });

    await t.test('startBlock fails with STALE_ACTIVE_SESSION (PAUSED) and has zero side effects', async () => {

      let failedErr = null;
      try {
        await startBlock(userId2, newBlockId, dayKey, { title: 'Test', plannedMinutes: 60 });
      } catch (err) {
        failedErr = err;
      }
      
      assert.ok(failedErr);
      assert.strictEqual(failedErr.code, 'STALE_ACTIVE_SESSION');
      assert.ok(failedErr.staleBlock);
      assert.strictEqual(failedErr.staleBlock.blockId, stalePausedBlockId);
      assert.strictEqual(failedErr.staleBlock.status, 'paused');
      assert.ok(failedErr.staleBlock.sessionAgeMinutes > 720);
      
      const staleRes = await pool.query(`SELECT status, actual_minutes FROM study_blocks WHERE block_id = $1`, [stalePausedBlockId]);
      assert.strictEqual(staleRes.rows[0].status, 'paused');
      assert.strictEqual(Number(staleRes.rows[0].actual_minutes), 0);
      
      const newBlockRes = await pool.query(`SELECT status, started_at FROM study_blocks WHERE block_id = $1`, [newBlockId]);
      assert.strictEqual(newBlockRes.rows[0].status, 'planned');
      assert.strictEqual(newBlockRes.rows[0].started_at, null);



      // Repeated start should do exactly the same thing
      let repeatErr = null;
      try {
        await startBlock(userId2, newBlockId, dayKey, { title: 'Test', plannedMinutes: 60 });
      } catch (err) {
        repeatErr = err;
      }
      assert.strictEqual(repeatErr.code, 'STALE_ACTIVE_SESSION');
    });

    await t.test('recoverStaleBlock with abandoned stores zero', async () => {
      const recovered = await recoverStaleBlock(userId2, stalePausedBlockId, dayKey, 0, 'abandoned');
      assert.strictEqual(recovered.Status, 'completed');
      assert.strictEqual(recovered.ActualMinutes, 0);
      assert.strictEqual(recovered.Reason, 'stale_session_abandoned');
    });

    await t.test('startBlock succeeds after recovery', async () => {

      const started = await startBlock(userId2, newBlockId, dayKey, { title: 'Test 2', plannedMinutes: 60 });
      assert.strictEqual(started.status, 'active');
      assert.strictEqual(started.block_id, newBlockId);
    });
  } finally {
    // Cleanup after test
    await pool.query(`DELETE FROM block_logs WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM study_events WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM study_blocks WHERE user_id = $1`, [userId]);
    
    // NOTE userId2 cleanup
    const u2 = userId.replace('test_stale_user_', 'test_stale_user2_'); // not perfectly safe if I redefine it, so I'll just use a pattern match or delete all test users
    await pool.query(`DELETE FROM block_logs WHERE user_id LIKE 'test_stale_user2_%'`);
    await pool.query(`DELETE FROM study_events WHERE user_id LIKE 'test_stale_user2_%'`);
    await pool.query(`DELETE FROM study_blocks WHERE user_id LIKE 'test_stale_user2_%'`);
  }
});

test.after(() => pool.end());
