#!/usr/bin/env node
// backend/scripts/repairMultipleActiveBlocks.js
// One-time (idempotent) repair script for legacy corrupted active-block state.
//
// Usage:
//   node backend/scripts/repairMultipleActiveBlocks.js
//   node backend/scripts/repairMultipleActiveBlocks.js --dry-run
//   node backend/scripts/repairMultipleActiveBlocks.js --user moulika

import 'dotenv/config';
import { pool } from '../db/index.js';

const DRY_RUN    = process.argv.includes('--dry-run');
const targetUser = (() => {
  const idx = process.argv.indexOf('--user');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

async function run() {
  console.log('=== repairMultipleActiveBlocks ===');
  console.log('dry-run  :', DRY_RUN);
  console.log('targetUser:', targetUser || '(all users)');
  console.log('');

  const client = await pool.connect();
  try {
    // ── Step 1: Report current active-block state ───────────────────────────
    const { rows: activeRows } = await client.query(
      `SELECT user_id, block_id, id, started_at, paused_at, status
       FROM study_blocks
       WHERE status = 'active'
         AND ($1::TEXT IS NULL OR user_id = $1)
       ORDER BY user_id, started_at DESC NULLS LAST`,
      [targetUser]
    );

    if (!activeRows.length) {
      console.log('✅ No active blocks found. Nothing to repair.');
      return;
    }

    console.log(`Found ${activeRows.length} active block(s):`);
    for (const r of activeRows) {
      console.log(`  user=${r.user_id}  block=${r.block_id}  id=${r.id}  started=${r.started_at || 'NULL'}`);
    }
    console.log('');

    // ── Step 2: Group by user_id ────────────────────────────────────────────
    const byUser = {};
    for (const r of activeRows) {
      (byUser[r.user_id] = byUser[r.user_id] || []).push(r);
    }

    let totalClosed = 0;

    // ── Step 3: For each user with >1 active block ──────────────────────────
    for (const [uid, rows] of Object.entries(byUser)) {
      if (rows.length <= 1) {
        console.log(`✅ user=${uid}: exactly 1 active block — no repair needed`);
        continue;
      }

      // Sort: most-recently-started first
      rows.sort((a, b) => {
        const aMs = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bMs = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bMs - aMs;
      });

      const [keep, ...close] = rows;
      console.log(`⚠️  user=${uid}: ${rows.length} active blocks`);
      console.log(`   KEEP  : block=${keep.block_id}  id=${keep.id}  started=${keep.started_at}`);
      for (const c of close) {
        console.log(`   CLOSE : block=${c.block_id}  id=${c.id}  started=${c.started_at}`);
      }

      if (!DRY_RUN) {
        await client.query('BEGIN');
        try {
          const closeIds = close.map((r) => r.id);

          await client.query(
            `UPDATE study_blocks
             SET status              = 'completed',
                 ended_at            = COALESCE(ended_at, NOW()),
                 total_pause_seconds = total_pause_seconds
                                       + CASE WHEN paused_at IS NOT NULL
                                              THEN GREATEST(0,
                                                     EXTRACT(EPOCH FROM (NOW() - paused_at))::INTEGER)
                                              ELSE 0 END,
                 paused_at           = NULL,
                 completion_reason   = 'auto_repair_script',
                 updated_at          = NOW()
             WHERE id = ANY($1)`,
            [closeIds]
          );
          await client.query('COMMIT');
          console.log(`   ✅ Closed ${closeIds.length} block(s) for user=${uid}`);
          totalClosed += closeIds.length;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`   ❌ ROLLBACK for user=${uid}:`, err.message);
        }
      } else {
        console.log(`   [dry-run] Would close ${close.length} block(s) for user=${uid}`);
        totalClosed += close.length;
      }
    }

    console.log('');

    // ── Step 4: Fix blocks stuck in 'paused' with no started_at ────────────
    const { rows: badPaused } = await client.query(
      `SELECT id, user_id, block_id FROM study_blocks
       WHERE status = 'paused' AND started_at IS NULL
         AND ($1::TEXT IS NULL OR user_id = $1)`,
      [targetUser]
    );

    if (badPaused.length) {
      console.log(`Found ${badPaused.length} paused block(s) with NULL started_at — marking completed`);
      if (!DRY_RUN) {
        await client.query(
          `UPDATE study_blocks
           SET status = 'completed', ended_at = NOW(), completion_reason = 'repair_bad_pause',
               paused_at = NULL, updated_at = NOW()
           WHERE id = ANY($1)`,
          [badPaused.map((r) => r.id)]
        );
      }
    }

    console.log(DRY_RUN
      ? `\n[DRY RUN] Would have closed ${totalClosed} block(s). Re-run without --dry-run to apply.`
      : `\n✅ Repair complete. Closed ${totalClosed} excess active block(s).`
    );

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
