-- Migration 018: Add additional intelligence columns to mains_answer_attempts
ALTER TABLE public.mains_answer_attempts
  ADD COLUMN IF NOT EXISTS inferred_metadata JSONB,
  ADD COLUMN IF NOT EXISTS factual_corrections JSONB,
  ADD COLUMN IF NOT EXISTS weakness_tags JSONB,
  ADD COLUMN IF NOT EXISTS revision_intelligence JSONB,
  ADD COLUMN IF NOT EXISTS syllabus_context JSONB;
