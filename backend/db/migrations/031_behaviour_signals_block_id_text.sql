-- 031_behaviour_signals_block_id_text.sql
ALTER TABLE public.behaviour_signals
ALTER COLUMN block_id TYPE TEXT USING block_id::text;
