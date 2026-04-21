

## LEA Report: Optional Sections Toggle + Wallet ID

### Changes

**File: `src/components/admin/AdminLEARequest.tsx`**

1. **Replace "Referral Code" with "Wallet ID"** in Account Information section (both on-screen preview and printable report). Import `generateWalletId` from `@/lib/walletId` and compute it from `report.profile.user_id`.

2. **Make sections 5-15 collapsible/optional** via a checkbox toggle panel. Add a state object tracking which optional sections to include:
   ```ts
   const [includeSections, setIncludeSections] = useState({
     devices: false,
     savedBanks: false,
     fundRequests: false,
     loans: false,
     fraudAlerts: false,
     disputes: false,
     complaints: false,
     referrals: false,
     agent: false,
     merchant: false,
     auditLogs: false,
   });
   ```
   - Add a "Select Sections to Include" panel with checkboxes after the search/authority fields
   - Sections 1-4 (Account Info, KYC, Transactions, Roles) remain always visible
   - Sections 5-15 only render in on-screen preview AND printable report when their checkbox is checked
   - Add a "Select All / Deselect All" toggle for convenience

3. **Update printable report** to also respect the toggle state -- only include checked sections in the PDF download. Replace "Referral Code" with "Wallet ID" in the print layout as well.

### Files touched
- `src/components/admin/AdminLEARequest.tsx` (edit)

