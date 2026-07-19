-- 1. Deduplicate: keep only the highest-privilege role per user
WITH ranked AS (
  SELECT
    ctid,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role::text
        WHEN 'admin' THEN 1
        WHEN 'compliance' THEN 2
        WHEN 'finance' THEN 3
        WHEN 'risk' THEN 4
        WHEN 'audit' THEN 5
        WHEN 'operations' THEN 6
        WHEN 'manager' THEN 7
        WHEN 'developer' THEN 8
        WHEN 'support' THEN 9
        WHEN 'marketing' THEN 10
        WHEN 'hr' THEN 11
        WHEN 'super_distributor' THEN 12
        WHEN 'distributor' THEN 13
        WHEN 'merchant' THEN 14
        WHEN 'agent' THEN 15
        WHEN 'customer' THEN 16
        ELSE 99
      END
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.ctid = r.ctid AND r.rn > 1;

-- 2. Add uniqueness on user_id (one role per user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3. Helper RPC: atomically replace a user's role
CREATE OR REPLACE FUNCTION public.assign_single_role(_user_id UUID, _role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'role_assigned_single', 'user_role', _user_id, jsonb_build_object('role', _role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_single_role(UUID, public.app_role) TO authenticated;

-- 4. role_limit_overrides: admin-configurable per-role rules
CREATE TABLE IF NOT EXISTS public.role_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL UNIQUE,
  badge_label TEXT,
  badge_color TEXT,
  daily_txn_limit NUMERIC,
  monthly_txn_limit NUMERIC,
  per_txn_limit NUMERIC,
  daily_cashin_limit NUMERIC,
  daily_cashout_limit NUMERIC,
  extra_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_limit_overrides TO authenticated;
GRANT ALL ON public.role_limit_overrides TO service_role;

ALTER TABLE public.role_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role limit overrides"
  ON public.role_limit_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read active role overrides"
  ON public.role_limit_overrides
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.tg_role_limit_overrides_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_limit_overrides_touch ON public.role_limit_overrides;
CREATE TRIGGER trg_role_limit_overrides_touch
  BEFORE UPDATE ON public.role_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_role_limit_overrides_touch();