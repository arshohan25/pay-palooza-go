

# Premium Redesign: Transaction Detail Sheet + Share Receipt

## Problem
1. The amount display shows `-৳১` but the number formatting may be unclear (Bangla numeral rendering)
2. The Share Receipt title shows raw wallet ID `[Wallet: EZP-NNQU-HSEW]` instead of a clean label like "Send Money"
3. Both the transaction detail sheet and share receipt need a premium visual upgrade

## Changes

### 1. Fix amount display — always use English numerals
- In both `TransactionList.tsx` detail sheet and `TransactionHistory.tsx` detail sheet, change `.toLocaleString()` to `.toLocaleString("en-IN")` to ensure readable digits
- Apply the same fix in `ShareReceiptSheet.tsx` (the `receipt.amount` is passed as a pre-formatted string, so fix it at the source where receipts are constructed)

### 2. Fix Share Receipt title
- In `TransactionHistory.tsx` (line 756), replace `selectedTx.detail` (which contains `[Wallet: EZP-NNQU-HSEW]`) with the category label (e.g., "Send Money")
- Same fix in `TransactionList.tsx` receipt construction — use `display.label` instead of raw description for the title

### 3. Premium redesign — Transaction Detail Sheet (`TransactionList.tsx`)
- **Header**: Larger gradient hero section with the type icon, amount in bold white, and a status pill
- **Rows**: Add subtle left-accent color bars, slightly larger icons, smoother spacing
- **Total Amount card**: Gradient border with glassmorphism

### 4. Premium redesign — Share Receipt Sheet (`ShareReceiptSheet.tsx`)
- **Header gradient**: Taller with a subtle pattern overlay, amount in `text-4xl` with proper sign formatting
- **Receipt card**: Add subtle shadow depth, separator dots between rows
- **Transaction ID section**: Monospace with primary accent, larger copy button
- **Action buttons**: Rounded pill style with subtle shadows

### 5. Premium redesign — Transaction History Detail Sheet (`TransactionHistory.tsx`)
- Mirror the same premium styling from `TransactionList.tsx` detail sheet for consistency

## Files Modified
- `src/components/TransactionList.tsx` — fix numerals + premium detail sheet redesign
- `src/components/ShareReceiptSheet.tsx` — premium receipt card redesign
- `src/pages/TransactionHistory.tsx` — fix title/numerals + premium detail sheet redesign

