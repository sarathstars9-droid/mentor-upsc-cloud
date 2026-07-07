import { query } from "../db/index.js";

async function main() {
  const confirmCleanup = process.env.CONFIRM_MISTAKE_CLEANUP === "true";
  const allowUser1 = process.env.ALLOW_USER_1_CLEANUP === "true";

  console.log("==================================================");
  console.log("          MISTAKE BOOK CLEANUP UTILITY           ");
  console.log("==================================================");
  console.log(`Dry-run mode: ${confirmCleanup ? "OFF (Will commit changes)" : "ON (Default - No changes will be made)"}`);
  console.log(`Allow User 1 cleanup: ${allowUser1 ? "ON" : "OFF"}`);
  console.log("--------------------------------------------------");

  try {
    // 1. Get total count
    const totalRes = await query("SELECT COUNT(*) FROM mistakes");
    const totalCount = parseInt(totalRes.rows[0].count, 10);
    console.log(`Total mistakes in DB: ${totalCount}`);

    // 2. Query candidates for cleanup
    // We select rows for known test patterns and user_1 to inspect them safely
    const matchedRes = await query(`
      SELECT id, user_id, paper, mistake_type, mistake_text, notes, question_id, created_at
      FROM mistakes
      WHERE 
        user_id LIKE 'moulika%'
        OR user_id LIKE 'test_prod_user_%'
        OR user_id = 'user_1'
      ORDER BY created_at DESC
    `);

    const allMatched = matchedRes.rows;
    
    // Deletion categories
    const toDelete = [];
    const skippedMoulikaReal = [];
    const skippedUser1NoFlag = [];
    const skippedOther = [];

    allMatched.forEach(row => {
      // 1. Real moulika protection
      if (row.user_id === 'moulika') {
        skippedMoulikaReal.push(row);
        return;
      }

      // 2. Known test users
      if (row.user_id === 'moulika_test' || row.user_id === 'moulika_e2e_test' || row.user_id.startsWith('test_prod_user_')) {
        toDelete.push(row);
        return;
      }

      // 3. User 1 test rows
      if (row.user_id === 'user_1') {
        const text = String(row.mistake_text || "").toLowerCase();
        const notes = String(row.notes || "").toLowerCase();
        const qId = String(row.question_id || "").toLowerCase();
        
        const isTestRow = text.startsWith("test") || notes.startsWith("test") || qId.includes("test");
        if (isTestRow) {
          if (allowUser1) {
            toDelete.push(row);
          } else {
            skippedUser1NoFlag.push(row);
          }
        } else {
          skippedOther.push(row);
        }
        return;
      }

      // 4. Any other row
      skippedOther.push(row);
    });

    console.log(`Total matched rows from query: ${allMatched.length}`);
    console.log(`\nCleanup Criteria:`);
    console.log(" - User ID is 'moulika_test' or 'moulika_e2e_test'");
    console.log(" - User ID starts with 'test_prod_user_'");
    console.log(" - User ID is 'user_1' AND text/notes/question_id contains 'test' (requires ALLOW_USER_1_CLEANUP=true)");
    console.log(" - Real 'moulika' rows are NEVER deleted.");

    console.log(`\nResults:`);
    console.log(` - Scheduled for deletion: ${toDelete.length} rows`);
    console.log(` - Skipped (Real Moulika rows protected): ${skippedMoulikaReal.length} rows`);
    console.log(` - Skipped (User 1 test rows needing ALLOW_USER_1_CLEANUP=true): ${skippedUser1NoFlag.length} rows`);
    console.log(` - Skipped (Other non-test rows): ${skippedOther.length} rows`);

    // Show sample rows scheduled for deletion
    if (toDelete.length > 0) {
      console.log(`\nSample rows to be deleted (max 5):`);
      toDelete.slice(0, 5).forEach((row, i) => {
        console.log(` [${i+1}] ID: ${row.id} | User: ${row.user_id} | Paper: ${row.paper} | Date: ${row.created_at}`);
        console.log(`     Text: "${row.mistake_text ? row.mistake_text.slice(0, 80) : 'N/A'}"`);
        console.log(`     Notes: "${row.notes ? row.notes.slice(0, 80) : 'N/A'}"`);
        console.log("-".repeat(50));
      });
    }

    // Show sample rows skipped for User 1
    if (skippedUser1NoFlag.length > 0) {
      console.log(`\nSample User 1 test rows skipped (requires ALLOW_USER_1_CLEANUP=true and approval):`);
      skippedUser1NoFlag.slice(0, 5).forEach((row, i) => {
        console.log(` [${i+1}] ID: ${row.id} | User: ${row.user_id} | Paper: ${row.paper} | Date: ${row.created_at}`);
        console.log(`     Text: "${row.mistake_text ? row.mistake_text.slice(0, 80) : 'N/A'}"`);
        console.log(`     Notes: "${row.notes ? row.notes.slice(0, 80) : 'N/A'}"`);
        console.log("-".repeat(50));
      });
    }

    if (toDelete.length === 0) {
      console.log("\nNo rows scheduled for deletion.");
      return;
    }

    if (confirmCleanup) {
      console.log("\nExecuting deletion transaction...");
      const deleteIds = toDelete.map(r => r.id);
      
      await query("BEGIN");
      const delRes = await query(
        "DELETE FROM mistakes WHERE id = ANY($1::uuid[])",
        [deleteIds]
      );
      await query("COMMIT");

      console.log(`Successfully deleted ${delRes.rowCount} rows.`);
      
      const afterRes = await query("SELECT COUNT(*) FROM mistakes");
      console.log(`Count after cleanup: ${afterRes.rows[0].count}`);
    } else {
      console.log("\n[DRY RUN ONLY] No rows were deleted. Run with CONFIRM_MISTAKE_CLEANUP=true to execute.");
      console.log(`Count would be: ${totalCount - toDelete.length}`);
    }

  } catch (err) {
    console.error("Error during cleanup operation:", err);
  }
}

main().then(() => process.exit(0));
