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

    const trackingSql = fs.readFileSync(path.join(__dirname, "migrations", "024_tracking_foundation.sql"), "utf8");
    await query(trackingSql);
    console.log("✅ Migration 024_tracking_foundation applied");

    const subTargetsSql = fs.readFileSync(path.join(__dirname, "migrations", "025_subject_sub_targets.sql"), "utf8");
    await query(subTargetsSql);
    console.log("✅ Migration 025_subject_sub_targets applied");

    const studyEventsSql = fs.readFileSync(path.join(__dirname, "migrations", "026_study_events.sql"), "utf8");
    await query(studyEventsSql);
    console.log("✅ Migration 026_study_events applied");

    const fixNumericSql = fs.readFileSync(path.join(__dirname, "migrations", "027_fix_numeric_types.sql"), "utf8");
    await query(fixNumericSql);
    console.log("✅ Migration 027_fix_numeric_types applied");

    process.exit(0);
}

run().catch((err) => {
    console.error("❌ Migration failed", err);
    process.exit(1);
});