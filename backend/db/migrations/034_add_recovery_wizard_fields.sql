-- Migration 034: Add recovery wizard state and answer columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS recovery_wizard_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_wizard_duration INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_wizard_subject VARCHAR(100);
