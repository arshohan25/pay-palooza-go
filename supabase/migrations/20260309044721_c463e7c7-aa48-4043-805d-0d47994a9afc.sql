-- Drop the old 8-param transfer_money overload (without p_commission) to resolve ambiguity
-- Keep only the 9-param version which has p_commission with DEFAULT 0
DROP FUNCTION IF EXISTS public.transfer_money(text, numeric, numeric, txn_type, text, text, text);
DROP FUNCTION IF EXISTS public.transfer_money(text, numeric, numeric, txn_type, text, text, text, txn_type);
