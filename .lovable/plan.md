

## Phase 9: Network, System & Remaining Modules — Audit Logging + CRUD Gaps

### Scope
The remaining 12 admin modules with mutations that lack standardized audit logging. Most already have full CRUD; the primary gap is audit trail coverage.

### Files & Changes

| # | File | Lines | Has | Adding |
|---|------|-------|-----|--------|
| 1 | `AdminAgentHub.tsx` | 686 | Full CRUD (create/edit/delete/status) | Audit logging on all mutations |
| 2 | `AdminDistributorManagement.tsx` | 387 | Full CRUD (create/edit/delete/status) | Audit logging on all mutations |
| 3 | `AdminMerchantManagement.tsx` | 1103 | Full CRUD + API keys + status | Audit logging on all mutations |
| 4 | `AdminMerchantApplications.tsx` | 301 | Approve/reject applications | Audit logging on status changes |
| 5 | `AdminKycReview.tsx` | 596 | Approve/reject/request-resubmit | Audit logging on all KYC decisions |
| 6 | `AdminTeamManagement.tsx` | 817 | Full CRUD (create/edit/delete staff) | Audit logging on all mutations |
| 7 | `AdminFeatureLocks.tsx` | 430 | Create/delete locks | Audit logging on lock/unlock actions |
| 8 | `AdminGlobalToggles.tsx` | 495 | Full CRUD (create/edit/delete/toggle) | Audit logging on all mutations |
| 9 | `AdminWalletSystem.tsx` | 444 | Freeze/unfreeze + balance adjustments | Audit logging on freeze/adjust actions |
| 10 | `AdminSystemSettings.tsx` | 669 | Config updates across 5 tabs | Audit logging on all setting changes |
| 11 | `AdminReferralManagement.tsx` | 521 | Milestone payments + status changes | Audit logging on pay/reset actions |
| 12 | `AdminLimitManager.tsx` | 719 | Full CRUD limits + overrides | Audit logging on all mutations |

### Implementation Pattern
Each file gets the standard `auditLog` helper and calls it on every mutation:

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

Specific actions logged per file:
- **AgentHub**: create_agent, edit_agent, delete_agent, toggle_agent_status
- **DistributorManagement**: create_distributor, edit_distributor, delete_distributor, toggle_distributor_status
- **MerchantManagement**: edit_merchant, delete_merchant, toggle_merchant_status, regenerate_api_key
- **MerchantApplications**: approve_application, reject_application
- **KycReview**: approve_kyc, reject_kyc, request_resubmit
- **TeamManagement**: create_team_member, edit_team_member, delete_team_member, toggle_team_status
- **FeatureLocks**: create_feature_lock, delete_feature_lock
- **GlobalToggles**: create_toggle, edit_toggle, delete_toggle, toggle_feature
- **WalletSystem**: freeze_wallet, unfreeze_wallet, adjust_balance
- **SystemSettings**: update_app_config, update_currency, update_fee_rule, update_txn_rule, toggle_maintenance
- **ReferralManagement**: pay_milestone, reset_referral
- **LimitManager**: create_limit, edit_limit, delete_limit, create_override

### Database Changes
None — all tables exist.

### Technical Details
- Add `auditLog` helper at top of each file
- Insert audit calls after each successful Supabase mutation (`.update()`, `.insert()`, `.delete()`)
- Fire-and-forget pattern (no `await` blocking the UI flow for audit)
- Existing CRUD and AlertDialog patterns are preserved; only audit instrumentation is added

