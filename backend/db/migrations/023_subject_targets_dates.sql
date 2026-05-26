-- 1. Add mission_start_date and mission_end_date columns to subject_targets table
ALTER TABLE public.subject_targets
  ADD COLUMN IF NOT EXISTS mission_start_date DATE NOT NULL DEFAULT '2026-05-25',
  ADD COLUMN IF NOT EXISTS mission_end_date DATE NOT NULL DEFAULT '2027-04-15';
