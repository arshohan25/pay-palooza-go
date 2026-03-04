
-- Chat conversation type enum
CREATE TYPE public.chat_type AS ENUM ('direct', 'group');

-- Chat message type enum
CREATE TYPE public.chat_message_type AS ENUM ('text', 'money', 'voice', 'image', 'order');

-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type chat_type NOT NULL DEFAULT 'direct',
  name text,
  group_icon text,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat participants table
CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  is_encrypted boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  message_type chat_message_type NOT NULL DEFAULT 'text',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is participant
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- RLS for chat_conversations
CREATE POLICY "Participants can view conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), id));

CREATE POLICY "Authenticated users can create conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update group conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), id));

-- RLS for chat_participants
CREATE POLICY "Participants can view participants"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Authenticated users can add participants"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own participant record"
  ON public.chat_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can remove participants"
  ON public.chat_participants FOR DELETE
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), conversation_id));

-- RLS for chat_messages
CREATE POLICY "Participants can view messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_chat_participant(auth.uid(), conversation_id)
  );

CREATE POLICY "Senders can update own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- Indexes for performance
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conv ON public.chat_participants(conversation_id);
CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);

-- Update timestamp trigger
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
