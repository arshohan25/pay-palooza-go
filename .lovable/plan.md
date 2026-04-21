

## Fix LEA Report PDF Format — Professional Polish

### Changes to `src/components/admin/AdminLEARequest.tsx`

**1. Remove "Deactivated At" and "Scheduled Deletion" rows**

Remove these two rows from both:
- On-screen preview (lines 340-341): the `InfoRow` entries for "Deactivated At" and "Scheduled Deletion"
- Printable report (lines 748-749): the `PrintKV` items for "Deactivated At" and "Scheduled Deletion"

**2. Professional PDF layout improvements**

Redesign the hidden printable div to produce a polished, government-grade document:

- **Header**: Add a horizontal rule with EasyPay teal accent, add a document classification badge ("RESTRICTED"), and include a reference grid (Report ID, Issue Date, Authority, Ref No) in a bordered two-column table instead of loose rows
- **Section headings**: Use teal left-border accent bars with uppercase bold text and consistent spacing
- **Tables**: Improve table styling with alternating row backgrounds (`#f9f9f9`), stronger header row styling with teal background (`#0D9488`) and white text, consistent cell padding (6px)
- **Key-Value sections**: Use a clean two-column bordered table layout with left column in bold gray and right column in regular weight
- **Summary footer**: Convert to a bordered grid card layout with labeled stat boxes instead of a plain table
- **Signature section**: Add proper spacing, thicker signature lines, clearer labels, and a reference number field under "Receiving Authority"
- **Footer**: Add page number placeholder text, strengthen confidentiality notice with bold red "RESTRICTED" label
- **Overall**: Increase base font to 11px for readability, add `lineHeight: 1.6` for better text spacing, use consistent 48px padding

### Files touched
- `src/components/admin/AdminLEARequest.tsx` (edit only)

