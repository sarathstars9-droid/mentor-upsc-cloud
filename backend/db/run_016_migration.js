// backend/db/run_016_migration.js
// Runs migration 016: creates mains_answer_attempts table

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const sql = readFileSync(
      path.join(__dirname, "migrations/016_mains_answer_attempts.sql"),
      "utf8"
    );
    await query(sql);
    console.log("[MIGRATION] ✅ 016_mains_answer_attempts.sql done");

    // Verify table exists
    const check = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mains_answer_attempts'
      ORDER BY ordinal_position
    `);
    console.log("[MIGRATION] Columns in mains_answer_attempts:");
    check.rows.forEach(r => console.log("  -", r.column_name));
  } catch (err) {
    console.error("[MIGRATION] ❌", err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
