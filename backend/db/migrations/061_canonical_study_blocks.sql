-- 061_canonical_study_blocks.sql
-- ── MentorOS: Canonical Study Block Architecture Upgrade ──────────────
-- Supports unified execution model for OCR plans, manual plans, quick start, and carried forward blocks.

ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS plan_comment TEXT,
  ADD COLUMN IF NOT EXISTS study_review TEXT,
  ADD COLUMN IF NOT EXISTS completion_percent INTEGER,
  ADD COLUMN IF NOT EXISTS quality TEXT,
  ADD COLUMN IF NOT EXISTS custom_topic TEXT,
  ADD COLUMN IF NOT EXISTS parent_block_id TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_blocks_completion_percent_check'
  ) THEN
    ALTER TABLE public.study_blocks
      ADD CONSTRAINT study_blocks_completion_percent_check
      CHECK (completion_percent IS NULL OR (completion_percent >= 0 AND completion_percent <= 100));
  END IF;
END $$;

-- Backfill source from source_type where present
UPDATE public.study_blocks
SET source = COALESCE(source, source_type, 'manual')
WHERE source IS NULL;

-- Indexes for fast retrieval and carry-forward lineage tracking
CREATE INDEX IF NOT EXISTS idx_study_blocks_parent_block ON public.study_blocks (parent_block_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_user_day_sort ON public.study_blocks (user_id, day_key, sort_order);
