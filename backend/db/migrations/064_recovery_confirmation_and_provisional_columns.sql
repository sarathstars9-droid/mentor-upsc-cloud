-- Migration 064: Add recovery confirmation, provisional status, and soft delete columns
-- Safe idempotent DDL: ADD COLUMN IF NOT EXISTS

ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completion_source TEXT,
  ADD COLUMN IF NOT EXISTS completed_by TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_deleted_at TIMESTAMPTZ;

-- Backfill existing stale-session-recovered rows without confirmed completion as is_provisional = true
UPDATE public.study_blocks
SET is_provisional = TRUE
WHERE completion_reason = 'stale_session_recovered'
  AND (completed_at IS NULL OR completion_source IS DISTINCT FROM 'user_confirmed')
  AND is_provisional IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_study_blocks_provisional
  ON public.study_blocks (user_id, is_provisional)
  WHERE is_provisional IS TRUE;
