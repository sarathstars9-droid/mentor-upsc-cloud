-- Migration 062: Daily plan images persistence
CREATE TABLE IF NOT EXISTS public.daily_plan_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  day_key VARCHAR(10) NOT NULL,
  image_data TEXT NOT NULL,
  mime_type VARCHAR(64) DEFAULT 'image/jpeg',
  raw_ocr_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_daily_plan_image_user_day UNIQUE (user_id, day_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_plan_images_user_day ON public.daily_plan_images (user_id, day_key);
