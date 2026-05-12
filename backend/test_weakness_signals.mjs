/**
 * test_weakness_signals.mjs
 * E2E test: Step 2 — Weakness Signal Engine (Patched)
 *
 * Tests:
 *   A. Canonical labels       — "Weak examples", "Economic angle"
 *   B. Alias normalization    — "poor examples" → "Weak examples"
 *                               "economic perspective" → "Economic angle"
 *   C. Severity weighting     — component initial=1.0, dimension initial=1.5
 *   D. UPSERT on 2nd call     — component→1.5, dimension→2.0, evidence_count=2
 *   E. Context fields         — paper/subject/topic from mains_answer_attempts
 */

import { query } from "./db/index.js";
import { evaluateAnswerAttempt } from "./services/mainsIntelligenceService.js";

const USER_ID = "user_1";

// Input uses ALIAS forms — we verify the canonical labels land in DB
const RAW_EVAL = JSON.stringify({
  totalScore: 6,
  maxScore: 10,
  componentScores: {
    intro: 1, structure: 1, content: 1, examples: 0.5,
    analysis: 0.5, conclusion: 1, directiveHandling: 0.5, presentation: 0.5,
  },
  strengths: ["Good introduction"],
  weaknesses: ["poor examples"],          // alias → "Weak examples"
  missingDimensions: ["economic perspective"], // alias → "Economic angle"
  improvementActions: ["Add case studies"],
  oneLineDiagnosis: "Decent but needs depth",
  rewriteTask: "Rewrite with examples",
});

