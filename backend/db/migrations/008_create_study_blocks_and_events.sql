CREATE TABLE IF NOT EXISTS public.study_blocks (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT         NOT NULL,
  block_id              TEXT         NOT NULL,
  day_key               TEXT         NOT NULL,
  title                 TEXT,
  subject_id            TEXT,
  subject               TEXT,
  topic_id              TEXT,
  topic                 TEXT,
  node_id               TEXT,
  stage                 TEXT,
  block_type            TEXT,
  source_type           TEXT,
  planned_start         TEXT,
  planned_end           TEXT,
  planned_minutes       INTEGER      NOT NULL DEFAULT 0,
  actual_minutes        INTEGER      NOT NULL DEFAULT 0,
  status                TEXT         NOT NULL DEFAULT 'planned',
  started_at            TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  last_resumed_at       TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  total_pause_seconds   INTEGER      NOT NULL DEFAULT 0,
  pauses_count          INTEGER      NOT NULL DEFAULT 0,
  completion_reason     TEXT,
  calendar_event_id     TEXT,
  calendar_html_link    TEXT,
  calendar_sync_status  TEXT         NOT NULL DEFAULT 'pending',
  linkage_pending       BOOLEAN      DEFAULT FALSE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Safety patch: if study_blocks already existed without block_id, add it now
-- before any index referencing it is created.  Idempotent.
ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS block_id TEXT;

UPDATE public.study_blocks
SET    block_id = id::TEXT
WHERE  block_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_block_per_user
  ON public.study_blocks(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
  ON public.study_blocks(user_id, block_id, day_key);

CREATE INDEX IF NOT EXISTS idx_study_blocks_user_day
  ON public.study_blocks(user_id, day_key);

CREATE INDEX IF NOT EXISTS idx_study_blocks_status
  ON public.study_blocks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_study_blocks_node
  ON public.study_blocks(user_id, node_id);


CREATE TABLE IF NOT EXISTS public.plan_block_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL,
  block_id       UUID        REFERENCES public.study_blocks(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  event_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_user_time
  ON public.plan_block_events(user_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_block_id
  ON public.plan_block_events(block_id);

CREATE INDEX IF NOT EXISTS idx_plan_block_events_type
  ON public.plan_block_events(user_id, event_type);
