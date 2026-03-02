

## Plan: Fix AsthaPay API to Match Docs + Add Realtime to Webhook Log

### Three tasks to address:

---

### 1. Fix AsthaPay Create API to match official documentation

The AsthaPay API docs require `cus_name` and `cus_email` as **required** fields, plus `success_url`, `cancel_url`, `amount`, and optional `meta_data`. The current edge function sends `invoice_number` which is **not** in the docs. Also, the docs show the redirect returns query params: `transactionId`, `paymentMethod`, `paymentAmount`, `paymentFee`, `status`.

**Edit `supabase/functions/asthapay-payment/index.ts`:**
- In the `create` action, add `cus_name` and `cus_email` to the POST body (fetch from user's profile)
- Replace `invoice_number` with `meta_data` (JSON containing sessionId, invoice info)
- Keep `success_url`, `cancel_url`, `ipn_url` as-is (already correct)
- The success/cancel URL format already includes `?asthapay=1&sessionId=...&status=...` — this matches AsthaPay's redirect behavior where it appends `transactionId` as a query param

**Edit `src/pages/Index.tsx`:**
- Also handle the AsthaPay redirect query params from the docs format: `transactionId`, `paymentMethod`, `paymentAmount`, `paymentFee`, `status` — the current code already parses `transactionId` so this is mostly fine, but ensure it also catches the direct AsthaPay redirect format (without `asthapay=1`)

---

### 2. Redesign AsthaPay details page to match the reference images

The uploaded images show AsthaPay's payment page flow — a branded page with MFS provider logos (Rocket, Nagad, Upay, bKash), then an instruction page telling the user to send money to a specific number and enter the Transaction ID. Since our app redirects to AsthaPay's hosted page (pay.asthapay.com), the user already sees this UI. No changes needed to replicate it — it's AsthaPay's own hosted page.

However, the **MFS details step** (Step 3c in AddMoneyFlow) should be improved to explain that the user will be redirected to AsthaPay's payment page:

**Edit `src/components/AddMoneyFlow.tsx`:**
- For AsthaPay specifically, update the "How it works" instructions to explain the redirect flow (matching the reference images):
  1. You'll be redirected to AsthaPay's secure payment page
  2. Choose your payment method (bKash, Nagad, Rocket, etc.)
  3. Follow the instructions to complete payment
  4. You'll be redirected back and your wallet will be credited
- Remove the phone number input requirement for AsthaPay (AsthaPay handles this on their end)
- Skip the `mfsAccount` validation for AsthaPay in `handleDetailsContinue`

---

### 3. Add real-time updates to AdminWebhookLog

**Edit `src/components/admin/AdminWebhookLog.tsx`:**
- Subscribe to Supabase Realtime `postgres_changes` on `payment_sessions` table (already enabled for realtime)
- On `INSERT` or `UPDATE` events, either prepend the new/updated row to the list or re-fetch
- Show a subtle "live" indicator badge next to the title
- Clean up the subscription on unmount

---

### Technical details

**AsthaPay API create body (per docs):**
```json
{
  "cus_name": "User Name",
  "cus_email": "user@email.com",
  "amount": "100",
  "success_url": "https://app.com/?asthapay=1&sessionId=xxx&status=success",
  "cancel_url": "https://app.com/?asthapay=1&sessionId=xxx&status=cancel",
  "meta_data": { "sessionId": "xxx", "userId": "yyy" }
}
```

**Realtime subscription pattern:**
```typescript
const channel = supabase
  .channel('webhook-log')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_sessions' }, () => load())
  .subscribe();
```

### Files
- **Edit**: `supabase/functions/asthapay-payment/index.ts` — fix create payload to match docs
- **Edit**: `src/components/AddMoneyFlow.tsx` — update AsthaPay details step UX
- **Edit**: `src/components/admin/AdminWebhookLog.tsx` — add realtime subscription

