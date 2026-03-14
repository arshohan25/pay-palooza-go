

## Secure Manual Add Money & Bank Transfer Request System

### Overview
Build a request-based fund management system where users submit deposit/withdrawal requests with proof, and admins review, approve, or reject from a dedicated dashboard tab. Admin can also proactively add/withdraw funds (already partially exists via Treasury Disburse).

### Database Changes

**New table: `fund_requests`**
- `id` UUID PK
- `user_id` UUID (references profiles)
- `type` TEXT — `'add_money'` or `'withdraw'`
- `amount` NUMERIC
- `status` TEXT — `'pending'`, `'approved'`, `'rejected'`
- `source_method` TEXT — e.g. `'bank_transfer'`, `'bkash'`, `'nagad'`, `'cash'`
- `proof_url` TEXT (screenshot/receipt uploaded to storage)
- `transaction_id_proof` TEXT (user-provided TxnID/reference)
- `bank_name` TEXT (for withdrawals)
- `account_number` TEXT (for withdrawals)
- `account_holder` TEXT (for withdrawals)
- `admin_note` TEXT
- `reviewed_by` UUID
- `reviewed_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

RLS: Users CRUD own requests, Admins full access.

**New RPC: `admin_approve_fund_request`** (SECURITY DEFINER)
- Validates admin role
- Locks profile row, credits/debits balance
- Records transaction (addmoney/banktransfer)
- Updates fund_request status to 'approved'
- Logs to audit_logs and treasury_ledger

**New RPC: `admin_reject_fund_request`** (SECURITY DEFINER)
- Validates admin role
- Updates status to 'rejected' with admin_note
- Audit log entry

**Storage bucket: `fund-proofs`** for receipt screenshots

**Realtime**: Enable on `fund_requests` table

### User-Side Changes

**Rework `AddMoneyFlow.tsx`**
- Simplify to: Amount → Source (Bank/MFS) → Upload Proof (screenshot + TxnID) → Submit
- No PIN step needed (no immediate balance change)
- Show "Request Submitted" success with pending status
- Remove all gateway integration code (bKash/Nagad/AsthaPay redirects)
- User sees their request history with status badges (pending/approved/rejected)

**Rework `BankTransferFlow.tsx`**
- Amount → Select/Add Bank → Submit Withdrawal Request
- No immediate balance deduction — admin processes manually
- Show pending status after submission

### Admin-Side Changes

**New component: `AdminFundRequests.tsx`**
- New tab "Fund Requests" in Admin Dashboard (between Treasury and Webhooks)
- Queue view with filters: All / Pending / Approved / Rejected, type filter (Add Money / Withdraw)
- Each card shows: user info (name, phone, balance), amount, source, proof image preview, TxnID
- Actions: Approve (with optional note) → triggers RPC that credits/debits balance, Reject (with mandatory reason)
- Real-time updates via subscription
- Badge count of pending requests on tab

**Enhance `AdminTreasury.tsx`**
- Keep existing Disburse functionality (admin proactively adds funds)
- Add a quick link to Fund Requests tab

### File Changes Summary
1. **Migration SQL** — Create `fund_requests` table, RPCs, storage bucket, realtime
2. **`src/components/AddMoneyFlow.tsx`** — Rewrite as request submission flow
3. **`src/components/BankTransferFlow.tsx`** — Rewrite as withdrawal request flow  
4. **`src/components/admin/AdminFundRequests.tsx`** — New admin review panel
5. **`src/pages/AdminDashboard.tsx`** — Add "Fund Requests" tab
6. **`src/hooks/use-fund-requests.ts`** — New hook for user's request history + realtime

### Security
- Balance only changes via SECURITY DEFINER RPCs called by admin
- Users cannot modify their own balance — only submit requests
- All approvals/rejections audit-logged with actor ID
- Proof images stored in authenticated storage bucket
- Treasury ledger updated on every approval

