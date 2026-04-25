CREATE OR REPLACE FUNCTION public.notify_order_partial_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_supabase_url text;
  v_service_key  text;
BEGIN
  IF NEW.status = 'partially_shipped'
     AND COALESCE(OLD.status, '') <> 'partially_shipped'
     AND NEW.user_id IS NOT NULL THEN

    v_title := 'Order partially shipped 📦';
    v_body  := format('Some items from order #%s are on the way', COALESCE(NEW.order_num, ''));

    -- In-app notification
    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (
      NEW.user_id, v_title, v_body, 'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'event', 'partial',
        'order_num', NEW.order_num,
        'fulfillment_status', 'partial'
      )
    );

    -- Web push (best-effort; never block the order update)
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
      v_service_key  := current_setting('app.service_role_key', true);

      IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'user_ids', jsonb_build_array(NEW.user_id),
            'title', v_title,
            'body',  v_body,
            'url',   '/orders/' || NEW.id::text
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_partial ON public.orders;
CREATE TRIGGER trg_notify_order_partial
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_partial_shipment();