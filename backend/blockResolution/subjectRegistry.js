/**
 * subjectRegistry.js
 * Canonical subject registry: maps known aliases/keywords → canonical subject slug.
 * Used by detectEntityType and resolveTopicBlock to normalize subject names.
 */

/**
 * @typedef {Object} SubjectEntry
 * @property {string} slug        - Canonical identifier, e.g. "polity"
 * @property {string} label       - Human-readable label
 * @property {string[]} aliases   - Lowercase keyword aliases
 * @property {string} stage       - Default stage: 'prelims' | 'mains' | 'general'
 */

/** @type {SubjectEntry[]} */
export const SUBJECT_REGISTRY = [
  {
    slug: 'polity',
    label: 'Indian Polity & Governance',
    aliases: ['polity', 'political science', 'constitution', 'governance', 'parliament', 'fundamental rights', 'judiciary'],
    stage: 'general',
  },
  {
    slug: 'economy',
    label: 'Indian Economy',
    aliases: ['economy', 'economics', 'economic', 'gdp', 'inflation', 'monetary policy', 'fiscal', 'budget'],
    stage: 'general',
  },
  {
    slug: 'history_modern',
    label: 'Modern History',
    aliases: ['modern history', 'modern india', 'freedom struggle', 'independence', 'british', 'colonial', 'history'],
    stage: 'general',
  },
  {
    slug: 'history_ancient',
    label: 'Ancient & Medieval History',
    aliases: ['ancient history', 'ancient india', 'medieval history', 'medieval india', 'mughal', 'delhi sultanate', 'maurya', 'gupta', 'ancient', 'medieval'],
    stage: 'general',
  },
  {
    slug: 'history_world',
    label: 'World History',
    aliases: ['world history', 'world war', 'cold war', 'french revolution', 'industrial revolution'],
    stage: 'mains',
  },
  {
    slug: 'geography_india',
    label: 'Indian Geography',
    aliases: ['india geography', 'indian geography', 'india geo', 'india mapping', 'india map'],
    stage: 'general',
  },
  {
    slug: 'geography_world',
    label: 'World Geography',
    aliases: ['world geography', 'world geo', 'world mapping', 'world map', 'physical geography'],
    stage: 'general',
  },
  {
    slug: 'environment',
    label: 'Environment & Ecology',
    aliases: ['environment', 'ecology', 'biodiversity', 'climate change', 'pollution', 'forest', 'wildlife'],
    stage: 'general',
  },
  {
    slug: 'science_tech',
    label: 'Science & Technology',
    aliases: ['science', 'technology', 'science tech', 's&t', 'space', 'defence technology', 'biotech',],
    stage: 'general',
  },
  {
    slug: 'current_affairs',
    label: 'Current Affairs',
    aliases: ['current affairs', 'current events', 'news'],
    stage: 'general',
  },
  {
    slug: 'ethics',
    label: 'Ethics, Integrity & Aptitude',
    aliases: ['ethics', 'integrity', 'aptitude', 'attitude', 'moral', 'values', 'gs4', 'gs 4', 'gs-4', 'gs iv', 'gs-iv', 'general studies 4', 'general studies iv', 'general studies paper 4', 'ethics integrity aptitude', 'ethics, integrity, aptitude'],
    stage: 'mains',
  },
  {
    slug: 'essay',
    label: 'Essay',
    aliases: ['essay'],
    stage: 'essay',
  },
  {
    slug: 'csat',
    label: 'CSAT',
    aliases: ['csat', 'rc', 'reading comprehension', 'comprehension', 'quant', 'quantitative', 'logical reasoning'],
    stage: 'csat',
  },
  {
    slug: 'gs1',
    label: 'GS Paper 1',
    aliases: ['gs1', 'gs 1', 'paper 1'],
    stage: 'mains',
  },
  {
    slug: 'gs2',
    label: 'GS Paper 2',
    aliases: ['gs2', 'gs 2', 'paper 2'],
    stage: 'mains',
  },
  {
    slug: 'gs3',
    label: 'GS Paper 3',
    aliases: ['gs3', 'gs 3', 'paper 3'],
    stage: 'mains',
  },
  {
    slug: 'sociology',
    label: 'Sociology (Optional)',
    aliases: ['sociology', 'socio'],
    stage: 'mains',
  },
  {
    slug: 'internal_security',
    label: 'Internal Security',
    aliases: ['internal security', 'terrorism', 'naxal', 'insurgency'],
    stage: 'mains',
  },
  {
    slug: 'disaster_management',
    label: 'Disaster Management',
    aliases: ['disaster', 'disaster management',],
    stage: 'mains',
  },
];

/**
 * Looks up a subject entry by any alias (case-insensitive partial match).
 * @param {string} text - Raw input text to match against aliases
 * @returns {SubjectEntry|null}
 */
export function findSubject(text) {
  const lower = text.toLowerCase();
  // Prefer longest alias match to avoid partial collisions (e.g. "gs1" vs "gs")
  let bestMatch = null;
  let bestLen = 0;

  for (const entry of SUBJECT_REGISTRY) {
    for (const alias of entry.aliases) {
      if (lower.includes(alias) && alias.length > bestLen) {
        bestMatch = entry;
        bestLen = alias.length;
      }
    }
  }

  return bestMatch;
}
