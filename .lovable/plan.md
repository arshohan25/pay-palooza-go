
Fix the cut-off by addressing both the page container and the API Keys table sizing.

1. Update `src/pages/AdminDashboard.tsx`
- Remove or relax `overflow-x-hidden` on the main admin content column.
- Keep vertical scrolling behavior, but stop the dashboard shell from clipping child content that needs horizontal scroll.

2. Update `src/components/admin/AdminApiKeys.tsx`
- Keep the dual layout: desktop table + mobile cards.
- Make the desktop table truly scrollable by increasing the table minimum width to match real column needs instead of `min-w-[800px]`.
- Add no-wrap/min-width constraints to the right-side columns (`Created`, `Actions`) and the action button group so the “Reactivate” button cannot be squeezed.
- Give the Actions column a fixed/min width and keep buttons on one line.
- If needed, slightly compact earlier columns (masked key, permissions, date) so the action area keeps enough room.

3. Tighten responsive table behavior
- Apply consistent `whitespace-nowrap` to headers/cells that should never collapse.
- Ensure the scroll container owns the overflow while the card simply clips its own border radius.
- Avoid relying on nested overflow wrappers alone; size the table so horizontal scroll actually activates on medium desktop widths.

4. Check adjacent layout pressure in `src/components/admin/AdminApiRequests.tsx`
- Make the header controls and segmented tabs wrap/scroll cleanly so they do not reduce available width for the keys panel.
- Keep the existing admin segmented-control pattern, but allow overflow on smaller desktop/tablet widths if needed.

5. Verify after implementation
- Recheck the API Keys tab at the current desktop viewport and around tablet widths.
- Confirm both “Revoke” and “Reactivate” are fully visible, clickable, and no column text is clipped.
- Confirm the mobile card layout still works below `md`.

Technical notes
- Root cause is not just “missing responsiveness”; it is a combination of:
  - dashboard-level horizontal clipping in `AdminDashboard.tsx`
  - a table min-width that is too small for 7 columns plus action buttons
  - missing column-specific width constraints for the Actions area
- Most likely file changes:
  - `src/pages/AdminDashboard.tsx`
  - `src/components/admin/AdminApiKeys.tsx`
  - possibly small layout polish in `src/components/admin/AdminApiRequests.tsx`
