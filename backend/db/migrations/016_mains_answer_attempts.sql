-- Migration 016: Mains Answer Attempts (persistent PostgreSQL store)
-- The table already exists with old columns. This migration safely adds all
-- new columns required for the full persistence flow.
-- All ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements are idempotent.

-- Add attempt_id as unique identifier (frontend-generated)
ALTER TABLE public.mains_answer_attempts
  ADD COLUMN IF NOT EXISTS attempt_id        TEXT         UNIQUE,
  ADD COLUMN IF NOT EXISTS user_id           TEXT,
  ADD COLUMN IF NOT EXISTS question_text     TEXT,
  ADD COLUMN IF NOT EXISTS marks             INTEGER,
  ADD COLUMN IF NOT EXISTS word_limit        INTEGER,
  ADD COLUMN IF NOT EXISTS final_answer_text TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text    TEXT,
  ADD COLUMN IF NOT EXISTS answer_source     TEXT         DEFAULT 'typed',
  ADD COLUMN IF NOT EXISTS uploaded_pages_meta JSONB      DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS basic_review_json JSONB,
  ADD COLUMN IF NOT EXISTS air1_raw_review   TEXT,
  ADD COLUMN IF NOT EXISTS air1_parsed_json  JSONB,
  ADD COLUMN IF NOT EXISTS current_score     TEXT,
  ADD COLUMN IF NOT EXISTS target_score      TEXT,
  ADD COLUMN IF NOT EXISTS status            TEXT         DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS finalized_at      TIMESTAMPTZ;

-- Ensure updated_at exists (may already be there)
ALTER TABLE public.mains_answer_attempts
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ  DEFAULT NOW();

-- Indexes (IF NOT EXISTS makes these idempotent)
CREATE INDEX IF NOT EXISTS idx_mains_attempts_user_id
  ON public.mains_answer_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_mains_attempts_attempt_id
  ON public.mains_answer_attempts(attempt_id);

CREATE INDEX IF NOT EXISTS idx_mains_attempts_status
  ON public.mains_answer_attempts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_mains_attempts_updated
  ON public.mains_answer_attempts(updated_at DESC);
