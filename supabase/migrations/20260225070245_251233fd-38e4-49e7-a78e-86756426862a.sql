
ALTER TABLE public.support_conversations ADD COLUMN rating smallint DEFAULT NULL;

-- Add constraint via trigger to ensure rating is 1-5
CREATE OR REPLACE FUNCTION public.validate_ticket_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_ticket_rating
BEFORE INSERT OR UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_rating();
