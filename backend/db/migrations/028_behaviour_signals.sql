CREATE TABLE IF NOT EXISTS public.behaviour_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  block_id TEXT,
  stable_block_id TEXT,
  day_key DATE NOT NULL,
  subject TEXT,
  topic TEXT,
  status TEXT NOT NULL,
  quality TEXT,
  completion_percent INTEGER,
  reason_code TEXT,
  studied_something_else BOOLEAN DEFAULT false,
  alternate_subject TEXT,
  energy_state TEXT,
  hour_bucket TEXT,
  planned_minutes INTEGER,
  actual_minutes INTEGER,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for upserting ensuring idempotency
CREATE UNIQUE INDEX IF NOT EXISTS behaviour_signals_upsert_idx ON public.behaviour_signals(
  user_id,
  day_key,
  stable_block_id
);

-- Index for fast retrieval by user and day
CREATE INDEX IF NOT EXISTS behaviour_signals_user_day_idx ON public.behaviour_signals(user_id, day_key);


