import { pool } from '../db/index.js';

async function main() {
  console.log("=== Verification Started ===");
  
  // 1. SELECT 1 DB Check
  try {
    const res = await pool.query('SELECT 1 as val');
    console.log("✅ DB Connection OK. Value:", res.rows[0].val);
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
  }

  // 2. Max one active block per user/day index check
  try {
    const res = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'study_blocks' AND indexname = 'one_active_block_per_user_day'
    `);
    if (res.rows.length > 0) {
      console.log("✅ Unique partial index 'one_active_block_per_user_day' exists.");
    } else {
      console.error("❌ Unique partial index not found!");
    }
  } catch (err) {
    console.error("❌ Index check failed:", err.message);
  }

  // Next steps:
  // Since we are running outside the express app context, we can't easily mock HTTP requests here.
  // The script instructs the user to check /api/system/db-test and logs.
  console.log("=== Verification Completed ===");
  console.log("Run frontend tests against /api/notifications/unread and /api/behaviour/signals to verify 200 fallbacks.");
  
  pool.end();
}

main();
