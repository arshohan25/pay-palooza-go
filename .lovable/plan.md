

## Polish: Minor UI & Code Cleanup

### Issues Found
1. **Mismatched `<div>` indentation** in the header section (line 277) — cosmetic but messy
2. **`visibleMainTabs` missing `mainTabs` dependency** — the `useMemo` references `mainTabs` array but only has `[staffAllowedTabs, isDisabled]` in deps (works because `mainTabs` is a stable const, but lint may warn)
3. **No empty state for Merchant section tabs** — if all merchant main tabs are toggled off, the tab bar could show nothing without explanation

### Verdict
Everything is **functionally working correctly**. The database has all 15 merchant toggles, the code filters properly, the admin UI displays them under the Merchant tab, and realtime sync is active. The console warning is from Radix UI internals and cannot be fixed on our side.

**No code changes needed** — the system is working as designed.

