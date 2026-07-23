
-- 1) Tighten chat_conversations INSERT: creator must own the row for groups
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (type = 'group'::chat_type AND admin_id = auth.uid())
    OR (type <> 'group'::chat_type AND (admin_id IS NULL OR admin_id = auth.uid()))
  )
);

-- 2) Consolidate duplicate product_variants policies
DROP POLICY IF EXISTS "Admins manage all variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view active variants" ON public.product_variants;
DROP POLICY IF EXISTS "Vendors manage own variants" ON public.product_variants;
