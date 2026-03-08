

## Plan: Show Merchant Name on Dynamic QR Page via Backend Function

### Problem
The `merchants` table has RLS restrictions, so the DynamicQrPage (viewed by anonymous/public users) cannot join to it. Currently merchant name only shows if manually set in session `metadata`.

### Solution
Create a database function (`get_public_session_info`) that safely returns session details + merchant `business_name` and `category` using `SECURITY DEFINER`, bypassing RLS. The frontend calls this RPC instead of querying the table directly.

### Changes

**1. Database migration — create `get_public_session_info` RPC**
- Accepts `p_session_id uuid`
- Returns JSON with: `id, amount, currency, reference, description, status, success_url, expires_at, merchant_id, metadata, merchant_name, merchant_category`
- Uses `SECURITY DEFINER` to join `merchant_payment_sessions` with `merchants` safely
- Only exposes public-safe fields (no bank details, no user_id, no trade license)

```sql
CREATE OR REPLACE FUNCTION public.get_public_session_info(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session RECORD;
  v_merchant_name text;
  v_merchant_category text;
BEGIN
  SELECT * INTO v_session
  FROM merchant_payment_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN RETURN NULL; END IF;

  SELECT business_name, category::text
  INTO v_merchant_name, v_merchant_category
  FROM merchants WHERE id = v_session.merchant_id;

  RETURN json_build_object(
    'id', v_session.id,
    'amount', v_session.amount,
    'currency', v_session.currency,
    'reference', v_session.reference,
    'description', v_session.description,
    'status', v_session.status,
    'success_url', v_session.success_url,
    'expires_at', v_session.expires_at,
    'merchant_id', v_session.merchant_id,
    'metadata', v_session.metadata,
    'merchant_name', v_merchant_name,
    'merchant_category', v_merchant_category
  );
END;
$$;
```

**2. Update `src/pages/DynamicQrPage.tsx`**
- Replace the direct `.from("merchant_payment_sessions").select(...)` query with `supabase.rpc("get_public_session_info", { p_session_id: sessionId })`
- Read `merchant_name` directly from the RPC response (with metadata fallback)
- Optionally display `merchant_category` as a subtitle

This is a clean, secure approach: no new edge function needed, no RLS changes, and only safe fields are exposed.

