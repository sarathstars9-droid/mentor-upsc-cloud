// backend/scripts/runMigration006.mjs
// One-shot migration runner for 006_prelims_tests.sql
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(__dirname, "..", "db", "migrations", "006_prelims_tests.sql"), "utf8");

try {
  await query(sql);
  console.log("✅ Migration 006_prelims_tests.sql applied successfully");

  const check = await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('prelims_test_attempts','prelims_test_responses') ORDER BY table_name"
  );
  console.log("Tables confirmed:", check.rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("❌ Migration failed:", err.message);
}
process.exit(0);
