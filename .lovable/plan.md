

## Plan: Create a Long-Lived Test Payment Session

The default `expires_at` on `merchant_payment_sessions` is `now() + 3 minutes`, which is too short for manual testing. I can't UPDATE via read-only tools. 

### Approach

**Database migration**: Change the default expiry from 3 minutes to 10 minutes so new sessions give enough testing time.

```sql
ALTER TABLE merchant_payment_sessions 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');
```

Then I'll invoke the merchant-payment-api edge function again to create a fresh session with the new 10-minute window. This gives you time to:
1. Navigate to the checkout URL
2. Enter phone + PIN on the login step
3. Review the confirm step with slide-to-pay
4. Complete payment and see the success animation

### Files Changed
- **Database migration**: Update `expires_at` default from 3 → 10 minutes
- No code file changes needed

After the migration, I'll create a new test session and provide the checkout URL.

