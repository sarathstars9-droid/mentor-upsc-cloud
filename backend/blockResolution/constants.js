/**
 * constants.js
 * Central constants for the blockResolution module.
 * Defines all entity types, activity types, stages, and canonical keyword maps.
 */

// ─── Entity Types ────────────────────────────────────────────────────────────

export const ENTITY_TYPES = {
  SUBJECT: 'subject',
  TOPIC: 'topic',
  TEST_SERIES: 'test_series',
  MATERIAL: 'material',
  SKILL: 'skill',
  UNKNOWN: 'unknown',
};

// ─── Activity Types ───────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = {
  REVISION: 'revision',
  PRACTICE: 'practice',
  TEST: 'test',
  WRITING: 'writing',
  BRAINSTORMING: 'brainstorming',
  MAPPING: 'mapping',
  READING: 'reading',
  CURRENT_AFFAIRS: 'current_affairs',
  MOCK_ANALYSIS: 'mock_analysis',
  ADMIN: 'admin',
  UNKNOWN: 'unknown',
};

// ─── Stages ───────────────────────────────────────────────────────────────────

export const STAGES = {
  PRELIMS: 'prelims',
  MAINS: 'mains',
  ESSAY: 'essay',
  CSAT: 'csat',
  GENERAL: 'general',
};

// ─── GS Paper → stage mapping ─────────────────────────────────────────────────
// GS-1, GS-2, GS-3, GS-4 are ALL mains papers.
export const GS_PAPER_KEYWORDS = {
  'gs-1': 'GS1',
  'gs-2': 'GS2',
  'gs-3': 'GS3',
  'gs-4': 'GS4',
  'gs1': 'GS1',
  'gs2': 'GS2',
  'gs3': 'GS3',
  'gs4': 'GS4',
  'gs 1': 'GS1',
  'gs 2': 'GS2',
  'gs 3': 'GS3',
  'gs 4': 'GS4',
  'paper 1': 'GS1',
  'paper 2': 'GS2',
  'paper 3': 'GS3',
  'paper 4': 'GS4',
};

// ─── Test Series Families ─────────────────────────────────────────────────────

export const TEST_SERIES_FAMILIES = {
  VISION: 'vision',
  INSIGHTS: 'insights',
  FORUM: 'forum',
  DRISHTI: 'drishti',
  SHANKAR: 'shankar',
  GS_SCORE: 'gs_score',
};

// ─── Keywords → Stage Map ─────────────────────────────────────────────────────
// NOTE: 'gs' alone is NOT a stage keyword — it is always accompanied by a number (gs1, gs2…)
// and those are handled via GS_PAPER_KEYWORDS. Keeping bare 'gs' out prevents false mains tagging.
// NOTE: 'pyq' / 'pyqs' are NOT forced to prelims — PYQs exist for both prelims and mains.
//       Stage must come from explicit keyword only.

export const STAGE_KEYWORDS = {
  prelims: STAGES.PRELIMS,
  'pre.': STAGES.PRELIMS,
  mcq: STAGES.PRELIMS,
  mains: STAGES.MAINS,
  'answer writing': STAGES.MAINS,
  essay: STAGES.ESSAY,
  csat: STAGES.CSAT,
  rc: STAGES.CSAT,
  'reading comprehension': STAGES.CSAT,
  quant: STAGES.CSAT,
};

// ─── Keywords → Activity Map ──────────────────────────────────────────────────

export const ACTIVITY_KEYWORDS = {
  revision: ACTIVITY_TYPES.REVISION,
  revise: ACTIVITY_TYPES.REVISION,
  review: ACTIVITY_TYPES.REVISION,
  practice: ACTIVITY_TYPES.PRACTICE,
  drill: ACTIVITY_TYPES.PRACTICE,
  pyqs: ACTIVITY_TYPES.PRACTICE,
  pyq: ACTIVITY_TYPES.PRACTICE,
  test: ACTIVITY_TYPES.TEST,
  flt: ACTIVITY_TYPES.TEST,
  'full length': ACTIVITY_TYPES.TEST,
  'answer writing': ACTIVITY_TYPES.WRITING,
  writing: ACTIVITY_TYPES.WRITING,
  brainstorm: ACTIVITY_TYPES.BRAINSTORMING,
  brainstorming: ACTIVITY_TYPES.BRAINSTORMING,
  ideas: ACTIVITY_TYPES.BRAINSTORMING,
  outline: ACTIVITY_TYPES.BRAINSTORMING,
  mapping: ACTIVITY_TYPES.MAPPING,
  maps: ACTIVITY_TYPES.MAPPING,
  map: ACTIVITY_TYPES.MAPPING,
  reading: ACTIVITY_TYPES.READING,
  read: ACTIVITY_TYPES.READING,
  'note making': ACTIVITY_TYPES.READING,
  'current affairs': ACTIVITY_TYPES.CURRENT_AFFAIRS,
  'mock analysis': ACTIVITY_TYPES.MOCK_ANALYSIS,
  'mock review': ACTIVITY_TYPES.MOCK_ANALYSIS,
};

// ─── MISC-GEN Whitelist ───────────────────────────────────────────────────────
// MISC-GEN is ONLY allowed when the block explicitly contains one of these intents.
// All normal syllabus topic/subject blocks must return null (unresolved), NOT MISC-GEN.

export const MISC_GEN_ALLOWED_INTENTS = [
  'current affairs',
  'current events',
  'daily ca',
  'pyq practice',
  'previous year practice',
  'revision',
  'revise',
  'mock analysis',
  'mock review',
  'admin',
  'general planning',
  'planning',
  'schedule',
  'mapping',
  'map practice',
];

// ─── Test Series Keywords ─────────────────────────────────────────────────────

export const TEST_SERIES_KEYWORDS = {
  vision: TEST_SERIES_FAMILIES.VISION,
  insights: TEST_SERIES_FAMILIES.INSIGHTS,
  forum: TEST_SERIES_FAMILIES.FORUM,
  drishti: TEST_SERIES_FAMILIES.DRISHTI,
  shankar: TEST_SERIES_FAMILIES.SHANKAR,
  'gs score': TEST_SERIES_FAMILIES.GS_SCORE,
  gsscore: TEST_SERIES_FAMILIES.GS_SCORE,
};

// ─── FLT Number Pattern ───────────────────────────────────────────────────────
// e.g. "flt 12", "flt12", "mock 3"
export const FLT_PATTERN = /(?:flt|mock|dt|pt)\s*(\d+)/i;

// ─── PYQ Pattern ─────────────────────────────────────────────────────────────
export const PYQ_PATTERN = /pyq|previous\s+year/i;

// ─── Mixed Subject Pattern ────────────────────────────────────────────────────
// Detects when a single block mentions 2+ distinct subjects separated by typical delimiters.
// Used by the block splitter to create sub-blocks.
export const MIXED_SUBJECT_DELIMITERS = [' and ', ' + ', ' & ', ',', ' / '];
