## Manager Invitation Flow

The `merchant_staff` table, `Add Staff` sheet, role-gated `merchant-login` edge function, and `get_staff_merchant_access` RPC are already wired up. A merchant owner can already add a staff row with `role=Manager` and the existing trigger links `user_id` from `profiles.phone`. The invited user can already log in via the Manager toggle on `/merchant-login` using their own PIN.

What's missing is **invitee discoverability and reliability**. This plan closes those gaps.

### 1. Auto-link on future signup (DB)

Add a trigger on `public.profiles` INSERT/UPDATE of `phone`: any `merchant_staff` row whose `phone` matches gets `user_id` populated automatically. This handles the case where the owner adds a phone *before* the person signs up.

### 2. Notify the invitee (DB)

Extend the existing `resolve_staff_user` trigger so that when a `user_id` resolves on insert/update (i.e., the staff row becomes "Linked"), it inserts a row into `public.notifications` for that user:
- Title: `You're now a Manager at {business_name}` (Cashier/Viewer for those roles)
- Body: `Use Merchant Manager login on the Merchant Login page with your PIN.`
- Category: `system`

Same notification fires from the new profiles trigger so retroactive links also notify.

### 3. Live phone lookup in Add Staff sheet (UI)

In `MerchantStaffTab.tsx` Add Staff sheet, debounce the phone field and call a new lightweight RPC `lookup_easypay_user_by_phone(p_phone text)` returning `{ exists: boolean, full_name: text | null }` (SECURITY DEFINER, restricted to authenticated, returns minimal info — no user_id leak).

Show a small inline status under the phone input:
- `✓ On EasyPay — {name}. They'll get instant access.`
- `⚠ Not on EasyPay yet. They'll be linked automatically when they sign up.`

### 4. Pre-fill name when found (UI)

If lookup returns a name and the Name field is empty, auto-fill it.

### 5. Resend invite action (UI)

Add a small "Notify" icon button on each unlinked staff row that triggers a "still waiting" notification once the user has signed up later (no-op if not yet linked — toast: "User hasn't joined EasyPay yet").

### Technical Details

**Migration** (`supabase/migrations/<new>.sql`):
- `CREATE OR REPLACE FUNCTION public.backfill_staff_user_on_profile()` — on profiles insert/update of phone, `UPDATE merchant_staff SET user_id=NEW.user_id WHERE phone normalized = NEW.phone normalized AND user_id IS NULL`. Inserts a notification per linked row.
- Trigger `trg_backfill_staff_user_on_profile AFTER INSERT OR UPDATE OF phone ON public.profiles`.
- Update `resolve_staff_user()` to also INSERT a notifications row when `NEW.user_id` is non-null and changed.
- `CREATE OR REPLACE FUNCTION public.lookup_easypay_user_by_phone(p_phone text) RETURNS TABLE(exists boolean, full_name text)` — SECURITY DEFINER, normalizes phone, returns existence + name only. `GRANT EXECUTE TO authenticated`.

**Frontend** (`src/components/merchant/MerchantStaffTab.tsx`):
- Add `phoneStatus` state + 400ms debounced effect calling `supabase.rpc('lookup_easypay_user_by_phone', { p_phone })`.
- Render status pill below the phone input.
- Auto-fill `name` when found and field is empty.
- Default `role` selection in the sheet stays `Cashier` but add a tiny helper line: "Pick **Manager** to grant full dashboard access."

**No changes needed** to:
- `merchant-login` edge function (already gates by role).
- `MerchantLoginPage.tsx` (Manager toggle already wired).
- `useStaffAccess` hook (already drives dashboard access).

### Files to be edited

- `supabase/migrations/<timestamp>_manager_invite_flow.sql` (new)
- `src/components/merchant/MerchantStaffTab.tsx`
