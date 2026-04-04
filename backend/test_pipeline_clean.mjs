// backend/test_pipeline_clean.mjs
// Writes structured results to test_results.json — no stdout mangling.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:8787";
const OUT  = path.join(__dirname, "test_results.json");

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function get(url) {
  const r = await fetch(url);
  return { status: r.status, body: await r.json() };
}

const SAMPLE_REVIEW = `A. Marks Awarded
10/15
Justification: The answer covers the social role of women but lacks economic and political dimensions.

B. Directive Word Handling
Directive word: Discuss
Was it handled: Partly
The answer provides some dimensions but misses the transformative impact analysis.

C. Structure Review
Intro quality: Average
Body organization: Average
Conclusion quality: Weak
Introduction lacks context-setting. Body paragraphs loosely connected. Conclusion is abrupt.

D. Content Strength
Strengths:
- Mentions Non-Cooperation, Civil Disobedience, Quit India movements
- Names Sarojini Naidu and Annie Besant

Missing dimensions:
- Economic participation: spinning charkha, boycott of foreign goods
- Constitutional angle: demand for adult franchise
- Regional leaders: Kalpana Dutt, Matangini Hazra
- Shift from elite to mass movement

Factual weaknesses:
- No reference to Rani of Jhansi Regiment in INA
- No data on women imprisoned during Quit India

E. Examiner Concerns
1. Treats women as passive participants not agents of transformation
2. Missing analysis of how movement changed from elite to mass
3. No mention of constitutional milestones post-1920
4. Directive word requires multi-dimensional exploration only 2 dimensions covered
5. Conclusion adds no synthesis and reads like repetition

F. AIR-1 Upgrade Advice
1. Add structured intro about democratization and moral authority
2. Expand economic dimension: charkha, boycott, pickets
3. Include Rani of Jhansi Regiment and Aruna Asaf Ali underground role
4. Add dimension on how women forced Congress to take up gender equality
5. Conclude with Article 15 constitutional legacy

G. Rewrite Blueprint
Intro: Women as agents of transformation not just participants
Body point 1: Pre-1920 limited but symbolic participation
Body point 2: Non-Cooperation mass entry charkha khadi
Body point 3: Civil Disobedience salt satyagraha arrests
Body point 4: Quit India Aruna Asaf Ali underground
Body point 5: INA Rani of Jhansi Regiment Lakshmi Sahgal
Conclusion: Elite to mass transformation constitutional legacy

H. Mistake Classification
- poor directive handling
- weak conclusion
- low dimensionality
- no examples
- weak analysis
- missed core demand

I. Final Verdict
Good but not ranker level`;

async function run() {
  const results = {};

  // STEP 1
  const attemptPayload = {
    userId: "test_user_001",
    source: { paper: "GS1", questionId: "GS1_2023_Q14", questionMarks: 15, year: 2023 },
    question: {
      text: "Discuss the significance of women participation in the freedom struggle of India. How did it transform the nature of the independence movement?",
      marks: 15, wordLimit: 250, paper: "GS1",
    },
    writingSession: { startedAt: "2026-04-04T20:00:00.000Z", completedAt: "2026-04-04T20:18:00.000Z", durationMinutes: 18, wordCount: 238 },
    answerUpload: { method: "typed", extractedText: "Women played a pivotal role in India freedom struggle. They participated in Non-Cooperation, Civil Disobedience, and Quit India. Leaders like Sarojini Naidu, Annie Besant gave new dimensions." },
    selfReview: { selfScore: 10, selfNote: "Covered social dimensions but missed economic angle" },
  };

  const s1 = await post(`${BASE}/api/mains/attempt/save`, attemptPayload);
  results.step1 = {
    endpoint: "POST /api/mains/attempt/save",
    requestPayload: attemptPayload,
    httpStatus: s1.status,
    response: s1.body,
    createdFile: s1.body.ok ? `data/mains_reviews/attempts/${s1.body.attemptId}.json` : null,
  };

  if (!s1.body.ok) { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); process.exit(1); }
  const attemptId = s1.body.attemptId;

  // STEP 2
  const reviewPayload = {
    attemptId,
    userId: "test_user_001",
    reviewSource: { type: "chatgpt_pasted" },
    rawReviewText: SAMPLE_REVIEW,
    userAgreement: { value: "agree", note: "Looks accurate" },
  };

  const s2 = await post(`${BASE}/api/mains/review/save`, reviewPayload);
  results.step2 = {
    endpoint: "POST /api/mains/review/save",
    requestPayload: { ...reviewPayload, rawReviewText: `(${SAMPLE_REVIEW.length} chars — sections A–I present)` },
    httpStatus: s2.status,
    response: s2.body,
    createdFile: s2.body.ok ? `data/mains_reviews/reviews/${s2.body.reviewId}.json` : null,
  };

  if (!s2.body.ok) { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); process.exit(1); }
  const reviewId = s2.body.reviewId;

  // STEP 3
  const processPayload = { attemptId, reviewId };
  const s3 = await post(`${BASE}/api/mains/review/process`, processPayload);
  results.step3 = {
    endpoint: "POST /api/mains/review/process",
    requestPayload: processPayload,
    httpStatus: s3.status,
    response: s3.body,
    createdFile: s3.body.ok ? `data/mains_reviews/derived/${attemptId}_${reviewId}.json` : null,
  };

  if (!s3.body.ok) { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); process.exit(1); }

  // STEP 4
  const s4 = await get(`${BASE}/api/mains/review/result?attemptId=${attemptId}&reviewId=${reviewId}`);
  results.step4 = {
    endpoint: `GET /api/mains/review/result?attemptId=${attemptId}&reviewId=${reviewId}`,
    httpStatus: s4.status,
    response: s4.body,
  };

  results.summary = {
    allPassed: [s1, s2, s3, s4].every(s => s.status < 300),
    attemptId,
    reviewId,
    derivedFile: `data/mains_reviews/derived/${attemptId}_${reviewId}.json`,
  };

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log("Done. Results written to test_results.json");
}

run().catch(e => { fs.writeFileSync(OUT, JSON.stringify({ fatalError: e.message }, null, 2)); process.exit(1); });
