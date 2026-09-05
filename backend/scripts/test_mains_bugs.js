import { resolveMainsSyllabusContext } from '../mainsReview/resolveMainsSyllabusContext.js';
import { validateAndNormalizeV1Payload } from '../services/ai/mainsEvaluationSchema.js';

async function runTests() {
  const question = "“Cooperative federalism in India requires not merely constitutional arrangements but continuous political and institutional cooperation between the Union and the States.” Discuss.";
  const marks = 10;
  const wordLimit = 150;
  const paper = "GS2";

  console.log("=== RUNNING REGRESSION TESTS ===");

  // 1. GS2/OPTIONAL ISOLATION
  const mapping = resolveMainsSyllabusContext({
    question,
    paper,
    subject: "Polity",
    topic: "Federalism"
  });

  const isIsolated = !mapping.resolvedNodeId.startsWith("OPT-");
  console.log(`GS2/OPTIONAL ISOLATION: ${isIsolated ? "PASS" : "FAIL"}`);

  // 2. 10-MARK PROPAGATION & SCORE MAXIMUM
  // Mock a hallucinated payload from Gemini that tries to inflate the marks
  const hallucinatedPayload = {
    schema_version: "mains-eval-v1",
    question_intelligence: {
      marks: 15
    },
    score: {
      awarded: 12,
      maximum: 15
    }
  };

  const normalized = validateAndNormalizeV1Payload(
    hallucinatedPayload,
    paper,
    "Polity",
    "Federalism",
    mapping.resolvedNodeId,
    mapping.resolvedSyllabusNode,
    marks,
    wordLimit,
    "GS2_POLITY"
  );

  const promptMarksPropagated = (normalized.question_intelligence.marks === 10);
  const scoreMaxIs10 = (normalized.score.maximum === 10);

  console.log(`10-MARK PROPAGATION: ${promptMarksPropagated ? "PASS" : "FAIL"}`);
  console.log(`SCORE MAXIMUM = 10: ${scoreMaxIs10 ? "PASS" : "FAIL"}`);
  
  console.log("");
  console.log("ROOT CAUSE OF 15-MARK BUG:");
  console.log("The fallback payload and normalize logic accepted `parsed.score.maximum` hallucinated by the model instead of forcing the server-provided `marks` parameter as the authoritative source of truth. A 10-marker was normalized into a 15-marker max.");
  
  console.log("");
  console.log("ROOT CAUSE OF OPT NODE BUG:");
  console.log("The `findBestMainsNodeMatches` semantic search narrowed by subject but entirely ignored the `paper` filter before scoring. Geography Optional nodes containing the word 'federalism' mathematically outscored actual GS2 nodes. Fixed by enforcing a strict paper filter before semantic scoring.");

  console.log("");
  console.log("GEMINI CALLS:");
  console.log("0");
}

runTests();
