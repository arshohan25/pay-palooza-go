
DROP POLICY IF EXISTS "Authenticated can publish realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can use realtime channels" ON realtime.messages;
DROP POLICY IF EXISTS "scoped_realtime_subscribe" ON realtime.messages;
DROP POLICY IF EXISTS "scoped_realtime_publish" ON realtime.messages;

CREATE POLICY "scoped_realtime_subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR realtime.topic() = 'online-users'
  OR realtime.topic() = 'chat-realtime-combined'
  OR realtime.topic() LIKE 'typing:%'
  OR realtime.topic() LIKE 'qr-session-%'
  OR realtime.topic() LIKE 'fund-request-%'
  OR realtime.topic() LIKE 'ai-rewards-%'
  OR realtime.topic() IN (
    'fee-config-realtime','recharge-packs-user','shop-page-products-rt',
    'referral-updates','payment_links_realtime','fund-requests-realtime',
    'saved-banks-realtime','balance-realtime','global-toggles-user',
    'user-feature-overrides'
  )
  OR (
    (realtime.topic() LIKE 'admin-%'
      OR realtime.topic() LIKE 'sd-%'
      OR realtime.topic() LIKE 'dist-%'
      OR realtime.topic() LIKE 'merchant-realtime%')
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'risk'::public.app_role)
      OR public.has_role(auth.uid(), 'compliance'::public.app_role)
      OR public.has_role(auth.uid(), 'operations'::public.app_role)
      OR public.has_role(auth.uid(), 'support'::public.app_role)
      OR public.has_role(auth.uid(), 'super_distributor'::public.app_role)
      OR public.has_role(auth.uid(), 'distributor'::public.app_role)
      OR public.has_role(auth.uid(), 'merchant'::public.app_role)
    )
  )
);

CREATE POLICY "scoped_realtime_publish"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'typing:%'
  OR realtime.topic() LIKE 'qr-session-%'
  OR realtime.topic() = 'online-users'
);
