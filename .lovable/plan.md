## Plan: Add Bengali translations to remaining hardcoded strings

### Problem

Several pages have hardcoded English strings that don't switch when the user toggles to Bengali. The main offenders are:

1. **LimitsPage.tsx** — "Cash In", "Mobile Recharge", "Pay Bill", "Bank Transfer" titles, "No Limit" label, and all 6 tariff note bullet texts are hardcoded English.
2. **ReferPage.tsx** — StatusBadge labels ("Completed", "Pending", "Failed"), milestone labels ("Starter", "Bonus", "Champion"), "friends" in milestone cards, "complete" in progress bar, share button labels ("WhatsApp", "SMS", "More").
3. **SpendingInsightsPage.tsx** — Cashback count text ("recharge"/"recharges"), bar chart data keys ("Send", "CashOut", "Payment", "Recharge") used in tooltips.

### Changes

**File 1: `src/lib/i18n.tsx**` — Add ~15 new translation keys:

- `noLimit` — "No Limit" / "কোনো সীমা নেই"
- `mobileRecharge` — "Mobile Recharge" / "মোবাইল রিচার্জ"
- `tariffCashOutAgentNew` — "Cash Out (Agent): 1.19% fee" / "ক্যাশ আউট (এজেন্ট): ১.১৯% ফি"
- `tariffATM` — "ATM Cash Out: Not available" / "ATM ক্যাশ আউট: উপলব্ধ নয়"
- `tariffSendMoneyNew` — "Send Money: ৳3 after ৳100 up to ৳50,000, Then ৳5/txn" / Bengali equivalent
- `tariffBankTransfer` — "Bank Transfer: 1% fee" / Bengali
- `tariffAddMoneyFree` — "Add Money: Free" / Bengali
- `tariffPaymentPayBill` — "Payment & Pay Bill: No limit, Free" / Bengali
- `starter` / `bonus` / `champion` — Milestone labels in Bengali

**File 2: `src/pages/LimitsPage.tsx**` — Replace all hardcoded strings with `t()` calls:

- Service card titles: `"Cash In"` → `t("cashIn")`, `"Mobile Recharge"` → `t("mobileRecharge")`, `"Pay Bill"` → `t("payBill")`, `"Bank Transfer"` → `t("bankTransfer")`
- Same for labels inside limits arrays
- `"No Limit"` → `t("noLimit")`
- All 6 tariff note `<li>` items → `t("tariffCashOutAgentNew")`, etc.

**File 3: `src/pages/ReferPage.tsx**` — Replace hardcoded strings:

- StatusBadge: use `t("completed")`, `t("pending")`, `t("failed")` (these keys already exist)
- Milestone labels and "friends" text
- `"complete"` in progress bar → `t("pctComplete")` (already exists)

**File 4: `src/pages/SpendingInsightsPage.tsx**` — Replace "recharge"/"recharges" with translated text

File 5: Edit profile page

File 6: KYC Verification page

File 7: Change pin page

### Technical Details

- All new keys follow the existing `{ en: "...", bn: "..." }` pattern in the translations object
- No structural changes — only string replacements with `t()` calls
- Existing keys like `cashIn`, `payBill`, `bankTransfer`, `completed`, `pending`, `failed` are already defined and will be reused