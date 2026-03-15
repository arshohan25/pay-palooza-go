

## Wire Tab Rendering for 4 New Admin Modules

The imports and sidebar nav items for Settlements, Bank Reconciliation, Marketing Tools, and Advanced Reports are already in place. The only missing piece is the conditional rendering blocks in the main content area.

### Change

In `src/pages/AdminDashboard.tsx`, insert 4 rendering blocks after the savings tab (around line 1321):

```tsx
{activeTab === "settlements" && <AdminSettlements />}
{activeTab === "bank_recon" && <AdminBankReconciliation />}
{activeTab === "marketing" && <AdminMarketingTools />}
{activeTab === "adv_reports" && <AdminAdvancedReports />}
```

Single file, 4 lines added. No other changes needed.

