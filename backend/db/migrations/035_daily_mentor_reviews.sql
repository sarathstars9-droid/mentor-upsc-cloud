-- Migration 035: Create daily_mentor_reviews table for storing UPSC Mentor reviews and replies
CREATE TABLE IF NOT EXISTS public.daily_mentor_reviews (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  achievements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  misses_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  mentor_observation TEXT NOT NULL,
  recommended_first_block TEXT NOT NULL,
  reflection_question TEXT NOT NULL,
  user_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);
