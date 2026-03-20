
-- Create fraud_auto_rules table
CREATE TABLE public.fraud_auto_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  metric text NOT NULL,
  threshold numeric NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'lock_account',
  lock_duration text NOT NULL DEFAULT 'permanent',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud auto rules"
  ON public.fraud_auto_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_fraud_auto_rules_updated_at
  BEFORE UPDATE ON public.fraud_auto_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create fraud_auto_rule_logs table
CREATE TABLE public.fraud_auto_rule_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid NOT NULL REFERENCES public.fraud_auto_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  action_taken text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_auto_rule_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read fraud auto rule logs"
  ON public.fraud_auto_rule_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Alter fraud_alerts: add escalation / SLA columns
ALTER TABLE public.fraud_alerts
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to_team_member uuid REFERENCES public.team_members(id);

-- Auto-set SLA deadline on new fraud alerts via trigger
CREATE OR REPLACE FUNCTION public.set_fraud_alert_sla()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := CASE NEW.severity
      WHEN 'critical' THEN NEW.created_at + interval '1 hour'
      WHEN 'high'     THEN NEW.created_at + interval '4 hours'
      WHEN 'medium'   THEN NEW.created_at + interval '24 hours'
      ELSE                  NEW.created_at + interval '72 hours'
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_fraud_alert_sla
  BEFORE INSERT ON public.fraud_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_fraud_alert_sla();
