
-- Drop old 3-param versions that conflict with the new 4-param versions
DROP FUNCTION IF EXISTS public.buy_gold(numeric, numeric, text);
DROP FUNCTION IF EXISTS public.sell_gold(numeric, numeric, text);
DROP FUNCTION IF EXISTS public.buy_stock(text, integer, numeric);
DROP FUNCTION IF EXISTS public.sell_stock(text, integer, numeric);
