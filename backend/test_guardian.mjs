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
  await query(`DELETE FROM public.notification_events WHERE source_id = $1`, [`${MOCK_BLOCK_ID}_15m`]);
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

    // 6. Test phone usage logging under 15 minutes (should NOT trigger alert)
    console.log('[Test 4] Log distraction under 15 minutes (5 min log)...');
    const resUsage1 = await fetch(`${TEST_URL}/api/guardian/phone-usage`, {
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
        durationSeconds: 300,
        startedAt: new Date(Date.now() - 300 * 1000).toISOString(),
        endedAt: new Date().toISOString()
      })
    });
    const jsonUsage1 = await resUsage1.json();
    if (!jsonUsage1.ok || jsonUsage1.totalDistractionSeconds !== 300 || jsonUsage1.alertTriggered !== false) {
      throw new Error(`Expected ok: true, duration 300s, alertTriggered: false. Got: ${JSON.stringify(jsonUsage1)}`);
    }
    console.log('✅ Passed Test 4: First log saved without alert trigger');

    // 7. Log phone usage exceeding 15 minutes (should trigger alert)
    console.log('[Test 5] Log distraction over 15 minutes (additional 11 min log)...');
    const resUsage2 = await fetch(`${TEST_URL}/api/guardian/phone-usage`, {
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
        durationSeconds: 660,
        startedAt: new Date(Date.now() - 660 * 1000).toISOString(),
        endedAt: new Date().toISOString()
      })
    });
    const jsonUsage2 = await resUsage2.json();
    if (!jsonUsage2.ok || jsonUsage2.totalDistractionSeconds !== 960) {
      throw new Error(`Expected ok: true, duration 960s. Got: ${JSON.stringify(jsonUsage2)}`);
    }
    
    // Check if the notification was tracked in the DB (sent or failed or skipped)
    const dbEvents = await query(
      `SELECT status FROM public.notification_events 
       WHERE user_id = $1 AND notification_type = 'DISTRACTION_ALERT' AND source_id = $2`,
      [MOCK_USER, `${MOCK_BLOCK_ID}_15m`]
    );
    if (dbEvents.rows.length === 0) {
      throw new Error('Expected distraction alert notification event to be recorded in database, but none was found');
    }
    console.log(`✅ Passed Test 5: Alert triggered and logged with status: ${dbEvents.rows[0].status}`);

    // 8. Verify deduplication does not resend the alert
    console.log('[Test 6] Verify deduplication stops secondary alerts...');
    const resUsage3 = await fetch(`${TEST_URL}/api/guardian/phone-usage`, {
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
        durationSeconds: 200,
        startedAt: new Date(Date.now() - 200 * 1000).toISOString(),
        endedAt: new Date().toISOString()
      })
    });
    const jsonUsage3 = await resUsage3.json();
    if (!jsonUsage3.ok || jsonUsage3.alertTriggered !== false) {
      throw new Error(`Deduplication failure. Expected alertTriggered: false, got: ${JSON.stringify(jsonUsage3)}`);
    }
    console.log('✅ Passed Test 6: Deduplication successfully avoided duplicate alert');

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
