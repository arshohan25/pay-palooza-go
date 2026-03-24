

## Phase 2 & 3: Security Center CRUD + Financial Operations Enhancements

### Current State Assessment

After reviewing all files, many sections already have substantial CRUD. Here are the **actual gaps**:

---

### Phase 2: Security Center & System Settings

**File: `src/components/admin/AdminSecurityCenter.tsx`** (242 lines → ~500 lines)

Current state: All 4 tabs are read-only.

Changes:
1. **Sessions tab** — Add "Terminate" button per session row. Inserts an audit log entry and deletes the session record. Add "Terminate All" button to force-logout all non-admin users by clearing their sessions.
2. **Devices tab** — Add "Revoke" (delete) button per device with AlertDialog confirmation. Add "Block User" button that sets profile status to `suspended`. Add search + bulk revoke for multi-device users.
3. **IP Whitelist tab** — Add "Add IP" dialog (IP address, label, merchant selector). Add delete button per entry. Add edit (inline label change).
4. **2FA tab** — Add "Force Remove Device" button per user to revoke their device registration. Add "Lock Account" button with duration selector (1h, 24h, 7d, permanent) that sets profile status to `suspended` + audit log.

**File: `src/components/admin/AdminSystemSettings.tsx`** (523 lines → ~620 lines)

Changes:
1. **AppConfig tab** — Make platform info editable: Add pencil icons next to App Name, Version, Support Phone, Support Email. Values saved to `global_feature_toggles` as config keys (e.g. `app_name`, `app_version`, `support_phone`). Add "Save" button.
2. **CurrencyConfig tab** — Make exchange rates editable with inline inputs + save. Add min/max transaction amount fields saved to config.
3. **Maintenance tab** — Add scheduled maintenance with date/time picker and custom message textarea (stored as toggle metadata).

---

### Phase 3: Financial Operations

**File: `src/components/admin/AdminCommissionSetup.tsx`** (580 lines → ~610 lines)

Changes:
1. **Rules tab** — Add delete button (Trash2 icon) per commission rule row with confirmation.
2. **Tiers tab** — Add delete button per tier row with confirmation. Both deletions include audit logging.

**File: `src/components/admin/AdminFloatManagement.tsx`** (256 lines → ~400 lines)

Current state: All 4 tabs are read-only displays.

Changes:
1. **Agent Float tab** — Add "Allocate Float" and "Deduct Float" buttons per agent. Opens dialog with amount + reason. Updates agent's `max_float` and inserts audit log.
2. **Merchant Float tab** — Add "Adjust Float" button per merchant. Dialog to add/deduct from balance with reason + audit trail.
3. **Gateway Float tab** — Add "Enable/Disable" toggle per gateway. Add inline edit for gateway display name.

**Files already complete (no changes needed):**
- `AdminLimitManager.tsx` — Already has full CRUD: global defaults edit, user overrides with create/edit/delete, bulk actions, merchant limits, audit trail.
- `AdminDepositAccounts.tsx` — Already has full CRUD: add, edit, delete, toggle active.
- `AdminSettlements.tsx` — Already has create, status workflow (pending→processing→completed/failed), CSV export, realtime updates.
- `AdminTreasury.tsx` — Already has manual disbursement with PIN verification, ledger view, PDF export (622 lines of functionality).

---

### Technical Pattern (all sections)
- Every destructive action wrapped in AlertDialog confirmation
- Every mutation inserts `audit_logs` record with `actor_id`, `action`, `entity_type`, `entity_id`, `details`
- Toast feedback on success/error
- List auto-refreshes after mutation

### Files Modified
1. `src/components/admin/AdminSecurityCenter.tsx`
2. `src/components/admin/AdminSystemSettings.tsx`
3. `src/components/admin/AdminCommissionSetup.tsx`
4. `src/components/admin/AdminFloatManagement.tsx`

### Database Changes
None — all tables already exist with required columns.

