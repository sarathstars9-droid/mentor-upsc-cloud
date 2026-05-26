-- 1. Create subject_targets table
CREATE TABLE IF NOT EXISTS public.subject_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  target_hours NUMERIC NOT NULL DEFAULT 0,
  total_weeks INTEGER NOT NULL DEFAULT 1,
  remaining_weeks INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, subject)
);

-- 2. Create notification_channels table
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  channel_type TEXT NOT NULL, -- 'TELEGRAM' | 'WHATSAPP' | 'SLACK'
  destination_id TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, channel_type, destination_id)
);

-- 3. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'MISSED_BLOCK_ALERT' | 'REVISION_DUE_ALERT' | 'END_OF_DAY_REPORT' | 'WEEKLY_MENTOR_REPORT' | 'SYLLABUS_TRACK_REPLY' | 'BACKLOG_ALERT'
  channel_type TEXT NOT NULL, -- 'TELEGRAM' | 'WHATSAPP' | 'SLACK'
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TEXT, -- 'HH:MM' format in Kolkata time
  quiet_hours_end TEXT, -- 'HH:MM' format in Kolkata time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notification_type, channel_type)
);

-- 4. Create notification_events table for deduplication
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  source_type TEXT NOT NULL, -- e.g., 'block' | 'revision_date' | 'daily_date' | 'weekly_date'
  source_id TEXT NOT NULL, -- e.g., block UUID | '2026-05-25' | '2026-W22'
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'sent' | 'failed' | 'skipped'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  payload_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notification_type, source_type, source_id, channel_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_lookup 
  ON public.notification_events (user_id, notification_type, source_type, source_id);
