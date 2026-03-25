

## Fix: Remove Extra Column Spacing & Show Cut-off Actions

**Problem**: The table has large `min-w` values on each column that force excessive spacing between Env/Status/Permissions columns (visible as wide gaps in the screenshot). The total `min-w` sum (~1050px) pushes the Actions column off-screen.

**Solution**: Remove the fixed `min-w-[1050px]` from the Table and reduce/remove `min-w` on individual columns. Let the table auto-size columns to their content, which eliminates the gaps and keeps Actions visible.

### Changes in `src/components/admin/AdminApiKeys.tsx`

1. **Remove `min-w-[1050px]` from `<Table>`** — let it be `w-full` instead
2. **Remove all `min-w-[...]` from `<TableHead>` elements** — columns will size to content naturally
3. **Add `w-auto` to compact columns** (Env, Status, Permissions, Created) so they shrink-wrap
4. **Keep `whitespace-nowrap` on Actions cell** so buttons stay on one line

The result: columns hug their content, no wasted space, Actions column fully visible without horizontal scroll at the user's 874px content width.

