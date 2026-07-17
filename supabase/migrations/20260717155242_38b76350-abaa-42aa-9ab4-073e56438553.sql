-- Server-side pre-auth token so team login never returns a real session before OTP verification
CREATE TABLE IF NOT EXISTS public.team_pre_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.team_pre_auth_tokens TO service_role;
-- Deliberately no grants to anon/authenticated: only edge functions (service role) touch this table.

ALTER TABLE public.team_pre_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Explicit deny for non-service-role callers (defense in depth; no policy = deny already, but this is explicit).
CREATE POLICY "team_pre_auth_tokens_no_client_access"
ON public.team_pre_auth_tokens
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS team_pre_auth_tokens_expires_idx
  ON public.team_pre_auth_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Harden credential/config tables with an explicit RESTRICTIVE admin-only
-- SELECT policy so that any future permissive SELECT policy cannot accidentally
-- widen access to non-admin roles.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'biller_api_configs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "biller_api_configs_admin_only_select_restrictive" ON public.biller_api_configs';
    EXECUTE $p$
      CREATE POLICY "biller_api_configs_admin_only_select_restrictive"
      ON public.biller_api_configs
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated, anon
      USING (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_gateways') THEN
    EXECUTE 'DROP POLICY IF EXISTS "payment_gateways_admin_only_select_restrictive" ON public.payment_gateways';
    EXECUTE $p$
      CREATE POLICY "payment_gateways_admin_only_select_restrictive"
      ON public.payment_gateways
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated, anon
      USING (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  END IF;
END $$;
