

## Plan: Add Disbursement Success Receipt Card

### What it does
After a successful treasury disbursement, instead of just showing a toast, display an animated receipt card summarizing the transaction with old/new balances for both the treasury and recipient.

### Changes to `src/components/admin/AdminTreasury.tsx`

**1. Add receipt state:**
```typescript
interface DisbursementReceipt {
  recipientName: string;
  recipientPhone: string;
  amount: number;
  oldTreasuryBalance: number;
  newTreasuryBalance: number;
  oldRecipientBalance: number;
  newRecipientBalance: number;
  reference: string;
  timestamp: Date;
}
```
- New state: `const [receipt, setReceipt] = useState<DisbursementReceipt | null>(null)`

**2. Update `handleSendFunds` success handler:**
- Before clearing form state, capture old balances from current `treasury.balance` and `foundUser.balance`
- Build a `DisbursementReceipt` object using RPC response data (`new_treasury_balance`, `target_new_balance`)
- Set the receipt state so the card renders

**3. Add receipt card UI** between the Send Funds section and the Treasury Ledger:
- Animated card (Framer Motion slide-in) with green success header
- Two-column layout showing:
  - Left: Treasury — old balance → new balance
  - Right: Recipient — old balance → new balance
- Amount sent prominently displayed
- Reference ID and timestamp
- "Dismiss" button to clear the receipt

**4. Add `CheckCircle` icon** to the lucide-react import for the success indicator.

### No database changes needed.

