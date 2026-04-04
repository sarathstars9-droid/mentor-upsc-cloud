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

export const STAGE_KEYWORDS = {
  prelims: STAGES.PRELIMS,
  'pre.': STAGES.PRELIMS,
  pyqs: STAGES.PRELIMS,
  'pyq': STAGES.PRELIMS,
  mcq: STAGES.PRELIMS,
  mains: STAGES.MAINS,
  gs: STAGES.MAINS,
  'answer writing': STAGES.MAINS,
  essay: STAGES.ESSAY,
  csat: STAGES.CSAT,
  rc: STAGES.CSAT,
  'reading comprehension': STAGES.CSAT,
  'quant': STAGES.CSAT,
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
  mock: ACTIVITY_TYPES.TEST,
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
};

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
