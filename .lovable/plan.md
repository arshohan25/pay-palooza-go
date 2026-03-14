

## Remove History from Add Money and Bank Transfer Flows

Both flows have inline history views (toggled via a "History" button in the header) that duplicate what the main Transaction History page already shows. We'll strip these out.

### Changes

**File: `src/components/AddMoneyFlow.tsx`**
- Remove `showHistory` state variable
- Remove `myRequests` filtering and related imports (`FundRequest`, `Clock`, `XCircle`, `Badge`)
- Remove the History toggle button from the header (lines 146-151)
- Remove the `{!showHistory && ...}` conditional wrapper around the progress bar — always show it
- Remove the `{showHistory ? ... : ...}` conditional in the content area — always render the `AnimatePresence` flow directly
- Remove unused `STATUS_BADGE` constant

**File: `src/components/BankTransferFlow.tsx`**
- Remove `showHistory` state variable
- Remove `myRequests` filtering
- Remove the History toggle button from the header (lines 153-158)
- Remove the `{!showHistory && ...}` conditional wrapper around the progress bar — always show it
- Remove the `{showHistory ? ... : ...}` conditional in the content area — always render the `AnimatePresence` flow directly
- Remove unused `STATUS_BADGE` constant and related imports (`Clock`, `XCircle`, `Badge`) if no longer used elsewhere in the file

No database changes needed.

