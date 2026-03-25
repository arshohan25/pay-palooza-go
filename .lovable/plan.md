

## Plan: Add Full API Key Management to the API Requests Tab

### Problem
The "API Requests" tab only shows incoming access requests from merchants. There is no way to:
- View all active/revoked API keys across merchants
- Generate a new API key for a merchant directly
- Revoke keys from this view
- Copy/share credentials

API key management is currently buried inside individual merchant detail sheets.

### Solution
Enhance `AdminApiRequests.tsx` to add a second sub-tab: **"API Keys"** alongside the existing **"Requests"** view, providing full key management.

### Changes to `AdminApiRequests.tsx`

**1. Add internal sub-tabs: "Requests" | "API Keys"**
- Use the standard segmented control pattern (brand-colored active state)
- Default to "Requests" (current behavior preserved)

**2. New "API Keys" sub-tab content:**
- Fetch all records from `merchant_api_keys` joined with merchant names
- Summary cards: Total Keys, Active, Revoked
- Search by merchant name or API key prefix
- Table columns: Merchant, API Key (masked, copyable), Status (Active/Revoked), Webhook URL, Created Date, Actions
- Actions per key: Copy API Key, Copy Secret (if just generated), Revoke (with confirmation), Toggle Active/Inactive
- **"Generate Key" button** in header: opens a dialog to select a merchant and generate a new key pair

**3. Generate Key dialog:**
- Merchant selector (dropdown of active merchants)
- Optional webhook URL input
- On submit: generates `epk_`, `eps_`, `epp_` credentials, inserts into `merchant_api_keys`, shows secret once

**4. Move Search + Refresh to header row (top right)**
- Consolidate with the existing Refresh button per the admin UI pattern

### Layout
```text
┌─ API Access Requests ──────────────── [Search] [+ Generate Key] [Refresh] ┐
│                                                                            │
│  [Requests] [API Keys]  ← segmented control                               │
│                                                                            │
│  (Requests tab: existing content)                                          │
│  (API Keys tab: keys table with management)                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Files
- `src/components/admin/AdminApiRequests.tsx` — sole file modified

