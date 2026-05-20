-- ============================================================
-- Migration 019: Fix study_blocks lifecycle unique constraint mismatch
-- Deletes duplicate study blocks (keeping the newest one based on updated_at, created_at, ctid)
-- and ensures the unique index uniq_block_per_user_day exists.
-- ============================================================

-- Ensure columns exist (just in case they are missing on older DBs)
ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS block_id TEXT,
  ADD COLUMN IF NOT EXISTS day_key TEXT;

-- Deduplicate by keeping the newest row per (user_id, block_id, day_key)
DELETE FROM public.study_blocks a
USING public.study_blocks b
WHERE a.id <> b.id
  AND COALESCE(a.user_id, '') = COALESCE(b.user_id, '')
  AND COALESCE(a.block_id, '') = COALESCE(b.block_id, '')
  AND COALESCE(a.day_key, '') = COALESCE(b.day_key, '')
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.created_at < b.created_at)
    OR (a.updated_at = b.updated_at AND a.created_at = b.created_at AND a.ctid < b.ctid)
  );

-- Create the unique index if it does not exist
CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
ON public.study_blocks (user_id, block_id, day_key);
