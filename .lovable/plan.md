

## Problem

The "Become a Merchant" button is not visible on the Account page because the global feature toggle `account_become_merchant` is set to `is_enabled: false` in the database. The render condition checks `!isDisabled("account_become_merchant")` first, which evaluates to `false`, hiding the button regardless of the targeting config.

## Fix

Run a database migration to enable the toggle:

```sql
UPDATE global_feature_toggles 
SET is_enabled = true, updated_at = now() 
WHERE feature_key = 'account_become_merchant';
```

No code changes needed. The existing targeting system (`useMerchantApplyAccess`) will still control who actually sees the button based on mode/role/area/whitelist config. The global toggle just needs to be enabled so it doesn't block visibility entirely.

## Alternative

If the admin intentionally disabled it via the Global Toggles panel, they can re-enable it from the Admin Dashboard > Global Toggles section instead of a migration.

