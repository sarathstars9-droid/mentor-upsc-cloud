import { listMistakes } from "../repositories/mistakeRepository.js";
import { listAttemptsForQuestions } from "../repositories/prelimsAttemptLedgerRepository.js";
import { buildMistakeBookIntelligence } from "./prelimsMistakeBookIntelligenceBuilder.js";

export { buildMistakeBookIntelligence } from "./prelimsMistakeBookIntelligenceBuilder.js";

export async function getPrelimsMistakeBookIntelligence({ userId, stage }) {
  if (!userId) {
    const error = new Error("userId query param is required");
    error.status = 400;
    throw error;
  }

  if (String(stage || "").toLowerCase() !== "prelims") {
    const error = new Error("Mistake Book intelligence is only supported for prelims");
    error.status = 400;
    throw error;
  }

  const mistakes = await listMistakes(userId, "prelims");
  const questionIds = mistakes.map((mistake) => mistake.question_id).filter(Boolean);
  const attempts = await listAttemptsForQuestions({ userId, questionIds });
  return buildMistakeBookIntelligence({ mistakes, attempts });
}
