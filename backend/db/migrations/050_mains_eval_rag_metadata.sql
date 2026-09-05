-- Migration 050: Add RAG context metadata columns to mains_answer_evaluations
-- Part of V1.5A: Knowledge + RAG Foundation
-- These columns store audit trails of which knowledge items/PYQs were retrieved
-- and injected into the evaluation prompt, along with gap coverage metadata.

ALTER TABLE mains_answer_evaluations
  ADD COLUMN IF NOT EXISTS rag_retrieval_version  TEXT,
  ADD COLUMN IF NOT EXISTS rag_knowledge_item_ids JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rag_retrieved_pyq_ids  JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rag_missing_categories JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rag_category_counts    JSONB   DEFAULT '{}'::jsonb;

-- Index for future audit queries (e.g., "which evaluations used item X?")
CREATE INDEX IF NOT EXISTS idx_mains_eval_rag_version
  ON mains_answer_evaluations (rag_retrieval_version)
  WHERE rag_retrieval_version IS NOT NULL;

COMMENT ON COLUMN mains_answer_evaluations.rag_retrieval_version  IS 'Retrieval pipeline version tag (e.g., mains-rag-v1)';
COMMENT ON COLUMN mains_answer_evaluations.rag_knowledge_item_ids IS 'Array of mains_knowledge_items.id values injected into the prompt';
COMMENT ON COLUMN mains_answer_evaluations.rag_retrieved_pyq_ids  IS 'Array of PYQ IDs retrieved by the RAG engine for this evaluation';
COMMENT ON COLUMN mains_answer_evaluations.rag_missing_categories IS 'Knowledge categories that had zero trusted items at retrieval time';
COMMENT ON COLUMN mains_answer_evaluations.rag_category_counts    IS 'Per-category item counts from the retrieval (SUBJECT_LANGUAGE, DIMENSION, EVIDENCE, etc.)';
