-- backend/db/migrations/037_guardian_phase3.sql

CREATE TABLE IF NOT EXISTS public.guardian_daily_phone_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  app_package TEXT NOT NULL,
  app_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_daily_phone_usage
ON public.guardian_daily_phone_usage (user_id, date, app_package);

CREATE TABLE IF NOT EXISTS public.guardian_alert_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  alert_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_alert_ledger
ON public.guardian_alert_ledger (user_id, date, alert_type);
