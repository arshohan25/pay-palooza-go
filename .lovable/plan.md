

## Phase 8: Financial, Risk & E-Commerce Operations — Full CRUD + Audit Logging

### Current State & Gaps

| Section | Lines | Has | Missing |
|---------|-------|-----|---------|
| **Fraud Auto Rules** | 256 | Create + Toggle + Delete | Edit rule, AlertDialog on delete, audit logging |
| **Fraud Alerts** | 625 | View + Status update + Assign + Escalate | Delete resolved alerts, audit logging on status/assign/escalate |
| **Flash Sales** | 160 | Create + Toggle + Delete | Edit sale (price/dates), AlertDialog on delete, audit logging |
| **Settlements** | 321 | Create + Status update + Export | Delete failed settlements, audit logging on create/status |
| **Commission Setup** | 602 | Full CRUD rules/tiers (partial audit) | Audit logging on create/edit/toggle (only delete has it) |
| **Risk Control** | 529 | View + Freeze agent (has audit) | Missing audit on other actions (unfreeze, velocity locks) |
| **AI Fraud Detection** | 378 | View + Lock wallet (has audit) | Missing audit on investigate action |
| **Return Requests** | 179 | View + Status update | Delete completed returns, audit logging on status changes |
| **Order Management** | 765 | Full CRUD + status updates + escrow | Audit logging on status changes, cancellations, bulk actions |
| **Bank Reconciliation** | 229 | Read-only analytics | No mutations needed — skip |

### Implementation

**File 1: `AdminFraudAutoRules.tsx`** (~256 → ~320 lines)
- Add "Edit" dialog (pre-filled name, metric, threshold, action, lock_duration)
- Wrap delete in AlertDialog confirmation
- Add audit logging to create/edit/delete/toggle actions

**File 2: `AdminFraudAlerts.tsx`** (~625 → ~660 lines)
- Add "Delete" for resolved/false_positive alerts with AlertDialog
- Add audit logging to status update, assign, escalate, delete actions

**File 3: `AdminFlashSales.tsx`** (~160 → ~230 lines)
- Add "Edit" dialog (sale_price, starts_at, ends_at)
- Wrap delete in AlertDialog confirmation
- Add audit logging to create/edit/delete/toggle actions

**File 4: `AdminSettlements.tsx`** (~321 → ~370 lines)
- Add "Delete" for failed settlements with AlertDialog
- Add audit logging to create/status update/delete actions

**File 5: `AdminCommissionSetup.tsx`** (~602 → ~630 lines)
- Add audit logging to rule create/edit/toggle and tier create/edit actions (delete already has it)

**File 6: `AdminReturnRequests.tsx`** (~179 → ~220 lines)
- Add "Delete" for completed returns with AlertDialog
- Add audit logging to status update/delete actions

**File 7: `AdminOrderManagement.tsx`** (~765 → ~800 lines)
- Add audit logging to order status changes, cancellations, and bulk actions

**File 8: `AdminAiFraudDetection.tsx`** (~378 → ~395 lines)
- Add audit logging to the investigate action

**File 9: `AdminRiskControl.tsx`** (~529 → ~550 lines)
- Standardize existing inline audit calls into shared `auditLog` helper pattern

### Technical Pattern (consistent across all files)
```typescript
async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details
    });
  }
}
```
- Every destructive action: AlertDialog confirmation
- Toast feedback on success/error
- List auto-refresh after mutation

### Database Changes
None — all tables exist with required columns.

### Files Modified
1. `src/components/admin/AdminFraudAutoRules.tsx`
2. `src/components/admin/AdminFraudAlerts.tsx`
3. `src/components/admin/AdminFlashSales.tsx`
4. `src/components/admin/AdminSettlements.tsx`
5. `src/components/admin/AdminCommissionSetup.tsx`
6. `src/components/admin/AdminReturnRequests.tsx`
7. `src/components/admin/AdminOrderManagement.tsx`
8. `src/components/admin/AdminAiFraudDetection.tsx`
9. `src/components/admin/AdminRiskControl.tsx`

