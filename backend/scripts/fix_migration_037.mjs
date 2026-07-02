import { pool } from '../db/index.js';

async function main() {
  console.log("=== Fixing Guardian Daily Phone Usage Duplicates ===");
  
  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Find duplicates based on user_id, date, app_package
    const duplicateCheck = await pool.query(`
      SELECT user_id, date, app_package, COUNT(*), array_agg(id) as ids, sum(usage_seconds) as total_usage
      FROM guardian_daily_phone_usage
      GROUP BY user_id, date, app_package
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Found ${duplicateCheck.rowCount} duplicate groups.`);
    
    for (const row of duplicateCheck.rows) {
      const ids = row.ids;
      // Sort to keep the highest ID (most recent)
      ids.sort((a, b) => b - a);
      const keepId = ids[0];
      const deleteIds = ids.slice(1);
      
      console.log(`Fixing duplicates for user: ${row.user_id}, date: ${row.date}, app: ${row.app_package}`);
      console.log(`Keeping ID: ${keepId}, Deleting IDs: ${deleteIds.join(', ')}`);
      
      // We optionally merge usage (summing it up into the keepId).
      // If we just want to ensure unique constraint, we can just take the total_usage.
      await pool.query(`
        UPDATE guardian_daily_phone_usage 
        SET usage_seconds = $1 
        WHERE id = $2
      `, [row.total_usage, keepId]);
      
      // Delete the rest
      await pool.query(`
        DELETE FROM guardian_daily_phone_usage 
        WHERE id = ANY($1)
      `, [deleteIds]);
    }
    
    // Now create the unique index
    console.log("Creating unique index uniq_guardian_daily_phone_usage...");
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_daily_phone_usage 
      ON guardian_daily_phone_usage (user_id, date, app_package)
    `);
    console.log("Unique index created successfully.");
    
    await pool.query('COMMIT');
    console.log("=== Migration 037 Fix Completed Successfully ===");
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("❌ Failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
