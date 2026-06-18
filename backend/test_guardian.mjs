// backend/test_guardian.mjs
import 'dotenv/config';
import { query } from './db/index.js';
import { fork } from 'child_process';

const TEST_PORT = 8888;
const TEST_URL = `http://localhost:${TEST_PORT}`;
const MOCK_USER = 'test_guardian_user';
const MOCK_BLOCK_UUID = 'a0000000-b000-c000-d000-e00000000001';
const MOCK_BLOCK_ID = 'test_guardian_block_1';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanUp() {
  console.log('[Test Cleanup] Deleting test records...');
  await query(`DELETE FROM public.guardian_phone_usage_events WHERE block_id = $1`, [MOCK_BLOCK_ID]);
  await query(`DELETE FROM public.study_blocks WHERE id = $1`, [MOCK_BLOCK_UUID]);
  await query(`DELETE FROM public.notification_events WHERE source_id LIKE $1`, [`${MOCK_BLOCK_ID}_%`]);
  await query(`DELETE FROM public.notification_channels WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.notification_preferences WHERE user_id = $1`, [MOCK_USER]);
  console.log('✅ Cleanup complete');
}

async function runTests() {
  let child = null;
  try {
    // 0. Clean up any leftover database state from prior aborted runs
    await cleanUp();

    // 1. Setup notification channels and preferences for isolation
    console.log('[Test Setup] Setting up test notification channels...');
    const envChatId = process.env.TELEGRAM_CHAT_ID;
    if (envChatId) {
      await query(
        `INSERT INTO public.notification_channels (user_id, channel_type, destination_id, is_enabled)
         VALUES ($1, 'TELEGRAM', $2, TRUE)
         ON CONFLICT (user_id, channel_type, destination_id) DO NOTHING`,
        [MOCK_USER, String(envChatId)]
      );
      console.log(`✅ Linked Telegram chat ID ${envChatId} to ${MOCK_USER}`);
    }

    // 2. Start backend server in a separate process
    console.log(`[Test Setup] Spawning server on port ${TEST_PORT}...`);
    child = fork('server.js', {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        ENABLE_TELEGRAM_POLLING: 'false',
        ENABLE_NOTIFICATION_SCHEDULER: 'false'
      }
    });

    // Wait for server to boot (health check)
    let booted = false;
    for (let i = 0; i < 10; i++) {
      await sleep(1500);
      try {
        const res = await fetch(`${TEST_URL}/health`);
        if (res.ok) {
          booted = true;
          break;
        }
      } catch (e) {
        // server not ready yet
      }
    }

    if (!booted) {
      throw new Error('Server failed to start within timeout');
    }
    console.log('✅ Test server is live');

    // 3. Test authorization checking: Expect 401 Unauthorized
    console.log('[Test 1] Testing invalid API Key...');
    const resAuthFail = await fetch(`${TEST_URL}/api/guardian/current-block?userId=${MOCK_USER}`, {
      headers: { 'x-guardian-api-key': 'wrong_key' }
    });
    if (resAuthFail.status !== 401) {
      throw new Error(`Expected status 401 for invalid key, got ${resAuthFail.status}`);
    }
    const jsonAuthFail = await resAuthFail.json();
    if (jsonAuthFail.ok !== false || !jsonAuthFail.error.includes('Unauthorized')) {
      throw new Error(`Expected unauthorized error payload, got: ${JSON.stringify(jsonAuthFail)}`);
    }
    console.log('✅ Passed Test 1: Request rejected with 401');

    // 4. Test active block check: Expect { active: false } when no block is running
    console.log('[Test 2] Testing active block check (no block)...');
    const resNoBlock = await fetch(`${TEST_URL}/api/guardian/current-block?userId=${MOCK_USER}`, {
      headers: { 'x-guardian-api-key': 'test_guardian_key_123' }
    });
    const jsonNoBlock = await resNoBlock.json();
    if (jsonNoBlock.active !== false) {
      throw new Error(`Expected active: false, got: ${JSON.stringify(jsonNoBlock)}`);
    }
    console.log('✅ Passed Test 2: No active block returned correctly');

    // 5. Create active block and check again
    console.log('[Test Setup] Inserting test study block into PostgreSQL...');
    await query(`
      INSERT INTO public.study_blocks 
        (id, user_id, block_id, day_key, subject, planned_minutes, status, started_at)
      VALUES 
        ($1, $2, $3, '2026-06-15', 'GS2', 60, 'active', NOW())
    `, [MOCK_BLOCK_UUID, MOCK_USER, MOCK_BLOCK_ID]);

    console.log('[Test 3] Testing active block check (with block)...');
    const resBlock = await fetch(`${TEST_URL}/api/guardian/current-block?userId=${MOCK_USER}`, {
      headers: { 'x-guardian-api-key': 'test_guardian_key_123' }
    });
    const jsonBlock = await resBlock.json();
    if (jsonBlock.active !== true || jsonBlock.blockId !== MOCK_BLOCK_ID || jsonBlock.subject !== 'GS2' || jsonBlock.status !== 'running') {
      throw new Error(`Active block response mismatch. Got: ${JSON.stringify(jsonBlock)}`);
    }
    console.log('✅ Passed Test 3: Active block details returned correctly');

    // Helper to send distraction and verify response/DB state
    async function sendDistraction(duration, expectedTotal, expectTriggerAttempt, expectedSourceId = null) {
      const res = await fetch(`${TEST_URL}/api/guardian/phone-usage`, {
        method: 'POST',
        headers: {
          'x-guardian-api-key': 'test_guardian_key_123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: MOCK_USER,
          blockId: MOCK_BLOCK_ID,
          appPackage: 'com.instagram.android',
          appName: 'Instagram',
          category: 'distraction',
          durationSeconds: duration,
          startedAt: new Date(Date.now() - duration * 1000).toISOString(),
          endedAt: new Date().toISOString()
        })
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(`Request failed: ${JSON.stringify(json)}`);
      }
      if (json.totalDistractionSeconds !== expectedTotal) {
        throw new Error(`Expected total distraction seconds ${expectedTotal}, got ${json.totalDistractionSeconds}`);
      }
      
      if (expectTriggerAttempt) {
        // Since we are running tests locally, Telegram fetch might time out and result in status: 'failed'.
        // The definitive check is to verify that a row was recorded in notification_events database.
        if (!expectedSourceId) {
          throw new Error('expectedSourceId must be provided if expectTriggerAttempt is true');
        }
        const dbEvents = await query(
          `SELECT status FROM public.notification_events 
           WHERE user_id = $1 AND notification_type = 'DISTRACTION_ALERT' AND source_id = $2`,
          [MOCK_USER, expectedSourceId]
        );
        if (dbEvents.rows.length === 0) {
          throw new Error(`Expected distraction alert notification event for source_id ${expectedSourceId} to be recorded in DB, but none was found`);
        }
      } else {
        // If we expect NO alert, alertTriggered must be false
        if (json.alertTriggered !== false) {
          throw new Error(`Expected alertTriggered to be false, got: ${json.alertTriggered}`);
        }
      }
    }

    // 6. Test progressive distraction thresholds
    console.log('[Test 4] Log 4 minutes of distraction (should NOT alert)...');
    await sendDistraction(240, 240, false);
    console.log('✅ Passed Test 4: 4 min log saved without alert');

    console.log('[Test 5] Log additional 1 minute of distraction (total 5 min, should alert 5m)...');
    await sendDistraction(60, 300, true, `${MOCK_BLOCK_ID}_5m`);
    console.log('✅ Passed Test 5: 5 min log triggered alert and recorded event');

    console.log('[Test 6] Log additional 5 minutes of distraction (total 10 min, should alert 10m)...');
    await sendDistraction(300, 600, true, `${MOCK_BLOCK_ID}_10m`);
    console.log('✅ Passed Test 6: 10 min log triggered alert and recorded event');

    console.log('[Test 7] Log additional 5 minutes of distraction (total 15 min, should alert 15m)...');
    await sendDistraction(300, 900, true, `${MOCK_BLOCK_ID}_15m`);
    console.log('✅ Passed Test 7: 15 min log triggered alert and recorded event');

    console.log('[Test 8] Log additional 15 minutes of distraction (total 30 min, should alert 30m)...');
    await sendDistraction(900, 1800, true, `${MOCK_BLOCK_ID}_30m`);
    console.log('✅ Passed Test 8: 30 min log triggered alert and recorded event');

    console.log('[Test 9] Log additional 1 minute of distraction (total 31 min, should NOT alert 30m again)...');
    await sendDistraction(60, 1860, false);
    console.log('✅ Passed Test 9: 31 min log did not trigger duplicate alert');

    console.log('[Test 10] Log additional 14 minutes of distraction (total 45 min, should alert 45m)...');
    await sendDistraction(840, 2700, true, `${MOCK_BLOCK_ID}_45m`);
    console.log('✅ Passed Test 10: 45 min log triggered alert and recorded event');

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 9. Clean up mock database records
    await cleanUp();

    // 10. Kill test server child process
    if (child) {
      console.log('[Test Teardown] Stopping server process...');
      child.kill('SIGINT');
      await sleep(1000);
      console.log('✅ Server process terminated');
    }
    console.log('[Test Summary] All tests completed');
  }
}

runTests();
