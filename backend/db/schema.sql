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
-- See full migration in backend/db/migrations/001_plan_blocks.sql
CREATE TABLE IF NOT EXISTS plan_blocks (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT         NOT NULL,
  block_id              TEXT         NOT NULL,
  day_key               TEXT         NOT NULL,
  title                 TEXT,
  subject               TEXT,
  topic                 TEXT,
  planned_start         TEXT,
  planned_end           TEXT,
  planned_minutes       INTEGER      NOT NULL DEFAULT 0,
  status                TEXT         NOT NULL DEFAULT 'planned',
  started_at            TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  last_resumed_at       TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  total_pause_seconds   INTEGER      NOT NULL DEFAULT 0,
  pauses_count          INTEGER      NOT NULL DEFAULT 0,
  completion_reason     TEXT,
  calendar_event_id     TEXT,
  calendar_html_link    TEXT,
  calendar_sync_status  TEXT         NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_block_per_user
  ON plan_blocks(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
  ON plan_blocks(user_id, block_id, day_key);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_user_day
  ON plan_blocks(user_id, day_key);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_status
  ON plan_blocks(user_id, status);

-- Reporting metadata (added in migration 002)
-- These ALTER TABLE statements are idempotent via ADD COLUMN IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_blocks' AND column_name='node_id') THEN
    ALTER TABLE plan_blocks ADD COLUMN node_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_blocks' AND column_name='stage') THEN
    ALTER TABLE plan_blocks ADD COLUMN stage TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_blocks' AND column_name='source_type') THEN
    ALTER TABLE plan_blocks ADD COLUMN source_type TEXT;
  END IF;
END $$;

-- ── Audit event log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_block_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  block_id    UUID        REFERENCES plan_blocks(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_user_time
  ON plan_block_events(user_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_block_id
  ON plan_block_events(block_id);

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
