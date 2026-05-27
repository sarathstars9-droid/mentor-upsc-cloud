import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await query(sql);
    console.log("✅ Schema applied");

    const studyEventsSql = fs.readFileSync(path.join(__dirname, "migrations", "026_study_events.sql"), "utf8");
    await query(studyEventsSql);
    console.log("✅ Migration 026_study_events applied");

    process.exit(0);
}

run().catch((err) => {
    console.error("❌ Migration failed", err);
    process.exit(1);
});