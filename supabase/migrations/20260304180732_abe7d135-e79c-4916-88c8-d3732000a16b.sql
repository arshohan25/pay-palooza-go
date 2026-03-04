-- Force recreate the INSERT policy to ensure it's permissive and takes effect
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);