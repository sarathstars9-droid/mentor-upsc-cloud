-- ============================================================
-- Migration 009: Mains Intelligence Tables
-- Creates:
--   mains_answer_attempts       — stores user answer attempts
--   mains_answer_evaluations    — stores parsed evaluations (FK → mains_answer_attempts)
--   mains_weakness_signals      — weakness pattern tracking with UPSERT logic
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── mains_answer_attempts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mains_answer_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  paper        TEXT,
  subject      TEXT,
  topic        TEXT,
  question_id  TEXT,
  answer_text  TEXT,
  word_count   INTEGER     DEFAULT 0,
  time_taken   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mains_answer_attempts_user
  ON mains_answer_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_mains_answer_attempts_user_paper
  ON mains_answer_attempts(user_id, paper);

-- ── mains_answer_evaluations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mains_answer_evaluations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT        NOT NULL,
  answer_attempt_id    UUID        NOT NULL REFERENCES mains_answer_attempts(id) ON DELETE CASCADE,
  raw_evaluation       TEXT,
  total_score          NUMERIC(5,2) DEFAULT 0,
  max_score            NUMERIC(5,2) DEFAULT 10,
  intro_score          NUMERIC(5,2) DEFAULT 0,
  structure_score      NUMERIC(5,2) DEFAULT 0,
  content_score        NUMERIC(5,2) DEFAULT 0,
  examples_score       NUMERIC(5,2) DEFAULT 0,
  analysis_score       NUMERIC(5,2) DEFAULT 0,
  conclusion_score     NUMERIC(5,2) DEFAULT 0,
  directive_score      NUMERIC(5,2) DEFAULT 0,
  presentation_score   NUMERIC(5,2) DEFAULT 0,
  strengths            JSONB        DEFAULT '[]',
  weaknesses           JSONB        DEFAULT '[]',
  missing_dimensions   JSONB        DEFAULT '[]',
  improvement_actions  JSONB        DEFAULT '[]',
  one_line_diagnosis   TEXT         DEFAULT '',
  rewrite_task         TEXT         DEFAULT '',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mains_evaluations_user
  ON mains_answer_evaluations(user_id);

CREATE INDEX IF NOT EXISTS idx_mains_evaluations_attempt
  ON mains_answer_evaluations(answer_attempt_id);

-- ── mains_weakness_signals ────────────────────────────────────────────────────
-- Tracks per-user weakness patterns across paper/subject/topic
-- UPSERT on UNIQUE(user_id, paper, subject, topic, weakness_type, weakness_label):
--   evidence_count += 1
--   severity = LEAST(severity + 0.5, 10)
--   last_seen_at = NOW()
CREATE TABLE IF NOT EXISTS mains_weakness_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  paper           TEXT        NOT NULL DEFAULT 'UNKNOWN',
  subject         TEXT        NOT NULL DEFAULT 'UNKNOWN',
  topic           TEXT        NOT NULL DEFAULT 'UNKNOWN',
  weakness_type   TEXT        NOT NULL,   -- 'component' | 'dimension'
  weakness_label  TEXT        NOT NULL,
  severity        NUMERIC(4,1) NOT NULL DEFAULT 1,
  evidence_count  INTEGER     NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mains_weakness_signals_uq
    UNIQUE (user_id, paper, subject, topic, weakness_type, weakness_label)
);

CREATE INDEX IF NOT EXISTS idx_mains_weakness_signals_user
  ON mains_weakness_signals(user_id);

CREATE INDEX IF NOT EXISTS idx_mains_weakness_signals_user_paper
  ON mains_weakness_signals(user_id, paper, subject, topic);

CREATE INDEX IF NOT EXISTS idx_mains_weakness_signals_type
  ON mains_weakness_signals(user_id, weakness_type);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'mains_answer_attempts',
    'mains_answer_evaluations',
    'mains_weakness_signals'
  )
ORDER BY table_name;
