-- migrate_scheduler_tables.sql

CREATE TABLE IF NOT EXISTS public.subject_sub_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    parent_subject VARCHAR(100) NOT NULL,
    sub_area VARCHAR(150) NOT NULL,
    target_hours NUMERIC NOT NULL,
    study_flow VARCHAR(255),
    roi_priority VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- e.g., 'GOOD_MORNING_MISSION', 'PLAN_NOT_UPLOADED', 'PLAN_NOT_STARTED', 'BLOCK_PAUSED_TOO_LONG'
    ref_id VARCHAR(100) NOT NULL,     -- e.g., todayKey, or block_id
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT notification_events_user_type_ref_unique UNIQUE (user_id, event_type, ref_id)
);

CREATE TABLE IF NOT EXISTS public.daily_consistency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    day_key VARCHAR(20) NOT NULL,     -- e.g., '2026-05-25'
    status VARCHAR(50) NOT NULL,      -- 'strong', 'partial', 'weak'
    score NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT daily_consistency_user_day_unique UNIQUE (user_id, day_key)
);

-- Seed data for GS1, GS2, GS3 for Moulika
DELETE FROM public.subject_sub_targets WHERE user_id = 'moulika' AND parent_subject IN ('GS1', 'GS2', 'GS3');

-- GS1 Seed
INSERT INTO public.subject_sub_targets (user_id, parent_subject, sub_area, target_hours) VALUES
('moulika', 'GS1', 'Art & Culture', 35),
('moulika', 'GS1', 'Modern History', 35),
('moulika', 'GS1', 'Post-Independence India', 15),
('moulika', 'GS1', 'World History', 15),
('moulika', 'GS1', 'Indian Society', 40),
('moulika', 'GS1', 'Physical Geography GS Level', 20),
('moulika', 'GS1', 'Indian & World Geography', 35),
('moulika', 'GS1', 'GS1 Mains PYQ + Answer Writing', 35),
('moulika', 'GS1', 'Revision Sheets + Diagrams', 20);

-- GS2 Seed
INSERT INTO public.subject_sub_targets (user_id, parent_subject, sub_area, target_hours) VALUES
('moulika', 'GS2', 'Polity & Constitution Static', 65),
('moulika', 'GS2', 'Governance', 35),
('moulika', 'GS2', 'Social Justice', 40),
('moulika', 'GS2', 'Welfare Schemes', 25),
('moulika', 'GS2', 'International Relations', 40),
('moulika', 'GS2', 'Judgments/Committees/Reports', 25),
('moulika', 'GS2', 'GS2 Mains PYQ + Answer Writing', 45),
('moulika', 'GS2', 'Revision Sheets', 25);

-- GS3 Seed
INSERT INTO public.subject_sub_targets (user_id, parent_subject, sub_area, target_hours) VALUES
('moulika', 'GS3', 'Economy', 60),
('moulika', 'GS3', 'Agriculture', 35),
('moulika', 'GS3', 'Environment', 45),
('moulika', 'GS3', 'Science & Technology', 30),
('moulika', 'GS3', 'Internal Security', 35),
('moulika', 'GS3', 'Disaster Management', 20),
('moulika', 'GS3', 'Infrastructure/Industry/Energy', 20),
('moulika', 'GS3', 'GS3 Mains PYQ + Answer Writing', 35),
('moulika', 'GS3', 'Revision + Error Log', 20);
