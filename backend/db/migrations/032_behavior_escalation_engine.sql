-- Migration 032: Behavior Escalation Engine schema additions
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mission_health_state VARCHAR(50) DEFAULT 'HEALTHY',
  ADD COLUMN IF NOT EXISTS consecutive_zero_study_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_missed_plan_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_ignored_reminder_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_meaningful_study_date DATE,
  ADD COLUMN IF NOT EXISTS recovery_day INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_tone_used VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notification_count_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notification_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.daily_mission_health_logs (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  state VARCHAR(50) NOT NULL,
  completed_minutes INTEGER DEFAULT 0,
  expected_minutes INTEGER DEFAULT 0,
  backlog_minutes INTEGER DEFAULT 0,
  consistency_percentage NUMERIC(5,2) DEFAULT 0.00,
  zero_study_streak INTEGER DEFAULT 0,
  missed_plan_streak INTEGER DEFAULT 0,
  recovery_score INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT daily_mission_health_logs_pkey PRIMARY KEY (user_id, date)
);
