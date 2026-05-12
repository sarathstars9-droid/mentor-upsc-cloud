CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MISTAKES
CREATE TABLE IF NOT EXISTS mistakes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
source_ref TEXT,
question_id TEXT,
stage TEXT,
subject TEXT,
node_id TEXT,
question_text TEXT,
selected_answer TEXT,
correct_answer TEXT,
answer_status TEXT NOT NULL,
error_type TEXT,
notes TEXT,
must_revise BOOLEAN DEFAULT FALSE,
revision_flag BOOLEAN DEFAULT FALSE,
is_important BOOLEAN DEFAULT FALSE,
is_weak BOOLEAN DEFAULT FALSE,
is_read BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVISION ITEMS
CREATE TABLE IF NOT EXISTS revision_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
source_id TEXT,
stage TEXT,
subject TEXT,
node_id TEXT,
title TEXT NOT NULL,
content TEXT,
priority TEXT DEFAULT 'medium',
status TEXT DEFAULT 'pending',
due_date TIMESTAMPTZ,
last_reviewed_at TIMESTAMPTZ,
next_review_at TIMESTAMPTZ,
revision_count INT DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MAINS ANSWERS
CREATE TABLE IF NOT EXISTS mains_answers (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
question_id TEXT,
test_id TEXT,
node_id TEXT,
paper TEXT,
question_text TEXT,
user_answer TEXT,
evaluator_type TEXT,
evaluator_score NUMERIC(5,2),
evaluator_feedback TEXT,
strengths JSONB DEFAULT '[]',
weaknesses JSONB DEFAULT '[]',
improvement_points JSONB DEFAULT '[]',
source_meta JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PYQ EXPLANATIONS (AI-generated, user-saved)
CREATE TABLE IF NOT EXISTS pyq_explanations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
question_id TEXT NOT NULL,
explanation_text TEXT NOT NULL,
source TEXT DEFAULT 'chatgpt',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE (user_id, question_id)
);

-- ── Plan block lifecycle ─────────────────────────────────────────────────────
-- Renamed from plan_blocks to study_blocks
CREATE TABLE IF NOT EXISTS public.study_blocks (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT         NOT NULL,
  block_id              TEXT         NOT NULL,
  day_key               TEXT         NOT NULL,
  title                 TEXT,
  subject_id            TEXT,
  subject               TEXT,
  topic_id              TEXT,
  topic                 TEXT,
  node_id               TEXT,
  stage                 TEXT,
  block_type            TEXT,
  source_type           TEXT,
  planned_start         TEXT,
  planned_end           TEXT,
  planned_minutes       INTEGER      NOT NULL DEFAULT 0,
  actual_minutes        INTEGER      NOT NULL DEFAULT 0,
  status                TEXT         NOT NULL DEFAULT 'planned',
  started_at            TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  last_resumed_at       TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  total_pause_seconds   INTEGER      NOT NULL DEFAULT 0,
  pauses_count          INTEGER      NOT NULL DEFAULT 0,
  completion_reason     TEXT,
  calendar_event_id     TEXT,
  calendar_html_link    TEXT,
  calendar_sync_status  TEXT         NOT NULL DEFAULT 'pending',
  linkage_pending       BOOLEAN      DEFAULT FALSE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Safety patch for older production DBs ────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS is a no-op when the table already exists.
-- Any columns added after the original table creation are therefore missing
-- on older Railway deployments.  These ALTER TABLE statements are fully
-- idempotent (ADD COLUMN IF NOT EXISTS) and safe to run repeatedly.
-- They must appear BEFORE any index that references the added columns.
ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS block_id              TEXT,
  ADD COLUMN IF NOT EXISTS subject               TEXT,
  ADD COLUMN IF NOT EXISTS subject_id            TEXT,
  ADD COLUMN IF NOT EXISTS topic                 TEXT,
  ADD COLUMN IF NOT EXISTS topic_id              TEXT,
  ADD COLUMN IF NOT EXISTS node_id               TEXT,
  ADD COLUMN IF NOT EXISTS stage                 TEXT,
  ADD COLUMN IF NOT EXISTS block_type            TEXT,
  ADD COLUMN IF NOT EXISTS source_type           TEXT,
  ADD COLUMN IF NOT EXISTS planned_start         TEXT,
  ADD COLUMN IF NOT EXISTS planned_end           TEXT,
  ADD COLUMN IF NOT EXISTS actual_minutes        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_resumed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_pause_seconds   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pauses_count          INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_reason     TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id     TEXT,
  ADD COLUMN IF NOT EXISTS calendar_html_link    TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_status  TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linkage_pending       BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- Backfill safe defaults for columns that are now NOT NULL in code logic
UPDATE public.study_blocks SET block_id            = id::TEXT  WHERE block_id            IS NULL;
UPDATE public.study_blocks SET total_pause_seconds = 0         WHERE total_pause_seconds IS NULL;
UPDATE public.study_blocks SET pauses_count        = 0         WHERE pauses_count        IS NULL;
UPDATE public.study_blocks SET actual_minutes      = 0         WHERE actual_minutes      IS NULL;
UPDATE public.study_blocks SET calendar_sync_status= 'pending' WHERE calendar_sync_status IS NULL;
-- ─────────────────────────────────────────────────────────────────────────────


CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_block_per_user
  ON public.study_blocks(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
  ON public.study_blocks(user_id, block_id, day_key);

CREATE INDEX IF NOT EXISTS idx_study_blocks_user_day
  ON public.study_blocks(user_id, day_key);

CREATE INDEX IF NOT EXISTS idx_study_blocks_status
  ON public.study_blocks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_study_blocks_node
  ON public.study_blocks(user_id, node_id);


-- ── Audit event log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_block_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL,
  block_id       UUID        REFERENCES public.study_blocks(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  event_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_user_time
  ON public.plan_block_events(user_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_block_id
  ON public.plan_block_events(block_id);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_type
  ON public.plan_block_events(user_id, event_type);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_node ON mistakes(node_id);

CREATE INDEX IF NOT EXISTS idx_revision_user ON revision_items(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_node ON revision_items(node_id);

CREATE INDEX IF NOT EXISTS idx_mains_user ON mains_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_mains_node ON mains_answers(node_id);

CREATE INDEX IF NOT EXISTS idx_pyq_explanations_user ON pyq_explanations(user_id);
CREATE INDEX IF NOT EXISTS idx_pyq_explanations_question ON pyq_explanations(question_id);

-- ── Planner suggestion log (adaptive decay) ────────────────────────────────────
-- See full migration in backend/db/migrations/003_planner_suggestions_log.sql
CREATE TABLE IF NOT EXISTS planner_suggestions_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT         NOT NULL,
  subject      TEXT         NOT NULL,
  topic        TEXT,
  suggested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_suggestions_user_time
  ON planner_suggestions_log(user_id, suggested_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_suggestions_subject
  ON planner_suggestions_log(user_id, subject, topic);
