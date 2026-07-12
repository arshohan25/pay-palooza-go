
CREATE OR REPLACE FUNCTION public.notify_dispute_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'under_review' THEN
      v_title := 'Dispute under review';
      v_body  := 'Your dispute "' || NEW.subject || '" is now being reviewed by our team.';
    ELSIF NEW.status = 'resolved' THEN
      v_title := 'Dispute resolved';
      v_body  := 'Your dispute "' || NEW.subject || '" has been resolved. Tap to view the resolution.';
    ELSIF NEW.status = 'rejected' THEN
      v_title := 'Dispute closed';
      v_body  := 'Your dispute "' || NEW.subject || '" was closed. Tap for details.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (
      NEW.complainant_id,
      v_title,
      v_body,
      'dispute',
      jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_status_notify ON public.disputes;
CREATE TRIGGER trg_dispute_status_notify
AFTER UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_dispute_status_change();

-- Also notify complainant of new handler messages
CREATE OR REPLACE FUNCTION public.notify_dispute_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_complainant uuid;
  v_subject text;
BEGIN
  SELECT complainant_id, subject INTO v_complainant, v_subject
  FROM public.disputes WHERE id = NEW.dispute_id;

  IF v_complainant IS NULL OR NEW.sender_id = v_complainant THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    v_complainant,
    'New reply on your dispute',
    'Handler replied to "' || COALESCE(v_subject, 'your dispute') || '"',
    'dispute',
    jsonb_build_object('dispute_id', NEW.dispute_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_new_message_notify ON public.dispute_messages;
CREATE TRIGGER trg_dispute_new_message_notify
AFTER INSERT ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_dispute_new_message();
