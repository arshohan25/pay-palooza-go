

## Plan: Update Audit Log Viewer for Full Phase 1–10 Coverage

### Problem
The `AdminAuditLogViewer.tsx` has only 4 filter categories and 7 recognized actions in `ACTION_META`. All 80+ audit actions added in Phases 1–10 fall under "Other" with generic labels and no icons.

### Solution
Update `CATEGORY_MAP` and `ACTION_META` in `AdminAuditLogViewer.tsx` to properly categorize and label all audit actions from across the admin modules.

### Changes — Single File: `src/components/admin/AdminAuditLogViewer.tsx`

**1. Expand `CATEGORY_MAP` with new categories (~15 total):**

| Category Key | Label | Actions Included |
|---|---|---|
| profile_views | Profile Views | view_user_profile, view_all_profiles |
| chargebacks | Chargebacks | chargeback, chargeback_reversal |
| treasury | Treasury | treasury_disburse |
| referrals | Referrals | referral_milestone_pay, referral_milestone_reset, referral_reset_all |
| user_management | User Management | toggle_user_status, soft_delete_user, reactivate_user, device_revoked |
| agents | Agents | create_agent, edit_agent, delete_agent, toggle_agent_status |
| distributors | Distributors | create_distributor, edit_distributor, delete_distributor, toggle_distributor_status |
| merchants | Merchants | edit_merchant, delete_merchant, toggle_merchant_status, regenerate_api_key, approve_application, reject_application |
| kyc | KYC | approve_kyc, reject_kyc, request_resubmit |
| team | Team | create_team_member, edit_team_member, delete_team_member, toggle_team_status |
| security_risk | Security & Risk | blacklist_added, blacklist_toggled, blacklist_deleted, blacklist_edited, gateway_toggled, gateway_created, gateway_updated, gateway_deleted, fraud_rule_create, fraud_rule_edit, fraud_rule_delete, fraud_rule_toggle, freeze_wallet, unfreeze_wallet, aml_toggle |
| financial | Financial | commission_rule_edit, commission_rule_delete, commission_tier_create, commission_tier_edit, commission_tier_delete, settlement_create, settlement_status, settlement_delete, adjust_balance |
| system_config | System Config | create_feature_lock, delete_feature_lock, create_toggle, edit_toggle, delete_toggle, toggle_feature, update_app_config, update_fee_rule, update_txn_rule, toggle_maintenance, banner_create, banner_update, banner_delete, create_bank, toggle_bank, delete_bank |
| ecommerce | E-Commerce | flash_sale_create, flash_sale_edit, flash_sale_delete, flash_sale_toggle, order_status, order_cancel, order_bulk_status, return_status, return_delete, product_toggle, product_edit, product_delete, store_toggle, coupon_create, coupon_edit, coupon_delete |
| fraud | Fraud | fraud_alert_status, fraud_alert_assign, fraud_alert_escalate, fraud_alert_delete, fraud_investigate |
| notifications | Notifications | notification_send, charge_config_create, charge_config_edit, charge_config_delete, charge_config_toggle |

**2. Expand `ACTION_META` with labels and icons for all ~80 actions** — each gets a human-readable label and appropriate Lucide icon.

**3. Add new icon imports** — add `Truck, Store, UserCog, Settings, ShoppingCart, CreditCard, Bell, Lock, Unlock, Ban, Pencil, UserPlus, UserMinus, ToggleLeft, Package` etc.

### Technical Details
- Only `CATEGORY_MAP`, `ACTION_META`, and icon imports change
- No structural/layout changes to the viewer itself
- The existing `formatAction()` fallback still handles any unrecognized future actions gracefully
- Filter dropdown will show all ~15 categories instead of 4

### Files Modified
1. `src/components/admin/AdminAuditLogViewer.tsx`

