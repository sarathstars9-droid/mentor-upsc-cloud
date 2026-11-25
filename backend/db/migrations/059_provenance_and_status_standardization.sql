-- 059_provenance_and_status_standardization.sql
-- ── MentorOS Phase 2B: Provenance Strictness & Status Standardization ──────────────
-- Reconciliations:
-- 1. Sets default provenance_origin to 'unknown' (never permissively defaulting to manual_official_import).
-- 2. Enforces provenance_origin check: ('live_official_retrieval', 'manual_official_import', 'development_seed', 'test_fixture', 'unknown').
-- 3. Standardizes canonical verification_status: ('verified_current', 'verified_historical', 'stale', 'unverified', 'disputed').
-- 4. Adds official_latest_confirmed BOOLEAN flag to evidence_assets.
-- 5. Demotes non-current/historical seed records and updates aliases.

-- ── 1. Reconcile provenance_origin Default and Constraints ────────────────────
ALTER TABLE evidence_assets
  ALTER COLUMN provenance_origin SET DEFAULT 'unknown';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_assets_provenance_origin_check'
  ) THEN
    ALTER TABLE evidence_assets DROP CONSTRAINT evidence_assets_provenance_origin_check;
  END IF;
  
  ALTER TABLE evidence_assets
    ADD CONSTRAINT evidence_assets_provenance_origin_check
    CHECK (
      provenance_origin IN (
        'live_official_retrieval',
        'manual_official_import',
        'development_seed',
        'test_fixture',
        'unknown'
      )
    );
END $$;

-- ── 2. Add official_latest_confirmed Column ──────────────────────────────────
ALTER TABLE evidence_assets
  ADD COLUMN IF NOT EXISTS official_latest_confirmed BOOLEAN DEFAULT FALSE;

-- ── 3. Standardize verification_status Canonical Vocabulary ───────────────────
-- Migrate legacy status values safely before altering check constraint
UPDATE evidence_assets
SET verification_status = 'unverified'
WHERE verification_status = 'pending_corroboration';

UPDATE evidence_assets
SET verification_status = 'disputed'
WHERE verification_status = 'contradicted';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_assets_verification_status_check'
  ) THEN
    ALTER TABLE evidence_assets DROP CONSTRAINT evidence_assets_verification_status_check;
  END IF;

  ALTER TABLE evidence_assets
    ADD CONSTRAINT evidence_assets_verification_status_check
    CHECK (
      verification_status IN (
        'verified_current',
        'verified_historical',
        'stale',
        'unverified',
        'disputed'
      )
    );
END $$;

-- ── 4. Tag Existing Development & Test Records ───────────────────────────────
UPDATE evidence_assets
SET provenance_origin = 'development_seed'
WHERE provenance_origin = 'manual_official_import' 
  AND (title ILIKE '%dev%' OR title ILIKE '%demo%' OR title ILIKE '%sample%' OR canonical_claim_key ILIKE '%dev%');

CREATE INDEX IF NOT EXISTS idx_evidence_assets_latest_confirmed ON evidence_assets (canonical_claim_key, official_latest_confirmed);
