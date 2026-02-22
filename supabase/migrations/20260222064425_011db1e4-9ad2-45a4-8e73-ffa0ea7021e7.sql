
-- Add read receipt tracking to messages
ALTER TABLE public.support_messages
  ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;

-- Add last_read_at per conversation for quick badge counts
ALTER TABLE public.support_conversations
  ADD COLUMN admin_last_read_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN user_last_read_at TIMESTAMPTZ DEFAULT NULL;

-- Allow admins to update messages (for read receipts)
CREATE POLICY "Admins can update messages"
  ON public.support_messages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for conversations too (for typing indicators via presence)
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
