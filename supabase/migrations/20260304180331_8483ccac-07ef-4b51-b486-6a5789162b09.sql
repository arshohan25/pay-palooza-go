-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);