-- Migration 036: Enforce single active or paused block per user
-- Drop the old index that only checked for status = 'active'
DROP INDEX IF EXISTS public.uniq_active_block_per_user;

-- Create a partial unique index checking for status IN ('active', 'paused')
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_paused_block_per_user
ON public.study_blocks(user_id)
WHERE status IN ('active', 'paused');
