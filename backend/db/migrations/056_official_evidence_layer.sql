-- ============================================================
-- Migration 056: MentorOS Official Evidence Layer (Phase 2A)
-- Official-source-first verification, evidence assets,
-- visual evidence links, and topic registry.
-- ============================================================

-- 1. Official Sources Registry Table
CREATE TABLE IF NOT EXISTS official_sources (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT         NOT NULL,
  domain         TEXT         NOT NULL,
  source_tier    INTEGER      NOT NULL DEFAULT 1, -- 1: Official National/State, 2: Institutional/International, 3: Explanatory
  authority_type TEXT         NOT NULL,           -- 'CONSTITUTIONAL_BODY', 'PRIMARY_OFFICIAL', 'CENTRAL_BANK', 'STATUTORY_BODY', etc.
  exam_context   TEXT         NOT NULL DEFAULT 'both', -- 'upsc', 'appsc', 'both'
  region         TEXT,                             -- 'india', 'andhra_pradesh', NULL
  subject_tags   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_official    BOOLEAN      NOT NULL DEFAULT TRUE,
  priority       INTEGER      NOT NULL DEFAULT 100,
  active         BOOLEAN      NOT NULL DEFAULT TRUE,
  metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT official_sources_exam_context_check CHECK (
    exam_context IN ('upsc', 'appsc', 'both')
  ),
  CONSTRAINT official_sources_region_check CHECK (
    region IS NULL OR region IN ('india', 'andhra_pradesh')
  )
);

CREATE INDEX IF NOT EXISTS idx_official_sources_tier_priority ON official_sources (source_tier, priority DESC) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_official_sources_domain ON official_sources (domain);
CREATE INDEX IF NOT EXISTS idx_official_sources_exam_region ON official_sources (exam_context, region);

-- 2. Knowledge Topics Table (Foundation for topic linkage)
CREATE TABLE IF NOT EXISTS knowledge_topics (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT         NOT NULL,
  slug         TEXT         UNIQUE,
  syllabus_node_id TEXT,
  exam_context TEXT         NOT NULL DEFAULT 'both',
  region       TEXT,
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_node ON knowledge_topics (syllabus_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_slug ON knowledge_topics (slug);

-- 3. Visual Assets Table (Visual Studio & Mains Diagram Models)
CREATE TABLE IF NOT EXISTS visual_assets (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT         NOT NULL,
  visual_type  TEXT         NOT NULL, -- 'BAR_CHART', 'LINE_GRAPH', 'PIE_CHART', 'PROCESS_FLOW', 'CYCLE', 'MAP', 'TABLE', etc.
  visual_spec  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  topic_id     UUID         REFERENCES knowledge_topics(id) ON DELETE SET NULL,
  exam_context TEXT         NOT NULL DEFAULT 'both',
  region       TEXT,
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visual_assets_topic ON visual_assets (topic_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_type ON visual_assets (visual_type);

-- 4. Evidence Assets Table
CREATE TABLE IF NOT EXISTS evidence_assets (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            UUID         REFERENCES knowledge_topics(id) ON DELETE SET NULL,
  evidence_type       TEXT         NOT NULL, -- 'statistic', 'policy', 'fact', 'metric', 'quote', 'budget_datum'
  title               TEXT         NOT NULL,
  value_text          TEXT         NOT NULL,
  numeric_value       NUMERIC      NULL,
  unit                TEXT,
  source_id           UUID         NOT NULL REFERENCES official_sources(id) ON DELETE RESTRICT,
  source_url          TEXT,
  exam_context        TEXT         NOT NULL DEFAULT 'both', -- 'upsc', 'appsc', 'both'
  region              TEXT,                                 -- 'india', 'andhra_pradesh', NULL
  publication_date    DATE,
  data_period         TEXT,                                 -- e.g. 'FY 2024-25', 'Aug 2024', '16th Finance Commission'
  verification_status TEXT         NOT NULL DEFAULT 'unverified', -- 'verified', 'unverified', 'stale', 'disputed'
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  verified_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  payload             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT evidence_assets_exam_context_check CHECK (
    exam_context IN ('upsc', 'appsc', 'both')
  ),
  CONSTRAINT evidence_assets_region_check CHECK (
    region IS NULL OR region IN ('india', 'andhra_pradesh')
  ),
  CONSTRAINT evidence_assets_verification_status_check CHECK (
    verification_status IN ('verified', 'unverified', 'stale', 'disputed')
  )
);

CREATE INDEX IF NOT EXISTS idx_evidence_assets_topic ON evidence_assets (topic_id);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_status ON evidence_assets (verification_status);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_exam_region ON evidence_assets (exam_context, region);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_source ON evidence_assets (source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_assets_expires ON evidence_assets (expires_at);

-- 5. Visual Evidence Links Table (M:N relationship)
CREATE TABLE IF NOT EXISTS visual_evidence_links (
  visual_asset_id   UUID         NOT NULL REFERENCES visual_assets(id) ON DELETE CASCADE,
  evidence_asset_id UUID         NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
  usage_type        TEXT         NOT NULL DEFAULT 'primary_metric',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (visual_asset_id, evidence_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_visual_evidence_links_evidence ON visual_evidence_links (evidence_asset_id);
