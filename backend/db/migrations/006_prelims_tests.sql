-- 006_prelims_tests.sql
-- Prelims Test Engine: attempt tracking + per-question responses

-- ─── 1. attempts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prelims_test_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('topic', 'year', 'mixed')),
  stage             TEXT NOT NULL DEFAULT 'prelims',
  paper             TEXT NOT NULL CHECK (paper IN ('GS', 'CSAT')),
  title             TEXT,
  node_id           TEXT,
  year              INTEGER,
  total_questions   INTEGER NOT NULL DEFAULT 0,
  attempted_count   INTEGER NOT NULL DEFAULT 0,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  wrong_count       INTEGER NOT NULL DEFAULT 0,
  skipped_count     INTEGER NOT NULL DEFAULT 0,
  score             NUMERIC(8,2) NOT NULL DEFAULT 0,
  accuracy          NUMERIC(5,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. responses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prelims_test_responses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id           UUID NOT NULL REFERENCES prelims_test_attempts(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL,
  question_id          TEXT NOT NULL,
  selected_answer      TEXT,
  correct_answer       TEXT,
  is_correct           BOOLEAN,
  is_skipped           BOOLEAN NOT NULL DEFAULT FALSE,
  time_spent_seconds   INTEGER NOT NULL DEFAULT 0,
  marked_for_review    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- ─── 3. indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pta_user_status  ON prelims_test_attempts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pta_user_mode    ON prelims_test_attempts (user_id, mode);
CREATE INDEX IF NOT EXISTS idx_pta_user_paper   ON prelims_test_attempts (user_id, paper);
CREATE INDEX IF NOT EXISTS idx_pta_user_year    ON prelims_test_attempts (user_id, year);
CREATE INDEX IF NOT EXISTS idx_ptr_attempt_id   ON prelims_test_responses (attempt_id);
CREATE INDEX IF NOT EXISTS idx_ptr_user_qid     ON prelims_test_responses (user_id, question_id);
