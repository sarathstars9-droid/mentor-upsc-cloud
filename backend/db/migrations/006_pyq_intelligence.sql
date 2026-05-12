CREATE TABLE IF NOT EXISTS pyq_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  test_id TEXT,
  question_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  subject_id TEXT,
  stage TEXT DEFAULT 'Prelims',
  year INT,
  selected_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN,
  time_taken_sec INT DEFAULT 0,
  source_type TEXT DEFAULT 'pyq_practice',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pyq_attempts_user_node
ON pyq_attempts(user_id, node_id);

CREATE INDEX IF NOT EXISTS idx_pyq_attempts_user_question
ON pyq_attempts(user_id, question_id);

CREATE TABLE IF NOT EXISTS pyq_node_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  subject_id TEXT,
  attempts INT DEFAULT 0,
  correct INT DEFAULT 0,
  wrong INT DEFAULT 0,
  accuracy NUMERIC DEFAULT 0,
  avg_time_sec NUMERIC DEFAULT 0,
  strength_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'unseen',
  last_attempted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, node_id)
);