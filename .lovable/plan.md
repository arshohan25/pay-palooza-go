

## Device Permissions System + Admin Permissions Dashboard

### Overview

Build a centralized permission management system that requests and tracks device permissions (Contacts, SMS/OTP auto-read, Camera, Location) on first use, and add an admin panel tab to monitor per-user permission grant status.

### User-Side: Permission Manager

**New file: `src/lib/permissions.ts`**
- Create a unified permissions helper with functions for each permission type:
  - **Contacts**: Use the Contact Picker API (`navigator.contacts.select()`) to let users pick contacts for Send Money / Recharge flows. Falls back gracefully if unsupported.
  - **SMS/OTP Auto-Read**: Use the Web OTP API (`navigator.credentials.get({ otp: { transport: ['sms'] } })`) for auto-reading OTP codes during verification. Falls back to manual entry.
  - **Camera**: Use `navigator.mediaDevices.getUserMedia({ video: true })` for QR scanner (replace mock scanner with real camera feed).
  - **Location**: Use `navigator.geolocation.getCurrentPosition()` to capture user location for fraud detection and transaction metadata.
- Each function checks current permission state via `navigator.permissions.query()` where supported, requests if needed, and returns a status object.
- Store granted permissions in `localStorage` as a cache, and also persist to a new database table.

**New file: `src/components/PermissionGate.tsx`**
- A reusable component that wraps features requiring permissions. On first access, shows a bottom sheet explaining why the permission is needed with "Allow" / "Not Now" buttons.
- Permission types: `contacts`, `camera`, `location`, `sms_read`

**New database table: `user_permissions`**
- Columns: `id`, `user_id`, `permission` (text: contacts/camera/location/sms_read), `status` (granted/denied/prompt), `device_info` (jsonb), `granted_at`, `updated_at`
- RLS: Users can insert/update own rows; admins can read all.

### Integration Points

1. **Send Money / Recharge flows** — Add a "Pick from Contacts" button that triggers the Contact Picker API via `PermissionGate`
2. **QR Scanner (`QrScannerModal.tsx`)** — Replace mock scanner with real `getUserMedia` camera access via `PermissionGate`
3. **OTP verification flows** — Integrate Web OTP API for auto-read during PIN reset and registration
4. **Transaction flows** — Silently request location and attach coordinates to transaction metadata for fraud detection

### Admin Panel: Permissions Tab

**New file: `src/components/admin/AdminPermissions.tsx`**
- Table showing all users with columns: Name, Phone, Contacts (granted/denied/--), Camera, Location, SMS Read, Last Updated
- Color-coded badges: green for granted, red for denied, grey for not-requested
- Summary stats at top: "X users granted camera", "Y users granted location", etc.
- Search/filter by user name/phone
- Export capability

**Admin Dashboard changes (`AdminDashboard.tsx`)**
- Add `{ id: "permissions", label: "Permissions", icon: Shield }` to `NAV_ITEMS`
- Add the tab content rendering `<AdminPermissions />`

### Database Migration

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prompt',
  device_info JSONB DEFAULT '{}',
  granted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
-- Users can upsert own permissions
-- Admins can read all
```

### Files to Create/Modify

- **New**: `src/lib/permissions.ts` — permission request helpers
- **New**: `src/components/PermissionGate.tsx` — UI wrapper for permission requests
- **New**: `src/components/admin/AdminPermissions.tsx` — admin permissions dashboard
- **New**: Migration SQL for `user_permissions` table
- **Modify**: `src/components/QrScannerModal.tsx` — real camera integration
- **Modify**: `src/components/SendMoneyFlow.tsx` — contact picker button
- **Modify**: `src/components/MobileRechargeFlow.tsx` — contact picker button
- **Modify**: `src/pages/AdminDashboard.tsx` — add Permissions nav item and tab

### Technical Notes

- Contact Picker API and Web OTP API have limited browser support (Chrome Android primarily). All features gracefully degrade with manual fallbacks.
- Camera permission is well-supported across all modern browsers.
- Location uses the standard Geolocation API with high accuracy option for fraud detection.
- Permission status is synced to the database on each grant/deny so admins have visibility.

