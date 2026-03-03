

## Audit: User App Feature Issues and Fixes

After thorough review of the codebase, here are the issues found and the plan to fix them.

---

### Issue 1: `mfs_registered_phone` localStorage key is never set

**Impact**: BalanceCard shows "My Wallet" instead of the user's masked phone number. SideNav shows "—" for phone. AccountPage shows empty phone.

**Root cause**: AuthPage sets `mfs_device_phone` on signup/login, but BalanceCard, SideNav, and AccountPage read `mfs_registered_phone` which is never written.

**Fix**: In `AuthPage.tsx`, after storing `mfs_device_phone`, also store the same phone under `mfs_registered_phone`:
```typescript
localStorage.setItem("mfs_registered_phone", phone);
```

---

### Issue 2: SavingsFlow uses deprecated `deductBalance` (no-op)

**Impact**: Saving to a goal appears to succeed (toast, UI updates) but **no balance is actually deducted**. The function is a no-op that only logs a console warning.

**Fix**: SavingsFlow needs to call `recordTransaction()` RPC instead. However, "savings" is not a valid transaction type in the database enum. Two options:
- Use type `"payment"` with a description like "Savings: Emergency Fund"
- Or keep savings as a local-only feature (no real deduction) with a clear "Coming Soon" label

Since savings goals are stored purely in component state (not persisted to DB), the most honest fix is to add a "Coming Soon" badge and disable actual deductions until a proper savings table is created.

---

### Issue 3: BalanceCard and SideNav don't show real user data from profile

**Impact**: Display name comes from `localStorage` which may be stale or empty. The profile name stored in the `profiles` table via Supabase is not being used.

**Fix**: Update BalanceCard and SideNav to fetch the user's name and phone from the `profiles` table (or from `useAuth` hook's user metadata) instead of relying solely on localStorage.

---

### Issue 4: Console warning — Badge component ref issue in AdminDashboard

**Impact**: Non-breaking warning, but indicates a `Badge` component is being passed a ref without `forwardRef`.

**Fix**: Wrap the `Badge` component in `React.forwardRef` in `src/components/ui/badge.tsx`.

---

### Issue 5: ShopFlow imports unused `addBalance`

**Impact**: No functional issue (it's not called), but it's dead code.

**Fix**: Remove `addBalance` from the import in `ShopFlow.tsx`.

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/pages/AuthPage.tsx` | Set `mfs_registered_phone` in localStorage on signup/login |
| `src/components/SavingsFlow.tsx` | Replace deprecated `deductBalance` with `recordTransaction` or mark as "Coming Soon" |
| `src/components/BalanceCard.tsx` | Fetch display name from profile DB instead of only localStorage |
| `src/components/SideNav.tsx` | Fetch display name/phone from profile DB |
| `src/components/ui/badge.tsx` | Add `forwardRef` to fix console warning |
| `src/components/ShopFlow.tsx` | Remove unused `addBalance` import |

### No database changes needed
All fixes are frontend-only code changes.

