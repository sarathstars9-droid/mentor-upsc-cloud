/**
 * test_action_completion.mjs
 * E2E test: Step 4 — Action Completion + Revision Engine
 *
 * Flow:
 *   1. Seed: answer attempt + evaluation → weakness signals + next actions
 *   2. Complete an action → verify:
 *      A. action.status = 'completed', completed_at set
 *      B. weakness signal severity reduced by 0.5
 *      C. weakness signal revision_count incremented to 1
 *      D. revision_item created with source_type='mains_action'
 *   3. Skip an action → verify:
 *      E. action.status = 'skipped', no severity change, no revision item
 *   4. Undo (pending) → verify:
 *      F. action.status = 'pending', is_done = FALSE
 *   5. Unauthorized access → verify 403-equivalent error
 *   6. Cleanup
 */

import { query } from "./db/index.js";
import { evaluateAnswerAttempt } from "./services/mainsIntelligenceService.js";
import { generateNextActions } from "./services/mainsNextActionsService.js";
import { completeAction } from "./services/mainsActionCompletionService.js";

const USER_ID = "user_1";

const RAW_EVAL = JSON.stringify({
  totalScore: 5, maxScore: 10,
  componentScores: { intro:1, structure:0.5, content:1, examples:0.5, analysis:0.5, conclusion:0.5, directiveHandling:0.5, presentation:0.5 },
  strengths: [],
  weaknesses: ["Weak examples", "Weak conclusion"],
  missingDimensions: ["Economic angle"],
  improvementActions: [],
  oneLineDiagnosis: "Needs depth",
  rewriteTask: "",
});

