# Custom Permission Presets for Merchant Staff

Today merchant owners can only apply 3 hardcoded role presets (Manager / Cashier / Viewer) when inviting or editing staff. We'll let them save their own named presets (e.g. "Night Cashier", "Inventory Helper") that appear right next to the built-ins.

## What the merchant will see

In the **Staff** tab, inside the permission picker (used by both Add Staff and Edit Permissions sheets):

1. The existing "Role preset" dropdown becomes a unified preset picker showing:
   - Built-in: Manager, Cashier, Viewer
   - Custom: any presets they've saved (with a small "Custom" badge)
2. New **"Save as preset"** button next to the checkbox grid:
   - Opens a small inline input → name the preset → saves the current checked permissions
3. Each custom preset row gets a **rename** and **delete** action (trash icon)
4. The "Role Presets" summary card at the top of the Staff tab lists custom presets too with their feature count

## Technical design

### Database (new table)
```sql
create table public.merchant_permission_presets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid not null,         -- owner user_id
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (merchant_id, name)
);
alter table public.merchant_permission_presets enable row level security;
```

RLS: only the **store owner** of `merchant_id` can select/insert/update/delete. Staff members cannot read or modify presets (they'd just see the resolved permissions on themselves). Reuse existing owner-check pattern (`merchants.user_id = auth.uid()`).

A `BEFORE INSERT/UPDATE` trigger strips owner-only keys (`staff_manage`, `api_access`) and any unknown keys — same hygiene used by `validate_merchant_staff_permissions`.

### Frontend

**`src/hooks/use-permission-presets.ts`** (new)
- `usePermissionPresets(merchantId)` → `{ presets, save(name, perms), rename(id, name), remove(id), loading }`
- React Query keyed on merchantId; invalidates on mutation
- Realtime subscribe to `merchant_permission_presets` filtered by merchant_id so multi-device owners stay in sync (same pattern as other merchant tabs)

**`src/lib/staffPermissions.ts`** (extend)
- Add `CustomPreset = { id: string; name: string; permissions: Record<string, boolean> }`
- Add `applyPreset(perms)` helper that runs through `expandImplies`

**`src/components/merchant/MerchantStaffTab.tsx`** (edit)
- `PermissionPicker` component receives `customPresets` + `onSavePreset` props
- Replace the simple "Reset to {role} preset" button with a `<Select>` listing built-ins + custom, plus a "Save current as preset…" item that opens a name input
- Add inline manage row (rename / delete) for the currently-selected custom preset
- The top "Role Presets" summary card maps over `[...builtIns, ...customPresets]`

### Out of scope (keep it tight)
- Sharing presets across merchants
- Versioning / history of preset edits
- Auto-applying a preset to all existing staff with a given role (would risk silent permission changes)

## Files to create / edit

- New migration: `merchant_permission_presets` table + RLS + validation trigger
- New: `src/hooks/use-permission-presets.ts`
- Edit: `src/lib/staffPermissions.ts` (types + helper)
- Edit: `src/components/merchant/MerchantStaffTab.tsx` (UI integration)

## Memory updates after build

Add a short note under the staff/permissions area of project memory describing the custom-preset table and that only the store owner can manage them.
