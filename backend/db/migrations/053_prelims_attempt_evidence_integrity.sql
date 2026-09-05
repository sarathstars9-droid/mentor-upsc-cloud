-- Phase 3 evidence integrity gate.
-- Additive provenance columns for trustworthy mastery/repeated-error evidence.

ALTER TABLE prelims_question_attempts
  ADD COLUMN IF NOT EXISTS evidence_quality TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS is_legacy_backfill BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS history_complete BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prelims_question_attempts_evidence_quality_check'
  ) THEN
    ALTER TABLE prelims_question_attempts
      ADD CONSTRAINT prelims_question_attempts_evidence_quality_check
      CHECK (evidence_quality IN ('verified', 'legacy_uncertain'));
  END IF;
END $$;

UPDATE prelims_question_attempts pqa
SET
  evidence_quality = CASE WHEN pa.is_correct IS NULL THEN 'legacy_uncertain' ELSE 'verified' END,
  is_legacy_backfill = true,
  history_complete = false,
  updated_at = NOW()
FROM pyq_attempts pa
WHERE pqa.attempt_id = pa.id::TEXT
  AND pqa.user_id = pa.user_id
  AND pqa.question_id = pa.question_id
  AND pqa.source_type = COALESCE(NULLIF(pa.source_type, ''), 'pyq_practice');

UPDATE prelims_question_attempts
SET history_complete = false, updated_at = NOW()
WHERE is_legacy_backfill = true
  AND history_complete IS DISTINCT FROM false;
