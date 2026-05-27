-- 1. Alter subject_targets to add new tracking columns
ALTER TABLE public.subject_targets
  ADD COLUMN IF NOT EXISTS exam_year TEXT DEFAULT '2027',
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS sub_area TEXT,
  ADD COLUMN IF NOT EXISTS weekly_target_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_average_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS exam_role TEXT;

-- 2. Alter study_blocks to add new tracking columns
ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS paper TEXT,
  ADD COLUMN IF NOT EXISTS subtopic TEXT,
  ADD COLUMN IF NOT EXISTS syllabus_node_id TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT,
  ADD COLUMN IF NOT EXISTS output_expected TEXT,
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS mapping_confidence TEXT DEFAULT 'high';

-- 3. Alter revision_items to extend it instead of creating a new revision_queue
ALTER TABLE public.revision_items
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS syllabus_node_id TEXT,
  ADD COLUMN IF NOT EXISTS weakness TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Create block_logs table
CREATE TABLE IF NOT EXISTS public.block_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES public.study_blocks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  completion_status TEXT,
  output_type TEXT,
  output_count INTEGER DEFAULT 0,
  accuracy NUMERIC(5,2),
  score NUMERIC(5,2),
  confidence TEXT,
  weakness_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_logs_user_block ON public.block_logs(user_id, block_id);

-- 5. Create study_events table
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

-- 6. Create syllabus_node_progress table
CREATE TABLE IF NOT EXISTS public.syllabus_node_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  syllabus_node_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNTOUCHED', -- UNTOUCHED, PLANNED, STUDIED, PYQ_SEEN, PRACTICED, REVISED, MASTERED
  planned_minutes INTEGER NOT NULL DEFAULT 0,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  pyq_seen_count INTEGER NOT NULL DEFAULT 0,
  practice_count INTEGER NOT NULL DEFAULT 0,
  revision_count INTEGER NOT NULL DEFAULT 0,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  last_touched_at TIMESTAMPTZ,
  next_action TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, syllabus_node_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_node_progress_lookup ON public.syllabus_node_progress(user_id, syllabus_node_id);

-- 7. Create backlog_items table
CREATE TABLE IF NOT EXISTS public.backlog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  syllabus_node_id TEXT,
  reason TEXT,
  risk_level TEXT,
  rescue_action TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlog_items_lookup ON public.backlog_items(user_id, status);
