-- ============================================================
-- Migration 015: Repair study_blocks — add all report columns
-- Fixes production errors:
--   column "stage" does not exist        (getTopicWiseSplit / getStageWiseSplit)
--   column "started_at" does not exist   (every aggregate / streak query)
--   column "block_id" does not exist     (STUDIED_BLOCK_SELECT / index)
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- Run in Railway → Postgres → Query tab if needed manually.
-- schema.sql now also contains this patch so it runs on every deploy.
-- ============================================================

ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS block_id              TEXT,
  ADD COLUMN IF NOT EXISTS subject               TEXT,
  ADD COLUMN IF NOT EXISTS subject_id            TEXT,
  ADD COLUMN IF NOT EXISTS topic                 TEXT,
  ADD COLUMN IF NOT EXISTS topic_id              TEXT,
  ADD COLUMN IF NOT EXISTS node_id               TEXT,
  ADD COLUMN IF NOT EXISTS stage                 TEXT,
  ADD COLUMN IF NOT EXISTS block_type            TEXT,
  ADD COLUMN IF NOT EXISTS source_type           TEXT,
  ADD COLUMN IF NOT EXISTS planned_start         TEXT,
  ADD COLUMN IF NOT EXISTS planned_end           TEXT,
  ADD COLUMN IF NOT EXISTS actual_minutes        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_resumed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_pause_seconds   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pauses_count          INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_reason     TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id     TEXT,
  ADD COLUMN IF NOT EXISTS calendar_html_link    TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_status  TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linkage_pending       BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- Backfill safe defaults
UPDATE public.study_blocks SET block_id             = id::TEXT  WHERE block_id             IS NULL;
UPDATE public.study_blocks SET total_pause_seconds  = 0         WHERE total_pause_seconds  IS NULL;
UPDATE public.study_blocks SET pauses_count         = 0         WHERE pauses_count         IS NULL;
UPDATE public.study_blocks SET actual_minutes       = 0         WHERE actual_minutes       IS NULL;
UPDATE public.study_blocks SET calendar_sync_status = 'pending' WHERE calendar_sync_status IS NULL;

-- Ensure index on block_id exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_block_per_user_day
  ON public.study_blocks(user_id, block_id, day_key);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'study_blocks'
  AND  column_name  IN ('block_id','stage','started_at','paused_at','ended_at',
                        'total_pause_seconds','pauses_count','node_id','source_type')
ORDER BY column_name;
-- Expected: 9 rows, one per column listed above.
