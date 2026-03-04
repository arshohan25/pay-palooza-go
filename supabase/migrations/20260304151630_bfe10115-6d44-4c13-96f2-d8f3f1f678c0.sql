-- Drop the old UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile metadata" ON public.profiles;

-- Create a hardened UPDATE policy that prevents changing sensitive fields via WITH CHECK
-- Users can only update name, avatar_url, and email. Balance, phone, user_id, status
-- are enforced to remain unchanged at the RLS layer (defense-in-depth with the trigger).
CREATE POLICY "Users can update own profile metadata"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND balance = (SELECT p.balance FROM public.profiles p WHERE p.user_id = auth.uid())
  AND phone = (SELECT p.phone FROM public.profiles p WHERE p.user_id = auth.uid())
  AND status = (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
);