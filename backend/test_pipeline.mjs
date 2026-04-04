// backend/test_pipeline.mjs
// Live end-to-end test of the mains review pipeline endpoints.
// Run: node test_pipeline.mjs
// Requires backend running on localhost:8787

const BASE = "http://localhost:8787";

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  return { status: r.status, json };
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const json = await r.json();
  return { status: r.status, json };
}

// ─── Real sample pasted review (structured A–I format) ────────────────────────
const SAMPLE_REVIEW_TEXT = `A. Marks Awarded
10/15
Justification: The answer covers the social role of women but lacks economic and political dimensions, missing key figures and constitutional references.

B. Directive Word Handling
Directive word: Discuss
Was it handled: Partly
The answer provides some dimensions of women's participation but does not critically analyse the transformative impact on the independence movement's nature and ideology.

C. Structure Review
Intro quality: Average
Body organization: Average
Conclusion quality: Weak
The introduction lacks a hook or context-setting statement. Body paragraphs are loosely connected. Conclusion is abrupt and does not synthesize the argument.

D. Content Strength
Strengths:
- Mentions Non-Cooperation, Civil Disobedience, and Quit India movements
- Names Sarojini Naidu and Annie Besant

Missing dimensions:
- Economic participation: spinning charkha, boycott of foreign goods
- Constitutional angle: demand for adult franchise, representation in legislatures
- Regional leaders: Kalpana Dutt, Lakshmi Sahgal, Matangini Hazra
- Shift from elite to mass movement — women's entry democratized the struggle

Factual weaknesses:
- No reference to the role of women in the INA (Rani of Jhansi Regiment)
- No data on how many women were imprisoned during Quit India

E. Examiner Concerns
1. The answer treats women as passive participants, not agents of transformation
2. Missing analysis of how women's entry changed the nature of the movement from elite to mass
3. No mention of constitutional or legislative milestones post-1920
4. Directive word 'discuss' requires multi-dimensional exploration — only 2 dimensions covered
5. Conclusion adds no new synthesis and reads like a repetition

F. AIR-1 Upgrade Advice
1. Add a structured intro: "The entry of women into India's freedom struggle post-1920 democratized, radicalized, and gave moral authority to the independence movement."
2. Expand economic dimension: charkha, boycott of foreign goods, picketing liquor shops
3. Include the Rani of Jhansi Regiment and Aruna Asaf Ali's underground role in Quit India
4. Add a dimension on how women's participation forced the Congress to take up gender equality in its programmes
5. Conclude with the legacy: Article 15, political representation, and the continuing relevance to gender justice

G. Rewrite Blueprint
Intro: Women as agents of transformation, not just participants
Body point 1: Pre-1920 — limited but symbolic (Annie Besant, Home Rule)
Body point 2: Non-Cooperation — mass entry, spinning charkha, khadi
Body point 3: Civil Disobedience — salt satyagraha, picketing, arrests
Body point 4: Quit India — Aruna Asaf Ali, underground movement
Body point 5: INA — Rani of Jhansi Regiment, Lakshmi Sahgal
Conclusion: Transformation of movement nature — from elite to mass, from petitions to direct action; constitutional legacy

H. Mistake Classification
- poor directive handling
- weak conclusion
- low dimensionality
- no examples
- weak analysis
- missed core demand

I. Final Verdict
Good but not ranker level`;

// ─── Run all 4 steps ──────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("STEP 1: POST /api/mains/attempt/save");
  console.log("═══════════════════════════════════════════════════════════════");

  const attemptPayload = {
    userId: "test_user_001",
    source: { paper: "GS1", questionId: "GS1_2023_Q14", questionMarks: 15, year: 2023 },
    question: {
      text: "Discuss the significance of women's participation in the freedom struggle of India. How did it transform the nature of the independence movement?",
      marks: 15,
      wordLimit: 250,
      paper: "GS1",
    },
    writingSession: {
      startedAt: "2026-04-04T20:00:00.000Z",
      completedAt: "2026-04-04T20:18:00.000Z",
      durationMinutes: 18,
      wordCount: 238,
    },
    answerUpload: {
      method: "typed",
      extractedText: "Women played a pivotal role in India's freedom struggle. They participated in the Non-Cooperation Movement, Civil Disobedience, and Quit India Movement. Leaders like Sarojini Naidu, Annie Besant, and Aruna Asaf Ali gave new dimensions to the struggle. The entry of women brought mass character to the movement.",
    },
    selfReview: {
      selfScore: 10,
      selfNote: "Covered social dimensions but missed economic angle",
    },
  };

  console.log("\n[REQUEST PAYLOAD]");
  console.log(JSON.stringify(attemptPayload, null, 2));

  const step1 = await post("/api/mains/attempt/save", attemptPayload);
  console.log("\n[RESPONSE]  HTTP " + step1.status);
  console.log(JSON.stringify(step1.json, null, 2));

  if (!step1.json.ok) {
    console.error("\nSTEP 1 FAILED — aborting");
    process.exit(1);
  }

  const attemptId = step1.json.attemptId;
  console.log("\n[CREATED FILE]  data/mains_reviews/attempts/" + attemptId + ".json");

  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("STEP 2: POST /api/mains/review/save");
  console.log("═══════════════════════════════════════════════════════════════");

  const reviewPayload = {
    attemptId,
    userId: "test_user_001",
    reviewSource: { type: "chatgpt_pasted" },
    rawReviewText: SAMPLE_REVIEW_TEXT,
    userAgreement: { value: "agree", note: "Looks accurate" },
  };

  console.log("\n[REQUEST PAYLOAD]");
  console.log(JSON.stringify({ ...reviewPayload, rawReviewText: "(see SAMPLE_REVIEW_TEXT above — " + SAMPLE_REVIEW_TEXT.length + " chars)" }, null, 2));

  const step2 = await post("/api/mains/review/save", reviewPayload);
  console.log("\n[RESPONSE]  HTTP " + step2.status);
  console.log(JSON.stringify(step2.json, null, 2));

  if (!step2.json.ok) {
    console.error("\nSTEP 2 FAILED — aborting");
    process.exit(1);
  }

  const reviewId = step2.json.reviewId;
  console.log("\n[CREATED FILE]  data/mains_reviews/reviews/" + reviewId + ".json");

  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("STEP 3: POST /api/mains/review/process");
  console.log("═══════════════════════════════════════════════════════════════");

  const processPayload = { attemptId, reviewId };
  console.log("\n[REQUEST PAYLOAD]");
  console.log(JSON.stringify(processPayload, null, 2));

  const step3 = await post("/api/mains/review/process", processPayload);
  console.log("\n[RESPONSE]  HTTP " + step3.status);
  console.log(JSON.stringify(step3.json, null, 2));

  if (!step3.json.ok) {
    console.error("\nSTEP 3 FAILED — aborting");
    process.exit(1);
  }

  console.log("\n[DERIVED FILE]  data/mains_reviews/derived/" + attemptId + "_" + reviewId + ".json");

  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("STEP 4: GET /api/mains/review/result");
  console.log("═══════════════════════════════════════════════════════════════");

  const step4 = await get(`/api/mains/review/result?attemptId=${attemptId}&reviewId=${reviewId}`);
  console.log("\n[RESPONSE]  HTTP " + step4.status);
  console.log(JSON.stringify(step4.json, null, 2));

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("ALL 4 STEPS COMPLETE");
  console.log("attemptId: " + attemptId);
  console.log("reviewId:  " + reviewId);
  console.log("═══════════════════════════════════════════════════════════════");
}

run().catch((e) => {
  console.error("UNCAUGHT ERROR:", e);
  process.exit(1);
});
