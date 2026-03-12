

## Admin Temporary PIN Reset

When a user contacts support because they forgot their PIN or got locked out, an admin can issue a temporary PIN directly from the User Details sheet.

### How It Works

1. Admin opens User Details sheet, clicks "Reset PIN"
2. A dialog appears with the user's phone pre-filled and a generated random 4-digit temporary PIN (admin can change it)
3. Admin confirms — the system resets the user's password server-side via an Edge Function using the admin API
4. Admin communicates the temporary PIN to the user (via support chat or phone)
5. The action is recorded in the audit log

### Changes

**1. New Edge Function: `supabase/functions/admin-reset-pin/index.ts`**
- Accepts `{ targetUserId, tempPin }` in the request body
- Validates the caller is an admin (JWT + `has_role` check via service role query)
- Validates `tempPin` is 4 digits
- Uses `supabaseAdmin.auth.admin.updateUserById()` to set the new password (`pinToPassword(tempPin)`)
- Returns success/error

**2. `supabase/config.toml`** — add `verify_jwt = false` for the new function (JWT validated in code)

**3. `src/pages/AdminDashboard.tsx`** — Add to User Detail Sheet
- Add a "Reset PIN" button (with `RotateCcw` icon) in the user detail drawer, after the KYC section
- On click, opens an `AlertDialog` with:
  - User name/phone displayed
  - Auto-generated 4-digit temp PIN (editable input)
  - Confirm button that calls the edge function
- On success: toast with the temp PIN, audit log entry recorded server-side
- State: `resetPinTarget` (user info), `tempPin` (string), `resettingPin` (boolean)

### Security
- Edge function verifies admin role server-side via `user_roles` table query
- Audit log records who reset whose PIN and when
- No client-side role checks — all validated on the backend

