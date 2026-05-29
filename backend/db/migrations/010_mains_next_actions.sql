-- ============================================================
-- Migration 010: mains_next_actions
-- Stores generated next actions from weakness signals.
-- UPSERT on UNIQUE(user_id, action_type, source_weakness_label)
-- so each weakness generates at most one active action per type.
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS mains_next_actions (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT         NOT NULL,
  action_type            TEXT         NOT NULL,   -- 'practice_pyq' | 'revise_notes' | 'rewrite_answer' | 'directive_practice'
  title                  TEXT         NOT NULL,
  description            TEXT         NOT NULL,
  priority               TEXT         NOT NULL DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  source_weakness_label  TEXT         NOT NULL,   -- canonical label that triggered this action
  source_weakness_type   TEXT         NOT NULL,   -- 'component' | 'dimension'
  source_severity        NUMERIC(4,1) NOT NULL DEFAULT 1,
  paper                  TEXT,
  subject                TEXT,
  topic                  TEXT,
  is_done                BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT mains_next_actions_uq
    UNIQUE (user_id, action_type, source_weakness_label)
);

-- Idempotent schema repair: ensure columns exist if table was created before
ALTER TABLE mains_next_actions
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'practice_pyq',
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS source_weakness_label TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_weakness_type TEXT DEFAULT 'component',
  ADD COLUMN IF NOT EXISTS source_severity NUMERIC(4,1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS paper TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS is_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mains_next_actions_user
  ON mains_next_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_mains_next_actions_user_priority
  ON mains_next_actions(user_id, priority, source_severity DESC);

CREATE INDEX IF NOT EXISTS idx_mains_next_actions_user_done
  ON mains_next_actions(user_id, is_done);

-- Verify
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'mains_next_actions';
