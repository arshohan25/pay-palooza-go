

## Fix: Duplicate `transfer_money` Function Overload

### Problem
The database has **two** `transfer_money` functions with nearly identical signatures. PostgreSQL cannot choose between them when called, causing "Could not choose the best candidate function" errors on every payment/transfer.

- **Version 1** (8 params): `p_recipient_phone, p_amount, p_fee, p_type, p_description, p_reference, p_recipient_name, p_recipient_type`
- **Version 2** (9 params): Same + `p_commission` (with default 0)

### Fix
Run a single migration to **drop the old 8-param version**, keeping only the 9-param version which already defaults `p_commission` to 0, so all existing call sites work unchanged.

```sql
DROP FUNCTION IF EXISTS public.transfer_money(text, numeric, numeric, txn_type, text, text, text, txn_type);
```

### Files Changed
| File | Action |
|------|--------|
| Migration SQL | Drop the 8-param overload |

No code file changes needed — all callers either already pass `p_commission` or rely on the default.

