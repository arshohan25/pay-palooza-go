Plan to make large Data Quality sample sets fast and safe:

1. Add backend pagination support
- Replace/extend the current `get_data_quality_samples(p_check, p_limit)` behavior with an offset-aware response.
- Enforce a backend hard cap per request, e.g. max 25 rows per page, regardless of what the UI sends.
- Return metadata alongside rows: requested limit, offset, number loaded, and `has_more` so the UI can show a reliable “Load more” button without guessing.
- Keep the existing admin/staff authorization check in the function.

2. Keep queries bounded and index-friendly
- Update each sample query to use `LIMIT safe_limit + 1` internally, then trim to `safe_limit`; the extra row determines `has_more`.
- Apply `OFFSET safe_offset` for simple pagination.
- Preserve selective column lists and existing optimized `NOT EXISTS`/duplicate checks so the function does not load large datasets into the client.
- Add any missing partial indexes needed for the paginated checks if inspection shows a query still scans too broadly.

3. Update the modal UI
- Track `sampleOffset`, `sampleHasMore`, and `samplePageSize` in `AdminDataQualityMonitor`.
- On “View Samples”, load only the first page and reset filter/selection.
- Add a “Load more” button in the dialog footer or below the list.
- Append new rows instead of replacing existing rows.
- Disable the button while loading and hide/label it when there are no more rows.
- Update the dialog description from “Showing up to 25” to something like “Showing 25 loaded samples. Load more for additional records.”

4. Preserve stable-key behavior
- Continue using the existing `sampleRowKey(row, index)` helper for rendering.
- When appending pages, avoid duplicate keys by checking the computed key before appending.
- Keep the current sanity logging for total rows, visible rows, duplicate keys, and selected-row preservation.
- Ensure selected row remains selected after filtering, closing, reopening the same check, and loading more pages if that row is still in the loaded set.

5. Verify
- Run the production build.
- If backend access is available, smoke-test the RPC for at least one high-volume check and confirm it returns bounded pages with `has_more`.
- Confirm the modal never renders an unbounded result set and remains responsive even when a check has many problematic records.