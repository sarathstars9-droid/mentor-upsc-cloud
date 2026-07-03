-- 1. Ensure device_id column exists
ALTER TABLE public.guardian_daily_phone_usage 
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255) DEFAULT 'default_device';

-- 2. Backfill device_id for any existing rows that might have been null
UPDATE public.guardian_daily_phone_usage
SET device_id = 'default_device'
WHERE device_id IS NULL;

ALTER TABLE public.guardian_daily_phone_usage
ALTER COLUMN device_id SET NOT NULL;

-- 3. Deduplicate existing rows by keeping the one with max duration_seconds or latest updated_at
WITH duplicates AS (
  SELECT 
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, device_id, date, app_package 
      ORDER BY duration_seconds DESC, updated_at DESC
    ) as rn
  FROM public.guardian_daily_phone_usage
)
DELETE FROM public.guardian_daily_phone_usage
WHERE ctid IN (
  SELECT ctid FROM duplicates WHERE rn > 1
);

-- 4. Drop old constraints/indexes safely
DROP INDEX IF EXISTS uniq_guardian_daily_phone_usage;
DROP INDEX IF EXISTS uniq_guardian_daily_phone_usage_v2;
ALTER TABLE public.guardian_daily_phone_usage DROP CONSTRAINT IF EXISTS uniq_guardian_daily_phone_usage;
ALTER TABLE public.guardian_daily_phone_usage DROP CONSTRAINT IF EXISTS uniq_guardian_daily_phone_usage_v2;

-- 5. Create the new unique index with device_id included
CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_daily_phone_usage_v2
ON public.guardian_daily_phone_usage (user_id, device_id, date, app_package);
