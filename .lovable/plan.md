

## Plan: Validate Recipients Exist Before Processing Transactions

### Problem
All three transaction flows allow sending money to non-existent users:
- **SendMoneyFlow**: Any 11-digit phone number is accepted, even if no EasyPay wallet exists
- **CashOutFlow**: Any agent ID is accepted without verifying it belongs to a registered agent
- **PaymentFlow**: Any merchant ID is accepted without verifying it belongs to a registered merchant

The `transfer_money` RPC deducts from the sender regardless — if the recipient doesn't exist, the money is lost (deducted but never credited).

### Solution
Add recipient existence validation at the point where the user confirms the recipient, before proceeding to the amount step.

### Changes

#### 1. SendMoneyFlow.tsx — Validate phone exists in `profiles` table
In `handleManualSend()` and `handleQrScan()`, before proceeding to the amount step, query the `profiles` table to check if a user with that phone exists. If not found, show an error: "This number is not registered on EasyPay."

Also fetch the recipient's real name from the profile to display it accurately.

**Affected functions**: `handleManualSend()` (~line 325), `handleQrScan()` (~line 351), and contact selection `handleSelectContact()`.

#### 2. CashOutFlow.tsx — Validate agent exists in `agents` table
In `handleAgentIdContinue()` and `handleQrScan()`, query the `agents` table (joined with `profiles` for the phone) to verify the agent ID exists and is active. Show error: "Agent not found. Please enter a valid Agent ID."

**Affected functions**: `handleAgentIdContinue()` (~line 256), `handleQrScan()` (~line 244).

#### 3. PaymentFlow.tsx — Validate merchant exists in `merchants` table
In `handleMerchantIdContinue()` and `handleQrScan()`, query the `merchants` table to verify the merchant exists and is active. Show error: "Merchant not found. Please enter a valid Merchant ID."

**Affected functions**: `handleMerchantIdContinue()` (~line 194), `handleQrScan()` (~line 183).

#### 4. Server-side safety net (transfer_money RPC)
Update the `transfer_money` RPC to **reject** transactions when the recipient profile is not found, instead of silently completing with `recipient_found: false`. This prevents money loss even if client validation is bypassed.

### Files Modified (4)
- `src/components/SendMoneyFlow.tsx`
- `src/components/CashOutFlow.tsx`
- `src/components/PaymentFlow.tsx`
- Database migration: update `transfer_money` RPC to raise exception when recipient not found

