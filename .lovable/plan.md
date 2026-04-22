

## Improve LEA PDF Table Formatting and Add Re-download from History

### Changes to `src/components/admin/AdminLEARequest.tsx`

**1. Fix PDF transaction table column widths and wrapping**

The printable `PrintTable` component (line 334) currently has no column width constraints, causing long names/phones to push the table beyond the page. Changes:

- Update `PrintTable` to accept an optional `colWidths` array prop for explicit percentage widths
- Apply `wordBreak: "break-word"`, `whiteSpace: "normal"`, and `maxWidth` to `td` cells
- Set the transaction table to use landscape-friendly fixed widths:
  - Date: 11%, ID: 7%, Type: 7%, Amount: 9%, Fee: 7%, Bal After: 9%, Name: 18%, Phone: 12%, Ref: 12%, Status: 8%
- Reduce font size from 10 to 9 for the transaction table rows to fit more content
- Add `tableLayout: "fixed"` to the `<table>` element so column widths are respected
- Truncate the Date column to short date only (no time) in the PDF to save space

**2. Apply consistent formatting to all PrintTable instances**

- All other `PrintTable` usages (devices, banks, fund requests, loans, fraud alerts, disputes, complaints, referrals, audit trail) also get `tableLayout: "fixed"` and `wordBreak: "break-word"` for consistency

**3. Add re-download button in history audit detail panel**

- Add a "Re-download" `Button` inside the expanded audit detail row (near the close button) 
- On click, populate the search phone, authority, refNo, issueDate, and reportId from the history record, then trigger `handleSearch` to reload the user data so the admin can re-generate the PDF
- This avoids storing the full report data — it simply pre-fills the form fields and searches again

### Files touched
- `src/components/admin/AdminLEARequest.tsx` (edit only)

