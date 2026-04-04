// backend/mainsReview/buildMainsRevisionTasks.js
// Builds mainsRevisionTask records from classified mistakes.
// Maps mistake IDs to canonical revision task types from REVISION_TASK_TAXONOMY.

import { REVISION_TASK_TAXONOMY } from "./mainsReviewUtils.js";

/**
 * Mistake → revision task mapping.
 * One mistake can trigger multiple task types.
 */
const MISTAKE_TO_TASKS = {
  missed_core_demand:          ["rewrite_same_question", "directive_practice"],
  poor_directive_handling:     ["directive_practice", "rewrite_same_question"],
  poor_question_understanding: ["rewrite_same_question", "micro_theme_revision"],
  shallow_content:             ["dimension_expansion", "micro_theme_revision"],
  low_dimensionality:          ["dimension_expansion"],
  weak_analysis:               ["rewrite_same_question", "dimension_expansion"],
  factual_weakness:            ["fact_booster_revision"],
  no_examples:                 ["example_enrichment"],
  weak_intro:                  ["rewrite_intro_only"],
  weak_conclusion:             ["rewrite_conclusion_only"],
  poor_structure:              ["structure_drill", "subheading_drill"],
  weak_body_flow:              ["structure_drill"],
  poor_balance:                ["dimension_expansion"],
  no_subheadings:              ["subheading_drill"],
  poor_prioritization:         ["structure_drill", "time_bound_rewrite"],
  weak_presentation:           ["subheading_drill"],
  time_pressure_compression:   ["time_bound_rewrite"],
  vague_language:              ["rewrite_same_question"],
  too_short:                   ["dimension_expansion", "time_bound_rewrite"],
  too_lengthy:                 ["time_bound_rewrite"],
  repetitive_expression:       ["rewrite_same_question"],
};

/**
 * Priority score per task type (influences display order).
 */
const TASK_PRIORITY = {
  rewrite_same_question:  10,
  directive_practice:      9,
  dimension_expansion:     8,
  micro_theme_revision:    7,
  fact_booster_revision:   7,
  example_enrichment:      6,
  rewrite_intro_only:      5,
  rewrite_conclusion_only: 5,
  structure_drill:         4,
  subheading_drill:        3,
  time_bound_rewrite:      3,
};

/**
 * @param {object[]} mistakeRecords - from classifyMainsMistakes()
 * @param {object}   attempt        - attempt record (for context)
 * @param {object}   audit          - auditReviewQuality output
 * @returns {object[]} array of mainsRevisionTask
 */
export function buildMainsRevisionTasks(mistakeRecords, attempt, audit) {
  // Collect all task types triggered, dedup, and pick top ones
  const taskTypeSet = new Set();

  for (const mistake of (mistakeRecords || [])) {
    const tasks = MISTAKE_TO_TASKS[mistake.mistakeId] || ["rewrite_same_question"];
    for (const t of tasks) {
      if (REVISION_TASK_TAXONOMY.includes(t)) taskTypeSet.add(t);
    }
  }

  // Always add time_bound_rewrite if weak/usable review (builds discipline)
  if (["weak_review", "usable_review"].includes(audit.qualityLabel)) {
    taskTypeSet.add("time_bound_rewrite");
  }

  const paper = attempt?.source?.paper || attempt?.question?.paper || "GS";
  const question = attempt?.question?.text?.substring(0, 120) || "";

  // Build task records, sorted by priority
  return [...taskTypeSet]
    .sort((a, b) => (TASK_PRIORITY[b] || 0) - (TASK_PRIORITY[a] || 0))
    .map((taskType) => ({
      schema:          "mainsRevisionTask",
      taskType,
      paper,
      question,
      attemptId:       attempt?.attemptId || null,
      reviewId:        null,  // set by caller
      priority:        TASK_PRIORITY[taskType] || 3,
      dueIn:           taskDueIn(taskType),
      createdAt:       new Date().toISOString(),
      status:          "pending",
    }));
}

/**
 * Rough heuristic for due-in days based on task urgency.
 */
function taskDueIn(taskType) {
  const urgent = ["rewrite_same_question", "directive_practice"];
  const medium = ["dimension_expansion", "fact_booster_revision", "example_enrichment"];
  if (urgent.includes(taskType)) return 1;
  if (medium.includes(taskType)) return 3;
  return 7;
}
