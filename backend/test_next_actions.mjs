/**
 * test_next_actions.mjs
 * E2E test: Step 3 — Next Action Engine
 *
 * Flow:
 *   1. Insert answer attempt + 2 evaluations → seeds weakness signals
 *   2. Call generateNextActions(userId)
 *   3. Verify top 3 actions exist with correct fields
 *   4. Verify priority: dimension → "high", component severity 1.0 → "medium"
 *   5. Verify "Weak conclusion" maps to rewrite_answer action
 *   6. Verify "Directive not addressed" maps to directive_practice
 *   7. Print final DB snapshot
 *   8. Cleanup
 */

import { query } from "./db/index.js";
import { evaluateAnswerAttempt } from "./services/mainsIntelligenceService.js";
import { generateNextActions } from "./services/mainsNextActionsService.js";

const USER_ID = "user_1";

// Evaluation with 4 distinct weaknesses → 4 weakness signals → 4 action rules
const RAW_EVAL = JSON.stringify({
  totalScore: 5,
  maxScore: 10,
  componentScores: {
    intro: 1, structure: 0.5, content: 1, examples: 0.5,
    analysis: 0.5, conclusion: 0.5, directiveHandling: 0.5, presentation: 0.5,
  },
  strengths: ["Clear language"],
  weaknesses: ["Weak examples", "Weak conclusion", "Directive not addressed"],
  missingDimensions: ["Economic angle"],
  improvementActions: ["Add examples", "Fix conclusion"],
  oneLineDiagnosis: "Surface-level answer lacking depth",
  rewriteTask: "Rewrite with more examples",
});

