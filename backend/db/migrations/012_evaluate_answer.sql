CREATE TABLE IF NOT EXISTS mains_answer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT DEFAULT 'moulika',
    question TEXT,
    answer TEXT,
    paper TEXT,
    marks INTEGER,
    word_limit INTEGER,
    evaluation_json JSONB,
    score NUMERIC,
    weakness_tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Safely add columns if the table was created by a previous migration
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS paper TEXT;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS marks INTEGER;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS word_limit INTEGER;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS evaluation_json JSONB;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE mains_answer_evaluations ADD COLUMN IF NOT EXISTS weakness_tags TEXT[];

-- Make answer_attempt_id nullable if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mains_answer_evaluations' AND column_name='answer_attempt_id') THEN
    ALTER TABLE mains_answer_evaluations ALTER COLUMN answer_attempt_id DROP NOT NULL;
  END IF;
END $$;
