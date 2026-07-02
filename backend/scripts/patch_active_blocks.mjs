import { pool } from '../db/index.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('[PATCH] Cleaning up duplicate active blocks...');
    // Find users with multiple active blocks on the same day
    const { rows: duplicates } = await client.query(`
      SELECT user_id, day_key, COUNT(*) as active_count
      FROM study_blocks
      WHERE status = 'active'
      GROUP BY user_id, day_key
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      console.log(`[PATCH] Found ${dup.active_count} active blocks for user ${dup.user_id} on ${dup.day_key}. Resolving...`);
      // Keep the most recently started one active, stop the rest
      const { rows: blocks } = await client.query(`
        SELECT id FROM study_blocks 
        WHERE user_id = $1 AND day_key = $2 AND status = 'active'
        ORDER BY started_at DESC
      `, [dup.user_id, dup.day_key]);

      for (let i = 1; i < blocks.length; i++) {
        await client.query(`
          UPDATE study_blocks 
          SET status = 'completed', ended_at = NOW(), completion_reason = 'auto_stopped_by_patch'
          WHERE id = $1
        `, [blocks[i].id]);
        console.log(`[PATCH] Auto-completed duplicate block ${blocks[i].id}`);
      }
    }

    console.log('[PATCH] Creating unique partial index...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_block_per_user_day 
      ON study_blocks (user_id, day_key) 
      WHERE status = 'active';
    `);
    console.log('[PATCH] Index one_active_block_per_user_day created successfully.');

    await client.query('COMMIT');
    console.log('[PATCH] DB cleanup and index patch complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PATCH] Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
