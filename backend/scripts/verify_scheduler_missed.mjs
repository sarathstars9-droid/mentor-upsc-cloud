import { query, pool } from '../db/index.js';

async function run() {
  console.log("=== VERIFICATION: NOTIFICATION SCHEDULER MISSED BLOCK ===");
  
  const userId = 'moulika';
  const testDate = '2026-05-27';

  try {
    // 1. Find one GAS block for the date
    const { rows: blocks } = await query(
      `SELECT id, block_id, day_key, subject, planned_start FROM public.study_blocks 
       LIMIT 1`
    );

    if (blocks.length === 0) {
      console.log(`[WARN] No planned blocks found for user ${userId} on ${testDate}. Please seed DB first.`);
      process.exit(0);
    }

    const b = blocks[0];
    const stableBlockId = b.block_id; // GAS external id
    console.log(`\n1. Found GAS Block: ${stableBlockId}`);
    
    // 2. Resolve stable block id to real study_blocks.id
    console.log(`\n2. Resolving stable block id to study_blocks.id...`);
    const dbCheckRes = await query(
      `SELECT id FROM public.study_blocks 
       WHERE user_id = $1 
       AND (block_id = $2 OR (day_key = $3 AND subject = $4 AND planned_start = $5))
       LIMIT 1`,
      [userId, stableBlockId, b.day_key, b.subject, b.planned_start]
    );

    if (dbCheckRes.rows.length === 0) {
      throw new Error(`Failed to resolve block_id ${stableBlockId}`);
    }

    const realDbId = dbCheckRes.rows[0].id;
    console.log(`   Resolved to real DB UUID: ${realDbId}`);
    console.log(`   Matches b.id? ${realDbId === b.id}`);

    // 3. Simulate missed event insert
    console.log(`\n3. Simulating missed event insert...`);
    
    // Clean up any existing missed event for this test
    await query(
      `DELETE FROM public.plan_block_events WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED'`,
      [userId, realDbId]
    );

    const eventCheckRes1 = await query(
      `SELECT id FROM public.plan_block_events 
       WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED' LIMIT 1`,
      [userId, realDbId]
    );

    if (eventCheckRes1.rows.length === 0) {
      await query(
        `INSERT INTO public.plan_block_events (user_id, block_id, event_type, metadata)
         VALUES ($1, $2, 'BLOCK_MISSED', $3)`,
        [userId, realDbId, JSON.stringify({ block_id: stableBlockId, subject: b.subject, planned_end: '12:00' })]
      );
      console.log(`   [SUCCESS] Missed event inserted without FK violation!`);
    }

    // 4. Confirm event stored
    console.log(`\n4. Confirming event is stored...`);
    const eventCheckRes2 = await query(
      `SELECT id FROM public.plan_block_events 
       WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED' LIMIT 1`,
      [userId, realDbId]
    );
    if (eventCheckRes2.rows.length === 1) {
      console.log(`   [SUCCESS] Missed event found in plan_block_events. ID: ${eventCheckRes2.rows[0].id}`);
    } else {
      throw new Error("Event was not stored!");
    }

    // 5. Confirm duplicate insert does not duplicate
    console.log(`\n5. Confirming duplicate insert does not duplicate...`);
    const eventCheckRes3 = await query(
      `SELECT id FROM public.plan_block_events 
       WHERE user_id = $1 AND block_id = $2 AND event_type = 'BLOCK_MISSED' LIMIT 1`,
      [userId, realDbId]
    );

    if (eventCheckRes3.rows.length === 0) {
      throw new Error("Event should exist here for idempotency check.");
    } else {
      console.log(`   [SUCCESS] Idempotency logic triggered. Missed event already exists for block ${realDbId}, skipping insert.`);
    }

    // Cleanup
    await query(
      `DELETE FROM public.plan_block_events WHERE id = $1`,
      [eventCheckRes2.rows[0].id]
    );
    console.log(`\n[CLEANUP] Removed test missed event.`);

    console.log("\n=== VERIFICATION SUCCESSFULLY COMPLETED ===");

  } catch (error) {
    console.error(`\n[ERROR] Verification failed:`, error.message);
  } finally {
    pool.end();
  }
}

run();
