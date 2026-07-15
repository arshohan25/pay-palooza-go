
-- 1) Restrict group conversation UPDATE to the designated admin only
DROP POLICY IF EXISTS "Admin can update group conversations" ON public.chat_conversations;
CREATE POLICY "Admin can update group conversations"
ON public.chat_conversations
FOR UPDATE
USING (
  (type = 'group' AND admin_id = auth.uid())
  OR (type <> 'group' AND is_chat_participant(auth.uid(), id))
)
WITH CHECK (
  (type = 'group' AND admin_id = auth.uid())
  OR (type <> 'group' AND is_chat_participant(auth.uid(), id))
);

-- 2) Remove unscoped 'referral-updates' topic from realtime subscribe policy.
-- Clients now use per-user topic 'referral-updates-<uid>' which already
-- matches the '%'||auth.uid()||'%' pattern in the existing policy.
DROP POLICY IF EXISTS "scoped_realtime_subscribe" ON realtime.messages;
CREATE POLICY "scoped_realtime_subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE ('%' || auth.uid()::text || '%'))
  OR (realtime.topic() = 'online-users')
  OR (realtime.topic() LIKE 'typing:%')
  OR (realtime.topic() LIKE 'qr-session-%')
  OR (realtime.topic() = ANY (ARRAY[
        'fee-config-realtime',
        'recharge-packs-user',
        'shop-page-products-rt',
        'payment_links_realtime'
      ]))
  OR (
    (realtime.topic() LIKE 'admin-%'
      OR realtime.topic() LIKE 'sd-%'
      OR realtime.topic() LIKE 'dist-%'
      OR realtime.topic() LIKE 'merchant-realtime%')
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'risk'::app_role)
      OR has_role(auth.uid(), 'compliance'::app_role)
      OR has_role(auth.uid(), 'operations'::app_role)
      OR has_role(auth.uid(), 'support'::app_role)
      OR has_role(auth.uid(), 'super_distributor'::app_role)
      OR has_role(auth.uid(), 'distributor'::app_role)
      OR has_role(auth.uid(), 'merchant'::app_role)
    )
  )
);
