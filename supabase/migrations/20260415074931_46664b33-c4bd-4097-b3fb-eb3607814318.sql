-- Drop the overload with text types for p_type and p_recipient_type
DROP FUNCTION IF EXISTS public.transfer_money(text, numeric, numeric, text, text, text, text, text, numeric);

-- Drop the overload where p_type and p_recipient_type are required (non-default) txn_type params in different arg order
DROP FUNCTION IF EXISTS public.transfer_money(txn_type, txn_type, numeric, numeric, numeric, text, text, text, text);