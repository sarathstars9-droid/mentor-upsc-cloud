-- ============================================================
-- MentorOS Phase 8: Knowledge Linkage Engine — Schema Migration
-- Safe to run multiple times (all IF NOT EXISTS / IF EXISTS)
-- Run in Railway → Postgres → Query tab
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── BLOCK ↔ PYQ LINKAGE TABLE ────────────────────────────────────────────────
-- Links a completed study block to its PYQ recommendation.
-- One row per block. Status tracks follow-through lifecycle.
--
-- status values:
--   pending_linkage — block completed, linkage processing queued
--   recommended     — PYQs found and recommended to user
--   started         — user began attempting PYQs
--   completed       — user finished attempting PYQs
--   skipped         — user dismissed recommendation
--   no_pyqs         — no PYQs available for this node
--   skipped_generic — block was generic/unmapped, linkage not created

CREATE TABLE IF NOT EXISTS block_pyq_links (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    TEXT         NOT NULL,
  block_id                   UUID         NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
  node_id                    TEXT,
  stage                      TEXT,
  recommended_question_count INTEGER      NOT NULL DEFAULT 0,
  attempted_question_count   INTEGER      NOT NULL DEFAULT 0,
  correct_count              INTEGER      NOT NULL DEFAULT 0,
  wrong_count                INTEGER      NOT NULL DEFAULT 0,
  status                     TEXT         NOT NULL DEFAULT 'pending_linkage',
  skip_reason                TEXT,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Idempotency: one linkage row per user+block. Retries / multi-tab safe.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_pyq_link_per_user_block
  ON block_pyq_links (user_id, block_id);

-- Planner queries: find unactioned recommendations
CREATE INDEX IF NOT EXISTS idx_bpl_user_status
  ON block_pyq_links (user_id, status);

-- Block detail lookups
CREATE INDEX IF NOT EXISTS idx_bpl_block_id
  ON block_pyq_links (block_id);

-- Node context queries
CREATE INDEX IF NOT EXISTS idx_bpl_user_node
  ON block_pyq_links (user_id, node_id);

-- Date-range queries for reporting
CREATE INDEX IF NOT EXISTS idx_bpl_created_at
  ON block_pyq_links (user_id, created_at);

-- ── ADD TRACEABILITY COLUMNS TO MISTAKES ─────────────────────────────────────
-- block_id links a mistake back to the study block that triggered practice
ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS block_id UUID;

-- ── ADD TRACEABILITY COLUMNS TO REVISION_ITEMS ──────────────────────────────
-- block_id links a revision item back to the originating study block
-- mistake_id links a revision item back to the specific mistake
ALTER TABLE revision_items
  ADD COLUMN IF NOT EXISTS block_id    UUID;
ALTER TABLE revision_items
  ADD COLUMN IF NOT EXISTS mistake_id  UUID;

-- ── ADD LINKAGE PENDING FLAG TO PLAN_BLOCKS ─────────────────────────────────
-- Used for durable async linkage processing.
-- Set to TRUE on block completion, cleared after linkage is processed.
ALTER TABLE plan_blocks
  ADD COLUMN IF NOT EXISTS linkage_pending BOOLEAN NOT NULL DEFAULT FALSE;

-- ── VERIFY ──────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('block_pyq_links', 'plan_blocks', 'mistakes', 'revision_items')
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'block_pyq_links'
ORDER BY ordinal_position;
