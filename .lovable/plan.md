## Add QR Scanning to Agent Flows

### Problem

Agent pages (Cash In, B2B, Bank Transfer, Bill Pay) lack QR scanning. When an agent scans a customer's or another agent's QR code, it should auto-fill the phone number and focus the amount field — consistent with how the main wallet flows work.

### Changes

**1. `src/pages/AgentCashIn.tsx**`

- Import `QrScannerModal` and `parseQrData`
- Add a QR scan icon button next to the "Customer Phone" input
- Add `showQr` state and `QrScannerModal` component
- On scan: parse QR → extract phone → set phone state → if amount is empty, focus amount input

**2. `src/pages/AgentB2B.tsx**`

- Same pattern: add QR scan button next to the phone input
- On scan: parse QR → extract phone → auto-fill

**3. `src/pages/AgentBankTransfer.tsx**`

- Add QR scan button next to the account/phone input if applicable

**4. `src/pages/AgentBillPay.tsx**`

- Add QR scan button next to account number input if applicable

**5.**  User cash out also follow the same process

### Implementation Pattern (same for each page)

```tsx
import QrScannerModal from "@/components/QrScannerModal";
import { parseQrData } from "@/lib/qrParser";
import { ScanLine } from "lucide-react";

// State
const [showQr, setShowQr] = useState(false);

// Next to phone input — add scan button
<div className="relative">
  <Input ... />
  <button onClick={() => setShowQr(true)} className="absolute right-2 top-1/2 -translate-y-1/2">
    <ScanLine size={18} />
  </button>
</div>

// At bottom of component
<QrScannerModal
  open={showQr}
  onClose={() => setShowQr(false)}
  title="Scan Customer QR"
  onScan={(result) => {
    setShowQr(false);
    const parsed = parseQrData(result);
    const extracted = parsed.identifier || result.replace(/\D/g, "").slice(0, 11);
    setPhone(extracted);
  }}
/>
```


| File                    | Change                                                 |
| ----------------------- | ------------------------------------------------------ |
| `AgentCashIn.tsx`       | Add QR scan button + modal for customer phone          |
| `AgentB2B.tsx`          | Add QR scan button + modal for agent/distributor phone |
| `AgentBankTransfer.tsx` | Add QR scan button if phone-based input exists         |
| `AgentBillPay.tsx`      | Add QR scan button if account input exists             |
