-- Add device_id to guardian_daily_phone_usage

ALTER TABLE public.guardian_daily_phone_usage 
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255) DEFAULT 'default_device';

-- Drop the old unique constraint if it exists
DROP INDEX IF EXISTS uniq_guardian_daily_phone_usage;

-- Create the new unique constraint including device_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_daily_phone_usage_v2
ON public.guardian_daily_phone_usage (user_id, device_id, date, app_package);
