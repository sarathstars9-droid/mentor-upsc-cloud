-- Phase 3: Canonical Prelims per-question attempt ledger.
-- Additive only: creates a unified SQL ledger and backfills from existing
-- attempt stores without deleting or rewriting existing rows.

CREATE TABLE IF NOT EXISTS prelims_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_answer TEXT,
  correct_answer TEXT,
  answer_status TEXT NOT NULL CHECK (answer_status IN ('correct', 'wrong', 'unattempted')),
  source_type TEXT NOT NULL,
  source_ref TEXT,
  stage TEXT NOT NULL DEFAULT 'prelims' CHECK (stage = 'prelims'),
  paper TEXT,
  subject TEXT,
  topic TEXT,
  node_id TEXT,
  question_text TEXT,
  error_type TEXT,
  evidence_quality TEXT NOT NULL DEFAULT 'verified'
    CHECK (evidence_quality IN ('verified', 'legacy_uncertain')),
  is_legacy_backfill BOOLEAN NOT NULL DEFAULT FALSE,
  history_complete BOOLEAN NOT NULL DEFAULT TRUE,
  is_retest BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, attempt_id, question_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_pqa_user_question_attempted
  ON prelims_question_attempts(user_id, question_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pqa_user_source
  ON prelims_question_attempts(user_id, source_type, source_ref);

CREATE INDEX IF NOT EXISTS idx_pqa_user_retest
  ON prelims_question_attempts(user_id, is_retest, attempted_at DESC);

-- Backfill legacy PYQ intelligence attempts into the canonical ledger.
INSERT INTO prelims_question_attempts (
  user_id,
  attempt_id,
  question_id,
  selected_answer,
  correct_answer,
  answer_status,
  source_type,
  source_ref,
  stage,
  subject,
  node_id,
  evidence_quality,
  is_legacy_backfill,
  history_complete,
  is_retest,
  attempted_at,
  created_at,
  updated_at
)
SELECT
  pa.user_id,
  pa.id::TEXT,
  pa.question_id,
  pa.selected_answer,
  pa.correct_answer,
  CASE
    WHEN pa.is_correct = true THEN 'correct'
    WHEN pa.is_correct = false AND (pa.selected_answer IS NULL OR pa.selected_answer = '') THEN 'unattempted'
    WHEN pa.is_correct = false THEN 'wrong'
    WHEN pa.selected_answer IS NULL OR pa.selected_answer = '' THEN 'unattempted'
    ELSE 'wrong'
  END,
  COALESCE(NULLIF(pa.source_type, ''), 'pyq_practice'),
  pa.test_id,
  'prelims',
  pa.subject_id,
  pa.node_id,
  CASE WHEN pa.is_correct IS NULL THEN 'legacy_uncertain' ELSE 'verified' END,
  true,
  false,
  false,
  COALESCE(pa.created_at, NOW()),
  COALESCE(pa.created_at, NOW()),
  NOW()
FROM pyq_attempts pa
WHERE pa.question_id IS NOT NULL
  AND pa.node_id IS NOT NULL
ON CONFLICT (user_id, attempt_id, question_id, source_type) DO NOTHING;

-- Backfill newer Prelims Test Engine responses into the canonical ledger.
INSERT INTO prelims_question_attempts (
  user_id,
  attempt_id,
  question_id,
  selected_answer,
  correct_answer,
  answer_status,
  source_type,
  source_ref,
  stage,
  paper,
  topic,
  node_id,
  evidence_quality,
  is_legacy_backfill,
  history_complete,
  is_retest,
  attempted_at,
  created_at,
  updated_at
)
SELECT
  ptr.user_id,
  ptr.attempt_id::TEXT,
  ptr.question_id,
  ptr.selected_answer,
  ptr.correct_answer,
  CASE
    WHEN ptr.is_skipped = true THEN 'unattempted'
    WHEN ptr.is_correct = true THEN 'correct'
    WHEN ptr.is_correct = false THEN 'wrong'
    WHEN ptr.selected_answer IS NULL OR ptr.selected_answer = '' THEN 'unattempted'
    ELSE 'wrong'
  END,
  CASE
    WHEN pta.mode = 'year' THEN 'full_length_pyq'
    WHEN pta.mode = 'topic' THEN 'topic_test'
    ELSE 'sectional_test'
  END,
  ptr.attempt_id::TEXT,
  'prelims',
  pta.paper,
  pta.title,
  pta.node_id,
  'verified',
  false,
  true,
  false,
  COALESCE(pta.submitted_at, ptr.updated_at, ptr.created_at, NOW()),
  COALESCE(ptr.created_at, NOW()),
  NOW()
FROM prelims_test_responses ptr
JOIN prelims_test_attempts pta ON pta.id = ptr.attempt_id
WHERE ptr.question_id IS NOT NULL
  AND pta.status = 'submitted'
ON CONFLICT (user_id, attempt_id, question_id, source_type) DO NOTHING;
