
-- 1) Notify on tier changes
CREATE OR REPLACE FUNCTION public.notify_loyalty_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_rank int;
  v_to_rank   int;
  v_to_name   text;
  v_from_name text;
  v_direction text;
  v_title     text;
  v_body      text;
BEGIN
  -- Only fire when the *effective* tier changes
  IF NEW.current_tier_id IS NOT DISTINCT FROM OLD.current_tier_id
     AND NEW.override_tier_id IS NOT DISTINCT FROM OLD.override_tier_id THEN
    RETURN NEW;
  END IF;

  SELECT rank, name INTO v_from_rank, v_from_name FROM public.loyalty_tiers
    WHERE id = COALESCE(OLD.override_tier_id, OLD.current_tier_id);
  SELECT rank, name INTO v_to_rank,   v_to_name   FROM public.loyalty_tiers
    WHERE id = COALESCE(NEW.override_tier_id, NEW.current_tier_id);

  IF v_to_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_from_rank IS NULL OR v_to_rank > v_from_rank THEN
    v_direction := 'upgrade';
    v_title := '🎉 EasyPay Club upgrade!';
    v_body  := 'You reached ' || v_to_name || '. Enjoy higher limits, lower fees and more cashback.';
  ELSIF v_to_rank < v_from_rank THEN
    v_direction := 'downgrade';
    v_title := 'EasyPay Club tier changed';
    v_body  := 'Your tier is now ' || v_to_name || '. Keep transacting to climb back up!';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id, v_title, v_body, 'loyalty',
    jsonb_build_object(
      'direction',   v_direction,
      'from_tier',   v_from_name,
      'to_tier',     v_to_name,
      'to_tier_id',  COALESCE(NEW.override_tier_id, NEW.current_tier_id)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_loyalty_tier_change ON public.user_loyalty;
CREATE TRIGGER trg_notify_loyalty_tier_change
AFTER UPDATE ON public.user_loyalty
FOR EACH ROW
EXECUTE FUNCTION public.notify_loyalty_tier_change();

-- 2) Expire manual overrides and notify affected users
CREATE OR REPLACE FUNCTION public.expire_loyalty_overrides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_count int := 0;
BEGIN
  FOR v_row IN
    SELECT user_id
      FROM public.user_loyalty
     WHERE override_tier_id IS NOT NULL
       AND override_until IS NOT NULL
       AND override_until <= now()
  LOOP
    UPDATE public.user_loyalty
       SET override_tier_id = NULL,
           override_reason  = NULL,
           override_until   = NULL,
           override_by      = NULL,
           updated_at       = now()
     WHERE user_id = v_row.user_id;

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (
      v_row.user_id,
      'EasyPay Club override expired',
      'Your admin-granted tier has ended. You are back on your earned tier.',
      'loyalty',
      jsonb_build_object('event', 'override_expired')
    );

    PERFORM public.recalculate_user_loyalty(v_row.user_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_loyalty_overrides() TO service_role;
