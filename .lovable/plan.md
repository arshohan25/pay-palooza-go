
## Future-Ready LEA Module Improvements

### Goal
Upgrade the LEA request/reporting flow from a basic report generator into a more manager-ready compliance workflow with better control, traceability, and PDF reliability.

### 1. Add a Compliance Readiness Panel

In `src/components/admin/AdminLEARequest.tsx`, add a compact checklist card above the PDF download area that shows whether the report is ready:

- Phone searched
- User profile found
- Requesting authority filled
- Reference number filled
- Issue date selected
- Report ID generated
- Transaction data loaded
- Optional sections selected

Each item will show a pass/warning state so admins can quickly see what is missing before downloading.

### 2. Improve LEA History for Future Review

Enhance the LEA Reports History table with manager-friendly controls:

- Search/filter by phone, report ID, authority, or reference number
- Status badges for generated/downloaded
- Clear “last generated” timestamp formatting
- Summary counts in the expanded detail panel:
  - Total transactions
  - Total money in
  - Total money out
  - Fraud alerts
  - Disputes
  - Included sections

This makes future audits easier without opening every row manually.

### 3. Add PDF Integrity Metadata

Add a “Report Integrity” block to the PDF footer containing:

- Report ID
- Generated timestamp
- Searched phone
- Authority reference number
- Generated-by admin identity when available
- Section count
- Page numbering support

This improves legal defensibility and makes every exported report easier to verify later.

### 4. Strengthen PDF Pagination Safety

Improve the existing PDF paginator further by:

- Tracking whether measured pagination or fallback pagination was used
- Ensuring every PDF segment has a minimum height
- Avoiding blank pages
- Preventing tiny trailing slices when the last page contains only a few pixels
- Adding page numbers after generation so multi-page LEA reports are clearer

If row measurement becomes inconsistent, it will continue to use the existing fallback safely.

### 5. Add Re-download Progress Feedback

Improve the existing re-download button with clearer state labels:

- “Loading data…”
- “Preparing PDF…”
- “Downloading…”
- Disabled state while active
- Prevent multiple history rows from being re-downloaded at the same time

This avoids duplicate downloads and gives admins confidence that the action is working.

### 6. Add Future Manager Notes Field

Add an optional on-screen “Internal Note” field for the admin before download.

The note will appear in the audit detail panel/history summary but will not be printed in the LEA PDF unless explicitly selected later. This keeps internal operational notes separate from official disclosure output.

### Technical Details

Primary file to edit:

- `src/components/admin/AdminLEARequest.tsx`

Implementation approach:

- Add local state for:
  - history search/filter text
  - redownload phase
  - internal manager note
  - PDF pagination mode/result
- Add derived validation checklist items from current form/report state
- Extend the existing PDF footer with integrity metadata and page numbers
- Keep all improvements client-side unless the existing `lea_reports` table already supports extra metadata fields
- If persistent manager notes require a new database field, add that as a separate backend migration after confirming the current table schema

### Expected Result

Admins will get a more professional LEA workflow with:

- Better readiness checks before download
- Easier future audit review
- More reliable multi-page PDFs
- Safer re-download behavior
- Clearer report integrity information
