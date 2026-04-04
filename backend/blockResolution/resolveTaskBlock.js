/**
 * resolveTaskBlock.js
 * Resolves miscellaneous task blocks that don't fit topic/practice/test categories.
 *
 * Handles: "essay brainstorming", "ethics answer writing", "world mapping",
 *          "india mapping", "csat rc practice", "note making", etc.
 *
 * This is the catch-all resolver for skill/writing/brainstorming/mapping activities.
 */

import { ACTIVITY_TYPES, STAGES } from './constants.js';
import { getActivityMeta } from './activityRegistry.js';

/**
 * @typedef {Object} TaskBlockResolution
 * @property {string}      blockType       - Always 'task'
 * @property {string}      taskCategory    - 'writing' | 'brainstorming' | 'mapping' | 'csat' | 'reading' | 'general'
 * @property {string|null} subjectSlug     - Canonical subject slug inferred from entity detection
 * @property {string|null} subjectLabel    - Human-readable subject label
 * @property {string}      activityType
 * @property {string}      stage
 * @property {string}      suggestedAction
 * @property {string}      icon
 * @property {string[]}    tags
 * @property {Object}      meta
 */

/**
 * Resolve a general task block.
 *
 * @param {string} normalizedText
 * @param {Object} entityResult
 * @param {Object} activityResult
 * @param {Object} stageResult
 * @returns {TaskBlockResolution}
 */
export function resolveTaskBlock(normalizedText, entityResult, activityResult, stageResult) {
  const { activityType } = activityResult;
  const { stage } = stageResult;

  // Determine task category
  const taskCategory = resolveTaskCategory(normalizedText, activityType, stage);

  const activityMeta = getActivityMeta(activityType);
  const icon = activityMeta?.icon ?? '📋';

  // Promote subject fields to top level so callers don't have to dig into meta
  const subjectSlug  = entityResult.subjectSlug  ?? null;
  const subjectLabel = entityResult.subjectLabel ?? null;

  // Build action label.
  // Append subject label only when it adds information beyond the stage label.
  // e.g. avoid "💡 Brainstorming Session (Essay) – Essay" being redundant.
  const categoryLabel = taskCategoryLabels[taskCategory] ?? 'Task';
  const stageLabel    = stageLabelMap[stage] ?? '';
  const isRedundantSubject = subjectLabel === 'Essay' && stage === 'essay';
  const subjectSuffix = (subjectLabel && !isRedundantSubject) ? ` – ${subjectLabel}` : '';
  const suggestedAction = [categoryLabel, stageLabel].filter(Boolean).join(' ') + subjectSuffix;

  const tags = [
    'task',
    taskCategory,
    subjectSlug,
    activityType,
    stage,
  ].filter(Boolean);

  return {
    blockType: 'task',
    taskCategory,
    subjectSlug,
    subjectLabel,
    activityType,
    stage,
    suggestedAction,
    icon,
    tags,
    meta: {
      rawText: normalizedText,
      confidence: Math.min(entityResult.confidence || 0.5, activityResult.confidence, stageResult.confidence),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determine task category from activity type and raw text signals.
 */
function resolveTaskCategory(text, activityType, stage) {
  if (activityType === ACTIVITY_TYPES.WRITING || text.includes('answer writing') || text.includes('writing')) {
    return 'writing';
  }
  if (activityType === ACTIVITY_TYPES.BRAINSTORMING || text.includes('brainstorm')) {
    return 'brainstorming';
  }
  if (activityType === ACTIVITY_TYPES.MAPPING || text.includes('mapping') || text.includes(' map')) {
    return 'mapping';
  }
  if (stage === STAGES.CSAT || text.includes('csat') || text.includes('rc') || text.includes('reading comprehension')) {
    return 'csat';
  }
  if (activityType === ACTIVITY_TYPES.READING || text.includes('note')) {
    return 'reading';
  }
  return 'general';
}

const taskCategoryLabels = {
  writing:       '✍️ Answer Writing Practice',
  brainstorming: '💡 Brainstorming Session',
  mapping:       '🗺️ Map-Based Practice',
  csat:          '📖 CSAT Practice',
  reading:       '📖 Reading & Note Making',
  general:       '📋 Study Task',
};

const stageLabelMap = {
  [STAGES.PRELIMS]: '(Prelims)',
  [STAGES.MAINS]:   '(Mains)',
  [STAGES.ESSAY]:   '(Essay)',
  [STAGES.CSAT]:    '(CSAT)',
  [STAGES.GENERAL]: '',
};
