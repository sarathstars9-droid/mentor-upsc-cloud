-- ============================================================
-- Migration 060: Official Source Retrieval & Current Affairs Issue Builder (Phase 3A)
-- 
-- 1. retrieved_official_documents: Ingested official documents with content hashing
-- 2. current_affairs_issues: Canonical issues aggregating official updates
-- 3. issue_evidence_links: Traceable evidence linkage
-- 4. issue_syllabus_mappings: 1726-node canonical syllabus mapping
-- 5. issue_pyq_links: Linked PYQs from PYQ engine
-- 6. user_issue_revision_state: User-specific revision tracking without global duplication
-- ============================================================

-- 1. Retrieved Official Documents Cache Table
CREATE TABLE IF NOT EXISTS retrieved_official_documents (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID         NOT NULL REFERENCES official_sources(id) ON DELETE RESTRICT,
  canonical_url     TEXT         NOT NULL,
  document_title    TEXT         NOT NULL,
  document_type     TEXT         NOT NULL, -- 'PRESS_RELEASE', 'REPORT', 'CIRCULAR', 'BUDGET_DOCUMENT', 'SURVEY', 'NOTIFICATION'
  publication_date  DATE,
  reference_period  TEXT,                  -- e.g. 'August 2026', 'FY 2026-27'
  retrieved_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  content_hash      TEXT         NOT NULL,
  raw_content       TEXT,
  metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT         NOT NULL DEFAULT 'IMPORTED', -- 'IMPORTED', 'EXTRACTED', 'ARCHIVED', 'SUPERSEDED'
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retrieved_docs_source_hash ON retrieved_official_documents (source_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_retrieved_docs_url ON retrieved_official_documents (canonical_url);
CREATE INDEX IF NOT EXISTS idx_retrieved_docs_pub_date ON retrieved_official_documents (publication_date DESC);

-- 2. Current Affairs Issues Table (Canonical Issue Dossiers)
CREATE TABLE IF NOT EXISTS current_affairs_issues (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_topic_id UUID        REFERENCES knowledge_topics(id) ON DELETE SET NULL,
  title             TEXT         NOT NULL,
  slug              TEXT         UNIQUE NOT NULL,
  status            TEXT         NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'MONITORING', 'ARCHIVED'
  exam_context      TEXT         NOT NULL DEFAULT 'both',   -- 'upsc', 'appsc', 'both'
  region            TEXT         DEFAULT 'india',           -- 'india', 'andhra_pradesh'
  issue_type        TEXT         NOT NULL DEFAULT 'POLICY_MACRO', -- 'POLICY_MACRO', 'GOVERNANCE', 'DISASTER_ENVIRONMENT', 'CONSTITUTIONAL', 'ECONOMIC_SURVEY', 'SCIENCE_TECH'
  first_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  importance        TEXT         NOT NULL DEFAULT 'HIGH',   -- 'CRITICAL', 'HIGH', 'MEDIUM'
  summary           TEXT,
  static_context    TEXT,
  why_in_news       TEXT,
  dimensions        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  arguments         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  counterviews      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  challenges        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  way_forward       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca_issues_topic ON current_affairs_issues (canonical_topic_id);
CREATE INDEX IF NOT EXISTS idx_ca_issues_slug ON current_affairs_issues (slug);
CREATE INDEX IF NOT EXISTS idx_ca_issues_status ON current_affairs_issues (status);
CREATE INDEX IF NOT EXISTS idx_ca_issues_exam_region ON current_affairs_issues (exam_context, region);

-- 3. Issue Evidence Links (Many-to-Many Issue to Official Evidence)
CREATE TABLE IF NOT EXISTS issue_evidence_links (
  issue_id          UUID         NOT NULL REFERENCES current_affairs_issues(id) ON DELETE CASCADE,
  evidence_id       UUID         NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
  role              TEXT         NOT NULL DEFAULT 'primary_evidence', -- 'primary_evidence', 'historical_benchmark', 'contextual_policy'
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (issue_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_ev_links_evidence ON issue_evidence_links (evidence_id);

-- 4. Issue Syllabus Mappings (Connecting Issues to Canonical 1726 Syllabus Nodes)
CREATE TABLE IF NOT EXISTS issue_syllabus_mappings (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id          UUID         NOT NULL REFERENCES current_affairs_issues(id) ON DELETE CASCADE,
  node_id           TEXT         NOT NULL,
  mapping_type      TEXT         NOT NULL DEFAULT 'primary', -- 'primary', 'secondary', 'optional', 'appsc_specific'
  confidence        NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  reason            TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_issue_node UNIQUE (issue_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_syllabus_node ON issue_syllabus_mappings (node_id);

-- 5. Issue PYQ Links (Direct PYQ Engine Linkage)
CREATE TABLE IF NOT EXISTS issue_pyq_links (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id          UUID         NOT NULL REFERENCES current_affairs_issues(id) ON DELETE CASCADE,
  pyq_id            TEXT         NOT NULL,
  relevance_score   NUMERIC(3,2) NOT NULL DEFAULT 0.85,
  reason            TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_issue_pyq UNIQUE (issue_id, pyq_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_pyq_id ON issue_pyq_links (pyq_id);

-- 6. User Issue Revision State (User Isolation for Current Affairs Revision)
CREATE TABLE IF NOT EXISTS user_issue_revision_state (
  user_id           UUID         NOT NULL,
  issue_id          UUID         NOT NULL REFERENCES current_affairs_issues(id) ON DELETE CASCADE,
  is_saved          BOOLEAN      NOT NULL DEFAULT FALSE,
  read_state        TEXT         NOT NULL DEFAULT 'UNREAD', -- 'UNREAD', 'READ', 'REVISED'
  recall_confidence INTEGER      NOT NULL DEFAULT 0,        -- 0 to 5
  weak_dimension    TEXT,
  last_reviewed_at  TIMESTAMPTZ,
  next_review_due   TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_user_issue_revision_due ON user_issue_revision_state (user_id, next_review_due);
