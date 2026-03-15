

## Problem

The database trigger `handle_new_user` that auto-creates profiles only strips the old `@easypay.local` domain from synthetic emails. After the domain was changed to `easypay.app`, the trigger stores the full email (e.g. `01478096325@easypay.app`) as the phone number. This causes:
- Display name showing `+88 014****app` (masking grabs last 3 chars of email suffix)
- Full synthetic email shown on the account page

## Fix

Two changes needed:

### 1. Update the database trigger
Modify `handle_new_user` to strip `@easypay.app` and `@example.com` in addition to the legacy `@easypay.local`:

```sql
IF v_phone = '' AND NEW.email IS NOT NULL THEN
  v_phone := regexp_replace(NEW.email, '@(easypay\.app|easypay\.local|example\.com|team\.easypay\.app)$', '');
END IF;
```

### 2. Fix existing corrupted data
Run a one-time migration to clean the affected profile row:

```sql
UPDATE profiles
SET phone = regexp_replace(phone, '@(easypay\.app|easypay\.local|example\.com)$', '')
WHERE phone LIKE '%@easypay.app' OR phone LIKE '%@easypay.local' OR phone LIKE '%@example.com';
```

No frontend code changes needed — the `useProfile` hook and `AccountPage` already work correctly when the phone field contains just digits.

