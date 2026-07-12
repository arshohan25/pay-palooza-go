-- Database-level unit tests for public.validate_wallet_id_format
-- Uses PL/pgSQL ASSERT so any regression fails the migration and can be re-run
-- ad-hoc by service_role via: SELECT public.test_validate_wallet_id_format();

CREATE OR REPLACE FUNCTION public.test_validate_wallet_id_format()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  r          jsonb;
  route      text;
  routes     text[] := ARRAY['DH','KH','NR','CT','SY'];
  agent_id   text;
  merch_id   text;
  user_id_ok text := 'EZP-ABCD-EFGH';
  bad_ids    text[] := ARRAY[
    '',                 -- empty
    '   ',              -- whitespace
    'EZP-1234-ABCD',    -- digits
    'EZP-ABC-EFGH',     -- 3-char middle
    'EZP-ABCDEF-EFGH',  -- 6-char middle
    'EZP-ABCD-EFG',     -- 3-char suffix
    'EZ-ABCD-EFGH',     -- wrong prefix
    'EZP_ABCD_EFGH',    -- wrong separators
    'EZP-AGN-DHAB',     -- 4 segments, not our shape
    'EZP-AGND-ABCD',    -- 4-char AGN* middle collides with user shape but starts with AGN
    'EZP-MRCD-ABCD'     -- same for MRC
  ];
  bid text;
BEGIN
  ----------------------------------------------------------------------------
  -- OK: personal user, no expected role
  ----------------------------------------------------------------------------
  r := public.validate_wallet_id_format(user_id_ok);
  ASSERT (r->>'ok')::boolean IS TRUE,             'user ok flag';
  ASSERT r->>'role'  = 'user',                    'user role';
  ASSERT r->>'route' IS NULL,                     'user route null';
  ASSERT r->>'normalized' = user_id_ok,           'user normalized';

  -- normalization: lowercase + surrounding whitespace
  r := public.validate_wallet_id_format('  ezp-abcd-efgh  ');
  ASSERT (r->>'ok')::boolean IS TRUE,             'user normalization ok';
  ASSERT r->>'normalized' = 'EZP-ABCD-EFGH',      'user normalized upper/trim';

  ----------------------------------------------------------------------------
  -- OK: agent + merchant across every route code, with matching expected role
  ----------------------------------------------------------------------------
  FOREACH route IN ARRAY routes LOOP
    agent_id := 'EZP-AGN' || route || '-ABCD';
    merch_id := 'EZP-MRC' || route || '-WXYZ';

    r := public.validate_wallet_id_format(agent_id, 'agent');
    ASSERT (r->>'ok')::boolean IS TRUE,           format('agent ok (%s)', route);
    ASSERT r->>'role'  = 'agent',                 format('agent role (%s)', route);
    ASSERT r->>'route' = route,                   format('agent route (%s)', route);

    r := public.validate_wallet_id_format(merch_id, 'merchant');
    ASSERT (r->>'ok')::boolean IS TRUE,           format('merchant ok (%s)', route);
    ASSERT r->>'role'  = 'merchant',              format('merchant role (%s)', route);
    ASSERT r->>'route' = route,                   format('merchant route (%s)', route);

    -- format-only (no expected role) still succeeds
    r := public.validate_wallet_id_format(agent_id);
    ASSERT (r->>'ok')::boolean IS TRUE,           format('agent format-only (%s)', route);
    r := public.validate_wallet_id_format(merch_id);
    ASSERT (r->>'ok')::boolean IS TRUE,           format('merchant format-only (%s)', route);
  END LOOP;

  ----------------------------------------------------------------------------
  -- role_mismatch: every cross-role pairing across a few routes
  ----------------------------------------------------------------------------
  FOREACH route IN ARRAY ARRAY['DH','KH','NR'] LOOP
    agent_id := 'EZP-AGN' || route || '-ABCD';
    merch_id := 'EZP-MRC' || route || '-WXYZ';

    -- agent ID asked to be user / merchant
    r := public.validate_wallet_id_format(agent_id, 'user');
    ASSERT (r->>'ok')::boolean IS FALSE,          format('agent!=user ok=false (%s)', route);
    ASSERT r->>'reason' = 'role_mismatch',        format('agent!=user reason (%s)', route);
    ASSERT r->>'role'   = 'agent',                format('agent!=user role (%s)', route);
    ASSERT r->>'route'  = route,                  format('agent!=user route (%s)', route);

    r := public.validate_wallet_id_format(agent_id, 'merchant');
    ASSERT (r->>'ok')::boolean IS FALSE,          format('agent!=merchant (%s)', route);
    ASSERT r->>'reason' = 'role_mismatch',        format('agent!=merchant reason (%s)', route);

    -- merchant ID asked to be user / agent
    r := public.validate_wallet_id_format(merch_id, 'user');
    ASSERT (r->>'ok')::boolean IS FALSE,          format('merch!=user (%s)', route);
    ASSERT r->>'reason' = 'role_mismatch',        format('merch!=user reason (%s)', route);
    ASSERT r->>'role'   = 'merchant',             format('merch!=user role (%s)', route);

    r := public.validate_wallet_id_format(merch_id, 'agent');
    ASSERT (r->>'ok')::boolean IS FALSE,          format('merch!=agent (%s)', route);
    ASSERT r->>'reason' = 'role_mismatch',        format('merch!=agent reason (%s)', route);

    -- personal user ID asked to be agent / merchant
    r := public.validate_wallet_id_format(user_id_ok, 'agent');
    ASSERT (r->>'ok')::boolean IS FALSE,          'user!=agent';
    ASSERT r->>'reason' = 'role_mismatch',        'user!=agent reason';
    ASSERT r->>'role'   = 'user',                 'user!=agent role';

    r := public.validate_wallet_id_format(user_id_ok, 'merchant');
    ASSERT (r->>'ok')::boolean IS FALSE,          'user!=merchant';
    ASSERT r->>'reason' = 'role_mismatch',        'user!=merchant reason';
  END LOOP;

  -- expected_role is case-insensitive
  r := public.validate_wallet_id_format('EZP-AGNDH-ABCD', 'AGENT');
  ASSERT (r->>'ok')::boolean IS TRUE,             'expected_role case-insensitive';

  ----------------------------------------------------------------------------
  -- bad_format / empty rejections
  ----------------------------------------------------------------------------
  FOREACH bid IN ARRAY bad_ids LOOP
    r := public.validate_wallet_id_format(bid);
    ASSERT (r->>'ok')::boolean IS FALSE,          format('bad rejected: %s', bid);
    ASSERT r->>'reason' IN ('empty','bad_format'),
                                                  format('bad reason for: %s (got %s)', bid, r->>'reason');
  END LOOP;

  -- NULL input → empty
  r := public.validate_wallet_id_format(NULL);
  ASSERT (r->>'ok')::boolean IS FALSE,            'null ok=false';
  ASSERT r->>'reason' = 'empty',                  'null reason=empty';

  -- bad format wins over role mismatch (reason must stay bad_format)
  r := public.validate_wallet_id_format('EZP-1234-ABCD', 'agent');
  ASSERT (r->>'ok')::boolean IS FALSE,            'bad+role ok=false';
  ASSERT r->>'reason' = 'bad_format',             'bad+role reason=bad_format';

  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.test_validate_wallet_id_format() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.test_validate_wallet_id_format() TO service_role;

-- Run the suite at migration time; a failed ASSERT aborts the migration.
DO $$
BEGIN
  PERFORM public.test_validate_wallet_id_format();
END;
$$;
