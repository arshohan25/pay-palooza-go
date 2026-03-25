

## Plan: Unify All Admin Filter/Tab Styles to Segmented Controls

### Problem
8 admin components use the old `Button variant="default" / "outline"` pattern for filters and sub-tabs, which is inconsistent with the new segmented control style established in Activity Monitor.

### Target Style
```text
┌─ bg-muted/50 rounded-lg p-1 ─────────────────────────────┐
│  [Active: bg-primary text-primary-foreground shadow-sm]    │
│  [Inactive: text-muted-foreground hover:text-foreground]   │
└───────────────────────────────────────────────────────────-─┘
```
Active items use brand color (`bg-primary text-primary-foreground`) instead of plain `bg-background`. All items wrapped in a single shared background container.

### Files to Update (8 components)

**1. AdminEcommerceHub.tsx** (~line 492-504)
- Replace `Button variant="default"/"outline"` sub-tabs with segmented control
- Keep icons inside each tab item

**2. AdminMarketingTools.tsx** (~line 295-298)
- Replace 3 `Button` tabs (Promo Codes, Cashback Rules, Campaigns) with segmented control

**3. AdminSmartRouting.tsx** (~line 196-199)
- Replace 2 `Button` tabs (Gateway Routing, Payment Links) with segmented control

**4. AdminBankReconciliation.tsx** (~line 93-100)
- Replace 3 `Button` tabs (Overview, Bank Transfers, Reconciliation) with segmented control

**5. AdminGeoTracking.tsx** (~line 106-109)
- Replace 4 `Button` tabs (overview, agents, hotspots, coverage) with segmented control

**6. AdminAiFraudDetection.tsx** (~line 218-223)
- Replace 4 `Button` tabs (Overview, Risk Profiles, Patterns, Velocity) with segmented control

**7. AdminAdvancedReports.tsx** (~line 93-104)
- Replace 4 `Button` tabs with icons (Transactions, Revenue, Commissions, Settlements) with segmented control

**8. AdminNotificationSender.tsx** (~line 423-436)
- Replace 4 `Button` tabs (Compose, Notification Logs, SMS Logs, Templates) with segmented control

**9. AdminActivityMonitor.tsx** (~line 183-214)
- Update existing segmented controls: change active state from `bg-background text-foreground` to `bg-primary text-primary-foreground` for brand color

### Also update: Select dropdowns to segmented controls where appropriate

**10. AdminRechargeLog.tsx** (~line 144-153)
- Replace mode `Select` dropdown (All Modes / Live API / Local) with inline segmented control

**11. AdminBlacklistManager.tsx** (~line 157-164)
- Replace type `Select` dropdown (All Types / Phone / IP / Device) with inline segmented control

### Code Pattern (applied identically everywhere)
```tsx
<div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
  {tabs.map(t => (
    <button
      key={t.key}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
        active === t.key
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => setActive(t.key)}
    >
      <t.icon className="w-3.5 h-3.5" />
      {t.label}
    </button>
  ))}
</div>
```

### Summary
11 components updated, all filters/tabs use the same segmented control with brand-color active state, creating a cohesive, modern, minimal admin experience.

