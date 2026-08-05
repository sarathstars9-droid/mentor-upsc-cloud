CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id),
  day_key TEXT NOT NULL,
  mentor_state_snapshot JSONB,
  current_stage TEXT NOT NULL DEFAULT 'energy',
  energy_level TEXT,
  available_hours TEXT,
  obstacle TEXT,
  first_block_commitment TEXT,
  intended_start_time TEXT,
  csat_commitment TEXT,
  instruction_accepted BOOLEAN,
  final_commitment TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_sessions_user_day ON public.mentor_sessions (user_id, day_key);

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.mentor_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_session ON public.mentor_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_created_at ON public.mentor_messages (created_at);
