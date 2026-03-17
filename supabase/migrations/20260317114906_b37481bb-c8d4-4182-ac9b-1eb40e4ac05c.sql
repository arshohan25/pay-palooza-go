
-- Trigger to insert notifications when order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_label text;
  v_emoji text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.status
    WHEN 'processing' THEN 'Processing'
    WHEN 'confirmed' THEN 'Confirmed'
    WHEN 'shipped' THEN 'Shipped'
    WHEN 'out_for_delivery' THEN 'Out for Delivery'
    WHEN 'delivered' THEN 'Delivered'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE NEW.status
  END;

  v_emoji := CASE NEW.status
    WHEN 'processing' THEN '⏳'
    WHEN 'confirmed' THEN '✅'
    WHEN 'shipped' THEN '📦'
    WHEN 'out_for_delivery' THEN '🚚'
    WHEN 'delivered' THEN '🎉'
    WHEN 'cancelled' THEN '❌'
    ELSE '📋'
  END;

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_emoji || ' Order ' || NEW.order_num || ' — ' || v_label,
    'Your order ' || NEW.order_num || ' status has been updated to ' || v_label || '.',
    'order_status_change',
    jsonb_build_object(
      'order_id', NEW.id,
      'order_num', NEW.order_num,
      'old_status', OLD.status,
      'new_status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();
