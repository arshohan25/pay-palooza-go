

## Fix Agent Transaction Credit/Debit Logic

From the **agent's perspective**:
- **Cash Out** = customer withdraws → agent gives cash, receives balance → **credit (+)**
- **Cash In** = customer deposits → agent takes cash, sends balance → **debit (−)**

### Changes in `src/pages/AgentDashboard.tsx`

**Line 455**: Flip credit logic
```tsx
// Before
const isCredit = tx.type === "cashin";
// After
const isCredit = tx.type === "cashout";
```

**Lines 457-461**: Swap icon styles to match new semantics
- `cashout` → green/primary (money in for agent)
- `cashin` → red/destructive (money out for agent)

```tsx
case "cashin": return { Icon: ArrowUpFromLine, cls: "bg-destructive/10 text-destructive" };
case "cashout": return { Icon: ArrowDownToLine, cls: "bg-primary/10 text-primary" };
```

Single file, 3-line change.

