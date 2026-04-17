

## Fix: Notifications show "Payment to Someone" for savings/gold/stock buys

### Root cause

Trigger `notify_transaction_recipient` (migration `…135506_…sql`) builds the body purely from `recipient_name`/`recipient_phone`. Internal "purchase" transactions — savings goal deposits, DPS top-ups, gold/stock buys, loan repayments — are written with `type='payment'` but **no recipient** (it's an internal transfer, not a person). So every internal `payment` row notifies as **"Payment of ৳X to Someone"**.

Live evidence (DB):
| description | recipient_name | notification body |
|---|---|---|
| Savings Goal: Dream Bike | NULL | "Payment of ৳5,000 to Someone" ❌ |
| Gold Purchase: 2g 24k | NULL | "Payment of ৳37,504 to Someone" ❌ |
| Stock Purchase: 5x GRPH | NULL | "Payment of ৳1,928 to Someone" ❌ |

### The fix

Update the trigger so the **`payment` branch reads `description` first** when `recipient_name` is NULL, and recognizes our internal categories with proper titles + clean copy.

New migration `CREATE OR REPLACE FUNCTION public.notify_transaction_recipient()` — only the `WHEN 'payment'` branch changes:

```sql
WHEN 'payment' THEN
  -- Detect internal purchases by description prefix
  IF NEW.recipient_name IS NULL AND NEW.recipient_phone IS NULL THEN
    IF NEW.description LIKE 'Savings Goal:%' THEN
      v_title := 'Goal Deposit ৳' || NEW.amount::text;
      v_body  := '৳' || v_formatted_amount || ' added to "' ||
                 trim(substring(NEW.description from 15)) || '".' || v_balance_str;
    ELSIF NEW.description LIKE 'Gold Purchase:%' THEN
      v_title := 'Gold Purchased ৳' || NEW.amount::text;
      v_body  := 'You bought ' || trim(substring(NEW.description from 16)) ||
                 ' for ৳' || v_formatted_amount || '.' || v_balance_str;
    ELSIF NEW.description LIKE 'Stock Purchase:%' THEN
      v_title := 'Stock Purchased ৳' || NEW.amount::text;
      v_body  := 'You bought ' || trim(substring(NEW.description from 17)) ||
                 ' for ৳' || v_formatted_amount || '.' || v_balance_str;
    ELSIF NEW.description LIKE 'DPS%' OR NEW.reference LIKE 'DPS-%' THEN
      v_title := 'DPS Installment ৳' || NEW.amount::text;
      v_body  := '৳' || v_formatted_amount || ' paid to your DPS plan.' || v_balance_str;
    ELSIF NEW.description LIKE 'Loan Repayment%' OR NEW.reference LIKE 'LOAN-%' THEN
      v_title := 'Loan Repayment ৳' || NEW.amount::text;
      v_body  := '৳' || v_formatted_amount || ' repaid towards your loan.' || v_balance_str;
    ELSE
      -- Generic merchant payment with no name (rare) — use description if present
      v_title := 'Payment ৳' || NEW.amount::text;
      v_body  := 'Payment of ৳' || v_formatted_amount ||
                 COALESCE(' for ' || NULLIF(NEW.description,''), '') || '.' || v_balance_str;
    END IF;
  ELSE
    -- Real merchant payment with a recipient
    v_title := 'Payment ৳' || NEW.amount::text;
    v_body  := 'Payment of ৳' || v_formatted_amount || ' to ' || v_counterpart || '.' || v_balance_str;
  END IF;
```

Also apply the same "prefer `description`" idea to the `addmoney` branch for `Goal Withdrawal:` / `DPS Maturity Payout` (currently shows generic "Money Added") so the new payout flows we just shipped read cleanly.

### What user sees after fix

| Action | Old notification | New notification |
|---|---|---|
| Save ৳500 to Dream Bike | "Payment of ৳500 to Someone" | "৳500 added to **Dream Bike**." |
| Buy 2g gold | "Payment of ৳37,504 to Someone" | "You bought **2g 24k** for ৳37,504." |
| Buy 5 GRPH stock | "Payment of ৳1,928 to Someone" | "You bought **5x GRPH** for ৳1,928." |
| DPS installment | "Payment of ৳X to Someone" | "৳X paid to your DPS plan." |
| Goal withdraw | "৳X added to your wallet" | "৳X withdrawn from **Dream Bike** to wallet." |
| Real merchant pay | "Payment of ৳X to Rafiq Electronics" | unchanged ✅ |

### Files touched
- New migration — `CREATE OR REPLACE` of `notify_transaction_recipient()` with the description-aware `payment` + `addmoney` branches above.

### Out of scope
- No backfill of historical notifications (the two existing "to Someone" rows stay; users can clear them).
- No UI changes — `NotificationCenter` already renders `title`/`body` as-is.
- No SMS template changes (notify-recipient EF already gates on real recipient phone).

