-- Migration 055: Add soft-delete/archived columns to study_blocks
ALTER TABLE public.study_blocks
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS schedule_deleted_at TIMESTAMPTZ;

-- Index to optimize querying non-archived active blocks
CREATE INDEX IF NOT EXISTS idx_study_blocks_active_timetable
ON public.study_blocks (user_id, day_key)
WHERE archived_at IS NULL AND schedule_deleted_at IS NULL;
