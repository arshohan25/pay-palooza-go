

## Filter Monitor to Add Money and Bank Transfer Users Only

Currently the monitor tracks `addmoney` and `send` transaction types. The user wants it to track only users who are **adding money** (from external sources) and **transferring to bank accounts/other MFS** — not internal P2P sends.

### Changes to `src/components/admin/AdminUserMonitor.tsx`

1. **Replace transaction type filter** from `["addmoney", "send"]` to `["addmoney", "banktransfer"]` in all queries (auto-fetch, watchlist add, detail sheet)
2. **Update labels** throughout:
   - "Send/Transfer" → "Bank Transfer"
   - "Sent" → "Transferred"
   - "Send Money" → "Bank Transfer"
   - "Transfers" → "Bank Transfers"
   - Chart config key `send` label → "Bank Transfer"
3. **Update icons**: Keep `ArrowDownLeft` for Add Money, use existing `ArrowUpRight` for Bank Transfer
4. **Update stat card colors** to differentiate (keep emerald for add money, destructive for bank transfer)

All changes are UI-only within the single file — no database or schema changes needed.

