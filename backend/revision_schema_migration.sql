-- Safe migration for revision engine
-- Run this after backing up if needed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS revision_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    source_type TEXT,
    source_ref TEXT,
    question_id TEXT,
    stage TEXT,
    subject TEXT,
    node_id TEXT,
    question_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    review_count INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 1,
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE revision_items
    ADD COLUMN IF NOT EXISTS user_id TEXT,
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_ref TEXT,
    ADD COLUMN IF NOT EXISTS question_id TEXT,
    ADD COLUMN IF NOT EXISTS stage TEXT,
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS node_id TEXT,
    ADD COLUMN IF NOT EXISTS question_text TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS revision_items_user_question_stage_uq
ON revision_items (user_id, question_id, stage);

CREATE INDEX IF NOT EXISTS revision_items_user_next_review_idx
ON revision_items (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS revision_items_user_stage_idx
ON revision_items (user_id, stage);
