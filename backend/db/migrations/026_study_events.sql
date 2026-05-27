-- Idempotent creation of study_events table
CREATE TABLE IF NOT EXISTS public.study_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject TEXT,
  paper TEXT,
  topic TEXT,
  syllabus_node_id TEXT,
  block_id UUID REFERENCES public.study_blocks(id) ON DELETE SET NULL,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_events_user_type ON public.study_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_study_events_node ON public.study_events(syllabus_node_id);
