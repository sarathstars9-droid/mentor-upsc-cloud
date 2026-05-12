import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const sql = readFileSync(
      path.join(__dirname, "db/migrations/011_action_completion.sql"), "utf8"
    );
    await query(sql);
    console.log("[MIGRATION] ✅ 011_action_completion.sql done");

    // Verify columns exist
    const check = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('mains_next_actions', 'mains_weakness_signals')
        AND column_name IN ('status', 'completed_at', 'revision_count')
      ORDER BY table_name, column_name
    `);
    check.rows.forEach(r => console.log("   ✓", r.column_name));
  } catch (err) {
    console.error("[MIGRATION] ❌", err.message);
    process.exit(1);
  }
  process.exit(0);
}
run();
