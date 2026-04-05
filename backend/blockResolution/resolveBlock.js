/**
 * resolveBlock.js
 * Main orchestrator for block resolution.
 *
 * Resolution order (strict):
 *  1. Normalize input
 *  2. Stage lock (FIRST — determines which file pool to use)
 *  3. GS paper lock (if applicable — narrows mains pool)
 *  4. MISC-GEN whitelist check (only explicit generic intents → MISC-GEN)
 *  5. Subject lock
 *  6. Mixed-block split (if 2+ subjects detected → split before mapping)
 *  7. Topic lock within subject+stage pool
 *  8. Activity detection
 *  9. Domain-specific resolver routing
 *
 * Returns a fully structured BlockResolution object.
 * Unresolved syllabus blocks return null nodeId, NEVER MISC-GEN.
 * MISC-GEN is only returned for explicit generic/admin/current-affairs intents.
 */

import { normalizeBlockInput }  from './normalizeBlockInput.js';
import { detectEntityType }     from './detectEntityType.js';
import { detectActivityType }   from './detectActivityType.js';
import { detectStage }          from './detectStage.js';
import { resolveTopicBlock }    from './resolveTopicBlock.js';
import { resolvePracticeIntent } from './resolvePracticeIntent.js';
import { resolveTestBlock }     from './resolveTestBlock.js';
import { resolveTaskBlock }     from './resolveTaskBlock.js';
import { hasMixedSubjects, splitMixedBlock } from './splitMixedBlock.js';
import { ENTITY_TYPES, ACTIVITY_TYPES, STAGES, MISC_GEN_ALLOWED_INTENTS } from './constants.js';

/**
 * @typedef {Object} BlockResolution
 * @property {string}  input           - Original raw input
 * @property {string}  normalized      - Post-normalization text
 * @property {string}  resolvedType    - 'topic' | 'practice' | 'test' | 'task' | 'unknown'
 * @property {Object}  resolution      - Domain-specific resolution object
 * @property {Object}  detections      - Raw detection results for debugging
 * @property {number}  overallConfidence
 * @property {string}  resolvedAt      - ISO timestamp
 * @property {boolean} isMiscGen       - True ONLY for explicit generic/admin/CA intents
 * @property {Object[]|null} subBlocks - Set if block was split (mixed subjects)
 */

/**
 * Check if a block text matches explicit MISC-GEN allowed intents.
 * MISC-GEN is ONLY returned for these explicit patterns — never for unknown syllabus blocks.
 *
 * @param {string} normalizedText
 * @param {string} activityType
 * @returns {boolean}
 */
function isMiscGenIntent(normalizedText, activityType) {
  // Current affairs → always MISC-GEN allowed
  if (
    activityType === ACTIVITY_TYPES.CURRENT_AFFAIRS ||
    activityType === ACTIVITY_TYPES.MOCK_ANALYSIS ||
    activityType === ACTIVITY_TYPES.ADMIN
  ) {
    return true;
  }

  const text = normalizedText.toLowerCase();
  return MISC_GEN_ALLOWED_INTENTS.some((intent) => text.includes(intent));
}

/**
 * Resolve a raw plan block label into a structured classification.
 *
 * @param {string} rawInput - Raw block label as entered in the plan.
 * @param {Object} [opts]   - Optional context
 * @param {number} [opts.minutes] - Block duration in minutes (needed for split blocks)
 * @returns {BlockResolution}
 */
