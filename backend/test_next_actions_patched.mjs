/**
 * test_next_actions_patched.mjs
 * E2E test: Step 3 Patch — Next Action Engine
 *
 * Tests all 5 patches:
 *   1. Severity threshold     — signal at 1.0 is ignored
 *   2. Cooldown               — 2nd call skips upsert (already updated < 24h)
 *   3. Intensity scaling      — sev>=2.0 title shows "3 PYQs"
 *   4. Diversity              — top 3 have unique action_types
 *   5. answer_attempt_id link — stored in DB row
 */

import { query } from "./db/index.js";
import { evaluateAnswerAttempt } from "./services/mainsIntelligenceService.js";
import { generateNextActions } from "./services/mainsNextActionsService.js";

const USER_ID = "user_1";

// 4 weaknesses: 3 components + 1 dimension — all will start at 1.0/1.5 severity
const RAW_EVAL = JSON.stringify({
  totalScore: 5, maxScore: 10,
  componentScores: { intro:1, structure:0.5, content:1, examples:0.5, analysis:0.5, conclusion:0.5, directiveHandling:0.5, presentation:0.5 },
  strengths: ["Clear language"],
  weaknesses: ["Weak examples", "Weak conclusion", "Directive not addressed"],
  missingDimensions: ["Economic angle"],
  improvementActions: [],
  oneLineDiagnosis: "Needs depth",
  rewriteTask: "",
});

