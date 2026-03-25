

## Fix: API Access Management Responsiveness

### Changes in `src/components/admin/AdminApiRequests.tsx`

1. **Sub-tabs overflow** (line 196): Change from `w-fit` to `overflow-x-auto max-w-full` so the 8-tab bar scrolls horizontally instead of overflowing the container.

2. **Summary cards grid** (line 234): Change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` so cards stack on narrow viewports.

3. **Requests table** (lines 296-349): Wrap the `<Table>` inside the Card with `overflow-hidden` on the Card and a `<div className="overflow-x-auto">` around the Table. Add `min-w-[700px]` to the Table so columns don't compress. Add `whitespace-nowrap` to the Actions cell buttons wrapper.

4. **Status filter bar** (line 280 area): Same treatment as sub-tabs -- add `overflow-x-auto max-w-full` instead of `w-fit`.

