## Instant Balance Deduction for Bank Transfer Withdrawals

### What Changes

Currently, bank transfer submissions only create a fund_request row — balance is deducted only when admin approves. The new flow:

1. **User submits**: Balance deducted instantly (amount + 1% fee), a `banktransfer` transaction is created with status `pending`, and fund_request is linked to that transaction.
2. **User sees confirmation**: Shows amount, 1% charge, and net amount they'll receive.
3. User need final **confirmation by entering pin**
4. **Admin approves**: Transaction status updated to `completed`. Treasury credited.
5. **Admin rejects**: Balance refunded to user instantly, transaction status set to `rejected`, refund transaction recorded.

### Database Changes (Migration)

1. **Add `transaction_id` column** to `fund_requests` table to link the pending transaction.
2. **New RPC `submit_withdraw_request**` (SECURITY DEFINER):
  - Validates amount, calculates 1% fee
  - Locks user profile, checks sufficient balance
  - Deducts `amount + fee` from user balance
  - Creates `banktransfer` transaction with status `pending` and `balance_after`
  - Inserts fund_request row linked to transaction
  - Returns fee, net amount, new balance
3. **Update `admin_approve_fund_request**`: For withdrawals, skip balance deduction (already done). Just update transaction status to `completed` and credit treasury.
4. **Update `admin_reject_fund_request**`: For withdrawals, refund `amount + fee` to user balance, update transaction status to `rejected`, insert a refund `addmoney` transaction.

### Frontend Changes

`**src/components/BankTransferFlow.tsx**`:

- Add a confirmation step showing: Amount, 1% charge, net receivable amount
- Update the info banner: "Your balance will be deducted immediately. You'll receive ৳X after 1% charge."
- Update success screen to show deducted amount with fee breakdown
- Call new `submit_withdraw_request` RPC instead of plain insert

`**src/hooks/use-fund-requests.ts**`:

- Update `submitRequest` for withdraw type to call the new RPC instead of direct insert

`**src/components/admin/AdminFundRequests.tsx**`:

- No major changes needed — approve/reject RPCs handle the logic server-side. History statuses already show pending/approved/rejected.

### Fee Calculation

- Amount: user-entered value
- Fee: 1% of amount
- Total deducted: amount + fee
- User receives: amount (fee goes to platform)

### Files Changed

- Database migration (new RPC + alter table)
- `src/components/BankTransferFlow.tsx` — add fee confirmation, call RPC
- `src/hooks/use-fund-requests.ts` — add `submitWithdraw` method using RPC