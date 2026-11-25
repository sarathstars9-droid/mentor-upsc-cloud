-- Migration 063: Reconcile active block constraint
-- When a user pauses a block and starts a new block, the previous block is in 'paused' status.
-- Therefore, at most ONE block can be 'active' simultaneously.
DROP INDEX IF EXISTS public.uniq_active_paused_block_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_block_per_user
ON public.study_blocks(user_id)
WHERE status = 'active';
