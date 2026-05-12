// backend/test_adaptive_intelligence.mjs
// ─── MentorOS: Adaptive Intelligence Layer — Verification Script ────────────
// Run: node backend/test_adaptive_intelligence.mjs
//
// Tests:
// 1. POST bulk attempts with wrong answers → triggers node_weakness update
// 2. Check node_weakness table
// 3. GET adaptive next actions
// 4. Verify response format
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.BACKEND_URL || "http://localhost:8787";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  MentorOS Adaptive Intelligence Layer — Verification");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── STEP 1: POST bulk attempts with deliberate wrong answers ───────────
  console.log("── STEP 1: Recording PYQ attempts (mostly wrong) ──────────");

  const attempts = [
    { questionId: "test_q_adap_1", nodeId: "GS1-HIS-ANC-IVC-MT01", subjectId: "ancient_history", year: 2020, selectedAnswer: "A", correctAnswer: "B", isCorrect: false, timeTakenSec: 30, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_2", nodeId: "GS1-HIS-ANC-IVC-MT01", subjectId: "ancient_history", year: 2020, selectedAnswer: "C", correctAnswer: "D", isCorrect: false, timeTakenSec: 25, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_3", nodeId: "GS1-HIS-ANC-IVC-MT01", subjectId: "ancient_history", year: 2019, selectedAnswer: "B", correctAnswer: "A", isCorrect: false, timeTakenSec: 20, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_1", nodeId: "GS1-HIS-ANC-IVC-MT01", subjectId: "ancient_history", year: 2020, selectedAnswer: "A", correctAnswer: "B", isCorrect: false, timeTakenSec: 30, sourceType: "topic_pyq" }, // repeated wrong
    { questionId: "test_q_adap_4", nodeId: "GS1-HIS-ANC-IVC-MT01", subjectId: "ancient_history", year: 2018, selectedAnswer: "D", correctAnswer: "C", isCorrect: false, timeTakenSec: 15, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_5", nodeId: "GS1-HIS-MOD-MT01", subjectId: "modern_history", year: 2021, selectedAnswer: "A", correctAnswer: "B", isCorrect: false, timeTakenSec: 22, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_6", nodeId: "GS1-HIS-MOD-MT01", subjectId: "modern_history", year: 2021, selectedAnswer: "B", correctAnswer: "B", isCorrect: true, timeTakenSec: 18, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_7", nodeId: "GS2-POLITY-FR-MT01", subjectId: "polity", year: 2022, selectedAnswer: "C", correctAnswer: "D", isCorrect: false, timeTakenSec: 35, sourceType: "topic_pyq" },
    { questionId: "test_q_adap_8", nodeId: "GS2-POLITY-FR-MT01", subjectId: "polity", year: 2022, selectedAnswer: "A", correctAnswer: "A", isCorrect: true, timeTakenSec: 10, sourceType: "topic_pyq" },
  ];

  try {
    const resp = await fetch(`${BASE}/api/pyq-intelligence/attempts/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user_1",
        testId: "adaptive_test_verification",
        attempts,
      }),
    });

    const json = await resp.json();
    console.log(`   Status: ${resp.status}`);
    console.log(`   Saved: ${json.saved || 0} attempts`);
    console.log(`   Success: ${json.success}\n`);
  } catch (err) {
    console.error("   ❌ FAILED:", err.message, "\n");
  }

  // ── STEP 2: Wait a moment for async updates ───────────────────────────
  await new Promise(r => setTimeout(r, 1000));

  // ── STEP 3: GET adaptive next actions ─────────────────────────────────
  console.log("── STEP 2: Fetching adaptive next actions ─────────────────");

  try {
    const resp = await fetch(
      `${BASE}/api/adaptive/next-actions?userId=user_1&stage=prelims&limit=5`
    );
    const json = await resp.json();

    console.log(`   Status: ${resp.status}`);
    console.log(`   OK: ${json.ok}`);
    console.log(`   Recommendations: ${json.recommendations?.length || 0}\n`);

    if (json.recommendations?.length > 0) {
      console.log("   ┌──────────────────────────────────────────────────────┐");
      console.log("   │  ADAPTIVE NEXT ACTIONS                              │");
      console.log("   ├──────────────────────────────────────────────────────┤");

      for (const rec of json.recommendations) {
        console.log(`   │ Node: ${rec.nodeId}`);
        console.log(`   │   Subject: ${rec.subject}`);
        console.log(`   │   Score: ${rec.weaknessScore} (${rec.weaknessLevel})`);
        console.log(`   │   Accuracy: ${rec.accuracyPercent}%`);
        console.log(`   │   Wrong: ${rec.wrongCount}, Repeated: ${rec.repeatedWrongCount}`);
        console.log(`   │   Action: ${rec.recommendationType}`);
        console.log(`   │   Text: ${rec.actionText}`);
        console.log(`   │`);
      }

      console.log("   └──────────────────────────────────────────────────────┘\n");
    } else {
      console.log("   ⚠️  No recommendations returned (node_weakness table may be empty)\n");
    }
  } catch (err) {
    console.error("   ❌ FAILED:", err.message, "\n");
  }

  // ── STEP 4: Direct DB check via weakness routes ───────────────────────
  console.log("── STEP 3: Checking weakness/top endpoint ─────────────────");

  try {
    const resp = await fetch(
      `${BASE}/api/weakness/top?userId=user_1&limit=5`
    );
    const json = await resp.json();
    console.log(`   Status: ${resp.status}`);
    console.log(`   Nodes from node_weakness_scores: ${json.nodes?.length || 0}\n`);
  } catch (err) {
    console.error("   ❌ FAILED:", err.message, "\n");
  }

  // ── STEP 5: Check PYQ intelligence weak-nodes ─────────────────────────
  console.log("── STEP 4: Checking pyq-intelligence weak-nodes ───────────");

  try {
    const resp = await fetch(
      `${BASE}/api/pyq-intelligence/weak-nodes?userId=user_1`
    );
    const json = await resp.json();
    console.log(`   Status: ${resp.status}`);
    console.log(`   Success: ${json.success}`);
    console.log(`   Weak nodes: ${json.count || 0}\n`);
  } catch (err) {
    console.error("   ❌ FAILED:", err.message, "\n");
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ✅ Verification complete!");
  console.log("  If you see recommendations above, the Adaptive Intelligence");
  console.log("  Layer is working correctly.");
  console.log("");
  console.log("  UI check: Open /prelims and look for the");
  console.log("  'Adaptive Next Actions' card with green header.");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
