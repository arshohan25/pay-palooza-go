CREATE TABLE IF NOT EXISTS public.stock_holdings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  name              TEXT NOT NULL,
  quantity          INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  avg_buy_price     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (avg_buy_price >= 0),
  current_price     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  last_price_update TIMESTAMPTZ,
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_holdings_own_select" ON public.stock_holdings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "stock_holdings_own_insert" ON public.stock_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_holdings_own_update" ON public.stock_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_holdings_own_delete" ON public.stock_holdings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);