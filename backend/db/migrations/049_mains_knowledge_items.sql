-- ============================================================
-- Migration 049: Mains Knowledge Items Table
-- Creates the unified repository for RAG context retrieval.
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS mains_knowledge_items (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  paper               TEXT         NOT NULL, -- 'GS1', 'GS2', 'GS3', 'GS4', 'ESSAY', 'GEOGRAPHY_OPTIONAL'
  subject             TEXT         NOT NULL,
  topic               TEXT,
  micro_topic         TEXT,
  syllabus_node_id    TEXT,

  knowledge_type      TEXT         NOT NULL, -- 'SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION', 'GEOGRAPHY_OPTIONAL'
  knowledge_subtype   TEXT,

  title               TEXT         NOT NULL,
  content             TEXT         NOT NULL,
  structured_content  JSONB        DEFAULT '{}',
  tags                TEXT[]       DEFAULT '{}',

  source_type         TEXT,
  source_reference    TEXT,
  source_title        TEXT,
  source_year         INTEGER,

  verification_status TEXT         NOT NULL DEFAULT 'UNVERIFIED', -- 'UNVERIFIED', 'SOURCE_REQUIRED', 'VERIFIED', 'HUMAN_APPROVED'
  lifecycle_status    TEXT         NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'EXPIRED', 'RETIRED'

  verified_at         TIMESTAMPTZ,
  verified_by         TEXT,

  effective_from      TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  last_verified_at    TIMESTAMPTZ,

  generated_by_model  TEXT,
  prompt_version      TEXT,

  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT mains_knowledge_type_check CHECK (
    knowledge_type IN ('SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION', 'GEOGRAPHY_OPTIONAL')
  ),
  CONSTRAINT mains_verification_status_check CHECK (
    verification_status IN ('UNVERIFIED', 'SOURCE_REQUIRED', 'VERIFIED', 'HUMAN_APPROVED')
  ),
  CONSTRAINT mains_lifecycle_status_check CHECK (
    lifecycle_status IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'EXPIRED', 'RETIRED')
  )
);

-- Indices based on retrieval query patterns
CREATE INDEX IF NOT EXISTS idx_mki_node ON mains_knowledge_items (syllabus_node_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mki_paper_subject ON mains_knowledge_items (paper, subject) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mki_type ON mains_knowledge_items (knowledge_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mki_lifecycle_expiry ON mains_knowledge_items (lifecycle_status, expires_at) WHERE is_active = TRUE;
