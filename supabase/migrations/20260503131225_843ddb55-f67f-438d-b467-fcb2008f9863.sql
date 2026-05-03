
-- Helper: is the current user the owner of this merchant?
CREATE OR REPLACE FUNCTION public.is_merchant_owner(_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants
    WHERE id = _merchant_id AND user_id = auth.uid()
  );
$$;

-- Helper: is the current user this staff row's linked user?
CREATE OR REPLACE FUNCTION public.is_merchant_staff_user(_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_staff
    WHERE id = _staff_id AND user_id = auth.uid()
  );
$$;

-- Requests table
CREATE TABLE public.merchant_staff_permission_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.merchant_staff(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  permission_key text NOT NULL CHECK (permission_key IN ('payouts','store_settings','settlements')),
  display_label text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','denied','cancelled','revoked')),
  decided_by uuid,
  decided_at timestamptz,
  deny_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX merchant_staff_perm_req_pending_uniq
  ON public.merchant_staff_permission_requests (merchant_id, staff_id, permission_key)
  WHERE status = 'pending';

CREATE INDEX merchant_staff_perm_req_merchant_idx
  ON public.merchant_staff_permission_requests (merchant_id, status, created_at DESC);

ALTER TABLE public.merchant_staff_permission_requests ENABLE ROW LEVEL SECURITY;

-- Staff can read their own requests
CREATE POLICY "Staff can view own requests"
ON public.merchant_staff_permission_requests
FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR public.is_merchant_staff_user(staff_id));

-- Owner can read all requests for their merchant
CREATE POLICY "Owner can view merchant requests"
ON public.merchant_staff_permission_requests
FOR SELECT TO authenticated
USING (public.is_merchant_owner(merchant_id));

-- Staff can insert their own requests (pending only)
CREATE POLICY "Staff can create own requests"
ON public.merchant_staff_permission_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND public.is_merchant_staff_user(staff_id)
  AND status = 'pending'
);

-- Owner can update status fields
CREATE POLICY "Owner can decide requests"
ON public.merchant_staff_permission_requests
FOR UPDATE TO authenticated
USING (public.is_merchant_owner(merchant_id))
WITH CHECK (public.is_merchant_owner(merchant_id));

-- Staff can cancel their own pending requests
CREATE POLICY "Staff can cancel own pending"
ON public.merchant_staff_permission_requests
FOR UPDATE TO authenticated
USING (requested_by = auth.uid() AND status = 'pending')
WITH CHECK (requested_by = auth.uid() AND status IN ('pending','cancelled'));

-- Trigger: when status flips to 'granted', enable the matching permission on merchant_staff
CREATE OR REPLACE FUNCTION public.apply_granted_staff_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'granted' AND (OLD.status IS DISTINCT FROM 'granted') THEN
    UPDATE public.merchant_staff
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(NEW.permission_key, true),
        updated_at = now()
    WHERE id = NEW.staff_id AND merchant_id = NEW.merchant_id;
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    NEW.decided_by := COALESCE(NEW.decided_by, auth.uid());
  ELSIF NEW.status = 'revoked' AND (OLD.status IS DISTINCT FROM 'revoked') THEN
    UPDATE public.merchant_staff
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(NEW.permission_key, false),
        updated_at = now()
    WHERE id = NEW.staff_id AND merchant_id = NEW.merchant_id;
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    NEW.decided_by := COALESCE(NEW.decided_by, auth.uid());
  ELSIF NEW.status = 'denied' AND (OLD.status IS DISTINCT FROM 'denied') THEN
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    NEW.decided_by := COALESCE(NEW.decided_by, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_granted_staff_permission
BEFORE UPDATE ON public.merchant_staff_permission_requests
FOR EACH ROW
EXECUTE FUNCTION public.apply_granted_staff_permission();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_staff_permission_requests;
