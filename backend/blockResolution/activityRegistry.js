/**
 * activityRegistry.js
 * Registry of all recognizable activity patterns and their metadata.
 * Used by detectActivityType to enrich block resolution with activity-level context.
 */

import { ACTIVITY_TYPES, STAGES } from './constants.js';

/**
 * @typedef {Object} ActivityEntry
 * @property {string}   activityType  - One of ACTIVITY_TYPES values
 * @property {string[]} keywords      - Trigger keywords (lowercase)
 * @property {string[]} stages        - Compatible stages for this activity
 * @property {string}   description   - Human-readable description
 * @property {string}   icon          - Emoji icon for UI display
 */

/** @type {ActivityEntry[]} */
export const ACTIVITY_REGISTRY = [
  {
    activityType: ACTIVITY_TYPES.REVISION,
    keywords: ['revision', 'revise', 'review', 'quick revision', 'rapid revision', 'revisit'],
    stages: [STAGES.PRELIMS, STAGES.MAINS, STAGES.GENERAL],
    description: 'Revising previously studied material',
    icon: '🔁',
  },
  {
    activityType: ACTIVITY_TYPES.PRACTICE,
    keywords: ['practice', 'drill', 'pyqs', 'pyq', 'previous year', 'mcqs', 'questions'],
    stages: [STAGES.PRELIMS, STAGES.MAINS, STAGES.CSAT],
    description: 'Practicing questions or exercises',
    icon: '📝',
  },
  {
    activityType: ACTIVITY_TYPES.TEST,
    keywords: ['test', 'flt', 'mock', 'full length', 'full-length', 'sectional test', 'dt', 'pt'],
    stages: [STAGES.PRELIMS, STAGES.MAINS],
    description: 'Attempting a mock test or full-length test',
    icon: '🎯',
  },
  {
    activityType: ACTIVITY_TYPES.WRITING,
    keywords: ['answer writing', 'writing', 'write', 'mains writing', 'answer'],
    stages: [STAGES.MAINS, STAGES.ESSAY],
    description: 'Answer writing or essay practice',
    icon: '✍️',
  },
  {
    activityType: ACTIVITY_TYPES.BRAINSTORMING,
    keywords: ['brainstorm', 'brainstorming', 'ideas', 'ideation', 'mind map', 'outline', 'plan outline'],
    stages: [STAGES.MAINS, STAGES.ESSAY],
    description: 'Brainstorming ideas for essay or mains',
    icon: '💡',
  },
  {
    activityType: ACTIVITY_TYPES.MAPPING,
    keywords: ['mapping', 'maps', 'map', 'locate', 'atlas'],
    stages: [STAGES.PRELIMS, STAGES.GENERAL],
    description: 'Map-based practice (India/World)',
    icon: '🗺️',
  },
  {
    activityType: ACTIVITY_TYPES.READING,
    keywords: ['reading', 'read', 'note making', 'notes', 'ncert', 'reference', 'newspaper'],
    stages: [STAGES.GENERAL, STAGES.PRELIMS, STAGES.MAINS],
    description: 'Reading study material or making notes',
    icon: '📖',
  },
];

/**
 * Find an activity entry by type slug.
 * @param {string} activityType
 * @returns {ActivityEntry|undefined}
 */
export function getActivityMeta(activityType) {
  return ACTIVITY_REGISTRY.find((a) => a.activityType === activityType);
}
