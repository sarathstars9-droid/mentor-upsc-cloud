-- ============================================================
-- Migration 057: Live Official Verification & Visual Knowledge Layer (Phase 2B)
-- 
-- 1. Deduplicate & fix canonical official sources (apfinance.gov.in)
-- 2. New 5-state Evidence Status Model (verified_current, verified_historical, stale, unverified, disputed)
-- 3. Document-Level Provenance & Supersession Fields
-- 4. Shared Visual Knowledge Layer & Exam Sketches
-- 5. User Visual State (Personalization without duplicating global assets)
-- ============================================================

-- ── 1. Re-point foreign keys & Deduplicate official_sources(domain) ───────────
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN (
    SELECT a.id AS duplicate_id, b.id AS keeper_id
    FROM official_sources a
    JOIN official_sources b ON LOWER(a.domain) = LOWER(b.domain) AND a.id > b.id
  ) LOOP
    UPDATE evidence_assets SET source_id = dup.keeper_id WHERE source_id = dup.duplicate_id;
  END LOOP;
END $$;

DELETE FROM official_sources a USING official_sources b
WHERE a.id > b.id AND LOWER(a.domain) = LOWER(b.domain);

CREATE UNIQUE INDEX IF NOT EXISTS idx_official_sources_domain_unique ON official_sources (LOWER(domain));

-- Fix canonical AP Finance domain
UPDATE official_sources
SET domain = 'apfinance.gov.in',
    name = 'Finance Department, Government of Andhra Pradesh (apfinance.gov.in)',
    metadata = metadata || '{"alias_domains": ["finance.ap.gov.in", "budget.ap.gov.in"]}'::jsonb,
    updated_at = NOW()
WHERE domain IN ('finance.ap.gov.in', 'budget.ap.gov.in');

-- ── 2. Add Provenance, Supersession & Freshness columns to evidence_assets ────
ALTER TABLE evidence_assets
  ADD COLUMN IF NOT EXISTS source_document_title TEXT,
  ADD COLUMN IF NOT EXISTS source_document_date DATE,
  ADD COLUMN IF NOT EXISTS source_document_type TEXT,
  ADD COLUMN IF NOT EXISTS source_page_number TEXT,
  ADD COLUMN IF NOT EXISTS source_section TEXT,
  ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_latest_release BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS supersedes_evidence_id UUID REFERENCES evidence_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by_evidence_id UUID REFERENCES evidence_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'DOCUMENT_CROSS_CHECK',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS canonical_claim_key TEXT,
  ADD COLUMN IF NOT EXISTS freshness_class TEXT DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;

-- Drop old check constraint and migrate old 'verified' to 'verified_historical' (or 'verified_current' if active latest)
ALTER TABLE evidence_assets DROP CONSTRAINT IF EXISTS evidence_assets_verification_status_check;

UPDATE evidence_assets
SET verification_status = CASE
  WHEN verification_status = 'verified' AND (expires_at IS NULL OR expires_at > NOW()) AND (is_latest_release = TRUE) THEN 'verified_current'
  WHEN verification_status = 'verified' THEN 'verified_historical'
  WHEN verification_status IN ('unverified', 'stale', 'disputed') THEN verification_status
  ELSE 'verified_historical'
END;

ALTER TABLE evidence_assets
  ADD CONSTRAINT evidence_assets_verification_status_check CHECK (
    verification_status IN ('verified_current', 'verified_historical', 'stale', 'unverified', 'disputed')
  );

CREATE INDEX IF NOT EXISTS idx_evidence_assets_canonical_key ON evidence_assets (canonical_claim_key);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_latest ON evidence_assets (is_latest_release) WHERE is_latest_release = TRUE;

-- ── 3. Knowledge Topics Table Enhancements ───────────────────────────────────
ALTER TABLE knowledge_topics
  ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '[]'::jsonb;

-- ── 4. Visual Assets Table Enhancements ──────────────────────────────────────
ALTER TABLE visual_assets
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'visual_studio',
  ADD COLUMN IF NOT EXISTS source_question_text TEXT,
  ADD COLUMN IF NOT EXISTS target_draw_seconds INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS exam_drawable BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_nodes INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS mode_variants JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_visual_assets_origin ON visual_assets (origin);
CREATE INDEX IF NOT EXISTS idx_visual_assets_exam_drawable ON visual_assets (exam_drawable);

-- ── 5. Visual Topic Links Table (Many-to-Many Topic Relevance) ───────────────
CREATE TABLE IF NOT EXISTS visual_topic_links (
  visual_asset_id UUID NOT NULL REFERENCES visual_assets(id) ON DELETE CASCADE,
  topic_id        UUID NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
  relevance_score NUMERIC(3,2) DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (visual_asset_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_visual_topic_links_topic ON visual_topic_links (topic_id);

-- ── 6. User Visual State (Personalization without duplicating global assets) ─
CREATE TABLE IF NOT EXISTS user_visual_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  visual_asset_id   UUID NOT NULL REFERENCES visual_assets(id) ON DELETE CASCADE,
  is_saved          BOOLEAN DEFAULT FALSE,
  is_pinned         BOOLEAN DEFAULT FALSE,
  revision_status   TEXT DEFAULT 'none', -- 'none', 'learning', 'review_due', 'mastered'
  recall_score      NUMERIC(5,2),
  personal_notes    TEXT,
  highlighted_nodes JSONB DEFAULT '[]'::jsonb,
  last_reviewed_at  TIMESTAMPTZ,
  next_review_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, visual_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_visual_state_user ON user_visual_state (user_id);
CREATE INDEX IF NOT EXISTS idx_user_visual_state_revision ON user_visual_state (user_id, revision_status);
