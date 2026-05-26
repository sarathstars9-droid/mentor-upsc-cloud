-- 1. Create subject_sub_targets table
CREATE TABLE IF NOT EXISTS public.subject_sub_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  parent_subject TEXT NOT NULL, -- e.g., 'GS1', 'GS2', 'GS3'
  sub_area TEXT NOT NULL, -- e.g., 'Art & Culture'
  target_hours NUMERIC NOT NULL DEFAULT 0,
  study_flow TEXT,
  roi_priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subject_sub_targets_unique UNIQUE (user_id, parent_subject, sub_area)
);

-- 2. Create daily_consistency table if not exists (required by consistencyService.js)
CREATE TABLE IF NOT EXISTS public.daily_consistency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  day_key TEXT NOT NULL, -- 'YYYY-MM-DD'
  status TEXT NOT NULL, -- 'strong' | 'partial' | 'weak'
  score INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT daily_consistency_user_day_unique UNIQUE (user_id, day_key)
);