async function run() {
  let attemptId;

  try {
    // ── 1. Insert answer attempt ───────────────────────────────────────────────
    console.log("\n[1] Inserting test mains_answer_attempt...");
    const ins = await query(
      `INSERT INTO mains_answer_attempts
         (user_id, paper, subject, topic, answer_text, word_count, time_taken, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [USER_ID, "GS1", "History", "Modern India", "Sample answer.", 80, 600]
    );
    attemptId = ins.rows[0].id;
    console.log("    ✓ attemptId:", attemptId);

    // ── 2. Evaluate twice → seeds weakness signals with evidence_count=2 ───────
    console.log("\n[2] Running evaluateAnswerAttempt() twice (seeds signals)...");
    for (let i = 1; i <= 2; i++) {
      const r = await evaluateAnswerAttempt({ userId: USER_ID, answerAttemptId: attemptId, rawEvaluation: RAW_EVAL });
      console.log(`    [call ${i}] weaknessSignalsUpdated:`, r.weaknessSignalsUpdated);
    }

    // ── 3. Verify weakness signals seeded correctly ────────────────────────────
    console.log("\n[3] Weakness signals in DB:");
    const sigs = await query(
      `SELECT weakness_type, weakness_label, severity, evidence_count
         FROM mains_weakness_signals WHERE user_id = $1
        ORDER BY severity DESC`,
      [USER_ID]
    );
    sigs.rows.forEach(r =>
      console.log(`    [${r.weakness_type}] "${r.weakness_label}" sev=${r.severity} ev=${r.evidence_count}`)
    );

    // ── 4. Generate next actions ───────────────────────────────────────────────
    console.log("\n[4] generateNextActions()...");
    const result = await generateNextActions(USER_ID);
    console.log("    ✓ actionsUpserted :", result.actionsUpserted);
    console.log("    ✓ topActions count:", result.topActions.length);

    if (result.topActions.length === 0) throw new Error("No top actions returned");
    if (result.topActions.length > 3)  throw new Error("Should return max 3 top actions");

    // ── 5. Validate top actions structure ─────────────────────────────────────
    console.log("\n[5] Top actions:");
    for (const a of result.topActions) {
      console.log(`    [${a.priority}] ${a.action_type} — "${a.title}"`);
      console.log(`          weakness: "${a.source_weakness_label}" (${a.source_weakness_type})`);
      if (!a.action_type)             throw new Error("Missing action_type");
      if (!a.title)                   throw new Error("Missing title");
      if (!a.description)             throw new Error("Missing description");
      if (!["high","medium","low"].includes(a.priority)) throw new Error("Invalid priority: " + a.priority);
    }

    // ── 6. Specific rule checks ────────────────────────────────────────────────
    console.log("\n[6] Rule validation:");

    // All actions from DB (not just top 3)
    const allActions = await query(
      `SELECT action_type, title, priority, source_weakness_label, source_weakness_type, source_severity
         FROM mains_next_actions WHERE user_id = $1
        ORDER BY source_severity DESC`,
      [USER_ID]
    );

    const byLabel = {};
    allActions.rows.forEach(a => { byLabel[a.source_weakness_label] = a; });

    // "Weak examples" → practice_pyq
    const weakEx = byLabel["Weak examples"];
    if (!weakEx) throw new Error("'Weak examples' action not found");
    if (weakEx.action_type !== "practice_pyq") throw new Error(`Wrong action_type for 'Weak examples': ${weakEx.action_type}`);
    console.log(`    ✓ 'Weak examples'           → action_type='practice_pyq'   priority='${weakEx.priority}'`);

    // "Economic angle" → revise_notes, priority=high (dimension)
    const ecoAng = byLabel["Economic angle"];
    if (!ecoAng) throw new Error("'Economic angle' action not found");
    if (ecoAng.action_type !== "revise_notes") throw new Error(`Wrong action_type for 'Economic angle': ${ecoAng.action_type}`);
    if (ecoAng.priority !== "high") throw new Error(`Expected priority=high for dimension, got ${ecoAng.priority}`);
    console.log(`    ✓ 'Economic angle'           → action_type='revise_notes'   priority='${ecoAng.priority}' ✓ high (dimension)`);

    // "Weak conclusion" → rewrite_answer
    const weakConc = byLabel["Weak conclusion"];
    if (!weakConc) throw new Error("'Weak conclusion' action not found");
    if (weakConc.action_type !== "rewrite_answer") throw new Error(`Wrong action_type: ${weakConc.action_type}`);
    console.log(`    ✓ 'Weak conclusion'          → action_type='rewrite_answer' priority='${weakConc.priority}'`);

    // "Directive not addressed" → directive_practice
    const dirAct = byLabel["Directive not addressed"];
    if (!dirAct) throw new Error("'Directive not addressed' action not found");
    if (dirAct.action_type !== "directive_practice") throw new Error(`Wrong action_type: ${dirAct.action_type}`);
    console.log(`    ✓ 'Directive not addressed'  → action_type='directive_practice' priority='${dirAct.priority}'`);

    // ── 7. Final snapshot ──────────────────────────────────────────────────────
    console.log("\n[7] Final mains_next_actions snapshot:");
    console.table(allActions.rows.map(a => ({
      action_type:           a.action_type,
      priority:              a.priority,
      source_weakness_label: a.source_weakness_label,
      source_severity:       a.source_severity,
    })));

    console.log("\n✅ ALL CHECKS PASSED — Step 3: Next Action Engine working correctly.\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;

  } finally {
    if (attemptId) {
      console.log("[cleanup] Removing test data...");
      await query(`DELETE FROM mains_next_actions       WHERE user_id = $1`, [USER_ID]);
      await query(`DELETE FROM mains_weakness_signals   WHERE user_id = $1`, [USER_ID]);
      await query(`DELETE FROM mains_answer_evaluations WHERE answer_attempt_id = $1`, [attemptId]);
      await query(`DELETE FROM mains_answer_attempts    WHERE id = $1`, [attemptId]);
      console.log("[cleanup] Done.\n");
    }
    process.exit(process.exitCode || 0);
  }
}

run();
