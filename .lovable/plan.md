

## Plan: Fix Tagline & Filter Merchant IDs from Recent Contacts

### Changes — `src/components/SendMoneyFlow.tsx`

**1. Update tagline**
Change line 478 from `"Send money to any EasyPay or mobile number"` to `"Secure & Instant Transfer"`.

**2. Filter out merchant IDs from recent contacts**
In the `fetchRecent` useEffect (line 156), remove `"payment"` and `"cashin"` from the `.in("type", ...)` filter so only `"send"` type transactions are queried. This prevents merchant payment recipients from appearing in the send money recent directory.

Additionally, add a filter to skip entries where `recipient_phone` doesn't look like a valid 11-digit mobile number (i.e., skip merchant IDs or wallet IDs that aren't phone numbers):
```tsx
if (seen.has(phone) || !/^\d{11}$/.test(phone)) continue;
```

### Files Modified
- `src/components/SendMoneyFlow.tsx`

