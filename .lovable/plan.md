

## Redesign Merchant Add Bank Sheet — Dropdown, More Fields, Admin Bank List

### Overview
Redesign the `MerchantAddBankSheet` component in `src/pages/MerchantDashboard.tsx` with a clean, airy UI featuring a searchable dropdown for bank selection (sourced from a new `platform_banks` table), additional fields (account holder name, branch, save checkbox), and an admin panel to manage the bank list.

### Database Changes

**Migration 1 — Add columns to `merchants` table:**
```sql
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_branch text;
```

**Migration 2 — Create `platform_banks` table (admin-managed bank list):**
```sql
CREATE TABLE platform_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_code text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE platform_banks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active banks
CREATE POLICY "Anyone can read active banks" ON platform_banks
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins manage banks" ON platform_banks
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

**Seed all Bangladeshi banks** from `BANGLADESH_BANKS` list into `platform_banks`.

### UI Changes — `MerchantAddBankSheet` (lines 2434-2514)

Replace the hardcoded 10-bank chip grid with:

1. **Header** — Same icon + title but with more vertical spacing for an airy feel
2. **Bank Name** — Searchable dropdown (Popover + Command pattern from shadcn) that fetches from `platform_banks`. Shows bank name + short code. Filterable by typing.
3. **Account Holder Name** — New text Input field (required)
4. **Account Number** — Existing field, kept as-is with numeric input
5. **Branch Name** — New optional text Input field
6. **Routing Number** — Existing optional field
7. **Save for faster settlement** — Checkbox (always checked for merchants, informational)
8. **Info banner** — 1% fee notice (existing, refined styling)
9. **Link Bank Account** button — Gradient CTA

All fields use consistent `space-y-5` gap, `rounded-xl` inputs with `h-12`, subtle label styling (`text-xs font-medium text-muted-foreground uppercase tracking-wide`).

### UI Changes — `MerchantInfo` interface (line 43)

Add `bank_account_holder` and `bank_branch` to the type.

### Update save handler

Save `bank_account_holder` and `bank_branch` to the `merchants` table alongside existing fields.

### Admin Panel — New `AdminBankListManager` section

Add a simple bank list manager in the Admin Dashboard (under System or a new sub-tab) allowing:
- View all banks from `platform_banks`
- Add new bank (name + short_code)
- Toggle active/inactive
- Delete bank

This will be added as a small section inside `AdminSystemSettings.tsx` or as a standalone component rendered in the admin layout.

### New hook — `usePlatformBanks`

Small hook to fetch active banks from `platform_banks` for use in the merchant sheet and potentially elsewhere.

### Files Modified
- `src/pages/MerchantDashboard.tsx` — Redesign `MerchantAddBankSheet`, update `MerchantInfo` type, update save handler
- `src/hooks/use-platform-banks.ts` — New hook to fetch bank list
- `src/components/admin/AdminBankListManager.tsx` — New admin component for managing banks
- `src/pages/AdminDashboard.tsx` — Wire in the bank list manager
- Database migration — Add columns + create `platform_banks` table with seed data

