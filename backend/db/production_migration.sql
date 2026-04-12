-- ============================================================
-- MentorOS Production Migration
-- Safe to run multiple times (all IF NOT EXISTS / IF EXISTS)
-- Run this in Railway → Postgres → Query tab
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── MISTAKES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mistakes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL,
  source_type    TEXT        NOT NULL,
  source_ref     TEXT,
  question_id    TEXT,
  stage          TEXT,
  subject        TEXT,
  node_id        TEXT,
  question_text  TEXT,
  selected_answer TEXT,
  correct_answer TEXT,
  answer_status  TEXT        NOT NULL,
  error_type     TEXT,
  notes          TEXT,
  must_revise    BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint needed for ON CONFLICT (user_id, question_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mistakes_user_question_uq'
  ) THEN
    ALTER TABLE mistakes
      ADD CONSTRAINT mistakes_user_question_uq UNIQUE (user_id, question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_node ON mistakes(node_id);

-- ── REVISION ITEMS ────────────────────────────────────────────────────────────
-- Create with ALL columns the repository actually uses
CREATE TABLE IF NOT EXISTS revision_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  source_type      TEXT,
  source_id        TEXT,
  source_ref       TEXT,
  question_id      TEXT,
  stage            TEXT,
  subject          TEXT,
  node_id          TEXT,
  title            TEXT,
  content          TEXT,
  question_text    TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  priority         TEXT        NOT NULL DEFAULT 'medium',
  revision_count   INTEGER     NOT NULL DEFAULT 0,
  review_count     INTEGER     NOT NULL DEFAULT 0,
  interval_days    INTEGER     NOT NULL DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patch any existing revision_items table that may be missing columns
ALTER TABLE revision_items
  ADD COLUMN IF NOT EXISTS source_id       TEXT,
  ADD COLUMN IF NOT EXISTS source_ref      TEXT,
  ADD COLUMN IF NOT EXISTS question_id     TEXT,
  ADD COLUMN IF NOT EXISTS stage           TEXT,
  ADD COLUMN IF NOT EXISTS subject         TEXT,
  ADD COLUMN IF NOT EXISTS node_id         TEXT,
  ADD COLUMN IF NOT EXISTS title           TEXT,
  ADD COLUMN IF NOT EXISTS content         TEXT,
  ADD COLUMN IF NOT EXISTS question_text   TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority        TEXT        DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS revision_count  INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count    INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days   INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint required for ON CONFLICT (user_id, question_id, stage)
CREATE UNIQUE INDEX IF NOT EXISTS revision_items_user_question_stage_uq
  ON revision_items (user_id, question_id, stage);

CREATE INDEX IF NOT EXISTS revision_items_user_next_review_idx
  ON revision_items (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS revision_items_user_stage_idx
  ON revision_items (user_id, stage);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
-- Run these after the migration to confirm everything landed correctly.

-- 1. Confirm both tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('mistakes', 'revision_items')
ORDER BY table_name;

-- 2. Confirm all expected columns exist on revision_items
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'revision_items'
ORDER BY ordinal_position;

-- 3. Confirm the unique index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'revision_items'
  AND indexname = 'revision_items_user_question_stage_uq';

-- 4. Row counts
SELECT 'mistakes'      AS tbl, COUNT(*) FROM mistakes
UNION ALL
SELECT 'revision_items', COUNT(*) FROM revision_items;
