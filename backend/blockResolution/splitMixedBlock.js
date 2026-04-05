/**
 * splitMixedBlock.js
 * Detects and splits a block that contains multiple subjects into sub-blocks.
 *
 * Splitting rules:
 *  - Detect all subject mentions in the block text
 *  - If 2+ distinct subjects found → split total duration equally
 *  - Each sub-block inherits the stage lock from the parent block
 *  - Each sub-block is an independent resolution unit
 *
 * Example:
 *   "PYQs - History Prelims Economy" (150 min)
 *   → sub-block 1: "History Prelims PYQ" (75 min)
 *   → sub-block 2: "Economy Prelims PYQ" (75 min)
 */

import { SUBJECT_REGISTRY } from './subjectRegistry.js';

/**
 * @typedef {Object} SubBlock
 * @property {string}      text          - Resolved text for this sub-block
 * @property {string}      subjectSlug   - Detected subject slug
 * @property {string}      subjectLabel  - Human-readable subject label
 * @property {number}      minutes       - Duration allocated to this sub-block
 * @property {string|null} stage         - Inherited stage from parent
 * @property {string|null} gsPaper       - Inherited GS paper from parent
 * @property {boolean}     isSplit       - Always true for sub-blocks
 */

/**
 * Normalize text for matching (lowercase, strip punctuation).
 * @param {string} text
 * @returns {string}
 */
function norm(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detect all subjects mentioned in a normalized block text.
 * Returns matches sorted by position in text (left-to-right) to preserve user order.
 *
 * @param {string} normalizedText
 * @returns {Array<{slug:string, label:string, position:number}>}
 */
export function detectMultipleSubjects(normalizedText) {
  const text = norm(normalizedText);
  const found = [];
  const seenSlugs = new Set();

  // Sort entries by alias length descending to match longer phrases first
  const sorted = SUBJECT_REGISTRY.flatMap((entry) =>
    entry.aliases.map((alias) => ({ entry, alias, len: alias.length }))
  ).sort((a, b) => b.len - a.len);

  for (const { entry, alias } of sorted) {
    if (seenSlugs.has(entry.slug)) continue;
    const idx = text.indexOf(alias);
    if (idx !== -1) {
      seenSlugs.add(entry.slug);
      found.push({ slug: entry.slug, label: entry.label, position: idx });
    }
  }

  // Sort by position to maintain user-written order
  found.sort((a, b) => a.position - b.position);
  return found;
}

/**
 * Check if a block contains multiple distinct subjects.
 * Returns true only if 2+ unique, non-overlapping subjects are found.
 *
 * @param {string} normalizedText
 * @returns {boolean}
 */
export function hasMixedSubjects(normalizedText) {
  const subjects = detectMultipleSubjects(normalizedText);
  return subjects.length >= 2;
}

/**
 * Split a mixed-subject block into equal-duration sub-blocks.
 * If only 1 (or 0) subjects are found, returns null (no split needed).
 *
 * @param {Object} block                - Original block
 * @param {string} block.text           - Normalized block text
 * @param {number} block.minutes        - Total duration in minutes
 * @param {string|null} block.stage     - Stage lock (from detectStage)
 * @param {string|null} block.gsPaper   - GS paper lock (from detectStage)
 * @param {string} block.activityType   - Detected activity (e.g. 'practice')
 * @returns {SubBlock[]|null}           - Array of sub-blocks or null if no split needed
 */
export function splitMixedBlock(block) {
  const subjects = detectMultipleSubjects(block.text || '');

  if (subjects.length < 2) return null;

  const perBlockMinutes = Math.floor((block.minutes || 0) / subjects.length);
  const remainder = (block.minutes || 0) - perBlockMinutes * subjects.length;

  return subjects.map((subj, i) => {
    // Build a clean text for this sub-block
    const stageLabel = block.stage && block.stage !== 'general' ? ` ${block.stage}` : '';
    const paperLabel = block.gsPaper ? ` ${block.gsPaper}` : '';
    const activitySuffix = block.activityType === 'practice' ? ' practice' : '';

    const subText = `${subj.label}${stageLabel}${paperLabel}${activitySuffix}`.trim();

    return {
      text: subText,
      subjectSlug: subj.slug,
      subjectLabel: subj.label,
      minutes: perBlockMinutes + (i === subjects.length - 1 ? remainder : 0),
      stage: block.stage || null,
      gsPaper: block.gsPaper || null,
      isSplit: true,
      parentText: block.text,
    };
  });
}