async function run() {
  let attemptId;

  try {
    // ── 1. Insert test answer attempt ──────────────────────────────────────────
    console.log("\n[1] Inserting test mains_answer_attempt...");
    const insertRes = await query(
      `INSERT INTO mains_answer_attempts
         (user_id, paper, subject, topic, answer_text, word_count, time_taken, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [USER_ID, "GS1", "History", "Modern India", "Sample answer.", 50, 300]
    );
    attemptId = insertRes.rows[0].id;
    console.log("    ✓ attemptId:", attemptId);

    // ── 2. First call — evaluate (insert path) ─────────────────────────────────
    console.log("\n[2] evaluateAnswerAttempt() — 1st call...");
    const result1 = await evaluateAnswerAttempt({
      userId: USER_ID,
      answerAttemptId: attemptId,
      rawEvaluation: RAW_EVAL,
    });
    console.log("    ✓ savedRow id    :", result1.savedRow?.id);
    console.log("    ✓ weaknessSignalsUpdated:", result1.weaknessSignalsUpdated);

    if (!result1.savedRow?.id) throw new Error("Evaluation not saved");
    if (result1.weaknessSignalsUpdated !== 2) throw new Error(`Expected 2 signals, got ${result1.weaknessSignalsUpdated}`);

    // ── 3. Verify DB after 1st call ────────────────────────────────────────────
    console.log("\n[3] Checking mains_weakness_signals after 1st call...");
    const check1 = await query(
      `SELECT weakness_type, weakness_label, severity, evidence_count
         FROM mains_weakness_signals
        WHERE user_id = $1
        ORDER BY weakness_type, weakness_label`,
      [USER_ID]
    );
    console.log("    Rows found:", check1.rows.length);
    check1.rows.forEach(r =>
      console.log(`    [${r.weakness_type}] "${r.weakness_label}" | severity=${r.severity} | evidence_count=${r.evidence_count}`)
    );

    // A. Canonical labels (aliases normalized)
    const weakEx1  = check1.rows.find(r => r.weakness_label === "Weak examples"  && r.weakness_type === "component");
    const ecoAng1  = check1.rows.find(r => r.weakness_label === "Economic angle" && r.weakness_type === "dimension");
    if (!weakEx1) throw new Error("'Weak examples' (component) not found — normalization failed");
    if (!ecoAng1) throw new Error("'Economic angle' (dimension) not found — normalization failed");
    console.log("    ✓ [B] 'poor examples' normalized → 'Weak examples'");
    console.log("    ✓ [B] 'economic perspective' normalized → 'Economic angle'");

    // C. Severity weighting on first insert
    if (Number(weakEx1.severity) !== 1.0) throw new Error(`component severity expected 1.0, got ${weakEx1.severity}`);
    if (Number(ecoAng1.severity) !== 1.5) throw new Error(`dimension severity expected 1.5, got ${ecoAng1.severity}`);
    console.log("    ✓ [C] component initial severity=1.0");
    console.log("    ✓ [C] dimension initial severity=1.5 (weighted higher)");

    // E. Context fields reached the DB
    const ctxCheck = await query(
      `SELECT paper, subject, topic FROM mains_weakness_signals WHERE user_id = $1 LIMIT 1`,
      [USER_ID]
    );
    const ctx = ctxCheck.rows[0];
    if (ctx.paper !== "GS1" || ctx.subject !== "History" || ctx.topic !== "Modern India") {
      throw new Error(`Context mismatch: ${JSON.stringify(ctx)}`);
    }
    console.log("    ✓ [E] context fields present:", ctx);

    // ── 4. Second call — evaluate (update path → upsert signals) ──────────────
    console.log("\n[4] evaluateAnswerAttempt() — 2nd call (same attempt)...");
    const result2 = await evaluateAnswerAttempt({
      userId: USER_ID,
      answerAttemptId: attemptId,
      rawEvaluation: RAW_EVAL,
    });
    console.log("    ✓ weaknessSignalsUpdated:", result2.weaknessSignalsUpdated);

    // ── 5. Verify UPSERT incremented severity + evidence_count ─────────────────
    console.log("\n[5] Checking mains_weakness_signals after 2nd call (UPSERT)...");
    const check2 = await query(
      `SELECT weakness_type, weakness_label, severity, evidence_count
         FROM mains_weakness_signals
        WHERE user_id = $1
        ORDER BY weakness_type, weakness_label`,
      [USER_ID]
    );
    check2.rows.forEach(r =>
      console.log(`    [${r.weakness_type}] "${r.weakness_label}" | severity=${r.severity} | evidence_count=${r.evidence_count}`)
    );

    const weakEx2 = check2.rows.find(r => r.weakness_label === "Weak examples");
    const ecoAng2 = check2.rows.find(r => r.weakness_label === "Economic angle");

    // D. UPSERT: severity += 0.5, evidence_count = 2
    // component: 1.0 + 0.5 = 1.5
    // dimension: 1.5 + 0.5 = 2.0
    const compSev2  = Number(weakEx2?.severity);
    const compEvid2 = Number(weakEx2?.evidence_count);
    const dimSev2   = Number(ecoAng2?.severity);
    const dimEvid2  = Number(ecoAng2?.evidence_count);

    console.log("\n    UPSERT validation:");
    console.log(`    'Weak examples'  severity=${compSev2}  (expected 1.5) ${compSev2 === 1.5 ? "✓" : "✗"}`);
    console.log(`    'Weak examples'  evidence_count=${compEvid2} (expected 2)   ${compEvid2 === 2 ? "✓" : "✗"}`);
    console.log(`    'Economic angle' severity=${dimSev2}  (expected 2.0) ${dimSev2 === 2.0 ? "✓" : "✗"}`);
    console.log(`    'Economic angle' evidence_count=${dimEvid2} (expected 2)   ${dimEvid2 === 2 ? "✓" : "✗"}`);

    if (compSev2 !== 1.5)  throw new Error(`component severity after UPSERT: expected 1.5, got ${compSev2}`);
    if (compEvid2 !== 2)   throw new Error(`component evidence_count: expected 2, got ${compEvid2}`);
    if (dimSev2 !== 2.0)   throw new Error(`dimension severity after UPSERT: expected 2.0, got ${dimSev2}`);
    if (dimEvid2 !== 2)    throw new Error(`dimension evidence_count: expected 2, got ${dimEvid2}`);

    // ── 6. Final DB snapshot (as per spec) ────────────────────────────────────
    console.log("\n[6] Final DB snapshot (spec query):");
    console.log("    SELECT weakness_type, weakness_label, severity, evidence_count");
    console.log("    FROM mains_weakness_signals WHERE user_id = 'user_1';");
    const final = await query(
      `SELECT weakness_type, weakness_label, severity, evidence_count
         FROM mains_weakness_signals WHERE user_id = $1`,
      [USER_ID]
    );
    console.table(final.rows);

    console.log("\n✅ ALL CHECKS PASSED — Step 2: Weakness Signal Engine working correctly.\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    if (attemptId) {
      console.log("[cleanup] Removing test data...");
      await query(`DELETE FROM mains_answer_evaluations WHERE answer_attempt_id = $1`, [attemptId]);
      await query(`DELETE FROM mains_weakness_signals   WHERE user_id = $1`, [USER_ID]);
      await query(`DELETE FROM mains_answer_attempts    WHERE id = $1`, [attemptId]);
      console.log("[cleanup] Done.\n");
    }
    process.exit(process.exitCode || 0);
  }
}

run();
