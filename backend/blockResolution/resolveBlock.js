/**
 * resolveBlock.js
 * Main orchestrator for block resolution.
 *
 * Accepts a raw block label string and routes it through:
 *  1. Normalization
 *  2. Entity detection
 *  3. Activity detection
 *  4. Stage detection
 *  5. Domain-specific resolver (topic / practice / test / task)
 *
 * Returns a fully structured BlockResolution object.
 * This module is the ONLY public API of the blockResolution module.
 */

import { normalizeBlockInput }  from './normalizeBlockInput.js';
import { detectEntityType }     from './detectEntityType.js';
import { detectActivityType }   from './detectActivityType.js';
import { detectStage }          from './detectStage.js';
import { resolveTopicBlock }    from './resolveTopicBlock.js';
import { resolvePracticeIntent } from './resolvePracticeIntent.js';
import { resolveTestBlock }     from './resolveTestBlock.js';
import { resolveTaskBlock }     from './resolveTaskBlock.js';
import { ENTITY_TYPES, ACTIVITY_TYPES, STAGES } from './constants.js';

/**
 * @typedef {Object} BlockResolution
 * @property {string}  input           - Original raw input
 * @property {string}  normalized      - Post-normalization text
 * @property {string}  resolvedType    - 'topic' | 'practice' | 'test' | 'task' | 'unknown'
 * @property {Object}  resolution      - Domain-specific resolution object
 * @property {Object}  detections      - Raw detection results for debugging
 * @property {number}  overallConfidence
 * @property {string}  resolvedAt      - ISO timestamp
 */

/**
 * Resolve a raw plan block label into a structured classification.
 *
 * @param {string} rawInput - Raw block label as entered in the plan.
 * @returns {BlockResolution}
 */
export function resolveBlock(rawInput) {
  // ── Step 1: Normalize ─────────────────────────────────────────────────────
  const normalized = normalizeBlockInput(rawInput);

  // ── Step 2: Detect entity, activity, stage ────────────────────────────────
  const entityResult   = detectEntityType(normalized);
  const activityResult = detectActivityType(normalized);
  const stageResult    = detectStage(normalized, entityResult.subjectSlug);

  // ── Step 3: Route to correct resolver ────────────────────────────────────
  let resolvedType;
  let resolution;

  const { entityType } = entityResult;
  const { activityType } = activityResult;

  // ── Essay-first override ──────────────────────────────────────────────────
  // When the stage is essay and the activity is a planning/writing type (not a
  // hard test-series match), treat the block as an essay task regardless of
  // which subject keyword happened to score highest in entity detection.
  // The detected subject (e.g. 'science_tech' in "essay outline – technology
  // and society") is preserved as meta.topicSubjectSlug for optional UI use.
  if (
    stageResult.stage === STAGES.ESSAY &&
    entityType !== ENTITY_TYPES.TEST_SERIES &&
    (activityType === ACTIVITY_TYPES.BRAINSTORMING ||
     activityType === ACTIVITY_TYPES.WRITING       ||
     activityType === ACTIVITY_TYPES.UNKNOWN)
  ) {
    resolvedType = 'task';
    const essayEntityOverride = {
      entityType:   ENTITY_TYPES.SUBJECT,
      subjectSlug:  'essay',
      subjectLabel: 'Essay',
      testFamily:   null,
      confidence:   0.85,
    };
    resolution = resolveTaskBlock(normalized, essayEntityOverride, activityResult, stageResult);
    // Preserve the originally detected topic subject as optional context
    if (entityResult.subjectSlug && entityResult.subjectSlug !== 'essay') {
      resolution.meta.topicSubjectSlug  = entityResult.subjectSlug;
      resolution.meta.topicSubjectLabel = entityResult.subjectLabel;
    }
  } else if (entityType === ENTITY_TYPES.TEST_SERIES || activityType === ACTIVITY_TYPES.TEST) {
    // Test/FLT block
    resolvedType = 'test';
    resolution   = resolveTestBlock(normalized, entityResult, activityResult, stageResult);

  } else if (activityType === ACTIVITY_TYPES.PRACTICE) {
    // Practice/PYQ block
    resolvedType = 'practice';
    resolution   = resolvePracticeIntent(normalized, entityResult, activityResult, stageResult);

  } else if (
    activityType === ACTIVITY_TYPES.WRITING    ||
    activityType === ACTIVITY_TYPES.BRAINSTORMING ||
    activityType === ACTIVITY_TYPES.MAPPING    ||
    entityType   === ENTITY_TYPES.SKILL        ||
    entityType   === ENTITY_TYPES.MATERIAL
  ) {
    // Task (writing, mapping, brainstorming, note-making)
    resolvedType = 'task';
    resolution   = resolveTaskBlock(normalized, entityResult, activityResult, stageResult);

  } else if (
    entityType === ENTITY_TYPES.SUBJECT ||
    entityType === ENTITY_TYPES.TOPIC   ||
    activityType === ACTIVITY_TYPES.REVISION ||
    activityType === ACTIVITY_TYPES.READING
  ) {
    // Topic/subject study block
    resolvedType = 'topic';
    resolution   = resolveTopicBlock(normalized, entityResult, activityResult, stageResult);

  } else {
    // Fallback: attempt topic resolution even for unknowns
    resolvedType = 'unknown';
    resolution   = resolveTopicBlock(normalized, entityResult, activityResult, stageResult);
    resolution.blockType = 'unknown';
  }

  // ── Step 4: Compute overall confidence ───────────────────────────────────
  const overallConfidence = parseFloat(
    (
      (entityResult.confidence   * 0.4) +
      (activityResult.confidence * 0.35) +
      (stageResult.confidence    * 0.25)
    ).toFixed(3)
  );

  return {
    input: rawInput,
    normalized,
    resolvedType,
    resolution,
    detections: {
      entity:   entityResult,
      activity: activityResult,
      stage:    stageResult,
    },
    overallConfidence,
    resolvedAt: new Date().toISOString(),
  };
}
