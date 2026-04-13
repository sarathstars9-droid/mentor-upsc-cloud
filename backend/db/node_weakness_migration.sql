-- ============================================================
-- MentorOS: Weak Topic Booster Engine — Schema Migration
-- Safe to run multiple times (all IF NOT EXISTS)
-- Run in Railway → Postgres → Query tab
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS node_weakness_scores (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL,
  node_id               TEXT        NOT NULL,
  stage                 TEXT,
  subject               TEXT,
  mistake_count         INT         NOT NULL DEFAULT 0,
  repeat_mistake_count  INT         NOT NULL DEFAULT 0,
  pending_revision_count INT        NOT NULL DEFAULT 0,
  overdue_revision_count INT        NOT NULL DEFAULT 0,
  reviewed_count        INT         NOT NULL DEFAULT 0,
  snooze_count          INT         NOT NULL DEFAULT 0,
  weakness_score        NUMERIC     NOT NULL DEFAULT 0,
  risk_level            TEXT        NOT NULL DEFAULT 'low',
  last_activity_at      TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, node_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_node_weakness_user
  ON node_weakness_scores (user_id);

CREATE INDEX IF NOT EXISTS idx_node_weakness_user_score
  ON node_weakness_scores (user_id, weakness_score DESC);

CREATE INDEX IF NOT EXISTS idx_node_weakness_risk
  ON node_weakness_scores (user_id, risk_level);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'node_weakness_scores'
ORDER BY ordinal_position;
