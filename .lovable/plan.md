

## Plan: Admin KYC Exemption for Specific Users

### Problem
Currently, `FeatureGuard` blocks all transaction features for users without verified KYC. Admins need the ability to exempt specific users from this requirement.

### Approach
Add a `kyc_exempt` boolean column to the `profiles` table. Admin can toggle it per user. The `FeatureGuard` and `useKycStatus` hook will respect this flag, treating exempt users as if they have verified KYC.

### Database Changes
1. **Migration**: Add `kyc_exempt` column to `profiles` table:
```sql
ALTER TABLE public.profiles ADD COLUMN kyc_exempt boolean NOT NULL DEFAULT false;
```

### Code Changes

1. **`src/hooks/use-kyc-status.ts`** — Also fetch `kyc_exempt` from the user's profile. If `kyc_exempt = true`, return status as `"verified"` regardless of actual KYC status. This makes the exemption transparent to all consumers (FeatureGuard, KYC banners, etc.).

2. **`src/pages/AdminDashboard.tsx`** (or the user management section) — Add a toggle/switch in the admin user detail view to set `kyc_exempt` on a per-user basis. This will be a simple profile update.

3. **Admin UI for toggling** — In the existing admin user list/detail area, add a "KYC Exempt" toggle that calls `supabase.from("profiles").update({ kyc_exempt: true/false }).eq("user_id", targetId)`. Since admins use the `has_role` policy and the `protect_profile_fields` trigger only guards balance/phone/status, this column will be updatable by admins.

### Files Modified
- `src/hooks/use-kyc-status.ts` — Check `kyc_exempt` flag from profiles
- `src/pages/AdminDashboard.tsx` or admin user detail component — Add KYC exempt toggle UI
- Database migration — Add `kyc_exempt` column

