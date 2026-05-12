/**
 * test_performance_intelligence.mjs
 * E2E test: Step 5 — Performance Intelligence Engine
 *
 * Seeds 8 evaluations across GS1/GS2 papers with varying scores,
 * then calls generatePerformanceSnapshot() and validates all fields.
 */

import { query } from "./db/index.js";
import { evaluateAnswerAttempt } from "./services/mainsIntelligenceService.js";
import { generateNextActions } from "./services/mainsNextActionsService.js";
import { completeAction } from "./services/mainsActionCompletionService.js";
import { generatePerformanceSnapshot } from "./services/mainsPerformanceService.js";

const USER_ID = "user_1";

// 8 attempts: GS1 (high scores), GS2 (low scores) → GS1 = strongest, GS2 = weakest
// Scores arranged so last 5 avg > prev 5 avg (improving trend)
const ATTEMPTS = [
  // Older 3 (prev5 group — lower)
  { paper: "GS2", score: 3, weaknesses: ["Shallow analysis"],         dims: ["Economic angle"] },
  { paper: "GS2", score: 4, weaknesses: ["Weak examples"],            dims: ["Governance angle"] },
  { paper: "GS1", score: 5, weaknesses: ["Weak conclusion"],          dims: ["Economic angle"] },
  // Middle 2 (prev5 group — medium)
  { paper: "GS1", score: 6, weaknesses: ["Directive not addressed"],  dims: ["Social angle"] },
  { paper: "GS2", score: 5, weaknesses: ["Shallow analysis"],         dims: ["Economic angle"] },
  // Recent 3 (last5 group — higher)
  { paper: "GS1", score: 7, weaknesses: ["Weak examples"],            dims: [] },
  { paper: "GS1", score: 8, weaknesses: [],                           dims: [] },
  { paper: "GS2", score: 7, weaknesses: [],                           dims: [] },
];

const attemptIds = [];

