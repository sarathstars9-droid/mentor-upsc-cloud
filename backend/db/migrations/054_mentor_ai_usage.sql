-- backend/db/migrations/054_mentor_ai_usage.sql
-- Migration 054: Mentor AI Usage tracking for Gemini Live + DeepSeek Flash

CREATE TABLE IF NOT EXISTS public.mentor_ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    mentor_session_id UUID,
    provider TEXT NOT NULL, -- 'gemini', 'deepseek', 'sarvam', 'openai'
    model TEXT NOT NULL,
    usage_type TEXT NOT NULL, -- 'voice_live', 'mentor_turn', 'tts', 'stt'
    input_audio_tokens INT DEFAULT 0,
    output_audio_tokens INT DEFAULT 0,
    input_text_tokens INT DEFAULT 0,
    output_text_tokens INT DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 6) DEFAULT 0,
    usd_inr_rate NUMERIC(10, 2) DEFAULT 96.00,
    estimated_cost_inr NUMERIC(12, 4) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_ai_usage_user_date ON public.mentor_ai_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mentor_ai_usage_session ON public.mentor_ai_usage (mentor_session_id);
