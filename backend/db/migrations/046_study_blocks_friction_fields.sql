-- backend/db/migrations/046_study_blocks_friction_fields.sql
-- Add tracking columns to study_blocks for Telegram friction alerts and state synchronization.

ALTER TABLE study_blocks 
ADD COLUMN IF NOT EXISTS friction_state text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS friction_alert_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS friction_alert_sent_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_action_pending boolean DEFAULT false;
