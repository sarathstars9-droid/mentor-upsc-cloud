/**
 * resolveTopicBlock.js
 * Resolves blocks whose primary intent is study/revision of a topic.
 *
 * Handles: "polity revision", "modern history revision", "world mapping", etc.
 * Returns a structured resolution object with suggested actions and metadata.
 */

import { ACTIVITY_TYPES, STAGES } from './constants.js';
import { getActivityMeta } from './activityRegistry.js';

/**
 * @typedef {Object} TopicBlockResolution
 * @property {string}   blockType        - Always 'topic'
 * @property {string}   subjectSlug
 * @property {string}   subjectLabel
 * @property {string}   activityType
 * @property {string}   stage
 * @property {string}   suggestedAction  - Human-readable action label
 * @property {string}   icon
 * @property {string[]} tags
 * @property {Object}   meta
 */

/**
 * Resolve a topic/revision block into a structured output.
 *
 * @param {string} normalizedText
 * @param {Object} entityResult   - Output from detectEntityType
 * @param {Object} activityResult - Output from detectActivityType
 * @param {Object} stageResult    - Output from detectStage
 * @returns {TopicBlockResolution}
 */
export function resolveTopicBlock(normalizedText, entityResult, activityResult, stageResult) {
  const { subjectSlug, subjectLabel } = entityResult;
  const { activityType } = activityResult;
  const { stage } = stageResult;

  const activityMeta = getActivityMeta(activityType);
  const icon = activityMeta?.icon ?? '📚';

  // Generate a human-readable action
  const actionVerb = activityVerbMap[activityType] ?? 'Study';
  const stageLabel = stageLabelMap[stage] ?? '';
  const suggestedAction = [actionVerb, stageLabel, subjectLabel].filter(Boolean).join(' – ');

  // Build tags
  const tags = [subjectSlug, activityType, stage].filter(Boolean);

  return {
    blockType: 'topic',
    subjectSlug: subjectSlug ?? 'unknown',
    subjectLabel: subjectLabel ?? normalizedText,
    activityType,
    stage,
    suggestedAction,
    icon,
    tags,
    meta: {
      rawText: normalizedText,
      confidence: Math.min(entityResult.confidence, activityResult.confidence, stageResult.confidence),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const activityVerbMap = {
  [ACTIVITY_TYPES.REVISION]:       'Revise',
  [ACTIVITY_TYPES.PRACTICE]:       'Practice',
  [ACTIVITY_TYPES.READING]:        'Read & Note',
  [ACTIVITY_TYPES.MAPPING]:        'Map Practice',
  [ACTIVITY_TYPES.BRAINSTORMING]:  'Brainstorm',
  [ACTIVITY_TYPES.WRITING]:        'Write Answers',
  [ACTIVITY_TYPES.TEST]:           'Attempt Test',
  [ACTIVITY_TYPES.UNKNOWN]:        'Study',
};

const stageLabelMap = {
  [STAGES.PRELIMS]: '(Prelims)',
  [STAGES.MAINS]:   '(Mains)',
  [STAGES.ESSAY]:   '(Essay)',
  [STAGES.CSAT]:    '(CSAT)',
  [STAGES.GENERAL]: '',
};
