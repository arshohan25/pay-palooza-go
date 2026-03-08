

## Smart QR Data Extraction & Routing

### Problem
The "Scan & Pay" QR handler on the home page does a naive string check (`startsWith("MRC")`). It doesn't parse structured QR payloads (JSON from user QR codes, URLs, or other formats). If a QR contains a JSON object like `{"walletId":"...","name":"...","app":"EasyPay"}`, the raw JSON string gets passed to SendMoney, which fails validation.

### Solution
Create a universal QR parser that extracts meaningful data from any scanned QR, determines the correct flow, and pre-fills the appropriate fields.

### Changes

**1. New utility: `src/lib/qrParser.ts`**
A parser function that accepts a raw QR string and returns a structured result:
- Try JSON parse → extract `walletId`, `name`, `app`, `merchantId` fields
- Check for `MRC-` or `MRC` prefix → merchant flow
- Check for 11-digit phone number → send money flow
- Check for `EZP-XXXX-XXXX` wallet ID pattern → send money flow
- Check for URL patterns (extract query params like `?pay=MRC-XXX` or `?to=0171...`)
- Fallback: attempt `resolve_transfer_recipient` RPC to see if the raw string matches any user/merchant
- Return: `{ flow: 'payment' | 'send' | 'unknown', identifier: string, name?: string }`

**2. Update `src/pages/Index.tsx` — Scan & Pay handler**
Replace the simple `startsWith("MRC")` check with the new parser:
- Parse QR result → get flow type and extracted identifier
- Route to Payment flow with pre-filled merchant ID, or Send Money with pre-filled phone/wallet ID
- Show a toast error for `unknown` flow type ("Unrecognized QR code")

**3. Update `src/components/SendMoneyFlow.tsx` — `handleQrScan`**
- Before passing to `detectRecipientType`, run through the parser to extract the actual identifier from JSON or structured payloads
- Pass the clean identifier (not raw JSON) to validation

**4. Update `src/components/PaymentFlow.tsx` — `handleQrScan`**
- Similarly extract merchant ID from structured payloads before validation

### Flow Summary
```text
QR Scanned
  │
  ├─ JSON with walletId? ──→ Send Money (walletId)
  ├─ JSON with merchantId? ─→ Payment (merchantId)
  ├─ Starts with MRC? ─────→ Payment (raw string)
  ├─ 11-digit number? ─────→ Send Money (phone)
  ├─ EZP-XXXX-XXXX? ──────→ Send Money (walletId)
  ├─ URL with params? ─────→ Extract & route
  └─ Otherwise ────────────→ Try resolve_transfer_recipient
       ├─ Found? → Route to matching flow
       └─ Not found? → Toast "Unrecognized QR"
```

