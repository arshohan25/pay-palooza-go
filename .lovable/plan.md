

## Admin Panel Enhancement — Comprehensive Upgrade Plan

### Current State Analysis
After inspecting all existing admin modules, here's the gap analysis:

### 1. Modules to ENHANCE (add missing tabs/features)

**AdminWalletSystem.tsx** — Add 2 new tabs:
- **Freeze/Unfreeze** tab: Search user by phone, freeze/unfreeze wallet with reason, show frozen wallets list
- **Adjustments** tab: Manual balance adjustment (credit/debit) with reason, audit trail, confirmation dialog

**AdminAgentHub.tsx** — Add **Commission** tab showing per-agent commission earned, breakdown by txn type, date range filter

**AdminSettlements.tsx** — Add sub-tabs:
- **Daily Settlement** view with date picker showing auto-grouped daily batches
- **Settlement History** with full search, date range, CSV export

**AdminSecurityCenter.tsx** — Add **2FA Management** tab: list users with 2FA status, force-enable/disable

**AdminSystemSettings.tsx** — Add 2 tabs:
- **Fee Rules** tab: quick view of all `fee_config` entries with inline toggle
- **Transaction Rules** tab: velocity limits, duplicate guards, blocked patterns

**AdminNotificationSender.tsx** — Add tabs:
- **SMS Logs** tab: recent SMS deliveries from `audit_logs`
- **Notification Logs** tab: searchable log of all sent notifications with delivery status

**AdminMarketingTools.tsx** — Add **Campaigns** tab: create named campaigns grouping promo codes + cashback rules with start/end dates and performance tracking

**AdminApiHub.tsx** — Add tabs for **API Keys** management, **Rate Limits** view, **Sandbox Mode** toggle

### 2. NEW Modules to Create

**AdminFloatManagement.tsx** — 4 tabs:
- Master Float (platform treasury float overview)
- Gateway Float (per-gateway allocated float)
- Merchant Float (merchant-wise float tracking)
- Agent Float (agent-wise float vs max_float utilization)

**AdminRevenueDashboard.tsx** — 4 tabs:
- Total Revenue (aggregate earnings with charts)
- Commission Income (from `commission_tiers` / treasury_ledger)
- Charge Income (from fee_config based earnings)
- Profit Report (revenue minus payouts with date range)

**AdminMfsMonitor.tsx** — MFS Operations Monitor showing real-time stats for:
- Cash In / Cash Out volumes
- Send Money / Payment flows
- Recharge / Bill Pay / Bank Transfer activity
- All from `transactions` table grouped by type with hourly/daily trends

### 3. Dashboard Integration
- Add `float_mgmt`, `revenue`, `mfs_monitor` to `NAV_GROUPS`
- Float Management → Financial group
- Revenue Dashboard → Financial group
- MFS Monitor → Operations group

### Files to Create (3)
| File | Description |
|------|-------------|
| `src/components/admin/AdminFloatManagement.tsx` | Float oversight across all tiers |
| `src/components/admin/AdminRevenueDashboard.tsx` | Revenue, commission, profit analytics |
| `src/components/admin/AdminMfsMonitor.tsx` | Real-time MFS operations dashboard |

### Files to Edit (9)
| File | Changes |
|------|---------|
| `src/components/admin/AdminWalletSystem.tsx` | Add Freeze/Unfreeze + Adjustments tabs |
| `src/components/admin/AdminAgentHub.tsx` | Add Commission tab |
| `src/components/admin/AdminSettlements.tsx` | Add Daily + History sub-views |
| `src/components/admin/AdminSecurityCenter.tsx` | Add 2FA tab |
| `src/components/admin/AdminSystemSettings.tsx` | Add Fee Rules + Txn Rules tabs |
| `src/components/admin/AdminNotificationSender.tsx` | Add SMS Logs + Notification Logs tabs |
| `src/components/admin/AdminMarketingTools.tsx` | Add Campaigns tab |
| `src/components/admin/AdminApiHub.tsx` | Add API Keys, Rate Limits, Sandbox tabs |
| `src/pages/AdminDashboard.tsx` | Wire 3 new modules into nav + imports |

No database migrations needed — all data comes from existing tables (`transactions`, `profiles`, `agents`, `merchants`, `fee_config`, `treasury_ledger`, `platform_treasury`, `audit_logs`, `notifications`, `device_registrations`).

