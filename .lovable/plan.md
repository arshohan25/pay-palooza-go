

## Plan: Credit Deleted User's Balance to Treasury

When a user account is permanently deleted (via admin hard-delete or auto-purge), their remaining balance should be credited to the platform treasury before data cleanup.

### Changes

**1. `supabase/functions/delete-user/index.ts`**
- After fetching `targetProfile` (which already includes `balance`), before the cascading table deletes:
  - If `targetProfile.balance > 0`, credit it to `platform_treasury` (update balance, increment total_earnings)
  - Insert a `treasury_ledger` entry with type `'earning'`, description like `"Recovered balance from deleted user account"`, and the user's ID as `counterparty_user_id`
- Include `balance_recovered` in the audit log details and response

**2. `supabase/functions/auto-purge-deactivated/index.ts`**
- Same logic: before cascading deletes for each expired user, if `user.balance > 0`:
  - Credit balance to `platform_treasury`
  - Insert `treasury_ledger` entry
- Include recovered balance in the audit log details

### Flow
```text
User deletion triggered
  → Fetch user profile (balance already selected)
  → If balance > 0:
      → Lock platform_treasury row (SELECT ... FOR UPDATE via service role)
      → UPDATE platform_treasury SET balance = balance + user_balance
      → INSERT treasury_ledger (type: 'earning', amount, description)
  → Proceed with existing cascading deletes
  → Delete auth user
```

### No database changes needed
The `platform_treasury` and `treasury_ledger` tables already exist with the required columns. The edge functions use the service role key which bypasses RLS.

