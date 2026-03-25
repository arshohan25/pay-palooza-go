
Problem identified: I was fixing only the inner component, but the screenshot shows this is a layout-chain issue, not just a table issue.

What’s actually causing the cut-off:
1. `src/components/admin/AdminApiKeys.tsx`
- The desktop table still uses `min-w-[800px]`, which is too small for 7 columns plus two action buttons.
- The Actions column has no enforced width, so “Reactivate” gets squeezed and clipped.

2. `src/pages/AdminDashboard.tsx`
- The main admin content wrapper still has `overflow-x-hidden` on the main column.
- That parent container can clip child content before the table’s own horizontal scroll can help.

3. `src/components/admin/AdminApiRequests.tsx`
- The sub-tabs and request table were improved, but the API Keys tab is a separate child component, so those fixes do not solve the API Keys clipping.

Implementation plan:
1. Fix the parent dashboard container
- Update the main admin column in `AdminDashboard.tsx` to stop horizontally clipping child panels.
- Keep vertical scrolling behavior, but allow child sections like API Keys to manage their own horizontal overflow.

2. Fix the API Keys desktop table sizing
- Increase the table minimum width substantially so scrolling activates before buttons are compressed.
- Add explicit width / no-wrap rules to:
  - `Created`
  - `Actions`
  - action button group
- Keep the action buttons on one line at all times.

3. Rebalance the API Keys columns
- Constrain earlier columns so they don’t steal space from Actions:
  - mask/API key column
  - permissions column
  - created date column
- Use nowrap where appropriate and allow truncation only on non-critical content.

4. Improve API Keys header responsiveness
- If needed, make the top controls row wrap more gracefully so it doesn’t reduce available content width on medium desktop sizes.

5. Verify the full API Access Management section
- Recheck:
  - sub-tab overflow
  - summary cards wrapping
  - requests table scroll
  - API Keys table actions visibility
- Specifically confirm the revoked row shows the full “Reactivate” button at the current desktop viewport.

Files to update:
- `src/pages/AdminDashboard.tsx`
- `src/components/admin/AdminApiKeys.tsx`
- possibly minor polish in `src/components/admin/AdminApiRequests.tsx`

Why previous attempts didn’t fully work:
- They addressed scroll wrappers, but not the two real blockers together:
  - the parent `overflow-x-hidden`
  - the API Keys table being undersized for its actual column content
