

## Plan: Fix Merchant Account Creation Access

### Issues Identified
1. **"Become a Merchant" option is buried** — It only exists deep in Account Page settings. Users may not discover it. It should also be accessible from more prominent locations (e.g., the More sheet or home page).
2. **No admin "Create Merchant" button** — After the application system was added, admins lost the ability to directly create a merchant account without an application. The Merchants sub-tab has no "Add Merchant" action.

### Changes

**1. Add "Become a Merchant" to the More Sheet (`src/components/MoreSheet.tsx`)**
- Add a `Store` icon menu item "Become a Merchant" visible to non-merchant users
- Opens the existing `MerchantApplicationFlow` sheet
- Import `useUserRoles` to check if user already has `merchant` role

**2. Add "Create Merchant" button for admins (`src/components/admin/AdminMerchantManagement.tsx`)**
- Add a `+ Create Merchant` button in the Merchants sub-tab header
- Opens a dialog/sheet with a form: search user by phone, enter business name, category, bank details
- On submit: inserts into `merchants` table, assigns `merchant` role in `user_roles`, sends notification
- This lets admins bypass the application flow when needed

| File | Action |
|------|--------|
| `src/components/MoreSheet.tsx` | Add "Become a Merchant" menu item |
| `src/components/admin/AdminMerchantManagement.tsx` | Add "Create Merchant" button + form in Merchants tab |

