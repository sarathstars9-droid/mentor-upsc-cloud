// backend/db/run_018_migration.js
// Runs migration 018: adds question_key to mains_answer_attempts.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "migrations/018_mains_attempt_question_key.sql"),
      "utf8"
    );
    await query(sql);
    console.log("[MIGRATION] 018_mains_attempt_question_key.sql done");
  } catch (err) {
    console.error("[MIGRATION] 018 failed:", err.message);
    process.exitCode = 1;
  }
}

run();
