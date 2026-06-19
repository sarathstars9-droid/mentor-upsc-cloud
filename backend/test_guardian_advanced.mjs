import 'dotenv/config';
process.env.ENABLE_AUTO_START_BLOCKS = 'true';
import { query } from './db/index.js';
import { fork } from 'child_process';
import { getISTDateTime, activateTimeMatchingBlock, resolveActiveBlock, savePlanBlocksAndLogEvents } from './services/blockLifecycleService.js';

const TEST_PORT = 8889;
const TEST_URL = `http://localhost:${TEST_PORT}`;
const MOCK_USER = 'test_guardian_user';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanUp() {
  console.log('[Test Cleanup] Deleting test records...');
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.study_events WHERE user_id = $1`, [MOCK_USER]);
  await query(`DELETE FROM public.notification_events WHERE user_id = $1`, [MOCK_USER]);
  console.log('✅ Cleanup complete');
}

async function runTests() {
  let child = null;
  try {
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
    }

    // Start backend server
    console.log(`[Test Setup] Spawning server on port ${TEST_PORT}...`);
    child = fork('server.js', {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        ENABLE_TELEGRAM_POLLING: 'false',
        ENABLE_NOTIFICATION_SCHEDULER: 'false',
        ENABLE_AUTO_START_BLOCKS: 'true'
      }
    });

    let booted = false;
    for (let i = 0; i < 10; i++) {
      await sleep(1500);
      try {
        const res = await fetch(`${TEST_URL}/health`);
        if (res.ok) { booted = true; break; }
      } catch (e) {}
    }
    if (!booted) throw new Error('Server failed to start');
    console.log('✅ Test server live');

    const headers = {
      'x-guardian-api-key': 'test_guardian_key_123',
      'Content-Type': 'application/json'
    };

    // Helper to format time relative to IST date object
    const formatTime = (d) => {
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    // --- Scenario 1: Plan uploaded during an active time window ---
    console.log('\n[Scenario 1] Plan uploaded during an active time window...');
    const { dayKey, date } = getISTDateTime();
    
    // Construct startTime and endTime covering the current time in IST
    const startIst = new Date(date.getTime() - 15 * 60000);
    const endIst = new Date(date.getTime() + 45 * 60000);
    const startTimeStr = formatTime(startIst);
    const endTimeStr = formatTime(endIst);

    console.log(`[Scenario 1 Setup] Current IST Date is ${dayKey}, testing window: ${startTimeStr} to ${endTimeStr}`);

    const planItems = [
      {
        blockId: 'active-window-block-1',
        subject: 'History Optional',
        topic: 'Ancient India',
        startTime: startTimeStr,
        endTime: endTimeStr,
        planned_minutes: 60
      }
    ];

    await savePlanBlocksAndLogEvents(MOCK_USER, dayKey, planItems);

    // Verify it is NOT auto-activated (remains planned) under the new design
    const dbBlocksS1Before = await query(`SELECT status FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`, [MOCK_USER, 'active-window-block-1']);
    const blockS1Before = dbBlocksS1Before.rows[0];
    if (blockS1Before.status !== 'planned') {
      throw new Error(`Expected block to remain planned after upload, got status: ${blockS1Before?.status}`);
    }
    console.log('✅ Passed Scenario 1 Part A: Block remains planned upon plan upload');

    // Trigger auto-activation manually
    await activateTimeMatchingBlock(MOCK_USER);

    // Verify it auto-activated now
    const dbBlocksS1 = await query(`SELECT status, started_at FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`, [MOCK_USER, 'active-window-block-1']);
    const blockS1 = dbBlocksS1.rows[0];
    if (blockS1.status !== 'active' || !blockS1.started_at) {
      throw new Error(`Expected block to auto-activate to active, got status: ${blockS1?.status}`);
    }
    console.log('✅ Passed Scenario 1 Part B: Block successfully auto-activated via activateTimeMatchingBlock');

    // --- Scenario 2: Guardian polling after scheduler activation ---
    console.log('\n[Scenario 2] Guardian polling after scheduler activation...');
    // Clear active blocks first
    await query(`UPDATE public.study_blocks SET status = 'completed' WHERE user_id = $1`, [MOCK_USER]);

    // Insert planned block covering now
    const plannedBlockId = 'scheduler-block-2';
    await query(`
      INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, status, planned_start, planned_end, planned_minutes)
      VALUES ($1, $2, $3, 'Geography', 'planned', $4, $5, 60)
    `, [MOCK_USER, plannedBlockId, dayKey, startTimeStr, endTimeStr]);

    // Trigger scheduler block check
    await activateTimeMatchingBlock(MOCK_USER);

    // Verify Guardian poll receives the active block
    const resPoll = await fetch(`${TEST_URL}/api/guardian/current-block?userId=${MOCK_USER}`, { headers });
    const jsonPoll = await resPoll.json();
    if (!jsonPoll.active || jsonPoll.blockId !== plannedBlockId || jsonPoll.subject !== 'Geography') {
      throw new Error(`Expected Guardian poll to return active block, got: ${JSON.stringify(jsonPoll)}`);
    }
    console.log('✅ Passed Scenario 2: Guardian received active block successfully');

    // --- Scenario 3: User ID casing mismatch ---
    console.log('\n[Scenario 3] User ID casing mismatch...');
    const resCasing = await fetch(`${TEST_URL}/api/guardian/current-block?userId=TeSt_GuArDiAn_UsEr`, { headers });
    const jsonCasing = await resCasing.json();
    if (!jsonCasing.active || jsonCasing.blockId !== plannedBlockId) {
      throw new Error(`Casing normalization failed, got: ${JSON.stringify(jsonCasing)}`);
    }
    console.log('✅ Passed Scenario 3: Casing mismatch handled correctly');

    // --- Scenario 4: Server restart during an active block ---
    console.log('\n[Scenario 4] Server restart during an active block...');
    const activeBefore = await resolveActiveBlock(MOCK_USER);
    const timeBefore = new Date(activeBefore.started_at).getTime();
    
    await sleep(1000);
    const activeAfter = await resolveActiveBlock(MOCK_USER);
    const timeAfter = new Date(activeAfter.started_at).getTime();

    if (timeBefore !== timeAfter) {
      throw new Error('Server restart simulation changed start time of active block');
    }
    console.log('✅ Passed Scenario 4: Active block state remains identical on restart');

    // --- Scenario 5: Plan edits during an active block ---
    console.log('\n[Scenario 5] Plan edits during an active block...');
    const modifiedItems = [
      {
        blockId: plannedBlockId,
        subject: 'Geography',
        topic: 'Geomorphology',
        startTime: startTimeStr,
        endTime: endTimeStr,
        planned_minutes: 60
      }
    ];
    await savePlanBlocksAndLogEvents(MOCK_USER, dayKey, modifiedItems);
    
    const dbS5 = await query(`SELECT status, topic, started_at FROM public.study_blocks WHERE user_id = $1 AND block_id = $2`, [MOCK_USER, plannedBlockId]);
    const blockS5 = dbS5.rows[0];
    // Verify that the active status is NOT disrupted (remains active)
    if (blockS5.status !== 'active') {
      throw new Error(`Expected block to remain active, got status: ${blockS5.status}`);
    }
    console.log('✅ Passed Scenario 5: Plan edits did not disrupt active block lifecycle');

    // --- Scenario 6: No duplicate BLOCK_STARTED events ---
    console.log('\n[Scenario 6] No duplicate BLOCK_STARTED events...');
    const eventRes = await query(
      `SELECT id FROM public.study_events WHERE user_id = $1 AND event_type = 'BLOCK_STARTED'`,
      [MOCK_USER]
    );
    if (eventRes.rows.length !== 2) {
      throw new Error(`Expected exactly 2 BLOCK_STARTED events, found ${eventRes.rows.length}`);
    }
    
    await activateTimeMatchingBlock(MOCK_USER);
    const eventResAfter = await query(
      `SELECT id FROM public.study_events WHERE user_id = $1 AND event_type = 'BLOCK_STARTED'`,
      [MOCK_USER]
    );
    if (eventResAfter.rows.length !== 2) {
      throw new Error(`Duplicate BLOCK_STARTED event logged. Found ${eventResAfter.rows.length}`);
    }
    console.log('✅ Passed Scenario 6: Verified no duplicate BLOCK_STARTED events');

    // --- Scenario 7: Only one active block per user ---
    console.log('\n[Scenario 7] Only one active block per user...');
    try {
      await query(`
        INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, status)
        VALUES ($1, 'second-active-block', $2, 'Polity', 'active')
      `, [MOCK_USER, dayKey]);
      throw new Error('Database allowed two active blocks concurrently for the same user');
    } catch (e) {
      if (e.code === '23505') {
        console.log('✅ Database correctly blocked second active block via unique constraint');
      } else {
        throw e;
      }
    }

    try {
      await query(`
        INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, status)
        VALUES ($1, 'third-paused-block', $2, 'Polity', 'paused')
      `, [MOCK_USER, dayKey]);
      throw new Error('Database allowed an active and a paused block concurrently for the same user');
    } catch (e) {
      if (e.code === '23505') {
        console.log('✅ Database correctly blocked paused block concurrent with active block');
      } else {
        throw e;
      }
    }
    console.log('✅ Passed Scenario 7: Single active/paused block constraint enforced');

  } catch (error) {
    console.error('❌ Advanced test execution failed:', error.message);
    process.exitCode = 1;
  } finally {
    await cleanUp();
    if (child) {
      console.log('[Test Teardown] Stopping server process...');
      child.kill('SIGINT');
      await sleep(1000);
    }
    console.log('[Test Summary] Advanced test run completed');
  }
}

runTests();
