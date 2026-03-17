

## Remove All PiggyBank Icons

Replace every `PiggyBank` icon usage with a more appropriate alternative across 3 files.

### Replacements

| File | Current | Replacement | Reason |
|------|---------|-------------|--------|
| `src/pages/AdminDashboard.tsx` | `PiggyBank` for "Savings" tab | `Wallet` (already imported) | Savings context |
| `src/pages/AdminDashboard.tsx` | `PiggyBank` for "Auto-Save" tab | `CalendarClock` | Scheduled saving |
| `src/components/admin/AdminSavingsManagement.tsx` | `PiggyBank` for Total Savings stat card | `Coins` | Money/savings |
| `src/components/admin/AdminAutoSaveMonitor.tsx` | `PiggyBank` for Active count card | `Coins` | Money context |

### Steps
1. **AdminDashboard.tsx**: Remove `PiggyBank` from import, add `CalendarClock` if missing. Change Savings icon to `Wallet`, Auto-Save icon to `CalendarClock`.
2. **AdminSavingsManagement.tsx**: Replace `PiggyBank` import with `Coins`, update the JSX.
3. **AdminAutoSaveMonitor.tsx**: Replace `PiggyBank` import with `Coins`, update the JSX.

Three files, four icon swaps total.

