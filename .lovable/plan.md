## Real-Time Notification + SMS for Money Recipients

### Problem

When someone receives money (via Send Money, Payment, Cash Out, etc.), the recipient gets no in-app notification and no SMS. They only see it if they manually refresh their transaction history.

### Solution

Create a database trigger on the `transactions` table that fires on INSERT for recipient-side transaction types (`receive`, `cashin`). This trigger will:

1. Insert an in-app notification into the `notifications` table (picked up instantly by the existing realtime subscription in `useNotifications`)
2. Call a new edge function `notify-recipient` that sends an SMS via Twilio

### Changes

**1. Database migration — trigger function + trigger**

- Create a `notify_transaction_recipient()` SECURITY DEFINER function that fires AFTER INSERT on `transactions`
- Only fires for types: `receive`, `cashin` (these are the recipient-side records created by `transfer_money`)
- Inserts a row into `notifications` with title like "Money Received ৳500" and body with sender info
- Uses `pg_net` extension to call the `notify-recipient` edge function asynchronously for SMS delivery (non-blocking)

**2. New edge function `supabase/functions/notify-recipient/index.ts**`

- Receives `{ user_id, amount, sender_name, sender_phone. ref(if available). type. TxnID, Balance_amount, date&time. }` from the trigger via pg_net
- Looks up recipient phone from `profiles`
- Sends SMS via Twilio (using existing configured secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- Message: "EasyPay: You received ৳{amount} from {sender_name}. Your new balance is ৳{balance}."
- No JWT verification needed (called server-to-server from DB trigger)

**3. Config update — `supabase/config.toml**`

- Add `[functions.notify-recipient]` with `verify_jwt = false`

### Flow

```text
transfer_money RPC
  └─ INSERT into transactions (recipient row, type='receive')
       └─ AFTER INSERT trigger fires
            ├─ INSERT into notifications (instant in-app via realtime)
            └─ pg_net.http_post → notify-recipient edge function
                 └─ Twilio SMS to recipient phone
```

### What users see

- **In-app**: Bell icon badge increments, notification appears instantly: "Money Received ৳500 from John"
- **SMS**: Phone receives: "EasyPay: You have received ৳500.00 from John. Check your wallet."

### Files


| File                                           | Action                    |
| ---------------------------------------------- | ------------------------- |
| DB migration                                   | New trigger + function    |
| `supabase/functions/notify-recipient/index.ts` | New edge function for SMS |
| `supabase/config.toml`                         | Add function config       |