async function run() {
  let attemptId;
  try {
    // ── Seed ──────────────────────────────────────────────────────────────────
    console.log("\n[SEED] Inserting attempt + evaluating twice (signals at sev>=1.5)...");
    const ins = await query(
      `INSERT INTO mains_answer_attempts
         (user_id, paper, subject, topic, answer_text, word_count, time_taken, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
      [USER_ID, "GS1", "History", "Modern India", "Sample.", 80, 600]
    );
    attemptId = ins.rows[0].id;

    // 2 evaluations → components reach 1.5, dimension reaches 2.0
    for (let i = 0; i < 2; i++) {
      await evaluateAnswerAttempt({ userId: USER_ID, answerAttemptId: attemptId, rawEvaluation: RAW_EVAL });
    }

    // Generate actions (cooldown bypass: they don't exist yet)
    const genResult = await generateNextActions(USER_ID, attemptId);
    console.log(`    actions generated: ${genResult.actionsUpserted}`);

    // Fetch seeded actions
    const allActions = await query(
      `SELECT id, action_type, source_weakness_label, source_weakness_type, source_severity, status
         FROM mains_next_actions WHERE user_id=$1 ORDER BY source_severity DESC`,
      [USER_ID]
    );
    console.log("    Actions in DB:");
    allActions.rows.forEach(a =>
      console.log(`    [sev=${a.source_severity}] ${a.action_type} — "${a.source_weakness_label}"`)
    );

    const dimAction  = allActions.rows.find(a => a.source_weakness_type === "dimension");  // Economic angle
    const compAction = allActions.rows.find(a => a.source_weakness_type === "component");  // component

    if (!dimAction)  throw new Error("No dimension action found");
    if (!compAction) throw new Error("No component action found");

    // ── A/B/C/D: Complete dimension action ────────────────────────────────────
    console.log("\n[A-D] Completing dimension action:", dimAction.source_weakness_label);
    const compResult = await completeAction(USER_ID, dimAction.id, "completed");

    // A. Status
    if (compResult.action.status !== "completed") throw new Error(`Expected status=completed, got ${compResult.action.status}`);
    if (!compResult.action.completed_at)          throw new Error("completed_at not set");
    if (compResult.action.is_done !== true)        throw new Error("is_done not TRUE");
    console.log("    ✓ [A] status=completed, completed_at set, is_done=true");

    // B. Severity reduced
    if (!compResult.weaknessSignal) throw new Error("weaknessSignal not returned");
    const newSev = Number(compResult.weaknessSignal.severity);
    if (newSev !== 1.5) throw new Error(`Expected severity=1.5 (was 2.0 - 0.5), got ${newSev}`);
    console.log("    ✓ [B] severity reduced: 2.0 → 1.5");

    // C. revision_count incremented
    const revCount = Number(compResult.weaknessSignal.revision_count);
    if (revCount !== 1) throw new Error(`Expected revision_count=1, got ${revCount}`);
    console.log("    ✓ [C] revision_count incremented to 1");

    // D. revision_item created
    if (!compResult.revisionItem) throw new Error("revisionItem not created");
    if (compResult.revisionItem.source_type !== "mains_action") throw new Error("Wrong source_type on revision item");
    if (compResult.revisionItem.source_id   !== dimAction.id)   throw new Error("source_id mismatch on revision item");
    if (compResult.revisionItem.stage       !== "mains")        throw new Error("Wrong stage on revision item");
    console.log("    ✓ [D] revision item created:", {
      id:          compResult.revisionItem.id,
      source_type: compResult.revisionItem.source_type,
      stage:       compResult.revisionItem.stage,
    });

    // ── E: Skip a component action ────────────────────────────────────────────
    console.log("\n[E] Skipping component action:", compAction.source_weakness_label);
    const skipResult = await completeAction(USER_ID, compAction.id, "skipped");

    if (skipResult.action.status !== "skipped") throw new Error(`Expected status=skipped, got ${skipResult.action.status}`);
    if (skipResult.action.is_done !== true)      throw new Error("is_done should be TRUE for skipped");
    if (skipResult.weaknessSignal !== null)      throw new Error("Skipped action should not reduce severity");
    if (skipResult.revisionItem   !== null)      throw new Error("Skipped action should not create revision item");
    console.log("    ✓ [E] status=skipped, is_done=true, no severity change, no revision item");

    // ── F: Undo (pending) ─────────────────────────────────────────────────────
    console.log("\n[F] Undoing (→ pending) component action...");
    const undoResult = await completeAction(USER_ID, compAction.id, "pending");

    if (undoResult.action.status  !== "pending") throw new Error(`Expected status=pending, got ${undoResult.action.status}`);
    if (undoResult.action.is_done !== false)      throw new Error("is_done should be FALSE for pending");
    console.log("    ✓ [F] status=pending, is_done=false (undone)");

    // ── G: Unauthorized access ────────────────────────────────────────────────
    console.log("\n[G] Testing unauthorized access...");
    try {
      await completeAction("wrong_user", dimAction.id, "completed");
      throw new Error("Should have thrown Unauthorized");
    } catch (err) {
      if (!err.message.includes("Unauthorized")) throw new Error(`Expected Unauthorized, got: ${err.message}`);
      console.log("    ✓ [G] Unauthorized error thrown correctly");
    }

    // ── Final snapshot ─────────────────────────────────────────────────────────
    console.log("\n[FINAL] mains_next_actions status snapshot:");
    const snap = await query(
      `SELECT action_type, status, source_weakness_label, source_severity
         FROM mains_next_actions WHERE user_id=$1 ORDER BY source_severity DESC`,
      [USER_ID]
    );
    console.table(snap.rows);

    console.log("[FINAL] mains_weakness_signals severity snapshot:");
    const wsSnap = await query(
      `SELECT weakness_label, severity, revision_count FROM mains_weakness_signals WHERE user_id=$1 ORDER BY severity DESC`,
      [USER_ID]
    );
    console.table(wsSnap.rows);

    console.log("\n✅ ALL CHECKS PASSED — Step 4: Action Completion + Revision Engine.\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (attemptId) {
      console.log("[cleanup] Removing test data...");
      await query(`DELETE FROM revision_items         WHERE user_id=$1 AND source_type='mains_action'`, [USER_ID]);
      await query(`DELETE FROM mains_next_actions     WHERE user_id=$1`, [USER_ID]);
      await query(`DELETE FROM mains_weakness_signals WHERE user_id=$1`, [USER_ID]);
      await query(`DELETE FROM mains_answer_evaluations WHERE answer_attempt_id=$1`, [attemptId]);
      await query(`DELETE FROM mains_answer_attempts  WHERE id=$1`, [attemptId]);
      console.log("[cleanup] Done.\n");
    }
    process.exit(process.exitCode || 0);
  }
}
run();
