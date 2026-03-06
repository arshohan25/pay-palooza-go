

## Plan: Add RealtimeUpdateIndicator to Admin Components Missing It

### Components to Update

11 admin components have real-time subscriptions but lack the visual "Data synced just now" indicator. Two components (AdminActivityFeed, AdminActivityMonitor) are live-feed/monitor UIs where the indicator would be redundant and are excluded.

| Component | Realtime Table(s) |
|---|---|
| AdminSupportDashboard | support_conversations, support_messages |
| AdminGatewayConfig | payment_gateways |
| AdminRechargePackManager | recharge_packs |
| AdminOrderManagement | orders |
| AdminReferralManagement | referrals, referral_rewards |
| AdminFeatureLocks | feature_locks |
| AdminKycReview | kyc_verifications |
| AdminRechargeLog | transactions (recharge) |
| AdminGlobalToggles | global_feature_toggles |
| AdminTreasury | platform_treasury, treasury_ledger |
| AdminFraudAlerts | fraud_alerts |
| AdminWebhookLog | payment_sessions |

### Change per Component (identical pattern)

1. Import `useRealtimeIndicator` and `RealtimeUpdateIndicator`
2. Initialize `const { visible, flash } = useRealtimeIndicator()`
3. Call `flash()` inside the existing realtime callback alongside the data reload
4. Render `<RealtimeUpdateIndicator visible={visible} />` near the top of the component's return JSX

### Files to Modify
- `src/components/admin/AdminSupportDashboard.tsx`
- `src/components/admin/AdminGatewayConfig.tsx`
- `src/components/admin/AdminRechargePackManager.tsx`
- `src/components/admin/AdminOrderManagement.tsx`
- `src/components/admin/AdminReferralManagement.tsx`
- `src/components/admin/AdminFeatureLocks.tsx`
- `src/components/admin/AdminKycReview.tsx`
- `src/components/admin/AdminRechargeLog.tsx`
- `src/components/admin/AdminGlobalToggles.tsx`
- `src/components/admin/AdminTreasury.tsx`
- `src/components/admin/AdminFraudAlerts.tsx`
- `src/components/admin/AdminWebhookLog.tsx`

