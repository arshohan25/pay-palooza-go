
-- Users can read complaints for their own conversations
CREATE POLICY "Users can read own complaints"
ON public.support_complaints
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = support_complaints.conversation_id
    AND sc.user_id = auth.uid()
  )
);
