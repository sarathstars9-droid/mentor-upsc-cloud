import {
  upsertExplanation,
  getExplanation,
  getExplanationsByQuestionIds,
  deleteExplanation,
  listExplanationsByUser,
} from "../repositories/explanationRepository.js";

// ─────────────────────────────────────────────────────────────────────────────
// Save or update an explanation
// ─────────────────────────────────────────────────────────────────────────────
export async function saveExplanation(payload) {
  const { userId, questionId, explanationText, source } = payload;

  if (!userId || !questionId || !explanationText) {
    throw new Error("userId, questionId, and explanationText are required");
  }

  const saved = await upsertExplanation({
    userId,
    questionId,
    explanationText,
    source: source || "chatgpt",
  });

  return {
    success: true,
    explanation: saved,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get a single explanation
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchExplanation(userId, questionId) {
  if (!userId || !questionId) {
    throw new Error("userId and questionId are required");
  }

  const explanation = await getExplanation(userId, questionId);

  return {
    success: true,
    explanation: explanation || null,
    found: !!explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk fetch explanations for multiple questions
// useful for loading all saved explanations on a topic page at once
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchExplanationsBulk(userId, questionIds = []) {
  if (!userId || questionIds.length === 0) {
    return {
      success: true,
      explanations: {},
    };
  }

  const rows = await getExplanationsByQuestionIds(userId, questionIds);

  const explanationMap = {};
  rows.forEach((row) => {
    explanationMap[row.question_id] = row;
  });

  return {
    success: true,
    explanations: explanationMap,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete an explanation
// ─────────────────────────────────────────────────────────────────────────────
export async function removeExplanation(userId, questionId) {
  if (!userId || !questionId) {
    throw new Error("userId and questionId are required");
  }

  const deleted = await deleteExplanation(userId, questionId);

  return {
    success: deleted,
    deleted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// List all saved explanations for a user
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchUserExplanations(userId, limit = 100, offset = 0) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const explanations = await listExplanationsByUser(userId, limit, offset);

  return {
    success: true,
    count: explanations.length,
    explanations,
  };
}
