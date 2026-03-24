

## Full Admin CRUD Overhaul — Phased Plan

This is a very large effort spanning 90+ admin sections. I'll break it into manageable phases, each batch adding full CRUD (Create, Edit, Delete, Suspend, Hold) across related sections. Only the main admin (with `admin` role verified via `has_role()`) can perform these actions.

---

### Phase 1: Network Management (Agent Hub, Distributors, Merchants)

**Distributor Management** — currently view + suspend only. Add:
- "Create Distributor" dialog (phone, business name, territory, commission rate, max float)
- Inline edit for commission_rate, max_float, territory
- Delete/deactivate distributor
- Edit linked agents assignment

**Agent Hub** — already has create + suspend. Add:
- Inline edit for agent details (business_name, territory, max_float, NID, trade license)
- Delete agent (with confirmation)
- Temporary hold (new status) vs permanent suspend
- Bulk actions (suspend/activate multiple)

**Merchant Management** — already robust. Add:
- "Create Merchant" dialog (bypass application flow)
- Delete merchant
- Temporary hold status

---

### Phase 2: Security & System Settings

**Security Center** — currently read-only lists. Add:
- Force-terminate sessions
- Revoke/block devices
- Add/remove IP whitelist entries (CRUD)
- Enable/disable 2FA for users
- Temporary account lock with duration

**System Settings** — partially done (fee rules, txn rules). Add:
- Currency config editable (currency symbol, decimals, formatting)
- Maintenance mode with custom message + scheduled time
- App config tab: edit app name, logo URL, support contacts

---

### Phase 3: Financial Operations

**Commission Setup** — add edit/delete for commission tiers
**Limits Manager** — add create/edit/delete custom limit rules
**Treasury** — add manual adjustment with audit trail
**Float Management** — add float allocation/deallocation actions
**Deposit Accounts** — full CRUD for platform bank accounts
**Settlements** — manual settlement trigger + edit settlement config

---

### Phase 4: Services & E-Commerce

**Loans** — already has approve/reject. Add: create loan offer, edit terms, delete
**Insurance** — add: create policy, edit coverage, cancel with refund
**Gift Cards** — add: issue new cards, edit denomination, bulk generate
**Savings** — add: create savings plans, edit interest rates
**Donations** — add: create/edit/delete causes
**E-Commerce Hub** — add: manage categories, edit platform fees, CRUD delivery zones/courier providers

---

### Phase 5: Marketing & Communications

**Banners** — full CRUD (create/edit/delete/reorder)
**Announcements** — full CRUD with scheduling
**Loyalty Points** — create/edit rules, manual point adjustments
**Festival Themes** — CRUD themes with preview
**Changelog** — CRUD entries
**Notification Sender** — already functional, add templates CRUD

---

### Phase 6: Permission Gating (Main Admin Only)

- Add a `super_admin` or use existing `admin` role check on all destructive actions
- "Grant Admin Access" dialog — main admin can grant/revoke admin privileges to team members
- Per-section permission toggles (which team members can access which sections)
- All destructive actions (delete, suspend, hold) require confirmation dialog + audit log entry

---

### Implementation Approach

Each phase modifies 3-6 component files. The pattern for each section:
1. Add "Create" button + Dialog with form fields
2. Add inline Edit (pencil icon → input fields → save)
3. Add Delete with confirmation AlertDialog
4. Add status management (active/suspended/hold)
5. All mutations go through Supabase with audit logging
6. Toast feedback on every action

**Starting with Phase 1** (Distributors + Agent Hub enhancements + Merchant create) as these are the most impactful network management gaps.

### Files Modified in Phase 1
1. `src/components/admin/AdminDistributorManagement.tsx` — add Create, Edit, Delete dialogs
2. `src/components/admin/AdminAgentHub.tsx` — add Edit, Delete, Hold, Bulk actions
3. `src/components/admin/AdminMerchantManagement.tsx` — add Create Merchant dialog

### Database Changes (Phase 1)
None needed — all tables (`distributors`, `agents`, `merchants`, `profiles`, `user_roles`) already exist with the required columns. Status field already supports the needed values.

Shall I proceed with Phase 1?

