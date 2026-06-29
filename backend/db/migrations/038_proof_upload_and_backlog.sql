-- backend/db/migrations/038_proof_upload_and_backlog.sql

ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_type TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS proof_notes TEXT;

CREATE TABLE IF NOT EXISTS public.study_block_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  block_id UUID REFERENCES public.study_blocks(id) ON DELETE CASCADE,
  proof_url TEXT,
  proof_type TEXT NOT NULL,
  proof_notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_study_block_proofs_block
  ON public.study_block_proofs(block_id);
