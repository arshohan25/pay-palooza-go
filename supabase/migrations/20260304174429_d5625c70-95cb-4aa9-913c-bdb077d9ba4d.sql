-- Add status column to chat_conversations for pending/accepted flow
ALTER TABLE public.chat_conversations 
ADD COLUMN status text NOT NULL DEFAULT 'accepted';

-- Add comment for clarity
COMMENT ON COLUMN public.chat_conversations.status IS 'pending = awaiting recipient acceptance, accepted = normal conversation';