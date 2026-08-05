ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_messages_session_request ON public.mentor_messages (session_id, request_id) WHERE request_id IS NOT NULL;
