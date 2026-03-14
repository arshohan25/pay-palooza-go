

## Backfill Missing Transaction Records for Fund Requests

### Current State
3 `fund_requests` records have `transaction_id = NULL` (created before the RPCs were implemented):

1. **Add Money ৳1,000** — status: `approved`, source: bkash
2. **Withdraw ৳2,000** — status: `rejected`, bank: Dutch-Bangla Bank
3. **Withdraw ৳10,000** — status: `pending`, bank: Dutch-Bangla Bank

### Plan
Use the database insert tool to:

1. **Insert 3 transaction records** into `transactions` table with matching types, amounts, statuses, and timestamps from the fund_requests.
   - Add Money (approved) → type `addmoney`, status `completed`
   - Withdraw (rejected) → type `banktransfer`, status `failed`
   - Withdraw (pending) → type `banktransfer`, status `pending`

2. **Update the 3 fund_requests** to set `transaction_id` pointing to the newly created transactions.

### Files Changed
- No code changes — data-only operations via insert tool.

