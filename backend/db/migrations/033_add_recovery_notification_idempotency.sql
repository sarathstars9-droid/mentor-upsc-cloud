-- Migration 033: Add recovery notification idempotency field
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_recovery_message_at TIMESTAMPTZ;
