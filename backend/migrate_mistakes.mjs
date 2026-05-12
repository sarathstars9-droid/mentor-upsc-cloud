import { query } from "./db/index.js";

async function applyMigrations() {
    try {
        console.log("Adding columns...");
        await query(`
            ALTER TABLE mistakes
            ADD COLUMN IF NOT EXISTS revision_flag BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_weak BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
        `);
        console.log("Columns added.");

        console.log("Checking unique constraint...");
        // Add unique constraint if not exists
        try {
            await query(`
                ALTER TABLE mistakes
                ADD CONSTRAINT mistakes_user_question_uq UNIQUE (user_id, question_id);
            `);
            console.log("Unique constraint added.");
        } catch (e) {
            console.log("Constraint might already exist:", e.message);
        }

        console.log("Done.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

applyMigrations();
