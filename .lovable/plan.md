

## Plan: Animated Empty States Audit & Replacement

### Scope
Found ~30 plain-text empty states across user-facing pages and admin components. All will be updated to use the standardized animated pattern with entrance animation + floating icon.

### Pattern Applied (same as existing)
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9, y: 12 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  transition={{ duration: 0.5, ease: "easeOut" }}
  className="flex flex-col items-center justify-center py-8 text-center"
>
  <motion.div
    animate={{ y: [0, -4, 0] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
  >
    <Icon className="w-7 h-7 text-muted-foreground" />
  </motion.div>
  <p className="text-sm font-semibold text-foreground">Title</p>
  <p className="text-xs text-muted-foreground mt-1">Subtitle</p>
</motion.div>
```

### User-Facing Pages (Priority)

| File | Empty State | Icon |
|------|------------|------|
| `AgentDashboard.tsx` (line 441) | "No transactions yet" | Clock |
| `DistributorDashboard.tsx` (line 524) | "No agents yet" | Users |
| `MerchantDashboard.tsx` (lines 671, 918, 1242) | "No payments yet", "No customer data yet", "No settlements yet" | CreditCard, Users, BanknoteIcon |
| `SuperDistributorDashboard.tsx` (lines 644, 712, 804, 1059) | Notifications, distributors, agents, transactions | Bell, Building, Users, FileText |
| `InboxPage.tsx` (line 754) | "No contacts available" | Users |
| `SupportChat.tsx` (line 442) | "No messages yet" | Lock |

### Admin Components

| File | Empty State | Icon |
|------|------------|------|
| `AdminDashboard.tsx` (lines 699, 900, 959, 1018) | Transactions, users, agents, merchants | FileText, Users, Users, Store |
| `AdminChargebackHistory.tsx` (line 382) | "No chargebacks found" | ShieldAlert |
| `AdminChargeConfig.tsx` (line 224) | "No charge rules configured" | Settings |
| `AdminCommissionSetup.tsx` (line 148) | "No commission rules" | Percent |
| `AdminGlobalToggles.tsx` (line 167) | "No feature toggles" | ToggleLeft |
| `AdminGatewayConfig.tsx` (line 255) | "No payment gateways" | CreditCard |
| `AdminWebhookLog.tsx` (line 185) | "No payment sessions" | Webhook |
| `AdminRechargePackManager.tsx` (line 378) | "No packs found" | Package |
| `AdminReferralManagement.tsx` (lines 328, 382, 416) | Referrals, rewards, devices | Users, Gift, Smartphone |
| `AdminRechargeLog.tsx` (line 176) | "No recharge transactions" | RefreshCw |
| `AdminKycReview.tsx` (line 289) | "No KYC records" | FileSearch |
| `AdminOrderManagement.tsx` (line 505) | "No orders found" | Package |
| `AdminBillerConfig.tsx` (line 304) | "No biller configs" | Settings |
| `AdminTreasury.tsx` (line 610) | "No ledger entries" | BookOpen |
| `AdminAuditLogViewer.tsx` (line 277) | "No audit log entries" | FileText |

### Already Animated (No Changes)
- `NotificationCenter.tsx` — has motion animation
- `SpendingInsightsPage.tsx` — has motion animation
- `TransactionHistory.tsx` — already updated
- `CashOutFlow.tsx`, `PaymentFlow.tsx`, `SendMoneyFlow.tsx` — already updated

### Files Modified (21 total)
- `src/pages/AgentDashboard.tsx`
- `src/pages/DistributorDashboard.tsx`
- `src/pages/MerchantDashboard.tsx`
- `src/pages/SuperDistributorDashboard.tsx`
- `src/pages/InboxPage.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/components/SupportChat.tsx`
- `src/components/admin/AdminChargebackHistory.tsx`
- `src/components/admin/AdminChargeConfig.tsx`
- `src/components/admin/AdminCommissionSetup.tsx`
- `src/components/admin/AdminGlobalToggles.tsx`
- `src/components/admin/AdminGatewayConfig.tsx`
- `src/components/admin/AdminWebhookLog.tsx`
- `src/components/admin/AdminRechargePackManager.tsx`
- `src/components/admin/AdminReferralManagement.tsx`
- `src/components/admin/AdminRechargeLog.tsx`
- `src/components/admin/AdminKycReview.tsx`
- `src/components/admin/AdminOrderManagement.tsx`
- `src/components/admin/AdminBillerConfig.tsx`
- `src/components/admin/AdminTreasury.tsx`
- `src/components/admin/AdminAuditLogViewer.tsx`

