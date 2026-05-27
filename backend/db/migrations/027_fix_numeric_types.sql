-- Ensure mapping_confidence stays TEXT (not numeric) - idempotent
ALTER TABLE public.study_blocks ALTER COLUMN mapping_confidence TYPE TEXT USING mapping_confidence::TEXT;

-- Add priority column to study_events as TEXT if it doesn't exist
ALTER TABLE public.study_events ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.study_events ALTER COLUMN priority TYPE TEXT USING priority::TEXT;
