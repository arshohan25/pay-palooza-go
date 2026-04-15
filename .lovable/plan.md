# Show Wallet ID and Name in Send Money Summary & Receipt

## Problem

- When sending by **phone number**: the confirm/success screens show the phone but not the recipient's wallet ID
- When sending by **wallet ID**: the confirm/success screens show the resolved phone number, but the sender should only see the recipient's **name and wallet ID** (not their phone — privacy)

## Changes

### 1. Update `resolve_transfer_recipient` RPC (new migration)

Add `recipient_wallet_id` to the response JSON for both phone and wallet lookups:

```sql
-- For wallet match: include the wallet ID that was searched
'recipient_wallet_id', upper(v_input)

-- For phone match: compute and include the wallet ID
'recipient_wallet_id', generate_wallet_id_from_phone(v_profile.phone)
```

### 2. Update `SendMoneyFlow.tsx` — capture wallet ID and `matched_by`

- Add state: `resolvedWalletId` and `matchedBy` (track how recipient was found)
- In `validateRecipientExists`, return `walletId` and `matchedBy` from the RPC response
- Store these in all resolution paths (`handleManualSend`, `handleSelectContact`, `handleQrScan`, auto-resolve)

### 3. Update confirm card, success receipt, and share receipt

**When sent by phone (`matchedBy === 'phone'`):**

- Show: Name AND Phone Number

**When sent by wallet ID (`matchedBy === 'wallet'`):**

- Show: Name and Wallet ID only (hide phone number for privacy)

Affected UI sections:

- **Amount step** recipient card (line ~754): add wallet ID below phone/instead of phone
- **Confirm step** recipient card (line ~902): show wallet ID, conditionally hide phone
- **Success receipt** (line ~1010): show wallet ID row, conditionally hide phone
- **Share receipt** rows (line ~1086): adjust Mobile/Wallet row based on `matchedBy`

### 4. Transaction history display

The `transferMoney` call already stores `recipientName` and `recipientPhone` in the transactions table. The wallet ID will be included in the description or stored via the existing fields so it appears in `TransactionList`.

- Update the `transferMoney` call to pass wallet ID in the description field: e.g. `"Wallet: EZP-XXXX-XXXX"` appended to note
- In `TransactionList.tsx`, parse and display wallet ID from description when present