-- Tighten chat_conversations insert policy to remove always-true check
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);