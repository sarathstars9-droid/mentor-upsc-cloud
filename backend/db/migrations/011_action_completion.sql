-- ============================================================
-- Migration 011: Action Completion + Revision Engine
-- Adds:
--   mains_next_actions.status        (pending|completed|skipped)
--   mains_next_actions.completed_at  (TIMESTAMPTZ)
--   mains_weakness_signals.revision_count (INTEGER)
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE mains_next_actions
  ADD COLUMN IF NOT EXISTS status       TEXT         NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for querying pending actions efficiently
CREATE INDEX IF NOT EXISTS idx_mains_next_actions_user_status
  ON mains_next_actions(user_id, status);

-- revision_count tracks how many times a weakness signal was
-- remediated by a completed action — used to decay severity intelligently.
ALTER TABLE mains_weakness_signals
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;

-- Verify
SELECT 'mains_next_actions.status'         AS field WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='mains_next_actions' AND column_name='status'
)
UNION ALL
SELECT 'mains_next_actions.completed_at'   WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='mains_next_actions' AND column_name='completed_at'
)
UNION ALL
SELECT 'mains_weakness_signals.revision_count' WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='mains_weakness_signals' AND column_name='revision_count'
);
