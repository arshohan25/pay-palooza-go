

# Add KYC Status Column to Admin User Management Table

## Problem
The admin user table shows Name, Phone, Balance, and Status — but no KYC verification status. Admins must open individual user details to check KYC.

## Changes

### 1. `src/hooks/use-admin.ts` — `fetchAllUsers()`
- After fetching profiles, also fetch `kyc_verifications` table: `select("user_id, status").in("user_id", userIds)`
- Build a `kycMap: Map<string, string>` (user_id → status like "verified", "pending", "rejected")
- Attach `kyc_status` to each user object before returning
- Also check `kyc_exempt` field from profiles (already in `select("*")`)

### 2. `src/pages/AdminDashboard.tsx` — Desktop table
- Add a new `<th>KYC</th>` column header between "Balance" and "Status" (line ~1261)
- Add a `<td>` rendering a color-coded Badge:
  - **Verified** → green badge (✓ Verified)
  - **Exempt** → blue badge (Exempt)
  - **Pending** → yellow badge (Pending)
  - **Rejected** → red badge (Rejected)
  - **None** → gray badge (Not Started)

### 3. `src/pages/AdminDashboard.tsx` — Mobile card layout
- Add a KYC badge next to the existing status badge in the mobile card header area

### 4. `src/hooks/use-admin.ts` — `exportUsersCSV()`
- Add "KYC Status" column to the CSV export

## Files Changed
- `src/hooks/use-admin.ts` — fetch KYC status alongside profiles, add to CSV export
- `src/pages/AdminDashboard.tsx` — add KYC column to desktop table and mobile cards