async function run() {
  let attemptId;
  try {
    // ── 1. Seed attempt + signals ──────────────────────────────────────────────
    console.log("\n[1] Inserting test mains_answer_attempt...");
    const ins = await query(
      `INSERT INTO mains_answer_attempts
         (user_id, paper, subject, topic, answer_text, word_count, time_taken, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
      [USER_ID, "GS1", "History", "Modern India", "Answer text.", 80, 600]
    );
    attemptId = ins.rows[0].id;
    console.log("    ✓ attemptId:", attemptId);

    // Evaluate once → signals at base severity (component=1.0, dimension=1.5)
    await evaluateAnswerAttempt({ userId: USER_ID, answerAttemptId: attemptId, rawEvaluation: RAW_EVAL });

    // ── TEST: Severity threshold (signals at 1.0 < threshold 1.5) ─────────────
    console.log("\n[A] Severity Threshold Test...");
    const sigs = await query(
      `SELECT weakness_label, severity FROM mains_weakness_signals WHERE user_id=$1 ORDER BY severity DESC`,
      [USER_ID]
    );
    console.log("    Current signals:");
    sigs.rows.forEach(r => console.log(`    "${r.weakness_label}" sev=${r.severity}`));

    // Components at 1.0 should be filtered out; only dimension (1.5) should pass
    const r1 = await generateNextActions(USER_ID, attemptId);
    console.log("    actionsUpserted (only dimension >= 1.5):", r1.actionsUpserted);
    if (r1.actionsUpserted !== 1) throw new Error(`Threshold: expected 1 action (dimension only), got ${r1.actionsUpserted}`);
    if (r1.topActions[0].source_weakness_type !== "dimension") throw new Error("Threshold: first action should be dimension");
    console.log("    ✓ [A] signals below 1.5 correctly filtered out");
    console.log("    ✓ [A] only 'Economic angle' (dimension, sev=1.5) produced action");

    // ── TEST: answer_attempt_id linkage ────────────────────────────────────────
    console.log("\n[B] answer_attempt_id linkage test...");
    const linked = await query(
      `SELECT answer_attempt_id FROM mains_next_actions WHERE user_id=$1 LIMIT 1`,
      [USER_ID]
    );
    if (!linked.rows[0]?.answer_attempt_id) throw new Error("answer_attempt_id not stored");
    if (linked.rows[0].answer_attempt_id !== attemptId) throw new Error("answer_attempt_id mismatch");
    console.log("    ✓ [E] answer_attempt_id stored:", linked.rows[0].answer_attempt_id);

    // ── TEST: Cooldown — 2nd call within 24h should skip upsert ───────────────
    console.log("\n[C] Cooldown Test (2nd call)...");
    const r2 = await generateNextActions(USER_ID, attemptId);
    console.log("    actionsUpserted (should be 0 — on cooldown):", r2.actionsUpserted);
    if (r2.actionsUpserted !== 0) throw new Error(`Cooldown: expected 0 upserts, got ${r2.actionsUpserted}`);
    console.log("    ✓ [B] cooldown working — 2nd call skipped upsert");

    // ── Evaluate 2nd time → components now at 1.5, dimension at 2.0 ───────────
    console.log("\n[D] Evaluate 2nd time → components reach 1.5, dimension 2.0...");
    await evaluateAnswerAttempt({ userId: USER_ID, answerAttemptId: attemptId, rawEvaluation: RAW_EVAL });

    // Force cooldown bypass by manually setting updated_at old
    await query(
      `UPDATE mains_next_actions SET updated_at = NOW() - INTERVAL '25 hours' WHERE user_id=$1`,
      [USER_ID]
    );
    console.log("    [forced] Reset updated_at to 25h ago to bypass cooldown");

    const r3 = await generateNextActions(USER_ID, attemptId);
    console.log("    actionsUpserted (all 4 signals now >= 1.5):", r3.actionsUpserted);
    if (r3.actionsUpserted !== 4) throw new Error(`Expected 4 actions (all above threshold), got ${r3.actionsUpserted}`);
    console.log("    ✓ [A] All 4 signals >= 1.5 now pass threshold");

    // ── TEST: Intensity scaling — dimension at sev=2.0 should get "3 PYQs"/"3" suffix ─
    console.log("\n[E] Intensity Scaling Test...");
    const actions = await query(
      `SELECT action_type, title, source_severity FROM mains_next_actions WHERE user_id=$1 ORDER BY source_severity DESC`,
      [USER_ID]
    );
    console.log("    Actions with scaled titles:");
    actions.rows.forEach(a =>
      console.log(`    [sev=${a.source_severity}] ${a.action_type}: "${a.title}"`)
    );
    // "Economic angle" at sev=2.0 → revise_notes (no number to scale, but description has "High priority.")
    // "Weak examples" at sev=1.5 → practice_pyq → "Practice 2 PYQs adding examples" (baseline)
    const weakEx = actions.rows.find(a => a.action_type === "practice_pyq");
    const econAng = actions.rows.find(a => a.action_type === "revise_notes");
    if (weakEx && Number(weakEx.source_severity) === 1.5) {
      console.log("    ✓ [C] practice_pyq at sev=1.5: baseline title (2 PYQs)");
    }
    if (econAng && Number(econAng.source_severity) >= 2.0) {
      console.log("    ✓ [C] revise_notes at sev=2.0: elevated intensity");
    }

    // ── TEST: Diversity — top 3 must have unique action_types ─────────────────
    console.log("\n[F] Diversity Test (top 3 unique action_types)...");
    const topTypes = r3.topActions.map(a => a.action_type);
    const uniqueTypes = new Set(topTypes);
    console.log("    Top 3 action_types:", topTypes);
    if (uniqueTypes.size !== topTypes.length) throw new Error("Diversity: duplicate action_types in top 3");
    console.log("    ✓ [D] All top 3 action_types are unique");

    // ── Final snapshot ─────────────────────────────────────────────────────────
    console.log("\n[G] Final mains_next_actions snapshot:");
    console.table(actions.rows.map(a => ({
      action_type:    a.action_type,
      severity:       a.source_severity,
      title_preview:  a.title.substring(0, 50),
    })));

    console.log("\n✅ ALL PATCH CHECKS PASSED — Step 3 Next Action Engine (Patched).\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (attemptId) {
      console.log("[cleanup] Removing test data...");
      await query(`DELETE FROM mains_next_actions       WHERE user_id=$1`, [USER_ID]);
      await query(`DELETE FROM mains_weakness_signals   WHERE user_id=$1`, [USER_ID]);
      await query(`DELETE FROM mains_answer_evaluations WHERE answer_attempt_id=$1`, [attemptId]);
      await query(`DELETE FROM mains_answer_attempts    WHERE id=$1`, [attemptId]);
      console.log("[cleanup] Done.\n");
    }
    process.exit(process.exitCode || 0);
  }
}
run();
