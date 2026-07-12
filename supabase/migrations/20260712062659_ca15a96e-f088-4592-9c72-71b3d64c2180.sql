
-- 1) Route-aware wallet ID validator: reject when the RR code isn't in wallet_route_codes.
CREATE OR REPLACE FUNCTION public.validate_wallet_id_format(
  _wallet_id text,
  _expected_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id    text;
  v_role  text;
  v_route text;
  v_known boolean;
BEGIN
  IF _wallet_id IS NULL OR btrim(_wallet_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  v_id := upper(btrim(_wallet_id));

  IF v_id ~ '^EZP-AGN[A-Z]{2}-[A-Z]{4}$' THEN
    v_role  := 'agent';
    v_route := substring(v_id from 8 for 2);
  ELSIF v_id ~ '^EZP-MRC[A-Z]{2}-[A-Z]{4}$' THEN
    v_role  := 'merchant';
    v_route := substring(v_id from 8 for 2);
  ELSIF v_id ~ '^EZP-[A-Z]{4}-[A-Z]{4}$'
        AND substring(v_id from 5 for 3) NOT IN ('AGN','MRC') THEN
    v_role  := 'user';
    v_route := NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_format', 'normalized', v_id);
  END IF;

  -- Route codes only apply to agent + merchant wallets. Personal user wallets
  -- have no route segment, so we skip the lookup for them.
  IF v_route IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.wallet_route_codes
      WHERE code = v_route AND is_active = true
    ) INTO v_known;

    IF NOT v_known THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'unknown_route',
        'role', v_role,
        'route', v_route,
        'normalized', v_id
      );
    END IF;
  END IF;

  IF _expected_role IS NOT NULL AND lower(_expected_role) <> v_role THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'role_mismatch',
      'role', v_role,
      'route', v_route,
      'normalized', v_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'route', v_route,
    'normalized', v_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_wallet_id_format(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_wallet_id_format(text, text) TO authenticated, service_role;

-- 2) Store the picked district route on merchant applications so merchant
--    wallet IDs (EZP-MRC{RR}-XXXX) can be generated from the same source.
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS route_code text
    REFERENCES public.wallet_route_codes(code) ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS merchant_applications_route_code_idx
  ON public.merchant_applications (route_code);

-- 3) Expand the migration-time / on-demand test to cover all 64 district codes
--    plus a few unknown codes, and to prove unknown routes are rejected.
CREATE OR REPLACE FUNCTION public.test_validate_wallet_id_format()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  r          jsonb;
  route      text;
  all_routes text[];
  bad_routes text[] := ARRAY['ZZ','QQ','XY']; -- not seeded in wallet_route_codes
  agent_id   text;
  merch_id   text;
  user_id_ok text := 'EZP-ABCD-EFGH';
BEGIN
  SELECT array_agg(code ORDER BY code) INTO all_routes
    FROM public.wallet_route_codes WHERE is_active = true;
  ASSERT array_length(all_routes, 1) = 64,
    format('expected 64 active route codes, got %s', array_length(all_routes, 1));

  -- Personal wallet stays untouched by route rules.
  r := public.validate_wallet_id_format(user_id_ok);
  ASSERT (r->>'ok')::boolean IS TRUE, 'user ok';
  ASSERT r->>'role' = 'user',         'user role';
  ASSERT r->>'route' IS NULL,         'user route null';

  -- Every seeded district must validate for both agent + merchant wallets.
  FOREACH route IN ARRAY all_routes LOOP
    agent_id := 'EZP-AGN' || route || '-ABCD';
    merch_id := 'EZP-MRC' || route || '-WXYZ';

    r := public.validate_wallet_id_format(agent_id, 'agent');
    ASSERT (r->>'ok')::boolean IS TRUE, format('agent ok (%s): %s', route, r::text);
    ASSERT r->>'route' = route,         format('agent route (%s)', route);

    r := public.validate_wallet_id_format(merch_id, 'merchant');
    ASSERT (r->>'ok')::boolean IS TRUE, format('merchant ok (%s): %s', route, r::text);
    ASSERT r->>'route' = route,         format('merchant route (%s)', route);
  END LOOP;

  -- Unknown route codes must be rejected with reason=unknown_route,
  -- regardless of role assertion.
  FOREACH route IN ARRAY bad_routes LOOP
    ASSERT NOT EXISTS (
      SELECT 1 FROM public.wallet_route_codes WHERE code = route
    ), format('test bad route %s must not be seeded', route);

    r := public.validate_wallet_id_format('EZP-AGN' || route || '-ABCD');
    ASSERT (r->>'ok')::boolean IS FALSE,       format('agent unknown %s must fail', route);
    ASSERT r->>'reason' = 'unknown_route',     format('agent unknown reason %s', route);
    ASSERT r->>'role'   = 'agent',             format('agent unknown role %s', route);
    ASSERT r->>'route'  = route,               format('agent unknown route %s', route);

    r := public.validate_wallet_id_format('EZP-MRC' || route || '-WXYZ', 'merchant');
    ASSERT (r->>'ok')::boolean IS FALSE,       format('merchant unknown %s', route);
    ASSERT r->>'reason' = 'unknown_route',     format('merchant unknown reason %s', route);
  END LOOP;

  -- Role mismatch still wins for well-known codes.
  r := public.validate_wallet_id_format('EZP-AGNDH-ABCD', 'user');
  ASSERT (r->>'ok')::boolean IS FALSE, 'agent->user must fail';
  ASSERT r->>'reason' = 'role_mismatch', 'agent->user reason';

  -- Personal wallet role mismatch when asked to be agent.
  r := public.validate_wallet_id_format(user_id_ok, 'agent');
  ASSERT (r->>'ok')::boolean IS FALSE, 'user->agent must fail';
  ASSERT r->>'reason' = 'role_mismatch', 'user->agent reason';

  RETURN format('ok: %s routes verified, %s unknown routes rejected',
                array_length(all_routes, 1), array_length(bad_routes, 1));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.test_validate_wallet_id_format() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.test_validate_wallet_id_format() TO service_role;

-- Run once so a broken change fails the migration itself.
DO $$
DECLARE res text;
BEGIN
  res := public.test_validate_wallet_id_format();
  RAISE NOTICE 'test_validate_wallet_id_format: %', res;
END;
$$;
