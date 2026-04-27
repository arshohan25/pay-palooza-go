-- Audit log for platform_thresholds (admin-only visibility)
CREATE TABLE IF NOT EXISTS public.platform_thresholds_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  actor_id uuid,
  before_value jsonb,
  after_value jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_thresholds_audit_key_changed_at
  ON public.platform_thresholds_audit (threshold_key, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_thresholds_audit_changed_at
  ON public.platform_thresholds_audit (changed_at DESC);

ALTER TABLE public.platform_thresholds_audit ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT. No INSERT/UPDATE/DELETE policies => writes can only
-- happen via the SECURITY DEFINER trigger below; user-initiated mutations
-- are blocked by RLS.
DROP POLICY IF EXISTS "Admins can read platform_thresholds_audit"
  ON public.platform_thresholds_audit;
CREATE POLICY "Admins can read platform_thresholds_audit"
  ON public.platform_thresholds_audit
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function: captures before/after on every change.
CREATE OR REPLACE FUNCTION public.log_platform_threshold_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_key text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_key := NEW.key;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip noise: don't log when nothing meaningful changed.
    IF NEW.value IS NOT DISTINCT FROM OLD.value
       AND NEW.label IS NOT DISTINCT FROM OLD.label
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.unit IS NOT DISTINCT FROM OLD.unit
       AND NEW.min_value IS NOT DISTINCT FROM OLD.min_value
       AND NEW.max_value IS NOT DISTINCT FROM OLD.max_value
    THEN
      RETURN NEW;
    END IF;
    v_action := 'update';
    v_key := NEW.key;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_key := OLD.key;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  INSERT INTO public.platform_thresholds_audit
    (threshold_key, action, actor_id, before_value, after_value)
  VALUES
    (v_key, v_action, auth.uid(), v_before, v_after);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_thresholds_audit ON public.platform_thresholds;
CREATE TRIGGER trg_platform_thresholds_audit
AFTER INSERT OR UPDATE OR DELETE ON public.platform_thresholds
FOR EACH ROW
EXECUTE FUNCTION public.log_platform_threshold_change();