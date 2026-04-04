/**
 * resolveTestBlock.js
 * Resolves blocks that represent mock tests or full-length tests (FLTs).
 *
 * Handles: "vision flt 12", "insights mock 3", "prelims full length test", etc.
 * Extracts test number, test series family, and stage context.
 */

import { ENTITY_TYPES, STAGES, FLT_PATTERN, TEST_SERIES_FAMILIES } from './constants.js';
import { getActivityMeta } from './activityRegistry.js';
import { ACTIVITY_TYPES } from './constants.js';

/**
 * @typedef {Object} TestBlockResolution
 * @property {string}      blockType       - Always 'test'
 * @property {string}      testFamily      - e.g. 'vision', 'insights', 'unknown'
 * @property {number|null} testNumber      - Parsed test/FLT number
 * @property {string}      testCode        - e.g. 'FLT-12', 'MOCK-3'
 * @property {string}      stage
 * @property {boolean}     isFullLength    - True if FLT/mock
 * @property {string}      suggestedAction
 * @property {string}      icon
 * @property {string[]}    tags
 * @property {Object}      meta
 */

/**
 * Resolve a test/FLT block.
 *
 * @param {string} normalizedText
 * @param {Object} entityResult
 * @param {Object} activityResult
 * @param {Object} stageResult
 * @returns {TestBlockResolution}
 */
export function resolveTestBlock(normalizedText, entityResult, activityResult, stageResult) {
  const { testFamily } = entityResult;
  const { stage } = stageResult;

  // Extract test number from pattern like "flt 12", "mock 3"
  const fltMatch = FLT_PATTERN.exec(normalizedText);
  const testNumber = fltMatch ? parseInt(fltMatch[1], 10) : null;

  // Determine if it's a full-length test
  const isFullLength =
    normalizedText.includes('flt') ||
    normalizedText.includes('full length') ||
    normalizedText.includes('full-length');

  // Build test code label
  const prefix = isFullLength ? 'FLT' : 'MOCK';
  const testCode = testNumber != null ? `${prefix}-${testNumber}` : prefix;

  // Test series label
  const familyLabel = testFamilyLabels[testFamily] ?? testFamily ?? 'Unknown Series';

  // Action
  const suggestedAction = testNumber != null
    ? `Attempt ${familyLabel} ${testCode}`
    : `Attempt ${familyLabel} Test`;

  const activityMeta = getActivityMeta(ACTIVITY_TYPES.TEST);
  const icon = activityMeta?.icon ?? '🎯';

  const tags = [
    'test',
    testFamily,
    isFullLength ? 'flt' : 'mock',
    stage,
    testNumber != null ? `#${testNumber}` : null,
  ].filter(Boolean);

  return {
    blockType: 'test',
    testFamily: testFamily ?? 'unknown',
    testNumber,
    testCode,
    stage,
    isFullLength,
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

const testFamilyLabels = {
  [TEST_SERIES_FAMILIES.VISION]:   'Vision IAS',
  [TEST_SERIES_FAMILIES.INSIGHTS]: 'Insights IAS',
  [TEST_SERIES_FAMILIES.FORUM]:    'Forum IAS',
  [TEST_SERIES_FAMILIES.DRISHTI]:  'Drishti IAS',
  [TEST_SERIES_FAMILIES.SHANKAR]:  'Shankar IAS',
  [TEST_SERIES_FAMILIES.GS_SCORE]: 'GS Score',
};
