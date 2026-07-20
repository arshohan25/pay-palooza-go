
DROP POLICY IF EXISTS "Admin can remove participants" ON public.chat_participants;

CREATE POLICY "Admin or self can remove participants"
ON public.chat_participants
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_participants.conversation_id
      AND c.admin_id = auth.uid()
  )
);
