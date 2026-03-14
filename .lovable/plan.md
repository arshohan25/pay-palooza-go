

## Show Fund Requests (Add Money & Bank Transfer) in Transaction History

### Problem
- **Bank Transfer (withdraw)**: Already creates a `pending` transaction via `submit_withdraw_request` RPC, so it appears in history — but the status badge always shows green "completed" regardless of actual status.
- **Add Money (deposit)**: Only creates a transaction record when admin approves. Before approval, nothing shows in transaction history.
- The `TransactionList` home widget filters out `banktransfer` type entirely (line 192: `USER_TYPES` only includes send, receive, payment, recharge, addmoney).

### Solution

#### 1. Database Migration
- **New RPC `submit_addmoney_request`**: Similar to `submit_withdraw_request` but for deposits. Creates a `pending` `addmoney` transaction + linked fund_request at submission time (no balance change — balance only added on approval).
- **Update `admin_approve_fund_request`**: For `add_money` type, update the existing pending transaction to `completed` instead of inserting a new one. Still add balance.
- **Update `admin_reject_fund_request`**: For `add_money` type, update the pending transaction to `rejected`. No balance refund needed (nothing was deducted).

#### 2. Frontend: `src/hooks/use-fund-requests.ts`
- Add `submitAddMoney` method that calls the new RPC instead of plain insert.

#### 3. Frontend: `src/components/AddMoneyFlow.tsx`
- Call `submitAddMoney` RPC instead of `submitRequest` for add_money type.

#### 4. Frontend: `src/components/TransactionList.tsx`
- Add `banktransfer` to `USER_TYPES` so it shows on the home screen.
- Show status badges for `pending` and `rejected` transactions (amber for pending, red for rejected) in both the list rows and the detail sheet.

#### 5. Frontend: `src/pages/TransactionHistory.tsx`
- Show status badges (pending/rejected) on transaction rows — same treatment as TransactionList.

### Files Changed
- Database migration (new `submit_addmoney_request` RPC, updated approve/reject RPCs)
- `src/hooks/use-fund-requests.ts` — add `submitAddMoney` method
- `src/components/AddMoneyFlow.tsx` — use new RPC
- `src/components/TransactionList.tsx` — add `banktransfer` to USER_TYPES, show status badges
- `src/pages/TransactionHistory.tsx` — show status badges on rows

