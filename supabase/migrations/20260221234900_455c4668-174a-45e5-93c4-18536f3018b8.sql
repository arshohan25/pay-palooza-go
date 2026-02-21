
-- Add short_id column for human-readable transaction IDs (12 chars, uppercase + numbers)
ALTER TABLE public.transactions ADD COLUMN short_id TEXT;

-- Function to generate a random 12-char uppercase alphanumeric ID
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger to auto-generate short_id on insert
CREATE OR REPLACE FUNCTION public.set_transaction_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
    NEW.short_id := generate_short_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_short_id
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_short_id();

-- Backfill existing transactions
UPDATE public.transactions SET short_id = generate_short_id() WHERE short_id IS NULL;

-- Add unique constraint and not-null after backfill
ALTER TABLE public.transactions ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN short_id SET DEFAULT generate_short_id();
CREATE UNIQUE INDEX idx_transactions_short_id ON public.transactions(short_id);
