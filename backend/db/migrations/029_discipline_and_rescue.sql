CREATE TABLE IF NOT EXISTS discipline_events (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  channel TEXT,
  status TEXT DEFAULT 'open',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS untracked_study_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  study_date DATE DEFAULT CURRENT_DATE,
  source_event_id INTEGER,
  user_reply TEXT,
  parsed_subject TEXT,
  parsed_topic TEXT,
  parsed_hours NUMERIC,
  parsed_activity_type TEXT,
  saved_to_plan BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
