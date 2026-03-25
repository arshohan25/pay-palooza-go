

## Plan: Automated MFS-In Webhook + Improved Add Money Flow

### Problem
Currently, when someone sends money from bKash/Nagad/Rocket to EasyPay, the process is fully manual: user sends money, uploads proof, and waits for admin approval. There's no automated verification and no TxnID format validation.

### Solution
Two parts: (A) an edge function webhook receiver for MFS providers to auto-credit wallets, and (B) improvements to the existing Add Money flow for better validation and tracking.

---

### Part A: MFS-In Webhook Edge Function

**New file: `supabase/functions/mfs-incoming-webhook/index.ts`**

A webhook endpoint that MFS providers (bKash, Nagad, Rocket) call when a payment is confirmed to EasyPay's deposit account.

- Accepts POST with payload: `{ provider, txn_id, sender_number, amount, timestamp, signature }`
- Validates HMAC signature using provider-specific secrets
- Looks up matching pending `fund_requests` by `transaction_id_proof` + `source_method` + `amount`
- If match found: auto-approves via `admin_approve_fund_request` RPC (service-role)
- If no match: logs to a new `mfs_incoming_payments` table for manual reconciliation
- Returns 200 OK to the provider

**New DB table: `mfs_incoming_payments`**
- `id`, `provider` (bkash/nagad/rocket), `txn_id`, `sender_number`, `amount`, `status` (matched/unmatched/manual), `matched_request_id` (nullable FK to fund_requests), `raw_payload` (jsonb), `created_at`
- RLS: admin-only read access

**Admin visibility**: Add an "Incoming MFS" sub-section in the Fund Requests admin tab showing unmatched incoming payments for manual linking.

---

### Part B: Improved Add Money Flow

**Changes to `src/components/AddMoneyFlow.tsx`:**

1. **TxnID format validation** — On the proof step, validate transaction ID patterns per source:
   - bKash: alphanumeric, 10 chars (e.g., `ABC1234XYZ`)
   - Nagad: numeric, 8-15 digits
   - Rocket: `R` prefix + digits
   - Show inline hint: "bKash TxnID is usually 10 characters, found on your bKash app confirmation"

2. **Real-time status tracking** — After submission, show a tracking card on success screen:
   - "Submitted" → "Under Review" → "Approved" / "Rejected"
   - Subscribe to realtime changes on the user's fund_request row
   - Show estimated processing time: "Usually within 15 minutes"

3. **Push notification on approval/rejection** — Already exists via `admin_approve_fund_request` / `admin_reject_fund_request` RPCs (they insert notifications). Just needs the success screen to mention "You'll be notified when processed."

**Changes to `src/components/admin/AdminFundRequests.tsx`:**

4. **Incoming MFS payments tab** — New sub-tab "Incoming MFS" showing unmatched webhook payments with a "Link to Request" action button

---

### Files

| File | Action |
|------|--------|
| `supabase/functions/mfs-incoming-webhook/index.ts` | Create — webhook receiver |
| `src/components/AddMoneyFlow.tsx` | Edit — TxnID validation + status tracking |
| `src/components/admin/AdminFundRequests.tsx` | Edit — add Incoming MFS sub-tab |
| DB migration | Create `mfs_incoming_payments` table + RLS |

### Database Migration
```sql
CREATE TABLE public.mfs_incoming_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  sender_number TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'unmatched',
  matched_request_id UUID REFERENCES fund_requests(id),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mfs_incoming_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incoming MFS"
  ON public.mfs_incoming_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX idx_mfs_incoming_txn ON public.mfs_incoming_payments(provider, txn_id);
```

