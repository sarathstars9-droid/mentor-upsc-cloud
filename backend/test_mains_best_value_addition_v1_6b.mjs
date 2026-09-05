import { validateAndNormalizeV1Payload } from "./services/ai/mainsEvaluationSchema.js";

async function runTests() {
  console.log("=== BATCH B BEST VALUE ADDITION TEST (V1.6B) ===");
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // 1. LEGACY D -> VISUAL, CONCEPT_DIAGRAM
  const oldD = { best_value_addition: { type: "D" } };
  const normD = validateAndNormalizeV1Payload(oldD);
  assert(normD.best_value_addition.mode === "VISUAL" && normD.best_value_addition.subtype === "CONCEPT_DIAGRAM", "Legacy D maps to VISUAL/CONCEPT_DIAGRAM");

  // 2. NEW V2 VISUAL
  const v2Visual = {
    best_value_addition: {
      mode: "VISUAL", subtype: "BAR_CHART", evidence_reference: { status: "TRUSTED_RAG" }, visual_spec: { type: "BAR_CHART" }
    }
  };
  const normV2 = validateAndNormalizeV1Payload(v2Visual);
  assert(normV2.best_value_addition.mode === "VISUAL" && normV2.best_value_addition.subtype === "BAR_CHART", "V2 mode/subtype preserved correctly");

  // 3. QUESTION_PROVIDED DATA
  const qData = {
    best_value_addition: { mode: "VISUAL", subtype: "PIE_CHART", evidence_reference: { status: "QUESTION_PROVIDED" } }
  };
  assert(validateAndNormalizeV1Payload(qData).best_value_addition.subtype === "PIE_CHART", "QUESTION_PROVIDED DATA: allowed");

  // 4. VERIFIED_EVIDENCE DATA
  const vData = {
    best_value_addition: { mode: "VISUAL", subtype: "LINE_GRAPH", evidence_reference: { status: "VERIFIED_EVIDENCE" } }
  };
  assert(validateAndNormalizeV1Payload(vData).best_value_addition.subtype === "LINE_GRAPH", "VERIFIED_EVIDENCE DATA: allowed");

  // 5. FAKE DATA BLOCK
  const fakeData = {
    best_value_addition: { mode: "VISUAL", subtype: "BAR_CHART", evidence_reference: { status: "NONE" } }
  };
  assert(validateAndNormalizeV1Payload(fakeData).best_value_addition.subtype !== "BAR_CHART", "FAKE DATA BLOCK: blocked");

  // 6. SAFE QUANTITATIVE FALLBACK
  const fakeDataNorm = validateAndNormalizeV1Payload(fakeData);
  assert(fakeDataNorm.best_value_addition.subtype === "CONCEPT_DIAGRAM", "SAFE QUANTITATIVE FALLBACK: changed to CONCEPT_DIAGRAM");

  // 7. MISSING PROVENANCE COMPLETELY
  const missingProv = {
    best_value_addition: { mode: "VISUAL", subtype: "BAR_CHART" }
  };
  const missingNorm = validateAndNormalizeV1Payload(missingProv);
  assert(missingNorm.best_value_addition.subtype === "CONCEPT_DIAGRAM", "FAKE DATA BLOCK: missing provenance blocked");

  console.log(`\nResults: ${passed}/${total} passed.`);
}

runTests().catch(console.error);
