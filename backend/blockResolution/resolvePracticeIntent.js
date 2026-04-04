/**
 * resolvePracticeIntent.js
 * Resolves blocks with a practice/PYQ intent.
 *
 * Handles: "economy prelims pyqs", "csat rc practice", "polity pyqs", etc.
 * Returns structured practice intent with subject, stage, mode, and whether PYQs are involved.
 */

import { ACTIVITY_TYPES, STAGES, PYQ_PATTERN } from './constants.js';
import { getActivityMeta } from './activityRegistry.js';

/**
 * @typedef {Object} PracticeIntentResolution
 * @property {string}   blockType      - Always 'practice'
 * @property {string}   subjectSlug
 * @property {string}   subjectLabel
 * @property {string}   stage
 * @property {boolean}  isPyq          - Whether this is a PYQ-based practice block
 * @property {string}   practiceMode   - 'pyq' | 'drill' | 'sectional' | 'csat'
 * @property {string}   suggestedAction
 * @property {string}   icon
 * @property {string[]} tags
 * @property {Object}   meta
 */

/**
 * Resolve a practice intent block.
 *
 * @param {string} normalizedText
 * @param {Object} entityResult
 * @param {Object} activityResult
 * @param {Object} stageResult
 * @returns {PracticeIntentResolution}
 */
export function resolvePracticeIntent(normalizedText, entityResult, activityResult, stageResult) {
  const { subjectSlug, subjectLabel } = entityResult;
  const { stage } = stageResult;

  // Determine if PYQ-based
  const isPyq = PYQ_PATTERN.test(normalizedText);

  // Determine practice mode
  let practiceMode = 'drill';
  if (isPyq) {
    practiceMode = 'pyq';
  } else if (stage === STAGES.CSAT || normalizedText.includes('csat') || normalizedText.includes('rc')) {
    practiceMode = 'csat';
  } else if (normalizedText.includes('sectional')) {
    practiceMode = 'sectional';
  }

  // Build action label
  const modeLabel = practiceModeLabels[practiceMode] ?? 'Practice';
  const stageLabel = stage === STAGES.PRELIMS ? '(Prelims)' : stage === STAGES.MAINS ? '(Mains)' : '';
  const subLabel = subjectLabel ?? normalizedText;
  const suggestedAction = [modeLabel, stageLabel, subLabel].filter(Boolean).join(' – ');

  const activityMeta = getActivityMeta(ACTIVITY_TYPES.PRACTICE);
  const icon = activityMeta?.icon ?? '📝';

  const tags = [
    subjectSlug,
    'practice',
    practiceMode,
    stage,
    isPyq ? 'pyq' : null,
  ].filter(Boolean);

  return {
    blockType: 'practice',
    subjectSlug: subjectSlug ?? 'unknown',
    subjectLabel: subLabel,
    stage,
    isPyq,
    practiceMode,
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

const practiceModeLabels = {
  pyq:       'Solve PYQs',
  drill:     'Practice Drills',
  sectional: 'Sectional Practice',
  csat:      'CSAT Practice',
};
