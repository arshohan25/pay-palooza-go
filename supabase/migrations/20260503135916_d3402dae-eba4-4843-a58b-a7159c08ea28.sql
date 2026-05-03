-- =========================================================================
-- 1. MERCHANTS TABLE: remove public broad-read policy, add safe RPC for name
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view active merchants" ON public.merchants;

-- Helper RPC: look up a single active merchant's display name (no PII).
-- Used by checkout / dynamic QR pay sheets where the payer needs to see who
-- they are paying. Authenticated callers only.
CREATE OR REPLACE FUNCTION public.get_merchant_display_name(p_merchant_id uuid)
RETURNS TABLE (id uuid, business_name text, category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.business_name, m.category
  FROM public.merchants m
  WHERE m.id = p_merchant_id
    AND m.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_merchant_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_display_name(uuid) TO authenticated;

-- =========================================================================
-- 2. CHAT ATTACHMENTS STORAGE: make private + scope read/write by ownership
-- =========================================================================
UPDATE storage.buckets SET public = false WHERE id = 'chat_attachments';

DROP POLICY IF EXISTS "Public can read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;

-- INSERT: authenticated user, into their own user-id-prefixed folder.
CREATE POLICY "Users can upload chat attachments to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat_attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: uploader OR participant of the conversation referenced by 2nd
-- folder segment OR admin. Path convention: <user_id>/<conversation_id>/<file>
CREATE POLICY "Participants and admins can read chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat_attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      (storage.foldername(name))[2] IS NOT NULL
      AND public.is_chat_participant(
        auth.uid(),
        ((storage.foldername(name))[2])::uuid
      )
    )
  )
);

-- DELETE: uploader or admin.
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat_attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =========================================================================
-- 3. REALTIME.MESSAGES: require auth for broadcast/presence subscriptions
-- =========================================================================
-- Note: this table backs Realtime broadcast + presence channels. Postgres
-- changes still go through table-level RLS independently. We require the
-- caller to be authenticated to send/receive any broadcast/presence event,
-- closing anonymous-subscriber eavesdropping.
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can use realtime channels" ON realtime.messages';
  EXECUTE $p$
    CREATE POLICY "Authenticated can use realtime channels"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (true)
  $p$;
  EXECUTE $p$
    CREATE POLICY "Authenticated can publish realtime messages"
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (true)
  $p$;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping realtime.messages policy creation (insufficient privilege)';
END $$;