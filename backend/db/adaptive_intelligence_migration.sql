-- ============================================================
-- MentorOS: Adaptive Intelligence Layer — Schema Migration
-- Step 3: node_weakness table for PYQ-attempt-based weakness tracking
-- Safe to run multiple times (all IF NOT EXISTS)
-- Run in Railway → Postgres → Query tab
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- node_weakness: tracks per-node attempt-based weakness metrics
-- This is SEPARATE from node_weakness_scores (which tracks mistake/revision-based weakness).
-- Both feed into the adaptive recommendation engine.
CREATE TABLE IF NOT EXISTS node_weakness (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL,
  node_id               TEXT        NOT NULL,
  stage                 TEXT        DEFAULT 'prelims',
  subject               TEXT,
  attempts_count        INT         NOT NULL DEFAULT 0,
  correct_count         INT         NOT NULL DEFAULT 0,
  wrong_count           INT         NOT NULL DEFAULT 0,
  accuracy_percent      NUMERIC     NOT NULL DEFAULT 0,
  repeated_wrong_count  INT         NOT NULL DEFAULT 0,
  weakness_score        NUMERIC     NOT NULL DEFAULT 0,
  weakness_level        TEXT        NOT NULL DEFAULT 'stable',
  last_attempted_at     TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, node_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_node_weakness_user
  ON node_weakness (user_id);

CREATE INDEX IF NOT EXISTS idx_node_weakness_user_score
  ON node_weakness (user_id, weakness_score DESC);

CREATE INDEX IF NOT EXISTS idx_node_weakness_level
  ON node_weakness (user_id, weakness_level);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'node_weakness'
ORDER BY ordinal_position;
