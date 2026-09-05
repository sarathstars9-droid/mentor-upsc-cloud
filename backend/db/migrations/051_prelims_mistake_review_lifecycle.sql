-- Phase 2: Prelims Mistake Book review lifecycle.
-- Additive only: no deletes, drops, rewrites, or unique-constraint changes.

ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS review_status TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mistakes_review_status_check'
  ) THEN
    ALTER TABLE mistakes
      ADD CONSTRAINT mistakes_review_status_check
      CHECK (
        review_status IS NULL
        OR review_status IN ('new', 'reviewed', 'retest_due')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mistakes_user_stage_review_status
  ON mistakes(user_id, stage, review_status);
