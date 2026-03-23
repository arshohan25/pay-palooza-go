

## Admin Profile Editor — Full Edit Access for All User Types

### Summary
Create a new `AdminProfileEditor` component that lets admins edit **any** user's profile fields (name, phone, email, avatar) and role-specific fields (agent business_name, merchant business_name, distributor business_name, etc.). This editor will be accessible from the existing User Detail sheet via a new "Edit Profile" button.

### No Database Migration Needed
All the fields (name, phone, email, avatar_url on `profiles`; business_name, nid_number, territory_code, trade_license on `agents`; business_name, category, bank details on `merchants`; business_name, territory on `distributors`) already exist. RLS policies with admin `has_role()` checks are already in place.

### New Component: `src/components/admin/AdminProfileEditor.tsx`

A dialog/sheet with editable fields organized by section:

**Profile Section** (always shown):
- Name (text input)
- Phone (text input)
- Email (text input)
- Avatar URL (text input)

**Agent Section** (shown if user has agent record):
- Business Name, NID Number, Territory Code, Trade License, Max Float

**Merchant Section** (shown if user has merchant record):
- Business Name, Category, MDR Rate, Settlement Frequency
- Bank Name, Bank Account Holder, Bank Account Number, Bank Branch, Bank Routing, Trade License

**Distributor Section** (shown if user has distributor record):
- Business Name, Commission Rate, Max Float, Territory

Props: `userId`, `onClose`, `onSaved` callback

**Logic:**
1. On open: fetch profile + check if user has agent/merchant/distributor records
2. Display editable form fields for each section that exists
3. On save: update `profiles` table + relevant entity tables, create audit_log entry, fire toast
4. All updates audited with before/after values

### Changes to `src/pages/AdminDashboard.tsx`

1. Import `AdminProfileEditor`
2. Add state: `editingUserId: string | null`
3. Add an **"Edit"** button next to the existing "View" button in the user detail sheet header
4. Render `<AdminProfileEditor>` dialog when `editingUserId` is set
5. On save callback: refresh user list + detail data

### Files Modified
1. `src/components/admin/AdminProfileEditor.tsx` — new file
2. `src/pages/AdminDashboard.tsx` — add Edit button + editor state + import

