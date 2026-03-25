

## Fix: API Keys Table Clipping

### Problem
The "Reactivate" button and Actions column are cut off on the right edge because the Card wrapping the table doesn't allow horizontal overflow.

### Solution
Wrap the `<Table>` inside the Card with an `overflow-x-auto` div, and add `min-w` to the table to ensure it doesn't compress columns. Also add `whitespace-nowrap` to the Actions cell to prevent button text wrapping.

### File: `src/components/admin/AdminApiKeys.tsx`

1. Wrap `<Table>` in `<div className="overflow-x-auto">` inside the Card
2. Add `className="min-w-[800px]"` to the Table so columns maintain proper width
3. Add `whitespace-nowrap` to the Actions TableCell to keep buttons on one line

