-- 1. Per-user quiet hours
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '22:00',
  quiet_hours_end   time NOT NULL DEFAULT '07:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notif settings"
  ON public.user_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notif settings"
  ON public.user_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notif settings"
  ON public.user_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notif settings"
  ON public.user_notification_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all notif settings"
  ON public.user_notification_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_notif_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Combined gate: category-enabled AND outside quiet hours (Asia/Dhaka)
CREATE OR REPLACE FUNCTION public.should_send_push(p_user_id uuid, p_category text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_quiet  boolean;
  v_start  time;
  v_end    time;
  v_now    time;
BEGIN
  -- Category preference (default true if no row)
  SELECT COALESCE(
    (SELECT push_enabled FROM public.notification_preferences
       WHERE user_id = p_user_id AND category = p_category LIMIT 1),
    true
  ) INTO v_enabled;

  IF NOT v_enabled THEN
    RETURN false;
  END IF;

  -- Quiet hours (default off)
  SELECT quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    INTO v_quiet, v_start, v_end
  FROM public.user_notification_settings
  WHERE user_id = p_user_id;

  IF v_quiet IS NOT TRUE THEN
    RETURN true;
  END IF;

  v_now := (now() AT TIME ZONE 'Asia/Dhaka')::time;

  -- Window may wrap midnight (e.g. 22:00 → 07:00)
  IF v_start <= v_end THEN
    IF v_now >= v_start AND v_now < v_end THEN
      RETURN false;
    END IF;
  ELSE
    IF v_now >= v_start OR v_now < v_end THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;