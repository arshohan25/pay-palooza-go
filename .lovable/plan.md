
Fix Plan: make Send Money (wallet ID), Cash Out (agent ID), and Payment (merchant ID) work again

1) Root cause found
- The new client-side recipient checks query `profiles`, `user_roles`, `agents`, and `merchants` directly.
- Those tables are protected by RLS for “own row/admin only”, so regular users can’t see other users’ rows.
- Result: validation always fails before amount step, even for valid recipients.
- Extra Send Money bug: wallet regex is `MFS-...` but generated wallet IDs are `EZP-...`, so valid wallet IDs are rejected immediately.
- Extra Send Money bug: wallet IDs are being validated/transferred as if they were phone numbers.

2) Backend-safe validation strategy (no RLS weakening)
- Add a new SECURITY DEFINER RPC in a migration, e.g. `resolve_transfer_recipient(p_identifier text, p_flow text)`.
- This RPC returns minimal safe data:
  - `found` (bool)
  - `recipient_phone` (canonical phone to pass into `transfer_money`)
  - `recipient_name`
  - `matched_by` (phone / wallet / agent_id / merchant_code / merchant_id)
- Keep RLS as-is; do not make `profiles/agents/merchants/user_roles` publicly readable.

3) Resolver logic (server side)
- Shared normalization:
  - trim input
  - normalize BD phone variants (`+88`, `88`, dashed) to canonical 11-digit form
- Send flow:
  - accept 11-digit phone
  - accept `EZP-XXXX-XXXX` wallet ID by computing wallet ID from profile phone server-side (same algorithm as frontend `generateWalletId`)
- Cashout flow:
  - accept agent phone
  - accept `agents.id` UUID as agent ID
  - require `agents.status='active'` + active profile
- Payment flow:
  - accept merchant phone
  - accept `merchants.id` UUID
  - accept merchant code (`merchants.qr_code_data`, e.g. `MRC-...`)
  - require `merchants.status='active'` + active profile

4) Frontend fixes
A) `src/components/SendMoneyFlow.tsx`
- Change wallet regex to `^EZP-[A-Z]{4}-[A-Z]{4}$` (case-insensitive).
- Replace direct `profiles` lookup with RPC call (`resolve_transfer_recipient` with flow=`send`).
- Store/use returned canonical `recipient_phone` for final `transferMoney` call.
- Keep display label as typed wallet ID when user entered wallet mode.
- Normalize QR/manual values before validation.

B) `src/components/CashOutFlow.tsx`
- Replace `validateAgentExists` direct table checks with RPC flow=`cashout`.
- Save both display ID and resolved phone; transfer must use resolved phone.
- Keep friendly error text if resolver returns not found.

C) `src/components/PaymentFlow.tsx`
- Replace `validateMerchantExists` direct table checks with RPC flow=`payment`.
- Use resolved phone in final transfer call.
- Accept merchant code (`MRC-...`) and merchant UUID transparently.

5) Keep existing financial safety net
- Keep current `transfer_money` “recipient not found” exception behavior (already added).
- This remains the final guard if client validation is bypassed.

6) Technical details (implementation notes)
- Migration will add helper SQL functions for:
  - phone normalization
  - wallet ID generation compatible with current JS algorithm
  - recipient resolution RPC
- No schema/table policy changes required.
- No edits to auto-generated Supabase client/types files.
- Minimal UI copy tweaks:
  - Send: “Number or Wallet ID (EZP-XXXX-XXXX)”
  - Cashout: “Agent phone or Agent ID”
  - Payment: “Merchant code / Merchant ID / phone”

7) Validation checklist after implementation
- Send money to valid phone works.
- Send money to valid EZP wallet ID works.
- Cashout to valid agent phone works.
- Cashout to valid agent UUID works.
- Payment to valid merchant `MRC-...` code works.
- Payment to valid merchant UUID works.
- Invalid IDs show clear error and do not proceed.
- End-to-end: sender balance decreases, recipient balance increases, both transactions recorded.
