-- Migration 017: Add columns for Mains Mistake Book and Revision Engine

-- MISTAKES TABLE
ALTER TABLE public.mistakes
  ADD COLUMN IF NOT EXISTS attempt_id TEXT,
  ADD COLUMN IF NOT EXISTS paper TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS mistake_type TEXT,
  ADD COLUMN IF NOT EXISTS mistake_text TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- Index for upserting mistakes to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mains_mistake 
  ON public.mistakes(attempt_id, mistake_text) 
  WHERE source_type = 'mains_answer';

-- REVISION ITEMS TABLE
ALTER TABLE public.revision_items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS revision_type TEXT;

-- Index for upserting revision items to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mains_revision 
  ON public.revision_items(source_id, title) 
  WHERE source_type = 'mains_answer';
