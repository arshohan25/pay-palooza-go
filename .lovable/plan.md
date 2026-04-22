

## Add Audit-Log Detail Panel to LEA Module

### Changes to `src/components/admin/AdminLEARequest.tsx`

**1. Expandable detail panel on history rows**

Add a `selectedHistoryId` state. When an admin clicks a row in the LEA Reports History table, expand an inline detail panel (or Sheet/Dialog) below the row showing:

- **Timestamp**: Full `generated_at` datetime with timezone
- **Admin Identity**: Look up `generated_by` UUID against `profiles` table to show admin name and phone
- **Searched Phone**: `phone` field from the report record
- **Authority**: `authority` field
- **Reference Number**: `reference_no` field
- **Issue Date**: `issue_date` field
- **Download Status**: Always "Downloaded" (reports are only saved after successful PDF generation), with the report ID displayed
- **Sections Included**: List of enabled sections from `sections_included` array
- **Summary Stats**: Parsed from `summary` JSONB (total txns, total in/out, fraud alerts, disputes)

**2. Fetch admin profile for display**

When a history row is selected, fetch the admin's name from `profiles` using the `generated_by` UUID. Cache results in a local map to avoid repeat queries.

**3. UI layout**

- Add a clickable row style (cursor-pointer, hover highlight) to history table rows
- Below the selected row, render a collapsible Card with a two-column key-value grid showing all audit fields
- Include a "Close" button to deselect
- Add an `Eye` icon import from lucide-react for the detail panel header

### Files touched
- `src/components/admin/AdminLEARequest.tsx` (edit only)

