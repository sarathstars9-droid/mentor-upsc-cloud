-- Migration 002: reporting columns + audit event table
-- Idempotent — safe to run multiple times.

-- ── Extend plan_blocks with reporting metadata ────────────────────────────────
ALTER TABLE plan_blocks
  ADD COLUMN IF NOT EXISTS node_id     TEXT,          -- e.g. GS2-POL, CSAT-BN
  ADD COLUMN IF NOT EXISTS stage       TEXT,          -- prelims|mains|essay|ethics|optional|csat
  ADD COLUMN IF NOT EXISTS source_type TEXT;          -- topic|test|practice|task|revision

-- Supporting indexes for report queries
CREATE INDEX IF NOT EXISTS idx_plan_blocks_stage
  ON plan_blocks(user_id, stage);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_node
  ON plan_blocks(user_id, node_id);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_day_status
  ON plan_blocks(user_id, day_key, status);

-- ── Audit event log ───────────────────────────────────────────────────────────
-- Records every lifecycle transition for debugging and deep analytics.
-- block_id is UUID referencing plan_blocks.id.
CREATE TABLE IF NOT EXISTS plan_block_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  block_id    UUID        REFERENCES plan_blocks(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  -- event_type values:
  --   started | paused | resumed | completed | auto_completed | auto_repaired
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_user_time
  ON plan_block_events(user_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_block_id
  ON plan_block_events(block_id);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_type
  ON plan_block_events(user_id, event_type);
