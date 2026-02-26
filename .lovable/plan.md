## Plan: Update Send Money Fee Labels and Tariff Note

### What Changes

Two text updates in `src/pages/LimitsPage.tsx`:

1. **Send Money service card fee label** (lines 104-105): Change `"Free ≤৳100, ৳3 ≤৳50k, ৳5"` to `"Free ≤৳100, ৳3 >৳100–৳50k, ৳5/txn"` — this clarifies that the ৳3 fee applies *after* ৳100 up to ৳50k, matching the tariff note format.
2. **Tariff note Send Money line** (line 224): Change `"Send Money: Free up to ৳100, then ৳3 up to ৳50,000, then ৳5/txn"` to `"Send Money: ৳3 after ৳100 up to ৳50,000, Then ৳5/txn"` — adds the "after ৳100" clarification per your request.

### Technical Details

- Single file edit: `src/pages/LimitsPage.tsx`
- Lines 104-105: Update both daily and monthly fee strings for Send Money
- Line 224: Update tariff note bullet text