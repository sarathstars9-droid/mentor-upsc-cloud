import { query } from "./db/index.js";

async function testFlow() {
    try {
        console.log("--- 2. GET mistakes ---");
        const getRes = await fetch("http://localhost:3000/api/mistakes?userId=test_user_1");
        console.log("GET /api/mistakes status:", getRes.status);

        console.log("\n--- 3. POST duplicate mistake twice ---");
        const payload = {
            user_id: "test_user_1",
            source_type: "test",
            question_id: "q_1001",
            answer_status: "wrong",
            question_text: "Test question?",
            selected_answer: "A",
            correct_answer: "B",
            stage: "prelims"
        };
        const post1 = await fetch("http://localhost:3000/api/mistakes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const res1 = await post1.json();
        console.log("POST 1 success:", res1.success, "Mistake ID:", res1.item?.id);

        const payload2 = { ...payload, answer_status: "unattempted", selected_answer: "C" };
        const post2 = await fetch("http://localhost:3000/api/mistakes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload2)
        });
        const res2 = await post2.json();
        console.log("POST 2 success:", res2.success, "Mistake ID:", res2.item?.id);

        console.log("\n--- 4. Confirm only one mistake row exists ---");
        const dbRes = await query("SELECT id, answer_status, selected_answer FROM mistakes WHERE user_id = $1 AND question_id = $2", ["test_user_1", "q_1001"]);
        console.log("DB rows count:", dbRes.rows.length);
        console.log("Row state:", dbRes.rows[0]);

        console.log("\n--- 5. PATCH mistake ---");
        const patchRes = await fetch(`http://localhost:3000/api/mistakes/${res2.item.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_important: true, revision_flag: true, is_weak: true, is_read: true, answer_status: "wrong" })
        });
        const patchData = await patchRes.json();
        console.log("PATCH success:", patchData.success);
        console.log("Patched fields - is_important:", patchData.item.is_important, "revision_flag:", patchData.item.revision_flag, "is_weak:", patchData.item.is_weak, "is_read:", patchData.item.is_read);

        console.log("\n--- 6. Confirm revision item created ---");
        const revRes = await query("SELECT * FROM revision_items WHERE user_id = $1 AND question_id = $2", ["test_user_1", "q_1001"]);
        console.log("Revision item exists:", revRes.rows.length > 0);
        if (revRes.rows.length > 0) {
            console.log("Revision ID:", revRes.rows[0].id, "Status:", revRes.rows[0].status);
        }

        // Cleanup
        await query("DELETE FROM mistakes WHERE user_id = 'test_user_1'");
        await query("DELETE FROM revision_items WHERE user_id = 'test_user_1'");

        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

testFlow();
