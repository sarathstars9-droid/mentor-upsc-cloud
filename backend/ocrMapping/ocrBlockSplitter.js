/**
 * backend/ocrMapping/ocrBlockSplitter.js
 *
 * Detects and splits OCR blocks that contain multiple distinct subjects.
 *
 * Splitting rules:
 *  - Find all UPSC subjects mentioned in the block text
 *  - If 2+ distinct subjects found → split block into equal duration sub-blocks
 *  - Each sub-block inherits: stage lock + GS paper lock from parent
 *  - Each sub-block gets an independent text string for the resolver
 *
 * Example:
 *   "PYQs - History Prelims Economy" (150 min)
 *   → sub-block 1: "History Prelims pyqs" (75 min)
 *   → sub-block 2: "Economy Prelims pyqs" (75 min)
 *
 * Example 2:
 *   "Polity GS-2 Mains" (150 min)
 *   → 1 subject only → no split → null
 */

// Canonical subject list with aliases (ordered by alias length descending for longest-match)
const SUBJECT_LIST = [
  { slug: 'history', label: 'History', aliases: ['modern history', 'ancient history', 'medieval history', 'world history', 'indian history', 'history'] },
  { slug: 'geography', label: 'Geography', aliases: ['indian geography', 'world geography', 'physical geography', 'geography'] },
  { slug: 'environment', label: 'Environment', aliases: ['ecology biodiversity', 'environment ecology', 'biodiversity', 'ecology', 'environment'] },
  { slug: 'polity', label: 'Polity', aliases: ['indian polity', 'constitution', 'governance', 'polity'] },
  { slug: 'economy', label: 'Economy', aliases: ['indian economy', 'economics', 'inflation', 'monetary policy', 'fiscal policy', 'economy'] },
  { slug: 'science_tech', label: 'Science & Technology', aliases: ['science and technology', 'science tech', 'technology', 'science'] },
  { slug: 'ethics', label: 'Ethics', aliases: ['ethics integrity aptitude', 'ethics integrity', 'ethics aptitude', 'general studies 4', 'general studies iv', 'general studies paper 4', 'gs iv', 'ethics', 'gs4', 'gs 4'] },
  { slug: 'internal_security', label: 'Internal Security', aliases: ['internal security', 'security'] },
  { slug: 'disaster_management', label: 'Disaster Management', aliases: ['disaster management', 'disaster'] },
  { slug: 'society', label: 'Society', aliases: ['indian society', 'social issues', 'society'] },
  { slug: 'culture', label: 'Culture', aliases: ['art and culture', 'indian culture', 'culture'] },
  { slug: 'current_affairs', label: 'Current Affairs', aliases: ['current affairs', 'daily ca'] },
  { slug: 'csat', label: 'CSAT', aliases: ['reading comprehension', 'csat', 'quant'] },
  { slug: 'essay', label: 'Essay', aliases: ['essay'] },
];

/**
 * Normalize text for matching.
 * @param {string} text
 * @returns {string}
 */
function norm(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detect all subjects in text, longest match wins, returns in order of appearance.
 *
 * @param {string} text
 * @returns {Array<{slug:string, label:string, position:number}>}
 */
function detectSubjects(text) {
  const normalized = norm(text);
  const found = [];
  const usedSlugs = new Set();

  // Flatten alias list and sort by alias length descending
  const candidates = SUBJECT_LIST.flatMap((s) =>
    s.aliases.map((alias) => ({ slug: s.slug, label: s.label, alias, len: alias.length }))
  ).sort((a, b) => b.len - a.len);

  for (const { slug, label, alias } of candidates) {
    if (usedSlugs.has(slug)) continue;
    const idx = normalized.indexOf(alias);
    if (idx !== -1) {
      usedSlugs.add(slug);
      found.push({ slug, label, position: idx });
    }
  }

  // Sort by position in text to preserve user-written order
  found.sort((a, b) => a.position - b.position);
  return found;
}

/**
 * Detect activity hint from text (for sub-block text generation).
 *
 * @param {string} text
 * @returns {string}
 */
function detectActivity(text) {
  const lower = norm(text);
  if (lower.includes('pyq')) return 'PYQs';
  if (lower.includes('practice')) return 'practice';
  if (lower.includes('revision') || lower.includes('revise')) return 'revision';
  if (lower.includes('mapping') || lower.includes(' map')) return 'mapping';
  return '';
}

/**
 * Split an OCR block into sub-blocks if it contains 2+ subjects.
 *
 * @param {string} cleanedText         - Cleaned OCR text
 * @param {Object} [ctx]               - Context from parent block
 * @param {string} [ctx.stage]         - Detected stage ('prelims'|'mains'|'general'|...)
 * @param {string|null} [ctx.gsPaper]  - Detected GS paper ('GS1'|'GS2'|...)
 * @param {number} [ctx.minutes]       - Total block duration
 * @returns {{ subBlocks: SubBlock[] }|null}  - null if no split needed
 */
export function splitOcrBlock(cleanedText, ctx = {}) {
  const subjects = detectSubjects(cleanedText);
  if (subjects.length < 2) return null;

  const { stage = 'general', gsPaper = null, minutes = 0 } = ctx;
  const activity = detectActivity(cleanedText);

  const perMin = Math.floor(minutes / subjects.length);
  const remainder = minutes - perMin * subjects.length;

  const stageLabel = stage && stage !== 'general' ? ` ${stage}` : '';
  const paperLabel = gsPaper ? ` ${gsPaper}` : '';

  const subBlocks = subjects.map((subj, i) => {
    const parts = [subj.label, stageLabel.trim(), paperLabel.trim(), activity]
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    // Avoid duplicate words in text (e.g. "Economy Mains Mains" if stage already in label)
    const text = [...new Set(parts)].join(' ');

    return {
      text,
      subjectSlug: subj.slug,
      subjectLabel: subj.label,
      minutes: perMin + (i === subjects.length - 1 ? remainder : 0),
      stage,
      gsPaper,
      isSplit: true,
    };
  });

  return { subBlocks };
}
