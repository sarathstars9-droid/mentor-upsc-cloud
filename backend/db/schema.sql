CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MISTAKES
CREATE TABLE IF NOT EXISTS mistakes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
source_ref TEXT,
question_id TEXT,
stage TEXT,
subject TEXT,
node_id TEXT,
question_text TEXT,
selected_answer TEXT,
correct_answer TEXT,
answer_status TEXT NOT NULL,
error_type TEXT,
notes TEXT,
must_revise BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVISION ITEMS
CREATE TABLE IF NOT EXISTS revision_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
source_id TEXT,
stage TEXT,
subject TEXT,
node_id TEXT,
title TEXT NOT NULL,
content TEXT,
priority TEXT DEFAULT 'medium',
status TEXT DEFAULT 'pending',
due_date TIMESTAMPTZ,
last_reviewed_at TIMESTAMPTZ,
next_review_at TIMESTAMPTZ,
revision_count INT DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MAINS ANSWERS
CREATE TABLE IF NOT EXISTS mains_answers (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
source_type TEXT NOT NULL,
question_id TEXT,
test_id TEXT,
node_id TEXT,
paper TEXT,
question_text TEXT,
user_answer TEXT,
evaluator_type TEXT,
evaluator_score NUMERIC(5,2),
evaluator_feedback TEXT,
strengths JSONB DEFAULT '[]',
weaknesses JSONB DEFAULT '[]',
improvement_points JSONB DEFAULT '[]',
source_meta JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PYQ EXPLANATIONS (AI-generated, user-saved)
CREATE TABLE IF NOT EXISTS pyq_explanations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id TEXT NOT NULL,
question_id TEXT NOT NULL,
explanation_text TEXT NOT NULL,
source TEXT DEFAULT 'chatgpt',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE (user_id, question_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_node ON mistakes(node_id);

CREATE INDEX IF NOT EXISTS idx_revision_user ON revision_items(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_node ON revision_items(node_id);

CREATE INDEX IF NOT EXISTS idx_mains_user ON mains_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_mains_node ON mains_answers(node_id);

CREATE INDEX IF NOT EXISTS idx_pyq_explanations_user ON pyq_explanations(user_id);
CREATE INDEX IF NOT EXISTS idx_pyq_explanations_question ON pyq_explanations(question_id);