export function resolveBlock(rawInput, opts = {}) {
  // ── Step 1: Normalize ─────────────────────────────────────────────────────
  const normalized = normalizeBlockInput(rawInput);

  // ── Step 2: Stage lock (FIRST — before subject/topic) ────────────────────
  // Stage must be detected before entity type — determines which file pool to use.
  const stageResult = detectStage(normalized, null);

  // ── Step 3: Entity & activity detection (uses stage context) ──────────────
  const entityResult   = detectEntityType(normalized);
  const activityResult = detectActivityType(normalized);

  // ── Step 4: MISC-GEN whitelist check ─────────────────────────────────────
  // ONLY explicit generic/admin/CA intents may produce MISC-GEN.
  // All normal syllabus blocks MUST NOT produce MISC-GEN.
  const miscGenAllowed = isMiscGenIntent(normalized, activityResult.activityType);

  // ── Step 5: Mixed-block split detection ──────────────────────────────────
  // If block mentions 2+ subjects (e.g. "History Prelims Economy PYQ"),
  // split it into equal sub-blocks BEFORE final mapping.
  let subBlocks = null;
  if (hasMixedSubjects(normalized)) {
    const splitInput = {
      text: normalized,
      minutes: opts.minutes || 0,
      stage: stageResult.stage,
      gsPaper: stageResult.gsPaper,
      activityType: activityResult.activityType,
    };
    const splitResult = splitMixedBlock(splitInput);
    if (splitResult && splitResult.length >= 2) {
      subBlocks = splitResult.map((sub) => resolveBlock(sub.text, { minutes: sub.minutes }));
      // Annotate each sub-block with split metadata
      subBlocks = subBlocks.map((sb, i) => ({
        ...sb,
        isSplitSubBlock: true,
        splitIndex: i,
        splitMinutes: splitResult[i].minutes,
        splitSubjectLabel: splitResult[i].subjectLabel,
      }));
    }
  }

  // ── Step 6: Route to correct resolver ────────────────────────────────────
  let resolvedType;
  let resolution;

  const { entityType } = entityResult;
  const { activityType } = activityResult;

  // ── Essay-first override ──────────────────────────────────────────────────
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
    if (entityResult.subjectSlug && entityResult.subjectSlug !== 'essay') {
      resolution.meta.topicSubjectSlug  = entityResult.subjectSlug;
      resolution.meta.topicSubjectLabel = entityResult.subjectLabel;
    }

  } else if (entityType === ENTITY_TYPES.TEST_SERIES || activityType === ACTIVITY_TYPES.TEST) {
    resolvedType = 'test';
    resolution   = resolveTestBlock(normalized, entityResult, activityResult, stageResult);

  } else if (activityType === ACTIVITY_TYPES.PRACTICE) {
    resolvedType = 'practice';
    resolution   = resolvePracticeIntent(normalized, entityResult, activityResult, stageResult);

  } else if (
    activityType === ACTIVITY_TYPES.WRITING    ||
    activityType === ACTIVITY_TYPES.BRAINSTORMING ||
    activityType === ACTIVITY_TYPES.MAPPING    ||
    entityType   === ENTITY_TYPES.SKILL        ||
    entityType   === ENTITY_TYPES.MATERIAL
  ) {
    resolvedType = 'task';
    resolution   = resolveTaskBlock(normalized, entityResult, activityResult, stageResult);

  } else if (
    entityType === ENTITY_TYPES.SUBJECT ||
    entityType === ENTITY_TYPES.TOPIC   ||
    activityType === ACTIVITY_TYPES.REVISION ||
    activityType === ACTIVITY_TYPES.READING
  ) {
    resolvedType = 'topic';
    resolution   = resolveTopicBlock(normalized, entityResult, activityResult, stageResult);

  } else if (miscGenAllowed) {
    // Explicit generic/admin/CA block — MISC-GEN is allowed here
    resolvedType = 'task';
    resolution   = resolveTaskBlock(normalized, entityResult, activityResult, stageResult);
    resolution.isMiscGen = true;

  } else {
    // Unknown syllabus block: return null nodeId, NOT MISC-GEN
    // The block is unresolved — do not fabricate a fallback category.
    resolvedType = 'unknown';
    resolution = {
      blockType: 'unknown',
      subjectSlug: null,
      subjectLabel: null,
      activityType,
      stage: stageResult.stage,
      gsPaper: stageResult.gsPaper || null,
      suggestedAction: 'Study',
      icon: '📚',
      tags: [],
      meta: {
        rawText: normalized,
        confidence: 0,
        reason: 'unresolved_syllabus_block',
      },
      isMiscGen: false,
    };
  }

  // Attach stage lock and GS paper to resolution for downstream consumers
  if (resolution && typeof resolution === 'object') {
    resolution.stageLock = stageResult.stage;
    resolution.gsPaper   = stageResult.gsPaper || resolution.gsPaper || null;
  }

  // ── Step 7: Compute overall confidence ───────────────────────────────────
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
    isMiscGen: Boolean(resolution?.isMiscGen),
    subBlocks,
  };
}
