import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, "migrations", "012_evaluate_answer.sql"), "utf8");
        await query(sql);
        console.log("Migration 012 applied successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

run();
