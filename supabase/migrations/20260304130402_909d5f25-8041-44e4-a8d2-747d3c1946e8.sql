
-- Tighten INSERT policies: only allow if user is adding themselves as participant
DROP POLICY "Authenticated users can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Authenticated users can add participants" ON public.chat_participants;
CREATE POLICY "Users can add themselves or as conversation participant"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_chat_participant(auth.uid(), conversation_id)
  );
