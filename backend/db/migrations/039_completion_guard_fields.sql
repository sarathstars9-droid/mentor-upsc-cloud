-- Migration 039: Completion guard and audit fields for study_blocks
ALTER TABLE public.study_blocks 
ADD COLUMN IF NOT EXISTS completion_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS completed_by text,
ADD COLUMN IF NOT EXISTS proof_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS proof_uploaded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS proof_status text,
ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;
