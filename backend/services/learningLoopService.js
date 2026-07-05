/**
 * Extracts weaknesses from mains evaluation jsons and creates/updates 
 * mistakes and revision_items.
 */
export async function generateLearningLoop(attemptRow) {
  if (!attemptRow) return;

  const {
    attempt_id,
    user_id,
    paper,
    subject,
    topic,
    question_text,
    final_answer_text,
    basic_review_json,
    air1_parsed_json,
    current_score
  } = attemptRow;

  try {
    const { generateMistakesFromBasicEvaluation, generateMistakesFromAir1Review } = await import("./mainsMistakeService.js");

    if (basic_review_json) {
      await generateMistakesFromBasicEvaluation({
        userId: user_id,
        attemptId: attempt_id,
        paper,
        subject,
        topic,
        questionText: question_text,
        candidateAnswer: final_answer_text,
        evaluationJson: basic_review_json,
        score: current_score
      });
    }

    if (air1_parsed_json) {
      await generateMistakesFromAir1Review({
        userId: user_id,
        attemptId: attempt_id,
        paper,
        subject,
        topic,
        questionText: question_text,
        candidateAnswer: final_answer_text,
        air1ReviewJson: air1_parsed_json,
        score: current_score
      });
    }
  } catch (err) {
    console.error("[generateLearningLoop] Failed to process learning loop:", err.message);
  }
}
