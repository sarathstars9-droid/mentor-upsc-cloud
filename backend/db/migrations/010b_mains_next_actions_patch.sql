-- Migration 010b: patch mains_next_actions
-- Adds answer_attempt_id column (nullable) to link actions to source attempt
-- Safe to run multiple times
ALTER TABLE mains_next_actions
  ADD COLUMN IF NOT EXISTS answer_attempt_id UUID;

CREATE INDEX IF NOT EXISTS idx_mains_next_actions_attempt
  ON mains_next_actions(answer_attempt_id)
  WHERE answer_attempt_id IS NOT NULL;
