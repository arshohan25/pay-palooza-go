

## Plan: Duplicate TxnID Detection

### What
Add a real-time check when users type a Transaction ID in the Add Money proof step. Query `fund_requests` to see if the same `transaction_id_proof` was already submitted. Show a warning if a duplicate is found.

### Changes

**`src/components/AddMoneyFlow.tsx`**
1. Add state: `duplicateTxnWarning` (string)
2. Add a debounced check function that queries `fund_requests` table for existing rows matching the entered `transaction_id_proof` (case-insensitive trim)
3. On the proof step, show a destructive-colored warning below the TxnID input if duplicate found (e.g., "This Transaction ID was already submitted on [date]. Submitting duplicate IDs may delay processing.")
4. Also check `mfs_incoming_payments` table for the same `txn_id` to cover webhook-received payments
5. Block submission (disable Continue) if a confirmed duplicate is detected, or at minimum show a strong warning

### Technical Detail
- Query: `supabase.from('fund_requests').select('id,created_at,status').eq('transaction_id_proof', txnId.trim()).neq('status','rejected').limit(1)`
- Debounce 500ms after user stops typing to avoid excessive queries
- Also query `mfs_incoming_payments` by `txn_id` for cross-check
- Display warning with the date and status of the existing request

