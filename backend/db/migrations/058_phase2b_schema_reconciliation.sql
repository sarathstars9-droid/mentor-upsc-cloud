-- 058_phase2b_schema_reconciliation.sql
-- ── MentorOS Phase 2B Schema Reconciliation & Provenance Origin ─────────────────
-- Reconciles schema after initial 057 deployment:
-- 1. Alters user_visual_state.recall_score from NUMERIC(3,2) to NUMERIC(5,2) for 0-100% range support.
-- 2. Adds provenance_origin column to evidence_assets to explicitly distinguish:
--    'live_official_retrieval', 'manual_official_import', 'development_seed', 'test_fixture'.
-- 3. Idempotently enforces check constraints and indexes.

-- ── 1. Reconcile user_visual_state.recall_score Precision ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_visual_state' 
      AND column_name = 'recall_score'
  ) THEN
    ALTER TABLE user_visual_state ALTER COLUMN recall_score TYPE NUMERIC(5, 2);
  END IF;
END $$;

-- ── 2. Add provenance_origin to evidence_assets ───────────────────────────────
ALTER TABLE evidence_assets
  ADD COLUMN IF NOT EXISTS provenance_origin TEXT DEFAULT 'manual_official_import';

-- Enforce valid provenance_origin values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_assets_provenance_origin_check'
  ) THEN
    ALTER TABLE evidence_assets
      ADD CONSTRAINT evidence_assets_provenance_origin_check
      CHECK (
        provenance_origin IN (
          'live_official_retrieval',
          'manual_official_import',
          'development_seed',
          'test_fixture'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_assets_provenance_origin ON evidence_assets (provenance_origin);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_status_origin ON evidence_assets (verification_status, provenance_origin);

-- ── 3. Tag Existing Non-Production Records ────────────────────────────────────
UPDATE evidence_assets
SET provenance_origin = 'development_seed'
WHERE provenance_origin IS NULL OR provenance_origin = 'manual_official_import' AND (canonical_claim_key LIKE '%dev_%' OR title LIKE '%Test%');
