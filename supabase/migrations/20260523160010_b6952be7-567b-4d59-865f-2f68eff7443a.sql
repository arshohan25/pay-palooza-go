CREATE TABLE IF NOT EXISTS public.gold_holdings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  karat             TEXT NOT NULL CHECK (karat IN ('22k','24k')),
  grams             NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (grams >= 0),
  avg_buy_price     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (avg_buy_price >= 0),
  last_price_update TIMESTAMPTZ,
  UNIQUE(user_id, karat)
);

ALTER TABLE public.gold_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gold_holdings_own_select" ON public.gold_holdings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gold_holdings_own_insert" ON public.gold_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gold_holdings_own_update" ON public.gold_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gold_holdings_own_delete" ON public.gold_holdings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);