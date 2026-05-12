-- ============================================================
-- Migration 014: Add block_id to study_blocks if missing
-- Fixes production error: column "block_id" does not exist
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- Run in Railway → Postgres → Query tab.
-- ============================================================

-- Add block_id TEXT column if it does not exist yet.
-- On newer deployments that already have block_id this is a no-op.
ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS block_id TEXT;

-- Back-fill: for any rows where block_id is NULL, use the UUID id as the value.
-- This ensures existing rows have a sensible block_id so app logic is consistent.
UPDATE public.study_blocks
SET    block_id = id::TEXT
WHERE  block_id IS NULL;

-- ── VERIFY ────────────────────────────────────────────────────────────────────
-- Run after migration to confirm the column exists and is populated.

SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'study_blocks'
  AND  column_name  = 'block_id';

-- Expected: 1 row — column_name = block_id, data_type = text

SELECT COUNT(*) AS rows_still_null
FROM   public.study_blocks
WHERE  block_id IS NULL;

-- Expected: 0
