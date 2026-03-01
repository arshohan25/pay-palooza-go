
-- Add encryption and disappearing message support to support_messages
ALTER TABLE public.support_messages 
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false;

-- Allow users to soft-delete (update is_deleted) their own messages
CREATE POLICY "Users can update own messages"
ON public.support_messages FOR UPDATE
USING (auth.uid() = sender_id);

-- Allow users to also mark read_at on messages sent to them
-- (existing admin update policy already covers admin side)
