import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "migrations", "013_air1_review_intelligence.sql"),
      "utf8"
    );
    await query(sql);
    console.log("Migration 013 applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
