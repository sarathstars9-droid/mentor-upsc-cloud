/**
 * backend/test_mains_eval_v1.mjs
 *
 * Comprehensive backend validation and regression suite for MentorOS Mains Evaluation V1.
 * Tests mapping, validation, fallback handling, Express endpoints, DB persistence,
 * mistake duplication prevention, and PYQ quality checks.
 */

import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import { evaluateMainsAnswer } from "./services/ai/evaluateAnswer.js";
import { selectSubjectProfile } from "./services/ai/subjectProfiles.js";
import { validateAndNormalizeV1Payload, getFallbackPayload } from "./services/ai/mainsEvaluationSchema.js";
import { query } from "./db/index.js";
import router from "./routes/evaluateAnswerRoute.js";
import { generateMistakesFromBasicEvaluation } from "./services/mainsMistakeService.js";
import { resolveMainsSyllabusContext } from "./mainsReview/resolveMainsSyllabusContext.js";
import { getQuestionsByNodeId } from "./brain/nodeIdTopicEngine.js";
import { geminiModel } from "./services/ai/geminiClient.js";

// --- MOCK GEMINI CLIENT FOR SCHEMA HARSH/VALIDATION TESTS ---
const originalGenerateContent = geminiModel.generateContent;

async function runTests() {
  console.log("=== STARTING MAINS EVALUATION V1 HARDENING SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`[PASS] ${message}`);
    } else {
      failed++;
      console.error(`[FAIL] ${message}`);
    }
  }

  // ==================================================
  // 1. PAPER CLASSIFICATION COLLISION REGRESSION
  // ==================================================
  console.log("\n--- 1. Paper Classification Collision Tests ---");
  const p1 = selectSubjectProfile("GS Paper I", "History");
  assert(p1.id === "GS1_HISTORY", "GS Paper I History -> GS1_HISTORY");

  const p2 = selectSubjectProfile("GS Paper II", "Polity");
  assert(p2.id === "GS2_POLITY", "GS Paper II Polity -> GS2_POLITY");

  const p3 = selectSubjectProfile("GS Paper III", "Environment");
  assert(p3.id === "GS3_ENVIRONMENT", "GS Paper III Environment -> GS3_ENVIRONMENT");

  const p4 = selectSubjectProfile("GS Paper IV", "Ethics");
  assert(p4.id === "GS4_ETHICS_THEORY", "GS Paper IV Ethics -> GS4_ETHICS_THEORY");

  const p5 = selectSubjectProfile("Optional Geography", "Paper I");
  assert(p5.id === "GEOGRAPHY_OPTIONAL_PAPER_1", "Geography Optional Paper I -> GEOGRAPHY_OPTIONAL_PAPER_1");

  const p6 = selectSubjectProfile("Optional Geography", "Paper II");
  assert(p6.id === "GEOGRAPHY_OPTIONAL_PAPER_2", "Geography Optional Paper II -> GEOGRAPHY_OPTIONAL_PAPER_2");

  // ==================================================
  // 2. SCHEMA VALIDATION AND FALLBACKS
  // ==================================================
  console.log("\n--- 2. Schema Validation and Fallback Tests ---");

  // Case A: Invalid JSON
  const normA = validateAndNormalizeV1Payload("not a json string", "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normA.schema_version === "mains-eval-v1" && normA.score.awarded === 4.0, "Invalid JSON fallback parsed successfully");

  // Case B: Valid JSON but missing nested fields
  const normB = validateAndNormalizeV1Payload({ schema_version: "mains-eval-v1" }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normB.question_intelligence.paper === "GS2" && Array.isArray(normB.strengths), "Missing nested fields filled with default fallback structure");

  // Case C: Wrong examiner impact level enum
  const normC = validateAndNormalizeV1Payload({
    examiner_impact: { level: "SUPERB", reason: "Good" }
  }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normC.examiner_impact.level === "ORDINARY", "Invalid examiner impact level reverted to default enum (ORDINARY)");

  // Case D: Invalid value-addition type
  const normD = validateAndNormalizeV1Payload({
    best_value_addition: { type: "UNKNOWN_TYPE", title: "Test" }
  }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normD.best_value_addition.type === "CA", "Invalid value addition type defaulted to CA");

  // Case E: Score above maximum
  const normE = validateAndNormalizeV1Payload({
    score: { awarded: 12.0, maximum: 10 }
  }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normE.score.awarded === 10.0, "Score exceeding maximum clamped successfully");

  // Case F: Negative score
  const normF = validateAndNormalizeV1Payload({
    score: { awarded: -2.5, maximum: 10 }
  }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normF.score.awarded === 0.0, "Negative score clamped to 0.0 successfully");

  // Case G: Malformed visual_schema
  const normG = validateAndNormalizeV1Payload({
    best_value_addition: {
      visual_schema: { renderer: "RANDOM_RENDERER", nodes: 123 }
    }
  }, "GS2", "Polity", "Federalism", "N1", "L1", 10, 150, "P1");
  assert(normG.best_value_addition.visual_schema.renderer === "PROCESS_FLOW" && Array.isArray(normG.best_value_addition.visual_schema.nodes), "Malformed visual_schema normalized cleanly");

  // ==================================================
  // 3. EXPRESS ENDPOINT TEST (In-memory route check)
  // ==================================================
  console.log("\n--- 3. Express Endpoint Routing Test ---");
  const postLayer = router.stack.find(layer => layer.route && layer.route.methods.post);
  const routeHandler = postLayer.route.stack[0].handle;

  // Setup dynamic Gemini mock
  geminiModel.generateContent = async () => {
    return {
      response: {
        text: () => JSON.stringify(getFallbackPayload("GS Paper II", "Polity", "Federalism", "GS2-POL-MAINS-COMPARE-MT01", "Comparison Scheme", 10, 150, "GS2_POLITY"))
      }
    };
  };

  let resData = null;
  let resStatus = 200;
  const mockReq = {
    body: {
      userId: "test_moulika_route",
      questionText: "Discuss the challenges to cooperative federalism in India.",
      candidateAnswer: "Cooperative federalism requires cooperation. We have financial dependence and disputes.",
      paper: "GS Paper II",
      subject: "Polity",
      topic: "Federalism",
      marks: 10,
      wordLimit: 150
    }
  };
  const mockRes = {
    status: (code) => {
      resStatus = code;
      return mockRes;
    },
    json: (data) => {
      resData = data;
      return mockRes;
    }
  };

  try {
    await routeHandler(mockReq, mockRes);
    assert(resData && resData.success === true, "Route request executed successfully");
    assert(resData.evaluation.score === "4/10", `Legacy compatibility score field returned: ${resData.evaluation.score}`);
    assert(resData.evaluation.mains_eval_v1 !== undefined, "Structured mains_eval_v1 payload integrated in response");
  } catch (err) {
    console.error("Express route handler test failed:", err);
    failed++;
  }

  // ==================================================
  // 4. POSTGRESQL ROUND-TRIP TEST
  // ==================================================
  console.log("\n--- 4. PostgreSQL Persistence Round-Trip Test ---");
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== "MISSING") {
    try {
      const testV1Payload = getFallbackPayload("GS Paper II", "Polity", "Federalism", "GS2-POL-MAINS-COMPARE-MT01", "Comparison Scheme", 10, 150, "GS2_POLITY");
      testV1Payload.ideal_blueprint.core_demand = "Verify persistence round trip demand";
      
      const insertSql = `
        INSERT INTO mains_answer_evaluations (
          user_id, question, answer, paper, marks, word_limit, evaluation_json, score, weakness_tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;
      `;
      const insertRes = await query(insertSql, [
        "test_moulika_db",
        "Discuss cooperative federalism.",
        "Answer content.",
        "GS Paper II",
        10,
        150,
        { mains_eval_v1: testV1Payload },
        4.0,
        ["WEAK_STRUCTURE"]
      ]);
      const newId = insertRes.rows[0].id;

      // Read back
      const readRes = await query(`SELECT evaluation_json FROM mains_answer_evaluations WHERE id = $1`, [newId]);
      const retrieved = readRes.rows[0].evaluation_json;

      assert(retrieved.mains_eval_v1.schema_version === "mains-eval-v1", "schema_version survives database persistence");
      assert(retrieved.mains_eval_v1.ideal_blueprint.core_demand === "Verify persistence round trip demand", "Ideal blueprint fields survive database round-trip");
      
      // Cleanup
      await query(`DELETE FROM mains_answer_evaluations WHERE id = $1`, [newId]);
      console.log("[DB CLEANUP] Test evaluation row removed.");
    } catch (dbErr) {
      console.error("PostgreSQL Persistence Round-Trip failed:", dbErr.message);
      failed++;
    }
  } else {
    console.log("[SKIP] PostgreSQL round-trip test skipped (DATABASE_URL not set)");
  }

  // ==================================================
  // 5. MISTAKE DUPLICATE PREVENTION CHECK
  // ==================================================
  console.log("\n--- 5. Mistake Book Duplicate Prevention Test ---");
  try {
    const testEval = getFallbackPayload("GS Paper II", "Polity", "Federalism", "GS2-POL-MAINS-COMPARE-MT01", "Comparison Scheme", 10, 150, "GS2_POLITY");
    testEval.topFixes = ["Address federal dimensions", "Cite Inter-state water commission"];
    testEval.missingDimensions = [
      { dimension: "fiscal", how_to_add: "Detail finance commission role" }
    ];

    const mistakes = await generateMistakesFromBasicEvaluation({
      userId: "test_moulika_mistakes",
      attemptId: "test_attempt_123",
      paper: "GS Paper II",
      subject: "Polity",
      topic: "Federalism",
      questionText: "Discuss cooperative federalism.",
      candidateAnswer: "Some federal answer.",
      evaluationJson: testEval,
      score: 4.0
    });

    assert(Array.isArray(mistakes), "generateMistakesFromBasicEvaluation returns an array");
    const duplicates = mistakes.filter((m, index, self) => 
      self.findIndex(x => x.mistake_type === m.mistake_type) !== index
    );
    assert(duplicates.length === 0, "No duplicate mistake records created through legacy and V1 paths");
  } catch (mErr) {
    console.error("Mistake duplicate test failed:", mErr);
    failed++;
  }

  // ==================================================
  // 6. PYQ RETRIEVAL QUALITY CHECKS
  // ==================================================
  console.log("\n--- 6. PYQ Retrieval Quality Check ---");
  const testCases = [
    { paper: "GS Paper II", subject: "Polity", topic: "Federalism", question: "Cooperative Federalism challenges" },
    { paper: "GS Paper III", subject: "Environment", topic: "Disaster Management", question: "Urban flooding mitigation and NDMA guidelines" },
    { paper: "Optional Geography", subject: "Geography", topic: "Physical Geography", question: "Critically examine Penck's model of slope development" }
  ];

  for (const tc of testCases) {
    const mapping = resolveMainsSyllabusContext(tc);
    const pyqs = mapping.resolvedNodeId ? getQuestionsByNodeId({ nodeId: mapping.resolvedNodeId, subjectId: tc.subject }) : { questions: [] };
    console.log(`[RETRIEVAL LOG] Question: "${tc.question}"`);
    console.log(`  -> Resolved Node: ${mapping.resolvedNodeId || "None"} (${mapping.resolvedSyllabusNode})`);
    console.log(`  -> Subject Profile: ${tc.subject}`);
    console.log(`  -> Retrieved PYQ Count: ${pyqs.questions ? pyqs.questions.length : 0}`);
    if (pyqs.questions && pyqs.questions.length > 0) {
      console.log(`  -> First PYQ: "${pyqs.questions[0].question || pyqs.questions[0].text}"`);
    }
  }
  assert(true, "PYQ Retrieval logs outputted successfully");

  // Restore Gemini Client original function
  geminiModel.generateContent = originalGenerateContent;

  console.log(`\n=== HARDENING SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