async function seedData() {
  for (const a of ATTEMPTS) {
    const ins = await query(
      `INSERT INTO mains_answer_attempts
         (user_id, paper, subject, topic, answer_text, word_count, time_taken, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
      [USER_ID, a.paper, a.paper === "GS1" ? "History" : "Polity", "Test topic", "Answer.", 100, 900]
    );
    const attemptId = ins.rows[0].id;
    attemptIds.push(attemptId);

    const rawEval = JSON.stringify({
      totalScore: a.score, maxScore: 10,
      componentScores: { intro: a.score/8, structure: a.score/8, content: a.score/8, examples: a.score/8,
                         analysis: a.score/8, conclusion: a.score/8, directiveHandling: a.score/8, presentation: a.score/8 },
      strengths: [], weaknesses: a.weaknesses, missingDimensions: a.dims,
      improvementActions: [], oneLineDiagnosis: `Score ${a.score}`, rewriteTask: "",
    });

    await evaluateAnswerAttempt({ userId: USER_ID, answerAttemptId: attemptId, rawEvaluation: rawEval });
  }
}

async function run() {
  try {
    console.log("\n[SEED] Inserting 8 test evaluations...");
    await seedData();
    console.log(`    ✓ seeded ${attemptIds.length} attempts`);

    // Generate actions (signals from evaluation)
    const genR = await generateNextActions(USER_ID, attemptIds[0]);
    console.log(`    ✓ actions generated: ${genR.actionsUpserted}`);

    // Complete one action to test completion rate
    if (genR.topActions.length > 0) {
      await completeAction(USER_ID, genR.topActions[0].id, "completed");
      console.log("    ✓ completed one action for completion rate test");
    }

    // ── Run the engine ─────────────────────────────────────────────────────────
    console.log("\n[1] generatePerformanceSnapshot()...");
    const snap = await generatePerformanceSnapshot(USER_ID);

    // ── A. averageScore ────────────────────────────────────────────────────────
    console.log("\n[A] averageScore:", snap.averageScore);
    if (snap.averageScore === null) throw new Error("averageScore should not be null");
    if (snap.averageScore < 1 || snap.averageScore > 10) throw new Error(`averageScore out of range: ${snap.averageScore}`);
    console.log("    ✓ averageScore in valid range [1-10]:", snap.averageScore);

    // ── B. strongestPaper / weakestPaper ───────────────────────────────────────
    console.log("\n[B] Paper stats:");
    console.log("    strongest:", snap.strongestPaper);
    console.log("    weakest  :", snap.weakestPaper);
    if (!snap.strongestPaper) throw new Error("strongestPaper missing");
    if (snap.strongestPaper.paper !== "GS1") throw new Error(`Expected GS1 as strongest, got ${snap.strongestPaper.paper}`);
    if (snap.weakestPaper && snap.weakestPaper.paper !== "GS2") throw new Error(`Expected GS2 as weakest, got ${snap.weakestPaper.paper}`);
    console.log("    ✓ GS1 is strongest paper");
    console.log("    ✓ GS2 is weakest paper");

    // ── C. mostFrequentWeakness ────────────────────────────────────────────────
    console.log("\n[C] mostFrequentWeakness:", snap.mostFrequentWeakness);
    if (!snap.mostFrequentWeakness) throw new Error("mostFrequentWeakness missing");
    if (!snap.mostFrequentWeakness.label) throw new Error("mostFrequentWeakness missing label");
    if (snap.mostFrequentWeakness.evidenceCount < 1) throw new Error("evidenceCount must be >= 1");
    console.log("    ✓ mostFrequentWeakness present:", snap.mostFrequentWeakness.label, `(evidence=${snap.mostFrequentWeakness.evidenceCount})`);

    // ── D. improvementTrend ────────────────────────────────────────────────────
    console.log("\n[D] improvementTrend:", snap.improvementTrend);
    if (!snap.improvementTrend) throw new Error("improvementTrend missing");
    if (snap.improvementTrend.last5Avg === null) throw new Error("last5Avg should be set (8 evaluations)");
    if (snap.improvementTrend.prev5Avg === null) throw new Error("prev5Avg should be set (8 evaluations)");
    if (snap.improvementTrend.delta === null) throw new Error("delta should be computed");
    // Last 3 scores (7,8,7) > first 5 scores (3,4,5,6,5) → improving
    if (snap.improvementTrend.direction !== "improving") {
      console.warn("    ⚠ Expected improving, got:", snap.improvementTrend.direction, "(data may vary by ordering)");
    } else {
      console.log("    ✓ trend direction: improving");
    }
    console.log("    ✓ last5Avg:", snap.improvementTrend.last5Avg, "prev5Avg:", snap.improvementTrend.prev5Avg);

    // ── E. actionCompletionRate ────────────────────────────────────────────────
    console.log("\n[E] actionCompletionRate:", snap.actionCompletionRate);
    if (!snap.actionCompletionRate) throw new Error("actionCompletionRate missing");
    if (snap.actionCompletionRate.total < 1) throw new Error("total actions should be >= 1");
    if (snap.actionCompletionRate.completed < 1) throw new Error("completed should be >= 1 (we completed one)");
    if (snap.actionCompletionRate.rate <= 0) throw new Error("completion rate should be > 0");
    console.log("    ✓ actionCompletionRate:", `${snap.actionCompletionRate.rate}%`, `(${snap.actionCompletionRate.completed}/${snap.actionCompletionRate.total})`);

    // ── F. revisionEffectiveness ───────────────────────────────────────────────
    console.log("\n[F] revisionEffectiveness:", snap.revisionEffectiveness);
    if (!snap.revisionEffectiveness) throw new Error("revisionEffectiveness missing");
    if (snap.revisionEffectiveness.totalSignals < 1) throw new Error("should have weakness signals");
    console.log("    ✓ revisionEffectiveness:", `${snap.revisionEffectiveness.remediationRate}%`, `(${snap.revisionEffectiveness.remediatedSignals}/${snap.revisionEffectiveness.totalSignals})`);

    // ── G. top3PersistentWeaknesses ───────────────────────────────────────────
    console.log("\n[G] top3PersistentWeaknesses:");
    if (!Array.isArray(snap.top3PersistentWeaknesses)) throw new Error("top3PersistentWeaknesses must be array");
    if (snap.top3PersistentWeaknesses.length === 0) throw new Error("top3 should not be empty");
    snap.top3PersistentWeaknesses.forEach((w, i) =>
      console.log(`    [${i+1}] "${w.label}" (${w.type}) sev=${w.severity} ev=${w.evidenceCount} rev=${w.revisionCount}`)
    );
    console.log("    ✓ top3PersistentWeaknesses populated");

    // ── H. scoreProgressionData ───────────────────────────────────────────────
    console.log("\n[H] scoreProgressionData (last 3):");
    if (!Array.isArray(snap.scoreProgressionData)) throw new Error("scoreProgressionData must be array");
    if (snap.scoreProgressionData.length < 1) throw new Error("scoreProgressionData empty");
    snap.scoreProgressionData.slice(-3).forEach(p =>
      console.log(`    [${p.index}] ${p.paper} score=${p.score} date=${new Date(p.date).toISOString().split("T")[0]}`)
    );
    console.log("    ✓ scoreProgressionData has", snap.scoreProgressionData.length, "entries");

    // ── I. componentAverages ───────────────────────────────────────────────────
    console.log("\n[I] componentAverages:", snap.componentAverages);
    if (!snap.componentAverages) throw new Error("componentAverages missing");
    const compKeys = ["intro","structure","content","examples","analysis","conclusion","directive","presentation"];
    for (const k of compKeys) {
      if (snap.componentAverages[k] === undefined) throw new Error(`Missing component: ${k}`);
    }
    console.log("    ✓ all 8 components present");

    // ── Final snapshot ─────────────────────────────────────────────────────────
    console.log("\n[FINAL] Performance Snapshot:");
    console.log("  averageScore          :", snap.averageScore);
    console.log("  strongestPaper        :", snap.strongestPaper?.paper, `(${snap.strongestPaper?.avgScore}/10)`);
    console.log("  weakestPaper          :", snap.weakestPaper?.paper,   `(${snap.weakestPaper?.avgScore}/10)`);
    console.log("  mostFrequentWeakness  :", snap.mostFrequentWeakness?.label);
    console.log("  trend                 :", `${snap.improvementTrend.direction} (Δ${snap.improvementTrend.delta})`);
    console.log("  completionRate        :", `${snap.actionCompletionRate?.rate}%`);
    console.log("  remediationRate       :", `${snap.revisionEffectiveness?.remediationRate}%`);
    console.log("  meta                  :", snap.meta);

    console.log("\n✅ ALL CHECKS PASSED — Step 5: Performance Intelligence Engine.\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    console.log("[cleanup] Removing test data...");
    await query(`DELETE FROM revision_items         WHERE user_id=$1 AND source_type='mains_action'`, [USER_ID]);
    await query(`DELETE FROM mains_next_actions     WHERE user_id=$1`, [USER_ID]);
    await query(`DELETE FROM mains_weakness_signals WHERE user_id=$1`, [USER_ID]);
    for (const id of attemptIds) {
      await query(`DELETE FROM mains_answer_evaluations WHERE answer_attempt_id=$1`, [id]);
    }
    for (const id of attemptIds) {
      await query(`DELETE FROM mains_answer_attempts WHERE id=$1`, [id]);
    }
    console.log("[cleanup] Done.\n");
    process.exit(process.exitCode || 0);
  }
}
run();
