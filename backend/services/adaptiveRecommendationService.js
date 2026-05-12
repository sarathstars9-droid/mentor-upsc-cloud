import {
  getTopWeakNodes,
} from "../repositories/adaptiveWeaknessRepository.js";

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation rule engine
//
// Maps weakness_level → recommendation_type + action_text
// Purely rules-based — no AI/ML/OpenAI dependency.
// ─────────────────────────────────────────────────────────────────────────────
const RECOMMENDATION_RULES = {
  critical: {
    recommendation_type: "urgent_revision",
    action_text: "Revise this topic today and attempt 10 PYQs",
  },
  weak: {
    recommendation_type: "practice_set",
    action_text: "Attempt 10 targeted PYQs",
  },
  needs_revision: {
    recommendation_type: "quick_revision",
    action_text: "Do a 20-minute revision and 5 PYQs",
  },
  stable: {
    recommendation_type: "maintain",
    action_text: "You're on track — keep revising periodically",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// getNextAction
//
// Returns top recommendations from node_weakness for a user.
//
// Priority: critical → weak → needs_revision → latest updated_at
// Stable nodes are only included when no weak topics exist.
// ─────────────────────────────────────────────────────────────────────────────
export async function getNextAction({ userId, stage, limit = 5 }) {
  if (!userId) throw new Error("userId is required");

  // getTopWeakNodes already filters out 'stable' and sorts correctly
  let nodes = await getTopWeakNodes({ userId, stage, limit });

  // If no weak nodes exist at all, return empty recommendations
  // (we don't include stable nodes unless explicitly needed)
  if (!nodes.length) {
    return [];
  }

  return nodes.map((node) => {
    const rule = RECOMMENDATION_RULES[node.weakness_level] || RECOMMENDATION_RULES.stable;

    return {
      nodeId:             node.node_id,
      subject:            node.subject || "",
      weaknessScore:      Number(node.weakness_score) || 0,
      weaknessLevel:      node.weakness_level,
      attemptsCount:      Number(node.attempts_count) || 0,
      correctCount:       Number(node.correct_count) || 0,
      wrongCount:         Number(node.wrong_count) || 0,
      accuracyPercent:    Number(node.accuracy_percent) || 0,
      repeatedWrongCount: Number(node.repeated_wrong_count) || 0,
      lastAttemptedAt:    node.last_attempted_at,
      recommendationType: rule.recommendation_type,
      actionText:         rule.action_text,
    };
  });
}
