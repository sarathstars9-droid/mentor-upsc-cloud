-- Migration 018: question-scoped mains attempt restore
-- Adds a stable frontend/backend key for exact per-question persistence.

ALTER TABLE public.mains_answer_attempts
  ADD COLUMN IF NOT EXISTS question_key TEXT;

CREATE INDEX IF NOT EXISTS idx_mains_attempts_user_question_key_updated
  ON public.mains_answer_attempts(user_id, question_key, updated_at DESC);
