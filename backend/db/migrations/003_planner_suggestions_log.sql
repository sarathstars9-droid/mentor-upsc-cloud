-- Migration 003: planner suggestions log
-- Stores every suggestion surfaced to the user.
-- Used by the decay mechanism to de-prioritise repeatedly-ignored topics.

CREATE TABLE IF NOT EXISTS planner_suggestions_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT         NOT NULL,
  subject      TEXT         NOT NULL,
  topic        TEXT,
  suggested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_suggestions_user_time
  ON planner_suggestions_log(user_id, suggested_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_suggestions_subject
  ON planner_suggestions_log(user_id, subject, topic);
