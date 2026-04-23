-- Migration 001: plan_blocks lifecycle table
-- Run ONCE. Idempotent.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Core lifecycle table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_blocks (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT         NOT NULL,
  block_id              TEXT         NOT NULL,   -- maps to Google Sheets BlockId
  day_key               TEXT         NOT NULL,   -- YYYY-MM-DD

  -- Schedule metadata (denormalised from Sheets for display when Sheets is offline)
  title                 TEXT,
  subject               TEXT,
  topic                 TEXT,
  planned_start         TEXT,                    -- HH:MM
  planned_end           TEXT,                    -- HH:MM
  planned_minutes       INTEGER      NOT NULL DEFAULT 0,

  -- ── Lifecycle state ──────────────────────────────────────────────────────
  status                TEXT         NOT NULL DEFAULT 'planned',
  -- allowed: planned | active | paused | completed | partial | missed | skipped

  started_at            TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,             -- NULL when active/completed
  last_resumed_at       TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,

  total_pause_seconds   INTEGER      NOT NULL DEFAULT 0,
  pauses_count          INTEGER      NOT NULL DEFAULT 0,

  completion_reason     TEXT,                    -- completed|partial|missed|skipped

  -- ── Google Calendar sync ─────────────────────────────────────────────────
  calendar_event_id     TEXT,
  calendar_html_link    TEXT,
  calendar_sync_status  TEXT         NOT NULL DEFAULT 'pending',
  -- allowed: pending | synced | failed

  -- ── Audit ────────────────────────────────────────────────────────────────
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── DB-level single-active enforcement ───────────────────────────────────────
-- PostgreSQL enforces: only ONE row per user_id can have status = 'active'.
-- Any second INSERT or UPDATE that would create a second active row will throw
-- a unique-violation error, caught by the transaction in blockLifecycleService.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_block_per_user
  ON plan_blocks(user_id)
  WHERE status = 'active';

-- ── Each physical block appears once per day per user ────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
  ON plan_blocks(user_id, block_id, day_key);

-- ── Lookup indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_blocks_user_day
  ON plan_blocks(user_id, day_key);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_block_id
  ON plan_blocks(block_id);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_status
  ON plan_blocks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_calendar_sync
  ON plan_blocks(calendar_sync_status)
  WHERE calendar_sync_status = 'failed';
