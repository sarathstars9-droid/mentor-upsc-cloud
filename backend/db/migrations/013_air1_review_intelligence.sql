CREATE TABLE IF NOT EXISTS air1_review_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'moulika',
    question TEXT,
    student_answer TEXT,
    air1_review_text TEXT,
    paper TEXT,
    extracted_json JSONB NOT NULL,
    overall_level TEXT,
    estimated_score NUMERIC,
    core_weaknesses TEXT[],
    focus_areas TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'moulika';
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS student_answer TEXT;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS air1_review_text TEXT;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS paper TEXT;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS extracted_json JSONB;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS overall_level TEXT;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS estimated_score NUMERIC;
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS core_weaknesses TEXT[];
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS focus_areas TEXT[];
ALTER TABLE air1_review_intelligence ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
