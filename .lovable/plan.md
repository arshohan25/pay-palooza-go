

## Expand Transaction Notifications to All Roles and Types

### Current State
The `notify_recipient_trigger` only fires for `receive` and `cashin` transaction types. Other roles (agents, merchants, distributors) and transaction types (cashout, payment, recharge, paybill, banktransfer, addmoney, send) get no in-app notification or SMS.

### Changes

**1. Database migration — update trigger and function**

Drop the existing trigger (which has a `WHEN` filter limiting to `receive`/`cashin`) and recreate it to fire on ALL transaction inserts. Update the trigger function to generate appropriate notification titles and bodies per transaction type:

| Type | Title Example | Body Example |
|---|---|---|
| send | Sent ৳500 | You sent ৳500.00 to John. Balance: ৳4,500.00 |
| receive | Money Received ৳500 | You received ৳500.00 from John. Balance: ৳5,500.00 |
| cashout | Cash Out ৳1,000 | Cash out of ৳1,000.00 completed. Balance: ৳3,000.00 |
| cashin | Cash In ৳500 | Cash in of ৳500.00 received. Balance: ৳5,500.00 |
| payment | Payment ৳200 | Payment of ৳200.00 to ShopName. Balance: ৳4,800.00 |
| recharge | Recharge ৳100 | Recharge of ৳100.00 completed. Balance: ৳4,900.00 |
| paybill | Bill Pay ৳500 | Bill payment of ৳500.00 completed. Balance: ৳4,500.00 |
| banktransfer | Bank Transfer ৳2,000 | Bank transfer of ৳2,000.00 completed. Balance: ৳3,000.00 |
| addmoney | Money Added ৳1,000 | ৳1,000.00 added to your wallet. Balance: ৳6,000.00 |

The SMS call via `pg_net` will also fire for all types so recipients get phone messages for every transaction.

**2. Update edge function `notify-recipient`**

Update SMS message formatting to handle all transaction types (not just "received" language). Use type-appropriate wording: "You sent", "Cash out completed", "Payment to", etc.

### Files

| File | Change |
|---|---|
| DB migration (new) | Drop old trigger, recreate without WHEN filter, update function with per-type titles/bodies |
| `supabase/functions/notify-recipient/index.ts` | Update SMS body to use type-appropriate wording |

