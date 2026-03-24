

## Plan: Make Activity Monitor Responsive

### Problem
At medium desktop widths (~1128px), the table columns overflow and text gets clipped (Status shows "Comp...", Chargeback button is cut off). The table tries to show too many columns for the available width.

### Changes — Single File: `src/components/admin/AdminActivityMonitor.tsx`

**1. Improve column visibility at breakpoints:**
- Hide "Date-Time" column below `xl` (already showing in expanded details)
- Hide "Balance After" below `2xl` instead of `xl`
- Make Short ID column narrower with truncation

**2. Reduce horizontal padding in table cells:**
- Change `px-4` to `px-3` on all `<td>` and `<th>` elements to reclaim space

**3. Make the expanded detail row more responsive:**
- Use `grid-cols-2 md:grid-cols-3` for the detail grid so it adapts at medium widths

**4. Improve filter row wrapping:**
- Add `overflow-x-auto` with horizontal scroll on the type filter row so 11 filter buttons don't force wrapping at tight widths

**5. Ensure Status badge doesn't truncate:**
- Add `whitespace-nowrap` to the Status badge cell

### Result
The table will gracefully hide less-critical columns (Date, Balance After) at narrower desktop widths while keeping essential data (ID, Type, Sender, Receiver, Amount, Status) always visible. The expanded row still shows all details.

