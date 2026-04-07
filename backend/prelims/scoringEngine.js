// backend/prelims/scoringEngine.js
// UPSC Prelims marking scheme.
//
// GS Paper 1:   +2 per correct,   -2/3  per wrong  (~-0.667)
// CSAT Paper 2: +2.5 per correct, -2.5/3 per wrong (~-0.833)
//
// Source: UPSC CSE official notification.
// Extend SCHEMES if future papers change.

const SCHEMES = {
  GS:   { perCorrect: 2,   perWrong: -(2 / 3)   },
  CSAT: { perCorrect: 2.5, perWrong: -(2.5 / 3) },
};

/**
 * Compute UPSC score for a single attempt.
 *
 * @param {number} correctCount
 * @param {number} wrongCount
 * @param {"GS"|"CSAT"} paperType  defaults to "GS"
 * @returns {{ positiveMarks: number, negativeMarks: number, finalScore: number, scheme: object }}
 */
export function computeUpscScore(correctCount, wrongCount, paperType = "GS") {
  const scheme = SCHEMES[paperType] ?? SCHEMES.GS;
  const positiveMarks = round2(correctCount * scheme.perCorrect);
  // negativeMarks is the DEDUCTION (positive value for display)
  const negativeMarks  = round2(Math.abs(wrongCount * scheme.perWrong));
  const finalScore     = round2(positiveMarks - negativeMarks);
  return { positiveMarks, negativeMarks, finalScore, scheme };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
