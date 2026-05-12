// Quick debug: test if the evaluate route is reachable
const payload = {
  userId: "user_1",
  answerAttemptId: "00000000-0000-0000-0000-000000000001",
  rawEvaluation: JSON.stringify({
    totalScore: 5,
    maxScore: 10,
    componentScores: { intro:1, structure:1, content:1, examples:0, analysis:0, conclusion:1, directiveHandling:0, presentation:1 },
    strengths: ["Good intro"],
    weaknesses: ["Weak examples"],
    missingDimensions: ["Economic angle"],
    improvementActions: [],
    oneLineDiagnosis: "Test",
    rewriteTask: ""
  })
};

const res = await fetch("http://localhost:8787/api/mains/evaluate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

console.log("HTTP status:", res.status, res.statusText);
const text = await res.text();
console.log("Response body (first 500 chars):", text.substring(0, 500));
